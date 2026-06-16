import * as util from './util.ts';

const generateOutputTransactions = function (
    poolRecipient: Buffer,
    recipients: any,
    rpcData: any
): Buffer {
    let reward = rpcData.coinbasevalue;
    if (!reward) {
        reward = util.getKotoBlockSubsidy(rpcData.height);
        reward -=
            rpcData.coinbasetxn.fee; /* rpcData.coinbasetxn.fee := <total fee of transaxtions> * -1)
         */
    }

    let rewardToPool = reward;

    const txOutputBuffers: Buffer[] = [];

    /* Dash 0.12.1/0.13 */
    if (rpcData.masternode) {
        if (rpcData.masternode.payee) {
            const payeeReward = rpcData.masternode.amount;
            reward -= payeeReward;
            rewardToPool -= payeeReward;

            const payeeScript = util.addressToScript({
                address: rpcData.masternode.payee,
            });
            txOutputBuffers.push(
                Buffer.concat([
                    util.packInt64LE(payeeReward),
                    util.varIntBuffer(payeeScript.length),
                    payeeScript,
                ])
            );
        } else if (rpcData.masternode.length > 0) {
            for (let i = 0; i < rpcData.masternode.length; i++) {
                const payeeReward = rpcData.masternode[i].amount;
                reward -= payeeReward;
                rewardToPool -= payeeReward;

                let payeeScript: Buffer;

                if (rpcData.masternode[i].script) {
                    payeeScript = Buffer.from(rpcData.masternode[i].script, 'hex');
                } else {
                    payeeScript = util.addressToScript(rpcData.masternode[i].payee);
                }

                txOutputBuffers.push(
                    Buffer.concat([
                        util.packInt64LE(payeeReward),
                        util.varIntBuffer(payeeScript.length),
                        payeeScript,
                    ])
                );
            }
        }
    }

    if (rpcData.superblock && rpcData.superblock.length > 0) {
        for (let i = 0; i < rpcData.superblock.length; i++) {
            const payeeReward = rpcData.superblock[i].amount;
            reward -= payeeReward;
            rewardToPool -= payeeReward;

            let payeeScript: Buffer;

            if (rpcData.superblock[i].script) {
                payeeScript = Buffer.from(rpcData.superblock[i].script, 'hex');
            } else {
                payeeScript = util.addressToScript({
                    address: rpcData.superblock[i].payee,
                });
            }

            txOutputBuffers.push(
                Buffer.concat([
                    util.packInt64LE(payeeReward),
                    util.varIntBuffer(payeeScript.length),
                    payeeScript,
                ])
            );
        }
    }
    /* End Dash 0.12.1/0.13 */

    if (rpcData.payee) {
        let payeeReward;

        if (rpcData.payee_amount) {
            payeeReward = rpcData.payee_amount;
        } else {
            payeeReward = Math.ceil(reward / 5);
        }

        reward -= payeeReward;
        rewardToPool -= payeeReward;

        const payeeScript = util.addressToScript({
            address: rpcData.payee,
        });
        txOutputBuffers.push(
            Buffer.concat([
                util.packInt64LE(payeeReward),
                util.varIntBuffer(payeeScript.length),
                payeeScript,
            ])
        );
    }

    /* Developer fee output (e.g. Yenten 6.x.x and other coins whose
       getblocktemplate returns a `developer` field). The daemon provides the
       output script directly as hex; the fee is part of coinbasevalue, so it
       is taken from the pool's share only (rewardToPool), leaving the pool
       fee calculation base (reward) unchanged. */
    if (rpcData.developer && rpcData.developer.amount > 0) {
        const developerReward = rpcData.developer.amount;
        rewardToPool -= developerReward;

        const developerScript = Buffer.from(rpcData.developer.script, 'hex');
        txOutputBuffers.push(
            Buffer.concat([
                util.packInt64LE(developerReward),
                util.varIntBuffer(developerScript.length),
                developerScript,
            ])
        );
    }

    for (let i = 0; i < recipients.length; i++) {
        let recipientReward;
        if (recipients[i].percent == 0) {
            if (recipients[i].value < rewardToPool) {
                recipientReward = recipients[i].value;
            } else {
                continue;
            }
        } else {
            recipientReward = Math.floor(recipients[i].percent * reward);
        }
        rewardToPool -= recipientReward;

        txOutputBuffers.push(
            Buffer.concat([
                util.packInt64LE(recipientReward),
                util.varIntBuffer(recipients[i].script.length),
                recipients[i].script,
            ])
        );
    }

    txOutputBuffers.unshift(
        Buffer.concat([
            util.packInt64LE(rewardToPool),
            util.varIntBuffer(poolRecipient.length),
            poolRecipient,
        ])
    );

    if (rpcData.default_witness_commitment !== undefined) {
        const witness_commitment = Buffer.from(rpcData.default_witness_commitment, 'hex');
        txOutputBuffers.unshift(
            Buffer.concat([
                util.packInt64LE(0),
                util.varIntBuffer(witness_commitment.length),
                witness_commitment,
            ])
        );
    }

    return Buffer.concat([
        util.varIntBuffer(txOutputBuffers.length),
        Buffer.concat(txOutputBuffers),
    ]);
};

