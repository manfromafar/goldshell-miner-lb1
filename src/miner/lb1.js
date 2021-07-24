const Delimiter = require('@serialport/parser-delimiter');
const Debug = require('../log')();
var SerialPort = require('serialport');
const EventEmitter = require('events');
var waitUntil = require('../waitUntil');
var crc32 = require('crc32');
const COMP = '[LB1]:';

const hwTarget = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x33, 0x33, 0x33, 0x33, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                            0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

const PV = 0x10;
const TypeSetBootMode = 0xA3;
const TypeUpdateFW = 0xAA;
const TypeQueryInfo = 0xA4;
const TypeProductTest = 0xAB;
const TypePlt = 0xAD
const TypeSetLED = 0xA6;
const TypeSendWork = 0xA1;
const TypeSetHWParams = 0xA2;
const TypeReboot = 0xAC;
const TypeRecvNonce = 0x51;
const TypeRecvJob = 0x55;
const TypeRecvState = 0X52;
const TypeRecvBootMode = 0x53;
const TypeRecvInfo = 0x54;
const TypeRecvFWState = 0x5A;
const TypeRecvTestResult = 0x5B;
const TypeRecvPltResult = 0x5D

const pktHeader = Buffer.from([0xA5, 0x3C, 0x96]);
const pktEnder = Buffer.from([0x69, 0xC3, 0x5A]);
const typeOffset = 0;

const lb1cfg = {
    model: "Goldshell-LB1",
    algo: "lbry",
    varity: 0x00,
    targetFreq: 750,  //MHz
    targetVoltage: 430, //mv
    targetTemp: 65,
    warnTemp: 115,
    offTemp: 125
};

class lb1 extends EventEmitter {
    constructor({devPath, algo, varity, crypto}) {
        super();
        var _this = this;

        _this.devPath = devPath;
        _this.algo = algo;
        _this.crypto = crypto;
        _this.MinerShouldStop = false;
        _this.inited = false;
        _this.txTimeoutCnt = 0;
        _this.work = [{ jobID: 0 }, { jobID: 0 }, { jobID: 0 }, { jobID: 0 }, { jobID: 0 }, { jobID: 0 }, { jobID: 0 }, { jobID: 0 }];
        _this.Job = [];
        _this.fakeJob = { overScan:false };
        _this.job_id = null;

        _this.info = {
            firmwareVer: 'V0.0.1',
            modelName: 'Goldshell-LB1',
            sn: 'unknown',
            mc: 'unknown',
            snAbbr: 'LB10',
            workDepth: 8
        };

        _this.firmware = {
            retryCnt : 2,
            FWPageSize : 256,
            curState : 0,
            curID : 0
        }
        _this.submitNonce = null;
        _this.curJobid = 1;
        _this.jobsDone = 0;

        _this.status = {
            chips:0,
            temp:0,
            voltage:0,
            freq:0,
            varity:0x0,
            cores:0,
            goodcores:0,
            scanbits:0,
            scantime:0,
            tempwarn:0,
            fanwarn:0,
            powerwarn:0,
            rpm:0
        };

        _this.plt = {
          chipid: 0,
          reason: ''
        }

        _this.port = new SerialPort(_this.devPath, {
            baudRate: 115200,
            dataBits:8,
            stopBits:1,
            parity:'none',
            rtscts:false
        }, function (err) {
            if (err) {
                Debug.IbctLogErr(COMP, _this.devPath, '打开串口失败: ', err.message);
                return;
            } else
                Debug.IbctLogErr(COMP, _this.devPath, '打开串口成功');

        });

        const parser = _this.port.pipe(new Delimiter({ delimiter: pktEnder}));
        parser.on('data', function(data) {
            _this.lb1ParseNotify(_this, data);
        });

        _this.on("error", function(err) {
            Debug.IbctLogDbg(COMP, err);
        })

        _this.on("warning", function(err) {
            Debug.IbctLogDbg(COMP, err);
        })
    }

