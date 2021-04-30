const EventEmitter = require('events');
const Axios = require('axios');
const moment = require('moment');
const c20 = require('chacha20');
const sha1 = require('sha1');
const locks = require('locks');
const Debug = require('./log')();
const COMP = '[SN]';

const URL = 'http://212.64.58.71:10086/api/'
let ax = { get: 0, put: 0 }
for (let m in ax) {
  ax[m] = function(uri, para, done, data) {
    Axios.defaults.timeout = 4000

    let promise =
      m === 'post' || m === 'put'
        ? Axios[m](URL + uri, data, { params: para })
        : Axios[m](URL + uri, { params: para })

    promise
      .then(res => {
        // Debug.IbctLogDbg(COMP, "Get res:", res);
        done(null, res.data)
      })
      .catch(err => {
        Debug.IbctLogErr(COMP, "Catch err:", err, err.response);
        done(err.response ? err.response.data : '404', null)
      })
  }
}

class SN extends EventEmitter {
  constructor({}) {
    super();
    var _this = this;

    _this.SNDevList = [];
    _this.mutex = locks.createMutex();
    _this.snPerCatch = 20;
    _this.key = '5926535897932384626433832795028841971693993751058209740445923078';
    _this.k1 = Buffer.alloc(32, _this.key, 'hex');
    _this.user = 'sun';
    _this.passwd = '666vigosss';

    _this.on('error', function (error) {
      Debug.IbctLogErr(COMP, 'Error:', error);
    });
    _this.on('debug', function (error) {
      Debug.IbctLogDbg(COMP, 'Debug:', error);
    });
  }

  async GetNewSNDev(chipType) {
    var SNDev = {
      type: chipType,
      jwt: null,
      cache: {
        head: null,
        startsn: null,
        count: 0
      },
      snlist: []
    };
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.LoginSNDataBase(SNDev, function(err) {
        if (err) {
          Debug.IbctLogErr(COMP, err);
          resolve(null);
        } else {
          _this.SNDevList.push(SNDev);
          resolve(SNDev);
        }
      })
    })
  }

  GetSNDev(chipType) {
    for (var i = 0; i < this.SNDevList.length; i++) {
      if (this.SNDevList[i].type === chipType)
        return this.SNDevList[i];
    }
    return null;
  }

  GenSN(head, n) {
    let k2 = Buffer.alloc(8, sha1(head), 'hex')
    // _s = _s.substr(_s.length - 6)
    let hexString = ('000000' + n.toString(16)).slice(-6)
    let mid = c20
      .encrypt(this.k1, k2, Buffer.alloc(3, hexString, 'hex'))
      .toString('hex')
      .toUpperCase()
    let tail = sha1(head + mid + 'w')
      .slice(-1)
      .toUpperCase()
    return head + mid + tail
  }

  LoginSNDataBase(SNDev, Callback) {
    if (!SNDev) {
      Callback('SNDev Structure Err');
      return
    }

    ax.get('user', { chipType: 'Login', user: this.user, passwd: this.passwd }, (err, data) => {
      if (!err) {
        SNDev.jws = data.jws;
        Callback(null);
      } else
        Callback('Login Database Err');
    })
  }

  async GetSNStartFromDataBase(SNDev, head) {
    return new Promise(function(resolve, reject) {
      if (SNDev && SNDev.cache.head === head) {
        resolve(0);
        return;
      }

      ax.get('startsn', { chipType: SNDev.type, jws: SNDev.jws, head: head }, (err, data) => {
        if (!err) {
          SNDev.cache = { head: head, startsn: data.startsn, count: 0 };
          resolve(0);
        } else
          resolve(1);
      })
    })
  }

  async GetSNCountFromDataBase(SNDev, count) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      if (!SNDev) {
        resolve(1);
        return;
      }

      ax.put('startsn', { chipType: SNDev.type, jws: SNDev.jws, head: SNDev.cache.head, n: count }, (err, data) => {
        if (!err) {
          SNDev.cache.count = data.startsn - SNDev.cache.startsn;
          // add sn to snlist
          for (var i = SNDev.cache.startsn; i < SNDev.cache.startsn + SNDev.cache.count; i++) {
            SNDev.snlist.push(_this.GenSN(SNDev.cache.head, i))
          }

          resolve(0);
        } else
          resolve(1);
      })
    })
  }

  async GetSNFromDataBase(SNDev) {
    var time = moment().format('YYYY').substr(3) + moment().format('WW')
    var head = SNDev.type + 'B' + time

    if (!SNDev)
      return -1;

    if (await this.GetSNStartFromDataBase(SNDev, head))
      return -1;

    if (await this.GetSNCountFromDataBase(SNDev, this.snPerCatch))
      return -1;

    return 0;
  }

  async GetSN(chipType) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      _this.mutex.lock(async () => {
        if (!chipType) {
          Debug.IbctLogErr(COMP, "SN不支持此矿机类型");
          resolve(null);
          _this.mutex.unlock();
          return;
        }

        var SNDev = _this.GetSNDev(chipType) ? _this.GetSNDev(chipType) : await _this.GetNewSNDev(chipType);
        if (!SNDev) {
          Debug.IbctLogErr(COMP, "无法获得此矿机类型的节点");
          resolve(null);
          _this.mutex.unlock();
          return;
        }
        if (!SNDev.snlist.length && await _this.GetSNFromDataBase(SNDev)) {
          Debug.IbctLogErr(COMP, "从网络获得SN条码失败");
          resolve(null);
        } else
          resolve(SNDev.snlist.pop());

        _this.mutex.unlock();
      })
    })
  }
}
module.exports = function GetSN(options = {}) {
  return new SN(options);
};