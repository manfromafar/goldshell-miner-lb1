const Delimiter = require('@serialport/parser-delimiter');
const Debug = require('../log')();
var SerialPort = require('serialport');
const EventEmitter = require('events');
// var waitUntil = require('wait-until');
var waitUntil = require('../waitUntil');
var crc32 = require('crc32');
const COMP = '[UNKNOW]:';

const hwTarget = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                            0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

const PV = 0x10;
const TypeSetBootMode = 0xA3;
const TypeUpdateFW = 0xAA;
const TypeQueryInfo = 0xA4;
const TypeProductTest = 0xAB;
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

const pktHeader = Buffer.from([0xA5, 0x3C, 0x96]);
const pktEnder = Buffer.from([0x69, 0xC3, 0x5A]);
const typeOffset = 0;

class unknow extends EventEmitter {
    constructor({devPath, algo, varity, crypto}) {
        super();
        var _this = this;

        _this.devPath = devPath;
        _this.algo = algo;
        _this.crypto = crypto;
        _this.MinerShouldStop = false;
        _this.inited = false;
        _this.txTimeoutCnt = 0;
        _this.work = [{ jobID: 0 }, { jobID: 0 }, { jobID: 0 }, { jobID: 0 }];
        _this.Job = [];
        _this.fakeJob = { overScan:false };
        _this.job_id = null;

        _this.info = {
            firmwareVer: 'V0.0.1',
            modelName: 'unknow',
            sn:'unknown',
            hashRation:0,
            workDepth:4,
        };

        _this.firmware = {
            retryCnt : 2,
            FWPageSize : 256,
            curState : 0,
            curID : 0
        }
        _this.submitNonce = null;
        _this.curJobid = 4;
        _this.jobsDone = 0;

        _this.status = {
            chips:0,
            temp:0,
            voltage:0,
            freq:0,
            varity:0x4,
            cores:0,
            goodcores:0,
            scanbits:0,
            scantime:0,
            tempwarn:0,
            fanwarn:0,
            powerwarn:0,
            rpm:0
        };

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
            _this.unknowParseNotify(_this, data);
        });

        _this.on("error", function(err) {
            Debug.IbctLogDbg(COMP, err);
        })

        _this.on("warning", function(err) {
            Debug.IbctLogDbg(COMP, err);
        })
    }

    unknowParseNotify(_this, data) {
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
                var nonce_h = data.readUInt32LE(16);
                var nonce = Buffer.alloc(8);
                nonce.writeUInt32LE(nonce_l, 0);
                nonce.writeUInt32LE(nonce_h, 4);
                if(jobID !== _this.work[0].jobID && jobID !== _this.work[1].jobID && jobID !== _this.work[2].jobID && jobID !== _this.work[3].jobID) {
                    Debug.IbctLogDbg(COMP, _this.devPath, 'Find Stale ', jobID, _this.work[0].jobID, _this.work[1].jobID, nonce.toString('hex'));
                } else {
                    //Debug.IbctLogDbg(COMP, _this.devPath, 'Find Nonce ', nonce.toString('hex'));
                    let i;
                    if (jobID === _this.work[0].jobID) i = 0;
                    else if (jobID === _this.work[1].jobID) i = 1;
                    else if (jobID === _this.work[2].jobID) i = 2;
                    else i = 3;

                    if(_this.submitNonce)
                        _this.submitNonce(null, nonce, _this.Job[i]);
                }
                break;

            case TypeRecvInfo:
                _this.recvInfoPkt = true;
                //Debug.IbctLogDbg(COMP, _this.devPath, 'RecvInfoPkt:', data.toString('hex'));
                _this.info.modelName =  data.toString('utf8', 10, 10 + data[9]);
                _this.info.firmwareVer = data.toString('utf8', 43, 43 + data[42]);
                _this.info.sn = data.toString('utf8', 52, 52 + data[51]);
                _this.info.hashRation = data.readUInt16LE(85);
                //_this.info.workDepth = data[117];
                Debug.IbctLogDbg(_this.info);
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
                _this.status.fanwarn = data[26]
                // _this.status.powerwarn = data[27]
                _this.status.rpm = data.readUInt16LE(28)
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

    unknowSendPkt (pkt) {
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

    async stopScanWork() {
        var _this = this;
        Debug.IbctLogDbg(COMP, _this.devPath, 'stopScanWork ...');
        //_this.curJobid = 0;
        _this.MinerShouldStop = true;
    }

    async setDevice(varity, freq, voltage) {
        Debug.IbctLogDbg(COMP, 'setDevice');
    }

    getInfo() {
        return this.info;
    }

    getState() {
        return this.status;
    }

    async detect(modelName) {
        Debug.IbctLogErr(COMP, this.devPath, 'unknow detect...');
        return true;
    }

    async init(params) {
        Debug.IbctLogErr(COMP, this.devPath, 'unknow init...');
        return 0;
    }

    async stop(enable) {
        var _this = this;
        Debug.IbctLogErr(COMP, _this.devPath, 'unknow', enable ? 'remove...' : 'stop...');
        _this.inited = false;
        _this.txTimeoutCnt = 0;
        _this.freq = 0;
        _this.voltage = 0;
        _this.work.jobID = 0;
        _this.jobsDone = 0;
        _this.MinerShouldStop = true;

        if (enable) {
            await this.port.flush(function(err) {
                _this.port.close(function(err) {
                if(err)
                    Debug.IbctLogDbg(COMP, err.message);
                });
            })
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
       await _this.stop(true)
       _this.unknowSendPkt(pktReboot);
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
       _this.unknowSendPkt(pktSetLED);
    }
}

module.exports = function Getunknow(options = {}) {
    return new unknow(options);
}
