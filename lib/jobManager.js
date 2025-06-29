import events from 'events';
import crypto from 'crypto';

import * as util from './util.js';
import blockTemplate from './blockTemplate.js';

// Import algos and diff1
import algos, { diff1 } from './algoProperties.js';

// Unique extranonce per subscriber
const ExtraNonceCounter = function (configInstanceId) {
    const instanceId = configInstanceId || crypto.randomBytes(4).readUInt32LE(0);
    let counter = instanceId << 27;

    this.next = function () {
        const extraNonce = util.packUInt32BE(Math.abs(counter++));
        return extraNonce.toString('hex');
    };

    this.size = 4; // bytes
};

// Unique job per new block template
const JobCounter = function () {
    let counter = 0;

    this.next = function () {
        counter++;
        if (counter % 0xffff === 0) counter = 1;
        return this.cur();
    };

    this.cur = function () {
        return counter.toString(16);
    };
};

/**
 * Emits:
 * - newBlock(blockTemplate) - When a new block (previously unknown to the JobManager) is added, use this event to broadcast new jobs
 * - share(shareData, blockHex) - When a worker submits a share. It will have blockHex if a block was found
 **/
const JobManager = function JobManager(options) {
    const _this = this;
    const jobCounter = new JobCounter();
    const emitErrorLog = function (text) {
        _this.emit('log', 'error', text);
    };

    this.extraNonceCounter = new ExtraNonceCounter(options.instanceId);
    this.extraNoncePlaceholder = Buffer.from('f000000ff111111f', 'hex');
    this.extraNonce2Size = this.extraNoncePlaceholder.length - this.extraNonceCounter.size;
    this.currentJob;
    this.validJobs = {};

    const hashDigest = algos[options.coin.algorithm].hash(options.coin);

    const coinbaseHasher = (function () {
        switch (options.coin.algorithm) {
            case 'keccak':
            case 'blake':
            case 'fugue':
            case 'groestl':
                if (options.coin.normalHashing === true) return util.sha256d;
                else return util.sha256;
            default:
                return util.sha256d;
        }
    })();

    const blockHasher = (function () {
        switch (options.coin.algorithm) {
            case 'blake':
            case 'blake2s':
            case 'neoscrypt':
            case 'lyra2':
            case 'lyra2re2':
            case 'allium':
            case 'lyra2v2':
            case 'lyra2v3':
            case 'qubit':
            case 'skein':
            case 'x11':
            case 'x16r':
            case 'x16rv2':
            case 'x17':
            case 'odo':
            case 'minotaur':
            case 'groestl':
            case 'groestlmyriad':
                return function () {
                    return util.reverseBuffer(util.sha256d.apply(this, arguments));
                };
            case 'lyra2rev2':
                return function () {
                    return util.reverseBuffer(hashDigest.apply(this, arguments));
                };
            case 'scrypt':
            case 'scrypt-og':
            case 'scrypt-jane':
                if (options.coin.reward === 'POS') {
                    return function (_d) {
                        return util.reverseBuffer(hashDigest.apply(this, arguments));
                    };
                }
                break;
            case 'scrypt-n':
            case 'sha1':
            case 'yespowerSUGAR':
            case 'yescryptR8G':
            case 'yespowerLTNCG':
            case 'yescryptR16':
            case 'yespowerR16':
                return function (_d) {
                    return util.reverseBuffer(util.sha256d(_d));
                };
            default:
                return function () {
                    return util.reverseBuffer(hashDigest.apply(this, arguments));
                };
        }
    })();

    const getKotoFoundersReward = function (rpcData, recipients) {
        if (!options.coin.kotoFoundersReward) {
            return recipients;
        }

        const founders = [];
        for (let i = 0; i < options.coin.kotoFoundersReward.length; i++) {
            const founder = options.coin.kotoFoundersReward[i];
            if (rpcData.height >= founder.start && rpcData.height <= founder.last) {
                try {
                    founders.push({
                        percent: 0,
                        value: rpcData.coinbasetxn.foundersreward,
                        script: util.getKotoFounderRewardScript(founder.address),
                    });
                } catch {
                    emitErrorLog(
                        `Error generating transaction output script for ${founder.address} in rewardRecipients`
                    );
                }
            }
        }

        return founders.concat(recipients);
    };

    this.updateCurrentJob = function (rpcData) {
        const tmpBlockTemplate = new blockTemplate(
            jobCounter.next(),
            rpcData,
            options.poolAddressScript,
            _this.extraNoncePlaceholder,
            options.coin.reward,
            options.coin.txMessages,
            getKotoFoundersReward(rpcData, options.recipients),
            options.network
        );

        _this.currentJob = tmpBlockTemplate;
        _this.emit('updatedBlock', tmpBlockTemplate, true);
        _this.validJobs[tmpBlockTemplate.jobId] = tmpBlockTemplate;
    };

    // returns true if processed a new block
    this.processTemplate = function (rpcData) {
        /* Block is new if A) its the first block we have seen so far or B) the blockhash is different and the
           block height is greater than the one we have */
        let isNewBlock = typeof _this.currentJob === 'undefined';
        if (
            !isNewBlock &&
            _this.currentJob.rpcData.previousblockhash !== rpcData.previousblockhash
        ) {
            isNewBlock = true;

            // If new block is outdated/out-of-sync than return
            if (rpcData.height < _this.currentJob.rpcData.height) return false;
        }

        if (!isNewBlock) return false;

        const tmpBlockTemplate = new blockTemplate(
            jobCounter.next(),
            rpcData,
            options.poolAddressScript,
            _this.extraNoncePlaceholder,
            options.coin.reward,
            options.coin.txMessages,
            getKotoFoundersReward(rpcData, options.recipients),
            options.network
        );

        this.currentJob = tmpBlockTemplate;

        this.validJobs = {};
        _this.emit('newBlock', tmpBlockTemplate);

        this.validJobs[tmpBlockTemplate.jobId] = tmpBlockTemplate;

        return true;
    };

    this.processShare = function (
        jobId,
        previousDifficulty,
        difficulty,
        extraNonce1,
        extraNonce2,
        nTime,
        nonce,
        ipAddress,
        port,
        workerName,
        versionMask,
        isSoloMining
    ) {
        /*// --- Debug: print submitted values ---
        console.log('[DEBUG][processShare] jobId:', jobId);
        console.log('[DEBUG][processShare] extraNonce1:', extraNonce1);
        console.log('[DEBUG][processShare] extraNonce2:', extraNonce2);
        console.log('[DEBUG][processShare] nTime:', nTime);
        console.log('[DEBUG][processShare] nonce:', nonce);
        console.log('[DEBUG][processShare] versionMask:', versionMask);*/

        const shareError = function (error) {
            _this.emit('share', {
                job: jobId,
                ip: ipAddress,
                worker: workerName,
                difficulty,
                isSoloMining,
                error: error[1],
            });
            return { error, result: null };
        };

        const submitTime = (Date.now() / 1000) | 0;

        if (extraNonce2.length / 2 !== _this.extraNonce2Size)
            return shareError([20, 'incorrect size of extranonce2']);

        const job = this.validJobs[jobId];
        if (typeof job === 'undefined' || job.jobId != jobId) {
            return shareError([21, 'job not found']);
        }
        if (nTime.length !== 8) {
            return shareError([20, 'incorrect size of ntime']);
        }
        const nTimeInt = parseInt(nTime, 16);
        if (nTimeInt < job.rpcData.curtime || nTimeInt > submitTime + 7200) {
            return shareError([20, 'ntime out of range']);
        }
        if (nonce.length !== 8) {
            return shareError([20, 'incorrect size of nonce']);
        }
        if (!job.registerSubmit(extraNonce1, extraNonce2, nTime, nonce)) {
            return shareError([22, 'duplicate share']);
        }

        const extraNonce1Buffer = Buffer.from(extraNonce1, 'hex');
        const extraNonce2Buffer = Buffer.from(extraNonce2, 'hex');

        const coinbaseBuffer = job.serializeCoinbase(extraNonce1Buffer, extraNonce2Buffer);
        const coinbaseHash = coinbaseHasher(coinbaseBuffer);

        const merkleRoot = util
            .reverseBuffer(job.merkleTree.withFirst(coinbaseHash))
            .toString('hex');

        /*// --- Debug: print header generation parameters ---
        console.log('[DEBUG][processShare] merkleRoot:', merkleRoot);
        console.log('[DEBUG][processShare] nTime:', nTime);
        console.log('[DEBUG][processShare] nonce:', nonce);
        console.log('[DEBUG][processShare] versionMask:', versionMask);*/

        const headerBuffer = job.serializeHeader(merkleRoot, nTime, nonce, versionMask);
        /*console.log('[DEBUG][processShare] headerBuffer:', headerBuffer.toString('hex'));*/

        // Calculate header hash with nTimeInt parameter for all algorithms including lyra2rev2
        const headerHash = hashDigest(headerBuffer, nTimeInt);

        /*// Debug logging for lyra2rev2
        if (options.coin.algorithm === 'lyra2rev2') {
            console.log(`[DEBUG] lyra2rev2 - headerBuffer: ${headerBuffer.toString('hex')}`);
            console.log(`[DEBUG] lyra2rev2 - nTimeInt: ${nTimeInt}`);
            console.log(`[DEBUG] lyra2rev2 - headerHash: ${headerHash.toString('hex')}`);
            console.log(
                `[DEBUG] lyra2rev2 - reversedHash: ${util.reverseBuffer(headerHash).toString('hex')}`
            );
        }*/

        const headerBigNum = BigInt(`0x${util.reverseBuffer(headerHash).toString('hex')}`);

        // Initialize algorithm properties
        const algorithm = job.algorithm || options.coin.algorithm;
        const algoProps = algos[algorithm];
        if (!algoProps) {
            return shareError([24, `Algorithm properties not found for ${algorithm}`]);
        }
        // Convert multiplier to BigInt
        const multiplier = BigInt(algoProps.multiplier || 1);
        const SCALE = 100000000n;
        const shareDiffBigInt = (diff1 * multiplier * SCALE) / headerBigNum;
        const shareDiff = Number(shareDiffBigInt) / Number(SCALE);

        /*// Debug output for lyra2rev2
        if (options.coin.algorithm === 'lyra2rev2') {
            console.log(`[DEBUG] lyra2rev2 - headerBigNum: ${headerBigNum}`);
            console.log(`[DEBUG] lyra2rev2 - shareDiff: ${shareDiff}`);
        }*/

        let blockHashInvalid;
        let blockHash;
        let blockHex;

        // Adjusted block difficulty for algorithm multiplier
        const blockDiffAdjusted = job.difficulty * Number(multiplier);

        blockHashInvalid = blockHasher(headerBuffer, nTime).toString('hex');

        // Check if share is a block candidate (matched network difficulty)
        if (job.target >= headerBigNum) {
            blockHex = job.serializeBlock(headerBuffer, coinbaseBuffer).toString('hex');
            blockHash = blockHasher(headerBuffer, nTime).toString('hex');
        } else {
            if (options.emitInvalidBlockHashes)
                blockHashInvalid = util.reverseBuffer(util.sha256d(headerBuffer)).toString('hex');

            // Check if share didn't reach the miner's difficulty
            if (shareDiff / difficulty < 0.99) {
                // Check if share matched a previous difficulty from before a vardiff retarget
                if (previousDifficulty && shareDiff >= previousDifficulty) {
                    difficulty = previousDifficulty;
                } else {
                    return shareError([23, `low difficulty share of ${shareDiff}`]);
                }
            }
        }

        _this.emit(
            'share',
            {
                job: jobId,
                ip: ipAddress,
                port,
                worker: workerName,
                height: job.rpcData.height,
                blockReward: job.rpcData.coinbasevalue,
                difficulty,
                shareDiff: shareDiff.toFixed(8),
                blockDiff: blockDiffAdjusted,
                blockDiffActual: job.difficulty,
                blockHash,
                blockHashInvalid,
            },
            blockHex
        );

        return { result: true, error: null, blockHash };
    };
};

JobManager.prototype.__proto__ = events.EventEmitter.prototype;

export default JobManager;
