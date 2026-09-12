/// <reference path="./types/tapp-sdk.d.ts" />

// ========================================
// Core / 共享层（Widget、Page、Headless 三模式均加载）
// ========================================

// 平台只收录 page/ 下的额外 JS（见 tapp-cli 打包规则），故共享 API 模块置于 page/，
// 由 core 层 require 加载，Page / Headless 共用。
var skland = require('./page/api-skland.js');

// 玩家数据缓存：uid → record（{ ts, data }）。统一按 uid 读取，不再使用全局单一槽位。
var PLAYER_DATA_BY_UID = {};

// 按 uid 从当前可读的玩家列表加载数据并写入缓存；返回 Promise<record|null>
async function loadPlayerData(uid) {
  uid = String(uid || '');
  if (!uid) return null;
  var map = await getPlayerMap();
  var entry = map && map[uid];
  PLAYER_DATA_BY_UID[uid] = entry ? (entry.playerdata || null) : null;
  return PLAYER_DATA_BY_UID[uid];
}

// 同步取某玩家缓存
function getPlayerData(uid) {
  return PLAYER_DATA_BY_UID[String(uid || '')] || null;
}

// 设置某玩家的展示缓存（展示 / 刷新后调用）
function setActivePlayer(uid, record) {
  PLAYER_DATA_BY_UID[String(uid || '')] = record || null;
}

// 以下是api: getPlayerInfo的细分
function getDataUpdateTs(uid) {
  var data = getPlayerData(uid);
  return data && data.ts;
}

// ========================================
// i18
// ========================================
function t(key) {
  try {
    return Tapp.i18n.t(key);
  } catch (e) {
    return key;
  }
}

function applyI18n(root) {
  var nodes = root.querySelectorAll('[data-i18n]');
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
  }
  var placeholders = root.querySelectorAll('[data-i18n-placeholder]');
  for (var j = 0; j < placeholders.length; j++) {
    placeholders[j].setAttribute('placeholder', t(placeholders[j].getAttribute('data-i18n-placeholder')));
  }
}

// ========================================
// 玩家数据（纯数据，无 DOM 依赖，Page / Widget 共用）
// ========================================

// 以下是api: getPlayerInfo的细分

function getPlayerStatus(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.status) || {};
}

function getPlayerMedal(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.medal) || {};
}

function getPlayerAssistChars(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.assistChars) || {};
}

function getPlayerChars(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.chars) || {};
}

function getPlayerSkins(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.skins) || {};
}

function getPlayerBuilding(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.building) || {};
}

function getPlayerRecruit(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.recruit) || {};
}

function getPlayerCampaign(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.campaign) || {};
}

function getPlayerTower(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.tower) || {};
}

function getPlayerRogue(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.rogue) || {};
}

function getPlayerRoutine(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.routine) || {};
}

function getPlayerActivity(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.activity) || {};
}

function getCharInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.charInfoMap) || {};
}

function getSkinInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.skinInfoMap) || {};
}

function getStageInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.stageInfoMap) || {};
}

function getActivityInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.activityInfoMap) || {};
}

function getTowerInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.towerInfoMap) || {};
}

function getRogueInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.rogueInfoMap) || {};
}

function getCampaignInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.campaignInfoMap) || {};
}

function getCampaignZoneInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.campaignZoneInfoMap) || {};
}

function getEquipmentInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.equipmentInfoMap) || {};
}

function getManufactureFormulaInfoMap(uid) {
  var data = getPlayerData(uid);
  var player = data && data.data ? data.data.player : null;
  return (player && player.manufactureFormulaInfoMap) || {};
}
// end

function getOperatorName(charId, uid) {
  var info = getCharInfoMap(uid)[charId];
  var locale = Tapp.i18n.getLocale();
  // console.debug(Tapp.i18n.getLocale())；
  if (locale == "zh-CN"){
    return (info && info.name) || charId;
  }else{
    return (info && info.appellation) || charId;
  }
}

