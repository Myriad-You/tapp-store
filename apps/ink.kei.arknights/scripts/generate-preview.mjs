#!/usr/bin/env node
/**
 * Generate the static store preview (preview.html + preview.css).
 *
 * Reads sample player data and the bundled assets/ PNGs, fetches operator
 * avatars from the resource repo, and inlines every image as a data: URI so
 * the preview is self-contained and passes the store preview sanitizer
 * (no <script>/<link>, CSS url() limited to data:image/…).
 *
 * Usage:
 *   node scripts/generate-preview.mjs
 *   ARKNIGHTS_RESOURCE_BASE=https://… node scripts/generate-preview.mjs
 *
 * Outputs:
 *   preview.html       — store preview (no <link>/<style>; styles via catalog.json)
 *   preview.css        — data-URI art + preview-only styles
 *   preview.local.html — local browser preview linking page/styles.css + preview.css (git-ignored)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCE_BASE = (
  process.env.ARKNIGHTS_RESOURCE_BASE ||
  'https://raw.githubusercontent.com/leaphy-dev/ArknightsGameResource/main'
).replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Sample data — edit this to change what the preview shows.
// `rarity` is the natural Arknights value (1..6).
// ---------------------------------------------------------------------------
const PLAYER = {
  name: '博士',
  avatarUrl: 'https://web.hycdn.cn/arknights/game/assets/avatar/avatar_activity_RL5_1.png',
  level: 120,
  enrollDate: '2020-05-01',
  stats: [
    ['作战进度', '15-03'],
    ['干员', '12'],
    ['时装', '8'],
    ['家具', '240'],
    ['蚀刻章', '86'],
  ],
  assist: [
    { id: 'char_002_amiya', name: '阿米娅', profession: 'caster', rarity: 6, level: 90, evolvePhase: 2 },
    { id: 'char_103_angel', name: '能天使', profession: 'sniper', rarity: 6, level: 80, evolvePhase: 1 },
    { id: 'char_102_texas', name: '德克萨斯', profession: 'pioneer', rarity: 5, level: 70, evolvePhase: 1 },
  ],
  chars: [
    { id: 'char_002_amiya', name: '阿米娅', profession: 'caster', rarity: 6, level: 90, evolvePhase: 2, potentialRank: 5, skillId: 'skchr_amiya_2' },
    { id: 'char_103_angel', name: '能天使', profession: 'sniper', rarity: 6, level: 80, evolvePhase: 1, potentialRank: 3, skillId: 'skchr_angel_2' },
    { id: 'char_102_texas', name: '德克萨斯', profession: 'pioneer', rarity: 5, level: 70, evolvePhase: 1, potentialRank: 4, skillId: 'skchr_texas_2' },
    { id: 'char_108_silent', name: '赫默', profession: 'medic', rarity: 5, level: 60, evolvePhase: 1, potentialRank: 2, skillId: 'skchr_silent_2' },
  ],
  activities: [
    { name: '示例活动 · 别传', progress: '12/24' },
    { name: '示例活动 · 插曲', progress: '8/18' },
    { name: '示例活动 · 主线', progress: '15/15' },
  ],
};

const TABS = ['活动剧情', '集成战略', '剿灭', '保全派驻'];

// rarity (1..6) → asset suffix / classes / colors
const RARITY = {
  6: { cls: 'six-star', star: 'star_5', bg: 'charBg_r5', place: 'var(--ak-color-advanced)', glow: 'rgba(212,180,131,0.45)' },
  5: { cls: 'five-star', star: 'star_4', bg: 'charBg_r4', place: 'var(--ak-color-yellow)', glow: 'rgba(242,221,158,0.4)' },
  4: { cls: 'four-star', star: 'star_3', bg: 'charBg_r3', place: 'var(--ak-color-yellow)', glow: 'rgba(230,226,241,0.4)' },
  3: { cls: 'three-star', star: 'star_2', bg: 'charBg_2-0', place: 'white', glow: 'rgba(0,177,255,0.4)' },
  2: { cls: 'two-star', star: 'star_1', bg: 'charBg_2-0', place: 'white', glow: 'rgba(216,226,43,0.4)' },
  1: { cls: 'one-star', star: 'star_0', bg: 'charBg_2-0', place: 'white', glow: 'rgba(255,255,255,0.4)' },
};

const PROFESSION_FILE = {
  pioneer: 'pioneer', warrior: 'warrior', tank: 'tank', sniper: 'sniper',
  caster: 'caster', medic: 'medic', support: 'support', special: 'special',
};

// ---------------------------------------------------------------------------
// Image inlining
// ---------------------------------------------------------------------------

async function compress(buf, opts = {}) {
  let s = sharp(buf);
  const resize = {};
  if (opts.width) resize.width = opts.width;
  if (opts.height) resize.height = opts.height;
  if (opts.fit) resize.fit = opts.fit;
  if (resize.width || resize.height) s = s.resize(resize);
  s = s.webp({ quality: 80, effort: 4 });
  return 'data:image/webp;base64,' + (await s.toBuffer()).toString('base64');
}

async function readAsset(rel, opts = {}) {
  return compress(await readFile(join(ROOT, 'assets', rel)), opts);
}

// Generic placeholder silhouette when an operator avatar cannot be fetched.
function silhouetteDataUri() {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 400'>" +
    "<defs><linearGradient id='b' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='#4b4b58'/><stop offset='.55' stop-color='#232329'/><stop offset='1' stop-color='#0d0d11'/>" +
    "</linearGradient></defs>" +
    "<rect width='200' height='400' fill='url(#b)'/>" +
    "<path d='M100 34 136 84 136 126Q136 168 100 178Q64 168 64 126L64 84Z' fill='#0a0a0f'/>" +
    "<path d='M100 46 128 82 128 120Q128 158 100 166Q72 158 72 120L72 82Z' fill='#15151c'/>" +
    "<path d='M28 400 64 210Q100 190 136 210L172 400Z' fill='#101015'/>" +
    "<path d='M100 238 118 266 100 300 82 266Z' fill='none' stroke='#d4b483' stroke-opacity='.5' stroke-width='2'/>" +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

async function fetchImage(url, opts, fallback) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return compress(Buffer.from(await res.arrayBuffer()), opts);
  } catch {
    return fallback;
  }
}

async function fetchAvatar(id) {
  return fetchImage(`${RESOURCE_BASE}/avatar/${id}.png`, { width: 240, height: 240, fit: 'cover' }, silhouetteDataUri());
}

async function fetchPortrait(id, evolvePhase) {
  const suffix = (evolvePhase || 0) >= 2 ? '_2' : '_1';
  return fetchImage(`${RESOURCE_BASE}/portrait/${id}${suffix}.png`, { width: 240 }, silhouetteDataUri());
}

async function fetchSkill(skillId) {
  return fetchImage(`${RESOURCE_BASE}/skill/skill_icon_${skillId}.png`, { width: 64 }, '');
}

function doctorAvatarFallback() {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>" +
    "<rect width='128' height='128' fill='#171410'/>" +
    "<text x='64' y='84' font-family='serif' font-size='60' fill='#d4b483' text-anchor='middle'>博</text>" +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

async function fetchPlayerAvatar() {
  const url = PLAYER.avatarUrl || '';
  if (!url) return doctorAvatarFallback();
  return fetchImage(url, { width: 128, height: 128, fit: 'cover' }, doctorAvatarFallback());
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

function genCss(assets, operators) {
  const out = [];
  out.push('/* Generated by scripts/generate-preview.mjs — do not edit by hand. */');
  out.push('/* Loaded after page/styles.css (see catalog.json preview.styles). */');
  out.push('');

  out.push('.pv-op-art {');
  out.push('  position: absolute;');
  out.push('  inset: 0;');
  out.push('  background-repeat: no-repeat;');
  out.push('  background-position: center top;');
  out.push('  background-size: contain;');
  out.push('}');
  out.push('');

  out.push('.pv-avatar {');
  out.push('  position: absolute;');
  out.push('  inset: 0;');
  out.push('  background-repeat: no-repeat;');
  out.push('  background-position: center;');
  out.push('  background-size: cover;');
  out.push('}');
  out.push('');

  out.push('.pv-bg { background-size: 100% 100%; background-repeat: no-repeat; }');
  out.push('.pv-career { width: calc(var(--char-card-w) * 0.22); height: calc(var(--char-card-w) * 0.22); background-size: contain; background-repeat: no-repeat; background-position: center; }');
  out.push('.pv-star { width: calc(var(--char-card-w) * 0.6); height: calc(var(--char-card-w) * 0.16); background-size: contain; background-repeat: no-repeat; background-position: left center; }');
  out.push('.pv-elite { width: calc(var(--char-card-w) * 0.36); height: calc(var(--char-card-w) * 0.36); background-size: contain; background-repeat: no-repeat; background-position: center; }');
  out.push('.pv-skill { width: calc(var(--char-card-w) * 0.32); height: calc(var(--char-card-w) * 0.32); background-size: contain; background-repeat: no-repeat; background-position: center; border: 1px solid rgba(255,255,255,0.85); background-color: rgba(0,0,0,0.4); box-sizing: border-box; }');
  out.push('.pv-potential { width: calc(var(--char-card-w) * 0.21); height: calc(var(--char-card-w) * 0.21); background-size: contain; background-repeat: no-repeat; background-position: center; }');
  out.push('.pv-elite-assist { background-size: contain; background-repeat: no-repeat; background-position: center; }');
  out.push('');

  for (const op of operators) {
    const glow = RARITY[op.rarity].glow;
    out.push(`.pv-art-${op.id} {`);
    out.push(`  background-image: radial-gradient(circle at 50% 22%, ${glow}, transparent 60%), url("${assets.portraits[op.id]}");`);
    out.push('}');
    out.push(`.pv-avatar-${op.id} {`);
    out.push(`  background-image: url("${assets.avatars[op.id]}");`);
    out.push('}');
  }
  out.push('');

  for (const [prof, uri] of Object.entries(assets.careers)) {
    out.push(`.pv-career-${prof} { background-image: url("${uri}"); }`);
  }
  for (const [rar, uri] of Object.entries(assets.stars)) {
    out.push(`.pv-star-${rar} { background-image: url("${uri}"); }`);
  }
  for (const [rar, uri] of Object.entries(assets.bgs)) {
    out.push(`.pv-bg-${rar} { background-image: url("${uri}"); }`);
  }
  for (const [phase, uri] of Object.entries(assets.elites)) {
    out.push(`.pv-elite-${phase} { background-image: url("${uri}"); }`);
  }
  for (const [id, uri] of Object.entries(assets.skills || {})) {
    if (uri) out.push(`.pv-skill-${id} { background-image: url("${uri}"); }`);
  }
  for (const [n, uri] of Object.entries(assets.potentials || {})) {
    out.push(`.pv-potential-${n} { background-image: url("${uri}"); }`);
  }
  out.push('');

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function opCard(op, skills, potentials) {
  const r = RARITY[op.rarity];
  const prof = PROFESSION_FILE[op.profession] || op.profession;
  const skillUri = skills && skills[op.id];
  const potUri = potentials && potentials[op.potentialRank || 0];
  const parts = [
    '                  <div class="operator-handbook-item-wrapper" style="opacity:1;">',
    `                    <div class="operator-handbook-item-component operator-handbook-item-bg pv-bg pv-bg-${op.rarity}"></div>`,
    `                    <div class="operator-handbook-item-component operator-handbook-item-illustration"><div class="pv-op-art pv-art-${op.id}"></div></div>`,
    `                    <div class="operator-handbook-item-component operator-handbook-item-decor-main-wrap ${r.cls}">`,
    '                      <div class="operator-handbook-item-decor-main">',
    '                        <div class="operator-handbook-item-decor-part operator-handbook-item-decor-part-1"></div>',
    '                        <div class="operator-handbook-item-decor-part operator-handbook-item-decor-part-2"></div>',
    '                        <div class="operator-handbook-item-decor-part operator-handbook-item-decor-part-3"></div>',
    '                      </div>',
    '                    </div>',
    '                    <div class="operator-handbook-item-component operator-handbook-item-decor-topleft"></div>',
    `                    <div class="operator-handbook-item-component operator-handbook-item-name">${op.name}</div>`,
    `                    <div class="operator-handbook-item-component operator-handbook-item-career pv-career pv-career-${prof}"></div>`,
    `                    <div class="operator-handbook-item-component operator-handbook-item-star pv-star pv-star-${op.rarity}"></div>`,
    `                    <div class="operator-handbook-item-component operator-handbook-item-elite pv-elite pv-elite-${op.evolvePhase}"></div>`,
  ];
  const labels = [];
  if (potUri) labels.push(`                      <div class="pv-potential pv-potential-${op.potentialRank || 0}"></div>`);
  if (skillUri) labels.push(`                      <div class="pv-skill pv-skill-${op.id}"></div>`);
  if (labels.length) {
    parts.push('                    <div class="operator-handbook-item-component operator-handbook-item-label-container">');
    parts.push(...labels);
    parts.push('                    </div>');
  }
  parts.push(`                    <div class="operator-handbook-item-component operator-handbook-item-level">${op.level}</div>`);
  parts.push('                  </div>');
  return parts.join('\n');
}

