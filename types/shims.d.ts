/*
 * Ambient module declarations for runtime dependencies that ship no TypeScript
 * types and have no @types package. A bare declaration types the import as
 * `any`, which is acceptable here.
 */
declare module '@exodus/bitcoinjs-lib-zcash';
// multi-hashing is an intentionally JS-only NAN native addon (no .d.ts, no
// @types). Locally it resolves via an npm-linked clone; CI installs the plain
// GitHub copy, where tsc would otherwise fail with TS7016 on algoProperties.ts.
declare module 'multi-hashing';
