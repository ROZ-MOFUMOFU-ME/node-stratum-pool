import http from 'http';
import events from 'events';
import async from 'async';

/**
 * The daemon interface interacts with the coin daemon by using the rpc interface.
 * in order to make it work it needs, as constructor, an array of objects containing
 * - 'host'    : hostname where the coin lives
 * - 'port'    : port where the coin accepts rpc connections
 * - 'user'    : username of the coin for the rpc interface
 * - 'password': password for the rpc interface of the coin
 **/

function DaemonInterface(this: any, daemons: any, logger: any) {
    //private members
    const _this = this;
    logger =
        logger ||
        function (severity: any, message: any) {
            console.log(`${severity}: ${message}`);
        };

    const instances = (function () {
        for (let i = 0; i < daemons.length; i++) {
            daemons[i]['index'] = i;
            if (daemons[i].maxSockets)
                daemons[i].myagent = (http.Agent as any)({
                    maxSockets: daemons[i].maxSockets,
                    keepAlive: false,
                });
            else daemons[i].myagent = (http.Agent as any)({ maxSockets: 16, keepAlive: false });
        }
        return daemons;
    })();

    function init() {
        isOnline(function (online: any) {
            if (online) _this.emit('online');
        });
    }

    function isOnline(callback: any) {
        cmd('ISONLINEIMPL', [], function (results: any) {
            const allOnline = results.every(function (_result: any) {
                return !_result.error;
            });
            callback(allOnline);
            if (!allOnline) _this.emit('connectionFailed', results);
        });
    }

    function performHttpRequest(instance: any, jsonData: any, callback: any) {
        const options = {
            hostname: typeof instance.host === 'undefined' ? '127.0.0.1' : instance.host,
            port: instance.port,
            method: 'POST',
            auth: `${instance.user}:${instance.password}`,
            headers: {
                'Content-Length': jsonData.length,
            },
            agent: instance.myagent,
        };

        const parseJson = function (res: any, data: any) {
            let dataJson;

            if (res.statusCode === 401) {
                logger('error', 'Unauthorized RPC access - invalid RPC username or password');
                return;
            }

            try {
                dataJson = JSON.parse(data);
            } catch {
                if (data.indexOf(':-nan') !== -1) {
                    data = data.replace(/:-nan,/g, ':0');
                    parseJson(res, data);
                    return;
                }
                logger(
                    'error',
                    `Could not parse rpc data from daemon instance  ${
                        instance.index
                    }\nRequest Data: ${jsonData}\nReponse Data: ${data}`
                );
            }
            if (dataJson) callback(dataJson.error, dataJson, data);
        };

        const req = http.request(options, function (res: any) {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk: any) {
                data += chunk;
            });
            res.on('end', function () {
                parseJson(res, data);
            });
        });

        req.on('error', function (e: any) {
            if (e.code === 'ECONNREFUSED') callback({ type: 'offline', message: e.message }, null);
            else callback({ type: 'request error', message: e.message }, null);
        });

        req.end(jsonData);
    }

    //Performs a batch JSON-RPC command - only uses the first configured rpc daemon
    /* First argument must have:
     [
         [ methodName, [params] ],
         [ methodName, [params] ]
     ]
     */

    function batchCmd(cmdArray: any, callback: any) {
        const requestJson = [];

        for (let i = 0; i < cmdArray.length; i++) {
            requestJson.push({
                method: cmdArray[i][0],
                params: cmdArray[i][1],
                id: Date.now() + Math.floor(Math.random() * 10) + i,
            });
        }

        const serializedRequest = JSON.stringify(requestJson);

        performHttpRequest(instances[0], serializedRequest, function (error: any, result: any) {
            callback(error, result);
        });
    }

    /* Sends a JSON RPC (http://json-rpc.org/wiki/specification) command to every configured daemon.
       The callback function is fired once with the result from each daemon unless streamResults is
       set to true. */
    function cmd(
        method: any,
        params: any,
        callback: any,
        streamResults?: any,
        returnRawData?: any
    ) {
        const results: any[] = [];

        async.each(
            instances,
            function (instance: any, eachCallback: any) {
                let itemFinished = function (error: any, result: any, data?: any) {
                    const returnObj: any = {
                        error,
                        response: (result || {}).result,
                        instance,
                    };
                    if (returnRawData) returnObj.data = data;
                    if (streamResults) callback(returnObj);
                    else results.push(returnObj);
                    eachCallback();
                    itemFinished = function () {};
                };

                if (method === 'ISONLINEIMPL') {
                    method = 'getnetworkinfo';
                }

                if (method === 'getnetworkinfo' && instance.noNetworkInfo) {
                    method = 'getinfo';
                }

                const requestJson = JSON.stringify({
                    method:
                        method !== 'getnetworkinfo'
                            ? method
                            : instance.noNetworkInfo
                              ? 'getinfo'
                              : method,
                    params,
                    id: Date.now() + Math.floor(Math.random() * 10),
                });

                performHttpRequest(
                    instance,
                    requestJson,
                    function (error: any, result: any, data: any) {
                        itemFinished(error, result, data);
                    }
                );
            },
            function () {
                if (!streamResults) {
                    callback(results);
                }
            }
        );
    }

    //public members

    this.init = init;
    this.isOnline = isOnline;
    this.cmd = cmd;
    this.batchCmd = batchCmd;
}

Object.setPrototypeOf((DaemonInterface as any).prototype, events.EventEmitter.prototype);

export default { interface: DaemonInterface };
