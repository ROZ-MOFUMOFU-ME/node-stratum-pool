import http from 'http';
import https from 'https';
import fs from 'fs';
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
 * It mirrors the stratum side: opt-in via options.getwork.enabled, multiple ports each with its
 * own difficulty / TLS / vardiff. getwork is only needed for qtum-family coins (vipstar), so it
 * stays disabled unless explicitly enabled.
 *
 * data format (verified byte-for-byte against VIPSTARCOINd getwork):
 *   data = wordByteSwap( serializeHeader()'s 181-byte wire output ) + 11 zero bytes  (= 192B)
 *   wordByteSwap = reverse the 4 bytes of every 32-bit word (word order kept).
 *   This maps version 00000020<->20000000 and the qtum roots between the two encodings.
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

// getwork target (little-endian) for a pool share difficulty, scaled by 1e8 so fractional
// difficulties (vardiff) keep precision.
function diffToTarget(diff: number): string {
    const SCALE = 100000000n;
    const d = BigInt(Math.max(1, Math.floor(diff * 1e8)));
    const be = ((DIFF1 * SCALE) / d).toString(16).padStart(64, '0').slice(-64);
    return util.reverseBuffer(Buffer.from(be, 'hex')).toString('hex');
}

// Per-worker vardiff, mirroring varDiff.ts but driven by getwork submit cadence (no socket).
function makeVardiff(opts: any, startDiff: number) {
    const variance = opts.targetTime * (opts.variancePercent / 100);
    return {
        opts,
        tMin: opts.targetTime - variance,
        tMax: opts.targetTime + variance,
        diff: startDiff,
        lastTs: 0,
        lastRetarget: 0,
        times: [] as number[],
    };
}

function vardiffOnSubmit(vd: any, nowSec: number) {
    if (!vd.lastRetarget) {
        vd.lastRetarget = nowSec - vd.opts.retargetTime / 2;
        vd.lastTs = nowSec;
        return;
    }
    vd.times.push(Math.max(1, nowSec - vd.lastTs));
    vd.lastTs = nowSec;
    if (nowSec - vd.lastRetarget < vd.opts.retargetTime || vd.times.length === 0) return;
    vd.lastRetarget = nowSec;
    const avg = vd.times.reduce((a: number, b: number) => a + b, 0) / vd.times.length;
    vd.times = [];
    if (avg > vd.tMax || avg < vd.tMin) {
        let next = vd.diff * (vd.opts.targetTime / avg);
        next = Math.max(vd.opts.minDiff || 0.01, Math.min(vd.opts.maxDiff || 1e9, next));
        vd.diff = next;
    }
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
    // Normalize to a ports map { "3340": { diff, tls, varDiff } }; accept a single-port shorthand
    // ({ port, diff }) for backward compatibility.
    const ports: any =
        cfg.ports ||
        (cfg.port ? { [String(cfg.port)]: { diff: cfg.diff, varDiff: cfg.varDiff } } : {});

    // Per-worker session: stable extraNonce1 (so coinbase/merkleRoot is reproducible at submit),
    // current difficulty and optional vardiff state.
    const sessions: any = {};

    function sessionFor(worker: string, portCfg: any) {
        let s = sessions[worker];
        if (!s) {
            const startDiff = portCfg.diff || 1;
            s = {
                en1: jobManager.extraNonceCounter.next(),
                en2hex: Buffer.alloc(jobManager.extraNonce2Size, 0).toString('hex'),
                diff: startDiff,
                vd: portCfg.varDiff ? makeVardiff(portCfg.varDiff, startDiff) : null,
            };
            sessions[worker] = s;
        }
        return s;
    }

    function getWork(worker: string, portCfg: any) {
        const job = jobManager.currentJob;
        if (!job || !job.rpcData || !job.rpcData.target) return null;
        const s = sessionFor(worker, portCfg);
        // Fixed extraNonce1/2 per worker; the miner explores via nonce + rolled nTime (X-Roll-NTime
        // header), so the merkleRoot stays stable and each (nTime,nonce) pair is distinct.
        const en1 = Buffer.from(s.en1, 'hex');
        const en2 = Buffer.from(s.en2hex, 'hex');
        const built = jobManager.buildGetworkHeader(en1, en2);
        if (!built) return null;
        s.jobId = built.jobId;
        const data = Buffer.concat([wordByteSwap(built.headerLE), GETWORK_PAD]).toString('hex');
        const diff = s.vd ? s.vd.diff : s.diff;
        s.diff = diff;
        return { data, target: diffToTarget(diff) };
    }

    function submitWork(worker: string, dataHex: string, ip: string, port: number) {
        const s = sessions[worker];
        if (!s || !s.jobId) return false;
        const wire = wordByteSwap(Buffer.from(dataHex, 'hex').subarray(0, 181));
        // wire layout: version[0:4] prev[4:36] merkle[36:68] nTime[68:72] bits[72:76] nonce[76:80].
        // wire is little-endian; processShare/serializeHeader want big-endian hex, so reverse each.
        const nTime = Buffer.from(wire.subarray(68, 72)).reverse().toString('hex');
        const nonce = Buffer.from(wire.subarray(76, 80)).reverse().toString('hex');
        if (s.vd) vardiffOnSubmit(s.vd, (Date.now() / 1000) | 0);
        jobManager.processShare(
            s.jobId,
            null,
            s.diff,
            s.en1,
            s.en2hex,
            nTime,
            nonce,
            ip,
            port,
            worker,
            undefined
        );
        return true;
    }

    function makeHandler(portNum: number, portCfg: any) {
        return function (req: any, res: any) {
            let body = '';
            req.on('data', (c: any) => (body += c));
            req.on('end', function () {
                const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
                let worker = '';
                const auth = req.headers['authorization'];
                if (auth && auth.indexOf('Basic ') === 0) {
                    worker = Buffer.from(auth.slice(6), 'base64').toString().split(':')[0];
                }
                authorizeFn(ip, portNum, worker, '', function (authResult: any) {
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
                    try {
                        if (method !== 'getwork') {
                            // ccminer probes getblocktemplate/getmininginfo; answer result:false with
                            // no error so it stays in getwork mode (no "JSON-RPC call failed").
                            result = false;
                        } else if (params.length === 0 || !params[0]) {
                            result = getWork(worker, portCfg);
                        } else {
                            result = submitWork(worker, params[0], ip, portNum);
                        }
                    } catch (e) {
                        emitErrorLog('getwork handler error: ' + e);
                    }
                    res.writeHead(200);
                    res.end(JSON.stringify({ result, error: null, id: reqId }));
                });
            });
        };
    }

    this.start = function () {
        // Opt-in only (getwork is just for qtum-family coins like vipstar). Disabled unless
        // options.getwork.enabled is true.
        if (!cfg.enabled) return;
        const tlsOpts = options.tlsOptions || {};
        Object.keys(ports).forEach(function (portStr) {
            const portNum = parseInt(portStr);
            const portCfg = ports[portStr] || {};
            const handler = makeHandler(portNum, portCfg);
            let server: any;
            if (portCfg.tls) {
                if (!tlsOpts.serverKey || !tlsOpts.serverCert) {
                    emitErrorLog(
                        `Getwork port ${portStr} requests TLS but tlsOptions.serverKey/serverCert are not set; skipping`
                    );
                    return;
                }
                server = https.createServer(
                    {
                        key: fs.readFileSync(tlsOpts.serverKey),
                        cert: fs.readFileSync(tlsOpts.serverCert),
                        ca: tlsOpts.ca ? fs.readFileSync(tlsOpts.ca) : undefined,
                    },
                    handler
                );
            } else {
                server = http.createServer(handler);
            }
            server.listen(portNum, '0.0.0.0', function () {
                emitLog(
                    `Getwork (HTTP${portCfg.tls ? 'S' : ''}) server started on port ${portStr}`
                );
            });
        });
    };
};

export default GetworkServer;