function countUniqueChars(chars, charInfoMap) {
  var seen = new Set();
  for (let i = 0; i < chars.length; i++) {
    let id = chars[i] && chars[i].charId;
    let appellation = charInfoMap[id] && charInfoMap[id].appellation
    if (appellation){
      seen.add(appellation)
    }
  }
  // console.debug(seen)
  return  seen.size > 0 ? seen.size : null;
}

// 从存储的玩家数据（{ player, nickName, ... }）生成概要，供主页与小组件共用
function generatePlayerSummary(uid) {
  var status = getPlayerStatus(uid)
  var name = status.name || '';
  var avatar = (status.avatar && isHttpsUrl(status.avatar.url)) ? status.avatar.url : '';
  var level = status.level !== undefined ? String(status.level) : '';
  var charCount = countUniqueChars(getPlayerChars(uid), getCharInfoMap(uid));
  var operators = charCount != null
    ? String(charCount)
    : (status.charCnt !== undefined ? String(status.charCnt) : '-');
  var furnitureNum = getPlayerBuilding(uid)?.furniture?.total;
  var medalNum = getPlayerMedal(uid)?.total;
  var progress = status.mainStageProgress;
  var progressInfo = progress ? getStageInfoMap(uid)[progress] : null;
  var progressVal = progressInfo && progressInfo.code ? progressInfo.code : '-';

  return {
    name: name,
    avatar: avatar,
    level: level,
    registerTs: status.registerTs,
    // 每项 [i18n key, value]；标签文本由调用方翻译
    items: [
      ['assets.progress', progressVal],
      ['assets.operators', operators],
      ['assets.skins', status.skinCnt !== undefined ? String(status.skinCnt) : '-'],
      ['assets.furniture', furnitureNum !== undefined ? String(furnitureNum) : '-'],
      ['assets.medals', medalNum !== undefined ? String(medalNum) : '-']
    ]
  };
}

// ========================================
// 资源仓库与助战干员（供pages+widgets等复用）
// ========================================

var _repoBaseCache = '';

