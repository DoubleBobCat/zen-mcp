(function () {
  var mod = require("./server.js");
  var server = mod.createServer();
  if (typeof globalThis !== "undefined") {
    globalThis.createServer = mod.createServer;
    globalThis.server = server;
  } else if (typeof self !== "undefined") {
    self.createServer = mod.createServer;
    self.server = server;
  }
})();
