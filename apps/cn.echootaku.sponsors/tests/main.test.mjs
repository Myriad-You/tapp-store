import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadApp(api) {
  const context = {
    AbortController,
    Intl,
    console,
    Tapp: {
      api,
      i18n: { t: (key, params = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => params[name] ?? '') },
      pages: null,
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(appRoot, 'main.js'), 'utf8'), context);
  return context;
}

test('爱发电赞助者转换为统一数据模型', () => {
  const app = loadApp(async () => ({}));
  const recurring = app.normalizeAfdianSponsor({
    current_plan: { name: '为爱发电', show_price: '5.00', permanent: 0 },
    all_sum_amount: '25.00',
    create_time: 1_700_000_000,
    user: { user_id: 'supporter-1', name: 'Echo' },
  }, 0);

  assert.equal(recurring.id, 'afdian:supporter-1');
  assert.equal(recurring.currency, 'CNY');
  assert.equal(recurring.amountMinor, 500);
  assert.equal(recurring.lifetimeMinor, 2500);
  assert.equal(recurring.recurring, true);
  assert.equal(recurring.oneTime, false);

  const unnamed = app.normalizeAfdianSponsor({ user: { user_id: 'supporter-2' } }, 1);
  assert.equal(unnamed.name, '');
  app.Tapp.i18n.t = (key) => key === 'unknownSponsor' ? '动态匿名名' : key;
  assert.equal(app.sponsorDisplayName(unnamed), '动态匿名名');
});

test('爱发电同步按官方分页结构读取全部页面', async () => {
  const calls = [];
  const app = loadApp(async (name, params) => {
    calls.push({ name, params });
    const page = JSON.parse(params.query).page;
    return {
      ec: 200,
      data: {
        total_page: 2,
        list: [{
          current_plan: { name: page === 1 ? '月度方案' : '', price: '5.00' },
          all_sum_amount: '5.00',
          user: { user_id: `supporter-${page}`, name: `Supporter ${page}` },
        }],
      },
    };
  });

  const supporters = await app.syncAfdian({ afdianUserId: 'creator_user_123' });
  assert.equal(supporters.length, 2);
  assert.deepEqual(calls.map((call) => call.name), ['afdianSponsors', 'afdianSponsors']);
  assert.deepEqual(calls.map((call) => JSON.parse(call.params.query)), [
    { page: 1, per_page: 100 },
    { page: 2, per_page: 100 },
  ]);
});

test('爱发电 Token 只绑定宿主签名且不进入请求体', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const api = manifest.apis.afdianSponsors;
  assert.equal(api.endpoint, 'https://ifdian.net/api/open/query-sponsor');
  assert.equal(api.credential.key, 'afdianToken');
  assert.equal(api.credential.in, 'sign');
  assert.equal(api.credential.sign.alg, 'md5-sorted-kv');
  assert.deepEqual(api.credential.sign.over, ['params', 'ts', 'user_id']);
  assert.equal(JSON.stringify(api.body).includes('afdianToken'), false);
});

test('Patreon 使用官方活动累计字段并保留旧响应兼容', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.apis.patreonMembersFirst.endpoint.includes('campaign_lifetime_support_cents'), true);
  assert.equal(manifest.apis.patreonMembersFirst.endpoint.includes('fields%5Bmember%5D=full_name'), true);

  const app = loadApp(async () => ({}));
  const current = app.normalizePatreonMember({ id: 'member-1', attributes: { full_name: 'Patron', campaign_lifetime_support_cents: 4200, lifetime_support_cents: 100 } }, {}, 'USD');
  const legacy = app.normalizePatreonMember({ id: 'member-2', attributes: { full_name: 'Legacy', lifetime_support_cents: 800 } }, {}, 'USD');
  assert.equal(current.lifetimeMinor, 4200);
  assert.equal(legacy.lifetimeMinor, 800);
});

test('Patreon 缺少公开姓名时按匿名赞助者处理', () => {
  const app = loadApp(async () => ({}));
  const member = app.normalizePatreonMember({ id: 'private-member', attributes: { campaign_lifetime_support_cents: 500 } }, {}, 'USD');
  assert.equal(member.name, '');
  assert.equal(member.private, true);
  assert.equal(app.sponsorDisplayName(member), 'privateSponsor');
});