    lb1ParseNotify(_this, data) {
        //Debug.IbctLogInfo(COMP, _this.devPath, 'Recv Pkt',  data.toString('hex'));
        var location = data.indexOf(pktHeader);
        if(location === -1) {
            Debug.IbctLogErr(COMP, _this.devPath, 'Recv Invalid PKT', data);
            return;
        }
        var typeLocation = location + pktHeader.length + typeOffset;
        switch(data[typeLocation]) {

            case TypeRecvNonce:
                var jobID = data[9];
                //var chipID = data[10];
                //var coreID = data[11];
                var nonce_l = data.readUInt32LE(12);
                var tt = data.readUInt32LE(16);
                var nonce = Buffer.alloc(8, 0);
                nonce.writeUInt32LE(nonce_l, 0);
                nonce.writeUInt32LE(tt, 4);
                if(jobID !== _this.work[0].jobID &&
                   jobID !== _this.work[1].jobID &&
                   jobID !== _this.work[2].jobID &&
                   jobID !== _this.work[3].jobID &&
                   jobID !== _this.work[4].jobID &&
                   jobID !== _this.work[5].jobID &&
                   jobID !== _this.work[6].jobID &&
                   jobID !== _this.work[7].jobID) {
                    Debug.IbctLogDbg(COMP, _this.devPath, 'Find Stale ', jobID, _this.work[0].jobID, _this.work[1].jobID, nonce.toString('hex'));
                } else {
                    //console.log("noncel", nonce_l.toString(16));
                    //console.log("ntime", ntime.toString(16));
                    //Debug.IbctLogDbg(COMP, _this.devPath, 'Find Nonce ', nonce.toString('hex'));
                    let i;
                    if (jobID === _this.work[0].jobID) i = 0;
                    else if (jobID === _this.work[1].jobID) i = 1;
                    else if (jobID === _this.work[2].jobID) i = 2;
                    else if (jobID === _this.work[3].jobID) i = 3;
                    else if (jobID === _this.work[4].jobID) i = 4;
                    else if (jobID === _this.work[5].jobID) i = 5;
                    else if (jobID === _this.work[6].jobID) i = 6;
                    else i = 7;

                    if(_this.submitNonce)
                        _this.submitNonce(null, nonce, _this.Job[i]);
                }
                break;

            case TypeRecvInfo:
                _this.recvInfoPkt = true;
                //Debug.IbctLogDbg(COMP, _this.devPath, 'RecvInfoPkt:', data.toString('hex'));
                _this.info.modelName = data.toString('utf8', 10, 10 + data[9]);
                _this.info.firmwareVer = data.toString('utf8', 27, 27 + data[26]);
                _this.info.sn = data.toString('utf8', 36, 36 + data[35]);
                _this.info.mc = data.toString('utf8', 53, 55);
                _this.info.snAbbr = 'LB10';
                //console.log(_this.info);
                break;

            case TypeRecvFWState:
                _this.recvFWStatePkt = true;
                _this.firmware.curID = data.readUInt32LE(9);
                _this.firmware.curState = data[13];
                break;

            case TypeRecvJob:
                _this.recvJobPkt = true;
                break;

            case TypeRecvBootMode:
                _this.recvBootModePkt = true;
                break;

            case TypeRecvPltResult:
                _this.recvPltPkt = true;
                _this.plt.chipid = data[9];
                _this.plt.reason = data.toString('utf8', 10, 11);
                break;

            case TypeRecvState:
                _this.recvStatePkt = true;
                _this.recvQueryStatePkt = true;
                //Debug.IbctLogInfo(COMP, _this.devPath, 'RecvState pkt:', data.toString('hex'));
                _this.status.chips = data[9];
                _this.status.cores = data[10];
                _this.status.goodcores = data[11];
                _this.status.scanbits = data[12];
                _this.status.scantime = data.readUInt16LE(13) * 100; //ms
                _this.status.voltage = data.readUInt16LE(15); //mV
                _this.status.freq = data.readUInt16LE(17); //MHz
                _this.status.varity = data.readUInt32LE(19);
                _this.status.temp = data[23];
                _this.status.hwreboot = data[24];
                _this.status.tempwarn = data[25];
                _this.status.fanwarn = data[26];
                _this.status.powerwarn = data[27];
                _this.status.rpm = data.readUInt16LE(28);
                break;

            case TypeRecvTestResult:
                _this.recvPTInfoPkt = true;
                break;

            default:
                Debug.IbctLogErr(COMP, _this.devPath, 'Recv Unsupported PKT Type', data[location + typeOffset])
                break;
        }
        return;
    }

