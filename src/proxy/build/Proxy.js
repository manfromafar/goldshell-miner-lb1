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
var defaults = require("../config/defaults");
var Connection_1 = require("./Connection");
var Miner_1 = require("./Miner");
const Debug = require('../../log')();
const COMP = '[Proxy]';
var Proxy = /** @class */ (function (_super) {
    __extends(Proxy, _super);
    function Proxy(constructorOptions) {
        if (constructorOptions === void 0) { constructorOptions = defaults; }
        var _this = _super.call(this) || this;
        _this.host = null;
        _this.port = null;
        _this.pass = null;
        _this.ssl = null;
        _this.address = null;
        _this.user = null;
        _this.maxMinersPerConnection = 100;
        _this.connections = {};
        _this.online = false;
        var options = Object.assign({}, defaults, constructorOptions);
        _this.host = options.host;
        _this.port = options.port;
        _this.pass = options.pass;
        _this.ssl = options.ssl;
        _this.protocolname = options.protocolname;
        _this.cryptoname = options.cryptoname;
        _this.address = options.address;
        _this.user = options.user;
        _this.maxMinersPerConnection = options.maxMinersPerConnection;
        _this.on("error", function (error) {
            /* prevent unhandled proxy errors from stopping the proxy */
            Debug.IbctLogErr(COMP, "proxy error:", error);
        });
    }
    Proxy.prototype.createProxy = function (id, queue) {
        var _this = this;
        if (this.online) {
            this.kill();
        }
        var connection = _this.getConnection(_this.host, _this.port);
        var miner = new Miner_1.default({
            protocolname: _this.protocolname,
            connection: connection,
            address: _this.address,
            user: _this.user,
            pass: _this.pass,
            minerQueue: queue,
            queueId: id
        });
        miner.on("open", function (data) { return _this.emit("open", data); });
        miner.on("authed", function (data) { return _this.emit("authed", data); });
        miner.on("job", function (data) {return _this.emit("job", data); });
        miner.on("diff", function (data) { return _this.emit("diff", data); });
        miner.on("subscribe", function (data) {return _this.emit("subscribe", data); });
        miner.on("found", function (data) { return _this.emit("found", data); });
        miner.on("accepted", function (data) { return _this.emit("accepted", data); });
        miner.on("rejected", function (data) { return _this.emit("rejected", data); });
        miner.on("close", function (data) { return _this.emit("close", data); });
        miner.on("error", function (data) { return _this.emit("error", data); });
        miner.connect();

        return miner;
    };
    Proxy.prototype.getConnection = function (host, port) {
        var _this = this;
        var connectionId = host + ":" + port;
        if (!this.connections[connectionId]) {
            this.connections[connectionId] = [];
        }
        var connections = this.connections[connectionId];
        var availableConnections = connections.filter(function (connection) { return _this.isAvailable(connection); });
        if (availableConnections.length === 0) {
            var connection = new Connection_1.default({ host: host, port: port, user: this.user, pass: this.pass, ssl: this.ssl, protocolname: this.protocolname, cryptoname: this.cryptoname });
            connection.connect();
            connection.on("close", function () {
                Debug.IbctLogDbg(COMP, "connection closed (" + connectionId + ")");
            });
            connection.on("error", function (error) {
                Debug.IbctLogErr(COMP, "connection error (" + connectionId + "):", error.message);
                _this.emit("error", error);
            });
            connections.push(connection);
            return connection;
        }
        return availableConnections.pop();
    };
    Proxy.prototype.isAvailable = function (connection) {
        return (connection.miners.length < this.maxMinersPerConnection);
    };
    Proxy.prototype.isEmpty = function (connection) {
        return connection.miners.length === 0;
    };
    Proxy.prototype.getStats = function () {
        var _this = this;
        return Object.keys(this.connections).reduce(function (stats, key) { return ({
            miners: stats.miners.concat(_this.connections[key].reduce(function (miners, connection) { return miners.concat(connection.miners.map(function (miner) { return ({
                id: miner.id,
                login: miner.login,
                hashes: miner.hashes
            }); })); }, [])),
            connections: stats.connections.concat(_this.connections[key].map(function (connection) { return ({
                id: connection.id,
                host: connection.host,
                port: connection.port,
                miners: connection.miners.length
            }); }))
        }); }, {
            miners: [],
            connections: []
        });
    };
    Proxy.prototype.kill = function () {
        var _this = this;

        Object.keys(this.connections).forEach(function (connectionId) {
            var connections = _this.connections[connectionId];
            connections.forEach(function (connection) {
                connection.setReconnect(false);
                connection.kill();
                connection.miners.forEach(function (miner) { return miner.kill(); });
            });
        });
        this.online = false;
        Debug.IbctLogDbg(COMP, "\uD83D\uDC80");
    };
    return Proxy;
}(EventEmitter));
exports.default = Proxy;
