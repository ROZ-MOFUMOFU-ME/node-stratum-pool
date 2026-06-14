import assert from 'node:assert';
import * as stratumPool from './lib/index.js';
import BlockTemplate from './lib/blockTemplate.js';
import * as util from './lib/util.js';

console.log('Successfully imported stratum-pool module');

// Regression: block merkle leaves must use the right per-chain tx hash.
// Zcash/Sapling chains (e.g. Koto) commit sha256d(full tx serialization)
// (getblocktemplate `hash`) to the merkle root, which differs from `txid` for
// shielded txs; Bitcoin/segwit chains commit `txid`. Picking the wrong field
// makes the daemon reject blocks with "hashMerkleRoot mismatch".
try {
    const poolScript = Buffer.alloc(25, 0x11); // dummy P2PKH-sized script
    const extraNoncePlaceholder = Buffer.from('f000000ff111111f', 'hex');
    const data = Buffer.from('abcdef0123456789', 'hex'); // arbitrary tx body
    const fullHashLE = util.sha256d(data); // = the daemon's GetHash() (internal/LE)
    const fullHashBE = util.reverseBuffer(fullHashLE).toString('hex'); // gbt `hash`
    const txid = 'aa'.repeat(32); // intentionally != fullHash (shielded-style)

    const baseRpc = {
        bits: '1e0fffff',
        previousblockhash: '00'.repeat(32),
        height: 100,
        coinbasevalue: 5000000000,
        transactions: [{ data: data.toString('hex'), hash: fullHashBE, txid }],
    };

    const sapling = new BlockTemplate(
        '1',
        { ...baseRpc, version: 5, finalsaplingroothash: '22'.repeat(32) },
        poolScript,
        extraNoncePlaceholder,
        undefined,
        undefined,
        [],
        undefined
    );
    assert.strictEqual(
        sapling.merkleBranch[0],
        fullHashLE.toString('hex'),
        'Sapling template must build merkle leaves from sha256d(full tx data), not txid'
    );

    const bitcoinish = new BlockTemplate(
        '1',
        baseRpc, // no finalsaplingroothash
        poolScript,
        extraNoncePlaceholder,
        undefined,
        undefined,
        [],
        undefined
    );
    assert.strictEqual(
        bitcoinish.merkleBranch[0],
        util.reverseBuffer(Buffer.from(txid, 'hex')).toString('hex'),
        'Non-Sapling template must keep building merkle leaves from txid'
    );
    console.log('merkle leaf selection (Sapling=hash, Bitcoin=txid) verified');
} catch (e) {
    console.error('Merkle leaf regression test failed:', e.message);
    process.exit(1);
}

// Test createPool call (dummy configuration)
try {
    const dummyOptions = {
        coin: { algorithm: 'sha256' },
        daemons: [],
        ports: {},
        rewardRecipients: {},
        initStats: { difficulty: 1, connections: 0, networkHashRate: 0, stratumPorts: [] },
    };
    const pool = stratumPool.createPool(dummyOptions, () => ({ authorized: true }));
    console.log('createPool call successful:', typeof pool);
} catch (e) {
    console.error('Error in createPool call:', e.message);
    process.exit(1);
}

console.log('All tests completed successfully');
process.exit(0);
