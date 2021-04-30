const hs1 = require('./src/miner/hs1.js');
const fs = require('fs');

opt = require('node-getopt').create([
    ['m' , null , 'mode'],
    ['b' , null , 'burn'],
    ['q' , null, 'query'],
    ['j' , null , 'work'],
    ['r' , null , 'reboot'],
    ['y' , null , 'nonce'],
    ['s' , null , 'set'],
    ['g' , null , 'get'],
    ['l' , null , 'led'],
    ['L' , null , 'loop'],
    ])
    .bindHelp()
    .parseSystem();

    console.info({argv: opt.argv, options: opt.options});

var payload = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x96, 0x2b, 0x1c, 0x41,
    0x36, 0x36, 0xe8, 0x58, 0x58, 0xfd, 0xf9, 0x1d, 0x15, 0x2b, 0x42, 0x05, 0x66, 0x62, 0xb7, 0xfc,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5b, 0x20, 0x19, 0x5a, 0xfe, 0x28, 0x0a, 0x27, 0x27,
    0x6d, 0x45, 0x17, 0xc7, 0xf8, 0x0f, 0x5a, 0x61, 0x84, 0x3e, 0xac, 0x78, 0xb1, 0xaf, 0x2c, 0x82,
    0x96, 0x2b, 0x1c, 0x41, 0x36, 0x36, 0xe8, 0x03, 0x78, 0xe4, 0xa3, 0xe3, 0x3d, 0x21, 0x65, 0x22,
    0x0b, 0x27, 0xa0, 0x3b, 0x7f, 0x0e, 0xb3, 0x0b, 0xb5, 0x15, 0xb1, 0x60, 0x96, 0x16, 0x57, 0xaf,
    0x5b, 0x9f, 0x8a, 0xf4, 0x99, 0x6c, 0x25, 0x66, 0x62, 0x1e, 0xcd, 0x0f, 0x71, 0xc6, 0xa7, 0x7c,
    0xf8, 0x0c, 0x2e, 0x6b, 0x6e, 0x81, 0x6a, 0xae, 0x44, 0xd0, 0x7d, 0x91, 0x83, 0x0c, 0xaa, 0x07
];

const miner = hs1({
    algo: {name: 'blake2bsha3'},
    devPath: '/dev/ttyACM0',
});

var sleep = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve('ok');
        }, time);
    })
};

var loop = async function () {
    console.log('start');
    var n = 0;
    while (1) {
        await miner.hs1GetStaticInfo('Goldshell-HS1');
        await miner.hs1SetHWParams(0x4,100,750);
        await miner.hs1GetStaticInfo('Goldshell-HS1');
        await sleep(3000);
        await miner.hs1GetStaticInfo('Goldshell-HS1');
        await miner.hs1SetHWParams(0,0,0);
        n++;
        console.log('cnt', n);
    }
    console.log('end');
};

if (opt.options.m) {
    miner.hs1SetBootMode();
} else if (opt.options.b) {
    console.log('Burn Image')
    fs.readFile('./recovery.bin', (err, data) => {
    if (err) {
      console.log(err)
    } else {
      miner.burnFirmware(data.slice(64), function (err, data) {
        if (err) {
          console.log(err)
          return
        }

        console.log('Burn ', (data * 100).toFixed(1), '%')
        if ((data * 100).toFixed(1) === '100.0') {
          console.log('Burn Complete')
        }
      })
    }
  })
} else if (opt.options.q) {
    miner.hs1GetStaticInfo('Goldshell-HS1');
} else if (opt.options.s) {
    if (parseInt(opt.argv[0]))
        miner.hs1SetHWParams(4,100,750);
    else
        miner.hs1SetHWParams(0,0,0);
} else if (opt.options.r) {
    miner.rebootDev();
} else if (opt.options.j) {
    data = Buffer.from(payload);
    snonce = Buffer.from([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
    enonce = Buffer.from([0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]);
    miner.hs1WriteJob(0xc, snonce, enonce, 0x0000006f,data);
} else if (opt.options.l) {
    if (opt.argv.length > 0) {
        var enable = parseInt(opt.argv[0]) ? true :false;
        miner.setLed(enable);
    }
} else if (opt.options.L) {
    loop();
}
