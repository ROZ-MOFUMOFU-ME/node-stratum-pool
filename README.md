# node-stratum-pool

High performance Stratum poolserver in Node.js. One instance of this software can startup and manage multiple coin
pools, each with their own daemon and stratum port :)

**Roadmap:** see [ROADMAP.md](ROADMAP.md) for current status, known issues, and planned improvements.

[![CI](https://img.shields.io/github/actions/workflow/status/ROZ-MOFUMOFU-ME/node-stratum-pool/node.js.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI)](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool/actions/workflows/node.js.yml)&nbsp;[![Lint](https://img.shields.io/github/actions/workflow/status/ROZ-MOFUMOFU-ME/node-stratum-pool/lint-format.yml?branch=main&style=flat-square&logo=prettier&logoColor=white&label=lint)](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool/actions/workflows/lint-format.yml)&nbsp;[![CircleCI](https://img.shields.io/circleci/build/github/ROZ-MOFUMOFU-ME/node-stratum-pool/main?style=flat-square&logo=circleci&label=CircleCI)](https://circleci.com/gh/ROZ-MOFUMOFU-ME/node-stratum-pool/tree/main)&nbsp;[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://www.javascript.com/)&nbsp;[![Node.js](https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)&nbsp;[![Bitcoin](https://img.shields.io/badge/Bitcoin-F7931A?style=flat-square&logo=bitcoin&logoColor=white)](https://bitcoin.org/)&nbsp;[![License](https://img.shields.io/badge/license-GPLv2-blue?style=flat-square)](https://opensource.org/licenses/GPL-2.0)&nbsp;[![Discord](https://img.shields.io/badge/Discord-join-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/zHUdQy2NzU)

### Community

ZNY-NOMP official Discord Server

- Join [https://discord.gg/zHUdQy2NzU](https://discord.gg/zHUdQy2NzU)

#### Notice

This is a module for Node.js that will do nothing on its own. Unless you're a Node.js developer who would like to
handle stratum authentication and raw share data then this module will not be of use to you. For a full featured portal
that uses this module, see [NOMP (Node Open Mining Portal)](https://github.com/zone117x/node-open-mining-portal). It
handles payments, website front-end, database layer, mutli-coin/pool support, auto-switching miners between coins/pools,
etc.. The portal also has an [MPOS](https://github.com/MPOS/php-mpos) compatibility mode so that the it can function as
a drop-in-replacement for [python-stratum-mining](https://github.com/Crypto-Expert/stratum-mining).

#### Why

This server was built to be more efficient and easier to setup, maintain and scale than existing stratum poolservers
which are written in python. Compared to the spaghetti state of the latest
[stratum-mining python server](https://github.com/Crypto-Expert/stratum-mining/), this software should also have a
lower barrier to entry for other developers to fork and add features or fix bugs.

## Features

- Daemon RPC interface
- Stratum TCP socket server
- Block template / job manager
- P2P to get block notifications as peer node
- Optimized generation transaction building
- Connecting to multiple daemons for redundancy
- Process share submissions
- Session managing for purging DDoS/flood initiated zombie workers
- Auto ban IPs that are flooding with invalid shares
- **POW** (proof-of-work) & **POS** (proof-of-stake) support
- Transaction messages support
- Vardiff (variable difficulty / share limiter)
- When started with a coin deamon that hasn't finished syncing to the network it shows the blockchain download progress and initializes once synced

#### Hashing algorithms supported:

- ✓ **SHA256** (Bitcoin, Freicoin, Peercoin/PPCoin, Terracoin, Susucoin [SUSU], etc..)
- ✓ **Scrypt** (Litecoin, Dogecoin, Feathercoin, etc..)
- ✓ **Scrypt-Jane** (YaCoin, CopperBars, Pennies, Tickets, etc..)
- ✓ **Scrypt-N** (Vertcoin [VTC])
- ✓ **Quark** (Quarkcoin [QRK])
- ✓ **X11** (Darkcoin [DRK], Hirocoin, Limecoin)
- ✓ **X13** (MaruCoin, BoostCoin)
- ✓ **NIST5** (Talkcoin)
- ✓ **Keccak** (Maxcoin [MAX], HelixCoin, CryptoMeth, Galleon, 365coin, Slothcoin, BitcointalkCoin)
- ✓ **Skein** (Skeincoin [SKC])
- ✓ **Groestl** (Groestlcoin [GRS])
- ✓ **Yescrypt-0.5** (BitZeny [ZNY])
- ✓ **Yescrypt** (Koto [KOTO], Elicoin,[ELI], etc..)
- ✓ **YesPoWer** (Cryply [CRP], Bellcoin [BELL], etc..)
- ✓ **YesPoWerSUGAR** (Sugarchain [SUGAR])
- ✓ **YescryptR8G** (Koto [KOTO])
- ✓ **LyraREv2** (Monacoin [MONA], Mangacoin [MANGA], etc..)
- ✓ **vipstar** (VIPSTARCOIN [VIPS] — sha256d over a qtum-style 181-byte header)

May be working (needs additional testing):

- ? _Blake_ (Blakecoin [BLC])
- ? _Fugue_ (Fuguecoin [FC])
- ? _Qubit_ (Qubitcoin [Q2C], Myriadcoin [MYR])
- ? _SHAvite-3_ (INKcoin [INK])

Not working currently:

- _Groestl_ - for Myriadcoin
- _Keccak_ - for eCoin & Copperlark
- _Hefty1_ (Heavycoin [HVC])

## Requirements

- Node.js v20+ (tested on Node 20, 22 and 24; v20.17+/22+ is required because the bitcoinjs-lib dependency chain loads an ESM-only module via `require(esm)`)
- coin daemon (preferably one with a relatively updated API and not some crapcoin :p)
- a C/C++ toolchain with C++20 support (gcc 10+), required to build the [multi-hashing](https://github.com/ROZ-MOFUMOFU-ME/node-multi-hashing) native addon

## Example Usage

#### Install as a node module

```bash
npm install git+https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool.git#main
```

Development happens on the `main` branch, together with the sibling repositories [node-multi-hashing](https://github.com/ROZ-MOFUMOFU-ME/node-multi-hashing) (hashing addon) and [zny-nomp](https://github.com/ROZ-MOFUMOFU-ME/zny-nomp) (mining portal). This `main` branch is protected, so changes land via pull request.

#### Module usage

Create the configuration for your coin:

Possible options for `algorithm`: _sha256, scrypt, scrypt-jane, scrypt-n, quark, x11, keccak, blake,
skein, groestl, fugue, shavite3, hefty1, or qubit_.

```javascript
var myCoin = {
    "name": "Dogecoin",
    "symbol": "DOGE",
    "algorithm": "scrypt",
    "nValue": 1024, //optional - defaults to 1024
    "rValue": 1, //optional - defaults to 1
    "txMessages": false, //optional - defaults to false,

    /* Magic value only required for setting up p2p block notifications. It is found in the daemon
       source code as the pchMessageStart variable.
       For example, litecoin mainnet magic: http://git.io/Bi8YFw
       And for litecoin testnet magic: http://git.io/NXBYJA */
     "peerMagic": "fbc0b6db" //optional
     "peerMagicTestnet": "fcc1b7dc" //optional
};
```

If you are using the `scrypt-jane` algorithm there are additional configurations:

```javascript
var myCoin = {
    name: 'Freecoin',
    symbol: 'FEC',
    algorithm: 'scrypt-jane',
    chainStartTime: 1375801200, //defaults to 1367991200 (YACoin) if not used
    nMin: 6, //defaults to 4 if not used
    nMax: 32, //defaults to 30 if not used
};
```

If you are using the `scrypt-n` algorithm there is an additional configuration:

```javascript
var myCoin = {
    name: 'Execoin',
    symbol: 'EXE',
    algorithm: 'scrypt-n',
    /* This defaults to Vertcoin's timetable if not used. It is required for scrypt-n coins that
       have modified their N-factor timetable to be different than Vertcoin's. */
    timeTable: {
        2048: 1390959880,
        4096: 1438295269,
        8192: 1485630658,
        16384: 1532966047,
        32768: 1580301436,
        65536: 1627636825,
        131072: 1674972214,
        262144: 1722307603,
    },
};
```

If you are using the `keccak` algorithm there are additional configurations _(The rare `normalHashing` keccak coins
such as Copperlark and eCoin don't appear to work yet - only the popular ones like Maxcoin are)_:

```javascript
var myCoin = {
    name: 'eCoin',
    symbol: 'ECN',
    algorithm: 'keccak',

    /* This is not required and set to false by default. Some coins such as Copperlark and eCoin
       require it to be set to true. Maxcoin and most others are false. */
    normalHashing: true,
};
```

Create and start new pool with configuration options and authentication function

```javascript
var Stratum = require('stratum-pool');

var pool = Stratum.createPool(
    {
        coin: myCoin,

        address: 'mi4iBXbBsydtcc5yFmsff2zCFVX4XG7qJc', //Address to where block rewards are given

        /* Block rewards go to the configured pool wallet address to later be paid out to miners,
       except for a percentage that can go to, for examples, pool operator(s) as pool fees or
       or to donations address. Addresses or hashed public keys can be used. Here is an example
       of rewards going to the main pool op, a pool co-owner, and NOMP donation. */
        rewardRecipients: {
            n37vuNFkXfk15uFnGoVyHZ6PYQxppD3QqK: 1.5, //1.5% goes to pool op
            mirj3LtZxbSTharhtXvotqtJXUY7ki5qfx: 0.5, //0.5% goes to a pool co-owner

            /* 0.1% donation to NOMP. This pubkey can accept any type of coin, please leave this in
           your config to help support NOMP development. */
            '22851477d63a085dbc2398c8430af1c09e7343f6': 0.1,
        },

        blockRefreshInterval: 1000, //How often to poll RPC daemons for new blocks, in milliseconds

        /* Some miner apps will consider the pool dead/offline if it doesn't receive anything new jobs
       for around a minute, so every time we broadcast jobs, set a timeout to rebroadcast
       in this many seconds unless we find a new job. Set to zero or remove to disable this. */
        jobRebroadcastTimeout: 55,

        //instanceId: 37, //Recommend not using this because a crypto-random one will be generated

        /* Some attackers will create thousands of workers that use up all available socket connections,
       usually the workers are zombies and don't submit shares after connecting. This features
       detects those and disconnects them. */
        connectionTimeout: 600, //Remove workers that haven't been in contact for this many seconds

        /* Sometimes you want the block hashes even for shares that aren't block candidates. */
        emitInvalidBlockHashes: false,

        /* Enable for client IP addresses to be detected when using a load balancer with TCP proxy
       protocol enabled, such as HAProxy with 'send-proxy' param:
       http://haproxy.1wt.eu/download/1.5/doc/configuration.txt */
        tcpProxyProtocol: false,

        /* If a worker is submitting a high threshold of invalid shares we can temporarily ban their IP
       to reduce system/network load. Also useful to fight against flooding attacks. If running
       behind something like HAProxy be sure to enable 'tcpProxyProtocol', otherwise you'll end up
       banning your own IP address (and therefore all workers). */
        banning: {
            enabled: true,
            time: 600, //How many seconds to ban worker for
            invalidPercent: 50, //What percent of invalid shares triggers ban
            checkThreshold: 500, //Check invalid percent when this many shares have been submitted
            purgeInterval: 300, //Every this many seconds clear out the list of old bans
        },

        /* Each pool can have as many ports for your miners to connect to as you wish. Each port can
       be configured to use its own pool difficulty and variable difficulty settings. varDiff is
       optional and will only be used for the ports you configure it for. */
        ports: {
            3032: {
                //A port for your miners to connect to
                diff: 32, //the pool difficulty for this port

                /* Variable difficulty is a feature that will automatically adjust difficulty for
               individual miners based on their hashrate in order to lower networking overhead */
                varDiff: {
                    minDiff: 8, //Minimum difficulty
                    maxDiff: 512, //Network difficulty will be used if it is lower than this
                    targetTime: 15, //Try to get 1 share per this many seconds
                    retargetTime: 90, //Check to see if we should retarget every this many seconds
                    variancePercent: 30, //Allow time to very this % from target without retargeting
                },
            },
            3256: {
                //Another port for your miners to connect to, this port does not use varDiff
                diff: 256, //The pool difficulty
            },
        },

        /* Recommended to have at least two daemon instances running in case one drops out-of-sync
       or offline. For redundancy, all instances will be polled for block/transaction updates
       and be used for submitting blocks. Creating a backup daemon involves spawning a daemon
       using the "-datadir=/backup" argument which creates a new daemon instance with it's own
       RPC config. For more info on this see:
          - https://en.bitcoin.it/wiki/Data_directory
          - https://en.bitcoin.it/wiki/Running_bitcoind */
        daemons: [
            {
                //Main daemon instance
                host: '127.0.0.1',
                port: 19332,
                user: 'litecoinrpc',
                password: 'testnet',
            },
            {
                //Backup daemon instance
                host: '127.0.0.1',
                port: 19344,
                user: 'litecoinrpc',
                password: 'testnet',
            },
        ],

        /* This allows the pool to connect to the daemon as a node peer to receive block updates.
       It may be the most efficient way to get block updates (faster than polling, less
       intensive than blocknotify script). It requires the additional field "peerMagic" in
       the coin config. */
        p2p: {
            enabled: false,

            /* Host for daemon */
            host: '127.0.0.1',

            /* Port configured for daemon (this is the actual peer port not RPC port) */
            port: 19333,

            /* If your coin daemon is new enough (i.e. not a shitcoin) then it will support a p2p
           feature that prevents the daemon from spamming our peer node with unnecessary
           transaction data. Assume its supported but if you have problems try disabling it. */
            disableTransactions: true,
        },
    },
    function (ip, port, workerName, password, callback) {
        //stratum authorization function
        console.log('Authorize ' + workerName + ':' + password + '@' + ip);
        callback({
            error: null,
            authorized: true,
            disconnect: false,
        });
    }
);
```

Listen to pool events

```javascript
/*

'data' object contains:
    job: 4, //stratum work job ID
    ip: '71.33.19.37', //ip address of client
    port: 3333, //port of the client
    worker: 'matt.worker1', //stratum worker name
    height: 443795, //block height
    blockReward: 5000000000, //the number of satoshis received as payment for solving this block
    difficulty: 64, //stratum worker difficulty
    shareDiff: 78, //actual difficulty of the share
    blockDiff: 3349, //block difficulty adjusted for share padding
    blockDiffActual: 3349 //actual difficulty for this block


    //AKA the block solution - set if block was found
    blockHash: '110c0447171ad819dd181216d5d80f41e9218e25d833a2789cb8ba289a52eee4',

    //Exists if "emitInvalidBlockHashes" is set to true
    blockHashInvalid: '110c0447171ad819dd181216d5d80f41e9218e25d833a2789cb8ba289a52eee4'

    //txHash is the coinbase transaction hash from the block
    txHash: '41bb22d6cc409f9c0bae2c39cecd2b3e3e1be213754f23d12c5d6d2003d59b1d,

    error: 'low share difficulty' //set if share is rejected for some reason
*/
pool.on('share', function (isValidShare, isValidBlock, data) {
    if (isValidBlock) console.log('Block found');
    else if (isValidShare) console.log('Valid share submitted');
    else if (data.blockHash)
        console.log('We thought a block was found but it was rejected by the daemon');
    else console.log('Invalid share submitted');

    console.log('share data: ' + JSON.stringify(data));
});

/*
'severity': can be 'debug', 'warning', 'error'
'logKey':   can be 'system' or 'client' indicating if the error
            was caused by our system or a stratum client
*/
pool.on('log', function (severity, logKey, logText) {
    console.log(severity + ': ' + '[' + logKey + '] ' + logText);
});
```

Start pool

```javascript
pool.start();
```

## Donations

Donations for development are greatly appreciated!

- ZNY: ZmnBu9jPKvVFL22PcwMHSEuVpTxFeCdvNv
- NUKO: 0xa79bde46faab3c40632604728e9f2165b052581c
- KOTO: k1FTuimwDJ8oo3x23cEBLxovxw5Cqq2U1HK
- SUSU: SeXbMBaax7NgnTEFEMxin5ycXy9r9CDBot
- MONA: MLEqE3vi11j4ZguMjkvMn5rUtze6kXbAzQ
- BELL: BCVicYRSqKKt1ynJKPrXHA46hUWLrbjR49
- SUGAR: sugar1qtwqle9lrr753kxuzqqsh3hv28jl07e3mntx78n
- VIPS: VFixsia2EstV4uEEigUXUrknDGsFeWyNhE
- KUMA: KHjjZ5misqq45zwhj86WKqV8bzqcYExzyM
- BTC: 3FpbJ5cotwPZQn9fcdZrPv4h72XquzEvez
- ETH: 0xc664a0416c23b1b13a18e86cb5fdd1007be375ae
- LTC: Lh96WZ7Rw9Wf4GDX2KXpzieneZFV5Xe5ou
- BCH: pzdsppue8uwc20x35psaqq8sgchkenr49c0qxzazxu
- ETC: 0xc664a0416c23b1b13a18e86cb5fdd1007be375ae

## Credits

### node-stratum-pool

- [ROZ](https://github.com/ROZ-MOFUMOFU-ME)
- [zinntikumugai](https://github.com/zinntikumugai) - great supporter

### NOMP / node-stratum-pool

- [vekexasia](//github.com/vekexasia) - co-developer & great tester
- [LucasJones](//github.com/LucasJones) - got p2p block notify working and implemented additional hashing algos
- [TheSeven](//github.com/TheSeven) - answering an absurd amount of my questions, found the block 1-16 problem, provided example code for peer node functionality
- [pronooob](https://dogehouse.org) - knowledgeable & helpful
- [Slush0](//github.com/slush0/stratum-mining) - stratum protocol, documentation and original python code
- [viperaus](//github.com/viperaus/stratum-mining) - scrypt adaptions to python code
- [ahmedbodi](//github.com/ahmedbodi/stratum-mining) - more algo adaptions to python code
- [steveshit](//github.com/steveshit) - ported X11 hashing algo from python to node module

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. 🔀 Fork this repository
2. 🌿 Create a new branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add some amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🔃 Open a Pull Request

### 📋 Contributing Guidelines

- Follow the ESLint configuration for code style
- Use Prettier to format your code before committing
- Write clear and descriptive commit messages

#### Code Formatting

Before submitting a pull request, please ensure your code is properly formatted:

```bash
# Format all files
npm run format

# Check code quality with ESLint
npm run lint
```

---

## 📄 License

This project is licensed under the GNU General Public License v2.0. See the [LICENSE](LICENSE) file for details.

---

## 👥 Team

<div align="center">

[![Contributors](https://contrib.rocks/image?repo=ROZ-MOFUMOFU-ME/node-stratum-pool)](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool/graphs/contributors)

</div>

---

## 📞 Support

- 🐛 **Bug Reports**: [Issues](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool/issues)
- 💡 **Feature Requests**: [Discussions](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool/discussions)
- 💬 **Community**: [Discord](https://discord.gg/zHUdQy2NzU)

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ROZ-MOFUMOFU-ME/node-stratum-pool&type=Date&theme=dark)](https://star-history.com/#ROZ-MOFUMOFU-ME/node-stratum-pool&Date)

---

## 📊 Statistics

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=ROZ-MOFUMOFU-ME&repo=node-stratum-pool&show_icons=true&theme=dark)

---

<div align="center">

**⭐ If you like this project, please give it a star! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/ROZ-MOFUMOFU-ME/node-stratum-pool.svg?style=social&label=Star)](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool)
[![GitHub forks](https://img.shields.io/github/forks/ROZ-MOFUMOFU-ME/node-stratum-pool.svg?style=social&label=Fork)](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool/fork)
[![GitHub watchers](https://img.shields.io/github/watchers/ROZ-MOFUMOFU-ME/node-stratum-pool.svg?style=social&label=Watch)](https://github.com/ROZ-MOFUMOFU-ME/node-stratum-pool)

Made with ❤️ by [ROZ](https://github.com/ROZ-MOFUMOFU-ME)

</div>
