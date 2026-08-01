import multiHashing from 'multi-hashing';
import * as util from './util.ts';

const diff1 = ((global as any).diff1 = BigInt(
    '0x00000000ffff0000000000000000000000000000000000000000000000000000'
));

const algos: any = ((global as any).algos = {
    sha256: {
        //Uncomment diff if you want to use hardcoded truncated diff
        //diff: '00000000ffff0000000000000000000000000000000000000000000000000000',
        hash() {
            return function (this: any) {
                return util.sha256d.apply(this, arguments as any);
            };
        },
    },
    sha256d: {
        //Uncomment diff if you want to use hardcoded truncated diff
        //diff: '00000000ffff0000000000000000000000000000000000000000000000000000',
        hash() {
            return function (this: any) {
                return multiHashing.sha256d.apply(this, arguments as any);
            };
        },
    },
    scrypt: {
        //Uncomment diff if you want to use hardcoded truncated diff
        //diff: '0000ffff00000000000000000000000000000000000000000000000000000000',
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const nValue = coinConfig.nValue || 1024;
            const rValue = coinConfig.rValue || 1;
            return function (data: Buffer) {
                return multiHashing.scrypt(data, nValue, rValue);
            };
        },
    },
    'scrypt-og': {
        //Aiden settings
        //Uncomment diff if you want to use hardcoded truncated diff
        //diff: '0000ffff00000000000000000000000000000000000000000000000000000000',
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const nValue = coinConfig.nValue || 64;
            const rValue = coinConfig.rValue || 1;
            return function (data: Buffer) {
                return multiHashing.scrypt(data, nValue, rValue);
            };
        },
    },
    'scrypt-jane': {
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const nTimestamp = coinConfig.chainStartTime || 1367991200;
            const nMin = coinConfig.nMin || 4;
            const nMax = coinConfig.nMax || 30;
            return function (data: Buffer, nTime: number) {
                return multiHashing.scryptjane(data, nTime, nTimestamp, nMin, nMax);
            };
        },
    },
    'scrypt-n': {
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const timeTable: any = coinConfig.timeTable || {
                2048: 1389306217,
                4096: 1456415081,
                8192: 1506746729,
                16384: 1557078377,
                32768: 1657741673,
                65536: 1859068265,
                131072: 2060394857,
                262144: 1722307603,
                524288: 1769642992,
            };

            const nFactor = (function () {
                const n = Object.keys(timeTable)
                    .sort()
                    .reverse()
                    .filter(function (nKey) {
                        return Date.now() / 1000 > timeTable[nKey];
                    })[0];

                const nInt = parseInt(n);
                return Math.log(nInt) / Math.log(2);
            })();

            return function (data: Buffer) {
                return multiHashing.scryptn(data, nFactor);
            };
        },
    },
    sha1: {
        hash() {
            return function (this: any) {
                return multiHashing.sha1.apply(this, arguments as any);
            };
        },
    },
    x11: {
        hash() {
            return function (this: any) {
                return multiHashing.x11.apply(this, arguments as any);
            };
        },
    },
    x13: {
        hash() {
            return function (this: any) {
                return multiHashing.x13.apply(this, arguments as any);
            };
        },
    },
    x15: {
        hash() {
            return function (this: any) {
                return multiHashing.x15.apply(this, arguments as any);
            };
        },
    },
    x16r: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.x16r.apply(this, arguments as any);
            };
        },
    },
    x16rv2: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.x16rv2.apply(this, arguments as any);
            };
        },
    },
    x17: {
        hash() {
            return function (this: any) {
                return multiHashing.x17.apply(this, arguments as any);
            };
        },
    },
    skydoge: {
        hash() {
            return function (this: any) {
                return multiHashing.skydoge.apply(this, arguments as any);
            };
        },
    },
    x25x: {
        hash() {
            return function (this: any) {
                return multiHashing.x25x.apply(this, arguments as any);
            };
        },
    },
    nist5: {
        hash() {
            return function (this: any) {
                return multiHashing.nist5.apply(this, arguments as any);
            };
        },
    },
    quark: {
        hash() {
            return function (this: any) {
                return multiHashing.quark.apply(this, arguments as any);
            };
        },
    },
    keccak: {
        multiplier: Math.pow(2, 8),
        hash(coinConfig: any) {
            if (coinConfig.normalHashing === true) {
                return function (data: Buffer, nTimeInt: number) {
                    return multiHashing.keccak(
                        multiHashing.keccak(
                            Buffer.concat([data, Buffer.from(nTimeInt.toString(16), 'hex')])
                        )
                    );
                };
            } else {
                return function (this: any) {
                    return multiHashing.keccak.apply(this, arguments as any);
                };
            }
        },
    },
    allium: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.allium.apply(this, arguments as any);
            };
        },
    },
    blake: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.blake.apply(this, arguments as any);
            };
        },
    },
    blake2s: {
        multiplier: Math.pow(2, 0),
        hash() {
            return function (this: any) {
                return multiHashing.blake2s.apply(this, arguments as any);
            };
        },
    },
    skein: {
        hash() {
            return function (this: any) {
                return multiHashing.skein.apply(this, arguments as any);
            };
        },
    },
    groestl: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.groestl.apply(this, arguments as any);
            };
        },
    },
    groestlmyriad: {
        hash() {
            return function (this: any) {
                return multiHashing.groestlmyriad.apply(this, arguments as any);
            };
        },
    },
    fugue: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.fugue.apply(this, arguments as any);
            };
        },
    },
    shavite3: {
        hash() {
            return function (this: any) {
                return multiHashing.shavite3.apply(this, arguments as any);
            };
        },
    },
    hefty1: {
        hash() {
            return function (this: any) {
                return multiHashing.hefty1.apply(this, arguments as any);
            };
        },
    },
    neoscrypt: {
        multiplier: Math.pow(2, 5),
        hash() {
            return function (this: any) {
                return multiHashing.neoscrypt.apply(this, arguments as any);
            };
        },
    },
    minotaur: {
        hash() {
            return function (this: any) {
                return multiHashing.minotaur.apply(this, arguments as any);
            };
        },
    },
    lyra2: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.lyra2re.apply(this, arguments as any);
            };
        },
    },
    lyra2v2: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.lyra2rev2.apply(this, arguments as any);
            };
        },
    },
    lyra2v3: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.lyra2rev3.apply(this, arguments as any);
            };
        },
    },
    lyra2re: {
        multiplier: Math.pow(2, 7),
        hash() {
            return function (this: any) {
                return multiHashing.lyra2re.apply(this, arguments as any);
            };
        },
    },
    lyra2re2: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.lyra2rev2.apply(this, arguments as any);
            };
        },
    },
    lyra2rev2: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (data: Buffer, nTimeInt?: number) {
                // For lyra2rev2, we need to handle nTimeInt parameter correctly
                if (nTimeInt !== undefined) {
                    // Create a buffer with nTimeInt appended to data
                    const nTimeBuffer = Buffer.alloc(4);
                    nTimeBuffer.writeUInt32LE(nTimeInt, 0);
                    const combinedData = Buffer.concat([data, nTimeBuffer]);
                    return multiHashing.lyra2rev2(combinedData);
                } else {
                    // Fallback to original behavior if nTimeInt is not provided
                    return multiHashing.lyra2rev2(data);
                }
            };
        },
    },
    lyra2z: {
        multiplier: Math.pow(2, 8),
        hash() {
            return function (this: any) {
                return multiHashing.lyra2z.apply(this, arguments as any);
            };
        },
    },
    qubit: {
        hash() {
            return function (this: any) {
                return multiHashing.qubit.apply(this, arguments as any);
            };
        },
    },
    odo: {
        hash(coinConfig: any) {
            const odoKey = function (nTime: number) {
                return nTime - (nTime % coinConfig.shapechangeInterval);
            };

            return function (data: Buffer, nTime: number) {
                return multiHashing.odo(data, odoKey(nTime));
            };
        },
    },
    yescryptR8: {
        multiplier: 65536,
        diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        hash() {
            return function (this: any) {
                return multiHashing.yespower_0_5_R8.apply(this, arguments as any);
            };
        },
    },
    yescryptR8G: {
        multiplier: 65536,
        diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        hash() {
            return function (this: any) {
                return multiHashing.yespower_0_5_R8G.apply(this, arguments as any);
            };
        },
    },
    yescryptR16: {
        multiplier: 65536,
        diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        hash() {
            return function (this: any) {
                return multiHashing.yespower_0_5_R16.apply(this, arguments as any);
            };
        },
    },
    yescryptR24: {
        multiplier: 65536,
        diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        hash() {
            return function (this: any) {
                return multiHashing.yespower_0_5_R24.apply(this, arguments as any);
            };
        },
    },
    yescryptR32: {
        multiplier: 65536,
        diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        hash() {
            return function (this: any) {
                return multiHashing.yespower_0_5_R32.apply(this, arguments as any);
            };
        },
    },
    yespower: {
        multiplier: 65536,
        hash() {
            return function (this: any) {
                return multiHashing.yespower.apply(this, arguments as any);
            };
        },
    },
    yespowerSUGAR: {
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const nValue = coinConfig.nValue || 2048;
            const rValue = coinConfig.rValue || 32;
            return function (data: Buffer) {
                return multiHashing.yespower_sugar(data, nValue, rValue);
            };
        },
    },
    yespowerLTNCG: {
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const nValue = coinConfig.nValue || 2048;
            const rValue = coinConfig.rValue || 32;
            return function (data: Buffer) {
                return multiHashing.yespower_ltncg(data, nValue, rValue);
            };
        },
    },
    yespowerR16: {
        multiplier: 65536,
        hash() {
            return function (this: any) {
                return multiHashing.yespower_r16.apply(this, arguments as any);
            };
        },
    },
    yespowerURX: {
        multiplier: Math.pow(2, 16),
        hash(coinConfig: any) {
            const nValue = coinConfig.nValue || 2048;
            const rValue = coinConfig.rValue || 32;
            return function (data: Buffer) {
                return multiHashing.yespower_urx(data, nValue, rValue);
            };
        },
    },
    vipstar: {
        hash() {
            return function (this: any, data: Buffer) {
                // VIPSTARCOIN's daemon validates PoW as standard sha256d
                // over the FULL qtum-style serialized block header — the
                // 80-byte bitcoin part PLUS hashstateroot + hashutxoroot +
                // prevoutStake + the (empty) vchBlockSig length byte (181
                // bytes total). Verified against block.GetHash() of an
                // actual daemon-produced PoW block: sha256d(headerBuffer)
                // matches the stored block hash exactly. The earlier
                // multiHashing.vipstar binding (cpuminer's sha256d_181_swap)
                // expects pre-byte-swapped cpuminer-style pdata, not the
                // canonical wire bytes serializeHeader produces, which is
                // what made every share read as shareDiff=0 before.
                return util.sha256d(data);
            };
        },
    },
});

for (const algo in algos) {
    if (!algos[algo].multiplier) algos[algo].multiplier = 1;
}

export { diff1 };
export default algos;
