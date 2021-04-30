const EventEmitter = require('events');
var multiHashing = require('ibctminerscrypt');
const Debug = require('../log')();
const COMP = '[lbryApi]';

class lbryApi extends EventEmitter {
    constructor({}) {
        super();
        var _this = this;
        _this.genhashFunc = multiHashing['lbry'];
    }
    getAlgoName() {
        return 'lbry';
    }
    genHash(data) {
        return this.genhashFunc(data);
    }
};

module.exports = function RunlbryApi(options = {}) {
    return new lbryApi(options);
};
