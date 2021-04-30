'use strict';

var
  classes = {
    path   : require('path'),
    dir    : function (path){
      return this.path.join(__dirname, path);
    },
    fs     : require('fs'),
    lodash : require('lodash'),
    net    : require('net'),
    uuid   : require('uuid'),
    q      : require('bluebird'),
    rpc    : require('json-rpc2'),
    curry  : require('better-curry'),
    debug  : require('../../../log')()
  };

classes.Base = require('./base');
classes.RPCServer = require('./rpc')(classes);
classes.Client = require('./client')(classes);
classes.Server = require('./server')(classes);

module.exports = classes;