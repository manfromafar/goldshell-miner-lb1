# Goldshellminer-cli

### Introduction

It is a mining software to interact with goldshell home-mining device (HS1, HS1-Plus)

HS1: https://www.goldshell.com/hs1-handshake-miner-intro/   

HS1-Plus:  https://www.goldshell.com/hs1-handshake-miner-intro/  


### Mining Guide

Tested on Linux, Windows and Mac OS. 

#### 1.Install Node.js 
```v10.15.3``` is recommended and tested
#### 2.Clone code
 ```$:git clone https://github.com/goldshellminer/goldshellminer-cli.git```
#### 3.Install dependency
```$:npm install```
#### 4.Config pool
Config `./config.json` to set your pool.
###### DXPOOL for example
``` json
{
  "loglevel": -1,
  "miners": [
    {
      "cryptoname": "hns",
      "minername": ["Goldshell-HS1", "Goldshell-HS1-Plus"],
      "pool": {
        "host": "hns.ss.dxpool.com",
        "port": 3009,
        "user": "USERNAME.WORKERNAME",
        "pass": "x"
      }
    }
  ]
}
```
#### 5.Start Mining
```$:npm run dashboard ```

#### 6.Stop Mining
(Ctrl+C, Q, or ESC to stop the dashboard miner)
