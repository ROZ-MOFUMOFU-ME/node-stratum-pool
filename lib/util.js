import crypto from 'crypto';
import base58 from 'bs58check';
import bitcoin from 'bitcoinjs-lib';
import zcash from '@exodus/bitcoinjs-lib-zcash';

export function addressFromEx(exAddress, ripdm160Key) {
    try {
        const versionByte = getVersionByte(exAddress);
        const addrBase = Buffer.concat([versionByte, Buffer.from(ripdm160Key, 'hex')]);
        const checksum = sha256d(addrBase).slice(0, 4);
        const address = Buffer.concat([addrBase, checksum]);
        return base58.encode(address);
    } catch (e) {
        return null;
    }
}

export function getVersionByte(addr) {
    const versionByte = base58.decode(addr).slice(0, 1);
    return versionByte;
}

export function sha256(buffer) {
    const hash1 = crypto.createHash('sha256');
    hash1.update(buffer);
    return hash1.digest();
}

export function sha256d(buffer) {
    return sha256(sha256(buffer));
}

export function reverseBuffer(buffer) {
    return Buffer.from(buffer).reverse();
}

export function reverseHex(hex) {
    return reverseBuffer(Buffer.from(hex, 'hex')).toString('hex');
}

export function reverseByteOrder(buff) {
    for (let i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4);
    return reverseBuffer(buff);
}

export function uint256BufferFromHash(hex) {
    let fromHex = Buffer.from(hex, 'hex');
    if (fromHex.length != 32) {
        const empty = Buffer.alloc(32);
        empty.fill(0);
        fromHex.copy(empty);
        fromHex = empty;
    }
    return reverseBuffer(fromHex);
}

export function hexFromReversedBuffer(buffer) {
    return reverseBuffer(buffer).toString('hex');
}

export function varIntBuffer(n) {
    if (n < 0xfd) return Buffer.from([n]);
    else if (n <= 0xffff) {
        const buff = Buffer.alloc(3);
        buff[0] = 0xfd;
        buff.writeUInt16LE(n, 1);
        return buff;
    } else if (n <= 0xffffffff) {
        const buff = Buffer.alloc(5);
        buff[0] = 0xfe;
        buff.writeUInt32LE(n, 1);
        return buff;
    } else {
        const buff = Buffer.alloc(9);
        buff[0] = 0xff;
        packUInt16LE(n).copy(buff, 1);
        return buff;
    }
}

export function varStringBuffer(string) {
    const strBuff = Buffer.from(string);
    return Buffer.concat([varIntBuffer(strBuff.length), strBuff]);
}

export function serializeNumber(n) {
    if (n >= 1 && n <= 16) return Buffer.from([0x50 + n]);
    let l = 1;
    const buff = Buffer.alloc(9);
    while (n > 0x7f) {
        buff.writeUInt8(n & 0xff, l++);
        n >>= 8;
    }
    buff.writeUInt8(l, 0);
    buff.writeUInt8(n, l++);
    return buff.slice(0, l);
}

export function serializeString(s) {
    if (s.length < 253) return Buffer.concat([Buffer.from([s.length]), Buffer.from(s)]);
    else if (s.length < 0x10000)
        return Buffer.concat([Buffer.from([253]), packUInt16LE(s.length), Buffer.from(s)]);
    else if (s.length < 0x100000000)
        return Buffer.concat([Buffer.from([254]), packUInt32LE(s.length), Buffer.from(s)]);
    else return Buffer.concat([Buffer.from([255]), packUInt16LE(s.length), Buffer.from(s)]);
}

export function packUInt16LE(num) {
    const buff = Buffer.alloc(2);
    buff.writeUInt16LE(num, 0);
    return buff;
}

export function packInt32LE(num) {
    const buff = Buffer.alloc(4);
    buff.writeInt32LE(num, 0);
    return buff;
}

export function packInt32BE(num) {
    const buff = Buffer.alloc(4);
    buff.writeInt32BE(num, 0);
    return buff;
}

export function packUInt32LE(num) {
    const buff = Buffer.alloc(4);
    buff.writeUInt32LE(num, 0);
    return buff;
}

export function packUInt32BE(num) {
    if (typeof num === 'bigint') {
        num = Number(num);
    }
    if (typeof num !== 'number' || num > 0xffffffff || num < 0) {
        throw new TypeError(
            'The value of "num" is out of range. It must be a number between 0 and 4,294,967,295 or a safe bigint.'
        );
    }
    const buff = Buffer.alloc(4);
    buff.writeUInt32BE(num, 0);
    return buff;
}

export function packInt64LE(num) {
    const buff = Buffer.alloc(8);
    buff.writeUInt32LE(num % Math.pow(2, 32), 0);
    buff.writeUInt32LE(Math.floor(num / Math.pow(2, 32)), 4);
    return buff;
}

export function range(start, stop, step) {
    if (typeof stop === 'undefined') {
        stop = start;
        start = 0;
    }
    if (typeof step === 'undefined') {
        step = 1;
    }
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }
    const result = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }
    return result;
}

export function pubkeyToScript(key) {
    if (key.length !== 66) {
        console.error(`Invalid pubkey: ${key}`);
        throw new Error();
    }
    const pubkey = Buffer.alloc(35);
    pubkey[0] = 0x21;
    pubkey[34] = 0xac;
    Buffer.from(key, 'hex').copy(pubkey, 1);
    return pubkey;
}

export function miningKeyToScript(key) {
    const keyBuffer = Buffer.from(key, 'hex');
    return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), keyBuffer, Buffer.from([0x88, 0xac])]);
}

