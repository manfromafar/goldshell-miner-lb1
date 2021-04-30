const EventEmitter = require('events');
var multiHashing = require('ibctminerscrypt');
const Debug = require('../log')();
const COMP = '[lbc]';

class Lbc extends EventEmitter {
  constructor({}) {
    super();
    var _this = this;
    _this.nce2sz = 4;
    _this.nce1hex = null;
    _this.curdiff = 1;
    _this.cnt = 0;
  }

  stratum_subscribe(data) {
    //console.log(COMP, 'subscribe ++++++++', data);
    var _this = this;
    _this.nce1hex = data[1];
    _this.nce2sz = data[2];
    Debug.IbctLogDbg(COMP, 'subscribe',_this.nce1hex, _this.nce2sz);
    return 0;
  }

  stratum_diff(data) {
    var _this = this;
    _this.curdiff = data[0];
    Debug.IbctLogDbg(COMP, 'setdiff to', _this.curdiff);
    _this.curdiff /= 256.0;
    return 0;
  }

  stratum_notify(data) {
    var packet = {
      job_id: null,
      preHash: null,
      claimHash: null,
      coinb1: null,
      coinb2: null,
      merkleRoot: null,
      bbVersion: null,
      nbit: null,
      ntime: null,
      clean: null
    };
    //Debug.IbctLogDbg(COMP, JSON.stringify(packet));
    //console.log("*****stratum data", data);

    packet.job_id = data[0];
    packet.preHash = data[1];
    packet.claimHash = data[2];
    packet.coinb1 = data[3];
    packet.coinb2 = data[4];
    packet.merkleRoot = data[5];
    packet.bbVersion = data[6];
    packet.nbit = data[7];
    packet.ntime = data[8];
    packet.clean = true;
    packet.nonce2 = 0;
    //Debug.IbctLogDbg(COMP, 'stratum_notify', JSON.stringify(packet));
    return packet;
  }

  getCryptoName() {
    return 'lbc';
  }

  targetToDiff(target) {
    var Ntarget = parseInt('0x' + target, 16);
    var difficulty = Math.round(26959946667150639794667015087019630673637144422540572481103610249215.0 / Ntarget * 0xffffffff);
    return difficulty;
  }

  diffToTarget(difficulty) {
    var temp = Math.floor(0xffffffff / difficulty).toString(16);
    var target = Buffer.from('0'.repeat(16 - temp.length) + temp + 'f'.repeat(48), 'hex');
    return target;
  }

  JobtoWork(Job, Work) {
    if (!Job || !Work) {
      return false;
    }
    var _this = this;
    var s = [];
    //console.log(COMP, 'JobtoWork+++++', Job);

    const preHash = Buffer.from(Job.preHash, 'hex');
    const claimHash =  Buffer.from(Job.claimHash, 'hex');
    const coinb1 =  Buffer.from(Job.coinb1, 'hex');
    const coinb2 =  Buffer.from(Job.coinb2, 'hex');
    const merkleCount = Job.merkleRoot.length;
    const merkleRoot = Job.merkleRoot;
    //const bbVersion = parseInt('0x' + Job.bbVersion, 16);
    const ntime = Buffer.from(Job.ntime, 'hex');
    const nbit = Buffer.from(Job.nbit, 'hex');
    const bbVersion = Buffer.from(Job.bbVersion, 'hex');

    for (var i = 0; i < merkleCount; i++)
    {
        s[i] = Buffer.from(merkleRoot[i], 'hex');
    }
    //console.log("preHash", preHash.toString('hex'));
    //console.log("claimHash", claimHash.toString('hex'));
    //console.log("coinb1", coinb1.toString('hex'));
    //console.log("coinb2", coinb2.toString('hex'));
    //console.log("merklecount", merkleCount);
    //console.log("merkleroot", s);
    //console.log("ntime", ntime.toString('hex'));
    //console.log("nbit", nbit.toString('hex'));
    //console.log("bbversion", bbVersion.toString('hex'));

    var coinb1_size = coinb1.length;
    var coinb2_size = coinb2.length;
    var nonce1 = Buffer.from(_this.nce1hex, 'hex');
    //console.log("nonce1", nonce1.toString('hex'));
    var coinbase_size = coinb1_size + coinb2_size + nonce1.length + _this.nce2sz;
    //console.log("coinbase_size", coinbase_size);
    var coinbase = Buffer.alloc(coinbase_size, 0);
    coinb1.copy(coinbase, 0);
    nonce1.copy(coinbase, coinb1_size);
    var nonce2 = Buffer.alloc(4, 0);
    nonce2.writeUInt32BE(Job.nonce2);
    nonce2.copy(coinbase, coinb1_size + nonce1.length);
    coinb2.copy(coinbase, coinb1_size + nonce1.length + _this.nce2sz);
    //console.log("coinbase", coinbase.toString('hex'));
    var sha256d = multiHashing['sha256d'];
    var merkle_root = Buffer.alloc(64, 0);
    var m1 = sha256d(coinbase);
    //console.log("m 1", m1.toString('hex'));
    m1.copy(merkle_root, 0);
    //console.log("m 2", merkle_root.toString('hex'));

    var m2;
    for (var i = 0; i < merkleCount; i++)
    {
        s[i].copy(merkle_root, 32);
        //console.log("m", i, merkle_root.toString('hex'));
        m2 = sha256d(merkle_root);
        //console.log("m 2", m2.toString('hex'));
        m2.copy(merkle_root, 0);
        //console.log("*m", i, merkle_root.toString('hex'));
    }
    //console.log("merkleroot", merkle_root.toString('hex'));
    var merkle = Buffer.alloc(32);

    for(var i = 0; i < 8; i++)
    {
        merkle.writeUInt32BE(merkle_root.readUInt32LE(i*4), i*4);
    }
    //console.log("merkle    ", merkle.toString('hex'));


    //console.log("***Work", Work);
    Work.job_id = Job.job_id;
    //Work.snonce =  ntime * 0x100000000;
    Work.snonce = 0;
    Work.enonce = 0xffffffff;
    Work.nonce2 = Job.nonce2++;
    //console.log("nnnnnnonce2", Work.nonce2);
    Work.difficulty = _this.curdiff;
    Work.target = _this.diffToTarget(Work.difficulty);
    //Work.ntime = parseInt('0x' + Job.ntime, 16);
    Work.ntime = ntime;
    Work.clean = Job.clean;
    var data1 = Buffer.alloc(112, 0);
    bbVersion.copy(data1, 0);
    preHash.copy(data1, 4);
    merkle.copy(data1, 36);
    claimHash.copy(data1, 68);
    ntime.copy(data1, 100);
    nbit.copy(data1, 104);

    //console.log("data1", data1.toString('hex'));

    var data2 = Buffer.alloc(112, 0);

    for(var i = 0; i < 28; i++)
    {
        data2.writeUInt32BE(data1.readUInt32LE(i*4), i*4);
    }
    //console.log("data2", data2.toString('hex'));
    var genhash = multiHashing['lbcgenhash'];
    var prehash1 = genhash(data2);
    //console.log("prehash1", prehash1.toString('hex'));

    Work.data = Buffer.alloc(136, 0);
    Work.sdata = Buffer.alloc(112, 0);
    data2.copy(Work.sdata);
    var prehash2 = Buffer.alloc(32, 0);
    for(var i = 0; i < 8; i++)
    {
        prehash2.writeUInt32BE(prehash1.readUInt32LE(i*4), i*4);
    }
    //console.log("prehash2", prehash2.toString('hex'));
    prehash2.copy(Work.data, 0);
    data2.copy(Work.data, 32, 64);
    //console.log(COMP, 'JobtoWork+++++ WorkNonce2:', Work.nonce2, 'WorkData', Work.data.toString('hex'));
    return true;
  }

