//Gives us global access to everything we need for each hashing algorithm
import './algoProperties.js';

import pool from './pool.js';

export { default as daemon } from './daemon.js';
export { default as varDiff } from './varDiff.js';

export function createPool(poolOptions, authorizeFn) {
    const newPool = new pool(poolOptions, authorizeFn);
    return newPool;
}
