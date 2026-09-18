/**
 * 链接小窝 · 共享层
 * 负责：角色识别、链接读取/合并/过滤、管理员保存、收藏、openUrl 目标解析。
 * 这一层不依赖可见 DOM，Page / Widget / headless 三种沙箱都会加载。
 */

const SHARED_KEY = "linknav.links.v1";
const PRIVATE_KEY = "linknav.links.v1";
const FAV_KEY = "linknav.favorites.v1";
const MAX_LINKS = 500;
const MAX_FAVORITES = 500;

const ROLE_RANK = { guest: 0, user: 1, admin: 2 };

async function getRole() {
  try {
    const role = await Tapp.user.getRole();
    if (role === "admin" || role === "user" || role === "guest") return role;
  } catch (err) {
    /* 角色读取失败时按最小权限处理 */
  }
  return "guest";
}

function rank(role) {
  return ROLE_RANK[role] != null ? ROLE_RANK[role] : 0;
}

function sanitizeUrl(input) {
  if (typeof input !== "string" || !input.trim()) return "";
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    url.hash = "";
    return url.href;
  } catch (err) {
    return "";
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (err) {
    return "";
  }
}

function normalizeAudience(value) {
  return value === "admin" || value === "user" ? value : "guest";
}

function normalizeTarget(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  const target = { id: raw.id };
  if (typeof raw.path === "string" && raw.path) target.path = raw.path;
  if (raw.query && typeof raw.query === "object" && !Array.isArray(raw.query)) {
    const query = {};
    Object.keys(raw.query).forEach(function (key) {
      const value = raw.query[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        query[key] = String(value);
      }
    });
    if (Object.keys(query).length) target.query = query;
  }
  return target;
}

function normalizeTags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(function (tag) {
      return typeof tag === "string" && tag.trim();
    })
    .map(function (tag) {
      return tag.trim().slice(0, 24);
    })
    .slice(0, 8);
}

function normalizeLink(raw, fallbackIndex) {
  if (!raw || typeof raw !== "object") return null;
  const url = sanitizeUrl(raw.url);
  if (!url) return null;
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : hostOf(url);
  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim().slice(0, 64)
        : "lk_" + Math.random().toString(36).slice(2, 10),
    title: title || url,
    url: url,
    target: normalizeTarget(raw.target),
    icon: typeof raw.icon === "string" ? raw.icon.trim().slice(0, 8) : "",
    desc: typeof raw.desc === "string" ? raw.desc.trim().slice(0, 300) : "",
    tags: normalizeTags(raw.tags),
    audience: normalizeAudience(raw.audience),
    pinned: raw.pinned === true,
    order: Number.isFinite(raw.order) ? raw.order : (fallbackIndex || 0) * 10,
    addedAt: Number.isFinite(raw.addedAt) ? raw.addedAt : Date.now(),
    addedBy: typeof raw.addedBy === "string" ? raw.addedBy.slice(0, 64) : "",
  };
}

function toStored(link) {
  return {
    id: link.id,
    title: link.title,
    url: link.url,
    target: link.target || null,
    icon: link.icon,
    desc: link.desc,
    tags: link.tags,
    audience: link.audience,
    pinned: link.pinned,
    order: link.order,
    addedAt: link.addedAt,
    addedBy: link.addedBy,
  };
}

async function readStore(store, key) {
  try {
    const raw = await store.get(key);
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.links)) return raw.links;
    return [];
  } catch (err) {
    return [];
  }
}

async function loadAllLinks(includePrivate) {
  const shared = await readStore(Tapp.shared, SHARED_KEY);
  let privateLinks = [];
  if (includePrivate) {
    try {
      privateLinks = await readStore(Tapp.private, PRIVATE_KEY);
    } catch (err) {
      privateLinks = [];
    }
  }
  const seen = {};
  const merged = [];
  shared.concat(privateLinks).forEach(function (raw, index) {
    const link = normalizeLink(raw, index);
    if (!link || seen[link.id]) return;
    seen[link.id] = true;
    merged.push(link);
  });
  return merged;
}

async function loadLinks(role) {
  const viewerRank = rank(role || (await getRole()));
  const all = await loadAllLinks(viewerRank >= ROLE_RANK.admin);
  return all
    .filter(function (link) {
      return rank(link.audience) <= viewerRank;
    })
    .sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return b.addedAt - a.addedAt;
    });
}

async function saveLinks(links, role) {
  if (role !== "admin") throw new Error("FORBIDDEN");
  const normalized = [];
  const seen = {};
  (Array.isArray(links) ? links : []).forEach(function (raw, index) {
    const link = normalizeLink(raw, index);
    if (!link || seen[link.id]) return;
    seen[link.id] = true;
    normalized.push(link);
  });
  const limited = normalized.slice(0, MAX_LINKS);
  const shared = limited.filter(function (link) {
    return link.audience !== "admin";
  });
  const privateLinks = limited.filter(function (link) {
    return link.audience === "admin";
  });
  await Tapp.shared.set(SHARED_KEY, { v: 1, links: shared.map(toStored) });
  await Tapp.private.set(PRIVATE_KEY, { v: 1, links: privateLinks.map(toStored) });
  return limited;
}

