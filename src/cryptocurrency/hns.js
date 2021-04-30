const EventEmitter = require('events');
const Debug = require('../log')();
const BLAKE2B = require('../algo/base/blake2b');
const COMP = '[hns]';

class Hns extends EventEmitter {
  constructor({ }) {
    super();
    var _this = this;
    _this.nce2sz = 24;
    _this.nce1hex = null;
    _this.curdiff = 1;
  }

  stratum_subscribe(data) {
    //Debug.IbctLogDbg(COMP, 'subscribe ++++++++');
    var _this = this;
    _this.nce1hex = data[1];
    //_this.nce2sz = data[2];
    Debug.IbctLogDbg(COMP, 'subscribe',_this.nce1hex, _this.nce2sz);
    return 0;
  }

  stratum_diff(data) {
    var _this = this;
    _this.curdiff = data[0];
    Debug.IbctLogDbg(COMP, 'setdiff to', _this.curdiff);
    return 0;
  }

  stratum_notify(data) {
    var packet = {
      job_id: null,
      preHash: null,
      merkleRoot: null,
      witnessRoot: null,
      treeRoot: null,
      reserveRoot: null,
      bbVersion: null,
      nbit: null,
      ntime: null,
      clean: null
    };
    //Debug.IbctLogDbg(COMP, 'hns', JSON.stringify(packet));
    packet.job_id = data[0];
    packet.preHash = data[1];
    packet.merkleRoot = data[2];
    packet.witnessRoot = data[3];
    packet.treeRoot = data[4];
    packet.reserveRoot = data[5];
    packet.bbVersion = data[6];
    packet.nbit = data[7];
    packet.ntime = data[8];
    packet.nonce2 = 0;
    packet.clean = true;
    //Debug.IbctLogDbg(COMP, 'stratum_notify', JSON.stringify(packet));
    return packet;
  }

  getCryptoName() {
    return 'hns';
  }

  padding(size, prevBlock, treeRoot) {
    const pad = Buffer.alloc(size);
    for (let i = 0; i < size; i++)
      pad[i] = prevBlock[i % 32] ^ treeRoot[i % 32];
    return pad;
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
    Debug.IbctLogInfo(COMP, 'JobtoWork+++++', JSON.stringify(Job));
    
    const preHash = Buffer.from(Job.preHash, 'hex');
    const treeRoot =  Buffer.from(Job.treeRoot, 'hex');
    const reserveRoot =  Buffer.from(Job.reserveRoot, 'hex');
    const witnessRoot =  Buffer.from(Job.witnessRoot, 'hex');
    const merkleRoot = Buffer.from(Job.merkleRoot, 'hex');
    const ntime = parseInt('0x' + Job.ntime, 16);
    const nbit = parseInt('0x' + Job.nbit, 16);
    const bbVersion = parseInt('0x' + Job.bbVersion, 16);
    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    // For Stratum test
    // const preHash = Buffer.from('000000000000025a108f1cb72ba240f4ba7a328335df544b51576de46f32a1d2', 'hex');
    // const treeRoot =  Buffer.from('6818edbdbf9d45e6ee969f190fea65f282c35704a2ca9de702e732dba1331853', 'hex');
    // const reserveRoot =  Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
    // const witnessRoot = Buffer.from('51cb87c5c422ad753accd7743d6cd9cc6dd54e88c57419b802e1dd88fbac86ae', 'hex');
    // const merkleRoot = Buffer.from('39aeb10e8a858e53c81a7af2b44abc7dffd5b24227d092148b8480f28332ddef', 'hex');
    // const ntime = 0x5ed7427a;
    // const nbit = 0x1a0350df
    // _this.nce1hex = '02cea75b';
    // Job.nonce2 = 1;
    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    const mask = Buffer.alloc(32);
    const subHead = Buffer.alloc(128);
    const extraNonce = Buffer.alloc(_this.nce2sz);
    const pad20 = _this.padding(20, preHash, treeRoot); 
    const maskHash = BLAKE2B.multi(preHash, mask, 32);
    extraNonce.writeUInt32BE(parseInt(_this.nce1hex, 16), 0);
    extraNonce.writeUInt32BE(Job.nonce2, 4);
    extraNonce.copy(subHead, 0);
    reserveRoot.copy(subHead, 24);
    witnessRoot.copy(subHead, 56);
    merkleRoot.copy(subHead, 88);
    subHead.writeUInt32LE(bbVersion, 120);
    subHead.writeUInt32LE(nbit, 124);
    //Debug.IbctLogDbg(COMP, 'JobtoWork+++++ extraNonce', extraNonce.toString('hex'));
    //Debug.IbctLogDbg(COMP, 'JobtoWork+++++ subHead', subHead.toString('hex'));
    //Debug.IbctLogDbg(COMP, 'JobtoWork+++++ pad20', pad20.toString('hex'));

    const subHeader = BLAKE2B.digest(subHead, 32);
    const commitHash = BLAKE2B.multi(subHeader, maskHash, 32);
    Work.job_id = Job.job_id;
    Work.snonce =  ntime * 0x100000000;
    Work.enonce =  0;
    Work.nonce2 = Job.nonce2++;
    Work.difficulty = _this.curdiff;
    Work.target = _this.diffToTarget(Work.difficulty);
    Work.ntime = ntime;
    Work.clean = Job.clean;
    
    ////////////////////////////////
    //make work data //
    Work.data = Buffer.alloc(128);
    Work.data.writeUInt32LE(0,  0);
    Work.data.writeUInt32LE(Work.ntime,  4);
    pad20.copy(Work.data, 12);
    preHash.copy(Work.data, 32);
    treeRoot.copy(Work.data, 64);
    commitHash.copy(Work.data,96);
    //Debug.IbctLogDbg(COMP, 'JobtoWork+++++ WorkNonce2:', Work.nonce2, 'WorkData', Work.data.toString('hex'));
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
    return Buffer.compare(target, hash) > 0;
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
    var data = Buffer.from(work.data);
    var algo = Device.dev.algorithm;
    //var data = Buffer.from(work.data);
    var result = null;
  
    if (!algo) {
      return false;
    }
    
    //Debug.IbctLogDbg(COMP, 'calHash++ Worknonce2', work.nonce2, 'data', data.toString('hex'));
 
    nonce.copy(data, 0);
    result = algo.genHash(data, data.length, 0);
    return Buffer.from(result, 'hex');
  }

  getSubmitParams(Device, nonce, hash) {
    var nce2hex = Buffer.alloc(4);
    var ntime1 = this.reverseBuffer(Buffer.from(nonce.slice(8,16), 'hex'));
    var nce = this.reverseBuffer(Buffer.from(nonce.slice(0,8), 'hex'));
    nce2hex.writeUInt32BE(Device.dev.work.nonce2, 0);
    var submit = {
      job_id: null,
      params: {
        id: null,
        submit: []
      }
    };
    //var ntime = new Date();
    submit.job_id = Device.dev.work.job_id;
    submit.params = {
      id: Device.dev.poolId,
      submit: [
        // Device.dev.pool.user, submit.job_id, "0", Math.floor(ntime.getTime() / 1000).toString('16'), nonce.toString('16')
        Device.dev.pool.user, submit.job_id, nce2hex.toString('hex'),  ntime1.toString('hex'), nce.toString('hex'), Buffer.alloc(32).toString('hex')
      ]
    }
    Debug.IbctLogDbg(COMP,  'getSubmitParams+++', JSON.stringify(submit));

    return submit;
  }
};

module.exports = function GetHns(options = {}) {
  return new Hns(options);
};