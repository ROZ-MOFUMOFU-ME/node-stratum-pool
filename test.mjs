import * as stratumPool from './lib/index.js';

console.log('Successfully imported stratum-pool module');

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
