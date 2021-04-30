const EventEmitter = require('events');
const uuid = require("uuid");
const Proxy = require('./proxy/build');
const Queue_1 = require('./proxy/build/Queue');
const cryptocurrency = require('./cryptocurrency/cryptocurrency');
const Miner_1 = require('./miner/minerApi');
const Algo_1 = require('./algo/algo');
const Debug = require('./log')();
const Ping = require('./ping');
const crc32 = require('crc32');
const Q = require('bluebird');
const locks = require('locks');
const SN = require('./sn')();
const COMP = '[Miner]';

var __assign = (this && this.__assign) || Object.assign || function (t) {
  for (var s, i = 1, n = arguments.length; i < n; i++) {
    s = arguments[i];
    for (var p in s)
      if (Object.prototype.hasOwnProperty.call(s, p))
        t[p] = s[p];
  }
  return t;
};

class Miner extends EventEmitter {
  constructor({
    MinerParameters
  }) {
    super();
    var _this = this

    _this.MinerSupport = MinerParameters;
    _this.hwPoolMutex = locks.createMutex();
    _this.RunningMiner = [];
    _this.checkNet = null;
    _this.unlink = 0;
    _this.unlinkShutdown = false;
    _this.netThread()
    _this.on('error', function (error, Device) {
      if (typeof error === 'object')
        Debug.IbctLogErr(COMP, "error:", JSON.stringify(error));
      else
        Debug.IbctLogErr(COMP, "error:", error);

      if (Array.isArray(Device)) {
        _this.DisableMiners(Device);
      } else if (Device) {
        _this.DisableMiner(Device);
      }
    });
    _this.on('warning', function (error) {
      Debug.IbctLogDbg(COMP, error);
    });
  }

  getPools() {
    var pools = [];

    for (var i = 0; i < this.MinerSupport.length; i++) {
      if (this.MinerSupport[i].pool !== null) {
        pools.push(this.MinerSupport[i].pool);
      }
    }
    return pools;
  }

  getMinerParameter(Device, name) {
    if (!Device)
      return null
    if (Device.dev.miningParameter !== null)
      return Device.dev.miningParameter[name];
    else
      return null;
  }

  startMiner(Device) {
    var _this = this
    if (_this.unlinkShutdown) {
      setTimeout(function() {
        _this.startMiner(Device);
      }, 1000);
      return
    }
    _this.EnableMiner(Device);
  }

  restartMiner(Device) {
    var state = this.GetMinerRunningState(Device)
    var status = this.GetMinerRunningStatus(Device)
    var _this = this
    if (state === 'miner' && !status) {
      setTimeout(function() {
        _this.restartMiner(Device);
      }, 1000);
      return
    }

    if (_this.unlinkShutdown) {
      Q.try(async () => {
        await _this.DisableMiner(Device);
        _this.startMiner(Device);
      })
      return
    }

    Q.try(async () => {
      await this.DisableMiner(Device);
      await this.EnableMiner(Device);
    })
  }

  netThread() {
    var _this = this;
    var pools = null;

    pools = _this.getPools();
    if (!pools.length) return;

    if (_this.checkNet) {
      clearInterval(_this.checkNet);
      _this.checkNet = null;
      _this.unlink = 0;
      _this.unlinkShutdown = false;
    }

    _this.checkNet = setInterval(function () {
      _this.netPing(pools, function (err) {
        if (err) {
          _this.unlink++;
        } else {
          _this.unlink = 0;
          if (_this.unlinkShutdown) {
            _this.unlinkShutdown = false;
            _this.emit("warning", __('网络重新连通'));
          }
        }
        if (_this.unlink > 2) {
          _this.unlink = 0;
          if (!_this.unlinkShutdown) {
            _this.unlinkShutdown = true;
            _this.emit("error", __('网络失去连接'), null);
          }
        }
      })
    }, 12000);
  }

  netPing(pools, callback) {
    var total = 0;
    var wr = 0;
    pools.forEach(pool => {
      Ping.ping({
        address: pool.host,
        port: pool.port,
        attempts: 1,
        timeout: 2000
      }, function (error, target) {
        if (error) {
          Debug.IbctLogDbg(COMP, target + ": " + error.toString());
          // callback(target + ": " + error.toString())
          wr++;
        }
        total++;
        if (total === pools.length)
          callback((wr === pools.length) ? error.toString() : null);
      })
    })
  }

  async ExitMiner() {

  }

