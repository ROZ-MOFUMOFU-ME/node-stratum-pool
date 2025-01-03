var crypto = require('crypto');
var base58 = require('bs58check');
var bitcoin = require('bitcoinjs-lib');
var zcash = require('@exodus/bitcoinjs-lib-zcash');

exports.addressFromEx = function (exAddress, ripdm160Key) {
    try {
        var versionByte = exports.getVersionByte(exAddress);
        var addrBase = Buffer.concat([versionByte, Buffer.from(ripdm160Key, 'hex')]);
        var checksum = exports.sha256d(addrBase).slice(0, 4);
        var address = Buffer.concat([addrBase, checksum]);
        return base58.encode(address);
    } catch (e) {
        return null;
    }
};

exports.getVersionByte = function (addr) {
    var versionByte = base58.decode(addr).slice(0, 1);
    return versionByte;
};

exports.sha256 = function (buffer) {
    var hash1 = crypto.createHash('sha256');
    hash1.update(buffer);
    return hash1.digest();
};

exports.sha256d = function (buffer) {
    return exports.sha256(exports.sha256(buffer));
};

exports.reverseBuffer = function (buffer) {
    return Buffer.from(buffer).reverse();
};

exports.reverseHex = function (hex) {
    return exports.reverseBuffer(Buffer.from(hex, 'hex')).toString('hex');
};

exports.reverseByteOrder = function (buff) {
    for (var i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4);
    return exports.reverseBuffer(buff);
};

exports.uint256BufferFromHash = function (hex) {
    var fromHex = Buffer.from(hex, 'hex');
    if (fromHex.length != 32) {
        var empty = Buffer.alloc(32);
        empty.fill(0);
        fromHex.copy(empty);
        fromHex = empty;
    }
    return exports.reverseBuffer(fromHex);
};

exports.hexFromReversedBuffer = function (buffer) {
    return exports.reverseBuffer(buffer).toString('hex');
};

exports.varIntBuffer = function (n) {
    if (n < 0xfd)
        return Buffer.from([n]);
    else if (n <= 0xffff) {
        var buff = Buffer.alloc(3);
        buff[0] = 0xfd;
        buff.writeUInt16LE(n, 1);
        return buff;
    } else if (n <= 0xffffffff) {
        var buff = Buffer.alloc(5);
        buff[0] = 0xfe;
        buff.writeUInt32LE(n, 1);
        return buff;
    } else {
        var buff = Buffer.alloc(9);
        buff[0] = 0xff;
        exports.packUInt16LE(n).copy(buff, 1);
        return buff;
    }
};

exports.varStringBuffer = function (string) {
    var strBuff = Buffer.from(string);
    return Buffer.concat([exports.varIntBuffer(strBuff.length), strBuff]);
};

exports.serializeNumber = function (n) {
    if (n >= 1 && n <= 16) return Buffer.from([0x50 + n]);
    var l = 1;
    var buff = Buffer.alloc(9);
    while (n > 0x7f) {
        buff.writeUInt8(n & 0xff, l++);
        n >>= 8;
    }
    buff.writeUInt8(l, 0);
    buff.writeUInt8(n, l++);
    return buff.slice(0, l);
};

exports.serializeString = function (s) {
    if (s.length < 253)
        return Buffer.concat([
            Buffer.from([s.length]),
            Buffer.from(s)
        ]);
    else if (s.length < 0x10000)
        return Buffer.concat([
            Buffer.from([253]),
            exports.packUInt16LE(s.length),
            Buffer.from(s)
        ]);
    else if (s.length < 0x100000000)
        return Buffer.concat([
            Buffer.from([254]),
            exports.packUInt32LE(s.length),
            Buffer.from(s)
        ]);
    else
        return Buffer.concat([
            Buffer.from([255]),
            exports.packUInt16LE(s.length),
            Buffer.from(s)
        ]);
};

exports.packUInt16LE = function (num) {
    var buff = Buffer.alloc(2);
    buff.writeUInt16LE(num, 0);
    return buff;
};

exports.packInt32LE = function (num) {
    var buff = Buffer.alloc(4);
    buff.writeInt32LE(num, 0);
    return buff;
};

exports.packInt32BE = function (num) {
    var buff = Buffer.alloc(4);
    buff.writeInt32BE(num, 0);
    return buff;
};

exports.packUInt32LE = function (num) {
    var buff = Buffer.alloc(4);
    buff.writeUInt32LE(num, 0);
    return buff;
};

exports.packUInt32BE = function (num) {
    if (typeof num === 'bigint') {
        num = Number(num);
    }
    if (typeof num !== 'number' || num > 0xFFFFFFFF || num < 0) {
        throw new TypeError('The value of "num" is out of range. It must be a number between 0 and 4,294,967,295 or a safe bigint.');
    }
    var buff = Buffer.alloc(4);
    buff.writeUInt32BE(num, 0);
    return buff;
};

exports.packInt64LE = function (num) {
    var buff = Buffer.alloc(8);
    buff.writeUInt32LE(num % Math.pow(2, 32), 0);
    buff.writeUInt32LE(Math.floor(num / Math.pow(2, 32)), 4);
    return buff;
};

exports.range = function (start, stop, step) {
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
    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }
    return result;
};

