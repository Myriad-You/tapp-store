import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const Core = require('../main.js');

const mapIndex = Core.createMapIndex({
  countries: [
    { code: 'AU', point: [134, -25] },
    { code: 'BR', point: [-52, -10] },
    { code: 'CA', point: [-106, 56] },
    { code: 'CN', point: [104, 35] },
    { code: 'DE', point: [10, 51] },
    { code: 'FR', point: [2, 46] },
    { code: 'GB', point: [-2, 54] },
    { code: 'JP', point: [138, 36] },
    { code: 'US', point: [-98, 39] }
  ],
  regions: [
    { code: '710000', countryCode: 'CN', point: [121, 24] },
    { code: 'CN-BJ', countryCode: 'CN', point: [116.4, 39.9] },
    { code: 'JP-13', countryCode: 'JP', point: [139.7, 35.7] },
    { code: 'US-CA', countryCode: 'US', point: [-119.4, 36.8] }
  ]
});

function submission(overrides = {}) {
  return {
    v: 1,
    kind: 'footprint.submit',
    campaignId: 'campaign-1',
    nonce: 'nonce-1',
    countryCode: 'JP',
    regionCode: 'JP-13',
    status: 'visitor',
    ...overrides
  };
}

function envelope(payload, overrides = {}) {
  return {
    roomId: 'room-1',
    data: {
      message: {
        id: overrides.messageId || payload.nonce,
        sender_actor: overrides.sender || 'https://example.test/users/lumi',
        created_at: overrides.createdAt || '2026-09-04T00:00:00.000Z',
        content: {
          message_type: 'footprint-earth.v1',
          payload
        }
      }
    }
  };
}

test('submission schema accepts only known administrative codes', () => {
  const checked = Core.validateSubmission(submission(), mapIndex, 'campaign-1');
  assert.equal(checked.ok, true);
  assert.deepEqual(checked.value, submission());
});

test('Taiwan is accepted only as province 710000 under China and legacy TW is normalized', () => {
  const canonical = Core.validateSubmission(submission({ countryCode: 'CN', regionCode: '710000' }), mapIndex, 'campaign-1');
  assert.equal(canonical.ok, true);
  assert.equal(canonical.value.countryCode, 'CN');
  assert.equal(canonical.value.regionCode, '710000');

  const legacy = Core.validateSubmission(submission({ countryCode: 'TW', regionCode: undefined }), mapIndex, 'campaign-1');
  assert.equal(legacy.ok, true);
  assert.equal(legacy.value.countryCode, 'CN');
  assert.equal(legacy.value.regionCode, '710000');
  assert.equal(mapIndex.countries.has('TW'), false);
});

test('submission rejects coordinates, identity, time, city and other unknown fields', () => {
  for (const extra of [
    { lat: 35.7 },
    { lng: 139.7 },
    { coordinates: [139.7, 35.7] },
    { city: 'Tokyo' },
    { actor: 'forged' },
    { createdAt: '2026-09-04T00:00:00Z' },
    { nickname: 'Lumi' }
  ]) {
    const result = Core.validateSubmission(submission(extra), mapIndex, 'campaign-1');
    assert.equal(result.ok, false, JSON.stringify(extra));
    assert.ok(result.errors.includes('unknown_field'), JSON.stringify(result.errors));
  }
});

test('submission rejects cross-country region, malformed code and payloads over 2 KiB', () => {
  assert.ok(Core.validateSubmission(submission({ countryCode: 'CN' }), mapIndex, 'campaign-1').errors.includes('region_country_mismatch'));
  assert.ok(Core.validateSubmission(submission({ countryCode: 'japan', regionCode: undefined }), mapIndex, 'campaign-1').errors.includes('country_invalid'));
  assert.ok(Core.validateSubmission(submission({ nonce: 'n'.repeat(2100) }), mapIndex, 'campaign-1').errors.includes('payload_too_large'));
});

test('federation decoder takes actor, message id and time from the server envelope', () => {
  const decoded = Core.decodeEnvelope(envelope(submission(), {
    sender: 'HTTPS://EXAMPLE.TEST/Users/Lumi/',
    messageId: 'message-42',
    createdAt: '2026-09-04T01:02:03.000Z'
  }));
  assert.equal(decoded.senderActor, 'https://example.test/users/lumi');
  assert.equal(decoded.messageId, 'message-42');
  assert.equal(decoded.createdAt, '2026-09-04T01:02:03.000Z');
  assert.equal(decoded.payload.countryCode, 'JP');
});

