'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const flatten = (value, prefix = '', output = new Set()) => {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, output); else output.add(next);
  }
  return output;
};

test('all three locales expose an identical key set', () => {
  const locales = ['zh-CN', 'en-US', 'ja-JP'].map((name) => flatten(JSON.parse(read(`i18n/${name}.json`))));
  assert.deepEqual([...locales[1]].sort(), [...locales[0]].sort());
  assert.deepEqual([...locales[2]].sort(), [...locales[0]].sort());
});

test('literal translation references exist', () => {
  const source = `${read('main.js')}\n${read('page.html')}`;
  const keys = flatten(JSON.parse(read('i18n/zh-CN.json')));
  const refs = new Set();
  for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g)) refs.add(match[1]);
  for (const match of source.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) refs.add(match[1]);
  for (const key of refs) if (!key.endsWith('.')) assert.ok(keys.has(key), `missing translation: ${key}`);
});

test('page keeps background and safe-area content separate', () => {
  const html = read('page.html'); const css = read('page.css');
  assert.match(html, /^<div id="gomoku-background"[^>]*><\/div>\s*<main id="gomoku-content">/);
  assert.match(css, /#gomoku-background\{position:fixed;inset:0/);
  assert.match(css, /#gomoku-content\{min-height:100dvh/);
  assert.match(css, /--tapp-safe-inset-top/);
  assert.doesNotMatch(css, /--tapp-safe-area-inset-/);
  assert.doesNotMatch(html, /<(?:script|iframe|object|embed)\b/i);
});

test('dynamic identity is not overwritten by static locale rendering', () => {
  const html = read('page.html'); const source = read('main.js');
  assert.match(html, /id="identity-text"(?![^>]*data-i18n)/);
  assert.match(source, /function renderIdentity\(\)/);
  assert.match(source, /applyStaticI18n\(\)[\s\S]*?renderIdentity\(\)/);
});

test('room dissolution is explicit and never tied to lifecycle teardown', () => {
  const html = read('page.html'); const source = read('main.js');
  assert.match(html, /id="dissolve-room"/);
  assert.match(source, /async function dissolveRoom\(\)[\s\S]*?federation\.deleteRoom\(deleting\)/);
  const destroyBlock = source.slice(source.indexOf('Tapp.lifecycle.onDestroy'), source.indexOf('Tapp.lifecycle.onPause'));
  assert.doesNotMatch(destroyBlock, /deleteRoom/);
});

test('runtime has no direct network or dynamic-code escape', () => {
  const source = read('main.js');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /payload\.(?:actor|actorId|actor_id)/);
  assert.match(source, /sender_actor/);
});

test('board intersections and clipboard fallback match the sandbox runtime', () => {
  const css = read('page.css'); const source = read('main.js');
  assert.match(css, /\.board\{[^}]*padding:3\.125%/);
  assert.match(css, /repeating-linear-gradient/);
  assert.match(source, /navigator\.clipboard[\s\S]*?catch \(error\)[\s\S]*?document\.execCommand\('copy'\)/);
});

test('online lobby locks the board and exposes both readiness states', () => {
  const html = read('page.html'); const css = read('page.css'); const source = read('main.js');
  assert.match(html, /id="lobby-lock"[\s\S]*?id="lock-black-status"[\s\S]*?id="lock-white-status"/);
  assert.match(source, /game\.phase === 'lobby'[\s\S]*?els\.board\.inert = locked/);
  assert.match(source, /blackReady\.textContent = t\(!state\.players\.black \? 'room\.waiting' : blackIsReady \? 'room\.readyBadge' : 'room\.notReady'\)/);
  assert.match(css, /\.lobby-lock\{[^}]*position:absolute;inset:0/);
});

test('turn feedback follows the active color and lobby seats can swap safely', () => {
  const html = read('page.html'); const css = read('page.css'); const source = read('main.js');
  assert.match(html, /id="turn-alert"[^>]*data-i18n="status\.waitTurn"/);
  assert.match(html, /id="swap-colors"/);
  assert.match(css, /\.board\.preview-enabled\.turn-white[^{]*\{[^}]*#fff/);
  assert.match(source, /intent\.action === 'swap'[\s\S]*?state\.phase === 'lobby'[\s\S]*?state\.players\.black = state\.players\.white[\s\S]*?state\.ready\[state\.players\.black\] = false/);
  assert.match(source, /submitIntent\(\{ action: 'swap', seq: state && state\.seq \}\)/);
});

test('turn alert keeps its layout slot and federation profiles provide nicknames', () => {
  const html = read('page.html'); const css = read('page.css'); const source = read('main.js');
  assert.match(html, /id="turn-alert" class="turn-alert"/);
  assert.match(css, /\.turn-alert\{[^}]*height:54px[^}]*opacity:0[^}]*visibility:hidden[^}]*transition:/);
  assert.match(css, /\.turn-alert\.visible\{[^}]*opacity:1[^}]*visibility:visible/);
  assert.match(source, /federation\.getRoomMembers\(targetRoom\)/);
  assert.match(source, /member\.display_name \|\| member\.displayName \|\| member\.name \|\| member\.username/);
  assert.match(source, /turnAlert\.classList\.toggle\('visible', waitingTurn\)/);
});

test('federated state is anchored to the room owner and serialized', () => {
  const source = read('main.js');
  assert.match(source, /fetchRoomOwner\(joinedRoomId\)/);
  assert.match(source, /fetchRoomOwner\(restoringRoomId\)/);
  assert.match(source, /owner_actor \|\| detail\.ownerActor/);
  assert.match(source, /sender !== hostActor \|\| next\.hostActor !== hostActor/);
  assert.match(source, /queueRoomTask\(async function \(\)/);
  assert.match(source, /candidate\.indexOf\('@'\) >= 0\) return false/);
  assert.match(source, /intent\.seq !== state\.seq \|\| intent\.round !== state\.round/);
  assert.match(source, /state\.ready\[sender\] = intent\.ready/);
});

test('rejected placements and room resume fail closed', () => {
  const source = read('main.js');
  assert.match(source, /function placementResult\(row, col\)[\s\S]*?if \(!board\) return 'blocked';[\s\S]*?if \(board\[row\]\[col\]\) return 'occupied'/);
  assert.match(source, /var placement = placementResult\(row, col\);[\s\S]*?placement === 'occupied' \? 'status\.occupied' : 'status\.notYourTurn'/);
  assert.match(source, /function canResumeRoom\(\)[\s\S]*?savedSession\.roomId && myActor[\s\S]*?federation\.getRoom === 'function'[\s\S]*?federation\.subscribeRoom === 'function'/);
  assert.match(source, /resumeRoom\.classList\.toggle\('hidden', !canResumeRoom\(\) \|\| inRoom\)/);
});
