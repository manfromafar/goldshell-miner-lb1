const EventEmitter = require('events');
const stratum = require('./stratum/lib');
const Debug = require('../log')();
const uuid = require("uuid");
const COMP = '[HnsStratum]';

class intStratum extends EventEmitter {
  constructor({}) {
    super();
    var _this = this;

    _this.client = null;
    _this.online = false;
    _this.auth = false;
    _this.subinfo = null;
    _this.subinfoturn = false;
    _this.diffinfo = null;
    _this.socket = null;
    _this.sendQueue = [];
    _this.user = null;
    _this.pass = null;
    _this.lastRecvPacket = null;
    _this.lastSendPacket = null;
    _this.id = uuid.v4();

    return _this;
  }

  stratumAuthorize(id, user, pass) {
    return this.socket.stratumSend({
      'method': 'mining.authorize',
      'id': id,
      'params': [user, pass]
    }, true);
  }

  stratumSubmit(id, submitData) {
    this.socket.setLastActivity();
    return this.socket.stratumSend({
      'method': 'mining.submit',
      'id': id,
      'params': submitData
    });
  }

  setupLoginPacket(data, job, diff, info) {
    // for setup for connect.js
    var packet = {
      id: data.id,
      error: null,
      result: {
        id: this.id,
        job: job,
        diff: diff,
        subscribe: info,
      }
    };
    return packet;
  }

  getPacketByID(id) {
    var packet = null;
    this.sendQueue = this.sendQueue.filter(function (pkt) {
      if (pkt.id === id && !packet) {
        packet = pkt;
        return false;
      } else {
        return true;
      }
    });

    return packet;
  }

  getPacketByMethod(method) {
    var packet = null;
    this.sendQueue = this.sendQueue.filter(function (pkt) {
      if (pkt.method === method && !packet) {
        packet = pkt;
        return false;
      } else {
        return true;
      }
    });

    return packet;
  }

  init(ssl, host, port) {
    var _this = this;

    if (_this.online) {
      _this.kill();
      return;
    } else if (!_this.client) {
      _this.client = stratum.Client.$create();
      if (!_this.client) {
        _this.emit('error', __('创建Stratum客户端失败'));
      }
    }

    _this.client.on('error', function (socket, e) {
      _this.emit("error", __('网络连接中断'));
    });

    _this.client.on('timeout', function (socket, e) {
      _this.emit("error", __('Socket请求超时'));
    });

    _this.client.on('mining.error', function (msg, socket) {
      Debug.IbctLogErr(COMP, msg);
      _this.emit("error", __('Stratum连接中断'));
    });

    _this.client.connect({
      host: host,
      port: port
    }).then(function (socket) {
      Debug.IbctLogDbg(COMP, 'Connected! lets ask for subscribe');
      if (!_this.online) {
        _this.online = true;
      }
      _this.socket = socket;
      _this.emit('connect');
    })
  }

  kill() {
    if (this.client) {
      this.client.removeAllListeners();
      if (this.client.destroy) {
        this.client.destroy();
      }
      this.client = null;
    }
    if (this.sendQueue.length)
      this.sendQueue.splice(0, this.sendQueue.length);

    this.lastRecvPacket = null;
    this.lastSendPacket = null;
    if (this.online) {
      this.online = false;
      this.auth = false;
      this.removeAllListeners();
    }
  }

