'use strict';

const url = require('url');
const HttpHash = require('http-hash');
const DefaultHandle = require('./handlers/default.js');

// Manage diffrent method handlers on same path
function HandlerCollection() {
  this.methods = {};
  this.all = false;
}

// add route callback using the method
HandlerCollection.prototype.add = function (method, cb) {
  if (method === 'all') {
    this.all = true;
    this.methods.all = cb;
  } else {
    this.methods[method.toUpperCase()] = cb;
  }
};

// Run the route method with the handle as this and params as arguments
HandlerCollection.prototype.run = function (method, handle, params, splat) {
  // Get the route callback by the method name
  let fn = this.all ? this.methods.all : this.methods[method];
  if (!fn && method === 'HEAD') fn = this.methods.GET;

  if (fn) {
    // Unpack the params to an array.
    // NOTE: this assumes the object key ordering is consistent
    const keys = Object.keys(params);
    const args = new Array(keys.length);
    for (let i = 0, l = keys.length; i < l; i++) {
      args[i] = params[keys[i]] === undefined ? null : params[keys[i]];
    }
    // Add the * part too, if it was used
    if (splat !== null) args.push(splat);

    fn.apply(handle, args);
  } else {
    const err = new Error('Method Not Allowed');
          err.statusCode = 405;
    handle.error(err);
  }
};

// API for creating routes and dispatching requests
function Router(HandleConstructor) {
  if (!(this instanceof Router)) return new Router(HandleConstructor);

  this.Handle = DefaultHandle;
  this.router = new HttpHash();
  this.collections = new Map();
  this.attachMethods = [];
}
exports.Router = Router;
exports.DefaultHandle = DefaultHandle;

Router.prototype.setHandle = function (HandleConstructor) {
  this.Handle = HandleConstructor;
};

Router.prototype.attach = function (fn) {
  this.attachMethods.push(fn);
};

Router.prototype.at = function (path/*, method, cb */) {
  let method, cb;

  // Intrepert arguments
  if (arguments.length < 2) {
    throw new TypeError('not enogth arguments');
  } else if (arguments.length === 2 && typeof arguments[1] === 'function') {
    method = 'all';
    cb = arguments[1];
  } else if (arguments.length === 2 && typeof arguments[1] === 'object') {
    method = null;
    cb = arguments[1];
  } else {
    method = arguments[1];
    cb = arguments[2];
  }

  // Get the collection handler
  let collection;
  if (this.collections.has(path)) {
    // If the handle collection has already been created
    collection = this.collections.get(path);
  } else {
    // Create a handlers object if none exists
    collection = new HandlerCollection();
    this.collections.set(path, collection);

    // Set router path
    this.router.set(path, function (method, handle, params, splat) {
      collection.run(method, handle, params, splat);
    });
  }

  // Set (path, method) route method(s)
  if (method) {
    collection.add(method, cb);
  } else {
    for (const method of Object.keys(cb)) {
      collection.add(method, cb[method]);
    }
  }
};

// Setup the shortcuts for standard HTTP 1.1 methods
// For other methods please use Router.at
['OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'TRACE', 'CONNECT']
  .forEach(function (method) {
    method = method.toLowerCase();
    Router.prototype[method] = function (path, cb) {
      this.at(path, method, cb);
    };
  });

// Create a Handle object and at last call the route method
Router.prototype.dispatch = function (req, res) {
  const self = this;

  const parsedUrl = url.parse(req.url);
  const match = self.router.get(parsedUrl.pathname);

  // Create Request handle and make sure done is called in another turn
  let sync = true;
  const handle = new self.Handle(function (err) {
    if (sync) process.nextTick(done, err);
    else done(err);
  }, req, res, parsedUrl);
  sync = false;

  // The handle constructor is done
  function done(err) {
    if (err) return handle.error(err);

    // Evaluate all the attach methods
    for (const attachMethod of self.attachMethods) {
      attachMethod.call(handle);
    }

    // No match found, send 404
    if (match.handler === null) {
      err = new Error('Not Found');
      err.statusCode = 404;
      return handle.error(err);
    }

    // match found, relay to HandlerCollection
    match.handler(req.method, handle, match.params, match.splat);
  }
};
