var http = require('http'),
    faye = require('faye');

var server = http.createServer(),
    bayeux = new faye.NodeAdapter({mount: '/'});

bayeux.attach(server);
server.listen(8000);

var browserify = require('browserify');
var connect = require('connect')
  , http = require('http')
  , fs = require('fs')



var cacheAge = 0;
if (process.env.NODE_ENV === 'production') {
  cacheAge = 60 * 60 * 1000;
}
var file = process.argv[2]

app = connect()
  .use(connect.favicon())
  .use(connect.compress()) // must be before static
  .use(connect.static('public', { maxAge: cacheAge }))
  .use(function(req, res) {
    if (req.url === '/') {
      // HTML is implied
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync('./index.html'));
    }
    if (req.url === '/faye.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync('./node_modules/faye/browser/faye-browser.js'));
    }
    if(req.url === '/client.js') {
      var b = browserify();
      b.add('./client.js');

      // Hack annoying tea-type conditional require
      b.ignore('./lib-cov/merge')
      b.ignore('./lib-cov/type')
      b.bundle().pipe(res);
    }
    if(req.url === '/body') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync(file).toString())
    }
  })


var port = process.env.PORT || 3000;
http.createServer(app).listen(port);
console.log("Listening on port", port)


console.log("Watching file", file, '...')
fs.watchFile(file, { interval: 100 }, function() {
  bayeux.getClient().publish('/body',
    fs.readFileSync(file).toString())
})