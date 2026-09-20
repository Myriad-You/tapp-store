/**
 * 银河球棒侠 · 共享层
 * MD5 / 米游社 DS 签名、声明式 API 封装、共享缓存、安装级扫码凭据（Tapp.private）。
 * 数据来源：崩坏：星穹铁道 米游社战绩接口（hkrpg）。
 */

const CACHE_KEY = "sr.cache.v1";
const AUTH_KEY = "sr.auth.v1";
const MYS_VERSION = "2.102.1";

const SALTS = {
  app: "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs",
  web: "lX8m5VO5at5JG7hR8hzqFwzyL5aB1tYo",
  passport: "JwYDpKvLj6MrMqqYU6jTKF17KNO2PXoS",
};

const CACHE_TTL = 5 * 60 * 1000;
const ENDGAME_TTL = 30 * 60 * 1000;
const CONFIG_KEY = "sr.config.v1";
const WIDGET_DEBUG_KEY = "sr.widget.v1";
const OBC_KEY = "sr.obc.v1";
const ASSET_BATCH = 30;
const DEVICE_KEY = "sr.device.v1";
const DEVICE_RETRY = 60 * 60 * 1000;
const ASSETS_KEY = "sr.assets.v1";
const ASSET_SIZE = 48;
const ASSET_MAX_BYTES = 50 * 1024;
const ASSET_TOTAL_BYTES = 4 * 1024 * 1024;
const ASSET_RETRY = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DEVICE_PROFILE = {
  deviceModel: "PHK110",
  androidVersion: "14",
  deviceFingerprint: "OnePlus/PHK110/PHK110:14/UKQ1.231003.002/R.13c8a5d-1:user/release-keys",
  deviceName: "PHK110",
  deviceBoard: "taro",
  deviceProduct: "PHK110",
  oaid: "8f2a91c4d7e35b06",
};
const RISK_CODES = [10035, 5003, 10041, 1034, 10104];
const RISK_COOLDOWN = 15 * 60 * 1000;
const RISK_COOLDOWN_MAX = 60 * 60 * 1000;
const REQUEST_GAP = 400;
const QR_POLL_INTERVAL = 3000;
const QR_MAX_POLLS = 150;

const ELEMENT_COLORS = {
  physical: "#c9c9c9",
  fire: "#f2734a",
  ice: "#7ac9e8",
  lightning: "#c88ef0",
  wind: "#5fd0a5",
  quantum: "#7a7ae8",
  imaginary: "#f2d95c",
};

const SR_SERVER = {
  prod_gf_cn: "prod_gf_cn",
  prod_qd_cn: "prod_qd_cn",
  prod_official_usa: "prod_official_usa",
  prod_official_eur: "prod_official_eur",
  prod_official_asia: "prod_official_asia",
  prod_official_cht: "prod_official_cht",
};

/* ---------- 基础工具 ---------- */

function utf8Bytes(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(String(text));
  const str = String(text);
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return new Uint8Array(out);
}

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = (function () {
  const list = [];
  for (let i = 0; i < 64; i++) list.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  return list;
})();

