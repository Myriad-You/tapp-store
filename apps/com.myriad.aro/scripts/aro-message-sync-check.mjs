#!/usr/bin/env node
/**
 * Regression checks for transcript bookkeeping (optimistic sends + bubble runs).
 *
 * Both behaviours are only visible mid-flight — a send that is confirmed but not
 * yet polled, or a burst of bubbles from one author — so they are easy to break
 * without any static check noticing. Runs page/msgSync.js and page/msgUi.js in a
 * VM against stub globals; no DOM, no host bridge.
 *
 *   node scripts/aro-message-sync-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'page');
const ME = 'https://a.example/users/me';
const PEER = 'https://b.example/users/peer';

const ctx = {
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  setTimeout,
  clearTimeout,
  esc: (s) => String(s == null ? '' : s),
  lang: {},
  SVG_ICONS: new Proxy({}, { get: () => '<svg/>' }),
  avatarContentHtml: (urlStr, name) => String(name || '?')[0],
  dayLabel: () => 'Today',
  timeStr: () => '10:00',
  fullTimeStr: () => '10:00',
  safeIconUrl: () => '',
  safeMessageImageUrl: () => '',
  formatMessageTextHtml: (t) => String(t),
  findMemberByActor: () => null,
  e2eUndecryptableLabel: () => '',
  e2eKeyExchangeLabel: () => 'key exchange',
  sameActorUrl: (a, b) => !!a && !!b && String(a) === String(b),
  isLocalActor: (a) => a === ME,
  getPayloadText: (p) => (p && typeof p === 'object' ? p.text || '' : ''),
  isE2eCiphertextEnvelope: (p) => !!(p && typeof p === 'object' && p.ciphertext),
  isE2eKeyExchangeMessage: (m, t, p) => !!(p && p.publicKey),
  renderMessages: () => { ctx.__paints.push({ direct: true }); },
  scheduleRenderMessages: (o) => { ctx.__paints.push(o || {}); },
  pollMessages: async () => {},
  __paints: [],
};
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const file of ['msgSync.js', 'msgUi.js']) {
  vm.runInContext(fs.readFileSync(path.join(PAGE, file), 'utf8'), ctx, { filename: file });
}

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ✓ ${name}`);
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};
const msg = (id, actor, text, at, extra = {}) => ({
  message_id: id, sender_actor: actor, message_type: 'text',
  payload: { text }, created_at: at, ...extra,
});

console.log('aro-message-sync-check');

// ---- optimistic sends ----
ctx.state = {
  activeKind: 'room',
  activeId: 'rm_1',
  messages: [
    msg('opt_1', ME, 'hi', '2026-08-08T22:52:00.000Z', { _optimistic: true, _serverId: 'msg_9' }),
    // Confirmed copy is still ciphertext, so content matching cannot settle it.
    {
      message_id: 'msg_9', sender_actor: ME, message_type: 'text',
      payload: { ciphertext: 'AAAA', algorithm: 'x25519' },
      created_at: '2026-08-08T22:52:01.000Z',
    },
  ],
};
check(
  'encrypted send: recorded server id retires the optimistic bubble',
  ctx.pruneOptimisticMessages({}) === true
    && ctx.state.messages.length === 1
    && ctx.state.messages[0].message_id === 'msg_9',
  JSON.stringify(ctx.state.messages.map((m) => m.message_id)),
);

ctx.__paints = [];
ctx.state = {
  activeKind: 'room',
  activeId: 'rm_1',
  messages: [
    msg('msg_1', PEER, 'hi', '2026-08-08T22:50:00.000Z'),
    msg('opt_2', ME, 'yo', '2026-08-08T22:52:00.000Z', { _optimistic: true }),
  ],
};
ctx.mergeIncomingMessage(msg('msg_2', ME, 'yo', '2026-08-08T22:52:01.000Z'));
check(
  'ws echo of our own send leaves one bubble, not a sending/sent pair',
  ctx.state.messages.length === 2 && !ctx.state.messages.some((m) => m._optimistic),
  JSON.stringify(ctx.state.messages.map((m) => m.message_id)),
);
check(
  'a retiring echo repaints in full (append-only would strand the old row)',
  ctx.__paints.length === 1 && ctx.__paints[0].forceFull === true,
  JSON.stringify(ctx.__paints),
);

ctx.__paints = [];
ctx.state = {
  activeKind: 'room',
  activeId: 'rm_1',
  messages: [msg('msg_1', ME, 'yo', '2026-08-08T22:50:00.000Z')],
};
ctx.mergeIncomingMessage(msg('msg_3', PEER, 'hey', '2026-08-08T22:51:00.000Z'));
check(
  'a peer message still takes the cheap append paint',
  ctx.__paints.length === 1 && ctx.__paints[0].animateNew === true && !ctx.__paints[0].forceFull,
  JSON.stringify(ctx.__paints),
);

// ---- bubble runs ----
const avatarsFor = (messages) => {
  ctx.state = { activeKind: 'room', activeId: 'rm_1', messages, members: [] };
  const dayCtx = { lastDayKey: '' };
  return messages.map((m, i) => {
    const html = ctx.buildMessageEntryHtml(m, i, { dayCtx });
    if (html.includes('class="msg-avatar"')) return 'avatar';
    return html.includes('msg-avatar-spacer') ? 'spacer' : 'none';
  });
};
const runIs = (name, messages, expected) => {
  const got = avatarsFor(messages);
  check(name, JSON.stringify(got) === JSON.stringify(expected), got.join(','));
};

runIs('avatar renders once, on the last bubble of a run', [
  msg('m1', PEER, 'one', '2026-08-08T23:05:00.000Z'),
  msg('m2', PEER, 'two', '2026-08-08T23:05:30.000Z'),
  msg('m3', PEER, 'three', '2026-08-08T23:06:00.000Z'),
], ['spacer', 'spacer', 'avatar']);

runIs('a gap past the burst window starts a new run', [
  msg('m1', PEER, 'one', '2026-08-08T23:05:00.000Z'),
  msg('m2', PEER, 'two', '2026-08-08T23:20:00.000Z'),
], ['avatar', 'avatar']);

runIs('another author between two rows breaks the run', [
  msg('m1', PEER, 'one', '2026-08-08T23:05:00.000Z'),
  msg('m2', ME, 'mine', '2026-08-08T23:05:10.000Z'),
  msg('m3', PEER, 'two', '2026-08-08T23:05:20.000Z'),
], ['avatar', 'none', 'avatar']);

runIs('a key-exchange separator does not split the run', [
  msg('m1', PEER, 'one', '2026-08-08T23:05:00.000Z'),
  {
    message_id: 'kx', sender_actor: PEER, message_type: 'text',
    payload: { publicKey: 'K', algorithm: 'x25519' },
    created_at: '2026-08-08T23:05:05.000Z',
  },
  msg('m3', PEER, 'two', '2026-08-08T23:05:20.000Z'),
], ['spacer', 'none', 'avatar']);

// Grouping keys off the local calendar day, same as the day separator, so build
// this pair around local midnight rather than a fixed UTC instant.
runIs('a day separator ends the run even inside the burst window', [
  msg('m1', PEER, 'one', new Date(2026, 7, 8, 23, 59, 30).toISOString()),
  msg('m2', PEER, 'two', new Date(2026, 7, 9, 0, 1, 0).toISOString()),
], ['avatar', 'avatar']);

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\naro-message-sync-check: ok');
