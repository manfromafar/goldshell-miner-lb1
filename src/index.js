const EventEmitter = require('events');
const DetectUsbMiner = require('./detect');
const Miner = require('./miner');
const Debug = require('./log')();
const I18n = require('i18n');
const COMP = '[index]'

class IbctMiner extends EventEmitter {
  constructor({
    MinerParameters
  }) {
    super();
    var _this = this

    _this.initMiningLanguage();
    _this.detectUsbMiner = DetectUsbMiner({});
    _this.Miner = Miner({MinerParameters: MinerParameters});

    _this.on("error", function(ID, data) {
      Debug.IbctLogDbg(COMP, (ID !== undefined) ? "Miner " + ID + ":" + data : data)
    })

    _this.on("warning", function(ID, data) {
      Debug.IbctLogDbg(COMP, (ID !== undefined) ? "Miner " + ID + ":" + data : data)
    })

    if (_this.Miner) {
      _this.Miner.on("error", function (data, Device, ID) {
        return _this.emit("error", ID, data);
      });

      _this.Miner.on("warning", function (data, Device, ID) {
        return _this.emit("warning", ID, data);
      });
    }

    _this.detectUsbMiner.on('plug-in', async (Device) => {
      await _this.addMining(Device);
      return _this.emit('plug-in', Device);
    })
    _this.detectUsbMiner.on('plug-out', async (Device) => {
      await _this.removeMining(Device);
      return _this.emit('plug-out', Device);
    })
  }
  async exitMining() {
    await this.detectUsbMiner.ExitUsbMiner();
    this.detectUsbMiner.removeAllListeners('plug-in');
    this.detectUsbMiner.removeAllListeners('plug-out');
    await this.stopMining(null);
    await this.Miner.ExitMiner();
    this.Miner.removeAllListeners('error');
    this.Miner.removeAllListeners('warning');
  }
  initMiningLanguage() {
    I18n.configure({
      locales: ['en', 'zh'],
      staticCatalog: {
        en: require('./translate/en.json'),
        zh: require('./translate/zh.json')
      },
      register: global
    });
    I18n.setLocale('zh');
  }
  setMiningLanguage(m) {
    I18n.setLocale(m);
  }
  async initMining() {
    await this.detectUsbMiner.ListUsbMiner();
    await this.addMining();
  }
  async startMining(Device) {
    return (Device ? await this.Miner.EnableMiner(Device) : await this.Miner.EnableMiners(this.listDevices()));
  }
  async stopMining(Device) {
    return (Device ? await this.Miner.DisableMiner(Device) : await this.Miner.DisableMiners(this.listDevices()));
  }
  async addMining(Device) {
    return (Device ? await this.Miner.AddMiner(Device) : await this.Miner.AddMiners(this.listDevices()));
  }
  async connectMining(Device) {
    return (Device ? await this.Miner.connectMiner(Device) : await this.Miner.connectMiners(this.listDevices()));
  }
  async removeMining(Device) {
    return (Device ? await this.Miner.RemoveMiner(Device) : await this.Miner.RemoveMiners(this.listDevices()));
  }
  setMiningConfig(setName, cryptoname, settings) {
    if (!setName || !cryptoname || !settings)
      return

    return this.Miner.SetMinerConfig(setName, cryptoname, settings)
  }
  getMiningStatus(Device) {
    return (Device ? this.Miner.GetMinerStatus(Device) : this.Miner.GetMinersStatus(this.listDevices()));
  }
  RebootMining(Device) {
    return (Device ? this.Miner.RebootMiner(Device) : this.Miner.RebootMiners(this.listDevices()));
  }
  SetMiningLed(Device, Enable) {
    return (Device ? this.Miner.SetMinerLed(Device, Enable) : this.Miner.SetMinersLed(this.listDevices(), Enable));
  }
  async BurnMiningFirmware(Device, Image, Callback) {
    return (Device ? await this.Miner.BurnMinerFirmware(Device, Image, Callback) : await this.Miner.BurnMinersFirmware(this.listDevices(), Image, Callback));
  }
  listDevices() {
    return this.detectUsbMiner.GetUsbMiner();
  }
}

module.exports = function GetIbctMiner(options = {}) {
  return new IbctMiner(options);
};