export function CreateGeneration(
    rpcData: any,
    publicKey: any,
    extraNoncePlaceholder: any,
    reward: any,
    txMessages: any,
    recipients: any,
    network?: any
): [Buffer, Buffer] {
    const txInputsCount = 1;
    let txVersion;
    if (rpcData.Modified_Coinbase_txn0 && rpcData.Modified_Coinbase_txn1) {
        txVersion = txMessages === true ? 7 : 9;
    } else {
        txVersion = txMessages === true ? 2 : 1;
    }
    if (rpcData.coinbasetxn && rpcData.coinbasetxn.data) {
        txVersion = parseInt(util.reverseHex(rpcData.coinbasetxn.data.slice(0, 8)), 16); // tx version is first 4byte of coinbasetxn.data
    }
    let txType = 0;
    let txExtraPayload: Buffer | undefined;
    const txLockTime = 0;

    if (rpcData.coinbase_payload && rpcData.coinbase_payload.length > 0) {
        txVersion = 3;
        txType = 5;
        txExtraPayload = Buffer.from(rpcData.coinbase_payload, 'hex');
    }

    if (!(rpcData.coinbasetxn && rpcData.coinbasetxn.data)) {
        txVersion = txVersion + (txType << 16);
    }
    const txInPrevOutHash = '';
    const txInPrevOutIndex = Math.pow(2, 32) - 1;
    const txInSequence = 0;

    //Only required for POS coins
    const txTimestamp = reward === 'POS' ? util.packUInt32LE(rpcData.curtime) : Buffer.from([]);

    //For coins that support/require transaction comments
    const txComment =
        txMessages === true
            ? util.serializeString('https://github.com/zone117x/node-stratum')
            : Buffer.from([]);

    const scriptSigPart1 = Buffer.concat([
        util.serializeNumber(rpcData.height),
        //new Buffer(rpcData.coinbaseaux.flags, 'hex'),
        util.serializeNumber((Date.now() / 1000) | 0),
        Buffer.from([extraNoncePlaceholder.length]),
    ]);

    const scriptSigPart2 = util.serializeString(util.getBlockIdentifier());

    // for Koto transaction v3/v4 format
    const nVersionGroupId =
        (txVersion & 0x7fffffff) == 3
            ? util.packUInt32LE(0x2e7d970)
            : (txVersion & 0x7fffffff) == 4
              ? util.packUInt32LE(0x9023e50a)
              : Buffer.alloc(0);

    const p1 = Buffer.concat([
        util.packUInt32LE(txVersion),
        nVersionGroupId,
        txTimestamp,

        //transaction input
        util.varIntBuffer(txInputsCount),
        util.uint256BufferFromHash(txInPrevOutHash),
        util.packUInt32LE(txInPrevOutIndex),
        util.varIntBuffer(
            scriptSigPart1.length + extraNoncePlaceholder.length + scriptSigPart2.length
        ),
        scriptSigPart1,
    ]);

    /*
    The generation transaction must be split at the extranonce (which located in the transaction input
    scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
    a valid share and/or block.
     */

    const outputTransactions = generateOutputTransactions(publicKey, recipients, rpcData);

    // for Koto transaction v2/v3/v4 format
    const nExpiryHeight = (txVersion & 0x7fffffff) >= 3 ? util.packUInt32LE(0) : Buffer.alloc(0);
    const valueBalance = (txVersion & 0x7fffffff) >= 4 ? util.packInt64LE(0) : Buffer.alloc(0);
    const vShieldedSpend = (txVersion & 0x7fffffff) >= 4 ? Buffer.from([0]) : Buffer.alloc(0);
    const vShieldedOutput = (txVersion & 0x7fffffff) >= 4 ? Buffer.from([0]) : Buffer.alloc(0);
    const nJoinSplit = (txVersion & 0x7fffffff) >= 2 ? Buffer.from([0]) : Buffer.alloc(0);

    let p2;
    if (txExtraPayload !== undefined) {
        p2 = Buffer.concat([
            scriptSigPart2,
            util.packUInt32LE(txInSequence),
            //end transaction input

            //transaction output
            outputTransactions,
            //end transaction ouput

            util.packUInt32LE(txLockTime),
            txComment,
            util.varIntBuffer(txExtraPayload.length),
            txExtraPayload,
        ]);
    } else {
        p2 = Buffer.concat([
            scriptSigPart2,
            util.packUInt32LE(txInSequence),
            //end transaction input

            //transaction output
            outputTransactions,
            //end transaction ouput

            util.packUInt32LE(txLockTime),
            nExpiryHeight,
            valueBalance,
            vShieldedSpend,
            vShieldedOutput,
            nJoinSplit,
            txComment,
        ]);
    }
    return [p1, p2];
}

export default { CreateGeneration };