test('replay deduplicates message ids and actor nonces', () => {
  const raw = submission();
  const state = Core.replayEvents([
    envelope(raw, { messageId: 'm-1' }),
    envelope(submission({ nonce: 'nonce-2' }), { messageId: 'm-1', createdAt: '2026-09-04T00:02:00Z' }),
    envelope(raw, { messageId: 'm-3', createdAt: '2026-09-04T00:04:00Z' })
  ], { campaignId: 'campaign-1', ownerActor: 'https://example.test/users/owner', mapIndex });
  assert.equal(state.submissions.length, 1);
  assert.equal(state.stats.duplicates, 2);
});

test('replay enforces first-location wins, sixty-second cooldown and eight-location quota', () => {
  const locations = [
    ['AU'], ['BR'], ['CA'], ['CN'], ['DE'], ['FR'], ['GB'], ['JP'], ['US']
  ];
  const events = locations.map(([countryCode], index) => envelope(submission({
    nonce: `n-${index}`,
    countryCode,
    regionCode: undefined
  }), {
    messageId: `m-${index}`,
    createdAt: new Date(Date.UTC(2026, 8, 4, 0, index * 2)).toISOString()
  }));
  events.splice(1, 0, envelope(submission({ nonce: 'too-fast', countryCode: 'US', regionCode: 'US-CA' }), {
    messageId: 'm-fast',
    createdAt: '2026-09-04T00:00:30.000Z'
  }));
  events.push(envelope(submission({ nonce: 'same-place', countryCode: 'AU', regionCode: undefined }), {
    messageId: 'm-same',
    createdAt: '2026-09-04T00:30:00.000Z'
  }));
  const state = Core.replayEvents(events, {
    campaignId: 'campaign-1',
    ownerActor: 'https://example.test/users/owner',
    mapIndex
  });
  assert.equal(state.submissions.length, 8);
  assert.equal(state.stats.cooldownRejected, 1);
  assert.equal(state.stats.quotaRejected, 1);
  assert.equal(state.stats.locationDuplicates, 1);
});

test('only owner can grant moderators and revoked moderator cannot restore content', () => {
  const owner = 'https://example.test/users/owner';
  const moderator = 'https://example.test/users/mod';
  const outsider = 'https://example.test/users/outsider';
  const target = envelope(submission(), { messageId: 'target', sender: 'https://example.test/users/member' });
  const events = [
    target,
    envelope(Core.makeEvent('moderator.grant', 'campaign-1', { nonce: 'bad-grant', targetActor: moderator }), { messageId: 'bad-grant', sender: outsider, createdAt: '2026-09-04T00:01:01Z' }),
    envelope(Core.makeEvent('moderator.grant', 'campaign-1', { nonce: 'grant', targetActor: moderator }), { messageId: 'grant', sender: owner, createdAt: '2026-09-04T00:02:02Z' }),
    envelope(Core.makeEvent('moderation.hide', 'campaign-1', { nonce: 'hide', targetMessageId: 'target', reason: 'spam' }), { messageId: 'hide', sender: moderator, createdAt: '2026-09-04T00:03:03Z' }),
    envelope(Core.makeEvent('moderator.revoke', 'campaign-1', { nonce: 'revoke', targetActor: moderator }), { messageId: 'revoke', sender: owner, createdAt: '2026-09-04T00:04:04Z' }),
    envelope(Core.makeEvent('moderation.restore', 'campaign-1', { nonce: 'restore', targetMessageId: 'target' }), { messageId: 'restore', sender: moderator, createdAt: '2026-09-04T00:05:05Z' })
  ];
  const state = Core.replayEvents(events, { campaignId: 'campaign-1', ownerActor: owner, mapIndex });
  assert.equal(state.submissions.length, 0);
  assert.equal(state.audit[0].hidden, true);
  assert.deepEqual(state.moderators, []);
  assert.equal(state.stats.unauthorizedGovernance, 2);
});