  getPacket() {
    var _this = this;
    var packet = null;
    // TODO: have done in init
    // the client is a one-way communication, it receives data from the server after issuing commands
    _this.client.on('mining', function (data, socket, type) {
      // type will be either 'broadcast' or 'result'
      Debug.IbctLogInfo(COMP, '<===' + type + ' = ', JSON.stringify(data));
      // you can issue more commands to the socket, it's the exact same socket as "client" variable
      // in this example
      // the socket (client) got some fields like:
      // client.name = name of the worker
      // client.authorized = if the current connection is authorized or not
      // client.id = an UUID ([U]niversal [U]nique [ID]entifier) that you can safely rely on it's uniqueness
      // client.subscription = the subscription data from the server
      switch (data.method) {
        case 'set_difficulty':
        case 'mining.set_difficulty':
          // server sent the new difficulty
          Debug.IbctLogInfo(COMP, 'mining.set_difficulty');
          if (!socket.authorized) {
            _this.diffinfo = data;
          } else {
            _this.emit('data', _this.setupLoginPacket(data, null,data.params,null));
          }
          break;
        case 'notify':
        case 'mining.notify':
          // server sent a new block
          // Debug.IbctLogInfo(COMP, 'mining.notify');
          if (!_this.auth) {
            _this.lastRecvPacket = data.params;
          } else {
            _this.emit('data', _this.setupLoginPacket(data, data.params,null,null));
          }
          break;
        default:
          if (!socket.authorized) {
            _this.subinfo = data;
            Debug.IbctLogDbg(COMP, 'Asking for authorization');
            if (_this.lastSendPacket && _this.lastSendPacket.method === 'login' && !_this.auth) {
              Debug.IbctLogErr(COMP, 'Login failed: ', _this.user);
              if (data.error && data.error.message)
                _this.emit('error', __('矿池登陆失败') + ': ' + data.error.message);
              else if (data.error && (data.error instanceof Array) && data.error.length > 2) {
                _this.emit('error', __('矿池登陆失败') + ': ' + data.error[1])
              } else
                _this.emit('error', __('矿池登陆失败'));
              return
            }
            packet = _this.getPacketByMethod('login');
            if (packet) {
              _this.lastSendPacket = packet;
              Debug.IbctLogInfo(COMP, 'Login User: ', _this.user);
              _this.stratumAuthorize(packet.id, packet.params.login, packet.params.pass);
            }
          } else {
            if (!_this.lastSendPacket) {
              return
            }
            /*add this step for 6 block */
            if(_this.subinfoturn === true) {
              _this.subinfo = data;
              _this.subinfoturn = false;
            }
            if (_this.lastSendPacket.method === 'login' && !_this.auth) {
              Debug.IbctLogDbg(COMP, 'We are authorized', _this.lastRecvPacket);
              _this.emit('data', _this.setupLoginPacket(data, _this.lastRecvPacket, null, null));
              _this.auth = true;
              if(_this.subinfo.result === null){
                _this.subinfoturn = true;
                _this.socket.stratumSubscribe('icbtminer');
              }
             
            }

           if(typeof _this.subinfo.result === 'object' && _this.subinfo.result !== null) {
              _this.emit('data', _this.setupLoginPacket(_this.subinfo, null, null, _this.subinfo.result));
              _this.subinfo.result = null;
            }

            if( _this.diffinfo !== null) {
              _this.emit('data', _this.setupLoginPacket(_this.diffinfo, null, _this.diffinfo.params, null));
              _this.diffinfo = null;
            }
            if (_this.lastSendPacket.method === 'submit') {
              _this.emit('data', data);
            }
          }
      }
    });
  }

  sendPacket(message) {
    var _this = this;
    Debug.IbctLogInfo(COMP, 'sendPacket: ', JSON.stringify(message));
    this.sendQueue.push(message);
    if (message.method === 'login') {
      this.user = message.params.login;
      this.pass = message.params.pass;
      // After the first stratumSubscribe, the data will be handled internally
      // and returned deferreds to be resolved / rejected through the event 'mining'
      // above
      this.socket.stratumSubscribe('icbtminer').then(
        // This isn't needed, it's handled automatically inside the Client class
        // but if you want to deal with anything special after subscribing and such.
        function (socket) {
          Debug.IbctLogDbg(COMP, 'Sent!');
        },
        function (error) {
          Debug.IbctLogErr(COMP, 'Error');
        }
      );
    }
    // have login
    if (message.method === 'submit') {
      _this.lastSendPacket = message;
      return this.stratumSubmit(message.id, message.params.params.submit);
    }
  }
  isWritable() {
    return true;
  }
};

module.exports = function GetIntStratum(options = {}) {
  return new intStratum(options);
};