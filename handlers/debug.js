'use strict';

const DefaultHandle = require('./default.js');
const util = require('util');

// Supper simple request container
function DebugHandle(done) {
  DefaultHandle.apply(this, arguments);
  done(null);
}
module.exports = DebugHandle;
util.inherits(DebugHandle, DefaultHandle);

DebugHandle.prototype.error = function (err) {
  DefaultHandle.prototype.error.apply(this, arguments);

  console.error('this.error was called:');
  console.error('  Status: ' + this.res.statusCode);
  console.error('  Method: ' + this.req.method);
  console.error('  URL: ' + this.req.url);
  console.error('  ' + err.stack);
  process.exit(1);
};
