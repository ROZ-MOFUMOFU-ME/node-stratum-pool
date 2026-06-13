# Roadmap

This library is the middle of a three-repo stack: it is consumed by
[zny-nomp](https://github.com/ROZ-MOFUMOFU-ME/zny-nomp) (the portal) and
depends on [node-multi-hashing](https://github.com/ROZ-MOFUMOFU-ME/node-multi-hashing)
(the hashing addon). Each repo has its own `ROADMAP.md`.

## Current state

- ESM library, Node 20–24, linted with ESLint 9 + Prettier.
- bitcoinjs-lib 7 for address/script handling.
- **Verified algorithms** (mining → submitblock accepted): yescrypt family,
  yespower family (incl. yespowerSUGAR), yescryptR8G, lyra2rev2 (Monacoin),
  vipstar (VIPSTARCOIN, 181-byte qtum-style header), sha256d, quark, x11.
- Developer-fee coinbase output (Yenten 6.1) and the extended `mining.notify`
  params for VIPSTARCOIN (reversed stateroot/utxoroot) are implemented.

## Known issues & limitations

- **Minimal test** — `test.mjs` only imports the module and calls
  `createPool()`; there is no per-algorithm or protocol-level coverage.
- Several algorithms in the README are marked "may work" / "not working" and
  are unverified against live daemons.
- Coin-specific paths (Koto founders reward, Dash masternode/superblock
  payees, POS reward type) have no regression coverage.
- `algoProperties.js` block-hash handling has repetitive per-algorithm
  branches that are easy to get subtly wrong (the vipstar/lyra2rev2 fixes
  were both block-hash issues).

## Roadmap

### Near-term
- Unit tests for `jobManager.processShare` and `blockTemplate` block/header
  serialization, using captured real block headers per algorithm.
- Verify the "may work" algorithms against regtest/live daemons and update
  the README support table.

### Mid-term
- A mock-daemon integration test covering the full
  getblocktemplate → share → submitblock flow.
- Document the extended mining.notify protocol (vipstar stateroot/utxoroot,
  qtum-style 181-byte header) for miner authors.
- **Security hardening** — review and tune the stratum server's DoS
  protections (IP banning, connection timeouts, invalid-share thresholds)
  and document the TLS-port configuration; this feeds the portal's
  security-hardening focus area.

### Long-term
- Refactor `algoProperties` so the block-hash function and difficulty
  multiplier are declared per algorithm in one place, reducing the
  duplicated `switch` branches in `jobManager`.
- **Ethash-family support** — register `kawpow`/`ethash` (the addon already
  vendors the library) in `algoProperties`, and handle the Ethash job model:
  epoch / DAG / seedhash and the distinct `mining.notify` / `mining.submit`
  shape, which differs substantially from the current Bitcoin-style header
  flow. This is a large change, hence long-term.
- **Monorepo consolidation** — this library is intended to eventually merge
  with zny-nomp and node-multi-hashing into a single monorepo (see the
  [zny-nomp ROADMAP](https://github.com/ROZ-MOFUMOFU-ME/zny-nomp/blob/main/ROADMAP.md)),
  removing the git-dependency pinning and `npm link` chain.
