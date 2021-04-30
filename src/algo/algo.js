const blake2bsha3Api = require('./blake2bsha3Api');
const lbryApi = require('./lbryApi');
const EventEmitter = require('events');
const Debug = require('../log')();
const COMP = '[algo]';

const algorithms = [
  {
    name: 'lbry',
    api: lbryApi
  },
  {
    name: 'blake2bsha3',
    api: blake2bsha3Api
  }
];

class algoApi extends EventEmitter {
  constructor({
    name
  }) {
    super();
    var _this = this;

    _this.name = name;
    _this.algorithm = this.GetAlgorithmApi(_this.name);
    if (!_this.algorithm) {
      _this.emit('error', __('不支持此种算法:'), _this.name);
    }

    return _this;
  }
  GetAlgorithmApi(name) {
    var algo = null;
    algorithms.forEach(function (algorithm, index) {
      if (algorithm.name === name) {
        algo = algorithm;
      }
    })
    return algo ? algo.api() : null;
  }
  getAlgoName() {
    return this.algorithm ? this.algorithm.getAlgoName() : null;
  }
  genHash(data, length, varity) {
    return this.algorithm ? this.algorithm.genHash(data, length, varity) : null;
  }
};

module.exports = function RunAlgoApi(options = {}) {
  return new algoApi(options);
};
