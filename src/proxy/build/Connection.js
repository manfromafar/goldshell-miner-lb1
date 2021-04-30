"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter = require("events");
var Protocol = require('../../protocol/protocol');
var uuid = require("uuid");
var Queue_1 = require("./Queue");
// var Metrics_1 = require("./Metrics");
const COMP = '[Connect]';
const Debug = require('../../log')();
var Connection = /** @class */ (function (_super) {
    __extends(Connection, _super);
    function Connection(options) {
        var _this = _super.call(this) || this;
        _this.id = uuid.v4();
        _this.host = null;
        _this.port = null;
        _this.ssl = null;
        _this.online = null;
        _this.queue = null;
        _this.protocolname = null;
        _this.user = null;
        _this.pass = null;
        _this.Reconnect = true;
        _this.buffer = "";
        _this.rpcId = 1;
        _this.rpc = {};
        _this.auth = {};
        _this.minerId = {};
        _this.miners = [];
        _this.host = options.host;
        _this.port = options.port;
        _this.ssl = options.ssl;
        _this.user = options.user;
        _this.pass = options.pass;
        _this.cryptoname = options.cryptoname;
        _this.protocolname = options.protocolname ? options.protocolname : 'jsonrpc';
        _this.Protocol = Protocol({ name: _this.protocolname, cryptoname: _this.cryptoname });
        return _this;
    }
    Connection.prototype.connect = function () {
        var _this = this;
        if (this.online) {
            this.kill();
        }
        this.queue = new Queue_1.default();
        this.Protocol.init(_this.ssl, _this.host, _this.port);
        this.Protocol.on("connect", function () {
            _this.ready();
        });

        this.Protocol.on("error", function (error) {
            if (_this.online) {
                Debug.IbctLogErr(COMP, "Protocol error (" + _this.host + ":" + _this.port + ")", error.message);
                _this.emit("error", error);
                // exit protocol
                _this.Protocol.kill();
                _this.Protocol.removeAllListeners("connect");
                _this.Protocol.removeAllListeners("error");
                _this.Protocol.removeAllListeners("close");
                _this.Protocol.removeAllListeners("data");
                _this.Protocol.removeAllListeners();
            }
        });
        this.Protocol.on("close", function () {
            if (_this.online) {
                Debug.IbctLogDbg(COMP, "Protocol closed (" + _this.host + ":" + _this.port + ")");
                _this.emit("close");
            }
        });
        this.online = true;
    };
    Connection.prototype.setReconnect = function (flags) {
        this.Reconnect = flags;
    }
    Connection.prototype.kill = function () {
        this.Protocol.kill();
        this.Protocol.removeAllListeners();

        if (this.queue != null) {
            this.queue.stop();
            this.queue.removeAllListeners();
        }
        if (this.online) {
            this.online = false;
            this.removeAllListeners()
        }
    };
    Connection.prototype.ready = function () {
        var _this = this;
        // message from pool
        this.Protocol.getPacket();
        this.Protocol.on("data", function (message) {
            if (_this.protocolname === 'jsonrpc') {
                _this.receive(message);
            } else {
                _this.stratum_receive(message);
            }
        });
        // message from miner
        this.queue.on("message", function (message) {
            if (!_this.online) {
                return false;
            }
            if (!_this.Protocol.isWritable()) {
                if (message.method === "keepalived") {
                    return false;
                }
                var retry = message.retry ? message.retry * 2 : 1;
                var ms = retry * 100;
                message.retry = retry;
                setTimeout(function () {
                    _this.queue.push({
                        type: "message",
                        payload: message
                    });
                }, ms);
                return false;
            }
            try {
                if (message.retry) {
                    delete message.retry;
                }
                _this.Protocol.sendPacket(message);
            }
            catch (e) {
                Debug.IbctLogErr(COMP, "failed to send message to pool (" + _this.host + ":" + _this.port + "): " + JSON.stringify(message));
            }
        });
        // kick it
        this.queue.start();
        this.emit("ready");
    };
    Connection.prototype.stratum_receive = function (message) {
        // it's a response
        Debug.IbctLogInfo(COMP, 'stratum_receive: ', JSON.stringify(message));
        if (message.id) {
            var response = message;
            if (!this.rpc[response.id]) {
                if(response.result && response.result.subscribe){
                    var subinfo = response.result;
                    var minerId = this.minerId[subinfo.id];
                    if (!minerId) {
                        // miner is not online anymore
                        return;
                    }
                    this.emit(minerId + ":subscribe", subinfo.subscribe);
                }
                // miner is not online anymore
                return;
            }
            var minerId = this.rpc[response.id].minerId;
            var method = this.rpc[response.id].message.method;
            switch (method) {
                case "login": {
                    if (response.error && response.error.code === -1) {
                        this.emit(minerId + ":error", {
                            error: "invalid_site_key"
                        });
                        return;
                    } else if (response.error) {
                        this.emit(minerId + ":error", {
                            error: response.error[1]
                        });
                        return;
                    }
                    var result = response.result;
                    var auth = result.id;
                    this.auth[minerId] = auth;
                    this.minerId[auth] = minerId;
                    this.emit(minerId + ":authed", auth);
                    if (result.job) {
                        this.emit(minerId + ":job", result.job);
                    }
                    break;
                }
                case "submit": {
                    var job = this.rpc[response.id].message.params;
                    if (response.result === true || response.result === 'true') {
                        this.emit(minerId + ":accepted", job);
                    } else if (response.error) {
                        this.emit(minerId + ":rejected", job, response.error);
                    } else {
                        this.emit(minerId + ":rejected", job, 'Submit Error');
                    }
                    
                    break;
                }
                default: {
                    if (response.error && response.error.code === -1) {
                        this.emit(minerId + ":error", response.error);
                    }
                }
            }
            delete this.rpc[response.id];
        }
        else {
            // it's a request
            var request = message;
            if (request.error) {
                this.emit(minerId + ":error", response.error);
                return;
            }
            if (request.result && request.result.job) {
                var jobParams = request.result;
                var minerId = this.minerId[jobParams.id];
                if (!minerId) {
                    // miner is not online anymore
                    return;
                }
                this.emit(minerId + ":job", jobParams.job);
            }
            if(request.result && request.result.subscribe){
                var subinfo = request.result;
                var minerId = this.minerId[subinfo.id];
                if (!minerId) {
                    // miner is not online anymore
                    return;
                }
               
                this.emit(minerId + ":subscribe", subinfo.subscribe);
            }
            if(request.result && request.result.diff){
                var diffinfo = request.result;
                var minerId = this.minerId[diffinfo.id];
                if (!minerId) {
                    // miner is not online anymore
                    Debug.IbctLogDbg(COMP, 'diff but no minerID.....');
                    return;
                }    
                this.emit(minerId + ":diff", diffinfo.diff);
            }
        }
    };
    Connection.prototype.receive = function (message) {
        var data = null;
        try {
            data = JSON.parse(message);
        }
        catch (e) {
            return Debug.IbctLogErr(COMP, "invalid stratum message:", message);
        }
        // it's a response
        Debug.IbctLogInfo(COMP, 'receive: ', JSON.stringify(data));
        if (data.id) {
            var response = data;
            if (!this.rpc[response.id]) {
                // miner is not online anymore
                return;
            }
            var minerId = this.rpc[response.id].minerId;
            var method = this.rpc[response.id].message.method;
            switch (method) {
                case "login": {
                    if (response.error && response.error.code === -1) {
                        this.emit(minerId + ":error", {
                            error: "invalid_site_key"
                        });
                        return;
                    } else if (response.error) {
                        this.emit(minerId + ":error", {
                            error: response.error.message
                        });
                        return;
                    }
                    var result = response.result;
                    var auth = result.id;
                    this.auth[minerId] = auth;
                    this.minerId[auth] = minerId;
                    this.emit(minerId + ":authed", auth);
                    if (result.job) {
                        this.emit(minerId + ":job", result.job);
                    }
                    break;
                }
                case "submit": {
                    var job = this.rpc[response.id].message.params;
                    if (response.result && response.result.status === "OK") {
                        this.emit(minerId + ":accepted", job);
                    }
                    else if (response.error) {
                        this.emit(minerId + ":rejected", job, response.error);
                    } else {
                        this.emit(minerId + ":rejected", job, 'Submit Error');
                    }
                    break;
                }
                default: {
                    if (response.error && response.error.code === -1) {
                        this.emit(minerId + ":error", response.error);
                    }
                }
            }
            delete this.rpc[response.id];
        }
        else {
            // it's a request
            var request = data;
            switch (request.method) {
                case "job": {
                    var jobParams = request.params;
                    var minerId = this.minerId[jobParams.id];
                    if (!minerId) {
                        // miner is not online anymore
                        return;
                    }
                    this.emit(minerId + ":job", request.params);
                    break;
                }
            }
        }
    };
    Connection.prototype.send = function (id, method, params) {
        if (params === void 0) { params = {}; }
        var message = {
            id: this.rpcId++,
            method: method,
            params: params
        };
        switch (method) {
            case "login": {
                // ..
                break;
            }
            case "keepalived": {
                if (this.auth[id]) {
                    var keepAliveParams = message.params;
                    keepAliveParams.id = this.auth[id];
                }
                else {
                    return false;
                }
            }
            case "submit": {
                if (this.auth[id]) {
                    var submitParams = message.params;
                    submitParams.id = this.auth[id];
                }
                else {
                    Debug.IbctLogErr('Submit Err: Maybe have killed');
                    return false;
                }
            }
        }
        this.rpc[message.id] = {
            minerId: id,
            message: message
        };
        this.queue.push({
            type: "message",
            payload: message
        });
    };
    Connection.prototype.addMiner = function (miner) {
        if (this.miners.indexOf(miner) === -1) {
            this.miners.push(miner);
        }
    };
    Connection.prototype.removeMiner = function (minerId) {
        var miner = this.miners.find(function (x) { return x.id === minerId; });
        if (miner) {
            this.miners = this.miners.filter(function (x) { return x.id !== minerId; });
            this.clear(miner.id);
        }
    };
    Connection.prototype.clear = function (id) {
        var _this = this;
        var auth = this.auth[id];
        delete this.auth[id];
        delete this.minerId[auth];
        Object.keys(this.rpc).forEach(function (key) {
            if (_this.rpc[key].minerId === id) {
                delete _this.rpc[key];
            }
        });
    };
    return Connection;
}(EventEmitter));
exports.default = Connection;
