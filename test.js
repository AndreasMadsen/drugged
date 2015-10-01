'use strict';

var url = require('url');
var util = require('util');
var http = require('http');
var test = require('tap').test;
var endpoint = require('endpoint');
var drugged = require('./drugged.js');

function request(href, method, callback) {
  var options = url.parse(href);
      options.method = method;

  var req = http.request(options, function (res) {
    res.pipe(endpoint(function (err, body) {
      callback(err, res, body.toString());
    }));
  });
  req.end();
}

var workingRouter = new drugged.Router();
var workingServer = http.createServer();
    workingServer.on('request', workingRouter.dispatch.bind(workingRouter));

test('start working server', function (t) {
  workingServer.listen(10010, '127.0.0.1', function () {
    t.end();
  });
});

test('no matching route return 404', function (t) {
  request('http://127.0.0.1:10010', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 404);
    t.equal(body, 'Not Found');
    t.end();
  });
});

test('adding a simple GET router via .get', function (t) {
  workingRouter.get('/', function () {
    this.res.setHeader('X-Handler', 'GET');
    this.res.setHeader('X-Query', this.url.query);
    this.res.end('Root GET');
  });

  request('http://127.0.0.1:10010', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.headers['x-handler'], 'GET');
    t.equal(res.headers['x-query'], 'null');
    t.equal(res.statusCode, 200);
    t.equal(body, 'Root GET');
    t.end();
  });
});

test('GET routes handles HEAD requests too', function (t) {
  request('http://127.0.0.1:10010', 'HEAD', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.headers['x-handler'], 'GET');
    t.equal(res.headers['x-query'], 'null');
    t.equal(res.statusCode, 200);
    t.equal(body, '');
    t.end();
  });
});

test('All routes ignores query parameters', function (t) {
  request('http://127.0.0.1:10010/?query=string', 'HEAD', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.headers['x-handler'], 'GET');
    t.equal(res.headers['x-query'], 'query=string');
    t.equal(res.statusCode, 200);
    t.equal(body, '');
    t.end();
  });
});

test('adding a simple HEAD router via .get', function (t) {
  workingRouter.head('/', function () {
    this.res.setHeader('X-Handler', 'HEAD');
    this.res.end();
  });

  request('http://127.0.0.1:10010', 'HEAD', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.headers['x-handler'], 'HEAD');
    t.equal(res.statusCode, 200);
    t.equal(body, '');
    t.end();
  });
});

test('request undefined POST route method', function (t) {
  request('http://127.0.0.1:10010', 'POST', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 405);
    t.equal(body, 'Method Not Allowed');
    t.end();
  });
});

test('adding a POST router via .at', function (t) {
  workingRouter.at('/', 'post', function () {
    this.res.end('Root POST');
  });

  request('http://127.0.0.1:10010', 'POST', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 200);
    t.equal(body, 'Root POST');
    t.end();
  });
});

test('adding a `all` router via .at', function (t) {
  workingRouter.at('/', function () {
    this.res.end('Root');
  });

  request('http://127.0.0.1:10010', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 200);
    t.equal(body, 'Root');
    t.end();
  });
});

test('adding multiply router via .at', function (t) {
  workingRouter.at('/level/', {
    GET: function () { this.res.end('Level GET'); },
    POST: function () { this.res.end('Level POST'); }
  });

  t.end();
});

test('multiply router adds first item', function (t) {
  request('http://127.0.0.1:10010/level/', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 200);
    t.equal(body, 'Level GET');
    t.end();
  });
});

test('multiply router adds second item', function (t) {
  request('http://127.0.0.1:10010/level/', 'POST', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 200);
    t.equal(body, 'Level POST');
    t.end();
  });
});

test('colon matchers becomes arguments', function (t) {
  workingRouter.get('/:first/:mid/:last?', function (first, mid, last) {
    this.res.end(first + '-' + mid + '-' + last);
  });

  request('http://127.0.0.1:10010/a/b', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 200);
    t.equal(body, 'a-b-null');
    t.end();
  });
});

function Handle(done) {
  drugged.Handle.apply(this, arguments);

  this.something(done);
}
util.inherits(Handle, drugged.Handle);

Handle.prototype.something = function (done) { done(null); };

test('setting a custom Handle', function (t) {
  workingRouter.setHandle(Handle);
  t.end();
});

test('using attach', function (t) {
  Handle.prototype.something = function (done) {
    this.custom = true;
    done(null);
  };

  var called = false;
  workingRouter.attach(function () {
    called = this.custom;
  });

  request('http://127.0.0.1:10010/', 'GET', function (err, res, body) {
    t.equal(called, true);
    t.equal(err, null);
    t.end();
  });
});

test('domain catch error on res object', function (t) {
  Handle.prototype.something = function (done) {
    this.res.emit('error', new Error('some crazy response error'));
  };

  request('http://127.0.0.1:10010/', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 500);
    t.equal(body, 'some crazy response error');
    t.end();
  });
});

test('domain catch error on req object', function (t) {
  Handle.prototype.something = function (done) {
    this.req.emit('error', new Error('some crazy request error'));
  };

  request('http://127.0.0.1:10010/', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 500);
    t.equal(body, 'some crazy request error');
    t.end();
  });
});

test('domain catch error sync object', function (t) {
  Handle.prototype.something = function (done) {
    throw new Error('some sync error');
  };

  request('http://127.0.0.1:10010/', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 500);
    t.equal(body, 'some sync error');
    t.end();
  });
});

test('domain catch error async object', function (t) {
  Handle.prototype.something = function (done) {
    setTimeout(function() {
      throw new Error('some async error');
    });
  };

  request('http://127.0.0.1:10010/', 'GET', function (err, res, body) {
    t.equal(err, null);
    t.equal(res.statusCode, 500);
    t.equal(body, 'some async error');
    t.end();
  });
});

test('close working server', function (t) {
  workingServer.close(function () {
    t.end();
  });
});
