const EventEmitter = require('events');
const Debug = require('../log')();
const net = require("net");
const tls = require("tls");
const COMP = '[jsonrpc]';

class jsonrpc extends EventEmitter {
  constructor({ }) {
    super();
    var _this = this;
    _this.socket = null;
    _this.buffer = "";

    return _this;
  }

  init(ssl, host, port) {
    var _this = this;
    if (ssl) {
      this.socket = tls.connect(+port, host, { rejectUnauthorized: false });
    } else {
      this.socket = net.connect(+port, host);
    }
    this.socket.on("connect", function () {
      _this.emit("connect");
    });
    this.socket.on("error", function (error) {
      _this.emit("error", error);      
    });
    this.socket.on("close", function () {
      _this.emit("close");
    });
    this.socket.setKeepAlive(true);
    this.socket.setEncoding("utf8");
  }
  kill() {
    if (this.socket != null) {
      try {
        this.socket.end();
        this.socket.destroy();
      }
      catch (e) {
        Debug.IbctLogErr(COMP, "something went wrong while destroying socket (" + this.host + ":" + this.port + "):", e.message);
      }
    }
  }
  getPacket() {
    var _this = this;
    this.socket.on("data", function (chunk) {
      _this.buffer += chunk;
      while (_this.buffer.includes("\n")) {
        var newLineIndex = _this.buffer.indexOf("\n");
        var stratumMessage = _this.buffer.slice(0, newLineIndex);
        _this.buffer = _this.buffer.slice(newLineIndex + 1);
        _this.emit("data", stratumMessage);
      }
    });
  }

  sendPacket(message) {
    Debug.IbctLogInfo(COMP, JSON.stringify(message));
    return this.socket.write(JSON.stringify(message) + "\n");
  }

  isWritable() {
    return this.socket.writable;
  }
}

module.exports = function Getjsonrpc(options = {}) {
  return new jsonrpc(options);
};