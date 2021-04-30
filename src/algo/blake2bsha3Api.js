const EventEmitter = require('events');
const Debug = require('../log')();
const BLAKE2B = require('./base/blake2b')
const sha3hns = require('./base/sha3hns');
const COMP = '[blake2bsha3Api]';

class blake2bsha3Api extends EventEmitter {
    constructor({}) {
        super();
        var _this = this;
        
    }
    getAlgoName() {
        return 'blake2bsha3';
    }

    genHash(data, length, varity) {
        //const data = Buffer.from('40ad0f00d163845e00000000962b1c413636e85858fdf91d152b42056662b7fc000000000000005b20195afe280a27276d4517c7f80f5a61843eac78b1af2c82962b1c413636e80378e4a3e33d2165220b27a03b7f0eb30bb515b160961657af5b9f8af4996c2566621ecd0f71c6a77cf80c2e6b6e816aae44d07d91830caa07', 'hex');
        //Debug.IbctLogDbg(COMP, 'genhash++++', data.toString('hex'));
        const pad8 = Buffer.alloc(8);
        const pad32 = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            if (i < 8)
                pad8.writeUInt8(data.readUInt8(i + 32) ^ data.readUInt8(i + 64), i);
            pad32.writeUInt8(data.readUInt8(i + 32) ^ data.readUInt8(i + 64), i);
        }
        
        const left = BLAKE2B.digest(data, 64);
        //const rxx = SHA3.multi(data, pad8);
        const right = sha3hns(Buffer.concat([data, pad8]));
        const hash = BLAKE2B.multi(left, pad32, right);
        //Debug.IbctLogDbg(COMP, 'HASH IS', hash.toString('hex'));
        return hash.toString('hex');
    }
};

module.exports = function Runblake2bsha3Api(options = {}) {
    return new blake2bsha3Api(options);
};
