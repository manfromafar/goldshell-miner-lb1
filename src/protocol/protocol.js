const EventEmitter = require('events');
const Debug = require('../log')();
const jsonrpc = require('./jsonrpc');
const HnsStratum = require('./HnsStratum');
const LbcStratum = require('./LbcStratum');
const COMP = '[protocol]';

var protocols = [
  {
    name: 'stratum',
    attr: 'hns',
    api: HnsStratum
  },
  {
    name: 'stratum',
    attr: 'lbc',
    api: LbcStratum
  }
];

class protocol extends EventEmitter {
  constructor({
    name,
    cryptoname
  }) {
    super();
    var _this = this;
    Debug.IbctLogDbg(COMP, name);
    _this.name = name;
    _this.cryptoname = cryptoname;
    _this.protocolApi = _this.GetProtocolApi(_this.name, _this.cryptoname);
    if (!_this.protocolApi) {
      _this.emit('error', __('不支持此种连接模式:'), _this.name);
    }

    _this.protocolApi.on('error', function (error) {
      _this.emit('error', error);
    });

    _this.protocolApi.on("connect", function () {
      _this.emit("connect");
    });
    _this.protocolApi.on("close", function () {
      _this.emit("close");
    });

    this.protocolApi.on("data", function (message) {
      _this.emit("data", message);
    });

    return _this;
  }

  GetProtocolApi(name, cryptoname) {
    var dev = null;
    protocols.forEach(function (protocol, index) {
      if (protocol.name === name && protocol.attr === cryptoname) {
        dev = protocol;
      }
    })
    return dev ? dev.api() : null;
  }

  init(ssl, host, port) {
    return this.protocolApi ? this.protocolApi.init(ssl, host, port) : null;
  }
  kill() {
    return this.protocolApi ? this.protocolApi.kill() : null;
  }
  getPacket() {
    return this.protocolApi ? this.protocolApi.getPacket() : null;
  }
  sendPacket(message) {
    return this.protocolApi ? this.protocolApi.sendPacket(message) : null;
  }
  isWritable() {
    return this.protocolApi ? this.protocolApi.isWritable() : null;
  }
}

module.exports = function GetProtocol(options = {}) {
  return new protocol(options);
};