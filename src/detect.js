const EventEmitter = require('events');
const UsbDetect = require('usb-detection');
const SerialPort = require('serialport');
const Fs = require('fs')
const Debug = require('./log')();
const locks = require('locks');
const COMP = '[Detect]';

class UsbMiner extends EventEmitter {
  constructor({}) {
    super();
    var _this = this
    _this.devices = [];
    _this.runDevices = [];
    _this.detectMutexs = [];
    _this.id = 0;
    // UsbDevice Vid&Pid
    _this.vendorId = '1155';
    _this.productId = '22336';

    UsbDetect.startMonitoring();

    _this.on('error', function (error) {
      Debug.IbctLogErr(COMP, "error:", error);
    });

    var listener = 'add' + ':' + _this.vendorId + ':' + _this.productId
    UsbDetect.on(listener, function (Device) {
      Debug.IbctLogErr(COMP, 'add:', JSON.stringify(Device));
      _this.AddUsbMiner(Device);
    });

    listener = 'remove' + ':' + _this.vendorId + ':' + _this.productId
    UsbDetect.on(listener, function (Device) {
      if (_this.hasExistUsbMiner(Device)) {
        Debug.IbctLogErr(COMP, 'remove:', JSON.stringify(Device));
        _this.RemoveUsbMiner(Device);
      }
    });
  }
  async ExitUsbMiner() {
    await UsbDetect.stopMonitoring();
  }
  GetUsbMiner() {
    return this.devices;
  }
  getDetectMutex(port) {
    var mutex = null;
    for (var i = 0; i < this.detectMutexs.length; i++) {
      if (this.detectMutexs[i].port === port) {
        mutex = this.detectMutexs[i].mutex;
        break;
      }
    }
    if (!mutex) {
      mutex = locks.createMutex();
      this.detectMutexs.push({
        port: port,
        mutex: mutex
      });
    }
    return mutex;
  }
  async ListUsbMiner() {
    var _this = this;
    var UsbMiner = [];

    await UsbDetect.find(parseInt(_this.vendorId), parseInt(_this.productId), function(err, Devices) {
      if (err) {
        Debug.IbctLogErr(COMP, err);
        return;
      }
      UsbMiner = Devices;
    })

    for (var i = 0; i < UsbMiner.length; i++) {
      await _this.getUsbMinerPort(UsbMiner[i], 0, function (err, port) {
        if (err) {
          return;
        }
        _this.devices.push({
          devID: _this.id++,
          port: port,
          mutex: _this.getDetectMutex(port),
          miner: UsbMiner[i]
        });
      });
    }
  }

  async getSerialPort(Device, callback) {
    var portName = null;
    await SerialPort.list(function (err, ports) {
      if (err) {
        callback(err);
        return;
      }

      ports.forEach(function (port) {
        if (Device.serialNumber === port.serialNumber) {
          portName = port.comName;
          callback(null, portName);
          return;
        }
      })
      callback('Cannot Find Port');
    })
  }

  async getUsbMinerPort(Device, Timeout, callback) {
    var _this = this;
    if (!Device) {
      callback('Device Error')
      return;
    }
    if (process.platform !== 'darwin') {
      await this.getSerialPort(Device, callback);
    } else {
      // In darwin, serialport have some bug
      if (!Timeout)
        await this.getSerialPort(Device, callback);
      else {
	      setTimeout(function() {
          _this.getSerialPort(Device, callback);
        }, Timeout);
      }
    }
  }
  hasExistUsbMiner(Device) {
    return this.devices.some(function (dev) {
      return JSON.stringify(dev.miner) === JSON.stringify(Device);
    });
  }
  hasUsbMiner() {
    return ((this.devices.length > 0) ? true : false);
  }
  AddUsbMiner(Device) {
    var _this = this;
    var device = {
      devID: _this.id++,
      port: null,
      mutex: null,
      miner: Device
    };
    _this.getUsbMinerPort(Device, 3000, function (err, port) {
      if (err) {
        return;
      }
      device.port = port;
      device.mutex = _this.getDetectMutex(port);
      _this.devices.push(device);
      _this.emit('plug-in', device);
    })
  }
  RemoveUsbMiner(Device) {
    var delDevice = {}
    this.devices = this.devices.filter(function (dev) {
      if (JSON.stringify(dev.miner) !== JSON.stringify(Device)) {
        return true;
      } else {
        delDevice = dev;
        return false;
      }
    });
    this.emit('plug-out', delDevice);
  }
}

module.exports = function DectectUsbMiner(options = {}) {
  return new UsbMiner(options);
};
