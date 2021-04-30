"use strict";
var Proxy = require("./Proxy");
const Debug = require('../../log')();
const COMP = '[Proxy Index]';
process.on("uncaughtException", function (error) {
    /* prevent unhandled process errors from stopping the proxy */
    Debug.IbctLogErr(COMP, "process error:", error);
});
module.exports = Proxy.default;
