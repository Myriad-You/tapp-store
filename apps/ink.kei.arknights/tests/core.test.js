const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

test('sanitizeRepoBase: accepts valid https URLs', () => {
  assert.equal(core.sanitizeRepoBase('https://example.com'), 'https://example.com');
  assert.equal(core.sanitizeRepoBase('https://example.com/'), 'https://example.com');
  assert.equal(core.sanitizeRepoBase('https://example.com///'), 'https://example.com');
  assert.equal(core.sanitizeRepoBase('  https://example.com/path  '), 'https://example.com/path');
  assert.equal(
    core.sanitizeRepoBase('https://raw.githubusercontent.com/leaphy-dev/ArknightsGameResource/main'),
    'https://raw.githubusercontent.com/leaphy-dev/ArknightsGameResource/main',
  );
});

test('sanitizeRepoBase: rejects non-https or malformed input', () => {
  assert.equal(core.sanitizeRepoBase('http://example.com'), '');
  assert.equal(core.sanitizeRepoBase('javascript:alert(1)'), '');
  assert.equal(core.sanitizeRepoBase('data:text/html,x'), '');
  assert.equal(core.sanitizeRepoBase('//example.com'), '');
  assert.equal(core.sanitizeRepoBase('/relative/path'), '');
  assert.equal(core.sanitizeRepoBase('example.com'), '');
  assert.equal(core.sanitizeRepoBase('https://'), '');
  assert.equal(core.sanitizeRepoBase(''), '');
  assert.equal(core.sanitizeRepoBase('   '), '');
  assert.equal(core.sanitizeRepoBase(null), '');
  assert.equal(core.sanitizeRepoBase(undefined), '');
  assert.equal(core.sanitizeRepoBase(123), '');
});

test('getPlayerSummary: empty data yields placeholder summary', () => {
  const summary = core.getPlayerSummary(null);
  assert.equal(summary.name, '');
  assert.equal(summary.avatar, '');
  assert.equal(summary.level, '');
  assert.deepEqual(
    summary.items.map((item) => item[1]),
    ['-', '-', '-', '-', '-'],
  );
});

test('getPlayerSummary: derives values from status, chars and buildings', () => {
  const summary = core.getPlayerSummary({
    player: {
      status: {
        name: '博士',
        level: 120,
        registerTs: 1600000000,
        mainStageProgress: 'main_1-8',
        skinCnt: 42,
      },
      chars: [{ charId: 'char_001' }, { charId: 'char_001' }, { charId: 'char_002' }],
      building: { furniture: { total: 99 } },
      medal: { total: 7 },
    },
  });
  assert.equal(summary.name, '博士');
  assert.equal(summary.level, '120');
  assert.equal(summary.registerTs, 1600000000);
  const byKey = Object.fromEntries(summary.items);
  assert.equal(byKey['assets.progress'], '1-8');
  assert.equal(byKey['assets.operators'], '2');
  assert.equal(byKey['assets.skins'], '42');
  assert.equal(byKey['assets.furniture'], '99');
  assert.equal(byKey['assets.medals'], '7');
});

test('getPlayerSummary: falls back to charCnt when chars are missing', () => {
  const summary = core.getPlayerSummary({ player: { status: { charCnt: 12 } } });
  const byKey = Object.fromEntries(summary.items);
  assert.equal(byKey['assets.operators'], '12');
});

test('getPlayerSummary: only exposes https avatar URLs', () => {
  const https = core.getPlayerSummary({
    player: { status: { avatar: { url: 'https://example.com/avatar.png' } } },
  });
  assert.equal(https.avatar, 'https://example.com/avatar.png');

  const dataUrl = core.getPlayerSummary({
    player: { status: { avatar: { url: 'data:image/png;base64,AAAA' } } },
  });
  assert.equal(dataUrl.avatar, '');

  const javascriptUrl = core.getPlayerSummary({
    player: { status: { avatar: { url: 'javascript:alert(1)' } } },
  });
  assert.equal(javascriptUrl.avatar, '');
});