exports.pubkeyToScript = function (key) {
    if (key.length !== 66) {
        console.error('Invalid pubkey: ' + key);
        throw new Error();
    }
    var pubkey = Buffer.alloc(35);
    pubkey[0] = 0x21;
    pubkey[34] = 0xac;
    Buffer.from(key, 'hex').copy(pubkey, 1);
    return pubkey;
};

exports.miningKeyToScript = function (key) {
    var keyBuffer = Buffer.from(key, 'hex');
    return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), keyBuffer, Buffer.from([0x88, 0xac])]);
};

exports.addressToScript = function (network, addr) {
    if (typeof network !== 'undefined' && network !== null) {
        return bitcoin.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), bitcoin.address.fromBase58Check(addr).hash, Buffer.from([0x88, 0xac])]);
    }
};

exports.kotoAddressToScript = function (addr) {
    if (typeof network !== 'undefined' && network !== null) {
        return zcash.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), zcash.address.fromBase58Check(addr).hash, Buffer.from([0x88, 0xac])]);
    }
};

exports.getReadableHashRateString = function (hashrate) {
    var i = -1;
    var byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH', ' EH', ' ZH', ' YH'];
    do {
        hashrate = hashrate / 1024;
        i++;
    } while (hashrate > 1024);
    return hashrate.toFixed(2) + byteUnits[i];
};

exports.shiftMax256Right = function (shiftRight) {
    var arr256 = Array(256).fill(1);
    var arrLeft = Array(shiftRight).fill(0);
    arr256 = arrLeft.concat(arr256).slice(0, 256);

    var octets = [];
    for (var i = 0; i < 32; i++) {
        octets[i] = 0;

        var bits = arr256.slice(i * 8, i * 8 + 8);
        for (var f = 0; f < bits.length; f++) {
            var multiplier = Math.pow(2, f);
            octets[i] += bits[f] * multiplier;
        }
    }

    return Buffer.from(octets);
};

exports.bufferToCompactBits = function (startingBuff) {
    let bigNum = BigInt('0x' + startingBuff.toString('hex'));
    let buff = Buffer.from(bigNum.toString(16), 'hex');

    if (buff[0] > 0x7f) {
        buff = Buffer.concat([Buffer.from([0x00]), buff]);
    }

    buff = Buffer.concat([Buffer.from([buff.length]), buff]);
    let compact = buff.slice(0, 4);
    return compact;
};

exports.bignumFromBuffer = function (buffer) {
    return BigInt('0x' + buffer.toString('hex'));
};

exports.bignumFromBitsBuffer = function (bitsBuff) {
    let numBytes = bitsBuff.readUInt8(0);
    let bigBits = BigInt('0x' + bitsBuff.slice(1).toString('hex'));
    let target = bigBits * (BigInt(2) ** (BigInt(8) * BigInt(numBytes - 3)));
    return target;
};

exports.bignumFromBitsHex = function (bitsString) {
    let bitsBuff = Buffer.from(bitsString, 'hex');
    return exports.bignumFromBitsBuffer(bitsBuff);
};

exports.convertBitsToBuff = function (bitsBuff) {
    let target = exports.bignumFromBitsBuffer(bitsBuff);
    let resultBuff = Buffer.from(target.toString(16), 'hex');
    let buff256 = Buffer.alloc(32);
    resultBuff.copy(buff256, buff256.length - resultBuff.length);
    return buff256;
};

exports.getTruncatedDiff = function (shift) {
    return exports.convertBitsToBuff(exports.bufferToCompactBits(exports.shiftMax256Right(shift)));
};

var blockIdentifier = '/nodeStratum/';

exports.setBlockIdentifier = function (_blockIdentifier) {
    if (_blockIdentifier)
        blockIdentifier = _blockIdentifier;
}

exports.getBlockIdentifier = function () {
    return '/' + blockIdentifier + '/';
}

var consensusParams = {
    "nSubsidySlowStartInterval": 43200,
    "nSubsidyHalvingInterval": 1051200,
    "SubsidySlowStartShift": function () { return Math.floor(consensusParams.nSubsidySlowStartInterval / 2); }
};

exports.setupKotoConsensusParams = function (options) {
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

exports.getKotoBlockSubsidy = function (nHeight) {
    var COIN = BigInt(100000000);
    var nSubsidy = COIN * BigInt(100);

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

    var halvings = Math.floor((nHeight - consensusParams.SubsidySlowStartShift()) / consensusParams.nSubsidyHalvingInterval);
    if (halvings >= 64)
        return 0;

    nSubsidy = nSubsidy >> BigInt(halvings);
    return Number(nSubsidy);
};

exports.getFounderRewardScript = function (network, addr) {
    if (typeof network !== 'undefined' && network !== null) {
        return bitcoin.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), bitcoin.address.fromBase58Check(addr).hash, Buffer.from([0x88, 0xac])]);
    }
};

exports.getKotoFounderRewardScript = function (addr) {
    if (typeof network !== 'undefined' && network !== null) {
        return zcash.address.toOutputScript(addr, network);
    } else {
        return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), zcash.address.fromBase58Check(addr).hash, Buffer.from([0x88, 0xac])]);
    }
};