test('block and unblock events filter submissions without erasing audit history', () => {
  const owner = 'https://example.test/users/owner';
  const actor = 'https://example.test/users/member';
  const events = [
    envelope(submission(), { messageId: 'target', sender: actor }),
    envelope(Core.makeEvent('member.block', 'campaign-1', { nonce: 'block', targetActor: actor }), { messageId: 'block', sender: owner, createdAt: '2026-09-04T00:02:00Z' })
  ];
  const blocked = Core.replayEvents(events, { campaignId: 'campaign-1', ownerActor: owner, mapIndex });
  assert.equal(blocked.submissions.length, 0);
  assert.equal(blocked.audit.length, 1);
  assert.equal(blocked.audit[0].blocked, true);
  events.push(envelope(Core.makeEvent('member.unblock', 'campaign-1', { nonce: 'unblock', targetActor: actor }), { messageId: 'unblock', sender: owner, createdAt: '2026-09-04T00:03:00Z' }));
  const unblocked = Core.replayEvents(events, { campaignId: 'campaign-1', ownerActor: owner, mapIndex });
  assert.equal(unblocked.submissions.length, 1);
});

test('public projection suppresses k below three, buckets counts and contains no identity data', () => {
  const rawSubmissions = [
    ['a', 'JP', 'JP-13'], ['b', 'JP', 'JP-13'], ['c', 'JP', 'JP-13'],
    ['d', 'CN', 'CN-BJ'], ['e', 'CN', 'CN-BJ']
  ];
  const state = {
    submissions: rawSubmissions.map(([actor, countryCode, regionCode], index) => ({
      senderActor: `https://example.test/users/${actor}`,
      messageId: `message-${index}`,
      createdAt: `2026-09-04T00:0${index}:00Z`,
      countryCode,
      regionCode
    })),
    stats: { acceptedSubmissions: 5, suppressed: 0 }
  };
  const projection = Core.buildPublicProjection(state, { campaignId: 'campaign-1', publishedDate: '2026-09-04', minK: 3 });
  assert.deepEqual(projection.countries, [{ code: 'JP', countBucket: '3-4' }]);
  assert.deepEqual(projection.regions, [{ code: 'JP-13', countryCode: 'JP', countBucket: '3-4' }]);
  assert.equal(projection.totalContributorsBucket, '5-9');
  assert.equal(JSON.stringify(projection).includes('example.test'), false);
  assert.equal(JSON.stringify(projection).includes('message-'), false);
  assert.equal(JSON.stringify(projection).includes('T00:'), false);
});

test('public projection reader rejects unknown fields, invalid buckets and non-allowlisted codes', () => {
  const safe = Core.validatePublicProjection({
    v: 1,
    campaignId: 'campaign-safe',
    publishedDate: '2026-09-04',
    totalContributorsBucket: '3-4',
    countries: [{ code: 'JP', countBucket: '3-4' }],
    regions: [{ code: 'JP-13', countryCode: 'JP', countBucket: '5-9' }],
    diagnostics: { reviewedSubmissions: 5, suppressedLocations: 1 }
  }, mapIndex, 'campaign-safe');
  assert.equal(safe.ok, true);
  assert.equal(Core.validatePublicProjection({ ...safe.value, actor: 'https://evil.test/u/x' }, mapIndex, 'campaign-safe').ok, false);
  assert.equal(Core.validatePublicProjection({ ...safe.value, countries: [{ code: 'JP', countBucket: 'about-five' }] }, mapIndex, 'campaign-safe').ok, false);
  assert.equal(Core.validatePublicProjection({ ...safe.value, regions: [{ code: 'JP-404', countryCode: 'JP', countBucket: '3-4' }] }, mapIndex, 'campaign-safe').ok, false);
});

test('public projection reader migrates legacy TW country entries to Taiwan province', () => {
  const checked = Core.validatePublicProjection({
    v: 1,
    campaignId: 'campaign-safe',
    publishedDate: '2026-09-04',
    totalContributorsBucket: '3-4',
    countries: [{ code: 'TW', countBucket: '3-4' }],
    regions: [],
    diagnostics: { reviewedSubmissions: 3, suppressedLocations: 0 }
  }, mapIndex, 'campaign-safe');

  assert.equal(checked.ok, true);
  assert.deepEqual(checked.value.countries, []);
  assert.deepEqual(checked.value.regions, [{ code: '710000', countryCode: 'CN', countBucket: '3-4' }]);
  assert.equal(Core.validatePublicProjection({
    v: 1,
    campaignId: 'campaign-safe',
    publishedDate: '2026-09-04',
    totalContributorsBucket: '3-4',
    countries: [{ code: 'TW', countBucket: '3-4', actor: 'forged' }],
    regions: [],
    diagnostics: { reviewedSubmissions: 3, suppressedLocations: 0 }
  }, mapIndex, 'campaign-safe').ok, false);
});
