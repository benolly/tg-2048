// Локальный сервер для папки webapp, чтобы смотреть игру в браузере.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'webapp');
const port = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

http
  .createServer((req, res) => {
    let file;
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      file = path.join(root, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`Игра: http://localhost:${port}`));