test('GitHub 读取历史状态并优先合并官方累计赞助金额', async () => {
  const calls = [];
  const app = loadApp(async (name) => {
    calls.push(name);
    if (name === 'githubSponsorsFirst') {
      return { data: { user: { sponsorshipsAsMaintainer: {
        nodes: [{
          createdAt: '2025-01-01T00:00:00Z',
          isActive: false,
          isOneTimePayment: false,
          privacyLevel: 'PUBLIC',
          sponsorEntity: { login: 'PastSponsor', name: 'Past Sponsor' },
          tier: { name: '$5', monthlyPriceInCents: 500 },
        }],
        pageInfo: { hasNextPage: false, endCursor: null },
      } } } };
    }
    if (name === 'githubLifetimeFirst') {
      return { data: { user: { lifetimeReceivedSponsorshipValues: {
        nodes: [{ amountInCents: 2500, sponsor: { login: 'PastSponsor' } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      } } } };
    }
    throw new Error(`Unexpected API: ${name}`);
  });

  const supporters = await app.syncGithub({ githubLogin: 'Creator' });
  assert.deepEqual(calls, ['githubSponsorsFirst', 'githubLifetimeFirst']);
  assert.equal(supporters[0].status, 'inactive');
  assert.equal(supporters[0].recurring, false);
  assert.equal(supporters[0].amountMinor, 0);
  assert.equal(supporters[0].lifetimeMinor, 2500);

  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.apis.githubSponsorsFirst.body.query.includes('activeOnly: false'), true);
  assert.equal(manifest.apis.githubSponsorsFirst.body.query.includes('isActive'), true);
  assert.equal(manifest.apis.githubLifetimeFirst.body.query.includes('lifetimeReceivedSponsorshipValues'), true);
});

test('GitHub 累计接口不可用时保留基础赞助名单', async () => {
  const app = loadApp(async (name) => {
    if (name === 'githubSponsorsFirst') {
      return { data: { user: { sponsorshipsAsMaintainer: {
        nodes: [{ isActive: true, isOneTimePayment: false, privacyLevel: 'PUBLIC', sponsorEntity: { login: 'Sponsor' }, tier: { monthlyPriceInCents: 500 } }],
        pageInfo: { hasNextPage: false },
      } } } };
    }
    throw new Error('Lifetime field unavailable');
  });
  const supporters = await app.syncGithub({ githubLogin: 'Creator' });
  assert.equal(supporters.length, 1);
  assert.equal(supporters[0].amountMinor, 500);
  assert.equal(supporters[0].lifetimeMinor, undefined);
});

test('第三方文本和金额在进入快照前被限制', () => {
  const app = loadApp(async () => ({}));
  const member = app.normalizePatreonMember({
    id: 'member',
    attributes: {
      full_name: '名'.repeat(500),
      patron_status: 'active_patron',
      currently_entitled_amount_cents: -50,
      campaign_lifetime_support_cents: Number.POSITIVE_INFINITY,
    },
  }, {}, 'USD');
  assert.equal(Array.from(member.name).length, 120);
  assert.equal(member.amountMinor, 0);
  assert.equal(member.lifetimeMinor, 0);
});

test('星体光度优先累计金额并在同币种内保持金额排序', () => {
  const app = loadApp(async () => ({}));
  const supporters = [
    { id: 'github:small', source: 'github', currency: 'USD', amountMinor: 500 },
    { id: 'patreon:large', source: 'patreon', currency: 'USD', amountMinor: 500, lifetimeMinor: 5000 },
    { id: 'afdian:one', source: 'afdian', currency: 'CNY', amountMinor: 500, lifetimeMinor: 500 },
  ];
  const layout = Array.from(app.sponsorStarLayout(supporters, 900, 500));
  assert.equal(app.sponsorStarValue(supporters[0]), 500);
  assert.equal(app.sponsorStarValue(supporters[1]), 5000);
  assert.equal(layout[1].brightness > layout[0].brightness, true);
  assert.equal(layout.every((star) => star.radius >= 2.6 && star.radius <= 7.4), true);
});

test('凭据入口只允许打开三个已声明的官方页面', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.permissions.includes('ui:openUrl'), true);
  assert.deepEqual(manifest.openUrls, [
    { id: 'github-token', url: 'https://github.com/settings/personal-access-tokens/new' },
    { id: 'patreon-token', url: 'https://www.patreon.com/portal/registration/register-clients' },
    { id: 'afdian-token', url: 'https://ifdian.net/dashboard/dev' },
  ]);
});

test('平台显示开关默认开启且隐藏平台不会进入展示数据', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const toggles = Object.fromEntries(manifest.settings.filter((setting) => setting.type === 'toggle').map((setting) => [setting.key, setting.defaultValue]));
  assert.deepEqual(toggles, { showGithub: true, showPatreon: true, showAfdian: true });

  const app = loadApp(async () => ({}));
  app.sponsorsState.snapshot = {
    supporters: [
      { source: 'github', name: 'GitHub supporter' },
      { source: 'patreon', name: 'Patreon supporter' },
      { source: 'afdian', name: 'Afdian supporter' },
    ],
  };
  app.applySponsorSettings({ showGithub: false, showPatreon: true, showAfdian: true });

  assert.deepEqual(Array.from(app.sponsorsState.visibleSources), ['patreon', 'afdian']);
  assert.deepEqual(Array.from(app.visibleSupporters(), (supporter) => supporter.source), ['patreon', 'afdian']);
  assert.equal(Object.hasOwn(app.SPONSOR_SOURCES, 'bilibili'), false);
});

test('星图动态内容始终保留可访问标题与说明引用', () => {
  const app = loadApp(async () => ({}));
  const empty = app.sponsorStarDetailHtml(null);
  const selected = app.sponsorStarDetailHtml({ source: 'github', name: 'Sponsor', amountMinor: 500, currency: 'USD', recurring: true });
  for (const html of [empty, selected]) {
    assert.equal(html.includes('id="cosmos-title"'), true);
    assert.equal(html.includes('id="cosmos-instructions"'), true);
  }
  const page = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  assert.equal(page.includes('data-i18n-aria-label="cosmosCanvasLabel"'), true);
});

