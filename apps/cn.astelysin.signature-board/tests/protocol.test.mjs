import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);
const Core = require('../main.js');
require('../page/editor.js');
const BoardEditor = globalThis.SignatureBoardEditor;

function drawing(overrides = {}) {
  return {
    v: 1,
    kind: Core.KINDS.drawing,
    boardId: 'board-1',
    drawingId: 'drawing-1',
    nonce: 'nonce-1',
    signature: 'Lumi',
    createdAt: '2026-08-26T00:00:00.000Z',
    strokes: [{ color: '#f8fafc', width: 6, points: [[100, 100], [140, 130], [180, 120]] }],
    ...overrides
  };
}

test('valid drawing is normalized within the frozen limits', () => {
  const result = Core.validateDrawing(drawing());
  assert.equal(result.ok, true);
  assert.equal(result.pointCount, 3);
  assert.deepEqual(result.bounds, { minX: 100, minY: 100, maxX: 180, maxY: 130, width: 80, height: 30 });
});

test('drawing larger than 1024 logical pixels is rejected', () => {
  const result = Core.validateDrawing(drawing({ strokes: [{ color: '#ffffff', width: 4, points: [[10, 10], [1100, 10]] }] }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('bounds_exceeded'));
});

test('page snapshot whitelist rejects active and SVG image URLs', () => {
  assert.equal(BoardEditor.safeImage('data:image/jpeg;base64,AA=='), 'data:image/jpeg;base64,AA==');
  assert.equal(BoardEditor.safeImage('data:image/png;base64,AA=='), 'data:image/png;base64,AA==');
  assert.equal(BoardEditor.safeImage('data:image/webp;base64,AA=='), 'data:image/webp;base64,AA==');
  assert.equal(BoardEditor.safeImage('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.equal(BoardEditor.safeImage('javascript:alert(1)'), '');
  assert.equal(BoardEditor.safeImage('https://example.test/snapshot.png'), '');

  const editor = Object.create(BoardEditor.prototype);
  editor.snapshotImage = {};
  editor.render = () => {};
  assert.equal(editor.setSnapshot('javascript:alert(1)'), false);
  assert.equal(editor.snapshotImage, null);

  const runtimeSource = readFileSync(new URL('../page/runtime.js', import.meta.url), 'utf8');
  assert.match(runtimeSource, /SignatureBoardEditor\.safeImage/);
  assert.doesNotMatch(runtimeSource, /\.src\s*=\s*snapshot\.dataUrl/);
});

test('dense curve samples are not collapsed into a few polygon points', () => {
  const points = Array.from({ length: 21 }, (_, index) => [100 + index * 0.5, 100 + Math.sin(index / 3) * 4]);
  const result = Core.validateDrawing(drawing({ strokes: [{ color: '#ffffff', width: 4, points }] }));
  assert.equal(result.ok, true);
  assert.ok(result.pointCount >= 16);
});

test('new landscape board rejects vertical overflow while legacy square remains readable', () => {
  const payload = drawing({ strokes: [{ color: '#332e3b', width: 4, points: [[100, 2200], [120, 2400]] }] });
  const landscape = Core.validateDrawing(payload);
  const legacy = Core.validateDrawing(payload, { canvasWidth: 4096, canvasHeight: 4096 });
  assert.ok(landscape.errors.includes('canvas_exceeded'));
  assert.equal(legacy.ok, true);
});

test('federation envelope decoder handles nested room message shape', () => {
  const raw = {
    roomId: 'room-1',
    data: { message: { id: 'message-1', sender_actor: 'HTTPS://EXAMPLE/Users/Lumi/', content: { message_type: Core.LIMITS.messageType, payload: drawing() } } }
  };
  const decoded = Core.decodeFederationEnvelope(raw);
  assert.equal(decoded.roomId, 'room-1');
  assert.equal(decoded.sender, 'https://example/users/lumi');
  assert.equal(decoded.payload.kind, Core.KINDS.drawing);
});

test('replay trusts envelope sender and only accepts owner moderation', () => {
  const events = [
    { payload: drawing(), sender: 'https://site/users/lumi', createdAt: '2026-08-26T00:00:00Z' },
    { payload: Core.makeEvent(Core.KINDS.hide, 'board-1', { targetId: 'drawing-1' }), sender: 'https://site/users/not-admin', createdAt: '2026-08-26T00:01:00Z' },
    { payload: Core.makeEvent(Core.KINDS.hide, 'board-1', { targetId: 'drawing-1' }), sender: 'https://site/users/owner', createdAt: '2026-08-26T00:02:00Z' }
  ];
  const state = Core.replayEvents(events, { boardId: 'board-1', ownerActor: 'https://site/users/owner' });
  assert.equal(state.audit[0].author, 'https://site/users/lumi');
  assert.equal(state.audit[0].hidden, true);
  assert.equal(state.drawings.length, 0);
});

test('blocked actors are excluded without deleting source events', () => {
  const state = Core.replayEvents([{ payload: drawing(), sender: 'https://site/users/lumi' }], {
    boardId: 'board-1', ownerActor: 'https://site/users/owner', blockedActors: ['https://site/users/lumi']
  });
  assert.equal(state.drawings.length, 0);
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].blocked, true);
});

test('only the owner can resolve a moderation report', () => {
  const report = Core.makeEvent(Core.KINDS.report, 'board-1', { targetId: 'drawing-1', reason: 'spam' });
  const rejectedResolution = Core.makeEvent(Core.KINDS.resolveReport, 'board-1', { reportId: report.nonce, resolution: 'reviewed' });
  const acceptedResolution = Core.makeEvent(Core.KINDS.resolveReport, 'board-1', { reportId: report.nonce, resolution: 'reviewed' });
  const state = Core.replayEvents([
    { payload: drawing(), sender: 'https://site/users/lumi', createdAt: '2026-08-26T00:00:00Z' },
    { payload: report, sender: 'https://site/users/reporter', createdAt: '2026-08-26T00:01:00Z' },
    { payload: rejectedResolution, sender: 'https://site/users/member', createdAt: '2026-08-26T00:02:00Z' },
    { payload: acceptedResolution, sender: 'https://site/users/owner', createdAt: '2026-08-26T00:03:00Z' }
  ], { boardId: 'board-1', ownerActor: 'https://site/users/owner' });
  assert.equal(state.reports[0].resolved, true);
  assert.equal(state.stats.pendingReports, 0);
});

test('occupancy uses deterministic 64 by 64 coarse grid', () => {
  const checked = Core.validateDrawing(drawing());
  const first = Core.occupancy([{ strokes: checked.payload.strokes }]);
  const second = Core.occupancy([{ strokes: checked.payload.strokes }]);
  assert.deepEqual(first, second);
  assert.equal(first.total, 4096);
  assert.ok(first.used > 0);
});
