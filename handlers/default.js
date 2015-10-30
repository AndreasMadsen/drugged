'use strict';

// Supper simple request container
function DefaultHandle(done, req, res, parsedUrl) {
  this.res = res;
  this.res.once('error', this.error.bind(this));
  this.req = req;
  this.req.once('error', this.error.bind(this));
  this.url = parsedUrl;

  // If this is the actual constructor call done now
  if (this.constructor === DefaultHandle) done(null);
}
module.exports = DefaultHandle;

DefaultHandle.prototype.error = function (err) {
  this.res.statusCode = err.statusCode || 500;
  this.res.end(err.message);
};
