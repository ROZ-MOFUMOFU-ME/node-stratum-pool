import merkleTree from './merkleTree.ts';
import transactions from './transactions.ts';
import * as util from './util.ts';

// import algos, { diff1 } from './algoProperties.js'; // Only diff1 is used
import { diff1 } from './algoProperties.ts';

/**
 * The BlockTemplate class holds a single job.
 * and provides several methods to validate and submit it to the daemon coin
 **/
const BlockTemplate = function BlockTemplate(
    this: any,
    jobId: any,
    rpcData: any,
    poolAddressScript: any,
    extraNoncePlaceholder: any,
    reward: any,
    txMessages: any,
    recipients: any,
    network: any
) {
    // private members
    const submits: any[] = [];

    function getMerkleHashes(steps: any[]) {
        return steps.map(function (step) {
            return step.toString('hex');
        });
    }

    function getTransactionBuffers(txs: any[]) {
        // Which transaction hash gets committed to the block merkle root differs
        // by chain family:
        //   - Zcash/Sapling chains (e.g. Koto) commit each tx's GetHash() — the
        //     sha256d of the FULL serialization, exposed as `hash` by
        //     getblocktemplate. For shielded txs this differs from `txid` (which
        //     omits the binding signature / auth data), so using `txid` corrupts
        //     the merkle root and the daemon rejects the block with
        //     "CheckBlock(): hashMerkleRoot mismatch".
        //   - Bitcoin/segwit chains commit `txid` (with `hash` being the witness
        //     wtxid), so `txid` must be used there.
        // A Sapling template is identified by the finalsaplingroothash field.
        const saplingMerkle = rpcData.finalsaplingroothash !== undefined;
        const txHashes = txs.map(function (tx) {
            if (saplingMerkle) {
                if (tx.hash !== undefined) {
                    return util.uint256BufferFromHash(tx.hash);
                }
                return util.sha256d(Buffer.from(tx.data, 'hex'));
            }
            if (tx.txid !== undefined) {
                return util.uint256BufferFromHash(tx.txid);
            }
            return util.uint256BufferFromHash(tx.hash);
        });
        return ([null] as any[]).concat(txHashes);
    }

    function getVoteData() {
        if (!rpcData.masternode_payments) return Buffer.alloc(0);

        return Buffer.concat(
            [util.varIntBuffer(rpcData.votes.length)].concat(
                rpcData.votes.map(function (vt: any) {
                    return Buffer.from(vt, 'hex');
                })
            )
        );
    }

    // public members
    this.rpcData = rpcData;
    this.jobId = jobId;

    this.target = rpcData.target
        ? BigInt(`0x${rpcData.target}`)
        : util.bignumFromBitsHex(rpcData.bits);

    // Scaling constant (for up to 9 decimal places)
    const SCALE = 1000000000n;
    // Calculate difficulty using BigInt
    const difficultyBigInt = (diff1 * SCALE) / this.target;
    // Convert to Number and scale down to get decimal places
    this.difficulty = Number(difficultyBigInt) / Number(SCALE);

    /*// Debug logging for target, difficulty, and diff1
    console.log(`[DEBUG] blockTemplate target: ${this.target}`);
    console.log(`[DEBUG] blockTemplate difficulty: ${this.difficulty}`);
    console.log(`[DEBUG] blockTemplate diff1: ${diff1}`);*/

    this.prevHashReversed = util
        .reverseByteOrder(Buffer.from(rpcData.previousblockhash, 'hex'))
        .toString('hex');
    if (rpcData.finalsaplingroothash) {
        this.finalsaplingroothashReversed = util
            .reverseByteOrder(Buffer.from(rpcData.finalsaplingroothash, 'hex'))
            .toString('hex');
    }
    // VIPSTARCOIN / HTMLcoin (qtum) hashStateRoot / hashUTXORoot for the stratum
    // notify. The canonical miner (ccminer -a vipstar / -a html) reads each root and
    // runs it through le32dec, i.e. it byteswaps every uint32 word when building the
    // PoW preimage. The daemon's serialized header (and the pool's serializeHeader)
    // hold the roots in canonical little-endian = the full byte reverse of the
    // getblocktemplate hex. To make the miner reconstruct exactly that, send the
    // roots with their eight uint32 words in REVERSE ORDER (bytes within each word
    // unchanged): the miner's per-word byteswap then yields the canonical bytes, so
    // the miner, the pool's share hash and the daemon's block hash all agree.
    const swapRootWordOrder = (hex: string) => {
        const b = Buffer.from(hex, 'hex');
        const out = Buffer.alloc(b.length);
        for (let i = 0; i + 4 <= b.length; i += 4) b.subarray(i, i + 4).copy(out, b.length - 4 - i);
        return out.toString('hex');
    };
    if (rpcData.hashstateroot) {
        this.hashstaterootReversed = swapRootWordOrder(rpcData.hashstateroot);
    }
    if (rpcData.hashutxoroot) {
        this.hashutxorootReversed = swapRootWordOrder(rpcData.hashutxoroot);
    }
    this.transactionData = Buffer.concat(
        rpcData.transactions.map(function (tx: any) {
            return Buffer.from(tx.data, 'hex');
        })
    );
    this.merkleTree = new (merkleTree as any)(getTransactionBuffers(rpcData.transactions));
    this.merkleBranch = getMerkleHashes(this.merkleTree.steps);
    this.generationTransaction = transactions.CreateGeneration(
        rpcData,
        poolAddressScript,
        extraNoncePlaceholder,
        reward,
        txMessages,
        recipients,
        network
    );

    this.serializeCoinbase = function (this: any, extraNonce1: Buffer, extraNonce2: Buffer) {
        return Buffer.concat([
            this.generationTransaction[0],
            extraNonce1,
            extraNonce2,
            this.generationTransaction[1],
        ]);
    };

    // https://en.bitcoin.it/wiki/Protocol_specification#Block_Headers
    this.serializeHeader = function (merkleRoot: any, nTime: any, nonce: any, versionMask: any) {
        let headerSize;
        if (rpcData.version == 5 && rpcData.finalsaplingroothash) {
            headerSize = 112;
        } else if (rpcData.hashstateroot && rpcData.hashutxoroot) {
            headerSize = 181;
        } else {
            headerSize = 80;
        }

        const header = Buffer.alloc(headerSize);
        let position = 0;

        if (rpcData.version == 5 && rpcData.finalsaplingroothash) {
            header.write(rpcData.finalsaplingroothash, position, 32, 'hex');
            position += 32;
        }
        if (rpcData.hashstateroot && rpcData.hashutxoroot) {
            header.write(
                '00ffffffff000000000000000000000000000000000000000000000000000000000000',
                position,
                37,
                'hex'
            );
            header.write(rpcData.hashutxoroot, (position += 37), 32, 'hex');
            header.write(rpcData.hashstateroot, (position += 32), 32, 'hex');
            header.write(nonce, (position += 32), 4, 'hex');
        }
        header.write(nonce, position, 4, 'hex');
        header.write(rpcData.bits, (position += 4), 4, 'hex');
        header.write(nTime, (position += 4), 4, 'hex');
        header.write(merkleRoot, (position += 4), 32, 'hex');
        header.write(rpcData.previousblockhash, (position += 32), 32, 'hex');

        // Apply version mask if provided
        let version = rpcData.version;
        if (versionMask !== undefined) {
            version =
                (version & ~parseInt('0x1fffe000', 16)) |
                (versionMask & parseInt('0x1fffe000', 16));
        }

        header.writeUInt32BE(version, position + 32);
        return util.reverseBuffer(header);
    };

    this.serializeBlock = function (this: any, header: Buffer, coinbase: Buffer) {
        return Buffer.concat([
            header,
            util.varIntBuffer(this.rpcData.transactions.length + 1),
            coinbase,
            this.transactionData,
            getVoteData(),
            Buffer.from(reward === 'POS' ? [0] : []),
        ]);
    };

    this.registerSubmit = function (extraNonce1: any, extraNonce2: any, nTime: any, nonce: any) {
        const submission = extraNonce1 + extraNonce2 + nTime + nonce;
        if (submits.indexOf(submission) === -1) {
            submits.push(submission);
            return true;
        }
        return false;
    };

    this.getOdoKey = function (this: any) {
        if (this.rpcData && this.rpcData.odokey !== undefined) {
            return this.rpcData.odokey;
        }
        return null;
    };

    this.getJobParams = function (this: any) {
        if (!this.jobParams) {
            this.jobParams = [
                this.jobId,
                this.prevHashReversed,
                this.generationTransaction[0].toString('hex'),
                this.generationTransaction[1].toString('hex'),
                this.merkleBranch,
                util.packInt32BE(this.rpcData.version).toString('hex'),
                this.rpcData.bits,
                util.packUInt32BE(this.rpcData.curtime).toString('hex'),
            ];
            if (this.hashstaterootReversed && this.hashutxorootReversed) {
                // VIPSTARCOIN / HTMLcoin (qtum-style): the canonical miner
                // (ccminer -a vipstar / -a html) reads hashstateroot + hashutxoroot
                // immediately after nTime and BEFORE the cleanJobs flag, then a
                // trailing (PoW-unused) reward field. This order must match the
                // miner's stratum_notify, otherwise it parses the cleanJobs boolean
                // as the state root. Order: ..., nTime, stateroot, utxoroot, clean, reward.
                this.jobParams.push(this.hashstaterootReversed);
                this.jobParams.push(this.hashutxorootReversed);
                this.jobParams.push(true);
                this.jobParams.push(
                    '0000000000000000000000000000000000000000000000000000000000000000ffffffff00'
                );
            } else {
                this.jobParams.push(true);
                if (this.finalsaplingroothashReversed) {
                    this.jobParams.push(this.finalsaplingroothashReversed);
                }
            }
        }
        return this.jobParams;
    };
};

export default BlockTemplate;
