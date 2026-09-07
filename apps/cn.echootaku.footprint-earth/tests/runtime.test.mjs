import assert from 'node:assert/strict';
import test from 'node:test';

await import('../main.js');
const RuntimeModule = await import('../page/runtime.js').then(() => globalThis.FootprintEarthRuntimeModule);

function fakeTapp(role, overrides = {}) {
  const calls = [];
  const sharedValues = overrides.sharedValues || {};
  const tapp = {
    permissions: ['storage:read', 'storage:write', 'federation:read', 'federation:room', 'federation:message'],
    user: { async getRole() { calls.push('user.getRole'); return role; } },
    shared: {
      async get(key) { calls.push(`shared.get:${key}`); return sharedValues[key] ?? null; },
      async set(key, value) { calls.push(`shared.set:${key}`); sharedValues[key] = value; }
    },
    assets: { async getArrayBuffer(name) { calls.push(`assets:${name}`); return new TextEncoder().encode(JSON.stringify({ v: 1, countries: [], regions: [] })).buffer; } },
    federation: {
      async getIdentity() { calls.push('federation.getIdentity'); return { actor_url: 'https://example.test/u/me' }; },
      async getRoom() { calls.push('federation.getRoom'); return { owner_actor: 'https://example.test/u/me' }; },
      async getRoomMembers() { calls.push('federation.getRoomMembers'); return []; },
      async getRoomMessages() { calls.push('federation.getRoomMessages'); return { messages: [] }; },
      async subscribeRoom() { calls.push('federation.subscribeRoom'); },
      async unsubscribeRoom() { calls.push('federation.unsubscribeRoom'); },
      async joinRoom() { calls.push('federation.joinRoom'); },
      onMessage(handler) { overrides.onMessage = handler; return () => calls.push('federation.offMessage'); },
      onRoomUpdate(handler) { overrides.onRoomUpdate = handler; return () => calls.push('federation.offRoomUpdate'); },
      async sendRoomMessage(roomId, payload) { calls.push(`federation.sendRoomMessage:${roomId}:${payload.payload.kind}`); },
      async removeMember() { calls.push('federation.removeMember'); }
    }
  };
  return { tapp, calls, sharedValues };
}

const config = {
  v: 1,
  campaignId: 'campaign-test',
  roomId: 'room-test',
  mapDataVersion: 'natural-earth-test',
  privacy: { minK: 3, countBuckets: [3, 5, 10, 25, 50] },
  limits: { perActor: 8, cooldownSeconds: 60, replayMessages: 2000 },
  createdDate: '2026-09-04'
};

test('guest loads public shared state and map without any Federation call', async () => {
  const fixture = fakeTapp('guest');
  const runtime = new RuntimeModule.Runtime({ tapp: fixture.tapp, view: new RuntimeModule.NullView() });
  await runtime.start();
  assert.ok(fixture.calls.some(call => call.startsWith('shared.get:')));
  assert.ok(fixture.calls.some(call => call.startsWith('assets:')));
  assert.equal(fixture.calls.some(call => call.startsWith('federation.')), false);
  assert.equal(runtime.mode, 'guest');
});

test('regular member never writes shared state while loading the Room', async () => {
  const sharedValues = { 'footprint-earth.config.v1': config };
  const fixture = fakeTapp('user', { sharedValues });
  const runtime = new RuntimeModule.Runtime({ tapp: fixture.tapp, view: new RuntimeModule.NullView() });
  await runtime.start();
  assert.ok(fixture.calls.includes('federation.getIdentity'));
  assert.ok(fixture.calls.includes('federation.getRoomMessages'));
  assert.equal(fixture.calls.some(call => call.startsWith('shared.set:')), false);
  assert.equal(runtime.mode, 'member');
});

