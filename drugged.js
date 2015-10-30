'use strict';

const url = require('url');
const Routes = require('routes');
const DefaultHandle = require('./handlers/default.js');

const hasOwnProperty = Object.prototype.hasOwnProperty;

// Manage diffrent method handlers on same path
function HandlerCollection() {
  this.methods = {};
  this.all = false;
}

// add route method
HandlerCollection.prototype.add = function (method, cb) {
  if (method === 'all') {
    this.all = true;
    this.methods.all = cb;
  } else {
    this.methods[method.toUpperCase()] = cb;
  }
};

// Run the route method with the handle as this and params as arguments
HandlerCollection.prototype.run = function (method, handle, params) {
  let fn = this.all ? this.methods.all : this.methods[method];
  if (!fn && method === 'HEAD') fn = this.methods.GET;

  if (fn) {
    const keys = Object.keys(params);
    const args = new Array(keys.length);
    for (let i = 0, l = keys.length; i < l; i++) {
      args[i] = params[keys[i]] === undefined ? null : params[keys[i]];
    }

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
  this.router = new Routes();
  this.collections = Object.create(null);
  this.attachstack = [];
}
exports.Router = Router;
exports.DefaultHandle = DefaultHandle;

Router.prototype.setHandle = function (HandleConstructor) {
  this.Handle = HandleConstructor;
};

Router.prototype.attach = function (fn) {
  this.attachstack.push(fn);
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

  // If path is a RegExp convert it to a string
  const key = path.toString();
  let collection;
  if (hasOwnProperty.call(this.collections, key) === false) {
    // Create a handlers object if none exists
    collection = this.collections[key] = new HandlerCollection();

    // Set router path
    this.router.addRoute(path, function (method, handle, params) {
      collection.run(method, handle, params);
    });
  } else {
    collection = this.collections[key];
  }

  // Set (path, method) route method(s)
  if (method) {
    collection.add(method, cb);
  } else {
    const keys = Object.keys(cb);
    for (let i = 0, l = keys.length; i < l; i++) {
      collection.add(keys[i], cb[keys[i]]);
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
  const match = self.router.match(parsedUrl.pathname);

  // Create Request handle and make sure done is called in another turn
  let sync = true;
  const handle = new self.Handle(function (err) {
    if (sync) process.nextTick(done.bind(null, err));
    else done(err);
  }, req, res, parsedUrl);
  sync = false;

  function done(err) {
    for (let i = 0, l = self.attachstack.length; i < l; i++) {
      self.attachstack[i].call(handle);
    }

    if (err) return handle.error(err);
    if (!match) {
      err = new Error('Not Found');
      err.statusCode = 404;
      return handle.error(err);
    }

    match.fn(req.method, handle, match.params);
  }
};