  proxyConnect(Device) {
    var _this = this;
    var pool = _this.getMinerParameter(Device, 'pool');
    var user = pool.user;
    if (pool.user.includes('.')) {
      user += ('_' + Device.dev.sn);
    } else {
      user += ('.' + Device.dev.sn);
    }
    if (Device.dev.blacklist > 0) {
      user += '_bk' + Device.dev.blacklist.toString()
    }

    Device.dev.Proxy = new Proxy({
      host: pool.host,
      port: pool.port,
      user: user,
      pass: pool.pass,
      protocolname: _this.getMinerParameter(Device, 'protocolname'),
      cryptoname: _this.getMinerParameter(Device, 'cryptoname')
    });

    Device.dev.Proxy.on("open", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy open');
      return _this.emit("open", data);
    });
    Device.dev.Proxy.on("authed", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy authed');
      return _this.emit("authed", data);
    });
    Device.dev.Proxy.on("job", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy job');
      return _this.emit("job", data);
    });
    Device.dev.Proxy.on("found", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy found');
      return _this.emit("found", data);
    });
    Device.dev.Proxy.on("accepted", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy accepted');
      return _this.emit("accepted", data);
    });
    Device.dev.Proxy.on("rejected", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy rejected');
      return _this.emit("rejected", data);
    });
    Device.dev.Proxy.on("close", function (data) {
      Debug.IbctLogInfo(COMP, 'Proxy close');
      return _this.emit("close", data);
    });
    Device.dev.Proxy.on("error", function (data) {
      var stringData = data;
      if (typeof data === 'object') {
        stringData = JSON.stringify(data)
      }
      if (stringData.indexOf('You are blacklisted') >= 0) {
        // blacklisted
        Device.dev.blacklist++;
      }
      setTimeout(function() {
        _this.restartMiner(Device)
      }, 1000);

      return _this.emit("error", data, null, Device.devID);
    });
  }

  proxyKill(Device) {
    Device.dev.Proxy.removeAllListeners("open");
    Device.dev.Proxy.removeAllListeners("authed");
    Device.dev.Proxy.removeAllListeners("job");
    Device.dev.Proxy.removeAllListeners("found");
    Device.dev.Proxy.removeAllListeners("accepted");
    Device.dev.Proxy.removeAllListeners("rejected");
    Device.dev.Proxy.removeAllListeners("close");
    Device.dev.Proxy.removeAllListeners("error");
    Device.dev.Proxy.kill();
  }

  version_compare(version1, version2) {
    let v1 = version1.split('.');
    let v2 = version2.split('.');
    let r0 = parseInt(v1[0]);
    let r1 = parseInt(v1[1]);
    let r2 = parseInt(v1[2]);
    let s = r0 * 100 + r1 * 10 + r2;
    r0 = parseInt(v2[0]);
    r1 = parseInt(v2[1]);
    r2 = parseInt(v2[2]);
    let d = r0 * 100 + r1 * 10 + r2;
    if (s === d)
        return 0;
    else if (s < d)
        return 1;
    else
        return 0;
  }

  async controlMinerSN(Device) {
    var minerInfo = this.GetMinerInfo(Device);
    var _this = this;
    var ret;
    return new Promise(async (resolve)=> {
      if (Device.dev.sn) {
        resolve(0);
        return
      }
      Device.dev.workDepth = minerInfo.workDepth;
      Device.dev.sn = minerInfo.sn;
      if (Device.dev.sn) {
        resolve(0);
        return
      }

      if (minerInfo.modelName === 'simplenode') {
          ret = _this.version_compare(minerInfo.firmwareVer, '0.0.9');
          if (ret) {
            resolve(0);
            _this.emit("warning", __('此矿机版本过低, 请先升级'), null, Device.dev.DevID);
            Device.dev.sn = Device.devID;
            return
          }
      }

      Device.dev.sn = await SN.GetSN(minerInfo.snAbbr);
      if (!Device.dev.sn) {
        resolve(1);
        return
      }
      ret = await _this.BurnMinerSNInfo(Device, { sn: Device.dev.sn });
      resolve(ret ? 1 : 0)
    })
  }
  async findMiner(Device, callback) {
    var _this = this;
    var ret;
    var i, j;

    for (i = 0; i < _this.MinerSupport.length; i++) {
      var minernames = _this.MinerSupport[i].minername
      Device.dev.algorithm = Algo_1({name: _this.MinerSupport[i].algoname});
      Device.dev.crypto = cryptocurrency({name: _this.MinerSupport[i].cryptoname});
      for (j = 0; j < minernames.length; j++) {
        Device.dev.miner = Miner_1({
          name: minernames[j],
          devPath: Device.port,
          algo: Device.dev.algorithm,
          varity: 0,
          crypto: Device.dev.crypto
        });
        ret = await this.DetectMiner(Device, minernames[j]);
        if (!ret) {
          Debug.IbctLogDbg('Find Miner:', minernames[j]);
          Device.dev.miningName = minernames[j];
          Device.dev.miningParameter = _this.MinerSupport[i];
          break;
        } else
          await _this.ReleaseMiner(Device);

        if (ret === 2) {
          // can not connect with miner, so reboot it
          Debug.IbctLogErr('Connect error when find miner');
          Device.dev.miner = Miner_1({
            name: 'unknow',
            devPath: Device.port,
            algo: Device.dev.algorithm,
            varity: 0,
            crypto: Device.dev.crypto
          });
          Device.dev.miningName = 'unknow';
          break;
        }
      }
      if (!ret || ret === 2)
      // connect error or have found
        break;
    }

    if (i === _this.MinerSupport.length) {
      Debug.IbctLogErr('Error to find Miner');
      Device.dev.miner = Miner_1({
        name: 'unknow',
        devPath: Device.port,
        algo: Device.dev.algorithm,
        varity: 0,
        crypto: Device.dev.crypto
      });
      Device.dev.miningName = 'unknow';
    }

    Device.dev.miner.on("error", function (data) {
      return _this.emit("error", data, Device, Device.devID);
    })
    Device.dev.miner.on("warning", function (data) {
      return _this.emit("warning", data, Device, Device.devID);
    })
    if (Device.dev.miner) {
      callback(Device);
    } else {
      callback(Device, 'Error to find Miner');
    }
  }
  async InitMiner(Device) {
    return Device.dev.miner ? await Device.dev.miner.init() : null;
  }
  GetMinerInfo(Device) {
    return Device.dev.miner ? Device.dev.miner.getInfo() : null;
  }
  SetMinerDevice(Device) {
    return Device.dev.miner ? Device.dev.miner.setDevice() : null;
  }
  MinerScanWork(Device, work, callback) {
    return Device.dev.miner ? Device.dev.miner.scanWork(work, callback) : null;
  }
  async DetectMiner(Device, DevName) {
    return Device.dev.miner ? await Device.dev.miner.detect(DevName) : null;
  }
  async BurnMinerSNInfo(Device, ptInfo) {
    return Device.dev.miner ? await Device.dev.miner.burnSNInfo(ptInfo) : null;
  }
  StopMiner(Device) {
    return Device.dev.miner ? Device.dev.miner.stop(false) : null;
  }
  async ReleaseMiner(Device) {
    return Device.dev.miner ? await Device.dev.miner.release() : null;
  }
  SetMinerLedStatus(Device, Enable) {
    return Device.dev.miner ? Device.dev.miner.setLed(Enable) : null;
  }
  RebootHWMiner(Device) {
    return Device.dev.miner ? Device.dev.miner.reboot() : null;
  }
  UpdateMinerImage(Device, Image, Callback) {
    return Device.dev.miner ? Device.dev.miner.updateImage(Image, Callback) : null;
  }
  GetMinerState(Device) {
    return Device.dev.miner ? Device.dev.miner.getState() : null;
  }
  stopScanWork(Device) {
    return Device.dev.miner ? Device.dev.miner.stopScanWork() : null;
  }
  PoolLogin(Device) {
    Device.dev.pool.handleMessage({
      type: 'auth',
      params: {
        site_key: null,
        user: null
      }
    });
  }
  PoolSubmit(Device, nonce, hash) {
    Device.dev.pool.handleMessage({
      type: 'submit',
      params: Device.dev.crypto.getSubmitParams(Device, nonce.toString('hex'), hash)
    });
  }
  PutNonceToPoolQueue(Device) {
    var work = Device.dev.work;
    Device.dev.hwPoolQueue.push({
      job_id: work.job_id,
      difficulty: work.difficulty
    });
  }
  CleanPoolQueue(Device, submit) {
    var dev = Device.dev;
    dev.hwPoolQueue = dev.hwPoolQueue.filter(function (data) {
      if (data.job_id === submit.job_id) {
        return false;
      } else {
        return true;
      }
    });
  }
  CleanAllPoolQueue(Device) {
    if (Device.dev.hwPoolQueue.length) {
      Device.dev.hwPoolQueue.splice(0, Device.dev.hwPoolQueue.length);
    }
  }
  CheckNonce(Device, nonce) {
    var hwTarget = Device.dev.work.hwTarget ? Device.dev.work.hwTarget : Device.dev.work.target;
    var target = Device.dev.work.target;
    var hash = null;
    hash = Device.dev.crypto.calHash(Device, nonce);
    if (Device.dev.crypto.checkHash(hwTarget, hash)) {
      if (Device.dev.crypto.checkHash(target, hash)) {
        // Device.dev.minerstatus.txtotal++;
        this.PutNonceToPoolQueue(Device);
        this.PoolSubmit(Device, nonce, hash);
      }
      return true
    } else {
      Device.dev.minerstatus.hardwareErr++;
      Debug.IbctLogDbg(COMP, 'HardwareErr: nonce', nonce.toString('hex'), '; hwTarget', hwTarget.toString('hex'), '; calTarget', hash.toString('hex'));
      return false
    }
  }
  setMinerTargetByWork(Device, Work) {
    var minerstatus = Device.dev.minerstatus;
    if (Work.hwdifficulty)
      return;

    minerstatus.target = Work.hwTarget ? Work.hwTarget : Work.target;
    minerstatus.target = minerstatus.target.toString('hex');
    Work.hwdifficulty = Device.dev.crypto.targetToDiff(minerstatus.target);
    minerstatus.difficulty = Work.hwdifficulty;
  }
  GetTime() {
    return Math.floor(((new Date())).getTime() / 1000);
  }
  ConvertUnion(Hashrate) {
    if (Hashrate < 1000)
      return Hashrate.toFixed(2) + ' H/s';
    else if (Hashrate < 1000000)
      return (Hashrate / 1000).toFixed(2) + ' kH/s';
    else if (Hashrate < 1000000000)
      return (Hashrate / 1000000).toFixed(2) + ' MH/s';
    else
      return (Hashrate / 1000000000).toFixed(2) + ' GH/s';
  }
  updateMinerAvHashrate(Device, onlyCal) {
    var dev = Device.dev;
    var minerstatus = dev.minerstatus;
    var curtime = this.GetTime();

    if (onlyCal) {
      minerstatus.avHashrate = this.ConvertUnion(dev.hwCal / (curtime - dev.stime));
      return;
    }

    if (!minerstatus.difficulty)
      return;

    dev.hwCal += minerstatus.difficulty;
    minerstatus.avHashrate = this.ConvertUnion(dev.hwCal / (curtime - dev.stime));
  }
  updateMinerPoolHashrate(Device, submit) {
    var minerstatus = Device.dev.minerstatus;
    var hwPool = Device.dev.hwPool;
    var _this = this;
    var allTime = 0;
    var allhash = 0;
    var times = 0;
    var newHash = null;
    var i = 0;

    Device.dev.hwPoolQueue = Device.dev.hwPoolQueue.filter(function (data) {
      if (!submit || data.job_id === submit.job_id) {
        newHash = {
          difficulty: submit ? data.difficulty : 0,
          time: _this.GetTime()
        };

        _this.hwPoolMutex.lock(async () => {
          allhash = 0;
          hwPool.push(newHash);
          minerstatus.share += data.difficulty;
          Device.dev.hwPool = hwPool.filter(function (dev) {
            times = newHash.time - dev.time;
            i++;
            if (times > 900) {
              return false;
            } else {
              if (times > allTime)
                allTime = times;
              allhash += dev.difficulty;
              return true;
            }
          })

          times = newHash.time - Device.dev.stime;
          if (times < 40) {
            minerstatus.plHashrate = '0 H/s'
          } else {
            if (_this.getMinerParameter(Device, 'cryptoname') === 'xmr') {
	            minerstatus.plHashrate = _this.ConvertUnion(allhash / allTime);
            }else{
              minerstatus.plHashrate = _this.ConvertUnion(allhash * 0x100000000 / allTime);
            }
          }
          _this.hwPoolMutex.unlock();
        })

        return false;
      } else {
        return true;
      }
    });
  }
  updateMinerInstantHashrate(Device, onlyCal) {
    var hwInstant = Device.dev.hwInstant;
    var minerstatus = Device.dev.minerstatus;
    var work = Device.dev.work;
    var newHash = {
      difficulty: onlyCal ? 0 : work.hwdifficulty,
      time: this.GetTime()
    };
    var allTime = 0;
    var allhash = 0;
    var times = 0;

    hwInstant.push(newHash);
    Device.dev.hwInstant = hwInstant.filter(function (dev) {
      times = newHash.time - dev.time;
      if (times > 360) {
        return false;
      } else {
        if (times > allTime)
          allTime = times;
        allhash += dev.difficulty;
        return true;
      }
    })
    times = newHash.time - Device.dev.stime;
    if (times < 40) {
      minerstatus.hashrate = '0 H/s'
    } else {
      minerstatus.hashrate = this.ConvertUnion(allhash / allTime);
    }
  }
  updateMinerRate(Device) {
    this.updateMinerAvHashrate(Device, false);
    this.updateMinerInstantHashrate(Device, false);
  }
  updateMinerTemperature(Device) {
    var minerstatus = Device.dev.minerstatus;
    var minerstate = this.GetMinerState(Device);
    if(minerstate.rpm)
      minerstatus.rpm  = minerstate.rpm;
    minerstatus.temperatue = minerstate.temp.toString() + ' ℃';
  }
  DumpMinerStatus(Device, ms) {
    var _this = this;
    Device.dev.dump = setInterval(function () {
      _this.updateMinerTemperature(Device);
      Debug.IbctLogDbg(COMP, JSON.stringify(Device.dev.minerstatus));
    }, ms);
  }
  DisableDumpMinerStatus(Device) {
    if (Device.dev.dump) {
      clearInterval(Device.dev.dump);
    }
  }
  MinerPutJob(Device, data) {
    Device.dev.jobQueue.push(data);
  }
  MinerCleanJob(Device) {
    if (Device.dev.jobQueue.length < 4) return
    for (var i = 0; i < (Device.dev.jobQueue.length - 4); i++) {
      Device.dev.jobQueue.shift();
    }
  }
  MinerCleanAllJob(Device) {
    if (Device.dev.jobQueue.length) {
      Device.dev.jobQueue.splice(0, Device.dev.jobQueue.length);
    }
  }
  MinerGetJob(Device) {
    return Device.dev.jobQueue.pop();
  }
  MinerThread(Device) {
    var _this = this;
    var job = {};


    if (!_this.GetMinerRunningStatus(Device)) {
      return;
    }

    if(Device.dev.minerTimeout === true) {
      //Debug.IbctLogDbg(COMP, 'Miner start with Old Job...' );
      job = Device.dev.curJob;
    } else {
      //Debug.IbctLogDbg(COMP, 'Miner start with New Job...' );
      job = _this.MinerGetJob(Device);
      if (job === undefined) {
       setTimeout(function () {
          _this.MinerThread(Device);
        }, 100);
      return;
       }
    }
    Debug.IbctLogDbg(COMP, 'Miner start with ', Device.dev.minerTimeout === true?'Old Job':'New Job');

    Device.dev.curJob = job;
    for(let i=0; i<Device.dev.workDepth; i++) {
      var Work = {
        job_id: null,
        snonce: 0,
        enonce: 0xffffffff,
        difficulty: 0,
        target: null,
        hwTarget: null,
        hwdifficulty: null,
        data: null,
        sdata: null,
        ntime: null,
        clean: false,
        overScan: false,
      };
      if (!Device.dev.crypto.JobtoWork(job, Work)) {
        this.emit('error', __('任务转换失败'), Device, Device.devID);
        return;
      }
      Device.dev.workQueue.push(Work);
    }
    if (!_this.GetMinerRunningStatus(Device)) {
      return;
    }
    // set current work

    Device.dev.minerTimeout = false;
    _this.MinerScanWork(Device, Device.dev.workQueue, function (err, data, curWork) {
      if (err) {
        Debug.IbctLogErr(COMP, 'ScanWork Err: ', err);
        return;
      }

      if(curWork !== null) {
        Device.dev.work = curWork;
      }

      if (data !== null) {
        Device.dev.minerstatus.total++;
        if (!curWork.hwdifficulty) {
          _this.setMinerTargetByWork(Device, curWork);
        }

        if (_this.CheckNonce(Device, data)) {
          _this.updateMinerRate(Device);
        }
        return;
      }
      setTimeout(function () {
        if(curWork.overScan === true)
          Device.dev.minerTimeout = true;
        _this.MinerThread(Device);
      }, 1);
    });
  }
  setSubmitResult(Device, res) {
    Device.dev.submitResult.push(res);
    if (Device.dev.submitResult.length > 100)
      Device.dev.submitResult.shift();
  }
  checkSubmitResult(Device) {
    var res = 0;

    if (!Device.dev.submitResult.length)
      return false;

    for (var i = 0; i < Device.dev.submitResult.length; i++)
      res += Device.dev.submitResult[i];

    return (res > 30) ? true : false;
  }
  cleanAllSubmitResult(Device) {
    if (Device.dev.submitResult.length) {
      Device.dev.submitResult.splice(0, Device.dev.submitResult.length);
    }
  }
  errRelease(Device) {
    var _this = this;
    Debug.IbctLogDbg(COMP, 'errRelease');

    _this.proxyKill(Device);
    Device.dev.poolQueue.stop();
    _this.DisableDumpMinerStatus(Device);
    _this.CleanAllPoolQueue(Device);
    _this.MinerCleanAllJob(Device);
    _this.cleanAllSubmitResult(Device);
    _this.SetMinerRunningState(Device, 'standy');
    Device.dev.poolQueue.removeAllListeners("job:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("subscribe:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("diff:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("authed:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("accepted:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("rejected:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("error:" + Device.dev.id);
  }
  async StartMinerThread(Device, done) {
    var _this = this;

    Debug.IbctLogDbg(COMP, 'StartMinerThread');
    if (_this.GetMinerRunningStatus(Device)) {
      return;
    }
    _this.DumpMinerStatus(Device, 5000);
    Device.dev.stime = _this.GetTime();
    Device.dev.hwCal = 0;
    Device.dev.poolQueue.start();
    _this.proxyConnect(Device);
    _this.SetMinerRunningState(Device, 'miner');
    Device.dev.pool = Device.dev.Proxy.createProxy(Device.dev.id, Device.dev.poolQueue);
    Device.dev.poolQueue.on("subscribe:" + Device.dev.id, function (data) {
      if (_this.getMinerParameter(Device, 'protocolname') === 'stratum') {
        Device.dev.crypto.stratum_subscribe(data);
      } else {
        Device.dev.crypto.jsonrpc_subscribe(data);
      }
    })
    Device.dev.poolQueue.on("diff:" + Device.dev.id, function (data) {
      if (_this.getMinerParameter(Device, 'protocolname') === 'stratum') {
        Device.dev.crypto.stratum_diff(data);
      } else {
        Device.dev.crypto.jsonrpc_diff(data);
      }
    })

    Device.dev.poolQueue.on("job:" + Device.dev.id, function (data) {
      var packet = null;
      if (_this.getMinerParameter(Device, 'protocolname') === 'stratum') {
        packet = Device.dev.crypto.stratum_notify(data);
      } else {
        packet = Device.dev.crypto.jsonrpc_notify(data);
      }
      // Debug.IbctLogInfo(COMP, 'job poolQueue: ', packet);
      if (packet.clean) {
        _this.stopScanWork(Device)
      }
      _this.MinerPutJob(Device, packet);
      _this.MinerCleanJob(Device);
    })
    Device.dev.poolQueue.on("authed:" + Device.dev.id, function (data) {
      Debug.IbctLogDbg(COMP, 'authed poolQueue: ', data);
      Device.dev.poolId = data.auth;
    })
    Device.dev.poolQueue.on("accepted:" + Device.dev.id, function (data) {
      Debug.IbctLogDbg(COMP, 'accepted poolQueue: ', JSON.stringify(data.nonce));
      _this.setSubmitResult(Device, 0);
      Device.dev.minerstatus.accepted++;
      _this.updateMinerPoolHashrate(Device, data.nonce)
    })
    Device.dev.poolQueue.on("rejected:" + Device.dev.id, function (data) {
      Debug.IbctLogDbg(COMP, 'rejected poolQueue: ', JSON.stringify(data.nonce));
      Debug.IbctLogDbg(COMP, 'rejected poolQueue: ', JSON.stringify(data.err));
      _this.CleanPoolQueue(Device, data.nonce);
      _this.setSubmitResult(Device, 1);
      Device.dev.minerstatus.rejected++;
      if (data.err && data.err.message && data.err.message.indexOf('You are in blacklist') >= 0) {
        Device.dev.blacklist++;
        _this.restartMiner(Device);
        _this.emit("error", __('矿机进入黑名单状态，将换用户名重启'), null, Device.devID);
      } else if (data.err && (data.err instanceof Array) && data.err[1].indexOf('You are in blacklist') >= 0) {
        Device.dev.blacklist++;
        _this.emit("error", __('矿机进入黑名单状态，将换用户名重启'), null, Device.devID);
      }

      if (_this.checkSubmitResult(Device)) {
        _this.restartMiner(Device);
        _this.emit("error", __('矿机rejected过多，将重启'), null, Device.devID);
      }
    })
    Device.dev.poolQueue.on("error:" + Device.dev.id, function (data) {
      Debug.IbctLogDbg(COMP, 'error poolQueue: ', data);
    })

    var ret = await _this.InitMiner(Device);
    if (ret) {
      _this.emit("error", __('初始化矿机失败'), null, Device.devID);
      _this.errRelease(Device);
      return false;
    }
    _this.PoolLogin(Device);
    // for MinerThread
    _this.SetMinerRunningStatus(Device, true);
    _this.MinerThread(Device);
    return true
  }
  async StopMinerThread(Device, flags) {
    var _this = this;
    Debug.IbctLogDbg(COMP, 'StopMinerThread');
    if (!_this.GetMinerRunningStatus(Device)) {
      return;
    }

    _this.proxyKill(Device);
    Device.dev.poolQueue.stop();
    if (flags) {
      Device.dev.miner.removeAllListeners("error");
      Device.dev.miner.removeAllListeners("warning");
      await _this.ReleaseMiner(Device);
    } else {
      await _this.StopMiner(Device);
    }
    _this.DisableDumpMinerStatus(Device);
    _this.SetMinerRunningState(Device, 'standy');
    _this.CleanAllPoolQueue(Device);
    _this.MinerCleanAllJob(Device);
    _this.cleanAllSubmitResult(Device);
    Device.dev.poolQueue.removeAllListeners("job:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("subscribe:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("diff:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("authed:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("accepted:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("rejected:" + Device.dev.id);
    Device.dev.poolQueue.removeAllListeners("error:" + Device.dev.id);
  }
  HasExistMiner(Device) {
    return this.RunningMiner.some(function (dev) {
      return dev.devID === Device.devID;
    });
  }
  GetMinerByDevID(id) {
    var device = null;

    this.RunningMiner.forEach(function (Dev) {
      if (Dev.devID === id)
        device = Dev;
    });

    return device;
  }
  GetMinerRunningStatus(Device) {
    return this.RunningMiner.some(function (Dev) {
      if (Dev.devID === Device.devID)
        return Dev.enable;
    });
  }
  SetMinerRunningStatus(Device, status) {
    this.RunningMiner.forEach(function (Dev, index) {
      if (Dev.devID === Device.devID) {
        Dev.enable = status;
        // set minerstatus state
        Dev.dev.minerstatus.state = status ? 'on' : 'off';
      }
    })
  }
  GetMinerRunningState(Device) {
    var status = null;
    this.RunningMiner.forEach(function (Dev) {
      if (Dev.devID === Device.devID)
      status = Dev.status;
    });
    return status;
  }
  SetMinerRunningState(Device, status) {
    this.RunningMiner.forEach(function (Dev, index) {
      if (Dev.devID === Device.devID) {
        Dev.status = status;
      }
    })
  }
  minuteToString(s) {
    var d = Math.floor(s / 86400);
    s %= 86400;
    var h = Math.floor(s / 3600);
    s %= 3600;
    var m = Math.floor(s / 60);
    return d + 'd ' + h + 'h ' + m + 'm';
  }

  GetMinerStatus(Device) {
    var status = {
      devID: 0,
      miningName: null,
      miningSN: null,
      comm: null,
      state: 'off',
      version: '1.0.0',
      miningType: 'ltc',
      hashrate: '0 KH/s',
      avHashrate: '0 KH/s',
      plHashrate: '0 KH/s',
      share: 0,
      hardwareErr: 0,
      rejected: 0,
      nonces: 0,
      accepted: 0,
      temperatue: '0 ℃',
      elapsed: '0d 0h 0m',
      pools: null
    };
    var dev = null;
    var minerInfo = null;
    var minerstatus = null;
    dev = this.GetMinerByDevID(Device.devID);
    if (!dev)
      return null;
    status.comm = dev.port;
    status.devID = dev.devID;
    status.miningType = this.getMinerParameter(dev, 'cryptoname');
    status.miningSN = dev.dev.sn;
    minerInfo = this.GetMinerInfo(dev);
    if (minerInfo) {
      status.miningName = minerInfo.modelName;
      status.version = minerInfo.firmwareVer;
    }
    if (this.GetMinerRunningStatus(dev)) {
      minerstatus = dev.dev.minerstatus;
      status.state = minerstatus.state;
      this.updateMinerInstantHashrate(dev, true);
      status.hashrate = minerstatus.hashrate;
      this.updateMinerAvHashrate(dev, true);
      status.avHashrate = minerstatus.avHashrate;
      this.updateMinerPoolHashrate(dev, null);
      status.plHashrate = minerstatus.plHashrate;
      status.share = minerstatus.share;
      status.accepted = minerstatus.accepted;
      status.rejected = minerstatus.rejected;
      status.hardwareErr = minerstatus.hardwareErr;
      status.nonces = minerstatus.total;
      status.temperatue = minerstatus.temperatue;
      status.rpm = minerstatus.rpm;
      // status.elapsed = this.minuteToString(this.GetTime() - dev.dev.stime) + '_' + dev.dev.jobQueue.length.toString() + '_' + dev.dev.hwPoolQueue.length.toString() + '_' + dev.dev.hwInstant.length.toString();
      status.elapsed = this.minuteToString(this.GetTime() - dev.dev.stime);
      status.pools = this.getMinerParameter(dev, 'pool');
    }
    return status;
  }
  GetMinersStatus(Devices) {
    var status = [];
    var temp = null;
    var _this = this;

    Devices.forEach(function (Dev, index) {
      temp = _this.GetMinerStatus(Dev);
      if (temp) {
        status.push(temp);
      }
    })
    return status;
  }
  async EnableMiner(Device) {
    var _this = this;
    var dev = null;
    var ret;

    dev = _this.GetMinerByDevID(Device.devID);
    if (!dev)
      return;

    if (_this.getMinerParameter(dev, 'pool') === null) {
      this.emit("error", __('开始挖矿前，请先设置矿池'));
      return;
    }

    if (dev.dev.miningName === 'unknow')
      return;

    dev.dev.mutex.lock(async () => {
      if (dev && !_this.GetMinerRunningStatus(dev)) {
        // mining or burn status, need not start to mine
        if (_this.GetMinerRunningState(dev) === 'burn' || _this.GetMinerRunningState(dev) === 'miner')
          return;

        ret = await _this.StartMinerThread(dev);
        if (ret)
          _this.SetMinerRunningStatus(dev, true);
      }
      dev.dev.mutex.unlock();
    })
  }
  async EnableMiners(Devices) {
    var dev = null;
    for (var i = 0; i < Devices.length; i++) {
      dev = this.GetMinerByDevID(Devices[i].devID);
      if (!dev)
        continue;

      if (this.getMinerParameter(dev, 'pool') === null) {
        this.emit("error", __('开始挖矿前，请先设置矿池'));
        return;
      }
    }

    for (var i = 0; i < Devices.length; i++) {
      await this.EnableMiner(Devices[i]);
    }
  }
  SetMinerConfig(setName, cryptoname, settings) {
    var alive = false;
    var i;
    if (setName === 'pool') {
      for (i = 0; i < this.RunningMiner.length; i++) {
        if (this.GetMinerRunningStatus(this.RunningMiner[i]) &&
            this.getMinerParameter(this.RunningMiner[i], 'cryptoname') === cryptoname) {
          alive = true;
          break;
        }
      }
      if (alive) {
        this.emit("error", __('设置矿池前，请先停止挖矿'));
        return;
      } else {
        for (i = 0; i < this.MinerSupport.length; i++) {
          if (this.MinerSupport[i].cryptoname === cryptoname) {
            this.MinerSupport[i].pool = settings;
            break;
          }
        }
	      this.netThread();
      }
    }
  }
  async DisableMiner(Device) {
    var _this = this;
    var dev = null;

    dev = _this.GetMinerByDevID(Device.devID);
    if (!dev)
      return

    if (!dev.dev.miningName === 'unknow')
      return
    dev.dev.mutex.lock(async () => {
      if (dev && _this.GetMinerRunningStatus(dev)) {
        await _this.StopMinerThread(dev, false);
        _this.SetMinerRunningStatus(dev, false);
      }
      dev.dev.mutex.unlock();
    })
  }
  async DisableMiners(Devices) {
    for (var i = 0; i < Devices.length; i++) {
      await this.DisableMiner(Devices[i]);
    }
  }
  async AddMiner(Device) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      Device.mutex.lock(async () => {
        if (!_this.HasExistMiner(Device)) {
          var Dev = __assign({}, Device, {
            enable: false,
            dev: {
              // miner name
              miningName: null,
              // miner parameter
              miningParameter: null,
              // miner id
              id: uuid.v4(),
              // miner status: standby; miner; burn
              status: 'standy',
              // miner SN
              sn: null,
              // for blacklist
              blacklist: 0,
              // mutex
              mutex: locks.createMutex(),
              // pool set id to miner
              poolId: 0,
              // proxy
              Proxy: null,
              // connected pool
              pool: null,
              // communication with proxy
              poolQueue: new Queue_1.default(),
              // job queue
              jobQueue: [],
              //currrent job
              curJob:null,
              //minerTimeout
              minerTimeout:false,
              // miner device
              miner: null,
              // miner algorithm
              algorithm: null,
              // crypto
              crypto: null,
              // current work
              work: null,
              // device workDepth
              workDepth:1,
              // job queue
              workQueue: [],
              // setInterval
              dump: null,
              // rejected
              submitResult: [],
              // start run time
              stime: 0,
              // Chip calulate number for avhashrate
              hwCal: 0,
              // 20s hashrate
              hwInstant: [],
              // pool 15min hw hashrate
              hwPool: [],
              // pool nonce id&difficult queue
              hwPoolQueue: [],
              // miner status
              minerstatus: {
                state: 'off',
                target: 0,
                difficulty: 0,
                share: 0,
                hashrate: '0 KH/s',
                avHashrate: '0 KH/s',
                plHashrate: '0 KH/s',
                accepted: 0,
                rejected: 0,
                hardwareErr: 0,
                total: 0,
                rpm: -1,
                temperatue: '0 ℃'
              }
            }
          })

          _this.findMiner(Dev, function (data, err) {
            if (err) {
              Debug.IbctLogErr(__('查找矿机失败'), Dev.devID);
	            Device.mutex.unlock();
              return resolve(1);
            }
            _this.RunningMiner.push(Dev);
            Device.mutex.unlock();
            resolve(0);
          })
        }
      })
    })
  }
  async AddMiners(Devices) {
    for (var i = 0; i < Devices.length; i++) {
      await this.AddMiner(Devices[i]);
    }
  }
  async connectMiner(Device) {
    var ret;
    var dev;

    dev = this.GetMinerByDevID(Device.devID);
    if (!dev)
      return false

    ret = await this.DetectMiner(dev, dev.dev.miningName);
    if (ret) {
      this.emit("error", __('探测矿机失败'), null, dev.devID);
      return false
    }
    ret = await this.controlMinerSN(dev);
    if (ret) {
      this.emit("error", __('处理矿机条码失败'), null, dev.devID);
      return false
    }
    return true
  }
  async connectMiners(Devices) {
    for (var i = 0; i < Devices.length; i++) {
      await this.connectMiner(Devices[i]);
    }
  }
  async RemoveMiner(Device) {
    var _this = this;
    var dev = null;

    await Device.mutex.lock(async () => {
      if (_this.HasExistMiner(Device)) {
        dev = _this.GetMinerByDevID(Device.devID);
        if (!dev)
          return;

        dev.dev.mutex.lock(async () => {
          if (dev) {
            if (_this.GetMinerRunningStatus(dev)) {
              await _this.StopMinerThread(dev, true);
              _this.SetMinerRunningStatus(dev, false);
            } else {
              // throngh have stop miner, but need to remove miner totally
              dev.dev.miner.removeAllListeners("error");
              dev.dev.miner.removeAllListeners("warning");
              await _this.ReleaseMiner(dev);
            }
          }

          _this.RunningMiner = _this.RunningMiner.filter(function (dev) {
            if (dev.devID !== Device.devID) {
              return true;
            } else {
              return false;
            }
          });
          // dev.dev.mutex.resetQueue();
          dev.dev.mutex._waiting = [];
          dev.dev.mutex.unlock();
        })
      }
      Device.mutex.unlock();
    })
  }
  async RemoveMiners(Devices) {
    var _this = this;
    for (var i = 0; i < Devices.length; i++) {
      await _this.RemoveMiner(Devices[i]);
    }
  }
  RebootMiner(Device) {
    var dev;
    dev = this.GetMinerByDevID(Device.devID);
    if (!dev)
      return null;
    // reboot miner may cause usb plug-in & plug-out
    this.RebootHWMiner(dev);
  }
  RebootMiners(Devices) {
    var _this = this;
    Devices.forEach(function (Device, index) {
      _this.RebootMiner(Device);
    })
  }
  SetMinerLed(Device, Enable) {
    var dev = this.GetMinerByDevID(Device.devID);
    if (!dev)
      return null;
    this.SetMinerLedStatus(dev, Enable);
  }
  SetMinersLed(Devices, Enable) {
    var _this = this;
    Devices.forEach(function (Device, index) {
      _this.SetMinerLed(Device, Enable);
    })
  }

  CheckFirmware(Device, Image, Callback) {
    var temp = Buffer.from(Image, 0, 64);
    var head = {
      magic: 0,
      model_name: null,
      version: null,
      crc: 0,
      res: null
    }
    if (!Image)
      return Callback(__('非法固件，请联系Intchains'));

    if (Device.dev.miningName === 'Goldshell-HS1-Plus') {
      head.magic = temp.readUInt32LE(0);
      head.model_name = temp.toString('utf8', 4, 23);
      head.version = temp.toString('utf8', 24, 31);
      head.crc = temp.readUInt32LE(32);
      head.res = temp.toString('utf8', 36, 63);
    } else {
      head.magic = temp.readUInt32LE(0);
      head.model_name = temp.toString('utf8', 4, 19);
      head.version = temp.toString('utf8', 20, 27);
      head.crc = temp.readUInt32LE(28);
      head.res = temp.toString('utf8', 32, 63);
    }

    if (head.magic !== 0x20190428)
      return Callback(__('非法固件，请联系Intchains'));

    if (head.model_name.split('\0')[0] !== Device.dev.miningName)
      return Callback(__('矿机对应固件版本错误，请联系Intchains'));
    var crcValue = crc32(Image.slice(64));
    if (parseInt('0x' + crcValue, 16) !== head.crc)
      return Callback(__('非法固件，请联系Intchains'));
    Debug.IbctLogDbg('Burn Image Check OK');
    return Callback(null);
  }
  async BurnMinerFirmware(Device, Image, Callback) {
    var _this = this;
    var dev = this.GetMinerByDevID(Device.devID);
    if (!dev)
      return;
    if (dev.dev.miningName === 'unknow')
      return;
    await this.DisableMiner(dev);
    this.SetMinerRunningState(dev, 'burn');

    this.CheckFirmware(dev, Image, function(err) {
      if (err) {
        Callback(err)
        return
      }
      _this.UpdateMinerImage(dev, Image.slice(64), Callback);
    })
  }
  async BurnMinersFirmware(Devices, Image, Callback) {
    for (var i = 0; i < Devices.length; i++) {
      await this.BurnMinerFirmware(Devices[i], Image, Callback);
    }
  }
}

module.exports = function RunMiner(options = {}) {
  return new Miner(options);
};
