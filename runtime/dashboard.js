#!/usr/bin/env node
/**
 * Swarm dashboard server.
 * Serves ui/index.html and streams .swarm/events.jsonl via SSE.
 *
 * Usage: node runtime/dashboard.js [port]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 7700;
const EVENTS_FILE = path.join(process.cwd(), '.swarm', 'events.jsonl');
const UI_DIR = path.join(process.cwd(), 'ui');

function findFreePort(start, cb) {
  const server = http.createServer();
  server.listen(start, () => {
    const port = server.address().port;
    server.close(() => cb(port));
  });
  server.on('error', () => findFreePort(start + 1, cb));
}

function readEvents(fromLine = 0) {
  try {
    const content = fs.readFileSync(EVENTS_FILE, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return { events: lines.slice(fromLine).map(l => JSON.parse(l)), total: lines.length };
  } catch {
    return { events: [], total: 0 };
  }
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url.pathname === '/' || url.pathname === '/index.html') {
      serveFile(res, path.join(UI_DIR, 'index.html'), 'text/html');

    } else if (url.pathname === '/graph.js') {
      serveFile(res, path.join(UI_DIR, 'graph.js'), 'application/javascript');

    } else if (url.pathname === '/state') {
      const { events } = readEvents();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(events));

    } else if (url.pathname === '/events') {
      // SSE stream
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('retry: 1000\n\n');

      let lastLine = 0;

      // Send existing events immediately
      const { events: existing, total } = readEvents(0);
      existing.forEach(e => res.write(`data: ${JSON.stringify(e)}\n\n`));
      lastLine = total;

      // Poll for new events
      const interval = setInterval(() => {
        const { events: fresh, total: newTotal } = readEvents(lastLine);
        fresh.forEach(e => res.write(`data: ${JSON.stringify(e)}\n\n`));
        lastLine = newTotal;

        if (fresh.some(e => e.type === 'swarm_done')) {
          clearInterval(interval);
        }
      }, 400);

      req.on('close', () => clearInterval(interval));

    } else if (url.pathname === '/event' && req.method === 'POST') {
      // Accept event POST from skill runner
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const event = JSON.parse(body);
          const line = JSON.stringify({ ...event, ts: Date.now() }) + '\n';
          fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
          fs.appendFileSync(EVENTS_FILE, line, 'utf8');
          res.writeHead(200);
          res.end('ok');
        } catch {
          res.writeHead(400);
          res.end('bad json');
        }
      });

    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });

  server.listen(port, () => {
    console.log(JSON.stringify({ type: 'dashboard_started', port, url: `http://localhost:${port}` }));
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      startServer(port + 1);
    } else {
      throw e;
    }
  });
}

const requestedPort = parseInt(process.argv[2]) || DEFAULT_PORT;
startServer(requestedPort);
