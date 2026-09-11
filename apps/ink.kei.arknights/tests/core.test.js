const test = require('node:test');
const assert = require('node:assert/strict');

// core.js 依赖宿主注入的 Tapp 全局；Node 环境下提供最小桩实现
globalThis.Tapp = {
  shared: {
    _store: null,
    async get() {
      return this._store;
    },
    async set(_key, value) {
      this._store = value;
    },
  },
  i18n: {
    t: (key) => key,
    getLocale: () => 'zh-CN',
  },
};

const core = require('../core.js');

// 写入一份玩家数据（填充按 uid 索引的内存缓存）
async function seed(playerMap) {
  core.setActivePlayer('uid-test', { ts: Date.now(), data: playerMap });
}

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

test('countUniqueChars: dedupes chars by appellation', () => {
  const chars = [{ charId: 'char_001' }, { charId: 'char_001' }, { charId: 'char_002' }];
  const infoMap = {
    char_001: { appellation: 'Amiya' },
    char_002: { appellation: "Kal'tsit" },
  };
  assert.equal(core.countUniqueChars(chars, infoMap), 2);
});

test('countUniqueChars: returns null when no appellation is known', () => {
  assert.equal(core.countUniqueChars([{ charId: 'char_001' }], {}), null);
  assert.equal(core.countUniqueChars([], { char_001: { appellation: 'Amiya' } }), null);
  assert.equal(core.countUniqueChars([], {}), null);
});

test('generatePlayerSummary: empty data yields placeholder summary', async () => {
  await seed(null);
  const summary = core.generatePlayerSummary('uid-test');
  assert.equal(summary.name, '');
  assert.equal(summary.avatar, '');
  assert.equal(summary.level, '');
  assert.deepEqual(
    summary.items.map((item) => item[1]),
    ['-', '-', '-', '-', '-'],
  );
});

test('generatePlayerSummary: derives values from status, chars and buildings', async () => {
  await seed({
    player: {
      status: {
        name: '博士',
        level: 120,
        registerTs: 1600000000,
        mainStageProgress: 'main_15-03',
        skinCnt: 42,
      },
      chars: [{ charId: 'char_001' }, { charId: 'char_001' }, { charId: 'char_002' }],
      charInfoMap: {
        char_001: { appellation: 'Amiya' },
        char_002: { appellation: "Kal'tsit" },
      },
      stageInfoMap: {
        'main_15-03': { id: 'main_15-03', code: '15-4', name: '深渊之侧' },
      },
      building: { furniture: { total: 99 } },
      medal: { total: 7 },
    },
  });
  const summary = core.generatePlayerSummary('uid-test');
  assert.equal(summary.name, '博士');
  assert.equal(summary.level, '120');
  assert.equal(summary.registerTs, 1600000000);
  const byKey = Object.fromEntries(summary.items);
  assert.equal(byKey['assets.progress'], '15-4');
  assert.equal(byKey['assets.operators'], '2');
  assert.equal(byKey['assets.skins'], '42');
  assert.equal(byKey['assets.furniture'], '99');
  assert.equal(byKey['assets.medals'], '7');
});

test('generatePlayerSummary: falls back to charCnt when chars are missing', async () => {
  await seed({ player: { status: { charCnt: 12 } } });
  const summary = core.generatePlayerSummary('uid-test');
  const byKey = Object.fromEntries(summary.items);
  assert.equal(byKey['assets.operators'], '12');
});

test('generatePlayerSummary: only exposes https avatar URLs', async () => {
  await seed({ player: { status: { avatar: { url: 'https://example.com/avatar.png' } } } });
  assert.equal(
    core.generatePlayerSummary('uid-test').avatar,
    'https://example.com/avatar.png',
  );

  await seed({ player: { status: { avatar: { url: 'data:image/png;base64,AAAA' } } } });
  assert.equal(core.generatePlayerSummary('uid-test').avatar, '');

  await seed({ player: { status: { avatar: { url: 'javascript:alert(1)' } } } });
  assert.equal(core.generatePlayerSummary('uid-test').avatar, '');
});
