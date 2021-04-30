const IntMiner = require('./src');
const CFonts = require('cfonts');
const Debug = require('./src/log')();
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const CliDraw = require("./dashboard");

const supports = [
  {
    algoname: 'blake2bsha3',
    minername: ['Goldshell-HS1', 'Goldshell-HS1-Plus'],
    cryptoname: 'hns',
    protocolname: 'stratum',
    pool: null
  },
  {
    algoname: 'lbry',
    minername: ['Goldshell-LB1'],
    cryptoname: 'lbc',
    protocolname: 'stratum',
    pool: null
  }
]

function help() {
  const text = require('fs').createReadStream(`${__dirname}/help`);
  text.pipe(process.stderr);
  text.on('close', () => process.exit(1));
}

function isSubSet(Arr_A, Arr_B) {
  if(!(Arr_A instanceof Array)||!(Arr_B instanceof Array)||((Arr_A.length > Arr_B.length))) {
    return false;
  }
  return Arr_A.every(function(A) {
    return Arr_B.includes(A);
  })
}

function isJson(obj){
  var isjson = typeof(obj) == "object" && Object.prototype.toString.call(obj).toLowerCase() == "[object object]" && !obj.length;
  return isjson;
}

function existParameter(obj, name) {
  if (isJson(obj) && name && obj.hasOwnProperty(name)) {
    return true;
  }
  return false;
}

function getMinerParameters(config) {
  var Miners = [];
  for (var i = 0; i < supports.length; i++) {
    for (var j = 0; j < config.length; j++) {
      if (supports[i].cryptoname === config[j].cryptoname && isSubSet(config[j].minername, supports[i].minername)) {
        Miners.push(supports[i]);
      }
    }
  }
  return Miners;
}

const shows = [
  { h: "miningName", v: "     Model"},
  { h: "state", v: "Status"},
  { h: "miningType", v: "Type"},
  { h: "version", v: "Version"},
  // { h: "miningSN", v: "     MinerID"},
  { h: "comm", v: "  Port"},
  { h: "hashrate", v: "Hashrate 20s"},
  { h: "avHashrate", v: "Hashrate avg"},
  { h: "hardwareErr", v: "HW Error" },
  { h: "rejected", v: "Rejected"},
  { h: "accepted", v: "Accepted"},
  { h: "temperatue", v: "Temperature ℃"},
  { h: "elapsed", v: " Elapsed"}
];

const sumHeader = [
  "     Model",
  "Count"
];

function convertHeaders() {
  var showHeads = [];

  for (var i = 0; i < shows.length; i++) {
    if (i === 0)
      showHeads.push("Index");
    showHeads.push(shows[i].v);
  }
  return showHeads;
}

function convertContent(miners) {
  var showMinerParameters = [];

  for (var j = 0; j < miners.length; j++) {
    var showMinerParameter = [];
    for (var i = 0; i < shows.length; i++) {
      if (i === 0)
        showMinerParameter.push(j);
      showMinerParameter.push(miners[j][shows[i].h]);
    }
    showMinerParameters.push(showMinerParameter);
  }
  return showMinerParameters;
}

function sumup(miners) {
  var sums = [];
  var active = 0;

  sums.push(["Active Sum", 0]);
  sums.push(["Inactive Sum", 0]);
  sums.push(['', ''])
  for (var j = 0; j < miners.length; j++) {
    if (miners[j].state === 'on')
      active++;

    for (var i = 0; i < sums.length; i++) {
      if (miners[j].miningName === sums[i][0]) {
        sums[i][1]++;
        break;
      }
    }

    if (i === sums.length) {
      sums.push([miners[j].miningName, 1]);
    }
  }

  if (miners.length) {
    sums[0][1] = active;
    sums[1][1] = miners.length - active;
  }
  return sums;
}

(async () => {
  var devState = []
  var MinerParameters = null;
  var debugScreen = false;
  var configFile = null;
  var loglevel = 1;
  var config = argv.config || './config.json';
  var dashboard = null;
  var headers = null;

  if (argv.help || argv.h) {
    help();
    return;
  }

  if (fs.existsSync(config)) {
    try {
      configFile = JSON.parse(fs.readFileSync(config, 'utf-8'));
    } catch(e) {
      help();
      return;
    }
  } else {
    console.log('Config file is not exist:', config);
    return;
  }

  loglevel = argv.loglevel ? argv.loglevel : (existParameter(configFile, 'loglevel') ? configFile.loglevel : 1);
  if (loglevel !== 1) {
    Debug.IbctSetLogLevel(loglevel);
    if (loglevel < 0)
      debugScreen = true;
  }

  for (i = 0; i < configFile.miners.length; i++) {
    if (!existParameter(configFile.miners[i], 'cryptoname')) {
      console.log('Parameter cryptoname is not exist in config.json');
      help();
      return null
    }
    if (!existParameter(configFile.miners[i], 'minername')) {
      console.log('Parameter minername is not exist in config.json');
      help();
      return null
    }
    if (!existParameter(configFile.miners[i], 'pool')) {
      console.log('Parameter pool is not exist in config.json');
      help();
      return null
    }
  }
  MinerParameters = getMinerParameters(configFile.miners);
  if (!MinerParameters.length) {
    help();
    return null
  }

  if (debugScreen === true) {
    dashboard = new CliDraw();
    headers = convertHeaders();
  }

  const miner = await IntMiner({MinerParameters: MinerParameters});

  // init Mining
  await miner.initMining();
  // set pool
  for (i = 0; i < configFile.miners.length; i++) {
    miner.setMiningConfig('pool', configFile.miners[i].cryptoname, configFile.miners[i].pool);
  }
  // start Mining
  await miner.connectMining();
  await miner.startMining(null);

  miner.on('plug-in', async (data) => {
    Debug.IbctLogDbg('plug-in: ', data.devID);
    await miner.connectMining({'devID': data.devID});
    miner.startMining({
      'devID': data.devID
    });
  });

  miner.on('plug-out', data => {
    Debug.IbctLogDbg('plug-out: ', data.devID);
    // miner.stopMining({ 'devId': data.devID });
  });

  miner.on("error", function (devID, data) {
    if (devID)
      Debug.IbctLogErr('Miner' + devID + ':', data);
    else
      Debug.IbctLogErr(data);
  });

  miner.on("warning", function (devID, data) {
    if (devID)
      Debug.IbctLogDbg('Miner' + devID + ':', data);
    else
      Debug.IbctLogDbg(data);
  });

  setInterval(function () {
    devState = miner.getMiningStatus();
    if (debugScreen === true) {
      dashboard.updateTotalTable(sumHeader, sumup(devState))
      dashboard.updateDetailsTable(headers, convertContent(devState))
    } else
        console.log(JSON.stringify(devState));
  }, 1000);
})();
