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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter = require("events");
var uuid = require("uuid");
var Queue_1 = require("./Queue");
// var Metrics_1 = require("./Metrics");
const Debug = require('../../log')();
const COMP = '[Proxy Miner]';
var Miner = /** @class */ (function (_super) {
    __extends(Miner, _super);
    function Miner(options) {
        var _this = _super.call(this) || this;
        _this.id = uuid.v4();
        _this.login = null;
        _this.address = null;
        _this.user = null;
        _this.diff = null;
        _this.pass = null;
        _this.heartbeat = null;
        _this.connection = null;
        _this.minerQueue = null;
        _this.protocolname = null;
        _this.queue = new Queue_1.default();
        _this.online = false;
        _this.jobs = [];
        _this.hashes = 0;
        _this.rejected = 0;
        _this.connection = options.connection;
        _this.address = options.address;
        _this.user = options.user;
        _this.diff = options.diff;
        _this.pass = options.pass;
        _this.minerQueue = options.minerQueue;
        _this.queueId = options.queueId
        _this.protocolname = options.protocolname;
        return _this;
    }
    Miner.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        Debug.IbctLogDbg(COMP, "miner connected (" + this.id + ")");
                        // Metrics_1.minersCounter.inc();
                        this.connection.addMiner(this);
                        this.connection.on(this.id + ":authed", this.handleAuthed.bind(this));
                        this.connection.on(this.id + ":job", this.handleJob.bind(this));
                        this.connection.on(this.id + ":subscribe", this.handleSubscribe.bind(this));
                        this.connection.on(this.id + ":diff", this.handleSetdiff.bind(this));
                        this.connection.on(this.id + ":accepted", this.handleAccepted.bind(this));
                        this.connection.on(this.id + ":error", this.handleError.bind(this));
                        this.connection.on(this.id + ":rejected", this.handleRejected.bind(this));
                        this.queue.on("message", function (message) {
                            return _this.connection.send(_this.id, message.method, message.params);
                        });
                        if (this.protocolname === 'jsonrpc') {
                            this.heartbeat = setInterval(function () { return _this.connection.send(_this.id, "keepalived"); }, 30000);
                        }
                        this.online = true;
                        return [4 /*yield*/];
                    case 1:
                        _a.sent();
                        if (this.online) {
                            this.queue.start();
                            this.emit("open", {
                                id: this.id
                            });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    Miner.prototype.kill = function () {
        if (this.queue) {
            this.queue.stop();
            this.queue.removeAllListeners();
        }
        this.connection.removeMiner(this.id);
        this.connection.removeAllListeners(this.id + ":authed");
        this.connection.removeAllListeners(this.id + ":job");
        this.connection.removeAllListeners(this.id + ":accepted");
        this.connection.removeAllListeners(this.id + ":rejected");
        this.connection.removeAllListeners(this.id + ":error");
        this.jobs = [];
        this.hashes = 0;
        this.rejected = 0;
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
        }
        if (this.online) {
            this.online = false;
            // Metrics_1.minersCounter.dec();
            Debug.IbctLogDbg(COMP, "miner disconnected (" + this.id + ")");
            this.emit("close", {
                id: this.id,
                login: this.login
            });
        }
        this.removeAllListeners();
    };
    Miner.prototype.sendToMiner = function (payload) {
        if (this.online && this.minerQueue) {
            payload.type += ':' + this.queueId;
            this.minerQueue.push(payload);
        }
    };
    Miner.prototype.sendToPool = function (method, params) {
        this.queue.push({
            type: "message",
            payload: {
                method: method,
                params: params
            }
        });
    };
    Miner.prototype.handleAuthed = function (auth) {
        Debug.IbctLogDbg(COMP, "miner authenticated (" + this.id + "):", auth);
        this.sendToMiner({
            type: "authed",
            payload: {
                token: "",
                hashes: 0,
                auth: auth
            }
        });
        this.emit("authed", {
            id: this.id,
            login: this.login,
            auth: auth
        });
    };

    Miner.prototype.handleSetdiff = function (diff) {
        Debug.IbctLogDbg(COMP, "miner setdiff (" + this.id + "):", diff);
        this.sendToMiner({
            type: "diff",
            payload:diff
        });
        this.emit("diff", {
            id: this.id,
            login: this.login,
            diff: diff
        });
    };
    Miner.prototype.handleSubscribe = function (subscribe) {
        Debug.IbctLogDbg(COMP, "miner subscribed (" + this.id + "):", subscribe);
        this.sendToMiner({
            type: "subscribe",
            payload: subscribe
 
        });
        this.emit("subscribe", {
            id: this.id,
            login: this.login,
            subscribe: subscribe
        });
    };
    Miner.prototype.handleJob = function (job) {
        Debug.IbctLogDbg(COMP, "job arrived (" + this.id + "):", job[0]);
        this.jobs.push(job);

        this.sendToMiner({
            type: "job",
            payload: this.jobs.pop()
        });

        this.emit("job", {
            id: this.id,
            login: this.login,
            job: job
        });
    };
    Miner.prototype.handleAccepted = function (job) {
        this.hashes++;
        Debug.IbctLogDbg(COMP, "shares accepted (" + this.id + "):", this.hashes);
        // Metrics_1.sharesCounter.inc();
        // Metrics_1.sharesMeter.mark();
        this.sendToMiner({
            type: "accepted",
            payload: {
                hashes: this.hashes,
                nonce: job
            }
        });
        this.emit("accepted", {
            id: this.id,
            login: this.login,
            hashes: this.hashes
        });
    };
    Miner.prototype.handleError = function (error) {
        Debug.IbctLogErr(COMP, "pool connection error (" + this.id + "):", error.error || (error && JSON.stringify(error)) || "unknown error");
        if (this.online) {
            if (error.error === "invalid_site_key") {
                this.sendToMiner({
                    type: "error",
                    payload: error
                });
            }
            this.emit("error", {
                id: this.id,
                login: this.login,
                error: error
            });
        }
        this.kill();
    };
    Miner.prototype.handleRejected = function (job, error) {
        Debug.IbctLogDbg(COMP, "shares rejected(" + this.id + "):", this.hashes);
        this.rejected++;
        this.sendToMiner({
            type: "rejected",
            payload: {
                rejected: this.rejected,
                nonce: job,
                err: error
            }
        });
        this.emit("rejected", {
            id: this.id,
            login: this.login,
            rejected: this.rejected
        });
    };
    Miner.prototype.handleMessage = function (message) {
        switch (message.type) {
            case "auth": {
                var params = message.params;
                this.login = this.user || params.user;
                if (this.diff) {
                    this.login += "+" + this.diff;
                }
                this.sendToPool("login", {
                    login: this.login,
                    pass: this.pass,
                    agent: "Ibctminer/1.0.0"
                });
                break;
            }
            case "submit": {
                var job = message.params;
                Debug.IbctLogDbg(COMP, "job submitted (" + this.id + "):", job.job_id);
                this.sendToPool("submit", job);
                this.emit("found", {
                    id: this.id,
                    login: this.login,
                    job: job
                });
                break;
            }
        }
    };
    return Miner;
}(EventEmitter));
exports.default = Miner;
