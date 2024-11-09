var https = require('https');
var net = require('net');
var events = require('events');

var util = require('./util.js');

var varDiff = require('./varDiff.js');

var isValidHexRegex = /^[0-9A-Fa-f]+$/;

var SubscriptionCounter = function () {
    var count = 0;
    var padding = 'deadbeefcafebabe';
    return {
        next: function () {
            count++;
            if (Number.MAX_VALUE === count) count = 0;
            return padding + util.packInt64LE(count).toString('hex');
        }
    };
};

var NiceHashAPI = function () {
    var _this = this;
    this.url = 'https://api2.nicehash.com/main/api/v2/public/buy/info';
    this.options = {
        agent: new https.Agent({
            keepAlive: true
        })
    };
    this.refresh = function () {
        return new Promise(function (resolve, reject) {
            https.get(_this.url, _this.options, function (result) {
                var error;
                if (result.statusCode !== 200) {
                    error = new Error('Request Failed.\nStatus Code: ' + result.statusCode);
                } else if (!/^application\/json/.test(result.headers['content-type'])) {
                    error = new Error('Invalid content-type.\nExpected application/json but received ' + result.headers['content-type']);
                }
                if (error) {
                    result.resume();
                    reject(error);
                    return;
                }
                result.setEncoding('utf8');
                var rawData = '';
                result.on('data', function (chunk) {
                    rawData += chunk;
                });
                result.on('end', function () {
                    try {
                        resolve(JSON.parse(rawData));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', function (e) {
                reject(e);
            });
        });
    };
};

// Some initial information
var niceHashAPIData = {
    "cryptonightheavy": {
        "down_step": -0.0001,
        "min_diff_working": 400000,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "MH",
        "min_diff_initial": 400000,
        "algo": 31,
        "multi": 1000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "x11": {
        "down_step": -0.0001,
        "min_diff_working": 128,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "TH",
        "min_diff_initial": 31,
        "algo": 3,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "grincuckaroo29": {
        "down_step": -0.0001,
        "min_diff_working": 512,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "kG",
        "min_diff_initial": 64,
        "algo": 38,
        "multi": 1000000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "cryptonightv8": {
        "down_step": -0.0001,
        "min_diff_working": 400000,
        "min_limit": 0.1,
        "max_limit": 10000,
        "speed_text": "MH",
        "min_diff_initial": 400000,
        "algo": 34,
        "multi": 1000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "x13": {
        "down_step": -0.0001,
        "min_diff_working": 2,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 0.5,
        "algo": 4,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "grincuckatoo31": {
        "down_step": -0.0001,
        "min_diff_working": 512,
        "min_limit": 0.02,
        "max_limit": 20000,
        "speed_text": "kG",
        "min_diff_initial": 64,
        "algo": 39,
        "multi": 1000000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "zhash": {
        "down_step": -0.0001,
        "min_diff_working": 4096,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "MSol",
        "min_diff_initial": 1024,
        "algo": 36,
        "multi": 1000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "x16rv2": {
        "down_step": -0.0001,
        "min_diff_working": 16,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "GH",
        "min_diff_initial": 8,
        "algo": 46,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "blake2s": {
        "down_step": -0.0001,
        "min_diff_working": 256,
        "min_limit": 1,
        "max_limit": 1000000,
        "speed_text": "TH",
        "min_diff_initial": 128,
        "algo": 28,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "nist5": {
        "down_step": -0.0001,
        "min_diff_working": 4,
        "min_limit": 0.04,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 2,
        "algo": 7,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "beamv2": {
        "down_step": -0.0001,
        "min_diff_working": 8192,
        "min_limit": 1,
        "max_limit": 1000000,
        "speed_text": "kSol",
        "min_diff_initial": 2048,
        "algo": 45,
        "multi": 1000000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "quark": {
        "down_step": -0.0001,
        "min_diff_working": 0.2,
        "min_limit": 0.02,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 0.1,
        "algo": 12,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "scrypt": {
        "down_step": -0.001,
        "min_diff_working": 1000000,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 500000,
        "algo": 0,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "skunk": {
        "down_step": -0.0001,
        "min_diff_working": 10,
        "min_limit": 0.4,
        "max_limit": 200000,
        "speed_text": "GH",
        "min_diff_initial": 2,
        "algo": 29,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "sha256asicboost": {
        "down_step": -0.0001,
        "min_diff_working": 1000000,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "PH",
        "min_diff_initial": 500000,
        "algo": 35,
        "multi": 0.000001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "daggerhashimoto": {
        "down_step": -0.0001,
        "min_diff_working": 2,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 1,
        "algo": 20,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "lyra2z": {
        "down_step": -0.0001,
        "min_diff_working": 64,
        "min_limit": 1,
        "max_limit": 50000,
        "speed_text": "GH",
        "min_diff_initial": 16,
        "algo": 32,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "lbry": {
        "down_step": -0.0001,
        "min_diff_working": 32768,
        "min_limit": 10,
        "max_limit": 10000000,
        "speed_text": "TH",
        "min_diff_initial": 4095,
        "algo": 23,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "sha256": {
        "down_step": -0.0001,
        "min_diff_working": 1000000,
        "min_limit": 0.05,
        "max_limit": 50000,
        "speed_text": "PH",
        "min_diff_initial": 500000,
        "algo": 1,
        "multi": 0.000001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "cryptonightv7": {
        "down_step": -0.0001,
        "min_diff_working": 400000,
        "min_limit": 0.04,
        "max_limit": 10000,
        "speed_text": "MH",
        "min_diff_initial": 400000,
        "algo": 30,
        "multi": 1000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "lyra2rev3": {
        "down_step": -0.0001,
        "min_diff_working": 512,
        "min_limit": 0.5,
        "max_limit": 500000,
        "speed_text": "GH",
        "min_diff_initial": 64,
        "algo": 40,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "decred": {
        "down_step": -0.0001,
        "min_diff_working": 8,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "PH",
        "min_diff_initial": 1,
        "algo": 21,
        "multi": 0.000001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "grincuckarood29": {
        "down_step": -0.0001,
        "min_diff_working": 512,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "kG",
        "min_diff_initial": 64,
        "algo": 44,
        "multi": 1000000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "cryptonight": {
        "down_step": -0.0001,
        "min_diff_working": 6400000,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "GH",
        "min_diff_initial": 6400000,
        "algo": 22,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "equihash": {
        "down_step": -0.0001,
        "min_diff_working": 131072,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "MSol",
        "min_diff_initial": 65534,
        "algo": 24,
        "multi": 1000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "cuckoocycle": {
        "down_step": -0.0001,
        "min_diff_working": 512,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "kG",
        "min_diff_initial": 128,
        "algo": 43,
        "multi": 1000000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "qubit": {
        "down_step": -0.0001,
        "min_diff_working": 8,
        "min_limit": 0.1,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 4,
        "algo": 11,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "lyra2rev2": {
        "down_step": -0.0001,
        "min_diff_working": 1024,
        "min_limit": 0.1,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 256,
        "algo": 14,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "neoscrypt": {
        "down_step": -0.0001,
        "min_diff_working": 65535,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "GH",
        "min_diff_initial": 16383,
        "algo": 8,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "cryptonightr": {
        "down_step": -0.0001,
        "min_diff_working": 800000,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "MH",
        "min_diff_initial": 800000,
        "algo": 42,
        "multi": 1000,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "keccak": {
        "down_step": -0.0001,
        "min_diff_working": 8191,
        "min_limit": 0.01,
        "max_limit": 10000,
        "speed_text": "TH",
        "min_diff_initial": 2047,
        "algo": 5,
        "multi": 0.001,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    },
    "x16r": {
        "down_step": -0.0001,
        "min_diff_working": 16,
        "min_limit": 0.1,
        "max_limit": 100000,
        "speed_text": "GH",
        "min_diff_initial": 8,
        "algo": 33,
        "multi": 1,
        "min_price": 0.0001,
        "max_price": 100,
        "min_amount": 0.005
    }
};
var niceHashAPITimeout = -1;
var niceHashMiningAlgorithmsReducer = function (accumulator, algorithm) {
    var name = algorithm.name.toLowerCase();
    delete algorithm.name;
    accumulator[name] = algorithm;
    return accumulator;
};
var updateNiceHashData = function (apiData) {
    niceHashAPIData = apiData.miningAlgorithms.reduce(niceHashMiningAlgorithmsReducer, {});
};
var handleNiceHashAPIError = function (error) {
    // TODO: Use the logging system!
    console.error(error);
}
var rescheduleNiceHashAPIUpdate = function () {
    niceHashAPITimeout = setTimeout(maybeUpdateNiceHashAPIInformation, 300000);
}
var niceHashAPIHandler = new NiceHashAPI();
var maybeUpdateNiceHashAPIInformation = function () {
    niceHashAPIHandler
        .refresh()
        .then(updateNiceHashData)
        .catch(handleNiceHashAPIError)
        .finally(rescheduleNiceHashAPIUpdate);
};
maybeUpdateNiceHashAPIInformation();

/**
 * Defining each client that connects to the stratum server. 
 * Emits:
 *  - subscription(obj, cback(error, extraNonce1, extraNonce2Size))
 *  - submit(data(name, jobID, extraNonce2, ntime, nonce))
**/
var StratumClient = function (options) {
    var pendingDifficulty = null;
    //private members
    this.socket = options.socket;

    this.remoteAddress = options.socket.remoteAddress;

    var banning = options.banning;

    var _this = this;

    var emitLog = function (text) { _this.emit('log', 'debug', text); };

    this.supportsExtranonceSubscribe = false;
    this.initialDifficulty = -1;
    this.minimumDifficulty = -1;
    this.isSoloMining = false;

    this.lastActivity = Date.now();

    this.shares = { valid: 0, invalid: 0 };

    var considerBan = (!banning || !banning.enabled) ? function () { return false } : function (shareValid) {
        if (shareValid === true) _this.shares.valid++;
        else _this.shares.invalid++;
        var totalShares = _this.shares.valid + _this.shares.invalid;
        if (totalShares >= banning.checkThreshold) {
            var percentBad = (_this.shares.invalid / totalShares) * 100;
            if (percentBad < banning.invalidPercent) //reset shares
                this.shares = { valid: 0, invalid: 0 };
            else {
                _this.emit('triggerBan', _this.shares.invalid + ' out of the last ' + totalShares + ' shares were invalid');
                _this.socket.destroy();
                return true;
            }
        }
        return false;
    };

    this.init = function init() {
        setupSocket();
    };

    function handleMessage(message) {
        switch (message.method) {
            case 'mining.extranonce.subscribe':
                handleExtraNonceSubscribe(message);
                break;
            case 'mining.subscribe':
                emitLog('mining.subscribe message from  miners');
                handleSubscribe(message);
                break;
            case 'mining.authorize':
                emitLog('mining.authorize message from  miner');
                handleAuthorize(message, true /*reply to socket*/);
                break;
            case 'mining.get_multiplier':
                emitLog('mining.get_multiplier message from  miner');
                _this.emit('log', algos[options.coin.algorithm].multiplier);
                sendJson({
                    id: null,
                    result: [algos[options.coin.algorithm].multiplier],
                    method: "mining.get_multiplier"
                });
                break;
            case 'ping':
                emitLog('ping message from  miner');
                _this.lastActivity = Date.now();
                sendJson({
                    id: null,
                    result: [],
                    method: "pong"
                });
                break;
            case 'mining.configure':
                emitLog('mining.configure message from  miner');
                handleConfigure(message);
                break;
            case 'mining.submit':
                _this.lastActivity = Date.now();
                emitLog('mining.submit message from  miner');
                handleSubmit(message);
                break;
            case 'mining.get_transactions':
                sendJson({
                    id: null,
                    result: [],
                    error: true
                });
                emitLog('mining.get_transactionsfrom  miner, message = %s');
                break;
            case 'mining.suggest_target':
                handleSuggestTarget(message);
                break;
            case 'mining.suggest_difficulty':
                handleSuggestDifficulty(message);
                break;
            default:
                _this.emit('unknownStratumMethod', message);
                break;
        }
    }

    function handleExtraNonceSubscribe(message) {
        _this.supportsExtranonceSubscribe = true;
        sendJson({
            id: message.id,
            result: true,
            "error": null
        });
    }

    function handleSubscribe(message) {
        if (!_this._authorized) {
            _this.requestedSubscriptionBeforeAuth = true;
        }

        if (message.params && message.params[0] && message.params[0].toLowerCase().indexOf('nicehash/') === 0) {
            var coinAlgo = options.coin.algorithm.toLowerCase()
            switch (coinAlgo) {
                case 'lyra2re2':
                    coinAlgo = 'lyra2rev2';
                    break;
                case 'lyra2v3':
                    coinAlgo = 'lyra2rev3';
                    break;
                default:
                    break;
            }
            if (options.coin.version_mask) {
                coinAlgo += 'asicboost';
            }
            var niceHashData = niceHashAPIData[coinAlgo];
            if (niceHashData) {
                _this.initialDifficulty = Math.max(_this.initialDifficulty, niceHashData.min_diff_initial);
                if (!_this.varDiff || _this.minimumDifficulty < niceHashData.min_diff_working) {
                    if (_this.varDiff) {
                        _this.varDiff.removeAllListeners();
                    }
                    _this.varDiff = new varDiff(options.socket.localPort, Object.assign({}, options.defaultVarDiff || {
                        targetTime: 15,
                        retargetTime: 90,
                        variancePercent: 30
                    }, {
                        minDiff: niceHashData.min_diff_working,
                        maxDiff: 2 * niceHashData.min_diff_working
                    }));
                    _this.varDiff.manageClient(_this);
                }
            }
        }

        _this.emit('subscription',
            {},
            function (error, extraNonce1, extraNonce2Size) {
                if (error) {
                    sendJson({
                        id: message.id,
                        result: null,
                        error: error
                    });
                    return;
                }
                _this.extraNonce1 = extraNonce1;
                sendJson({
                    id: message.id,
                    result: [
                        [
                            ["mining.set_difficulty", options.subscriptionId],
                            ["mining.notify", options.subscriptionId]
                        ],
                        extraNonce1,
                        extraNonce2Size
                    ],
                    error: null
                });
            }
        );
    }

    function handleAuthorize(message, replyToSocket) {
        _this.workerName = message.params[0];
        _this.workerPass = message.params[1];
        options.authorizeFn(_this.remoteAddress, options.socket.localPort, _this.workerName, _this.workerPass, function (result) {
            _this.authorized = (!result.error && result.authorized);

            if (replyToSocket) {
                sendJson({
                    id: message.id,
                    result: _this.authorized,
                    error: result.error
                });
            }

            // If the authorizer wants us to close the socket lets do it.
            if (result.disconnect === true) {
                options.socket.destroy();
            } else {
                var passwordArgs = _this.workerPass.split(',');
                for (var i = 0; i < passwordArgs.length; i++) {
                    var key = passwordArgs[i].substr(0, passwordArgs[i].indexOf('='));
                    switch (key.toLowerCase()) {
                        case 'd':
                            _this.initialDifficulty = parseInt(passwordArgs[i].substr(passwordArgs[i].indexOf('=') + 1)) || -1;
                            break;
                        case 'md':
                            if (!_this.varDiff) {
                                _this.minimumDifficulty = parseInt(passwordArgs[i].substr(passwordArgs[i].indexOf('=') + 1)) || -1;
                                if (options.defaultVarDiff && _this.minimumDifficulty > -1) {
                                    _this.varDiff = new varDiff(options.socket.localPort, Object.assign({}, options.defaultVarDiff, {
                                        minDiff: _this.minimumDifficulty,
                                        maxDiff: 2 * _this.minimumDifficulty
                                    }));
                                    _this.varDiff.manageClient(_this);
                                }
                            }
                            break;
                        case 'm':
                            _this.isSoloMining = passwordArgs[i].substr(passwordArgs[i].indexOf('=') + 1).trim().toLowerCase() === 'solo'
                            break;
                        default:
                            break;
                    }
                }
                if (_this.requestedSubscriptionBeforeAuth) {
                    if (_this.initialDifficulty > 0) {
                        _this.sendDifficulty(_this.initialDifficulty);
                    }
                }
            }
        });
    }

    function handleSubmit(message) {
        if (!_this.authorized) {
            sendJson({
                id: message.id,
                result: null,
                error: [24, "unauthorized worker", null]
            });
            considerBan(false);
            return;
        }
        if (!_this.extraNonce1) {
            sendJson({
                id: message.id,
                result: null,
                error: [25, "not subscribed", null]
            });
            considerBan(false);
            return;
        }
        var params = {
            name: message.params[0],
            jobId: message.params[1],
            extraNonce2: message.params[2],
            nTime: message.params[3].toLowerCase(),
            nonce: message.params[4].toLowerCase()
        };

        if (options.coin.version_mask && isValidHexRegex.test(options.coin.version_mask) && message.params.length > 5 && isValidHexRegex.test(message.params[5])) {
            var versionMask = parseInt(message.params[5], 16);
            if (versionMask && ((~parseInt(options.coin.version_mask, 16)) & versionMask) !== 0) {
                sendJson({
                    id: message.id,
                    result: null,
                    error: [6, "invalid version mask", null]
                });
                considerBan(false);
                return;
            }
            params.versionMask = versionMask;
        }

        _this.emit('submit', params,
            function (error, result) {
                if (!considerBan(result)) {
                    sendJson({
                        id: message.id,
                        result: result,
                        error: error
                    });
                }
            }
        );
    }

    function handleSuggestTarget(message) {
        var zeroPad = 0;
        for (var i = 0; i < message.params[0].length; i++) {
            if (i === '0') {
                zeroPad++;
            } else {
                break;
            }
        }
        var adj = parseInt('0x' + message.params[0].slice(zeroPad, 64));
        if (adj) {
            _this.difficulty /= adj;
        }
        sendJson({
            id: message.id,
            result: true,
            "error": null
        });
    }
    function handleSuggestDifficulty(message) {
        _this.difficulty = message.params[0];
        sendJson({
            id: message.id,
            result: true,
            "error": null
        });
    }

    function handleConfigure(message) {
        if (options.coin.version_mask && isValidHexRegex.test(options.coin.version_mask)) {
            sendJson({
                id: message.id,
                result: {
                    'version-rolling': true,
                    'version-rolling.mask': options.coin.version_mask
                },
                error: null
            });
        } else {
            _this.emit('unknownStratumMethod', message);
        }
    }

    function sendJson() {
        var response = '';
        for (var i = 0; i < arguments.length; i++) {
            response += JSON.stringify(arguments[i]) + '\n';
        }
        options.socket.write(response);
    }

    function setupSocket() {
        var socket = options.socket;
        var dataBuffer = '';
        socket.setEncoding('utf8');

        if (options.tcpProxyProtocol === true) {
            socket.once('data', function (d) {
                if (d.indexOf('PROXY') === 0) {
                    _this.remoteAddress = d.split(' ')[2];
                }
                else {
                    _this.emit('tcpProxyError', d);
                }
                _this.emit('checkBan');
            });
        }
        else {
            _this.emit('checkBan');
        }
        socket.on('data', function (d) {
            dataBuffer += d;
            if (Buffer.byteLength(dataBuffer, 'utf8') > 10240) { //10KB
                dataBuffer = '';
                _this.emit('socketFlooded');
                socket.destroy();
                return;
            }
            if (dataBuffer.indexOf('\n') !== -1) {
                var messages = dataBuffer.split('\n');
                var incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
                messages.forEach(function (message) {
                    if (message === '') return;
                    var messageJson;
                    try {
                        messageJson = JSON.parse(message);
                    } catch (e) {
                        if (options.tcpProxyProtocol !== true || d.indexOf('PROXY') !== 0) {
                            _this.emit('malformedMessage', message);
                            socket.destroy();
                        }
                        return;
                    }

                    if (messageJson) {
                        handleMessage(messageJson);
                    }
                });
                dataBuffer = incomplete;
            }
        });
        socket.on('close', function () {
            _this.emit('socketDisconnect');
        });
        socket.on('error', function (err) {
            if (err.code !== 'ECONNRESET')
                _this.emit('socketError', err);
        });
    }


    this.getLabel = function () {
        return (_this.workerName || '(unauthorized)') + ' [' + _this.remoteAddress + ']';
    };

    this.enqueueNextDifficulty = function (requestedNewDifficulty) {
        pendingDifficulty = requestedNewDifficulty;
        return true;
    };

    //public members

    /**
     * IF the given difficulty is valid and new it'll send it to the client.
     * returns boolean
     **/
    this.sendDifficulty = function (difficulty) {
        if (difficulty === this.difficulty)
            return false;

        _this.previousDifficulty = _this.difficulty;
        _this.difficulty = difficulty;
        sendJson({
            id: null,
            method: "mining.set_difficulty",
            params: [difficulty]//[512],
        });
        return true;
    };

    this.sendMiningJob = function (jobParams, odoKey) {

        var lastActivityAgo = Date.now() - _this.lastActivity;
        if (lastActivityAgo > options.connectionTimeout * 1000) {
            _this.emit('socketTimeout', 'last submitted a share was ' + (lastActivityAgo / 1000 | 0) + ' seconds ago');
            _this.socket.destroy();
            return;
        }
        if (pendingDifficulty !== null) {
            var result = _this.sendDifficulty(pendingDifficulty);
            pendingDifficulty = null;
            if (result) {
                _this.emit('difficultyChanged', _this.difficulty);
            }
        }
        var json = {
            id: null,
            method: "mining.notify",
            params: jobParams
        };

        if (odoKey !== null) {
            json.odokey = odoKey;
        }

        sendJson(json);
    };

    this.manuallyAuthClient = function (username, password) {
        handleAuthorize({ id: 1, params: [username, password] }, false /*do not reply to miner*/);
    };

    this.manuallySetValues = function (otherClient) {
        _this.extraNonce1 = otherClient.extraNonce1;
        _this.previousDifficulty = otherClient.previousDifficulty;
        _this.difficulty = otherClient.difficulty;
    };
};
StratumClient.prototype.__proto__ = events.EventEmitter.prototype;




/**
 * The actual stratum server.
 * It emits the following Events:
 *   - 'client.connected'(StratumClientInstance) - when a new miner connects
 *   - 'client.disconnected'(StratumClientInstance) - when a miner disconnects. Be aware that the socket cannot be used anymore.
 *   - 'started' - when the server is up and running
 **/
var StratumServer = exports.Server = function StratumServer(options, authorizeFn) {

    //private members

    //ports, connectionTimeout, jobRebroadcastTimeout, banning, haproxy, authorizeFn

    var bannedMS = options.banning ? options.banning.time * 1000 : null;

    var _this = this;
    var stratumClients = {};
    var subscriptionCounter = SubscriptionCounter();
    var rebroadcastTimeout;
    var bannedIPs = {};


    function checkBan(client) {
        if (options.banning && options.banning.enabled && client.remoteAddress in bannedIPs) {
            var bannedTime = bannedIPs[client.remoteAddress];
            var bannedTimeAgo = Date.now() - bannedTime;
            var timeLeft = bannedMS - bannedTimeAgo;
            if (timeLeft > 0) {
                client.socket.destroy();
                client.emit('kickedBannedIP', timeLeft / 1000 | 0);
            }
            else {
                delete bannedIPs[client.remoteAddress];
                client.emit('forgaveBannedIP');
            }
        }
    }

    this.handleNewClient = function (socket) {

        socket.setKeepAlive(true);
        var subscriptionId = subscriptionCounter.next();
        var client = new StratumClient(
            {
                subscriptionId: subscriptionId,
                authorizeFn: authorizeFn,
                socket: socket,
                banning: options.banning,
                connectionTimeout: options.connectionTimeout,
                tcpProxyProtocol: options.tcpProxyProtocol,
                coin: options.coin,
                dynamicVarDiff: options.dynamicVarDiff
            }
        );

        stratumClients[subscriptionId] = client;
        _this.emit('client.connected', client);
        client.on('socketDisconnect', function () {
            _this.removeStratumClientBySubId(subscriptionId);
            _this.emit('client.disconnected', client);
        }).on('checkBan', function () {
            checkBan(client);
        }).on('triggerBan', function () {
            _this.addBannedIP(client.remoteAddress);
        }).init();
        return subscriptionId;
    };


    this.broadcastMiningJobs = function (jobParams, odoKey) {
        for (var clientId in stratumClients) {
            var client = stratumClients[clientId];
            client.sendMiningJob(jobParams, odoKey);
        }
        /* Some miners will consider the pool dead if it doesn't receive a job for around a minute.
           So every time we broadcast jobs, set a timeout to rebroadcast in X seconds unless cleared. */
        clearTimeout(rebroadcastTimeout);
        rebroadcastTimeout = setTimeout(function () {
            _this.emit('broadcastTimeout');
        }, options.jobRebroadcastTimeout * 1000);
    };



    (function init() {

        //Interval to look through bannedIPs for old bans and remove them in order to prevent a memory leak
        if (options.banning && options.banning.enabled) {
            setInterval(function () {
                for (ip in bannedIPs) {
                    var banTime = bannedIPs[ip];
                    if (Date.now() - banTime > options.banning.time)
                        delete bannedIPs[ip];
                }
            }, 1000 * options.banning.purgeInterval);
        }


        //SetupBroadcasting();


        var serversStarted = 0;
        Object.keys(options.ports).forEach(function (port) {
            net.createServer({ allowHalfOpen: false }, function (socket) {
                _this.handleNewClient(socket);
            }).listen(parseInt(port), function () {
                serversStarted++;
                if (serversStarted == Object.keys(options.ports).length)
                    _this.emit('started');
            });
        });
    })();


    //public members

    this.addBannedIP = function (ipAddress) {
        bannedIPs[ipAddress] = Date.now();
        /*for (var c in stratumClients){
            var client = stratumClients[c];
            if (client.remoteAddress === ipAddress){
                _this.emit('bootedBannedWorker');
            }
        }*/
    };

    this.getStratumClients = function () {
        return stratumClients;
    };

    this.removeStratumClientBySubId = function (subscriptionId) {
        delete stratumClients[subscriptionId];
    };

    this.manuallyAddStratumClient = function (clientObj) {
        var subId = _this.handleNewClient(clientObj.socket);
        if (subId != null) { // not banned!
            stratumClients[subId].manuallyAuthClient(clientObj.workerName, clientObj.workerPass);
            stratumClients[subId].manuallySetValues(clientObj);
        }
    };

};
StratumServer.prototype.__proto__ = events.EventEmitter.prototype;
