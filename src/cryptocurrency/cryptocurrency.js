const EventEmitter = require('events');
const hns = require('./hns');
const lbc = require('./lbc');
const Debug = require('../log')();
const COMP = '[cryptoCurrencys]';

var cryptoCurrencys = [
  {
    name: 'hns',
    api: hns
  },
  {
    name: 'lbc',
    api: lbc
  }
];

class CryptoCurrency extends EventEmitter {
  constructor({
    name
  }) {
    super();
    var _this = this;

    Debug.IbctLogDbg(COMP, name);
    _this.name = name;
    _this.cryptoApi = _this.GetCryptoApi(_this.name);
    if (!_this.cryptoApi) {
      _this.emit('error', __('不支持此币种:'), _this.name);
    }

    _this.on('error', function (error) {
      Debug.IbctLogErr(COMP, "error:", error);
    });

    return _this;
  }
  GetCryptoApi(name) {
    var crypto = null;
    cryptoCurrencys.forEach(function (cryptoCurrency, index) {
      if (cryptoCurrency.name === name) {
        crypto = cryptoCurrency;
      }
    })
    return crypto ? crypto.api() : null;
  }

  getCryptoName() {
    return this.cryptoApi ? this.cryptoApi.getCryptoName() : null;
  }
  stratum_subscribe(data) {
    return this.cryptoApi ? this.cryptoApi.stratum_subscribe(data) : null;
  }
  jsonrpc_subscibe(data) {
    return this.cryptoApi ? this.cryptoApi.jsonrpc_subscibe(data) : null;
  }

  stratum_diff(data) {
    return this.cryptoApi ? this.cryptoApi.stratum_diff(data) : null;
  }
  jsonrpc_diff(data) {
    return this.cryptoApi ? this.cryptoApi.jsonrpc_diff(data) : null;
  }

  stratum_notify(data) {
    return this.cryptoApi ? this.cryptoApi.stratum_notify(data) : null;
  }
  jsonrpc_notify(data) {
    return this.cryptoApi ? this.cryptoApi.jsonrpc_notify(data) : null;
  }
  JobtoWork(Job, Work) {
    return this.cryptoApi ? this.cryptoApi.JobtoWork(Job, Work) : null;
  }
  setWorkData(work, mode, data) {
    return this.cryptoApi ? this.cryptoApi.setWorkData(work, mode, data) : null;
  }
  checkHash(target, hash) {
    return this.cryptoApi ? this.cryptoApi.checkHash(target, hash) : null;
  }
  calHash(Device, nonce) {
    return this.cryptoApi ? this.cryptoApi.calHash(Device, nonce) : null;
  }
  getSubmitParams(Device, nonce, hash) {
    return this.cryptoApi ? this.cryptoApi.getSubmitParams(Device, nonce, hash) : null;
  }
  targetToDiff(target) {
    return this.cryptoApi ? this.cryptoApi.targetToDiff(target) : null;
  }
  diffToTarget(difficulty) {
    return this.cryptoApi ? this.cryptoApi.diffToTarget(difficulty) : null;
  }
  reverseBuffer(src) {
    return this.cryptoApi ? this.cryptoApi.reverseBuffer(src) : null;
  }
};

module.exports = function GetCryptoCurrency(options = {}) {
  return new CryptoCurrency(options);
};