const EventEmitter = require('events');
const fs = require('fs');
const IBCT_NONE = -1;
const IBCT_ERR = 0;
const IBCT_DBG = 1;
const IBCT_INFO = 2;
const IBCT_ALL = 3;
const USER_HOME = process.env.HOME || process.env.USERPROFILE;

class Log extends EventEmitter {
  constructor({}) {
    super();
    var _this = this;

    global.loglevel = IBCT_DBG;
    _this.SaveLevel = IBCT_ERR;
    _this.timeEn = true;
    _this.curTime = (new Date()).getDate();
    _this.logSavePath = this.GetFileName();
    // _this.logSavePath = null;
  }
  IbctSetLogLevel(level) {
    global.loglevel = level
  }
  GetFileName() {
    return USER_HOME+'/usb_log_' + (new Date()).toLocaleDateString().replace(/\//g, "-") + '.txt';
  }
  IbctOpen(Path) {
    return fs.openSync(Path, 'a');
  }
  IbctWrite(fd, str) {
    return fs.writeSync(fd, str);
  }
  IbctClose(fd) {
    fs.closeSync(fd);
  }
  IbctSaveLog(Path, str) {
    var fd;
    var now;

    if (!Path)
      return;

    now = (new Date()).getDate();
    if (now !== this.curTime) {
      Path = this.GetFileName();
      this.curTime = now;
      this.logSavePath = Path;
    }

    fd = this.IbctOpen(Path);
    if (!fd)
      return;
    this.IbctWrite(fd, str);
    this.IbctClose(fd);
  }
  GetString(strs) {
    var buf = this.timeEn ? (new Date()).toLocaleString() : '';
    for (var i = 0; i < strs.length; i++) {
      buf += ' ' + strs[i];
    }
    return buf;
  }
  IbctLogDbg() {
    var buf = null;

    if (global.loglevel >= IBCT_DBG) {
      buf = this.GetString(arguments);
      console.log(buf);
    }

    if (this.SaveLevel >= IBCT_DBG) {
      if (buf === null) {
        buf = this.GetString(arguments);
      }
      this.IbctSaveLog(this.logSavePath, buf + '\n');
    }
  }
  IbctLogErr() {
    var buf = null;
    if (global.loglevel >= IBCT_ERR) {
      buf = this.GetString(arguments);
      console.log(buf);
    }

    if (this.SaveLevel >= IBCT_ERR) {
      if (buf === null) {
        buf = this.GetString(arguments);
      }
      this.IbctSaveLog(this.logSavePath, buf + '\n');
    }
  }
  IbctLogInfo() {
    var buf = null;
    if (global.loglevel >= IBCT_INFO) {
      buf = this.GetString(arguments);
      console.log(buf);
    }

    if (this.SaveLevel >= IBCT_INFO) {
      if (buf === null) {
        buf = this.GetString(arguments);
      }
      this.IbctSaveLog(this.logSavePath, buf + '\n');
    }
  }
}

module.exports = function GetLog(options = {}) {
  return new Log(options);
};