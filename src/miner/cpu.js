const EventEmitter = require('events');
const Debug = require('../log')();
const COMP = '[cpu]';

class cpu extends EventEmitter {
    constructor({
      devPath,
      algo,
      varity,
      crypto
    }) {
        super();
        var _this = this;

        _this.devPath = devPath;
        _this.algo = algo;
        _this.varity = varity;
        _this.crypto = crypto;
        _this.MinerShouldStop = false;
        _this.info = {
            firmwareVer: 'V0.0.1',
            modelName: 'cpu',
            sn:'CPU666666',
            hashRation: 0,
            workDepth:2,
        };

        _this.status = {
            chips:1,
            temp: 40,
            votage:1,
            freq:1000,
            varity:0x0,
            cores:1,
            goodcores:1,
            scanbits:0,
            scantime:0,
            tempwarn:80
        };
        Debug.IbctLogDbg(COMP, 'DevPath: ', _this.devPath, '; Miner：CPU; Algo：', _this.algo.getAlgoName(), '; Crypto: ', _this.crypto.getCryptoName());
    }


    async init(params) {
        /*
          初始化硬件

         */
        Debug.IbctLogDbg(COMP, 'CPU init');
    }

    async detect(modelName) {
        var _this = this;
        Debug.IbctLogErr(COMP,  'API: detect...', modelName);
        return 0;
    }

    getInfo() {
        var _this = this;
        return _this.info;
    }

    async setDevice() {
        /*
          设置Miner参数，电压, 频率，目标温度，报警温度。
        */
        Debug.IbctLogDbg(COMP, 'setDevice');
    }
    async stopScanWork() {
        this.MinerShouldStop = true;
    }
    async scanWork(workQueue, Callback) {
        /*
          更新Work
        */
        var _this = this;
        var result;
        var nonce = Buffer.alloc(8);
        //var highNonce = parseInt((Job.snonce) / 0x100000000) >>> 0;
        if (!_this.algo || !_this.crypto) {
            Callback('Set Algo or Crypto First');
            return
        }
        
        _this.MinerShouldStop = false;
         for(let i=0; i<_this.info.workDepth;i++) {
            Debug.IbctLogDbg(COMP, 'work', i, JSON.stringify(workQueue.pop()));
         }
        // _this.work = Job;
        // for (let lowNonce = 0; lowNonce < 0x5; lowNonce++) {
        //     //Debug.IbctLogDbg(COMP, 'algo', _this.algo.name.toString('hex'), 'scanWork ', i.toString('16'), '12: ', (Job.snonce + i).toString('16'));
        //     //nonce.writeUIntLE(((Job.snonce + i) & 0xffffffff), 0, 4);
        //     //nonce.writeUIntLE(Math.floor((Job.snonce + i) / 0x100000000), 4, 4);
        //     nonce.writeUInt32LE(highNonce, 4);
        //     nonce.writeUInt32LE(lowNonce, 0);
        //     if (_this.crypto.setWorkData) {
        //         _this.crypto.setWorkData(_this.work, 'start nonce', nonce);
        //     }
        //     if (_this.algo.genHash) {
        //         result = _this.algo.genHash(_this.work.data, _this.work.data.length, 0);
        //         Debug.IbctLogDbg(COMP, result, _this.crypto.checkHash(_this.work.target, Buffer.from(result, 'hex')));
        //         if (_this.crypto.checkHash && _this.crypto.checkHash(_this.work.target, Buffer.from(result, 'hex'))) {
        //             Debug.IbctLogDbg(COMP, 'find Nonce：', (Job.snonce + i).toString('16'));
        //             Callback(null, nonce, work);
        //         }
        //     }
        // }
        Callback(null, null,work);
    }
    async stop() {
        /*
          停止硬件工作并关闭硬件
        */
        Debug.IbctLogDbg(COMP, 'stop');
    }
    
    getState() {
        /*
        获取当前设备状态， 温度，电压，频率，功耗等
        */
       var _this = this;
        Debug.IbctLogDbg(COMP, 'getState');
        return _this.status;
    }
}
    
module.exports = function Getcpu(options = {}) {
    return new cpu(options);
};