function assistUnit(op) {
  const r = RARITY[op.rarity];
  return [
    '                  <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0;">',
    `                    <div class="ak-card ak-card--place" style="width:var(--assist-avatar);height:var(--assist-avatar);overflow:hidden;position:relative;box-sizing:border-box;--ak-card-place-color:${r.place};">`,
    `                      <div class="pv-avatar pv-avatar-${op.id}"></div>`,
    '                      <div style="position:absolute;left:2px;top:2px;display:flex;flex-direction:column;align-items:center;line-height:1;">',
    '                        <span style="font-family:var(--ak-font-mono);font-size:calc(var(--assist-avatar)*0.1);color:#fff;opacity:0.85;letter-spacing:0.08em;">LV</span>',
    `                        <span style="font-size:calc(var(--assist-avatar)*0.18);font-weight:500;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000;">${op.level}</span>`,
    '                      </div>',
    `                      <div class="pv-elite-assist pv-elite-${op.evolvePhase}" style="position:absolute;top:-2px;right:-2px;width:calc(var(--assist-avatar)*0.32);height:calc(var(--assist-avatar)*0.32);"></div>`,
    '                    </div>',
    `                    <div style="font-size:10px;color:var(--ark-text-muted);max-width:calc(var(--assist-avatar) + 8px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${op.name}</div>`,
    '                  </div>',
  ].join('\n');
}

