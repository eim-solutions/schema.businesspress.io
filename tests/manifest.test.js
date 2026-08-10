'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const extensionRoot = path.join(__dirname, '..', 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));

test('uses Manifest V3 with the minimum inspection permissions', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']);
  assert.equal('host_permissions' in manifest, false);
  assert.equal('optional_host_permissions' in manifest, false);
  assert.equal('background' in manifest, false);
});

test('declares every packaged popup and icon asset', () => {
  const files = [
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    'analyzer.js',
    'popup.js',
    'popup.css',
  ];

  files.forEach((file) => {
    assert.equal(fs.existsSync(path.join(extensionRoot, file)), true, `${file} should exist`);
  });
});

test('does not contain remote script or fetch declarations', () => {
  const sourceFiles = ['popup.html', 'popup.js', 'analyzer.js', 'popup.css'];
  const source = sourceFiles.map((file) => fs.readFileSync(path.join(extensionRoot, file), 'utf8')).join('\n');

  assert.doesNotMatch(source, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/);
});

test('renders inspected page values as text instead of HTML', () => {
  const popupSource = fs.readFileSync(path.join(extensionRoot, 'popup.js'), 'utf8');

  assert.doesNotMatch(popupSource, /\.innerHTML\s*=/);
  assert.match(popupSource, /element\.textContent = text/);
});