test('a signed-in non-member can join the configured public Room before submitting', async () => {
  const sharedValues = { 'footprint-earth.config.v1': config };
  const fixture = fakeTapp('user', { sharedValues });
  let joined = false;
  fixture.tapp.federation.getRoom = async () => ({ owner_actor: 'https://example.test/u/owner' });
  fixture.tapp.federation.getRoomMembers = async () => joined ? [{ actor_url: 'https://example.test/u/me' }] : [];
  fixture.tapp.federation.joinRoom = async () => { fixture.calls.push('federation.joinRoom'); joined = true; };
  const runtime = new RuntimeModule.Runtime({ tapp: fixture.tapp, view: new RuntimeModule.NullView() });
  await runtime.start();
  assert.equal(runtime.isRoomMember, false);
  assert.equal(fixture.calls.includes('federation.getRoomMessages'), false);
  await runtime.joinCampaign();
  assert.equal(runtime.isRoomMember, true);
  assert.ok(fixture.calls.includes('federation.joinRoom'));
  assert.ok(fixture.calls.includes('federation.getRoomMessages'));
});

test('incomplete history blocks an administrator from publishing projection', async () => {
  const sharedValues = { 'footprint-earth.config.v1': config };
  const fixture = fakeTapp('admin', { sharedValues });
  fixture.tapp.federation.getRoomMessages = async () => { fixture.calls.push('federation.getRoomMessages'); throw new Error('page failed'); };
  const runtime = new RuntimeModule.Runtime({ tapp: fixture.tapp, view: new RuntimeModule.NullView() });
  await runtime.start();
  assert.equal(runtime.historyComplete, false);
  await assert.rejects(() => runtime.publishProjection(), /history_incomplete/);
  assert.equal(fixture.calls.some(call => call === 'shared.set:footprint-earth.public.v1'), false);
});

test('history pagination uses the oldest message cursor and releases the Room subscription', async () => {
  const sharedValues = { 'footprint-earth.config.v1': config };
  const fixture = fakeTapp('user', { sharedValues });
  const cursors = [];
  fixture.tapp.federation.getRoomMessages = async (_roomId, before) => {
    cursors.push(before);
    if (!before) return { messages: Array.from({ length: 100 }, (_, index) => ({
      senderActor: 'https://example.test/u/member', messageId: `m-${index}`, createdAt: new Date(Date.UTC(2026, 8, 4, 0, index)).toISOString(),
      payload: globalThis.FootprintEarthCore.makeEvent('footprint.submit', 'campaign-test', { nonce: `n-${index}`, countryCode: 'CN', status: 'visitor' })
    })) };
    return { messages: [] };
  };
  const runtime = new RuntimeModule.Runtime({ tapp: fixture.tapp, view: new RuntimeModule.NullView() });
  await runtime.start();
  assert.deepEqual(cursors, [undefined, 'm-0']);
  assert.equal(runtime.historyComplete, true);
  runtime.destroy();
  await Promise.resolve();
  assert.ok(fixture.calls.includes('federation.offMessage'));
  assert.ok(fixture.calls.includes('federation.offRoomUpdate'));
  assert.ok(fixture.calls.includes('federation.unsubscribeRoom'));
});

test('an event-authorized moderator can use governance without installation-admin role', async () => {
  const sharedValues = { 'footprint-earth.config.v1': config };
  const fixture = fakeTapp('user', { sharedValues });
  fixture.tapp.federation.getRoom = async () => ({ owner_actor: 'https://example.test/u/owner' });
  fixture.tapp.federation.getRoomMembers = async () => [{ actor_url: 'https://example.test/u/me' }];
  fixture.tapp.federation.getRoomMessages = async () => ({ messages: [
    {
      senderActor: 'https://example.test/u/owner', messageId: 'grant-1', createdAt: '2026-09-04T00:00:00.000Z',
      payload: globalThis.FootprintEarthCore.makeEvent('moderator.grant', 'campaign-test', { nonce: 'grant-1', targetActor: 'https://example.test/u/me' })
    },
    {
      senderActor: 'https://example.test/u/member', messageId: 'submission-1', createdAt: '2026-09-04T00:02:00.000Z',
      payload: globalThis.FootprintEarthCore.makeEvent('footprint.submit', 'campaign-test', { nonce: 'submission-1', countryCode: 'CN', status: 'visitor' })
    }
  ] });
  const runtime = new RuntimeModule.Runtime({ tapp: fixture.tapp, view: new RuntimeModule.NullView() });
  await runtime.start();
  assert.equal(runtime.snapshot().canModerate, true);
  await runtime.sendGovernance(globalThis.FootprintEarthCore.KINDS.hide, { targetMessageId: 'submission-1', reason: 'manual_review' });
  assert.ok(fixture.calls.some(call => call.endsWith(':moderation.hide')));
});
