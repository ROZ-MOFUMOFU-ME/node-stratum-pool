//Gives us global access to everything we need for each hashing algorithm
import './algoProperties.ts';

import pool from './pool.ts';

export { default as daemon } from './daemon.ts';
export { default as varDiff } from './varDiff.ts';

export function createPool(poolOptions: any, authorizeFn: any) {
    const newPool = new pool(poolOptions, authorizeFn);
    return newPool;
}