async function loadFavorites() {
  try {
    const raw = await Tapp.storage.get(FAV_KEY);
    const ids = Array.isArray(raw) ? raw : raw && Array.isArray(raw.ids) ? raw.ids : [];
    return ids.filter(function (id) {
      return typeof id === "string" && id;
    });
  } catch (err) {
    return [];
  }
}

async function saveFavorites(ids) {
  const clean = (Array.isArray(ids) ? ids : [])
    .filter(function (id) {
      return typeof id === "string" && id;
    })
    .slice(0, MAX_FAVORITES);
  await Tapp.storage.set(FAV_KEY, clean);
  return clean;
}

async function toggleFavorite(id) {
  const ids = await loadFavorites();
  const index = ids.indexOf(id);
  let added = false;
  if (index >= 0) {
    ids.splice(index, 1);
  } else {
    ids.push(id);
    added = true;
  }
  await saveFavorites(ids);
  return added;
}

async function listOpenUrls() {
  try {
    const list = await Tapp.ui.listOpenUrls();
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function parseUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch (err) {
    return null;
  }
}

function relativePath(pathname) {
  return String(pathname || "").replace(/^\/+/, "");
}

function queryOf(url) {
  const query = {};
  try {
    new URLSearchParams(url.search).forEach(function (value, key) {
      query[key] = value;
    });
  } catch (err) {
    return undefined;
  }
  return Object.keys(query).length ? query : undefined;
}

function isPrefix(url, base) {
  if (url.origin !== base.origin) return false;
  const basePath = base.pathname;
  if (basePath === "" || basePath === "/") return true;
  if (basePath.charAt(basePath.length - 1) === "/") return url.pathname.indexOf(basePath) === 0;
  return url.pathname === basePath || url.pathname.indexOf(basePath + "/") === 0;
}

/**
 * 把完整 URL 解析成 Tapp.ui.openUrl 的 {id, path?, query?}。
 * 只使用 Manifest 声明过的 openUrls 条目；没有命中返回 null（调用方降级为复制）。
 */
function resolveTarget(rawUrl, entries) {
  const url = parseUrl(rawUrl);
  if (!url) return null;
  let prefixMatch = null;
  let prefixLength = -1;
  let originMatch = null;
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    if (!entry || typeof entry.id !== "string" || !entry.id || typeof entry.url !== "string") continue;
    const base = parseUrl(entry.url);
    if (!base) continue;
    const match = entry.match === "prefix" || entry.match === "origin" ? entry.match : "exact";
    if (match === "exact") {
      if (url.href === base.href) {
        return { id: entry.id };
      }
      continue;
    }
    if (url.origin !== base.origin) continue;
    if (match === "origin") {
      if (!originMatch) {
        originMatch = { id: entry.id, path: relativePath(url.pathname), query: queryOf(url) };
      }
      continue;
    }
    if (isPrefix(url, base) && base.pathname.length > prefixLength) {
      const rest = url.pathname.slice(base.pathname.replace(/\/$/, "").length);
      prefixMatch = { id: entry.id, path: relativePath(rest), query: queryOf(url) };
      prefixLength = base.pathname.length;
    }
  }
  return prefixMatch || originMatch;
}

function toPayload(target) {
  const payload = { id: target.id };
  if (target.path) payload.path = target.path;
  if (target.query && Object.keys(target.query).length) payload.query = target.query;
  return payload;
}

/**
 * 打开链接；命中白名单走宿主 openUrl，未命中返回 {opened:false}。
 */
async function openLink(link, entries) {
  const target = resolveTarget(link && link.url, entries) || normalizeTarget(link && link.target);
  if (!target) return { opened: false, reason: "no-target" };
  try {
    await Tapp.ui.openUrl(toPayload(target));
    return { opened: true, target: target };
  } catch (err) {
    const stored = normalizeTarget(link && link.target);
    if (stored && stored.id !== target.id) {
      try {
        await Tapp.ui.openUrl(toPayload(stored));
        return { opened: true, target: stored };
      } catch (err2) {
        return { opened: false, reason: "open-failed" };
      }
    }
    return { opened: false, reason: "open-failed" };
  }
}

async function copyText(text) {
  if (typeof text !== "string" || !text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    /* 剪贴板不可用时由调用方降级 */
  }
  return false;
}

function newLinkId() {
  return "lk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = {
  SHARED_KEY: SHARED_KEY,
  PRIVATE_KEY: PRIVATE_KEY,
  FAV_KEY: FAV_KEY,
  MAX_LINKS: MAX_LINKS,
  getRole: getRole,
  rank: rank,
  sanitizeUrl: sanitizeUrl,
  hostOf: hostOf,
  loadAllLinks: loadAllLinks,
  loadLinks: loadLinks,
  saveLinks: saveLinks,
  loadFavorites: loadFavorites,
  saveFavorites: saveFavorites,
  toggleFavorite: toggleFavorite,
  listOpenUrls: listOpenUrls,
  resolveTarget: resolveTarget,
  openLink: openLink,
  copyText: copyText,
  newLinkId: newLinkId,
};
