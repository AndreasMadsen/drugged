'use strict';

var url = require('url');
var Routes = require('routes');

var hasOwnProperty = Object.prototype.hasOwnProperty;

// Supper simple request container
function Handle(done, req, res, parsedUrl) {
  var self = this;
  this.res = res;
  this.res.once('error', this.error.bind(this));
  this.req = req;
  this.req.once('error', this.error.bind(this));
  this.url = parsedUrl;

  // If this is the actual constructor call done now
  if (this.constructor === Handle) done(null);
}
exports.Handle = Handle;

Handle.prototype.error = function (err) {
  var self = this;
  this.res.statusCode = err.statusCode || 500;
  this.res.end(err.message);
};

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
  var fn = this.all ? this.methods.all : this.methods[method];
  if (!fn && method === 'HEAD') fn = this.methods.GET;

  if (fn) {
    var keys = Object.keys(params);
    var args = new Array(keys.length);
    for (var i = 0, l = keys.length; i < l; i++) {
      args[i] = params[keys[i]] === undefined ? null : params[keys[i]];
    }

    fn.apply(handle, args);
  } else {
    var err = new Error('Method Not Allowed');
        err.statusCode = 405;
    handle.error(err);
  }
};

// API for creating routes and dispatching requests
function Router(HandleConstructor) {
  if (!(this instanceof Router)) return new Router(HandleConstructor);

  this.Handle = Handle;
  this.router = new Routes();
  this.collections = Object.create(null);
  this.attachstack = [];
}
exports.Router = Router;

Router.prototype.setHandle = function (HandleConstructor) {
  this.Handle = HandleConstructor;
};

Router.prototype.attach = function (fn) {
  this.attachstack.push(fn);
};

Router.prototype.at = function (path/*, method, cb */) {
  var method, cb;

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
  var key = path.toString();
  var collection;
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
    var keys = Object.keys(cb);
    for (var i = 0, l = keys.length; i < l; i++) {
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
  var self = this;

  var parsedUrl = url.parse(req.url);
  var match = self.router.match(parsedUrl.pathname);

  // Create Request handle and make sure done is called in another turn
  var sync = true;
  var handle = new self.Handle(function (err) {
    if (sync) process.nextTick(done.bind(null, err));
    else done(err);
  }, req, res, parsedUrl);
  sync = false;

  function done(err) {
    for (var i = 0, l = self.attachstack.length; i < l; i++) {
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