function md5(text) {
  const bytes = utf8Bytes(text);
  const len = bytes.length;
  const bitLen = len * 8;
  const withOne = len + 1;
  const total = withOne + ((56 - (withOne % 64)) + 64) % 64 + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, bitLen >>> 0, true);
  view.setUint32(total - 4, Math.floor(bitLen / 4294967296), true);

  let a0 = 1732584193;
  let b0 = -271733879;
  let c0 = -1732584194;
  let d0 = 271733878;

  const M = new Array(16);
  for (let offset = 0; offset < total; offset += 64) {
    for (let j = 0; j < 16; j++) M[j] = view.getInt32(offset + j * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        f = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const tmp = D;
      D = C;
      C = B;
      const x = (A + f + MD5_K[i] + M[g]) | 0;
      B = (B + ((x << MD5_S[i]) | (x >>> (32 - MD5_S[i])))) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  function hex(n) {
    let out = "";
    for (let i = 0; i < 4; i++) {
      out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return out;
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomStr(length, alphabet) {
  const chars = alphabet || "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function randomHex(length) {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/* ---------- 米游社 DS 签名 ---------- */

function dsApp(query, body) {
  const t = Math.floor(Date.now() / 1000);
  const r = randomInt(100000, 200000);
  const b = body ? JSON.stringify(body) : "";
  const c = md5("salt=" + SALTS.app + "&t=" + t + "&r=" + r + "&b=" + b + "&q=" + (query || ""));
  return t + "," + r + "," + c;
}

function dsWeb() {
  const t = Math.floor(Date.now() / 1000);
  const r = randomStr(6);
  const c = md5("salt=" + SALTS.web + "&t=" + t + "&r=" + r);
  return t + "," + r + "," + c;
}

function dsPassport(query, body) {
  const t = Math.floor(Date.now() / 1000);
  const r = randomStr(6, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const b = body ? JSON.stringify(body) : "";
  const c = md5("salt=" + SALTS.passport + "&t=" + t + "&r=" + r + "&b=" + b + "&q=" + (query || ""));
  return t + "," + r + "," + c;
}

/* ---------- 角色 / 设置 / 凭据 / 缓存 ---------- */

async function getRole() {
  try {
    const role = await Tapp.user.getRole();
    if (role === "admin" || role === "user" || role === "guest") return role;
  } catch (err) {
    /* ignore */
  }
  return "guest";
}

async function readConfig() {
  try {
    const raw = await Tapp.private.get(CONFIG_KEY);
    if (raw && typeof raw === "object") return raw;
  } catch (err) {
    /* ignore */
  }
  return null;
}

async function readSettings() {
  const config = await readConfig();
  let uid = config && typeof config.uid === "string" ? config.uid.trim() : "";
  let server = config && typeof config.server === "string" && config.server ? config.server : "prod_gf_cn";
  const deviceInfo = config && typeof config.deviceInfo === "string" ? config.deviceInfo : "";
  if (server === "cn_gf01") server = "prod_gf_cn";
  if (server === "cn_qd01") server = "prod_qd_cn";
  if (SR_SERVER[server] && server !== "prod_gf_cn" && server !== "prod_qd_cn") server = "os";
  if (server !== "os" && server !== "prod_qd_cn") server = "prod_gf_cn";
  return { uid: uid, server: server, deviceInfo: deviceInfo };
}

async function saveSettings(patch) {
  const current = (await readConfig()) || {};
  const next = Object.assign({}, current, patch || {});
  await Tapp.private.set(CONFIG_KEY, next);
  return await readSettings();
}

function resolveServer(server, uid) {
  if (server === "os") {
    const digit = Number(String(uid || "").charAt(0));
    if (digit === 6) return "prod_official_usa";
    if (digit === 7) return "prod_official_eur";
    if (digit === 8) return "prod_official_asia";
    if (digit === 9) return "prod_official_cht";
    return "prod_official_asia";
  }
  if (server === "prod_qd_cn") return "prod_qd_cn";
  return "prod_gf_cn";
}

async function getAuth() {
  try {
    const raw = await Tapp.private.get(AUTH_KEY);
    if (raw && typeof raw === "object" && typeof raw.cookie === "string") return raw;
    return null;
  } catch (err) {
    return null;
  }
}

async function setAuth(auth) {
  await Tapp.private.set(AUTH_KEY, auth);
  return auth;
}

async function clearAuth() {
  try {
    await Tapp.private.remove(AUTH_KEY);
  } catch (err) {
    /* ignore */
  }
}

async function getCache() {
  try {
    const raw = await Tapp.shared.get(CACHE_KEY);
    if (raw && typeof raw === "object") return raw;
    return null;
  } catch (err) {
    return null;
  }
}

async function clearCache() {
  try {
    await Tapp.shared.remove(CACHE_KEY);
  } catch (err) {
    /* ignore */
  }
}

async function setCache(cache) {
  await Tapp.shared.set(CACHE_KEY, cache);
  return cache;
}

function buildCookie(map) {
  return Object.keys(map)
    .filter(function (key) {
      return map[key];
    })
    .map(function (key) {
      return key + "=" + map[key];
    })
    .join("; ");
}

const TOKEN_NAMES = {
  stoken: 1,
  stoken_v1: 1,
  stoken_v2: 1,
  ltoken: 2,
  ltoken_v1: 2,
  ltoken_v2: 2,
  cookie_token: 4,
  cookie_token_v1: 4,
  cookie_token_v2: 4,
};

function tokenTypeOf(token) {
  if (!token) return 0;
  if (typeof token.token_type === "number") return token.token_type;
  if (typeof token.token_type === "string" && token.token_type !== "" && !isNaN(Number(token.token_type))) {
    return Number(token.token_type);
  }
  if (typeof token.name === "string" && TOKEN_NAMES[token.name]) return TOKEN_NAMES[token.name];
  return 0;
}

function tokenMap(tokens) {
  const byType = {};
  (tokens || []).forEach(function (token) {
    const type = tokenTypeOf(token);
    if (type && token && typeof token.token === "string" && token.token) byType[type] = token.token;
  });
  return byType;
}

function tokenPreview(tokens) {
  return (tokens || []).map(function (token) {
    return {
      name: token && token.name !== undefined ? String(token.name) : null,
      token_type: token && token.token_type !== undefined ? token.token_type : null,
      token: maskCookie(token && token.token),
    };
  });
}

function cookieValue(cookie, key) {
  const parts = String(cookie || "").split(";");
  for (let i = 0; i < parts.length; i++) {
    const idx = parts[i].indexOf("=");
    if (idx > 0 && parts[i].slice(0, idx).trim() === key) return parts[i].slice(idx + 1).trim();
  }
  return "";
}

function cookieKeys(cookie) {
  const keys = [];
  String(cookie || "").split(";").forEach(function (part) {
    const idx = part.indexOf("=");
    if (idx > 0) keys.push(part.slice(0, idx).trim());
  });
  return keys;
}

function assembleCookie(stoken, ltoken, cookieToken, accountId, mid) {
  const map = {};
  if (accountId) {
    map.ltuid = accountId;
    map.account_id = accountId;
  }
  if (mid) map.mid = mid;
  if (stoken) map.stoken = stoken;
  if (ltoken) {
    map.ltoken = ltoken;
    if (ltoken.indexOf("v2_") === 0) {
      map.ltoken_v2 = ltoken;
      if (accountId) map.ltuid_v2 = accountId;
      if (mid) map.ltmid_v2 = mid;
    }
  }
  if (cookieToken) {
    map.cookie_token = cookieToken;
    if (cookieToken.indexOf("v2_") === 0) {
      map.cookie_token_v2 = cookieToken;
      if (accountId) map.account_id_v2 = accountId;
      if (mid) map.account_mid_v2 = mid;
    }
  }
  return buildCookie(map);
}

function cookieFromTokens(tokens, accountId, mid) {
  const byType = tokenMap(tokens);
  return assembleCookie(byType[1] || "", byType[2] || "", byType[4] || "", accountId, mid);
}

async function fetchLtoken(stoken, uid, mid) {
  if (!stoken) return "";
  try {
    const res = await Tapp.api("getLTokenBySToken", {
      stoken: stoken,
      uid: uid,
      mid: mid || "",
      ds: dsWeb(),
    });
    const data = res && res.data;
    if (!data) return "";
    return String(data.ltoken_v2 || data.ltoken || "");
  } catch (err) {
    return "";
  }
}

async function fetchCookieToken(stoken, uid, mid) {
  if (!stoken) return "";
  try {
    const res = await Tapp.api("stokenToCookie", {
      stoken: stoken,
      uid: uid,
      mid: mid || "",
    });
    const data = res && res.data;
    if (!data) return "";
    return String(data.cookie_token || data.cookie_token_v2 || "");
  } catch (err) {
    return "";
  }
}

/* ---------- 数据抓取（仅 manager 权限可调用上游） ---------- */

const API_CALLS = {
  dailyNote: function (params) {
    return Tapp.api("dailyNote", params);
  },
  playerIndex: function (params) {
    return Tapp.api("playerIndex", params);
  },
  roleBasicInfo: function (params) {
    return Tapp.api("roleBasicInfo", params);
  },
  challenge: function (params) {
    return Tapp.api("challenge", params);
  },
  challengeStory: function (params) {
    return Tapp.api("challengeStory", params);
  },
  challengeBoss: function (params) {
    return Tapp.api("challengeBoss", params);
  },
  bbsUser: function (params) {
    return Tapp.api("bbsUser", params);
  },
  getLTokenBySToken: function (params) {
    return Tapp.api("getLTokenBySToken", params);
  },
  stokenToCookie: function (params) {
    return Tapp.api("stokenToCookie", params);
  },
  deviceFp: function (params) {
    return Tapp.api("deviceFp", params);
  },
};

function roleQuery(uid, server) {
  return "role_id=" + uid + "&server=" + server;
}

/* DS 的 q 必须与请求查询串一致；hkrpg 服务端按参数名排序校验，这里统一按字母序拼接 */
function challengeQuery(schedule, uid, server) {
  return "need_all=true&role_id=" + uid + "&schedule_type=" + schedule + "&server=" + server;
}

function storyQuery(schedule, uid, server) {
  return "isPrev=true&need_all=true&role_id=" + uid + "&schedule_type=" + schedule + "&server=" + server;
}

function randomUuid() {
  const hex = randomHex(32).split("");
  hex[12] = "4";
  hex[16] = "89ab".charAt(randomInt(0, 3));
  const raw = hex.join("");
  return raw.slice(0, 8) + "-" + raw.slice(8, 12) + "-" + raw.slice(12, 16) + "-" + raw.slice(16, 20) + "-" + raw.slice(20);
}

const DEVICE_FIELDS = ["deviceModel", "androidVersion", "deviceFingerprint", "deviceName", "deviceBoard", "deviceProduct", "oaid"];

function parseDeviceInfo(raw) {
  const parsed = {};
  if (typeof raw === "string" && raw.trim()) {
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === "object") {
        DEVICE_FIELDS.forEach(function (key) {
          const value = json[key];
          if (typeof value === "string" && value.trim()) parsed[key] = value.trim();
        });
      }
    } catch (err) {
      /* fall through to defaults */
    }
  }
  DEVICE_FIELDS.forEach(function (key) {
    if (!parsed[key]) parsed[key] = DEFAULT_DEVICE_PROFILE[key];
  });
  return parsed;
}

async function readDeviceProfile() {
  const config = await readConfig();
  return parseDeviceInfo(config && typeof config.deviceInfo === "string" ? config.deviceInfo : "");
}

function buildExtFields(p) {
  const brand = String(p.deviceFingerprint || "").split("/")[0] || "Redmi";
  return JSON.stringify({
    proxyStatus: 0,
    isRoot: 0,
    romCapacity: "512",
    deviceName: p.deviceName,
    productName: p.deviceProduct,
    romRemain: "491",
    hostname: "localhost",
    screenSize: "1264x2640",
    isTablet: 0,
    aaid: randomHex(16).toUpperCase(),
    model: p.deviceModel,
    brand: brand,
    hardware: "qcom",
    deviceType: p.deviceName,
    devId: "REL",
    serialNumber: "unknown",
    sdCapacity: 512000,
    buildTime: String(Date.now() - 86400000),
    buildUser: "root",
    simState: 5,
    ramRemain: 200000,
    appUpdateTimeDiff: 86400000,
    deviceInfo: p.deviceFingerprint,
    vaid: randomHex(16).toUpperCase(),
    buildType: "user",
    sdkVersion: p.androidVersion,
    ui_mode: "UI_MODE_TYPE_NORMAL",
    isMockLocation: 0,
    cpuType: "arm64-v8a",
    isAirMode: 0,
    ringMode: 1,
    chargeStatus: 1,
    manufacturer: brand,
    emulatorStatus: 0,
    appMemory: "512",
    osVersion: p.androidVersion,
    vendor: "中国联通",
    sdRemain: 200000,
    buildTags: "release-keys",
    packageName: "com.mihoyo.hyperion",
    networkType: "WiFi",
    oaid: p.oaid,
    debugStatus: 1,
    ramCapacity: 512000,
    packageVersion: "2.20.2",
    batteryStatus: 50,
    hasKeyboard: 0,
    board: p.deviceBoard,
  });
}

async function getDevice() {
  try {
    const raw = await Tapp.private.get(DEVICE_KEY);
    if (raw && typeof raw === "object" && raw.device_id && raw.device_fp) return raw;
  } catch (err) {
    /* ignore */
  }
  return null;
}

async function ensureDevice() {
  const profile = await readDeviceProfile();
  const profileKey = JSON.stringify(profile);
  const cached = await getDevice();
  if (cached && cached.profileKey === profileKey) {
    if (cached.source === "getFp") return cached;
    if (Date.now() - (cached.updatedAt || 0) < DEVICE_RETRY) return cached;
  }
  const device = {
    device_id: cached && cached.device_id ? cached.device_id : randomUuid(),
    device_fp: cached && cached.device_fp ? cached.device_fp : randomHex(13),
    source: "fallback",
    profileKey: profileKey,
    updatedAt: Date.now(),
  };
  try {
    const res = await Tapp.api("deviceFp", {
      device_id: randomHex(16),
      seed_id: randomUuid(),
      seed_time: String(Date.now()),
      ext_fields: buildExtFields(profile),
      bbs_device_id: device.device_id,
      device_fp: device.device_fp,
    });
    const data = res && res.data;
    device.retcode = res && typeof res.retcode === "number" ? res.retcode : null;
    if (data && typeof data.device_fp === "string" && data.device_fp) {
      device.device_fp = data.device_fp;
      device.source = "getFp";
    }
  } catch (err) {
    device.error = String((err && err.message) || err);
  }
  try {
    await Tapp.private.set(DEVICE_KEY, device);
  } catch (err) {
    /* ignore */
  }
  return device;
}

/* ---------- Widget 调试（记录宿主传入的 size / isEditMode） ---------- */

let lastWidgetDebugKey = "";

async function noteWidgetProps(widgetId, props) {
  try {
    const info = {
      widgetId: widgetId,
      size: props && props.size != null ? String(props.size) : null,
      isEditMode: Boolean(props && props.isEditMode),
      isPreview: Boolean(props && props.isPreview),
      scale: props && typeof props.scale === "number" ? props.scale : null,
      at: Date.now(),
    };
    const key = JSON.stringify([info.widgetId, info.size, info.isEditMode, info.isPreview]);
    if (key === lastWidgetDebugKey) return;
    const role = await getRole();
    if (role !== "admin") return;
    lastWidgetDebugKey = key;
    await Tapp.private.set(WIDGET_DEBUG_KEY, info);
  } catch (err) {
    /* ignore */
  }
}

async function readWidgetDebug() {
  try {
    const raw = await Tapp.private.get(WIDGET_DEBUG_KEY);
    if (raw && typeof raw === "object") return raw;
  } catch (err) {
    /* ignore */
  }
  return null;
}

/* ---------- 开拓者笔记角色词条（点击头像直达） ---------- */

let obcMemory = null;

async function getObcMap() {
  if (obcMemory) return obcMemory;
  try {
    const raw = await Tapp.shared.get(OBC_KEY);
    if (raw && typeof raw === "object" && raw.items && typeof raw.items === "object") {
      obcMemory = raw;
      return obcMemory;
    }
  } catch (err) {
    /* ignore */
  }
  obcMemory = { items: {} };
  return obcMemory;
}

function isRoleEntry(item) {
  const channels = item && Array.isArray(item.channels) ? item.channels : [];
  return channels.some(function (channel) {
    return channel && (channel.name === "角色" || String(channel.channel_id) === "18");
  });
}

async function resolveCharacterLink(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  const map = await getObcMap();
  if (map.items[clean]) return map.items[clean];
  try {
    const res = await Tapp.api("obcSearch", { keyword: clean });
    const list = res && res.data && Array.isArray(res.data.list) ? res.data.list : [];
    let hit = null;
    for (let i = 0; i < list.length; i++) {
      if (isRoleEntry(list[i]) && String(list[i].title || "").trim() === clean) {
        hit = list[i];
        break;
      }
    }
    if (!hit) {
      for (let i = 0; i < list.length; i++) {
        if (isRoleEntry(list[i])) {
          hit = list[i];
          break;
        }
      }
    }
    if (!hit) return "";
    const id = hit.id ? String(hit.id) : "";
    const url = hit.bbs_url || (id ? "https://bbs.mihoyo.com/sr/wiki/content/" + id + "/detail?bbs_presentation_style=no_header" : "");
    if (!url) return "";
    map.items[clean] = url;
    try {
      await Tapp.shared.set(OBC_KEY, map);
    } catch (err) {
      /* ignore */
    }
    return url;
  } catch (err) {
    return "";
  }
}

async function openCharacter(name) {
  const url = await resolveCharacterLink(name);
  if (!url) return false;
  const match = url.match(/\/sr\/wiki\/content\/(\d+)\/detail/);
  if (!match) return false;
  try {
    const openUrl = Tapp.ui && Tapp.ui.openUrl;
    if (typeof openUrl !== "function") return false;
    await openUrl({
      id: "sr-wiki",
      path: match[1] + "/detail",
      query: { bbs_presentation_style: "no_header" },
    });
    return true;
  } catch (err) {
    return false;
  }
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function formatTimestamp(seconds) {
  const value = Number(seconds);
  if (!value || !isFinite(value)) return "";
  const date = new Date(value * 1000);
  return pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
}

/* 战绩接口的 challenge_time 是对象 {year,month,day,hour,minute,second}，也兼容时间戳 */
function formatChallengeTime(value) {
  if (!value) return "";
  if (typeof value === "object") {
    if (typeof value.year === "number") {
      return pad2(value.month) + "-" + pad2(value.day) + " " + pad2(value.hour) + ":" + pad2(value.minute);
    }
    if (typeof value.$date === "number") return formatTimestamp(Math.floor(value.$date / 1000));
    if (typeof value.time === "number") return formatTimestamp(Math.floor(value.time / 1000));
    return "";
  }
  const num = Number(value);
  if (!num || !isFinite(num)) return "";
  if (num > 1e12) return formatTimestamp(Math.floor(num / 1000));
  return formatTimestamp(num);
}

/* 只取月日（MM-DD） */
function formatMonthDay(value) {
  const text = formatChallengeTime(value);
  return text ? text.slice(0, 5) : "";
}

/* ---------- 素材本地化（增量缓存） ---------- */

let assetMemory = null;

async function getAssetMap() {
  try {
    const raw = await Tapp.shared.get(ASSETS_KEY);
    if (raw && typeof raw === "object" && raw.items && typeof raw.items === "object") {
      if (!raw.failed || typeof raw.failed !== "object") raw.failed = {};
      return raw;
    }
  } catch (err) {
    /* ignore */
  }
  return { items: {}, failed: {}, updatedAt: 0 };
}

async function setAssetMap(map) {
  try {
    await Tapp.shared.set(ASSETS_KEY, map);
    assetMemory = map;
  } catch (err) {
    /* ignore */
  }
}

async function loadAssets(force) {
  if (assetMemory && !force) return assetMemory;
  assetMemory = await getAssetMap();
  return assetMemory;
}

function resolveAsset(url) {
  if (!url) return "";
  const item = assetMemory && assetMemory.items ? assetMemory.items[url] : null;
  return item && item.data ? item.data : url;
}

function assetStats(map) {
  const items = map && map.items ? map.items : {};
  const keys = Object.keys(items);
  let bytes = 0;
  keys.forEach(function (key) {
    bytes += (items[key] && items[key].data ? items[key].data.length : 0);
  });
  return {
    count: keys.length,
    bytes: bytes,
    failed: map && map.failed ? Object.keys(map.failed).length : 0,
    updatedAt: map && map.updatedAt ? new Date(map.updatedAt).toISOString() : null,
  };
}

const ENDGAME_KEYS = ["mocCurrent", "mocPrevious", "fiction", "apocalyptic"];

function collectAssetUrls(cache) {
  const urls = [];
  function add(url) {
    if (typeof url === "string" && /^https?:/i.test(url) && urls.indexOf(url) < 0) urls.push(url);
  }
  const role = pickRole(cache);
  if (role) add(roleAvatar(role));
  const index = cache && cache.playerIndex;
  if (index) {
    add(index.cur_head_icon_url);
    add(index.phone_background_image_url);
    const avatars = Array.isArray(index.avatar_list) ? index.avatar_list : Array.isArray(index.avatars) ? index.avatars : [];
    avatars.forEach(function (avatar) {
      if (!avatar) return;
      add(avatar.icon);
      add(avatar.image);
    });
  }
  const bbsUser = pickBbsUser(cache);
  if (bbsUser) add(bbsUser.avatar_url);
  ENDGAME_KEYS.forEach(function (key) {
    const info = cache && cache[key];
    const floors = info && Array.isArray(info.all_floor_detail) ? info.all_floor_detail : [];
    floors.forEach(function (floor) {
      ["node_1", "node_2", "node_3"].forEach(function (nodeKey) {
        const node = floor && floor[nodeKey];
        const avatars = node && Array.isArray(node.avatars) ? node.avatars : [];
        avatars.forEach(function (member) {
          if (member) add(member.icon || member.image);
        });
      });
    });
  });
  return urls;
}

function loadImageDataUrl(url) {
  return new Promise(function (resolve) {
    let settled = false;
    function done(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        if (!img.naturalWidth || !img.naturalHeight) return done(null);
        const canvas = document.createElement("canvas");
        canvas.width = ASSET_SIZE;
        canvas.height = ASSET_SIZE;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(ASSET_SIZE / img.naturalWidth, ASSET_SIZE / img.naturalHeight);
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        ctx.drawImage(img, Math.round((ASSET_SIZE - width) / 2), Math.round((ASSET_SIZE - height) / 2), width, height);
        let data = "";
        try {
          data = canvas.toDataURL("image/webp", 0.65);
        } catch (err) {
          data = "";
        }
        if (!data || data.indexOf("data:image/webp") !== 0) {
          try {
            data = canvas.toDataURL("image/png");
          } catch (err) {
            data = "";
          }
        }
        done(data || null);
      } catch (err) {
        done(null);
      }
    };
    img.onerror = function () {
      done(null);
    };
    img.src = url;
  });
}

async function cacheAssets(cache, limit) {
  const map = await getAssetMap();
  const urls = collectAssetUrls(cache);
  const now = Date.now();
  let total = 0;
  let processed = 0;
  Object.keys(map.items).forEach(function (key) {
    total += map.items[key] && map.items[key].data ? map.items[key].data.length : 0;
  });
  let changed = false;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (map.items[url]) continue;
    const failedAt = map.failed[url] || 0;
    if (failedAt && now - failedAt < ASSET_RETRY) continue;
    if (total >= ASSET_TOTAL_BYTES) break;
    if (limit && processed >= limit) break;
    processed++;
    const data = await loadImageDataUrl(url);
    if (!data || data.length > ASSET_MAX_BYTES) {
      map.failed[url] = now;
      changed = true;
      continue;
    }
    map.items[url] = { data: data, at: now };
    total += data.length;
    changed = true;
    await sleep(120);
  }
  const keep = {};
  urls.forEach(function (url) {
    if (map.items[url]) keep[url] = map.items[url];
  });
  if (Object.keys(keep).length !== Object.keys(map.items).length) {
    map.items = keep;
    changed = true;
  }
  if (changed) {
    map.updatedAt = now;
    await setAssetMap(map);
  } else {
    assetMemory = map;
  }
  return map;
}

function probeImage(url) {
  return new Promise(function (resolve) {
    if (!url) return resolve({ ok: false, error: "NO_URL" });
    const start = Date.now();
    let settled = false;
    function done(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      let canvasRead = false;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        canvas.getContext("2d").drawImage(img, 0, 0, 8, 8);
        canvas.toDataURL("image/png");
        canvasRead = true;
      } catch (err) {
        canvasRead = false;
      }
      done({ ok: true, ms: Date.now() - start, width: img.naturalWidth, height: img.naturalHeight, canvasRead: canvasRead });
    };
    img.onerror = function () {
      done({ ok: false, ms: Date.now() - start, error: "onerror" });
    };
    img.src = url;
  });
}

function roleAvatar(role) {
  if (!role) return "";
  if (role.avatar && typeof role.avatar === "object" && role.avatar.icon) return role.avatar.icon;
  if (typeof role.avatar === "string" && role.avatar) return role.avatar;
  return role.game_head_icon || "";
}

function pickHeadIcon(cache) {
  const index = cache && cache.playerIndex;
  if (!index) return "";
  return index.cur_head_icon_url || "";
}

function headIcon(cache) {
  return roleAvatar(pickRole(cache)) || pickHeadIcon(cache);
}

async function testAvatar() {
  const cache = await getCache();
  const role = pickRole(cache);
  const url = headIcon(cache);
  const map = await getAssetMap();
  const cached = Boolean(url && map.items[url]);
  const remote = url ? await probeImage(url) : { ok: false, error: "NO_URL" };
  return {
    url: url,
    cached: cached,
    remote: remote,
    roleAvatar: roleAvatar(role),
    cur_head_icon_url: pickHeadIcon(cache),
    roleKeys: role ? Object.keys(role) : [],
    cacheAt: cache && cache.at ? new Date(cache.at).toISOString() : null,
  };
}

async function ensureLtoken(auth) {
  if (!auth || !auth.cookie) return auth;
  const stoken = cookieValue(auth.cookie, "stoken");
  if (!stoken) return auth;
  const ltoken = cookieValue(auth.cookie, "ltoken");
  const ltokenV2 = cookieValue(auth.cookie, "ltoken_v2");
  const bogusV2 = Boolean(ltokenV2 && ltokenV2 === stoken);
  const ltokenIsStoken = Boolean(ltoken && ltoken === stoken);
  if (ltoken && !bogusV2 && !ltokenIsStoken) return auth;
  const uid = auth.uid || cookieValue(auth.cookie, "ltuid");
  const mid = auth.mid || cookieValue(auth.cookie, "mid");
  let real = await fetchLtoken(stoken, uid, mid);
  if (!real) real = ltoken || stoken;
  let cookieToken = cookieValue(auth.cookie, "cookie_token") || cookieValue(auth.cookie, "cookie_token_v2");
  if (!cookieToken) cookieToken = await fetchCookieToken(stoken, uid, mid);
  const accountId = cookieValue(auth.cookie, "account_id") || uid;
  const cookie = assembleCookie(stoken, real, cookieToken, accountId, mid);
  const types = (auth.tokenTypes || []).slice();
  if (types.indexOf(2) < 0) types.push(2);
  if (cookieToken && types.indexOf(4) < 0) types.push(4);
  return await setAuth(Object.assign({}, auth, {
    cookie: cookie,
    uid: uid,
    tokenTypes: types,
    updatedAt: Date.now(),
  }));
}

async function fetchJson(apiName, params) {
  const call = API_CALLS[apiName];
  if (!call) return { error: "UNKNOWN_API" };
  const res = await call(params);
  if (!res || typeof res !== "object") return { error: "NETWORK" };
  if (typeof res.retcode === "number" && res.retcode !== 0) {
    return { error: res.retcode, message: res.message || "" };
  }
  if (res.data === undefined) return { error: "EMPTY" };
  return { data: res.data };
}

async function refresh(force) {
  const role = await getRole();
  if (role !== "admin") return { error: "FORBIDDEN" };
  const settings = await readSettings();
  if (!settings.uid) return { error: "NO_UID" };
  let auth = await getAuth();
  if (!auth || !auth.cookie) return { error: "NO_AUTH" };

  const cache = (await getCache()) || {};
  const now = Date.now();
  if (cache.riskUntil && now < cache.riskUntil) {
    return { error: "RISK_COOLDOWN", riskUntil: cache.riskUntil };
  }
  auth = await ensureLtoken(auth);
  const dataFresh = cache.at && now - cache.at < CACHE_TTL && cache.uid === settings.uid;
  const endgameFresh = cache.endgameAt && now - cache.endgameAt < ENDGAME_TTL && cache.uid === settings.uid;
  if (!force && dataFresh && endgameFresh) return { cache: cache, fresh: true };

  const device = await ensureDevice();
  const uid = settings.uid;
  const server = resolveServer(settings.server, uid);
  const cookie = auth.cookie;
  const next = Object.assign({}, cache, { uid: uid, server: settings.server, errors: {} });
  const errors = next.errors;
  let riskHit = false;

  async function load(key, apiName, params, useEndgame) {
    if (riskHit) return;
    if (!force && (useEndgame ? endgameFresh : dataFresh)) return;
    await sleep(REQUEST_GAP + randomInt(0, 300));
    try {
      const res = await fetchJson(apiName, params);
      if (res.error !== undefined) {
        errors[key] = res.error;
        if (RISK_CODES.indexOf(res.error) >= 0) riskHit = true;
      } else {
        next[key] = res.data;
      }
    } catch (err) {
      errors[key] = "NETWORK";
    }
  }

  const base = {
    role_id: uid,
    server: server,
    cookie: cookie,
    device_id: device.device_id,
    device_fp: device.device_fp,
  };

  await load("dailyNote", "dailyNote", Object.assign({}, base, {
    ds: dsApp(roleQuery(uid, server)),
  }));
  await load("playerIndex", "playerIndex", Object.assign({}, base, {
    ds: dsApp(roleQuery(uid, server)),
  }));
  await load("roleInfo", "roleBasicInfo", Object.assign({}, base, {
    ds: dsApp(roleQuery(uid, server)),
  }));
  if (auth.uid) {
    await load("bbsUser", "bbsUser", {
      uid: auth.uid,
      cookie: cookie,
      device_id: device.device_id,
      device_fp: device.device_fp,
      ds: dsWeb(),
    });
  }

  if (force || !endgameFresh) {
    await load("mocCurrent", "challenge", Object.assign({}, base, {
      schedule_type: "1",
      ds: dsApp(challengeQuery(1, uid, server)),
    }), true);
    await load("mocPrevious", "challenge", Object.assign({}, base, {
      schedule_type: "2",
      ds: dsApp(challengeQuery(2, uid, server)),
    }), true);
    await load("fiction", "challengeStory", Object.assign({}, base, {
      schedule_type: "1",
      ds: dsApp(storyQuery(1, uid, server)),
    }), true);
    await load("apocalyptic", "challengeBoss", Object.assign({}, base, {
      schedule_type: "1",
      ds: dsApp(storyQuery(1, uid, server)),
    }), true);
    if (!errors.mocCurrent && !errors.fiction && !errors.apocalyptic) next.endgameAt = now;
  }

  if ((force || !dataFresh) && !errors.dailyNote && !errors.playerIndex) next.at = now;
  if (riskHit) {
    const count = (cache.riskCount || 0) + 1;
    const span = Math.min(RISK_COOLDOWN * Math.pow(2, count - 1), RISK_COOLDOWN_MAX);
    next.riskCount = count;
    next.riskUntil = Date.now() + span;
  } else {
    next.riskCount = 0;
    next.riskUntil = 0;
  }
  await setCache(next);
  if (!riskHit) scheduleAssetCache(next);
  return { cache: next };
}

let assetCacheRunning = false;

function scheduleAssetCache(cache) {
  if (assetCacheRunning) return;
  assetCacheRunning = true;
  setTimeout(function () {
    cacheAssets(cache, ASSET_BATCH).catch(function () {
      /* ignore */
    }).then(function () {
      assetCacheRunning = false;
    });
  }, 0);
}

async function verifyAuth() {
  const settings = await readSettings();
  if (!settings.uid) return { error: "NO_UID" };
  let auth = await getAuth();
  if (!auth || !auth.cookie) return { error: "NO_AUTH" };
  const cache = (await getCache()) || {};
  const now = Date.now();
  if (cache.riskUntil && now < cache.riskUntil) {
    return { error: "RISK_COOLDOWN", riskUntil: cache.riskUntil };
  }
  auth = await ensureLtoken(auth);
  const device = await ensureDevice();
  const uid = settings.uid;
  const server = resolveServer(settings.server, uid);
  const res = await fetchJson("dailyNote", {
    role_id: uid,
    server: server,
    cookie: auth.cookie,
    device_id: device.device_id,
    device_fp: device.device_fp,
    ds: dsApp(roleQuery(uid, server)),
  });
  if (res.error !== undefined && RISK_CODES.indexOf(res.error) >= 0) {
    const count = (cache.riskCount || 0) + 1;
    const span = Math.min(RISK_COOLDOWN * Math.pow(2, count - 1), RISK_COOLDOWN_MAX);
    await setCache(Object.assign({}, cache, {
      riskCount: count,
      riskUntil: Date.now() + span,
      errors: Object.assign({}, cache.errors || {}, { dailyNote: res.error }),
    }));
  }
  return res;
}

async function loadData() {
  return (await getCache()) || null;
}

/* ---------- 扫码登录（HYP） ---------- */

async function loginWithHyp(onStatus) {
  const deviceId = randomHex(64);
  const created = await Tapp.api("hypQrCreate", { device_id: deviceId });
  const data = created && created.data;
  if (!data || !data.url) throw new Error("QR_CREATE_FAILED");
  onStatus({ state: "waiting", url: data.url, flow: "hyp" });
  for (let i = 0; i < QR_MAX_POLLS; i++) {
    if (qrCancelled) throw new Error("QR_CANCELLED");
    await sleep(QR_POLL_INTERVAL + randomInt(0, 800));
    if (qrCancelled) throw new Error("QR_CANCELLED");
    const res = await Tapp.api("hypQrCheck", { device_id: deviceId, ticket: data.ticket });
    const status = res && res.data;
    if (!status) continue;
    if (status.status === "Scanned") onStatus({ state: "scanned", flow: "hyp" });
    if (status.status === "Confirmed") {
      const user = status.user_info || {};
      const accountId = String(user.aid || user.uid || user.account_id || user.mid || "");
      const mid = String(user.mid || "");
      const tokens = status.tokens || [];
      const byType = tokenMap(tokens);
      let stoken = byType[1] || "";
      if (!stoken) {
        for (let t = 0; t < tokens.length; t++) {
          if (tokens[t] && typeof tokens[t].token === "string" && tokens[t].token) {
            stoken = tokens[t].token;
            break;
          }
        }
      }
      let cookieToken = byType[4] || "";
      if (stoken && !cookieToken) cookieToken = await fetchCookieToken(stoken, accountId, mid);
      let ltoken = byType[2] || "";
      if (stoken && !ltoken) ltoken = await fetchLtoken(stoken, accountId, mid);
      if (!ltoken) ltoken = stoken;
      const cookie = assembleCookie(stoken, ltoken, cookieToken, accountId, mid);
      const types = Object.keys(byType).map(Number);
      if (ltoken && types.indexOf(2) < 0) types.push(2);
      if (cookieToken && types.indexOf(4) < 0) types.push(4);
      pushQrDebug({
        flow: "hyp",
        status: status.status,
        userInfoKeys: Object.keys(user),
        tokens: tokenPreview(tokens),
        resolved: {
          hasStoken: Boolean(stoken),
          hasLtoken: Boolean(byType[2]),
          hasCookieToken: Boolean(cookieToken),
          mid: Boolean(mid),
        },
      });
      if (!cookie || !stoken) throw new Error("QR_CONFIRMED_INCOMPLETE");
      const auth = await setAuth({
        cookie: cookie,
        uid: accountId,
        mid: mid,
        source: "hyp",
        tokenTypes: types,
        updatedAt: Date.now(),
      });
      onStatus({ state: "confirmed", flow: "hyp" });
      return auth;
    }
  }
  throw new Error("QR_TIMEOUT");
}

function maskCookie(cookie) {
  const text = String(cookie || "");
  if (!text) return "";
  if (text.length <= 40) return text.slice(0, 6) + "…";
  return text.slice(0, 28) + "…" + text.slice(-10);
}

const QR_DEBUG_LIMIT = 6;
const qrDebugLog = [];

function pushQrDebug(entry) {
  try {
    qrDebugLog.push(Object.assign({ at: new Date().toISOString() }, entry));
    if (qrDebugLog.length > QR_DEBUG_LIMIT) qrDebugLog.shift();
  } catch (err) {
    /* ignore */
  }
}

function truncateValue(value, max) {
  let text;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch (err) {
    text = String(value);
  }
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…(truncated " + text.length + ")" : text;
}

async function debugRun() {
  const settings = await readSettings();
  const cache = await getCache();
  const cooling = Boolean(cache && cache.riskUntil && Date.now() < cache.riskUntil);
  const auth = cooling ? await getAuth() : await ensureLtoken(await getAuth());
  const device = cooling ? await getDevice() : await ensureDevice();
  const uid = settings.uid;
  const server = resolveServer(settings.server, uid);
  const cookie = auth && auth.cookie ? auth.cookie : "";
  const deviceParams = device ? { device_id: device.device_id, device_fp: device.device_fp } : {};
  const results = [];
  let riskHit = false;

  if (cooling) {
    results.push({
      note: "risk cooldown active, API tests skipped",
      riskUntil: new Date(cache.riskUntil).toISOString(),
    });
  }

  async function run(name, params, skippedReason, signedQuery) {
    if (riskHit) {
      results.push({ api: name, skipped: "risk cooldown" });
      return;
    }
    if (!params) {
      results.push({ api: name, skipped: skippedReason || "no params" });
      return;
    }
    await sleep(REQUEST_GAP + randomInt(0, 300));
    const masked = {};
    Object.keys(params).forEach(function (key) {
      if (key === "cookie" || key === "stoken" || key === "ticket" || key === "game_token") {
        masked[key] = maskCookie(params[key]);
      } else {
        masked[key] = truncateValue(params[key], 200);
      }
    });
    try {
      const call = API_CALLS[name];
      const res = call ? await call(params) : null;
      const retcode = res && typeof res.retcode === "number" ? res.retcode : null;
      if (retcode !== null && RISK_CODES.indexOf(retcode) >= 0) riskHit = true;
      results.push({
        api: name,
        signedQuery: signedQuery || null,
        params: masked,
        retcode: retcode,
        message: res && res.message ? String(res.message) : "",
        response: truncateValue(res, 2000),
      });
    } catch (err) {
      results.push({ api: name, signedQuery: signedQuery || null, params: masked, error: String((err && err.message) || err) });
    }
  }

  if (!cooling) {
    const base = uid ? Object.assign({ role_id: uid, server: server, cookie: cookie }, deviceParams) : null;
    const roleQ = roleQuery(uid, server);
    await run("dailyNote", base ? Object.assign({}, base, { ds: dsApp(roleQ) }) : null, "no uid", roleQ);
    await run("playerIndex", base ? Object.assign({}, base, { ds: dsApp(roleQ) }) : null, "no uid", roleQ);
    await run("roleBasicInfo", base ? Object.assign({}, base, { ds: dsApp(roleQ) }) : null, "no uid", roleQ);
    await run("bbsUser", auth && auth.uid ? Object.assign({
      uid: auth.uid,
      cookie: cookie,
      ds: dsWeb(),
    }, deviceParams) : null, "no auth uid");
    const mocQ = challengeQuery(1, uid, server);
    await run("challenge", base ? Object.assign({}, base, {
      schedule_type: "1",
      ds: dsApp(mocQ),
    }) : null, "no uid", mocQ);
    const storyQ = storyQuery(1, uid, server);
    await run("challengeStory", base ? Object.assign({}, base, {
      schedule_type: "1",
      ds: dsApp(storyQ),
    }) : null, "no uid", storyQ);
    await run("challengeBoss", base ? Object.assign({}, base, {
      schedule_type: "1",
      ds: dsApp(storyQ),
    }) : null, "no uid", storyQ);
    const cookieStoken = cookieValue(cookie, "stoken");
    await run("getLTokenBySToken", cookieStoken ? {
      stoken: cookieStoken,
      uid: auth && auth.uid ? auth.uid : "",
      mid: auth && auth.mid ? auth.mid : cookieValue(cookie, "mid"),
      ds: dsWeb(),
    } : null, "no stoken in cookie");
  }

  if (riskHit && cache) {
    const count = (cache.riskCount || 0) + 1;
    const span = Math.min(RISK_COOLDOWN * Math.pow(2, count - 1), RISK_COOLDOWN_MAX);
    await setCache(Object.assign({}, cache, {
      riskCount: count,
      riskUntil: Date.now() + span,
    }));
  }

  return {
    time: new Date().toISOString(),
    role: await getRole(),
    settings: { uid: uid, server: settings.server, resolvedServer: server },
    auth: auth ? {
      uid: auth.uid,
      mid: auth.mid,
      source: auth.source,
      updatedAt: auth.updatedAt,
      tokenTypes: auth.tokenTypes || null,
      cookieLength: cookie.length,
      cookieKeys: cookieKeys(cookie),
      ltokenPresent: Boolean(cookieValue(cookie, "ltoken") || cookieValue(cookie, "ltoken_v2")),
      cookieTokenPresent: Boolean(cookieValue(cookie, "cookie_token") || cookieValue(cookie, "cookie_token_v2")),
      cookiePreview: maskCookie(cookie),
    } : null,
    cache: cache ? {
      at: cache.at ? new Date(cache.at).toISOString() : null,
      endgameAt: cache.endgameAt ? new Date(cache.endgameAt).toISOString() : null,
      uid: cache.uid || null,
      sections: ["dailyNote", "playerIndex", "roleInfo", "bbsUser"].concat(ENDGAME_KEYS).filter(function (key) {
        return cache[key] !== undefined;
      }),
      errors: cache.errors || {},
      riskUntil: cache.riskUntil ? new Date(cache.riskUntil).toISOString() : null,
      riskCount: cache.riskCount || 0,
    } : null,
    qr: qrDebugLog.slice(),
    device: device ? {
      device_id: device.device_id,
      device_fp: device.device_fp,
      source: device.source,
      retcode: device.retcode !== undefined ? device.retcode : null,
      error: device.error || null,
      profile: await readDeviceProfile(),
    } : null,
    playerIndexRole: pickRole(cache) ? {
      keys: Object.keys(pickRole(cache)),
      avatar: roleAvatar(pickRole(cache)),
      cur_head_icon_url: pickHeadIcon(cache),
    } : null,
    assets: assetStats(await getAssetMap()),
    widget: await readWidgetDebug(),
    scheduler: await syncTaskInfo(),
    results: results,
  };
}

let qrCancelled = false;

function cancelQrLogin() {
  qrCancelled = true;
}

async function startQrLogin(onStatus) {
  qrCancelled = false;
  try {
    return await loginWithHyp(onStatus);
  } finally {
    qrCancelled = false;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    /* ignore */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch (err) {
    return false;
  }
}

/* ---------- 定时刷新（每 6 小时一次，headless core 执行） ---------- */

const SYNC_TASK_ID = "starrail-sync";
const SYNC_CRON = "0 */6 * * *";

async function triggerSync() {
  try {
    if (typeof Tapp === "undefined" || !Tapp.scheduler || typeof Tapp.scheduler.trigger !== "function") {
      return { error: "UNSUPPORTED" };
    }
    await Tapp.scheduler.trigger(SYNC_TASK_ID);
    return { ok: true };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

async function syncTaskInfo() {
  try {
    if (typeof Tapp === "undefined" || !Tapp.scheduler || typeof Tapp.scheduler.get !== "function") return null;
    return await Tapp.scheduler.get(SYNC_TASK_ID);
  } catch (err) {
    return null;
  }
}

async function initScheduler() {
  try {
    if (typeof Tapp === "undefined" || !Tapp.scheduler || typeof Tapp.scheduler.register !== "function") return;
    const role = await getRole();
    if (role !== "admin") return;
    await Tapp.scheduler.register({
      taskId: SYNC_TASK_ID,
      name: "星穹铁道数据定时刷新",
      scheduleType: "cron",
      schedule: { cron: SYNC_CRON },
      executionTarget: "frontend",
      missedPolicy: "run-once",
    });
    if (typeof Tapp.scheduler.onTask === "function") {
      Tapp.scheduler.onTask(SYNC_TASK_ID, async function () {
        try {
          const current = await getRole();
          if (current !== "admin") return;
          await refresh(false);
        } catch (err) {
          /* ignore */
        }
      });
    }
  } catch (err) {
    /* ignore */
  }
}

/* ---------- 展示辅助 ---------- */

const SYNC_TTL = 6 * 60 * 60 * 1000;

function isCacheStale(cache) {
  return !cache || !cache.at || Date.now() - cache.at > SYNC_TTL;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return hours + "h" + minutes + "m";
  if (minutes > 0) return minutes + "m";
  return total + "s";
}

function elementColor(element) {
  return ELEMENT_COLORS[String(element || "").toLowerCase()] || "#8a8f98";
}

function endgameStars(info) {
  if (!info || typeof info.star_num !== "number") return 0;
  return info.star_num;
}

function serverLabelKey(server) {
  if (server === "prod_qd_cn") return "app.server.b";
  if (server === "os") return "app.server.os";
  return "app.server.cn";
}

/* ---------- 共享 UI（Page / Widget 共用） ---------- */

function t(key, params) {
  try {
    return Tapp.i18n.t(key, params);
  } catch (err) {
    return key;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setText(node, text) {
  if (node) node.textContent = text == null ? "" : String(text);
}

function setImage(img, fallbackEl, url, fallbackText, color) {
  const src = url ? resolveAsset(url) : "";
  if (img) {
    if (src) {
      if (fallbackEl) fallbackEl.hidden = true;
      img.onerror = function () {
        img.hidden = true;
        if (fallbackEl) fallbackEl.hidden = false;
      };
      img.onload = function () {
        img.hidden = false;
        if (fallbackEl) fallbackEl.hidden = true;
      };
      img.src = src;
    } else {
      img.hidden = true;
      if (fallbackEl) fallbackEl.hidden = false;
    }
  }
  if (fallbackEl) {
    if (fallbackText != null) fallbackEl.textContent = fallbackText;
    if (color) fallbackEl.style.background = color;
    if (!src) fallbackEl.hidden = false;
  }
}

function avatarNode(url, options) {
  const opts = options || {};
  const wrap = el("span", opts.wrapClass || "gt-avatar-node");
  const img = document.createElement("img");
  img.className = opts.imgClass || "";
  img.alt = "";
  img.decoding = "async";
  const fallback = el("span", opts.fallbackClass || "gt-avatar-fallback", opts.fallbackText != null ? opts.fallbackText : "?");
  if (opts.color) fallback.style.background = opts.color;
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  setImage(img, fallback, url, opts.fallbackText != null ? opts.fallbackText : "?", opts.color);
  return wrap;
}

function charTile(avatar, options) {
  const opts = options || {};
  const item = avatar || {};
  const card = el("div", opts.className || "gt-char");
  const img = document.createElement("img");
  img.className = opts.imgClass || "gt-char-img";
  img.alt = "";
  img.decoding = "async";
  const name = item.name || "?";
  const fallback = el("span", opts.fallbackClass || "gt-char-fallback", name.charAt(0));
  if (item.element) fallback.style.background = elementColor(item.element);
  card.appendChild(img);
  card.appendChild(fallback);
  setImage(img, fallback, item.icon || item.image || "", name.charAt(0), elementColor(item.element));
  if (opts.withLabels) {
    card.appendChild(el("span", "gt-char-name", item.name || ""));
    if (opts.meta != null) card.appendChild(el("span", "gt-char-meta", opts.meta));
    card.appendChild(el("span", "gt-char-stars", "★".repeat(Math.min(5, item.rarity || 0))));
  }
  return card;
}

function sortAvatars(avatars, limit) {
  const list = Array.isArray(avatars) ? avatars.slice() : [];
  list.sort(function (a, b) {
    if ((b.rarity || 0) !== (a.rarity || 0)) return (b.rarity || 0) - (a.rarity || 0);
    return (b.level || 0) - (a.level || 0);
  });
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

function pickRole(cache) {
  const index = cache && cache.playerIndex;
  if (index && index.role) return index.role;
  return (cache && cache.roleInfo) || null;
}

function pickIndex(cache) {
  return (cache && cache.playerIndex) || null;
}

function pickIndexAvatars(cache) {
  const index = pickIndex(cache);
  if (!index) return [];
  if (Array.isArray(index.avatar_list)) return index.avatar_list;
  if (Array.isArray(index.avatars)) return index.avatars;
  return [];
}

function pickNote(cache) {
  return cache && cache.dailyNote ? cache.dailyNote : null;
}

function pickBbsUser(cache) {
  const bbs = cache && cache.bbsUser;
  return bbs && bbs.user ? bbs.user : null;
}

function pickMoc(cache, schedule) {
  if (schedule === "2") return (cache && cache.mocPrevious) || null;
  return (cache && cache.mocCurrent) || null;
}

function pickFiction(cache) {
  return (cache && cache.fiction) || null;
}

function pickApocalyptic(cache) {
  return (cache && cache.apocalyptic) || null;
}

function endgameFloors(info) {
  return info && Array.isArray(info.all_floor_detail) ? info.all_floor_detail : [];
}

/* ---------- 终局关卡选择（只取最后一关：最高难度，含星启模式变体） ---------- */

const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function chineseNumber(text) {
  const s = String(text || "");
  if (!s) return 0;
  let total = 0;
  let current = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === "十") {
      current = (current || 1) * 10;
      total += current;
      current = 0;
    } else if (CN_DIGITS[ch]) {
      current = CN_DIGITS[ch];
    }
  }
  total += current;
  return total;
}

/* 从关卡名提取难度序号：优先阿拉伯数字（难度04/12），否则中文数字（其十二/第四关） */
function floorDifficulty(name) {
  const text = String(name || "");
  const digits = text.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  const cn = text.match(/[其第]([一二三四五六七八九十]+)/) || text.match(/([一二三四五六七八九十]+)/);
  if (cn) return chineseNumber(cn[1]);
  return 0;
}

function normalizeFloorName(value) {
  return String(value == null ? "" : value)
    .replace(/[（(][^)）]*[)）]/g, "")
    .replace(/模式|难度|第|层|关|·|\s+/g, "")
    .trim();
}

/* 展示用关卡名：去掉括号/「星启模式」后缀，星启压缩为 ·星启 */
function floorDisplayName(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  const star = text.indexOf("星启") >= 0;
  const base = text
    .replace(/[（(][^)）]*[)）]/g, "")
    .replace(/星启模式?|模式/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (star) return base ? base + "·星启" : "星启";
  return base || text;
}

/* 紧凑关卡名（15% 标签列用）：其十二·星启 / 难度04·星启 */
function floorCompactName(value) {
  const text = String(value == null ? "" : value);
  const star = text.indexOf("星启") >= 0;
  let base = "";
  const cn = text.match(/其([一二三四五六七八九十]+)/);
  const num = text.match(/难度\s*(\d+)/);
  if (cn) base = "其" + cn[1];
  else if (num) base = "难度" + num[1];
  else base = floorDisplayName(text);
  if (star && base.indexOf("星启") < 0) base += "·星启";
  return base;
}

/* 星启额外星数（AS 接口返回字符串，需转数字） */
function floorExtraStars(floor) {
  const value = Number(floor && floor.extra_star_num);
  return isFinite(value) && value > 0 ? value : 0;
}

function floorHasRecord(floor) {
  if (!floor) return false;
  if (Number(floor.star_num) > 0) return true;
  return endgameNodes(floor).some(function (node) {
    return node && Array.isArray(node.avatars) && node.avatars.length > 0;
  });
}

function isTierceFloor(floor) {
  if (!floor) return false;
  return floor.is_tierce === true || floor.is_tierce === "true" || floor.is_tierce === 1;
}

function endgameLastFloor(info) {
  const floors = endgameFloors(info);
  if (!floors.length) return null;

  /* 优先带通关记录的关卡（避免选中未挑战的强化变体） */
  const played = floors.filter(floorHasRecord);
  const candidates = played.length ? played : floors;

  /* 1. 接口字段 is_tierce（星启模式 = 最后一关强化变体） */
  const tierce = candidates.filter(isTierceFloor);
  if (tierce.length) {
    return tierce.reduce(function (a, b) {
      return floorExtraStars(b) > floorExtraStars(a) ? b : a;
    });
  }

  /* 2. 名字含「星启」 */
  const starMode = candidates.filter(function (floor) {
    return floor && String(floor.name || "").indexOf("星启") >= 0;
  });
  const pool = starMode.length ? starMode : candidates;

  /* 3. 按难度序号取最大（与数组顺序无关） */
  let best = null;
  let bestScore = -1;
  pool.forEach(function (floor) {
    const score = floorDifficulty(floor && floor.name);
    if (score > bestScore) {
      bestScore = score;
      best = floor;
    }
  });
  if (best && bestScore > 0) return best;

  /* 4. max_floor_id ↔ maze_id 精确匹配 */
  const maxId = Number(info && info.max_floor_id);
  if (isFinite(maxId) && maxId) {
    for (let i = 0; i < floors.length; i++) {
      if (Number(floors[i] && floors[i].maze_id) === maxId) return floors[i];
    }
  }

  /* 5. max_floor 名称归一化匹配（最深抵达） */
  const target = normalizeFloorName(info && info.max_floor);
  if (target) {
    for (let i = 0; i < floors.length; i++) {
      if (normalizeFloorName(floors[i] && floors[i].name) === target) return floors[i];
    }
  }

  /* 6. 兜底：接口按难度从高到低返回，取首项 */
  return floors[0];
}

function endgameNodes(floor) {
  return [floor && floor.node_1, floor && floor.node_2, floor && floor.node_3].filter(Boolean);
}

async function confirmAction(message) {
  try {
    const fn = Tapp.ui && Tapp.ui.confirm;
    return fn ? await fn(message) : false;
  } catch (err) {
    return false;
  }
}

async function ensureData() {
  const cache = await getCache();
  await loadAssets();
  if (cache) {
    const urls = collectAssetUrls(cache);
    const uncached = urls.filter(function (url) {
      return !(assetMemory && assetMemory.items && assetMemory.items[url]);
    });
    if (uncached.length > 0) {
      setTimeout(function () { scheduleAssetCache(cache); }, 0);
    }
  }
  return cache;
}

function renderEmpty(root, cache, hasDataOverride) {
  const empty = root.querySelector("[data-gt-w-empty]");
  if (!empty) return;
  const hasData = hasDataOverride !== undefined
    ? hasDataOverride
    : cache && (cache.playerIndex || cache.dailyNote);
  if (hasData) {
    empty.hidden = true;
    return;
  }
  empty.hidden = false;
  empty.textContent = cache ? t("widget.noData") : t("widget.waitAdmin");
}

const ui = {
  t: t,
  el: el,
  setText: setText,
  setImage: setImage,
  avatarNode: avatarNode,
  charTile: charTile,
  sortAvatars: sortAvatars,
  pickRole: pickRole,
  pickIndex: pickIndex,
  pickIndexAvatars: pickIndexAvatars,
  pickNote: pickNote,
  pickBbsUser: pickBbsUser,
  pickMoc: pickMoc,
  pickFiction: pickFiction,
  pickApocalyptic: pickApocalyptic,
  pickHeadIcon: pickHeadIcon,
  endgameFloors: endgameFloors,
  endgameLastFloor: endgameLastFloor,
  floorDisplayName: floorDisplayName,
  floorCompactName: floorCompactName,
  floorExtraStars: floorExtraStars,
  endgameNodes: endgameNodes,
  confirm: confirmAction,
  ensureData: ensureData,
  renderEmpty: renderEmpty,
};

module.exports = {
  ui: ui,
  CACHE_KEY: CACHE_KEY,
  AUTH_KEY: AUTH_KEY,
  MYS_VERSION: MYS_VERSION,
  CACHE_TTL: CACHE_TTL,
  ENDGAME_TTL: ENDGAME_TTL,
  md5: md5,
  dsApp: dsApp,
  dsWeb: dsWeb,
  dsPassport: dsPassport,
  randomHex: randomHex,
  randomStr: randomStr,
  sleep: sleep,
  getRole: getRole,
  readSettings: readSettings,
  saveSettings: saveSettings,
  resolveServer: resolveServer,
  serverLabelKey: serverLabelKey,
  parseDeviceInfo: parseDeviceInfo,
  getAuth: getAuth,
  setAuth: setAuth,
  clearAuth: clearAuth,
  loadAssets: loadAssets,
  resolveAsset: resolveAsset,
  roleAvatar: roleAvatar,
  headIcon: headIcon,
  testAvatar: testAvatar,
  noteWidgetProps: noteWidgetProps,
  resolveCharacterLink: resolveCharacterLink,
  openCharacter: openCharacter,
  formatTimestamp: formatTimestamp,
  formatChallengeTime: formatChallengeTime,
  formatMonthDay: formatMonthDay,
  getCache: getCache,
  setCache: setCache,
  clearCache: clearCache,
  maskCookie: maskCookie,
  cookieKeys: cookieKeys,
  cookieValue: cookieValue,
  debugRun: debugRun,
  copyText: copyText,
  refresh: refresh,
  verifyAuth: verifyAuth,
  loadData: loadData,
  startQrLogin: startQrLogin,
  cancelQrLogin: cancelQrLogin,
  triggerSync: triggerSync,
  syncTaskInfo: syncTaskInfo,
  SYNC_TASK_ID: SYNC_TASK_ID,
  SYNC_CRON: SYNC_CRON,
  isCacheStale: isCacheStale,
  SYNC_TTL: SYNC_TTL,
  buildCookie: buildCookie,
  formatDuration: formatDuration,
  elementColor: elementColor,
  endgameStars: endgameStars,
};

initScheduler();
