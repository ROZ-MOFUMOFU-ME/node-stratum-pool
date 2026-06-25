import http from 'http';
import * as util from './util.ts';

/*
 * VIPSTARCOIN / qtum getwork bridge.
 *
 * getwork-only miners (e.g. the official ccminer-x64) mine VIPS fine via solo HTTP getwork,
 * but cannot build the qtum stratum job (they expect the daemon to hand them a finished,
 * big-endian-word "data" blob). They are incompatible with this pool's stratum notify and
 * read every share as "low difficulty share of 0".
 *
 * This server exposes the daemon-style getwork RPC on top of the pool's existing jobManager,
 * so those miners can join the pool. The pool's coinbase (fee/payout) is preserved because we
 * build the work from jobManager.currentJob, not from the daemon's getwork.
 *
 * data format (verified byte-for-byte against VIPSTARCOINd getwork):
 *   data = wordByteSwap( serializeHeader()'s 181-byte wire output ) + 11 zero bytes  (= 192B)
 *   wordByteSwap = reverse the 4 bytes of every 32-bit word (word order kept).
 *   This maps version 00000020<->20000000 and the qtum roots between the two encodings.
 *   target = little-endian network target (reverse of the big-endian rpcData.target hex).
 */

function wordByteSwap(buf: Buffer): Buffer {
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i + 4 <= buf.length; i += 4) {
        out[i] = buf[i + 3];
        out[i + 1] = buf[i + 2];
        out[i + 2] = buf[i + 1];
        out[i + 3] = buf[i];
    }
    return out;
}

const GETWORK_PAD = Buffer.alloc(11, 0);

const DIFF1 = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');

// getwork target (little-endian) for a given pool share difficulty, so miners submit shares at
// the pool's difficulty rather than only full blocks.
function diffToTarget(diff: number): string {
    const d = Math.max(1, Math.floor(diff));
    const be = (DIFF1 / BigInt(d)).toString(16).padStart(64, '0');
    return util.reverseBuffer(Buffer.from(be, 'hex')).toString('hex');
}

const GetworkServer = function (
    this: any,
    jobManager: any,
    options: any,
    authorizeFn: any,
    emitLog: any,
    emitErrorLog: any
) {
    const cfg = options.getwork || {};
    const port = cfg.port;

    // One session per worker name keeps a stable extraNonce1, so the coinbase (and therefore the
    // merkleRoot) is reproducible when the same worker submits. extraNonce2 is fixed at zero
    // (getwork miners only roll nonce + nTime).
    const sessions: any = {};

    function sessionFor(worker: string) {
        let s = sessions[worker];
        if (!s) {
            s = { en1: jobManager.extraNonceCounter.next() };
            sessions[worker] = s;
        }
        return s;
    }

    function getWork(worker: string) {
        const job = jobManager.currentJob;
        if (!job || !job.rpcData || !job.rpcData.target) return null;
        const s = sessionFor(worker);
        // Fixed extraNonce1/2 per worker; the miner explores via nonce + rolled nTime (X-Roll-NTime
        // header below), so the coinbase/merkleRoot stays stable and submits verify cleanly while
        // each (nTime,nonce) pair is distinct (avoids "duplicate share").
        const en2 = Buffer.alloc(jobManager.extraNonce2Size, 0);
        s.en2hex = en2.toString('hex');
        const en1 = Buffer.from(s.en1, 'hex');
        const built = jobManager.buildGetworkHeader(en1, en2);
        if (!built) return null;
        s.jobId = built.jobId;
        const data = Buffer.concat([wordByteSwap(built.headerLE), GETWORK_PAD]).toString('hex');
        const target = diffToTarget(cfg.diff || 1);
        return { data, target };
    }

    function submitWork(worker: string, dataHex: string, ip: string) {
        const s = sessions[worker];
        if (!s || !s.jobId) return false;
        const wire = wordByteSwap(Buffer.from(dataHex, 'hex').subarray(0, 181));
        // serializeHeader wire layout: version[0:4] prev[4:36] merkle[36:68]
        //                              nTime[68:72] bits[72:76] nonce[76:80] roots...
        // wire holds nTime/nonce little-endian; processShare/serializeHeader expect big-endian
        // hex (same as stratum), so reverse each 4-byte field back.
        const nTime = Buffer.from(wire.subarray(68, 72)).reverse().toString('hex');
        const nonce = Buffer.from(wire.subarray(76, 80)).reverse().toString('hex');
        const en2hex = s.en2hex || Buffer.alloc(jobManager.extraNonce2Size, 0).toString('hex');
        const diff = cfg.diff || 1;
        jobManager.processShare(
            s.jobId,
            null,
            diff,
            s.en1,
            en2hex,
            nTime,
            nonce,
            ip,
            port,
            worker,
            undefined
        );
        return true;
    }

    this.start = function () {
        if (!port) return;
        http.createServer(function (req: any, res: any) {
            let body = '';
            req.on('data', (c: any) => (body += c));
            req.on('end', function () {
                const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
                let worker = '';
                const auth = req.headers['authorization'];
                if (auth && auth.indexOf('Basic ') === 0) {
                    worker = Buffer.from(auth.slice(6), 'base64').toString().split(':')[0];
                }
                authorizeFn(ip, port, worker, '', function (authResult: any) {
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('X-Roll-NTime', 'expire=120');
                    if (!authResult || !authResult.authorized) {
                        res.writeHead(401);
                        res.end(
                            JSON.stringify({
                                result: null,
                                error: { code: -1, message: 'unauthorized' },
                                id: 1,
                            })
                        );
                        return;
                    }
                    let reqId: any = 1;
                    let params: any[] = [];
                    let method = 'getwork';
                    try {
                        const j = JSON.parse(body);
                        reqId = j.id;
                        params = j.params || [];
                        method = j.method || 'getwork';
                    } catch {
                        /* empty/non-JSON body = work request */
                    }
                    let result: any = null;
                    let rpcError: any = null;
                    try {
                        if (method !== 'getwork') {
                            // ccminer probes getblocktemplate/getmininginfo; answer result:false with
                            // no error so it quietly stays in getwork mode (no "JSON-RPC call failed").
                            result = false;
                        } else if (params.length === 0 || !params[0]) {
                            result = getWork(worker);
                        } else {
                            result = submitWork(worker, params[0], ip);
                        }
                    } catch (e) {
                        emitErrorLog('getwork handler error: ' + e);
                    }
                    const respBody = JSON.stringify({ result, error: rpcError, id: reqId });
                    res.writeHead(200);
                    res.end(respBody);
                });
            });
        }).listen(port, function () {
            emitLog('Getwork (HTTP) server started on port ' + port);
        });
    };
};

export default GetworkServer;
