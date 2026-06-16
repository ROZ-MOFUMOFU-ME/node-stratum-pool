import events from 'events';
import async from 'async';

import varDiff from './varDiff.ts';
import daemon from './daemon.ts';
import peer from './peer.ts';
import { Server } from './stratum.ts';
import jobManager from './jobManager.ts';
import * as util from './util.ts';
import algos from './algoProperties.ts';

/*process.on('uncaughtException', function(err) {
    console.log(err.stack);
    throw err;
});*/

const pool = function pool(this: any, options: any, authorizeFn: any) {
    this.options = options;

    const _this = this;

    if (!options.address) {
        _this.newAddressOnNewBlock = true;
    }

    const emitLog = function (text: string) {
        _this.emit('log', 'debug', text);
    };
    const emitWarningLog = function (text: string) {
        _this.emit('log', 'warning', text);
    };
    const emitErrorLog = function (text: string) {
        _this.emit('log', 'error', text);
    };
    const emitSpecialLog = function (text: string) {
        _this.emit('log', 'special', text);
    };

    if (!(options.coin.algorithm in algos)) {
        emitErrorLog(`The ${options.coin.algorithm} hashing algorithm is not supported.`);
        throw new Error();
    }

    this.start = function () {
        SetupVarDiff();
        SetupApi();
        if (options.blockIdentifier) util.setBlockIdentifier(options.blockIdentifier);
        util.setupKotoConsensusParams(options);
        SetupDaemonInterface(function () {
            DetectCoinData(function () {
                SetupRecipients();
                SetupJobManager();
                OnBlockchainSynced(function () {
                    GetFirstJob(function () {
                        SetupBlockPolling();
                        SetupPeer();
                        StartStratumServer(function () {
                            OutputPoolInfo();
                            _this.emit('started');
                        });
                    });
                });
            });
        });
    };

    function GetBlockTemplateParameters(): any {
        if (options.coin.passAlgorithm) {
            return [
                { capabilities: ['coinbasetxn', 'workid', 'coinbase/append'], rules: ['segwit'] },
                options.coin.passAlgorithm === true
                    ? options.coin.algorithm
                    : options.coin.passAlgorithm,
            ];
        } else if (options.coin.passAlgorithmKey) {
            return [
                {
                    capabilities: ['coinbasetxn', 'workid', 'coinbase/append'],
                    rules: ['segwit'],
                    algo:
                        options.coin.passAlgorithmKey === true
                            ? options.coin.algorithm
                            : options.coin.passAlgorithmKey,
                },
            ];
        }
        return [{ capabilities: ['coinbasetxn', 'workid', 'coinbase/append'], rules: ['segwit'] }];
    }

    function GetFirstJob(finishedCallback: any) {
        GetBlockTemplate(function (error: any, _result: any) {
            if (error) {
                emitErrorLog(
                    'Error with getblocktemplate on creating first job, server cannot start'
                );
                return;
            }

            const portWarnings: any[] = [];

            const networkDiffAdjusted = options.initStats.difficulty;

            Object.keys(options.ports).forEach(function (port) {
                const portDiff = options.ports[port].diff;
                if (networkDiffAdjusted < portDiff)
                    portWarnings.push(`port ${port} w/ diff ${portDiff}`);
            });

            //Only let the first fork show synced status or the log wil look flooded with it
            if (portWarnings.length > 0 && (!process.env.forkId || process.env.forkId === '0')) {
                const warnMessage = `Network diff of ${networkDiffAdjusted} is lower than ${portWarnings.join(
                    ' and '
                )}`;
                emitWarningLog(warnMessage);
            }

            finishedCallback();
        });
    }

    function OutputPoolInfo() {
        const startMessage = `Stratum Pool Server Started for ${
            options.coin.name
        } [${options.coin.symbol.toUpperCase()}] {${options.coin.algorithm}}`;
        if (process.env.forkId && process.env.forkId !== '0') {
            emitLog(startMessage);
            return;
        }
        const infoLines = [
            startMessage,
            `Network Connected:\t${options.testnet ? 'Testnet' : 'Mainnet'}`,
            `Detected Reward Type:\t${options.coin.reward}`,
            `Current Block Height:\t${_this.jobManager.currentJob.rpcData.height}`,
            `Current Connect Peers:\t${options.initStats.connections}`,
            `Current Block Diff:\t${_this.jobManager.currentJob.difficulty * algos[options.coin.algorithm].multiplier}`,
            `Network Difficulty:\t${options.initStats.difficulty}`,
            `Network Hash Rate:\t${util.getReadableHashRateString(options.initStats.networkHashRate)}`,
            `Stratum Port(s):\t${_this.options.initStats.stratumPorts.join(', ')}`,
            `Pool Fee Percent:\t${_this.options.feePercent}%`,
            `ASICBoost Enabled:\t${options.coin.version_mask ? 'true' : 'false'}`,
        ];

        if (typeof options.blockRefreshInterval === 'number' && options.blockRefreshInterval > 0)
            infoLines.push(`Block polling every:\t${options.blockRefreshInterval} ms`);

        emitSpecialLog(infoLines.join('\n\t\t\t\t\t\t'));
    }

    function OnBlockchainSynced(syncedCallback: any) {
        const checkSynced = function (displayNotSynced?: any) {
            _this.daemon.cmd(
                'getblocktemplate',
                GetBlockTemplateParameters(),
                function (results: any) {
                    // -10 = still downloading blockchain, -9 = daemon has no
                    // peer connections yet; both are transient, keep waiting
                    const synced = results.every(function (r: any) {
                        return !r.error || (r.error.code !== -10 && r.error.code !== -9);
                    });
                    if (synced) {
                        syncedCallback();
                    } else {
                        if (displayNotSynced) displayNotSynced();
                        setTimeout(checkSynced, 5000);

                        //Only let the first fork show synced status or the log wil look flooded with it
                        if (!process.env.forkId || process.env.forkId === '0') generateProgress();
                    }
                }
            );
        };
        checkSynced(function () {
            //Only let the first fork show synced status or the log wil look flooded with it
            if (!process.env.forkId || process.env.forkId === '0')
                emitErrorLog(
                    'Daemon is still syncing with network (download blockchain) - server will be started once synced'
                );
        });

        const generateProgress = function () {
            _this.daemon.cmd(
                options.coin.getInfo ? 'getinfo' : 'getblockchaininfo',
                [],
                function (results: any) {
                    const blockCount = results.sort(function (a: any, b: any) {
                        return b.response.blocks - a.response.blocks;
                    })[0].response.blocks;

                    //get list of peers and their highest block height to compare to ours
                    _this.daemon.cmd('getpeerinfo', [], function (results: any) {
                        const peers = results[0].response;
                        if (!Array.isArray(peers) || peers.length === 0) {
                            emitWarningLog(
                                'Waiting for daemon to find peer connections - 0 peers connected'
                            );
                            return;
                        }
                        const totalBlocks = peers.sort(function (a: any, b: any) {
                            return b.startingheight - a.startingheight;
                        })[0].startingheight;

                        const percent = ((blockCount / totalBlocks) * 100).toFixed(2);
                        emitWarningLog(
                            `Downloaded ${percent}% of blockchain from ${peers.length} peers`
                        );
                    });
                }
            );
        };
    }

    function SetupApi() {
        if (typeof options.api !== 'object' || typeof options.api.start !== 'function') {
            return;
        } else {
            options.api.start(_this);
        }
    }

    function SetupPeer() {
        if (!options.p2p || !options.p2p.enabled) return;

        if (options.testnet && !options.coin.peerMagicTestnet) {
            emitErrorLog(
                'p2p cannot be enabled in testnet without peerMagicTestnet set in coin configuration'
            );
            return;
        } else if (!options.coin.peerMagic) {
            emitErrorLog('p2p cannot be enabled without peerMagic set in coin configuration');
            return;
        }

        _this.peer = new (peer as any)(options);
        _this.peer
            .on('connected', function () {
                emitLog('p2p connection successful');
            })
            .on('connectionRejected', function () {
                emitErrorLog('p2p connection failed - likely incorrect p2p magic value');
            })
            .on('disconnected', function () {
                emitWarningLog('p2p peer node disconnected - attempting reconnection...');
            })
            .on('connectionFailed', function (error: any) {
                const errorMessage =
                    (error && error.message) || String(error) || 'Unknown connection error';
                emitErrorLog(`p2p connection failed: ${errorMessage}`);
            })
            .on('socketError', function (err: any) {
                // Safe JSON stringify to avoid circular reference errors
                let errorMessage;
                try {
                    errorMessage = JSON.stringify(err);
                } catch {
                    errorMessage = err.message || err.toString() || 'Unknown socket error';
                }
                emitErrorLog(`p2p had a socket error ${errorMessage}`);
            })
            .on('error', function (msg: any) {
                emitWarningLog(`p2p had an error ${msg}`);
            })
            .on('blockFound', function (hash: any) {
                _this.processBlockNotify(hash, 'p2p');
            });
    }

    function SetupVarDiff() {
        _this.varDiff = {};
        Object.keys(options.ports).forEach(function (port) {
            if (options.ports[port].varDiff) _this.setVarDiff(port, options.ports[port].varDiff);
        });
    }

    /*
    Coin daemons either use submitblock or getblocktemplate for submitting new blocks
     */
    function SubmitBlock(blockHex: any, callback: any) {
        let rpcCommand, rpcArgs;
        if (options.hasSubmitMethod) {
            rpcCommand = 'submitblock';
            rpcArgs = [blockHex];
        } else {
            rpcCommand = 'getblocktemplate';
            rpcArgs = [{ mode: 'submit', data: blockHex }];
        }

        if (_this.newAddressOnNewBlock) {
            _this.daemon.cmd('getnewaddress', [], function (results: any) {
                options.poolAddressScript = (function () {
                    return util.addressToScript(options.network, results[0].response);
                })();

                options.address = results[0].response;
            });
        }

        _this.daemon.cmd(rpcCommand, rpcArgs, function (results: any) {
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.error) {
                    emitErrorLog(
                        `rpc error with daemon instance ${
                            result.instance.index
                        } when submitting block with ${rpcCommand} ${JSON.stringify(result.error)}`
                    );
                    return;
                } else if (result.response) {
                    // submitblock / getblocktemplate(submit) return null when the
                    // block is accepted and a BIP22 reason string otherwise (e.g.
                    // "rejected", "high-hash", "duplicate", "bad-txnmrklroot").
                    // Surface the actual reason instead of silently treating any
                    // non-"rejected" response as a successful submission.
                    emitErrorLog(
                        `Daemon instance ${result.instance.index} rejected a supposedly valid block with ${rpcCommand}: ${JSON.stringify(
                            result.response
                        )}`
                    );
                    return;
                }
            }
            emitLog(`Submitted Block using ${rpcCommand} successfully to daemon instance(s)`);
            callback();
        });
    }

    function SetupRecipients() {
        const recipients = [];
        options.feePercent = 0;
        options.rewardRecipients = options.rewardRecipients || {};
        for (const r in options.rewardRecipients) {
            const percent = options.rewardRecipients[r];
            const rObj: any = {
                percent: percent / 100,
            };
            try {
                if (options.coin.name === 'koto' || options.coin.name === 'koto_testnet') {
                    rObj.script = util.kotoAddressToScript(r);
                } else if (r.length === 40) {
                    rObj.script = util.miningKeyToScript(r);
                } else {
                    rObj.script = util.addressToScript(options.network, r);
                }
                recipients.push(rObj);
                options.feePercent += percent;
            } catch {
                emitErrorLog(
                    `Error generating transaction output script for ${r} in rewardRecipients`
                );
            }
        }
        if (recipients.length === 0) {
            emitErrorLog('No rewardRecipients have been setup which means no fees will be taken');
        }
        options.recipients = recipients;
    }

    function SetupJobManager() {
        _this.jobManager = new (jobManager as any)(options);

        _this.jobManager
            .on('newBlock', function (blockTemplate: any) {
                //Check if stratumServer has been initialized yet
                if (_this.stratumServer) {
                    _this.stratumServer.broadcastMiningJobs(
                        blockTemplate.getJobParams(),
                        blockTemplate.getOdoKey()
                    );
                }
            })
            .on('updatedBlock', function (blockTemplate: any) {
                //Check if stratumServer has been initialized yet
                if (_this.stratumServer) {
                    const job = blockTemplate.getJobParams();
                    job[8] = false;
                    _this.stratumServer.broadcastMiningJobs(job, blockTemplate.getOdoKey());
                }
            })
            .on('share', function (shareData: any, blockHex: any) {
                const isValidShare = !shareData.error;
                let isValidBlock = !!blockHex;
                const emitShare = function () {
                    _this.emit('share', isValidShare, isValidBlock, shareData);
                };

                /*
            If we calculated that the block solution was found,
            before we emit the share, lets submit the block,
            then check if it was accepted using RPC getblock
            */
                if (!isValidBlock) emitShare();
                else {
                    SubmitBlock(blockHex, function () {
                        CheckBlockAccepted(
                            shareData.blockHash,
                            function (isAccepted: any, tx: any) {
                                isValidBlock = isAccepted;
                                shareData.txHash = tx;
                                emitShare();

                                GetBlockTemplate(function (
                                    error: any,
                                    result: any,
                                    foundNewBlock: any
                                ) {
                                    if (foundNewBlock)
                                        emitLog(
                                            'Block notification via RPC after block submission'
                                        );
                                });
                            }
                        );
                    });
                }
            })
            .on('log', function (severity: any, message: any) {
                _this.emit('log', severity, message);
            });
    }

    function SetupDaemonInterface(finishedCallback: any) {
        if (!Array.isArray(options.daemons) || options.daemons.length < 1) {
            emitErrorLog('No daemons have been configured - pool cannot start');
            return;
        }

        // daemon.js picks its online-check RPC method (getnetworkinfo vs
        // getinfo for old wallets) from a flag on each daemon instance, but
        // the flag lives in the coin definition - copy it over
        const daemonConfigs = options.daemons.map(function (daemonConfig: any) {
            return Object.assign({ noNetworkInfo: !!options.coin.noNetworkInfo }, daemonConfig);
        });

        _this.daemon = new (daemon as any).interface(daemonConfigs, function (
            severity: any,
            message: any
        ) {
            _this.emit('log', severity, message);
        });

        _this.daemon
            .once('online', function () {
                if (options.address == false) {
                    _this.daemon.cmd('getnewaddress', [], function (results: any) {
                        options.address = results[0].response;
                        finishedCallback();
                    });
                }
                finishedCallback();
            })
            .on('connectionFailed', function (results: any) {
                // results is the per-instance array from the online check;
                // report which daemon failed and why
                const failures = (Array.isArray(results) ? results : [results])
                    .filter(function (r: any) {
                        return r && r.error;
                    })
                    .map(function (r: any) {
                        const where = r.instance
                            ? `${r.instance.host}:${r.instance.port}`
                            : 'daemon';
                        let detail;
                        try {
                            detail = r.error.message || JSON.stringify(r.error);
                        } catch {
                            detail = String(r.error);
                        }
                        return `${where} - ${detail}`;
                    })
                    .join('; ');
                emitErrorLog(`Failed to connect daemon(s): ${failures || 'unknown error'}`);
            })
            .on('error', function (message: any) {
                emitErrorLog(message);
            });

        _this.daemon.init();
    }

    function DetectCoinData(finishedCallback: any) {
        const batchRpcCalls: any[] = [
            ['validateaddress', [options.address]],
            ['getdifficulty', []],
        ];

        if (options.coin.noNetworkInfo) {
            if (!options.coin.getInfo) {
                batchRpcCalls.push(['getinfo', []]);
            }
        } else {
            batchRpcCalls.push(['getnetworkinfo', []]);
        }

        batchRpcCalls.push(
            [options.coin.getInfo ? 'getinfo' : 'getmininginfo', []],
            [
                options.coin.noGetnetworkhashps
                    ? 'getmininginfo'
                    : options.coin.getAllNetworkHashPS
                      ? 'getallnetworkhashps'
                      : options.coin.getNetworkGHPS
                        ? 'getnetworkghps'
                        : options.coin.getNetworkGHPS
                          ? 'getnetworkghps'
                          : 'getnetworkhashps',
                [],
            ],
            ['submitblock', []]
        );

        _this.daemon.batchCmd(batchRpcCalls, function (error: any, results: any) {
            if (error || !results) {
                emitErrorLog(
                    `Could not start pool, error with init batch RPC call: ${JSON.stringify(error)}`
                );
                return;
            }

            const rpcResults: any = {};

            for (let i = 0; i < results.length; i++) {
                const rpcCall = batchRpcCalls[i][0];
                const r = results[i];
                rpcResults[rpcCall] = r.result || r.error;

                if (rpcCall !== 'submitblock' && (r.error || !r.result)) {
                    emitErrorLog(
                        `Could not start pool, error with init RPC ${rpcCall} - ${JSON.stringify(r.error)}`
                    );
                    return;
                }
            }

            if (options.coin.noNetworkInfo) {
                rpcResults.getnetworkinfo = rpcResults.getinfo;
            }

            if (!rpcResults.validateaddress.isvalid) {
                emitErrorLog('Daemon reports address is not valid');
                return;
            }

            if (!options.coin.reward) {
                if (isNaN(rpcResults.getdifficulty) && 'proof-of-stake' in rpcResults.getdifficulty)
                    options.coin.reward = 'POS';
                else options.coin.reward = 'POW';
            }

            /* POS coins must use the pubkey in coinbase transaction, and pubkey is
               only given if address is owned by wallet.*/
            if (
                options.coin.reward === 'POS' &&
                typeof rpcResults.validateaddress.pubkey == 'undefined'
            ) {
                emitErrorLog(
                    'The address provided is not from the daemon wallet - this is required for POS coins.'
                );
                return;
            }

            options.testnet = options.coin.getInfo
                ? rpcResults.getinfo.testnet
                : rpcResults.getmininginfo.chain == 'test'
                  ? true
                  : false;

            options.network = options.testnet ? options.coin.testnet : options.coin.mainnet;

            options.poolAddressScript = (function () {
                if (options.coin.name === 'koto' || options.coin.name === 'koto_testnet') {
                    return util.kotoAddressToScript(rpcResults.validateaddress.address);
                } else {
                    switch (options.coin.reward) {
                        case 'POS':
                            return util.pubkeyToScript(rpcResults.validateaddress.pubkey);
                        case 'POW':
                            return util.addressToScript(
                                options.network,
                                rpcResults.validateaddress.address
                            );
                    }
                }
            })();

            options.protocolVersion = options.coin.getInfo
                ? rpcResults.getinfo.protocolversion
                : rpcResults.getnetworkinfo.protocolversion;

            const multiAlgoDifficultyKey = `difficulty_${options.coin.passAlgorithm && options.coin.passAlgorithm !== true ? options.coin.passAlgorithm : options.coin.algorithm}`;
            options.initStats = {
                connections: rpcResults.getnetworkinfo.connections,
                difficulty:
                    (options.coin.getInfo
                        ? typeof rpcResults.getinfo[multiAlgoDifficultyKey] !== 'undefined'
                            ? rpcResults.getinfo[multiAlgoDifficultyKey]
                            : typeof rpcResults.getinfo.difficulty == 'object'
                              ? rpcResults.getinfo.difficulty['proof-of-work']
                              : rpcResults.getinfo.difficulty
                        : typeof rpcResults.getmininginfo[multiAlgoDifficultyKey] !== 'undefined'
                          ? rpcResults.getmininginfo[multiAlgoDifficultyKey]
                          : typeof rpcResults.getmininginfo.difficulty == 'object'
                            ? rpcResults.getmininginfo.difficulty['proof-of-work']
                            : rpcResults.getmininginfo.difficulty) *
                    algos[options.coin.algorithm].multiplier,
                networkHashRate: options.coin.noGetnetworkhashps
                    ? rpcResults.getmininginfo.networkhashps
                    : [
                          options.coin.getAllNetworkHashPS
                              ? rpcResults.getallnetworkhashps[
                                    options.coin.passAlgorithmKey
                                        ? options.coin.passAlgorithmKey !== true
                                            ? options.coin.passAlgorithmKey
                                            : options.coin.algorithm
                                        : options.coin.passAlgorithm &&
                                            options.coin.passAlgorithm !== true
                                          ? options.coin.passAlgorithm
                                          : options.coin.algorithm
                                ]
                              : options.coin.getNetworkGHPS
                                ? rpcResults.getnetworkghps * Math.pow(1024, 3)
                                : rpcResults.getnetworkhashps,
                      ],
            };

            if (rpcResults.submitblock.message === 'Method not found') {
                options.hasSubmitMethod = false;
            } else if (rpcResults.submitblock.code === -1) {
                options.hasSubmitMethod = true;
            } else {
                emitErrorLog(
                    `Could not detect block submission RPC method, ${JSON.stringify(results)}`
                );
                return;
            }

            finishedCallback();
        });
    }

    function StartStratumServer(finishedCallback: any) {
        _this.stratumServer = new (Server as any)(options, authorizeFn);

        _this.stratumServer
            .on('started', function () {
                options.initStats.stratumPorts = Object.keys(options.ports);
                _this.stratumServer.broadcastMiningJobs(
                    _this.jobManager.currentJob.getJobParams(),
                    _this.jobManager.currentJob.getOdoKey()
                );
                finishedCallback();
            })
            .on('broadcastTimeout', function () {
                emitLog(
                    `No new blocks for ${options.jobRebroadcastTimeout} seconds - updating transactions & rebroadcasting work`
                );

                GetBlockTemplate(function (error: any, rpcData: any, processedBlock: any) {
                    if (error || processedBlock) return;
                    _this.jobManager.updateCurrentJob(rpcData);
                });
            })
            .on('client.connected', function (client: any) {
                client
                    .on('difficultyChanged', function (diff: any) {
                        _this.emit('difficultyUpdate', client.workerName, diff);
                    })
                    .on('subscription', function (this: any, params: any, resultCallback: any) {
                        if (
                            !client.varDiff &&
                            typeof _this.varDiff[client.socket.localPort] !== 'undefined'
                        ) {
                            _this.varDiff[client.socket.localPort].manageClient(client);
                        }
                        const extraNonce = _this.jobManager.extraNonceCounter.next();
                        const extraNonce2Size = _this.jobManager.extraNonce2Size;
                        resultCallback(null, extraNonce, extraNonce2Size);

                        if (client.initialDifficulty > 0) {
                            this.sendDifficulty(client.initialDifficulty);
                        } else if (
                            typeof options.ports[client.socket.localPort] !== 'undefined' &&
                            options.ports[client.socket.localPort].diff
                        ) {
                            this.sendDifficulty(options.ports[client.socket.localPort].diff);
                        } else {
                            this.sendDifficulty(8);
                        }

                        this.sendMiningJob(
                            _this.jobManager.currentJob.getJobParams(),
                            _this.jobManager.currentJob.getOdoKey()
                        );
                    })
                    .on('submit', function (params: any, resultCallback: any) {
                        const result = _this.jobManager.processShare(
                            params.jobId,
                            client.previousDifficulty,
                            client.difficulty,
                            client.extraNonce1,
                            params.extraNonce2,
                            params.nTime,
                            params.nonce,
                            client.remoteAddress,
                            client.socket.localPort,
                            params.name,
                            params.versionMask,
                            client.isSoloMining
                        );
                        resultCallback(result.error, result.result ? true : null);
                    })
                    .on('malformedMessage', function (message: any) {
                        emitWarningLog(`Malformed message from ${client.getLabel()}: ${message}`);
                    })
                    .on('socketError', function (err: any) {
                        // Safe JSON stringify to avoid circular reference errors
                        let errorMessage;
                        try {
                            errorMessage = JSON.stringify(err);
                        } catch {
                            errorMessage = err.message || err.toString() || 'Unknown socket error';
                        }
                        emitWarningLog(`Socket error from ${client.getLabel()}: ${errorMessage}`);
                    })
                    .on('socketTimeout', function (reason: any) {
                        emitWarningLog(`Connected timed out for ${client.getLabel()}: ${reason}`);
                    })
                    .on('socketDisconnect', function () {
                        emitLog(`Socket disconnected from ${client.getLabel()}`);
                    })
                    .on('kickedBannedIP', function (remainingBanTime: any) {
                        emitLog(
                            `Rejected incoming connection from ${client.remoteAddress} banned for ${remainingBanTime} more seconds`
                        );
                    })
                    .on('forgaveBannedIP', function () {
                        emitLog(`Forgave banned IP ${client.remoteAddress}`);
                    })
                    .on('unknownStratumMethod', function (fullMessage: any) {
                        emitLog(
                            `Unknown stratum method from ${client.getLabel()}: ${fullMessage.method}`
                        );
                    })
                    .on('socketFlooded', function () {
                        emitWarningLog(`Detected socket flooding from ${client.getLabel()}`);
                    })
                    .on('tcpProxyError', function (data: any) {
                        emitErrorLog(
                            `Client IP detection failed, tcpProxyProtocol is enabled yet did not receive proxy protocol message, instead got data: ${data}`
                        );
                    })
                    .on('bootedBannedWorker', function () {
                        emitWarningLog(
                            `Booted worker ${client.getLabel()} who was connected from an IP address that was just banned`
                        );
                    })
                    .on('triggerBan', function (reason: any) {
                        emitWarningLog(`Banned triggered for ${client.getLabel()}: ${reason}`);
                        _this.emit('banIP', client.remoteAddress, client.workerName);
                    });
            });
    }

    function SetupBlockPolling() {
        if (typeof options.blockRefreshInterval !== 'number' || options.blockRefreshInterval <= 0) {
            emitLog('Block template polling has been disabled');
            return;
        }

        GetBlockTemplate(function (error: any, _result: any, foundNewBlock: any) {
            if (foundNewBlock) emitLog('Block notification via RPC polling');
        });
    }

    function GetBlockTemplate(callback: any) {
        _this.daemon.cmd(
            'getblocktemplate',
            GetBlockTemplateParameters(),
            function (result: any) {
                if (result.error) {
                    emitErrorLog(
                        `getblocktemplate call failed for daemon instance ${
                            result.instance.index
                        } with error ${JSON.stringify(result.error)}`
                    );
                    callback(result.error);
                } else {
                    const processedNewBlock = _this.jobManager.processTemplate(result.response);
                    callback(null, result.response, processedNewBlock);
                    callback = function () {};
                }
            },
            true
        );
    }

    function CheckBlockAccepted(blockHash: any, callback: any) {
        //setTimeout(function(){
        _this.daemon.cmd('getblock', [blockHash], function (results: any) {
            const validResults = results.filter(function (result: any) {
                return result.response && result.response.hash === blockHash;
            });

            if (validResults.length >= 1) {
                callback(true, validResults[0].response.tx[0]);
            } else {
                callback(false);
            }
        });
        //}, 500);
    }

    /**
     * This method is being called from the blockNotify so that when a new block is discovered by the daemon
     * We can inform our miners about the newly found block
     **/
    this.processBlockNotify = function (blockHash: any, sourceTrigger: any) {
        emitLog(`Block notification via ${sourceTrigger}`);
        if (
            typeof _this.jobManager.currentJob !== 'undefined' &&
            blockHash !== _this.jobManager.currentJob.rpcData.previousblockhash
        ) {
            GetBlockTemplate(function (error: any, _result: any) {
                if (error)
                    emitErrorLog(
                        `Block notify error getting block template for ${options.coin.name}`
                    );
            });
        }
    };

    this.relinquishMiners = function (this: any, filterFn: any, resultCback: any) {
        const origStratumClients = this.stratumServer.getStratumClients();

        const stratumClients: any[] = [];
        Object.keys(origStratumClients).forEach(function (subId) {
            stratumClients.push({ subId, client: origStratumClients[subId] });
        });
        async.filter(stratumClients, filterFn, function (clientsToRelinquish: any) {
            clientsToRelinquish.forEach(function (cObj: any) {
                cObj.client.removeAllListeners();
                _this.stratumServer.removeStratumClientBySubId(cObj.subId);
            });

            process.nextTick(function () {
                resultCback(
                    clientsToRelinquish.map(function (item: any) {
                        return item.client;
                    })
                );
            });
        });
    };

    this.attachMiners = function (miners: any) {
        miners.forEach(function (clientObj: any) {
            _this.stratumServer.manuallyAddStratumClient(clientObj);
        });
        _this.stratumServer.broadcastMiningJobs(
            _this.jobManager.currentJob.getJobParams(),
            _this.jobManager.currentJob.getOdoKey()
        );
    };

    this.getStratumServer = function () {
        return _this.stratumServer;
    };

    this.setVarDiff = function (port: any, varDiffConfig: any) {
        if (typeof _this.varDiff[port] != 'undefined') {
            _this.varDiff[port].removeAllListeners();
        }
        const varDiffInstance = new (varDiff as any)(port, varDiffConfig);
        _this.varDiff[port] = varDiffInstance;
        _this.varDiff[port].on('newDifficulty', function (client: any, newDiff: any) {
            /* We request to set the newDiff @ the next difficulty retarget
             (which should happen when a new job comes in - AKA BLOCK) */
            client.enqueueNextDifficulty(newDiff);

            /*if (options.varDiff.mode === 'fast'){
                 //Send new difficulty, then force miner to use new diff by resending the
                 //current job parameters but with the "clean jobs" flag set to false
                 //so the miner doesn't restart work and submit duplicate shares
                client.sendDifficulty(newDiff);
                var job = _this.jobManager.currentJob.getJobParams();
                job[8] = false;
                client.sendMiningJob(job);
            }*/
        });
    };
} as any;
Object.setPrototypeOf(pool.prototype, events.EventEmitter.prototype);

export default pool;