  setWorkData(work, mode, data) {
    //Debug.IbctLogInfo(COMP, 'setWorkData: ', data.toString('hex'));
    if (mode === 'start nonce') {
      // Debug.IbctLogDbg(COMP, ((data & 0xffffffff) >>> 0).toString('16'));
      // work.data.writeUIntLE((data & 0xffffffff), 0, 4);
      // Debug.IbctLogDbg(COMP, (Math.floor(data / 0x100000000) >>> 0).toString('16'));
      // work.data.writeUIntLE(Math.floor(data / 0x100000000), 4, 4);
      data.copy(work.data, 0);
    }
  }

  checkHash(target, hash) {
    //Debug.IbctLogDbg(COMP, 'checkHash', 'target', target.toString('hex'), hash.toString('hex'));
    this.cnt++;
    if (this.cnt === 1) {
        if(Buffer.compare(target, hash) > 0) {
            return true;
        } else {
            this.cnt = 0;
            return false;
        }
    } else if (this.cnt === 2) {
        this.cnt = 0;
        return Buffer.compare(this.diffToTarget(this.curdiff), hash) > 0;
    }
  }

  reverseBuffer(src) {
    const buffer = Buffer.alloc(src.length);
    for (let i = 0, j = src.length - 1; i <= j; ++i, --j) {
      buffer[i] = src[j];
      buffer[j] = src[i];
    }
    return buffer;
  }

  calHash(Device, nonce) {
    var work = Device.dev.work;
    var data = Buffer.from(work.sdata);
    var algo = Device.dev.algorithm;
    var result = null;

    //console.log("$$$$$$$$$$$$$", data.toString('hex'));

    if (!algo) return false;

    //Debug.IbctLogDbg(COMP, 'calHash++ Worknonce2', work.nonce2, 'data', data.toString('hex'));

    nonce.copy(data, 108);
    var tt = nonce.readUInt32LE(4);
    var ntime = data.readUInt32LE(100);
    ntime += tt;
    data.writeUInt32LE(ntime, 100);
    //console.log("(((((((((((((", data.toString('hex'));
    result = algo.genHash(data);
    //console.log("result", result.toString('hex'));
    return this.reverseBuffer(result);
  }

  getSubmitParams(Device, nonce, hash) {
    var nce2hex = Buffer.alloc(4);
    var nce = this.reverseBuffer(Buffer.from(nonce.slice(0,8), 'hex'));
    var ntime = Device.dev.work.ntime.readUInt32BE(0);
    var tt = this.reverseBuffer(Buffer.from(nonce.slice(8,16), 'hex'));
    var tt1 = tt.readUInt32BE(0);
    ntime += tt1;
    var ntime1 = Buffer.alloc(4);
    ntime1.writeUInt32BE(ntime, 0)
    nce2hex.writeUInt32BE(Device.dev.work.nonce2, 0);
    var submit = [Device.dev.pool.user, Device.dev.work.job_id, nce2hex.toString('hex'),  ntime1.toString('hex'), nce.toString('hex')];
    //console.log(COMP,  'getSubmitParams+++', JSON.stringify(submit));

    return submit;
  }
};

module.exports = function GetLbc(options = {}) {
  return new Lbc(options);
};