    lb1SendPkt (pkt) {
        var _this = this;
        var offset = 0;
        var length = 0;
        Object.keys(pkt).forEach(function(key) {
            if(Buffer.isBuffer(pkt[key])) {
                length += pkt[key].length;
            }
        });

        var msg = Buffer.alloc(length);

        Object.keys(pkt).forEach(function(key) {
          if(Buffer.isBuffer(pkt[key])) {
            pkt[key].copy(msg, offset);
            offset += pkt[key].length;
          }
        });

        //Debug.IbctLogDbg(COMP, _this.devPath, 'Send pkt', msg.toString('hex'));
        _this.port.write(msg, function(err) {
            if (err) {
                Debug.IbctLogErr(COMP, _this.devPath, 'Error on write: ', err.message)
            }
            _this.port.drain(function(err) {
                if (err) {
                    Debug.IbctLogErr(COMP, _this.devPath, 'Error on Drain: ',  _this.devPath, err.message)
                  }
            })
        })
    }

    lb1GetState(_this) {
        var pktQueryStatus = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeSetHWParams]),
            version: Buffer.from([PV]),
            pktlen: Buffer.from([0x7, 0x0 ,0x0 ,0x0]),
            flag:Buffer.from([0x52]),
            ender:Buffer.from(pktEnder)
        };
        _this.recvQueryStatePkt = false;
        _this.lb1SendPkt(pktQueryStatus);
        /*TODO Wait response here*/
        return true;
    }

    async lb1GetStaticInfo(modelName) {
        var _this = this;
        var pktQueryInfo = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeQueryInfo]),
            version: Buffer.from([PV]),
            pktlen: Buffer.from([0x6, 0x0 ,0x0 ,0x0]),
            ender:Buffer.from(pktEnder)
        };
        _this.recvInfoPkt = false;
        _this.lb1SendPkt(pktQueryInfo);
        return new Promise(function (resolve, reject) {
            waitUntil()
            .interval(50)
            .times(10)
            .condition(function() {
                return  _this.recvInfoPkt
            })
            .done(function(result) {
                if(result === false) {
                    Debug.IbctLogErr(COMP, _this.devPath, '获取矿机信息出错');
                    resolve(2);
                } else {
                    if(modelName === _this.info.modelName) {
                        resolve(0);
                    } else {
                        resolve(1);
                    }
                }
            })
        });
    }

    lb1SetBootMode() {
        var _this = this;
        var pktSetBootMode = {
           header: Buffer.from(pktHeader),
           type: Buffer.from([TypeSetBootMode]),
           version: Buffer.from([PV]),
           pktlen: Buffer.from([0x7, 0x0 ,0x0 ,0x0]),
           ender:Buffer.from(pktEnder)
       };
       _this.recvBootModePkt = false;
       _this.lb1SendPkt(pktSetBootMode);
    }

    lb1BurnFWInit() {
        var _this = this;
        var pktSetBootMode = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeSetBootMode]),
            version: Buffer.from([PV]),
            pktlen: Buffer.from([0x6, 0x0 ,0x0 ,0x0]),
            ender:Buffer.from(pktEnder)
        };

       _this.recvBootModePkt = false;
       _this.lb1SendPkt(pktSetBootMode);
        return new Promise(function (resolve, reject) {
            waitUntil()
            .interval(20)
            .times(50)
            .condition(function() {
                return _this.recvBootModePkt
            })
            .done(function(result) {
                 if(result === false) {
                    resolve(1);
                 } else {
                    resolve(0);
                }
            })
        })
    }

    lb1SetHWParams(varity, freq, voltage) {
        var _this = this;
        var pktSetParam = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeSetHWParams]),
            version: Buffer.from([PV]),
            pktlen: Buffer.from([0x10, 0x00, 0x00, 0x00]),
            flag:Buffer.from([0xA2]),
            voltage: Buffer.alloc(2),
            freq:Buffer.alloc(2),
            varity:Buffer.alloc(4),
            targettemp:Buffer.from([80]),
            ender:Buffer.from(pktEnder)
        };

        pktSetParam.varity.writeUInt32LE(varity, 0);
        pktSetParam.freq.writeUInt16LE(freq, 0);
        pktSetParam.voltage.writeUInt16LE(voltage, 0);
        _this.recvStatePkt = false;
        _this.lb1SendPkt(pktSetParam);
        return true;
    }

    lb1SetHWParamsAndWait(varity, freq, voltage) {
        var _this = this;
        var pktSetParam = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeSetHWParams]),
            version: Buffer.from([PV]),
            pktlen: Buffer.from([0x10, 0x00, 0x00, 0x00]),
            flag:Buffer.from([0xA2]),
            voltage: Buffer.alloc(2),
            freq:Buffer.alloc(2),
            varity:Buffer.alloc(4),
            targettemp:Buffer.from([80]),
            ender:Buffer.from(pktEnder)
        };
        pktSetParam.varity.writeUInt32LE(varity, 0);
        pktSetParam.freq.writeUInt16LE(freq, 0);
        pktSetParam.voltage.writeUInt16LE(voltage, 0);
        _this.recvStatePkt = false;
        _this.lb1SendPkt(pktSetParam);

        return new Promise(function (resolve, reject) {
            waitUntil()
            .interval(20)
            .times(50)
            .condition(function() {
                return _this.recvStatePkt
            })
            .done(function(result) {
                 if(result === false) {
                    Debug.IbctLogErr(COMP, _this.devPath, '设置矿机参数出错');
                    resolve(1);
                 } else {
                    resolve(0);
                }
            })
        })
    }

    async lb1WriteJob(jobID, snonce, enonce, target, data) {
        var _this = this;
        _this.recvJobPkt = false;
        var pktSendJob = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeSendWork]),
            version: Buffer.from([PV]),
            pktlen: Buffer.alloc(4),
            target:Buffer.alloc(8),
            startNonce: Buffer.alloc(8),
            endNonce:Buffer.alloc(8),
            jobNum: Buffer.from([1]),
            jobID: Buffer.alloc(1),
            jobData:Buffer.alloc(136),
            ender:Buffer.from(pktEnder)
        };

        pktSendJob.pktlen.writeUInt32LE(168, 0); //pktlen
        target.copy(pktSendJob.target, 0);
        snonce.copy(pktSendJob.startNonce, 0);
        enonce.copy(pktSendJob.endNonce, 0);
        pktSendJob.jobID[0] = jobID;
        data.copy(pktSendJob.jobData, 0);

        _this.lb1SendPkt(pktSendJob);
        return new Promise(function (resolve, reject) {
            waitUntil()
            .interval(40)
            .times(50)
            .condition(function() {
                return _this.recvJobPkt
            })
            .done(function(result) {
                 if(result === false) {
                    Debug.IbctLogErr(COMP, _this.devPath, '发送Work失败');
                    reject(new Error(__('发送Work失败')).message);
                 } else {
                    resolve(0);
                 }
            })
        })
    }

    lb1SendFWPktAndWait(cnt, FWPKT) {
        var _this = this;
            _this.recvFWStatePkt = false;
            _this.firmware.curState = 0;
            _this.firmware.curID = 0;
            _this.lb1SendPkt(FWPKT);
        return new Promise(function (resolve, reject) {
            waitUntil()
            .interval(20)
            .times(50)
            .condition(function() {
                return _this.recvFWStatePkt
            })
            .done(function(result) {
                 if(result === false) {
                    Debug.IbctLogErr(COMP, _this.devPath, '烧录连接超时');
                    reject(new Error(__('烧录连接超时')).message);
                 } else if(_this.firmware.curState === 0x02) {
                     if(cnt < _this.firmware.retryCnt){
                        resolve(1);
                     } else {
                        Debug.IbctLogErr(COMP, _this.devPath, '串口出错');
                        reject(new Error(__('串口出错')).message);
                    }
                 } else {
                    resolve(0);
                }
            })
        })
    }

    async stopScanWork() {
        var _this = this;
        Debug.IbctLogDbg(COMP, _this.devPath, 'stopScanWork ...');
        //_this.curJobid = 0;
        _this.MinerShouldStop = true;
    }

    async scanWork(workQueue, callback) {
        var _this = this;
        Debug.IbctLogInfo(COMP, _this.devPath, 'scanWork Begin ...');

        if (!_this.inited) {
            callback(null, null, null);
            return;
        }

        if(_this.status.scantime === 0) {
            _this.status.scantime = 6000;  //10s default
        }

        if (_this.MinerShouldStop) {
            _this.MinerShouldStop = false;
            if (_this.job_id === workQueue[0].job_id) {
                // new job arrived
                _this.fakeJob.overScan = false;
                // clean all workQueue
                workQueue.splice(0, workQueue.length);
                callback(null, null, _this.fakeJob);
                Debug.IbctLogDbg("new job arrived, scanWork again");
                return;
            }
        }
        _this.job_id = workQueue[0].job_id;

        for(let i = 0; i < _this.info.workDepth; i++) {
            _this.Job[i] = workQueue.pop();

            _this.work[i].target = Buffer.alloc(8);
            var target = _this.Job[i].target;
            if(Buffer.compare(hwTarget, target) > 0) {
                 hwTarget.copy(_this.work[i].target, 0);
                 _this.Job[i].hwTarget = hwTarget;
            } else {
                 target.copy(_this.work[i].target, 0);
                 _this.Job[i].hwTarget = target;
            }

            _this.work[i].target = _this.work[i].target.swap64();

            _this.work[i].highNonce = parseInt((_this.Job[i].snonce) / 0x100000000) >>> 0;
            _this.work[i].data = Buffer.from(_this.Job[i].data);

            _this.work[i].snonce = Buffer.alloc(8);
            _this.work[i].snonce.writeUInt32LE(0, 0);
            _this.work[i].snonce.writeUInt32LE(_this.work[i].highNonce, 4);
            //Job.data.copy(_this.work[i].payload, 0);
            //Debug.IbctLogDbg(COMP, _this.work[i].payload.toString('hex'));

            _this.work[i].enonce = Buffer.alloc(8);
            _this.work[i].enonce.writeUInt32LE(0xffffffff, 0);
            _this.work[i].enonce.writeUInt32LE(0x00000000, 4);
            //_this.work[i].enonce.writeUInt32LE(_this.work[i].highNonce + 32, 4);

            _this.submitNonce = callback;
            // _this.MinerShouldStop = false;
            _this.jobsDone++;

            _this.work[i].jobID = _this.curJobid;
            _this.curJobid = (_this.curJobid + 1) & 0xff;
            if (!_this.curJobid) _this.curJobid = 1;
            /*
            Debug.IbctLogInfo(COMP, _this.devPath, 'Work Target:', _this.work[i].target.toString('hex'),
                                         'Work highNonce:', _this.work[i].highNonce.toString(16),
                                         'Work jobID:', _this.work[i].jobID);
            */

            await _this.lb1WriteJob(_this.work[i].jobID, _this.work[i].snonce, _this.work[i].enonce, _this.work[i].target, _this.work[i].data);
        }

        var interval = 50; //ms
        var times = 6000 / interval;

        waitUntil()
            .interval(interval)
            .times(times)
            .condition(function() {
                return _this.MinerShouldStop
            })
             .done(function(result) {
                Debug.IbctLogDbg(COMP, _this.devPath, 'ScanWork Exit', result ? "(NewJob)...": "(ScanTime Out)...");
                if (result === false)
                    _this.fakeJob.overScan = true;
                else
                    _this.fakeJob.overScan = false;
                callback(null, null, _this.fakeJob);
            });
    }

    async setDevice(varity, freq, voltage) {
        var _this = this;
        _this.lb1SetHWParams(varity, freq, voltage);
    }

    getInfo() {
        var _this = this;
        return _this.info;
    }

    getPlt() {
        var _this = this
        return _this.plt
    }

    getState() {
        var _this = this;
        return _this.status;
    }

    async detect(modelName) {
        var _this = this;
        Debug.IbctLogErr(COMP, _this.devPath, 'lb1 detect...');
        return await _this.lb1GetStaticInfo(modelName);
    }

    async init(params) {
        var _this = this;
        Debug.IbctLogErr(COMP, _this.devPath, 'lb1 init...');
        if(_this.firmware.updating === true){
            Debug.IbctLogErr(COMP, _this.devPath, 'Still Updating');
            return 1;
        }
        if( _this.inited === true){
            Debug.IbctLogErr(COMP, _this.devPath, 'Already Inited. return now');
            return 0;
        }

        //_this.lb1SetHWParams(lb1cfg.varity, lb1cfg.targetFreq, lb1cfg.targetVoltage);
        var ret = await _this.lb1SetHWParamsAndWait(_this.varity, lb1cfg.targetFreq, lb1cfg.targetVoltage);
        if (ret)
            return ret;

        if (_this.intervalObj) {
             clearInterval(_this.intervalObj);
             _this.intervalObj = null;
         }

        _this.intervalObj = setInterval(function() {
            Debug.IbctLogErr(COMP, _this.devPath, 'Temp', _this.status.temp, 'RPM', _this.status.rpm, 'Tempwarn', _this.status.tempwarn, 'Fanwarn', _this.status.fanwarn, 'Powerwarn', _this.status.powerwarn,'Freq', _this.status.freq, 'Jobs', _this.jobsDone);
            _this.lb1GetState(_this);
            waitUntil()
            .interval(50)
            .times(10)
            .condition(function() {
                return  _this.recvQueryStatePkt
            })
            .done(function(result) {
                if(result === false) {
                    _this.txTimeoutCnt++;
                    Debug.IbctLogErr(COMP, _this.devPath, 'lb1GetState Timeout ', _this.txTimeoutCnt);
                    if(_this.txTimeoutCnt > 10) {
                        _this.emit("error", __('获得矿机状态超时'));
                        _this.txTimeoutCnt = 0;
                    }
                } else {
                    _this.txTimeoutCnt = 0;

                    if(_this.status.fanwarn)
                         _this.emit("error", __('矿机风扇异常'));

                    if(_this.status.powerwarn)
                         _this.emit("error", __('矿机电源异常'));

                    if((_this.status.temp > lb1cfg.offTemp) || (_this.status.tempwarn)) {
                         _this.emit("error", __('矿机高温关机'));
                    } else if(_this.status.temp > lb1cfg.warnTemp && _this.status.temp < lb1cfg.offTemp) {
                        _this.emit("warning", __('矿机高温警报'));
                    }
                }
            });
        }, 5000);
        _this.inited = true;
        return 0;
    }

    async stop(enable, wait) {
        var _this = this;
        Debug.IbctLogErr(COMP, _this.devPath, 'lb1', enable ? 'remove...' : 'stop...');
        if (!enable) {
            await _this.lb1SetHWParamsAndWait(0, 0, 0);
        }
        _this.inited = false;
        _this.txTimeoutCnt = 0;
        _this.freq = 0;
        _this.voltage = 0;
        _this.work.jobID = 0;
        _this.jobsDone = 0;
        _this.MinerShouldStop = true;

        if (_this.intervalObj) {
            clearInterval(_this.intervalObj);
            _this.intervalObj = null;
        }
        if (enable) {
            if (wait) {
                await _this.port.flush(function (err) {
                    _this.port.close(function(err) {
                        if(err)
                            Debug.IbctLogDbg(COMP, err.message);
                    });
                });
            } else {
                await this.port.flush()
                await this.port.close(function(err) {
                    if(err)
                        Debug.IbctLogDbg(COMP, err.message);
                });
                return new Promise(function (resolve) {
                    waitUntil()
                    .interval(10)
                    .times(50)
                    .condition(function() {
                        return !_this.port.isOpen;
                    })
                    .done(function() {
                        resolve(0);
                    })
                })
            }
        }
    }

    async burnFirmware(firmWare, callback) {
        var _this = this;
        var firmware;
        if(_this.firmware.updating === true) {
            callback(__('升级中，请等待'));
            return;
        }

        if(_this.inited === true) {
            callback(__('挖矿中，请先暂停挖矿'));
            return;
        }

        var ret = await _this.lb1GetStaticInfo(lb1cfg.model);
        if (ret) {
            callback(__('无法获取当前版本号'));
            return;
        } else {
            var info = _this.getInfo();
            if (info.mc === 'm1') {
                firmware = firmWare.slice(0, 114689);
            } else if (info.mc === 'm2') {
                firmware = firmWare.slice(114689);
            } else {
                return;
            }
        }

        var init = await _this.lb1BurnFWInit();
        if(init === 0) {
            _this.firmware.updating = true;
        } else {
            _this.firmware.updating = false;
            callback(__('烧入固件初始化失败'));
            return;
        }
        var fwLen = firmware.length;
        var totalPktNum = Math.ceil(firmware.length / _this.firmware.FWPageSize)
        var id = 0;
        Debug.IbctLogErr(COMP, _this.devPath, 'BurnFW, CurVersion:', _this.info.firmwareVer, 'FW lenth' , fwLen , "PKTnum", totalPktNum);
        try {
            while(fwLen > 0) {
                var currentLen = (fwLen > _this.firmware.FWPageSize) ?  _this.firmware.FWPageSize : fwLen;
                var curStart = firmware.length - fwLen;
                var curEnd = curStart + currentLen;

                var pktUpdateFW = {
                    header: Buffer.from(pktHeader),
                    type: Buffer.from([TypeUpdateFW]),
                    version: Buffer.from([PV]),
                    pktLen: Buffer.alloc(4),
                    pktID:Buffer.alloc(4),
                    pageSize:Buffer.alloc(4),
                    curLen:Buffer.alloc(4),
                    flag:Buffer.alloc(1),
                    crc32: Buffer.alloc(4),
                    fwData:Buffer.alloc(currentLen),
                    ender:Buffer.from(pktEnder)
                };
                pktUpdateFW.curLen.writeUInt32LE(currentLen, 0);
                pktUpdateFW.pktID.writeUInt32LE(id, 0);
                pktUpdateFW.pageSize.writeUInt32LE(_this.firmware.FWPageSize, 0);
                pktUpdateFW.pktLen.writeUInt32LE(23 + currentLen);
                firmware.copy(pktUpdateFW.fwData, 0, curStart, curEnd);
                fwLen -= currentLen;

                if(fwLen) {
                    pktUpdateFW.flag[0] = 0x00;
                } else {
                    pktUpdateFW.flag[0] = 0x01;//last
                }
                var msg = Buffer.alloc(23 + currentLen);
                //console.log('3====>', curStart, curEnd, currentLen, fwLen);
                pktUpdateFW.type.copy(msg, 0);
                pktUpdateFW.version.copy(msg, 1);
                pktUpdateFW.pktLen.copy(msg, 2);
                pktUpdateFW.pktID.copy(msg, 6);
                pktUpdateFW.pageSize.copy(msg, 10);
                pktUpdateFW.curLen.copy(msg, 14);
                pktUpdateFW.flag.copy(msg, 18);
                pktUpdateFW.crc32.copy(msg, 19);
                pktUpdateFW.fwData.copy(msg, 23);


                var crcValue = parseInt(crc32(msg), 16);
                pktUpdateFW.crc32.writeUInt32LE(crcValue, 0);
                for(var i = 0; i < _this.firmware.retryCnt; i++) {
                    var success = await _this.lb1SendFWPktAndWait(i + 1, pktUpdateFW);
                    if(success === 0)
                        break;
                }

                if(fwLen === 0) {
                    _this.firmware.updating = false;
                }
                callback(null, ((id + 1) / totalPktNum).toFixed(3));
                id++;
            }
        }
        catch(err) {
            Debug.IbctLogErr(COMP, _this.devPath, 'Updat firmware failed ' + err.message);
            _this.firmware.updating = false;
            callback(err.message);
        }
    }

    async rebootDev() {
        Debug.IbctLogErr(COMP, this.devPath,  'reboot');
        var _this = this;
        var pktReboot = {
           header: Buffer.from(pktHeader),
           type: Buffer.from([TypeReboot]),
           version: Buffer.from([PV]),
           pktlen: Buffer.from([0x6, 0x0 ,0x0 ,0x0]),
           ender:Buffer.from(pktEnder)
       };
       await _this.stop(true, true)
       _this.lb1SendPkt(pktReboot);
    }

    setPlt() {
        var _this = this
        console.log('function test')
        _this.recvPltPkt = false
        var pktPLT = {
          header: Buffer.from(pktHeader),
          type: Buffer.from([TypePlt]),
          version: Buffer.from([PV]),
          pktlen: Buffer.from([0x6, 0x0, 0x0, 0x0]),
          ender: Buffer.from(pktEnder)
        }

        _this.lb1SendPkt(pktPLT)
    }

    setLed(Enable) {
        Debug.IbctLogErr(COMP, 'Set', this.devPath, 'Led to', Enable ? 'ON' : 'OFF');
        var _this = this;
        var ledFlag = Enable === true ? 1 : 0;
        var pktSetLED = {
           header: Buffer.from(pktHeader),
           type: Buffer.from([TypeSetLED]),
           version: Buffer.from([PV]),
           pktlen: Buffer.from([0xb, 0x0 ,0x0 ,0x0]),
           Flag:Buffer.from([ledFlag]),
           led:Buffer.from([0xE8, 0x3, 0xC8, 0x0]), //ON 1s OFF:200ms
           ender:Buffer.from(pktEnder)
       };
       _this.lb1SendPkt(pktSetLED);
    }

    async burnSNInfo(ptinfo) {
        var _this = this
        Debug.IbctLogErr(COMP, _this.devPath, 'Burn Sn Num..', ptinfo)
        var pktPTInfo = {
            header: Buffer.from(pktHeader),
            type: Buffer.from([TypeProductTest]),
            version: Buffer.from([PV]),
            pktlen: Buffer.from([70, 0x0, 0x0, 0x0]),
            SNInfo: Buffer.alloc(32),
            HashInfo: Buffer.alloc(32),
            ender: Buffer.from(pktEnder)
        }
        if (ptinfo.sn) {
            var sn = Buffer.from(ptinfo.sn)
            pktPTInfo.SNInfo[0] = sn.length
            sn.copy(pktPTInfo.SNInfo, 1)
        } else {
            pktPTInfo.SNInfo[0] = 0
        }
        _this.recvPTInfoPkt = false;
        _this.lb1SendPkt(pktPTInfo)

        return new Promise(function (resolve, reject) {
            waitUntil()
                .interval(50)
                .times(10)
                .condition(function () {
                    return _this.recvPTInfoPkt
                })
                .done(function (result) {
                    if (result === false) {
                        Debug.IbctLogErr(COMP, _this.devPath, 'Burn SN num failed..')
                        resolve(__('写入SN序列号失败'))
                    } else {
                        resolve(null)
                    }
                })
        })
    }
}

module.exports = function Getlb1(options = {}) {
    return new lb1(options);
}