function statCell(label, value) {
  return [
    '                <div style="flex:1;min-width:0;text-align:center;">',
    `                  <div style="font-family:var(--ak-font-mono);font-size:9px;letter-spacing:0.05em;text-transform:uppercase;color:var(--ak-text-secondary);white-space:nowrap;">${label}</div>`,
    `                  <div style="font-size:12px;font-weight:600;color:var(--ark-text);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${value}</div>`,
    '                </div>',
  ].join('\n');
}

function activityCard(act, i) {
  const tints = ['rgba(212,180,131,0.4)', 'rgba(74,171,234,0.4)', 'rgba(241,198,68,0.4)'];
  const tint = tints[i % tints.length];
  return [
    '                    <div style="position:relative;overflow:hidden;border-radius:8px;margin-bottom:8px;width:100%;height:72px;background:#222;box-sizing:border-box;">',
    `                      <div style="position:absolute;left:0;top:0;width:100%;height:100%;background:linear-gradient(90deg,${tint},transparent 70%);"></div>`,
    '                      <div style="position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding:0 12px;text-align:right;box-sizing:border-box;">',
    `                        <div style="font-size:12px;font-weight:600;color:#fff;text-shadow:0 1px 2px #000;">${act.name}</div>`,
    `                        <div style="font-size:10px;color:#fff;text-shadow:0 1px 2px #000;margin-top:2px;">${act.progress}</div>`,
    '                      </div>',
    '                    </div>',
  ].join('\n');
}

