const lb1 = require('./src/miner/lb1.js');
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
    0x26, 0x8F, 0xDA, 0x9C, 0xA4, 0x8D, 0x98, 0x78, 0x23, 0x3A, 0x5F, 0xF4, 0x42, 0x6D, 0x09, 0x5E,
    0xE7, 0x88, 0xAB, 0x95, 0xEF, 0x11, 0x8D, 0x8F, 0xA4, 0x85, 0xFE, 0x45, 0x34, 0x35, 0xAB, 0xB9,

    0x3F, 0x71, 0x4B, 0x4A, 0xB1, 0x65, 0x2B, 0xBF, 0x54, 0x33, 0xBD, 0xA5, 0x7F, 0x41, 0xA4, 0x76,
    0xBB, 0x15, 0xC5, 0xBF, 0x14, 0xD7, 0x85, 0x41, 0x38, 0xAC, 0x9E, 0x1F, 0xE7, 0x97, 0x04, 0x93,
    0x34, 0xC9, 0x6E, 0x16, 0x85, 0x4B, 0x58, 0x5F, 0x47, 0xFD, 0x04, 0x1A, 0xE0, 0x0A, 0x0F, 0x78,

    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

const miner = lb1({
    algo: {name: 'lbry'},
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
        await miner.lb1GetStaticInfo('Goldshell-LB1');
        await miner.lb1SetHWParams(0x4,100,750);
        await miner.lb1GetStaticInfo('Goldshell-LB1');
        await sleep(3000);
        await miner.lb1GetStaticInfo('Goldshell-LB1');
        await miner.lb1SetHWParams(0,0,0);
        n++;
        console.log('cnt', n);
    }
    console.log('end');
};

if (opt.options.m) {
    miner.lb1SetBootMode();
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
    miner.lb1GetStaticInfo('Goldshell-LB1');
} else if (opt.options.s) {
    if (parseInt(opt.argv[0]))
        miner.lb1SetHWParams(4,100,750);
    else
        miner.lb1SetHWParams(0,0,0);
} else if (opt.options.r) {
    miner.rebootDev();
} else if (opt.options.j) {
    data = Buffer.from(payload);
    snonce = Buffer.from([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
    enonce = Buffer.from([0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]);
    miner.lb1WriteJob(0xc, snonce, enonce, 0x000000ff, data);
} else if (opt.options.l) {
    if (opt.argv.length > 0) {
        var enable = parseInt(opt.argv[0]) ? true :false;
        miner.setLed(enable);
    }
} else if (opt.options.L) {
    loop();
}