// 校验绝对 https:// URL（trim + 协议/hostname 校验）；拒绝 http: / javascript: / data: / 相对路径等
function isHttpsUrl(v) {
  if (typeof v !== 'string') return false;
  var s = v.trim();
  if (!s || !/^https:\/\//i.test(s)) return false;
  if (typeof URL === 'function') {
    try {
      var u = new URL(s);
      if (u.protocol !== 'https:' || !u.hostname) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

// 校验素材仓库基址：仅接受绝对 https://（trim、去尾 /），否则返回 '' 回退默认仓
function sanitizeRepoBase(v) {
  if (!isHttpsUrl(v)) return '';
  return v.trim().replace(/\/+$/, '');
}

async function getRepoBase() {
  if (_repoBaseCache) return _repoBaseCache;
  var base = 'https://raw.githubusercontent.com/leaphy-dev/ArknightsGameResource/main';
  try {
    var cleaned = sanitizeRepoBase(await Tapp.settings.get('resourceBaseUrl'));
    if (cleaned) base = cleaned;
  } catch (e) {}
  _repoBaseCache = base;
  return base;
}

/**
 * 干员头像 URL（默认皮肤）。
 * 精英化 0/1 用 `avatar/{charId}.png`，精英化 2 用 `avatar/{charId}_2.png`。
 * @param {string} repoBase 素材仓库基址（绝对 https://，无尾 /）
 * @param {string} charId 干员 id，例 "char_002_amiya"
 * @param {number} [evolvePhase] 精英化阶段 0/1/2
 * @returns {string} 头像图片 URL
 */
function avatarUrl(repoBase, charId, evolvePhase) {
  var suffix = (evolvePhase || 0) >= 2 ? '_2' : '';
  return repoBase + '/avatar/' + charId + suffix + '.png';
}

/**
 * 皮肤头像 URL。
 * 仅“品牌皮肤”（skinId 含 `@`）有独立头像：文件名把 `@` 转 `_`、`#` 转 `%23`，
 * 例 "char_102_texas@winter#1" → "avatar/char_102_texas_winter%231.png"。
 * 默认皮肤（不含 `@`）无独立头像，返回 ''，由调用方回落到 {@link avatarUrl}。
 * @param {string} repoBase 素材仓库基址（绝对 https://，无尾 /）
 * @param {string} skinId 皮肤 id，例 "char_102_texas@winter#1"
 * @returns {string} 皮肤头像图片 URL；非品牌皮肤返回空串
 */
function skinAvatarUrl(repoBase, skinId) {
  if (!skinId || skinId.indexOf('@') === -1) return '';
  return repoBase + '/avatar/' + skinId.replace(/@/g, '_').replace(/#/g, '%23') + '.png';
}

/**
 * 助战干员头像 URL：优先品牌皮肤头像，无则回落到干员默认头像。
 * @param {string} repoBase 素材仓库基址（绝对 https://，无尾 /）
 * @param {{ charId: string, skinId?: string, evolvePhase?: number }} op 助战干员
 * @returns {string} 头像图片 URL
 */
function assistAvatarUrl(repoBase, op) {
  return skinAvatarUrl(repoBase, op.skinId) || avatarUrl(repoBase, op.charId, op.evolvePhase);
}

var _eliteUrlsCache = null;

// 精英化标识图片（包内资源 → blob URL），缓存
async function getEliteUrls() {
  if (_eliteUrlsCache) return _eliteUrlsCache;
  var urls = {};
  try {
    urls[0] = (await Tapp.assets.getUrl('assets/rank/elite0.png')).url;
    urls[1] = (await Tapp.assets.getUrl('assets/rank/elite1.png')).url;
    urls[2] = (await Tapp.assets.getUrl('assets/rank/elite2.png')).url;
  } catch (e) {
    // urls = {};
    console.error('Failed to load elite URLs:', e);
  }
  _eliteUrlsCache = urls;
  return urls;
}

// 助战干员（前 3 个），含名称 / 头像 / 精英化标识；异步（需读取资源仓库地址）
async function getAssistUnits(uid) {
  var assistChars = getPlayerAssistChars(uid)
  var list = Array.isArray(assistChars) ? assistChars.slice(0, 3) : [];
  if (!list.length) return [];
  var repoBase = await getRepoBase();
  var eliteUrls = await getEliteUrls();
  var units = [];
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    // var id = c.charId;
    // var info = getCharInfoMap[id];
    var phase = c.evolvePhase || 0;
    units.push({
      id: c.charId,
      // name: (info && info.name) || id,
      level: c.level,
      evolvePhase: phase,
      avatarUrl: assistAvatarUrl(repoBase, {charId: c.charId, skinId: c.skinId, evolvePhase: phase }),
      eliteUrl: eliteUrls[phase] || ''
    });
  }
  return units;
}

// ========================================
// 玩家列表（多账户）存储
// storage（私有）：完整记录，含 hgToken / isPublic
// shared（公开）：仅 isPublic 的记录，剔除 hgToken / isPublic
// ========================================

var PLAYER_MAP_KEY = 'arkPlayerMap';              // Tapp.storage
var PUBLIC_PLAYER_MAP_KEY = 'arkPublicPlayerMap'; // Tapp.shared
var LAST_VIEWED_KEY = 'arkLastViewedPlayer';      // Tapp.storage

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// 读私有玩家列表（管理员用）
async function getStoragePlayerMap() {
  try {
    var map = await Tapp.storage.get(PLAYER_MAP_KEY);
    return isPlainObject(map) ? map : {};
  } catch (e) {
    return {};
  }
}

async function setStoragePlayerMap(map) {
  try { await Tapp.storage.set(PLAYER_MAP_KEY, map); } catch (e) {}
}

// 读取某玩家的鹰角账号 Token（多账户：以玩家列表记录为准）
async function getPlayerToken(uid) {
  uid = String(uid || '');
  if (!uid) return '';
  var map = await getStoragePlayerMap();
  var t = map[uid] && map[uid].hgToken;
  return t ? String(t) : '';
}

// 读公开玩家列表（非管理员用）
async function getPublicPlayerMap() {
  try {
    var map = await Tapp.shared.get(PUBLIC_PLAYER_MAP_KEY);
    return isPlainObject(map) ? map : {};
  } catch (e) {
    return {};
  }
}

async function setPublicPlayerMap(map) {
  try { await Tapp.shared.set(PUBLIC_PLAYER_MAP_KEY, map); } catch (e) {}
}

// 智能读取：管理员 → 私有 storage 列表；非管理员 → 公开 shared 列表
async function getPlayerMap() {
  var admin = false;
  try { admin = !!(await Tapp.user.isAdmin()); } catch (e) {}
  return admin ? getStoragePlayerMap() : getPublicPlayerMap();
}

// 当前用户上次浏览的玩家 uid（私有）
async function getLastViewedUid() {
  try { return String((await Tapp.storage.get(LAST_VIEWED_KEY)) || ''); } catch (e) { return ''; }
}

async function setLastViewedUid(uid) {
  try { await Tapp.storage.set(LAST_VIEWED_KEY, String(uid || '')); } catch (e) {}
}

// 公开记录：剔除 isPublic / hgToken
function toPublicEntry(entry) {
  return {
    uid: entry.uid,
    platform: entry.platform || '',
    isDefault: !!entry.isDefault,
    lastUpdate: entry.lastUpdate || 0,
    name: entry.name || '',
    playerdata: entry.playerdata || null
  };
}

// 依据私有列表重建公开列表（仅 isPublic 项）
async function syncPublicPlayerMap(storageMap) {
  var pub = {};
  for (let uid in storageMap) {
    var e = storageMap[uid];
    if (e && e.isPublic) pub[uid] = toPublicEntry(e);
  }
  await setPublicPlayerMap(pub);
  return pub;
}

// 新增/更新玩家到私有列表；列表原本为空时首个设为默认
async function savePlayer(entry, hgToken, isPublic) {
  var map = await getStoragePlayerMap();
  var existed = !!map[entry.uid];
  var isFirst = Object.keys(map).length === 0;
  var record = {
    uid: entry.uid,
    platform: entry.platform || '',
    isDefault: existed ? !!map[entry.uid].isDefault : isFirst,
    lastUpdate: Date.now(),
    name: entry.name || '',
    isPublic: existed ? !!map[entry.uid].isPublic : !!isPublic,
    hgToken: hgToken || (existed ? map[entry.uid].hgToken : ''),
    playerdata: entry.playerdata || null
  };
  map[entry.uid] = record;
  await setStoragePlayerMap(map);
  await setLastViewedUid(entry.uid);
  await syncPublicPlayerMap(map);
  return record;
}

// 更新某玩家数据（刷新），不改动 isPublic / isDefault / hgToken, 曾经是setPlayerData
async function updatePlayerData(uid, playerdata) {
  var map = await getStoragePlayerMap();
  if (!map[uid]) return null;
  map[uid].playerdata = playerdata;
  map[uid].lastUpdate = Date.now();
  await setStoragePlayerMap(map);
  await syncPublicPlayerMap(map);
  return map[uid];
}

// 设置某玩家是否公开（同步公开列表）
async function setPlayerPublic(uid, isPublic) {
  var map = await getStoragePlayerMap();
  if (!map[uid]) return null;
  map[uid].isPublic = !!isPublic;
  await setStoragePlayerMap(map);
  await syncPublicPlayerMap(map);
  return map[uid];
}

// 设置默认展示玩家（私有 + 公开各留一个）
async function setDefaultPlayer(uid) {
  var map = await getStoragePlayerMap();
  for (var k in map) {
    if (map[k]) map[k].isDefault = (k === uid);
  }
  await setStoragePlayerMap(map);
  await syncPublicPlayerMap(map);
  return map;
}

// 删除玩家：同步公开列表；若删的是默认项则顺延默认；清理 lastViewed 与数据缓存
async function deletePlayer(uid) {
  uid = String(uid || '');
  var map = await getStoragePlayerMap();
  if (!map[uid]) return map;

  var wasDefault = !!map[uid].isDefault;
  delete map[uid];

  if (wasDefault) {
    for (var k in map) {
      if (map[k]) { map[k].isDefault = true; break; }
    }
  }

  await setStoragePlayerMap(map);
  await syncPublicPlayerMap(map);

  var last = await getLastViewedUid();
  if (last === uid) {
    var next = '';
    for (var k2 in map) {
      if (map[k2]) { next = k2; break; }
    }
    await setLastViewedUid(next);
  }

  delete PLAYER_DATA_BY_UID[uid];
  return map;
}

// 选要展示的玩家：优先 lastViewed，其次 isDefault，再次第一个
function pickPlayerEntry(map, lastUid) {
  if (!isPlainObject(map)) return null;
  if (lastUid && map[lastUid]) return map[lastUid];
  for (var uid in map) {
    if (map[uid] && map[uid].isDefault) return map[uid];
  }
  for (var first in map) {
    if (map[first]) return map[first];
  }
  return null;
}

// ========================================
// exports
// ========================================

module.exports = {
  skland: skland,

  t: t,
  applyI18n: applyI18n,


  countUniqueChars: countUniqueChars,
  loadPlayerData: loadPlayerData,
  getPlayerData: getPlayerData,
  setActivePlayer: setActivePlayer,
  getDataUpdateTs: getDataUpdateTs,

  PLAYER_MAP_KEY: PLAYER_MAP_KEY,
  PUBLIC_PLAYER_MAP_KEY: PUBLIC_PLAYER_MAP_KEY,
  LAST_VIEWED_KEY: LAST_VIEWED_KEY,
  getStoragePlayerMap: getStoragePlayerMap,
  getPlayerToken: getPlayerToken,
  getPublicPlayerMap: getPublicPlayerMap,
  getPlayerMap: getPlayerMap,
  savePlayer: savePlayer,
  updatePlayerData: updatePlayerData,
  setPlayerPublic: setPlayerPublic,
  setDefaultPlayer: setDefaultPlayer,
  deletePlayer: deletePlayer,
  pickPlayerEntry: pickPlayerEntry,
  getLastViewedUid: getLastViewedUid,
  setLastViewedUid: setLastViewedUid,

  getPlayerStatus: getPlayerStatus,
  getPlayerMedal: getPlayerMedal,
  getPlayerAssistChars: getPlayerAssistChars,
  getPlayerChars: getPlayerChars,
  getPlayerSkins: getPlayerSkins,
  getPlayerBuilding: getPlayerBuilding,
  getPlayerRecruit: getPlayerRecruit,
  getPlayerCampaign: getPlayerCampaign,
  getPlayerTower: getPlayerTower,
  getPlayerRogue: getPlayerRogue,
  getPlayerRoutine: getPlayerRoutine,
  getPlayerActivity: getPlayerActivity,
  getCharInfoMap: getCharInfoMap,
  getSkinInfoMap: getSkinInfoMap,
  getStageInfoMap: getStageInfoMap,
  getActivityInfoMap: getActivityInfoMap,
  getTowerInfoMap: getTowerInfoMap,
  getRogueInfoMap: getRogueInfoMap,
  getCampaignInfoMap: getCampaignInfoMap,
  getCampaignZoneInfoMap: getCampaignZoneInfoMap,
  getEquipmentInfoMap: getEquipmentInfoMap,
  getManufactureFormulaInfoMap: getManufactureFormulaInfoMap,

  generatePlayerSummary: generatePlayerSummary,

  getOperatorName: getOperatorName,

  isHttpsUrl: isHttpsUrl,
  sanitizeRepoBase: sanitizeRepoBase,
  getRepoBase: getRepoBase,
  avatarUrl: avatarUrl,
  skinAvatarUrl: skinAvatarUrl,
  assistAvatarUrl: assistAvatarUrl,
  getEliteUrls: getEliteUrls,
  getAssistUnits: getAssistUnits
};
