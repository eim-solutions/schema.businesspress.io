'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'public');
let server;
let endpoint;

async function availablePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      listener.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('PHP test server did not start.');
}

test.before(async () => {
  const port = await availablePort();
  endpoint = `http://127.0.0.1:${port}/api/inspect.php`;
  server = childProcess.spawn('php', ['-S', `127.0.0.1:${port}`, '-t', publicRoot], {
    stdio: 'ignore',
  });
  await waitForServer(endpoint);
});

test.after(() => {
  if (server && !server.killed) server.kill('SIGTERM');
});

test('URL endpoint accepts POST only', async () => {
  const response = await fetch(endpoint);
  const payload = await response.json();
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.equal(payload.ok, false);
});

test('URL endpoint blocks local and private targets', async () => {
  for (const url of ['http://127.0.0.1/', 'http://10.0.0.1/', 'http://[::1]/']) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const payload = await response.json();
    assert.equal(response.status, 422, url);
    assert.equal(payload.ok, false, url);
    assert.match(payload.error, /public internet addresses|Private and local network/i, url);
  }
});

test('URL endpoint blocks credentials and non-standard ports', async () => {
  const cases = [
    ['https://user:password@example.com/', /login details/],
    ['https://example.com:8080/', /ports 80 and 443/],
  ];

  for (const [url, message] of cases) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const payload = await response.json();
    assert.equal(response.status, 422, url);
    assert.match(payload.error, message, url);
  }
});

test('URL endpoint rejects oversized request bodies before parsing', async () => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `https://example.com/${'a'.repeat(5000)}` }),
  });
  const payload = await response.json();
  assert.equal(response.status, 413);
  assert.match(payload.error, /request is too large/i);
});