export function addressToScript(network, addr) {
    if (typeof network !== 'undefined' && network !== null) {
        return bitcoin.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([
            Buffer.from([0x76, 0xa9, 0x14]),
            bitcoin.address.fromBase58Check(addr).hash,
            Buffer.from([0x88, 0xac]),
        ]);
    }
}

export function kotoAddressToScript(addr, network) {
    if (typeof network !== 'undefined' && network !== null) {
        return zcash.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([
            Buffer.from([0x76, 0xa9, 0x14]),
            zcash.address.fromBase58Check(addr).hash,
            Buffer.from([0x88, 0xac]),
        ]);
    }
}

export function getReadableHashRateString(hashrate) {
    let i = -1;
    const byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH', ' EH', ' ZH', ' YH'];
    do {
        hashrate = hashrate / 1024;
        i++;
    } while (hashrate > 1024);
    return hashrate.toFixed(2) + byteUnits[i];
}

export function shiftMax256Right(shiftRight) {
    let arr256 = Array(256).fill(1);
    const arrLeft = Array(shiftRight).fill(0);
    arr256 = arrLeft.concat(arr256).slice(0, 256);

    const octets = [];
    for (let i = 0; i < 32; i++) {
        octets[i] = 0;

        const bits = arr256.slice(i * 8, i * 8 + 8);
        for (let f = 0; f < bits.length; f++) {
            const multiplier = Math.pow(2, f);
            octets[i] += bits[f] * multiplier;
        }
    }

    return Buffer.from(octets);
}

export function bufferToCompactBits(startingBuff) {
    const bigNum = BigInt(`0x${startingBuff.toString('hex')}`);
    let buff = Buffer.from(bigNum.toString(16), 'hex');

    if (buff[0] > 0x7f) {
        buff = Buffer.concat([Buffer.from([0x00]), buff]);
    }

    buff = Buffer.concat([Buffer.from([buff.length]), buff]);
    const compact = buff.slice(0, 4);
    return compact;
}

export function bignumFromBuffer(buffer) {
    return BigInt(`0x${buffer.toString('hex')}`);
}

export function bignumFromBitsBuffer(bitsBuff) {
    const numBytes = bitsBuff.readUInt8(0);
    const bigBits = BigInt(`0x${bitsBuff.slice(1).toString('hex')}`);
    const target = bigBits * BigInt(2) ** (BigInt(8) * BigInt(numBytes - 3));
    return target;
}

export function bignumFromBitsHex(bitsString) {
    const bitsBuff = Buffer.from(bitsString, 'hex');
    return bignumFromBitsBuffer(bitsBuff);
}

export function convertBitsToBuff(bitsBuff) {
    const target = bignumFromBitsBuffer(bitsBuff);
    const resultBuff = Buffer.from(target.toString(16), 'hex');
    const buff256 = Buffer.alloc(32);
    resultBuff.copy(buff256, buff256.length - resultBuff.length);
    return buff256;
}

export function getTruncatedDiff(shift) {
    return convertBitsToBuff(bufferToCompactBits(shiftMax256Right(shift)));
}

let blockIdentifier = '/nodeStratum/';

export function setBlockIdentifier(_blockIdentifier) {
    if (_blockIdentifier) blockIdentifier = _blockIdentifier;
}

export function getBlockIdentifier() {
    return `/${blockIdentifier}/`;
}

const consensusParams = {
    nSubsidySlowStartInterval: 43200,
    nSubsidyHalvingInterval: 1051200,
    SubsidySlowStartShift() {
        return Math.floor(consensusParams.nSubsidySlowStartInterval / 2);
    },
};

export function setupKotoConsensusParams(options) {
    if (!options.coin) {
        return;
    }
    if (options.coin.nSubsidySlowStartInterval) {
        consensusParams.nSubsidySlowStartInterval = options.coin.nSubsidySlowStartInterval;
    }
    if (options.coin.nSubsidyHalvingInterval) {
        consensusParams.nSubsidyHalvingInterval = options.coin.nSubsidyHalvingInterval;
    }
}

export function getKotoBlockSubsidy(nHeight) {
    const COIN = BigInt(100000000);
    let nSubsidy = COIN * BigInt(100);

    if (nHeight == 1) {
        nSubsidy = COIN * BigInt(3920000);
        return Number(nSubsidy);
    }

    if (nHeight < consensusParams.nSubsidySlowStartInterval / 2) {
        nSubsidy = nSubsidy / BigInt(consensusParams.nSubsidySlowStartInterval);
        return Number(nSubsidy * BigInt(nHeight));
    } else if (nHeight < consensusParams.nSubsidySlowStartInterval) {
        nSubsidy = nSubsidy / BigInt(consensusParams.nSubsidySlowStartInterval);
        return Number(nSubsidy * BigInt(nHeight + 1));
    }

    const halvings = Math.floor(
        (nHeight - consensusParams.SubsidySlowStartShift()) /
            consensusParams.nSubsidyHalvingInterval
    );
    if (halvings >= 64) return 0;

    nSubsidy = nSubsidy >> BigInt(halvings);
    return Number(nSubsidy);
}

export function getFounderRewardScript(network, addr) {
    if (typeof network !== 'undefined' && network !== null) {
        return bitcoin.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([
            Buffer.from([0x76, 0xa9, 0x14]),
            bitcoin.address.fromBase58Check(addr).hash,
            Buffer.from([0x88, 0xac]),
        ]);
    }
}

export function getKotoFounderRewardScript(addr, network) {
    if (typeof network !== 'undefined' && network !== null) {
        return zcash.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([
            Buffer.from([0x76, 0xa9, 0x14]),
            zcash.address.fromBase58Check(addr).hash,
            Buffer.from([0x88, 0xac]),
        ]);
    }
}
