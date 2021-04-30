const EventEmitter = require('events');
const cpu = require('./cpu');
const hs1 = require('./hs1');
const hs1plus = require('./hs1plus');
const lb1 = require('./lb1');
const unknow = require('./unknow');
const Debug = require('../log')();
const COMP = '[minerApi]';

var miners = [
  {
    name: 'cpu',
    api: cpu
  },
  {
    name: 'Goldshell-HS1',
    api: hs1
  },
  {
    name: 'Goldshell-HS1-Plus',
    api: hs1plus
  },
  {
    name: 'Goldshell-LB1',
    api: lb1
  },
  {
    name: 'unknow',
    api: unknow
  }
];

class miner extends EventEmitter {
  constructor({
    name,
    devPath,
    algo,
    varity,
    crypto
  }) {
    super();
    var _this = this;

    _this.name = name;
    _this.devPath = devPath;
    _this.algo = algo;
    _this.varity = varity;
    _this.crypto = crypto;
    _this.minerApi = this.GetMinerApi(_this.name)({
      devPath: _this.devPath,
      algo: _this.algo,
      varity: _this.varity,
      crypto: _this.crypto
    });
    if (!_this.minerApi) {
      _this.emit('error', __('不支持此矿机:'), _this.name);
    }

    _this.minerApi.on("error", function (data) {
      return _this.emit("error", data);
    })
    _this.minerApi.on("warning", function (data) {
      return _this.emit("warning", data);
    })
    return _this;
  }

  GetMinerApi(name) {
    var dev = null;
    miners.forEach(function (miner, index) {
      if (miner.name === name) {
        dev = miner;
      }
    })
    return dev ? dev.api : null;
  }

  getInfo() {
    /* 返回矿机信息，包括矿机名，固件版本。*/
    return this.minerApi ? this.minerApi.getInfo() : null;
  }

  async detect(modelName) {
    return this.minerApi ? await this.minerApi.detect(modelName) : null;
  }

  async init(params) {
    /*
      初始化硬件

     */
    return this.minerApi ? await this.minerApi.init(params) : null;
  }
  async setDevice() {
    /*
      设置Miner参数，电压, 频率，目标温度，报警温度。
    */
    return this.minerApi ? this.minerApi.setDevice() : null;
  }
  async scanWork(Job, Callback) {
    return this.minerApi ? this.minerApi.scanWork(Job, Callback) : null;
  }
  async stop(enable) {
    /*
      停止硬件工作并关闭硬件
    */
    return this.minerApi ? await this.minerApi.stop(enable) : null;
  }
  async release() {
    this.minerApi.removeAllListeners("error");
    this.minerApi.removeAllListeners("warning");
    return await this.stop(true)
  }
  getState() {
    /*
    获取当前设备状态， 温度，电压，频率，功耗等
    */
    return this.minerApi ? this.minerApi.getState() : null;
  }
  async stopScanWork() {
    return this.minerApi ? this.minerApi.stopScanWork() : null;
  }
  setLed(Enable) {
    return this.minerApi ? this.minerApi.setLed(Enable) : null;
  }
  reboot() {
    return this.minerApi ? this.minerApi.rebootDev() : null;
  }
  updateImage(Image, Callback) {
    return this.minerApi ? this.minerApi.burnFirmware(Image, Callback) : null;
  }
  async burnSNInfo(ptinfo) {
    return this.minerApi ? await this.minerApi.burnSNInfo(ptinfo) : null;
  }
}

module.exports = function Getminer(options = {}) {
  return new miner(options);
};