test('发行页面不包含示例数据模块并保留旧测试快照清理', () => {
  const page = fs.readFileSync(path.join(appRoot, 'page.html'), 'utf8');
  const main = fs.readFileSync(path.join(appRoot, 'main.js'), 'utf8');
  const catalog = fs.readFileSync(path.join(appRoot, 'catalog.json'), 'utf8');
  assert.equal(page.includes('data-action="sample"'), false);
  assert.equal(main.includes('createSponsorDemoSnapshot'), false);
  assert.equal(main.includes("id: 'demo:"), false);
  assert.equal(main.includes('storedSnapshot.demo === true'), true);
  assert.equal(catalog.includes('测试星'), false);
});

test('赞助星图声明三种尺寸并仅以事件驱动刷新', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const widget = manifest.widgets.find((item) => item.id === 'sponsor-glance');
  assert.equal(manifest.permissions.includes('widget:register'), true);
  assert.equal(manifest.widgetStyles, 'widget.css');
  assert.deepEqual(widget.sizes, ['2x2', '4x2', '4x4']);
  assert.equal(widget.defaultSize, '4x2');
  assert.equal(widget.refreshPolicy.mode, 'event');
  assert.equal(widget.refreshPolicy.refreshOnVisible, true);
  assert.equal(manifest.assets.includes('assets/observatory-paper.png'), true);
  for (const template of Object.values(widget.templates)) {
    assert.equal(fs.existsSync(path.join(appRoot, template)), true);
    const html = fs.readFileSync(path.join(appRoot, template), 'utf8');
    assert.equal(html.includes('canvas data-starfield'), true);
    assert.equal(html.includes('widget-nebula'), false);
  }
  const medium = fs.readFileSync(path.join(appRoot, widget.templates['4x2']), 'utf8');
  const large = fs.readFileSync(path.join(appRoot, widget.templates['4x4']), 'utf8');
  assert.equal(medium.includes('data-platforms'), false);
  assert.equal(large.includes('widgetLegend'), false);
  assert.equal(large.includes('widgetPlatformMix'), false);
  assert.equal(large.includes('data-platforms'), false);
});

test('观测日志小组件三份语言保持同键并包含新增文案', () => {
  const locales = ['zh-CN', 'en-US', 'ja-JP'].map((locale) => JSON.parse(fs.readFileSync(path.join(appRoot, 'i18n', `${locale}.json`), 'utf8')));
  const expected = Object.keys(locales[0]).sort();
  for (const table of locales) {
    assert.deepEqual(Object.keys(table).sort(), expected);
    for (const key of ['widgetObservation', 'widgetRepresentative', 'widgetLifetime', 'widgetLegend', 'widgetSupporterTotal', 'widgetPlatformMix', 'widgetEmpty']) {
      assert.equal(typeof table[key], 'string');
      assert.equal(table[key].length > 0, true);
    }
  }
});

test('小组件只读快照、服从平台可见性并分币种统计月度支持', () => {
  const app = loadApp(async () => ({}));
  const snapshot = {
    supporters: [
      { id: 'github:a', source: 'github', name: 'A', recurring: true, amountMinor: 1200, lifetimeMinor: 5000, currency: 'USD' },
      { id: 'patreon:b', source: 'patreon', name: 'B', recurring: true, amountMinor: 800, lifetimeMinor: 2000, currency: 'USD' },
      { id: 'afdian:c', source: 'afdian', name: 'C', recurring: true, amountMinor: 500, lifetimeMinor: 2500, currency: 'CNY' },
    ],
  };
  const sources = app.sponsorWidgetVisibleSources({ showGithub: false, showPatreon: true, showAfdian: true });
  const items = app.sponsorWidgetItems(snapshot, sources);
  const amount = app.sponsorWidgetMonthlyAmount(items);
  assert.deepEqual(Array.from(sources), ['patreon', 'afdian']);
  assert.deepEqual(Array.from(items, (item) => item.source), ['patreon', 'afdian']);
  assert.equal(amount.split(' · ').length, 2);
  assert.equal(String(app.renderSponsorWidget).includes('Tapp.api'), false);
});

test('Page 与 Widget 跟随宿主主题并响应运行时语言切换', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.json'), 'utf8'));
  const main = fs.readFileSync(path.join(appRoot, 'main.js'), 'utf8');
  assert.equal(manifest.permissions.includes('ui:theme'), true);
  assert.equal(main.includes('Tapp.ui.getTheme()'), true);
  assert.equal(main.includes('Tapp.ui.onThemeChange'), true);
  assert.equal(main.includes('Tapp.ui.onLocaleChange'), true);
  assert.equal(main.includes("document.documentElement.classList.toggle('dark'"), true);
  assert.equal(main.includes('sponsorWidgetInstances.forEach'), true);
});