function genHtml(playerAvatar, skills, potentials, version) {
  const assistHtml = PLAYER.assist.map(assistUnit).join('\n');
  const charsHtml = PLAYER.chars.map((op) => opCard(op, skills, potentials)).join('\n');
  const statsHtml = PLAYER.stats.map(([l, v]) => statCell(l, v)).join('\n');
  const tabsHtml = TABS.map((t) =>
    `                  <button type="button" style="flex-shrink:0;padding:0 16px;height:32px;line-height:32px;font-family:var(--ak-font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--ark-text-muted);background:var(--ark-fill);border:1px solid var(--ark-border-weak);border-radius:var(--ak-radius-subtle);">${t}</button>`
  ).join('\n');
  const activitiesHtml = PLAYER.activities.map(activityCard).join('\n');

  return `<!doctype html>
<html class="dark">
<body class="dark">
<main id="tapp-content" class="page" data-ak-ui>
  <section data-view="home" class="home-view">
    <div class="ark-page-inner">

      <div class="ark-page-nav" style="display:flex;align-items:center;justify-content:space-between;">
        <h1 class="ark-page-title" style="font-size:20px;font-weight:600;margin:0;color:var(--ark-text);">明日方舟</h1>
        <button type="button" class="ak-button ak-button--fab ak-fx--skew-left" aria-label="刷新数据" title="刷新数据">
          <svg class="ak-fx--skew-right" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>

      <div data-page="display" style="margin-top:20px;display:flex;flex-direction:column;">
        <div class="ak-divider"><span data-refresh-time="1">更新于 2026-09-06 12:00</span></div>

        <div data-display-content="1" style="flex:1;">

          <div class="ark-player-header" style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;">
            <div style="position:relative;width:var(--player-avatar);height:var(--player-avatar);flex-shrink:0;">
              <div style="width:var(--player-avatar);height:var(--player-avatar);border:2px solid #fff;box-sizing:border-box;background-image:url('${playerAvatar}');background-size:cover;background-position:center;"></div>
              <div style="position:absolute;top:0;right:0;width:calc(var(--player-avatar)*0.4375);height:calc(var(--player-avatar)*0.4375);border:2px solid var(--ak-color-yellow);border-radius:50%;transform:translate(50%,-50%);background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:calc(var(--player-avatar)*0.1875);font-weight:600;color:#fff;">${PLAYER.level}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <div style="font-size:16px;font-weight:600;color:var(--ark-text);">${PLAYER.name}</div>
              <div style="display:flex;align-items:center;">
                <span style="font-size:12px;font-weight:700;color:var(--ak-color-black);background:var(--ak-color-blue);padding:0 4px;">入职日</span>
                <span style="font-size:12px;font-weight:700;color:var(--ak-color-black);background:var(--ak-color-white);padding:0 4px;">${PLAYER.enrollDate}</span>
              </div>
            </div>
          </div>

          <div class="ark-display-layout">
            <div class="ark-display-left">

              <div class="ak-card" style="display:flex;gap:8px;width:100%;box-sizing:border-box;min-width:0;">
${statsHtml}
              </div>

              <div class="ak-card" style="width:100%;box-sizing:border-box;min-width:0;">
                <div class="ak-card__header">
                  <span class="ak-card__title"><span style="width:8px;height:8px;background:var(--ak-color-blue);flex-shrink:0;box-sizing:border-box;display:inline-block;"></span>助战干员</span>
                  <span style="font-size:9px;letter-spacing:0.5px;color:var(--ark-text-dim);">// SUPPORT UNITS</span>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:nowrap;justify-content:center;">
${assistHtml}
                </div>
              </div>

              <div class="ak-card" style="max-width:100%;box-sizing:border-box;min-width:0;overflow:hidden;">
                <div class="ak-card__header" style="align-items:center;">
                  <div style="display:flex;align-items:baseline;gap:8px;">
                    <span class="ak-card__title"><span style="width:8px;height:8px;background:var(--ak-color-blue);flex-shrink:0;box-sizing:border-box;display:inline-block;"></span>我的干员</span>
                    <span style="font-size:9px;letter-spacing:0.5px;color:var(--ark-text-dim);">// MY OPERATORS</span>
                  </div>
                  <button type="button" style="font-size:14px;font-weight:600;color:var(--ark-text);background:transparent;border:none;cursor:pointer;padding:0 4px;line-height:1;">→</button>
                </div>
                <div class="ark-my-chars-scroll" style="display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding-bottom:6px;max-width:100%;">
${charsHtml}
                </div>
              </div>

              <div class="ark-home-spacer ak-card ak-card--stripe" style="flex:1;min-height:0;box-sizing:border-box;"></div>

            </div>

            <div class="ark-display-right">
              <div class="ark-game-data ak-card" style="width:100%;box-sizing:border-box;min-width:0;display:flex;flex-direction:column;overflow:hidden;">
                <div class="ak-card__header" style="flex-shrink:0;">
                  <span class="ak-card__title"><span style="width:8px;height:8px;background:var(--ak-color-blue);flex-shrink:0;box-sizing:border-box;display:inline-block;"></span>游戏数据</span>
                  <span style="font-family:var(--ak-font-mono);font-size:9px;letter-spacing:0.08em;color:var(--ak-text-secondary);">// GAME DATA</span>
                </div>
                <div class="ark-game-tabbar" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;margin-bottom:10px;flex-shrink:0;">
${tabsHtml}
                </div>
                <div style="position:relative;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;">
                  <div data-game-content="1" style="flex:1;min-height:0;overflow-y:auto;min-width:0;">
${activitiesHtml}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <footer class="ark-app-footer">
        <div>明日方舟 · v${version}</div>
        <div>Tapp 所涉及的公司名称、商标、产品等均为其各自所有者的资产，仅供识别。Tapp 内使用的游戏图片、动画、音频、文本原文，仅用于更好地表现游戏资料，其版权属于 Arknights / 上海鹰角网络科技有限公司</div>
      </footer>

    </div>
  </section>
</main>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const operators = [...new Map([...PLAYER.chars, ...PLAYER.assist].map((o) => [o.id, o])).values()];

  // 1) bundled icon assets
  const professionKeys = [...new Set(operators.map((o) => PROFESSION_FILE[o.profession]))];
  const starKeys = [...new Set(operators.map((o) => o.rarity))];
  const bgKeys = [...new Set(operators.map((o) => RARITY[o.rarity].bg))];
  const eliteKeys = [...new Set(operators.map((o) => o.evolvePhase))];
  const potentialKeys = [...new Set(PLAYER.chars.map((o) => o.potentialRank || 0))];

  const careers = {};
  for (const p of professionKeys) careers[p] = await readAsset(`profession/${p}.png`, { width: 64 });

  const stars = {};
  for (const rar of starKeys) stars[rar] = await readAsset(`star/${RARITY[rar].star}.png`, { height: 32 });

  const bgs = {};
  for (const b of bgKeys) {
    const rar = operators.find((o) => RARITY[o.rarity].bg === b)?.rarity;
    bgs[rar] = await readAsset(`star/${b}.png`, { width: 240 });
  }

  const elites = {};
  for (const e of eliteKeys) elites[e] = await readAsset(`rank/elite${e}.png`, { width: 96 });

  const potentials = {};
  for (const n of potentialKeys) potentials[n] = await readAsset(`potential/potential_${n}.png`, { width: 48 });

  // 2) operator images (remote → data URI, fallback to silhouette)
  const avatars = {};
  const portraits = {};
  for (const op of operators) {
    avatars[op.id] = await fetchAvatar(op.id);
    portraits[op.id] = await fetchPortrait(op.id, op.evolvePhase);
  }
  const skills = {};
  for (const op of PLAYER.chars) {
    if (op.skillId) skills[op.id] = await fetchSkill(op.skillId);
  }

  const assets = { careers, stars, bgs, elites, potentials, avatars, portraits, skills };

  // 3) emit
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  const playerAvatar = await fetchPlayerAvatar();
  const css = genCss(assets, operators);
  const html = genHtml(playerAvatar, skills, potentials, manifest.version || '0.0.0');

  const body = (html.match(/<main[\s\S]*<\/main>/) || [html])[0];
  const localHtml =
    '<!doctype html>\n<html class="dark">\n<head>\n<meta charset="utf-8">\n' +
    '<link rel="stylesheet" href="page/styles.css">\n' +
    '<link rel="stylesheet" href="preview.css">\n' +
    '</head>\n<body class="dark">\n' +
    body + '\n</body>\n</html>\n';

  await writeFile(join(ROOT, 'preview.css'), css, 'utf8');
  await writeFile(join(ROOT, 'preview.html'), html, 'utf8');
  await writeFile(join(ROOT, 'preview.local.html'), localHtml, 'utf8');

  const kb = (n) => (n / 1024).toFixed(1) + ' KiB';
  console.log(
    'Wrote preview.html (' + kb(Buffer.byteLength(html)) + '), preview.css (' +
    kb(Buffer.byteLength(css)) + ') and preview.local.html (' + kb(Buffer.byteLength(localHtml)) + ').'
  );
  if (Buffer.byteLength(css) > 512 * 1024) {
    console.warn('WARNING: preview.css exceeds the 512 KiB store preview limit.');
  }
  if (Buffer.byteLength(html) > 512 * 1024) {
    console.warn('WARNING: preview.html exceeds the 512 KiB store preview limit.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
