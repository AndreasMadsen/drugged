#drugged

> Prototypal extendable HTTP router with domain integration

## Installation

```sheel
npm install drugged
```

## Example

```javascript
var util = require('util');
var http = require('http');
var drugged = require('drugged');

// Create a router and attach it to a server
var router = new drugged.Router();
var server = http.createServer();
    server.on('request', router.dispatch.bind(router));
    server.listen();

// Extend the this keyword
router.attach(function () {
  this.prefix = 'file: ';
});

// Setup a simple router
router.get('/:file', function (file) {
  this.res.write(this.prefix + file + '\n');
  this.res.end('query: ' + this.url.search);
});
```

## Documentation

```javascript
var drugged = require('drugged');
```

There are two main components one is the required [`Router`](#router-constructor) and
the other is the optional [`Handle base constructor`](#handle-constructor) that you can
use to extend the `this` keyword. You enable this key-feature by using the
[`router.setHandle`](#routersethandlehandle) method.

### Router constructor

You create a new `router` instance by calling `drugged.Router`.

```javascript
var router = drugged.Router();
```

#### Router.dispatch(req, res)

To handle a server request call the `Router.dispatch` method with the `req` and
`res` objects you got.

```javascript
var router = new drugged.Router(Handle);
var server = http.createServer(router.dispatch.bind(router));
    server.listen(8000, '127.0.0.1');
```

#### Router.attach(fn)

When dispatching a request a new `Handle` object is created. This handle object
can then be accessed by using the `this` keyword route methods. But before
that happens you can extend the `Handle` object by using the `attach` method.

```javascript
router.attach(function () {
  // this refer to the Handle object
  this.foo = 'bar';
});
```

#### Router.at(path, [method = all], fn)

To create a route handler you should call `Rotuer.at`.

The `path` is a string, see the `http-hash` module
[documentation](https://github.com/Matt-Esch/http-hash#path-formats) for
more information on the syntax.

The `method` argument is optional, if not set the `fn` will handle all methods,
thats useful if you have some other module there takes care of everything.

```javascript
router.at('/', function () {
  // this refer to the Handle object
  this.req.pipe(somemodule()).pipe(this.res);
});
```

otherwise the `method` can be any `HTTP` method that node.js supports:

```javascript
router.at('/', 'POST', function () {
  // post message handler
});
```

Note the case that there is a `GET` route but no `HEAD` route, `HEAD` requests
will be handled by the `GET` route.

```javascript
router.at('/', 'GET', function () {
  // handles both GET and HEAD requests, but in in the HEAD case res.write
  //  won't write anything.
});

// Please note that the POST route still works
```

You can also set multiply routes at once using an object:

```javascript
router.at('/', {
  'HEAD': function () { },
  'GET': function () { },
  'POST': function () { }
});
// Please note this will overwrite the previous set GET and HEAD routes and
//  because there now is a HEAD route, it won't be handled by the GET route.
```

Each route you set will be execute with a variable amount of arguments,
where each argument will refer to an parameter (`:colon`) or splat (`*`) you
might have in your route path.

```javascript
router.at('/:first/:last/*', function (first, last, splat) {

});
```

#### Router\[method\]\(path, fn\)

This is a simple shortcut to `router.at` where, eq. `router.get` is is a short
cut to `router.at(path, 'get', fn)`.

This shortcut exists for all the HTTP 1.1 methods, for other HTTP methods you
must use the `router.at` method.

```javascript
router.option(path, fn);
router.get(path, fn);
router.head(path, fn);
router.post(path, fn);
router.put(path, fn);
router.delete(path, fn);
router.trace(path, fn);
router.connect(path, fn);
```

The main method is `drugged.Router` it takes a `Handle` constructor function
and returns a new `Router` instance.

#### Router.setHandle(Handle)

In case you want use your own `Handle` constructor use this method. For more
information about the custom and default `Handle` constructor see below.

```javascript
router.setHandle(Handle);
```

### Handle constructor

You create a `Handle` constructor by extending the `drugged.DefaultHandle` constructor
function. After this you have the opportunity to do sync/async operations like
user authorization. When you are done you must call the `callback`

```javascript
function Handle(callback) {
  // Sets `.url`, `.req`, `.res` and `.domain`
  drugged.DefaultHandle.apply(this, arguments);

  // Do async or sync stuff
  setTimeout(callback, 10);
}
util.inherits(Handle, drugged.DefaultHandle);
```

#### Handle.error(err)

This method is called when an error occur, the `drugged.DefaultHandle` class has a
default `error` method, but you are welcome to overwrite it.

This is the default error handler and its also an example on how to overwrite
it:

```javascript
DefaultHandle.prototype.error = function (err) {
  var self = this;
  this.res.statusCode = err.statusCode || 500;
  this.res.end(err.message);

  this.res.once('close', function () {
    self.domain.dispose();
  });
};
```

Errors can come from multiply places, depending on the origin the `err` object
will have a different `statusCode` property value.

* No matching route was found: 404
* A route was found but the method is unsupported: 405

You can also call `error` your self, in that case no `statusCode` will be set.

#### Handle.req

The native server request object, see node.js
[documentation](http://nodejs.org/api/http.html#http_http_incomingmessage).

#### Handle.res

The native server response object, see node.js
[documentation](http://nodejs.org/api/http.html#http_class_http_serverresponse).

#### Handle.url

The `url.parse` result, but without `parseQueryString` enabled, see node.js
[documentation](http://nodejs.org/api/url.html#url_url_parse_urlstr_parsequerystring_slashesdenotehost).

## The name

I wrote this module while I was medically drugged, which was pretty hard :)
