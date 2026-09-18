/**
 * 链接小窝 · 页面层
 * 只做可见 UI：搜索、筛选、收藏、管理员增删改、打开/复制链接。
 * 数据读写与 openUrl 匹配都在 core.js。
 */

const core = require("../core.js");

const FAVICON_SERVICE = "https://icon.horse/icon/";

const state = {
  role: "guest",
  links: [],
  favoriteSet: new Set(),
  openUrls: [],
  query: "",
  tag: "",
  view: "all",
  editingId: null,
  motion: true,
  iconDraft: "",
  iconOriginal: "",
  canRemote: false,
  fetchBusy: false,
};

const refs = {};
let toastTimer = 0;
let moodTimer = 0;
let reloadTimer = 0;

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

function iconOf(link) {
  if (link.icon) return link.icon;
  const title = link.title || link.url || "?";
  return title.trim().charAt(0).toUpperCase() || "☆";
}

function collectRefs() {
  const map = {
    app: "[data-ln-app]",
    mascot: "[data-ln-mascot]",
    roleBadge: "[data-ln-role-badge]",
    title: "[data-ln-title]",
    subtitle: "[data-ln-subtitle]",
    count: "[data-ln-count]",
    addBtn: "[data-action='add']",
    addText: "[data-ln-add-text]",
    search: "[data-ln-search]",
    searchClear: "[data-action='clear-search']",
    viewAll: "[data-ln-view-all]",
    viewFav: "[data-ln-view-fav]",
    chips: "[data-ln-chips]",
    list: "[data-ln-list]",
    empty: "[data-ln-empty]",
    emptyMascot: "[data-ln-empty-mascot]",
    emptyText: "[data-ln-empty-text]",
    footer: "[data-ln-footer]",
    dialog: "[data-ln-dialog]",
    form: "[data-ln-form]",
    dialogTitle: "[data-ln-dialog-title]",
    inputUrl: "[data-ln-input-url]",
    inputTitle: "[data-ln-input-title]",
    inputDesc: "[data-ln-input-desc]",
    inputIcon: "[data-ln-input-icon]",
    inputAudience: "[data-ln-input-audience]",
    inputTags: "[data-ln-input-tags]",
    inputPinned: "[data-ln-input-pinned]",
    urlHint: "[data-ln-url-hint]",
    iconPreview: "[data-ln-icon-preview]",
    iconPreviewImg: "[data-ln-icon-preview-img]",
    iconFallback: "[data-ln-icon-fallback]",
    iconFile: "[data-ln-icon-file]",
    iconHint: "[data-ln-icon-hint]",
    btnFetchIcon: "[data-ln-btn-fetch]",
    copyPanel: "[data-ln-copy-panel]",
    copyTitle: "[data-ln-copy-title]",
    copyInput: "[data-ln-copy-input]",
    toast: "[data-ln-toast]",
  };
  Object.keys(map).forEach(function (key) {
    refs[key] = document.querySelector(map[key]);
  });
}

function bindStaticText() {
  setText(refs.title, t("app.title"));
  setText(refs.subtitle, t("app.subtitle"));
  setText(refs.addText, t("app.add"));
  if (refs.search) {
    refs.search.placeholder = t("app.search");
    refs.search.setAttribute("aria-label", t("app.search"));
  }
  if (refs.subtitle) refs.subtitle.textContent = t("app.subtitle");
  setText(refs.viewAll, t("app.view.all"));
  setText(refs.viewFav, t("app.view.fav"));
  setText(refs.footer, t("app.footer"));
  setText(document.querySelector("[data-ln-label-url]"), t("app.field.url"));
  setText(document.querySelector("[data-ln-label-title]"), t("app.field.title"));
  setText(document.querySelector("[data-ln-label-desc]"), t("app.field.desc"));
  setText(document.querySelector("[data-ln-label-icon]"), t("app.field.icon"));
  setText(document.querySelector("[data-ln-label-icon-media]"), t("app.field.iconMedia"));
  setText(document.querySelector("[data-ln-btn-pick]"), t("app.icon.upload"));
  setText(document.querySelector("[data-ln-btn-fetch]"), t("app.icon.fetch"));
  setText(document.querySelector("[data-ln-btn-clear]"), t("app.icon.clear"));
  setText(document.querySelector("[data-ln-label-audience]"), t("app.field.audience"));
  setText(document.querySelector("[data-ln-label-tags]"), t("app.field.tags"));
  setText(document.querySelector("[data-ln-label-pinned]"), t("app.field.pinned"));
  setText(document.querySelector("[data-ln-opt-guest]"), t("app.audience.guest"));
  setText(document.querySelector("[data-ln-opt-user]"), t("app.audience.user"));
  setText(document.querySelector("[data-ln-opt-admin]"), t("app.audience.admin"));
  setText(document.querySelector("[data-ln-btn-cancel]"), t("app.cancel"));
  setText(document.querySelector("[data-ln-btn-save]"), t("app.save"));
  setText(document.querySelector("[data-ln-btn-close-copy]"), t("app.cancel"));
  setText(refs.copyTitle, t("app.copyTitle"));
}

function roleLabel() {
  if (state.role === "admin") return t("app.admin");
  if (state.role === "user") return t("app.member");
  return t("app.guest");
}

function setMood(mood) {
  if (!refs.mascot) return;
  refs.mascot.dataset.mood = mood || "idle";
  if (moodTimer) clearTimeout(moodTimer);
  if (mood && mood !== "idle") {
    moodTimer = setTimeout(function () {
      if (refs.mascot) refs.mascot.dataset.mood = "idle";
    }, 1800);
  }
}

function toast(text, mood) {
  if (!refs.toast) return;
  refs.toast.textContent = text;
  refs.toast.dataset.mood = mood || "idle";
  refs.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    if (refs.toast) refs.toast.hidden = true;
  }, 2400);
  if (mood) setMood(mood);
}

function visibleLinks() {
  let links = state.links.slice();
  if (state.view === "fav") {
    links = links.filter(function (link) {
      return state.favoriteSet.has(link.id);
    });
  }
  if (state.tag) {
    links = links.filter(function (link) {
      return link.tags.indexOf(state.tag) >= 0;
    });
  }
  const query = state.query.trim().toLowerCase();
  if (query) {
    links = links.filter(function (link) {
      const haystack = [link.title, link.url, link.desc].concat(link.tags).join(" ").toLowerCase();
      return haystack.indexOf(query) >= 0;
    });
  }
  return links;
}

function renderHeader() {
  setText(refs.roleBadge, roleLabel());
  if (refs.roleBadge) {
    refs.roleBadge.dataset.role = state.role;
  }
  const total = state.links.length;
  setText(refs.count, t("app.count", { count: total }));
  if (refs.addBtn) refs.addBtn.hidden = state.role !== "admin";
  if (refs.mascot) refs.mascot.dataset.crown = state.role === "admin" ? "true" : "false";
  if (refs.viewFav) {
    refs.viewFav.textContent = t("app.view.fav") + " (" + state.favoriteSet.size + ")";
  }
}

function renderChips() {
  if (!refs.chips) return;
  refs.chips.replaceChildren();
  const counts = {};
  state.links.forEach(function (link) {
    link.tags.forEach(function (tag) {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  const tags = Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a];
  });
  if (!tags.length) return;
  const allChip = el("button", "ln-chip is-active", t("app.filter.all"));
  allChip.type = "button";
  allChip.dataset.tag = "";
  if (state.tag) allChip.classList.remove("is-active");
  allChip.addEventListener("click", function () {
    state.tag = "";
    renderChips();
    renderList();
  });
  refs.chips.appendChild(allChip);
  tags.forEach(function (tag) {
    const chip = el("button", "ln-chip", tag + " " + counts[tag]);
    chip.type = "button";
    chip.dataset.tag = tag;
    if (state.tag === tag) chip.classList.add("is-active");
    chip.addEventListener("click", function () {
      state.tag = state.tag === tag ? "" : tag;
      renderChips();
      renderList();
    });
    refs.chips.appendChild(chip);
  });
}

function actionButton(className, action, label, aria) {
  const button = el("button", className, label);
  button.type = "button";
  button.dataset.action = action;
  if (aria || label) button.setAttribute("aria-label", aria || label);
  return button;
}

function createCard(link, index) {
  const card = el("article", "ln-card");
  card.dataset.id = link.id;
  card.style.setProperty("--ln-tilt", (((index % 5) - 2) * 0.55).toFixed(2) + "deg");
  card.style.animationDelay = Math.min(index, 12) * 32 + "ms";

  const badges = el("div", "ln-card-badges");
  if (link.pinned) badges.appendChild(el("span", "ln-badge ln-badge-pin", t("app.pinned")));
  if (link.audience === "user") badges.appendChild(el("span", "ln-badge ln-badge-user", t("app.badge.user")));
  if (link.audience === "admin") badges.appendChild(el("span", "ln-badge ln-badge-admin", t("app.badge.admin")));
  if (badges.childNodes.length) card.appendChild(badges);

  const main = el("button", "ln-card-main");
  main.type = "button";
  main.dataset.action = "open";
  let icon;
  if (link.iconData) {
    icon = document.createElement("img");
    icon.className = "ln-card-icon ln-card-icon-img";
    icon.src = link.iconData;
    icon.alt = "";
    icon.decoding = "async";
    icon.loading = "lazy";
  } else {
    icon = el("span", "ln-card-icon", iconOf(link));
  }
  const body = el("span", "ln-card-body");
  body.appendChild(el("span", "ln-card-title", link.title));
  body.appendChild(el("span", "ln-card-host", core.hostOf(link.url)));
  if (link.desc) body.appendChild(el("span", "ln-card-desc", link.desc));
  main.appendChild(icon);
  main.appendChild(body);
  card.appendChild(main);

  const foot = el("div", "ln-card-foot");
  const tags = el("div", "ln-card-tags");
  link.tags.slice(0, 4).forEach(function (tag) {
    tags.appendChild(el("span", "ln-tag", tag));
  });
  foot.appendChild(tags);

  const actions = el("div", "ln-card-actions");
  if (state.role !== "guest") {
    const favLabel = state.favoriteSet.has(link.id) ? "★" : "☆";
    const fav = actionButton("ln-star", "fav", favLabel, "favorite");
    fav.dataset.active = state.favoriteSet.has(link.id) ? "true" : "false";
    actions.appendChild(fav);
  }
  const target = core.resolveTarget(link.url, state.openUrls) || link.target;
  const openable = !!target;
  const copy = actionButton("ln-mini", "copy", t("app.copy"));
  if (!openable) {
    copy.classList.add("is-copy-only");
    actions.appendChild(actionButton("ln-mini", "search", t("app.search")));
  }
  actions.appendChild(copy);
  if (state.role === "admin") {
    actions.appendChild(actionButton("ln-mini", "edit", t("app.edit")));
    actions.appendChild(actionButton("ln-mini ln-mini-danger", "delete", t("app.delete")));
  }
  foot.appendChild(actions);
  card.appendChild(foot);
  return card;
}

function renderList() {
  if (!refs.list) return;
  const links = visibleLinks();
  refs.list.replaceChildren();
  links.forEach(function (link, index) {
    refs.list.appendChild(createCard(link, index));
  });

  const isEmpty = links.length === 0;
  if (refs.empty) refs.empty.hidden = !isEmpty;
  if (isEmpty) {
    let text = t("app.empty");
    let mascot = "(´･ω･`)";
    if (state.view === "fav") {
      text = t("app.emptyFav");
      mascot = "(๑•́ ₃ •̀๑)";
    } else if (state.query || state.tag) {
      text = t("app.emptySearch");
      mascot = "(・∀・)?";
    }
    setText(refs.emptyText, text);
    setText(refs.emptyMascot, mascot);
    setMood("sad");
  } else if (refs.mascot) {
    refs.mascot.dataset.mood = "idle";
  }
}

function renderAll() {
  renderHeader();
  renderChips();
  renderList();
}

async function reload(keepMood) {
  state.links = await core.loadLinks(state.role);
  const favorites = await core.loadFavorites();
  state.favoriteSet = new Set(favorites);
  renderAll();
  if (keepMood) setMood("happy");
}

function findLink(id) {
  for (let i = 0; i < state.links.length; i++) {
    if (state.links[i].id === id) return state.links[i];
  }
  return null;
}

async function handleOpen(link) {
  const result = await core.openLink(link, state.openUrls);
  if (result.opened) return;
  await handleSearch(link);
}

async function handleSearch(link) {
  const result = await core.openSearch(link.url);
  if (result.opened) return;
  toast(t("app.searchFail"), "sad");
  await handleCopy(link, true);
}

async function handleCopy(link, silent) {
  const ok = await core.copyText(link.url);
  if (ok) {
    if (!silent) toast(t("app.copied"), "happy");
    return;
  }
  const input = el("input", "ln-offscreen");
  input.value = link.url;
  input.setAttribute("readonly", "");
  document.body.appendChild(input);
  input.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (err) {
    copied = false;
  }
  input.remove();
  if (copied) {
    if (!silent) toast(t("app.copied"), "happy");
    return;
  }
  showCopyPanel(link.url);
}

function showCopyPanel(url) {
  if (!refs.copyPanel) return;
  if (refs.copyInput) {
    refs.copyInput.value = url;
    refs.copyInput.select();
  }
  refs.copyPanel.hidden = false;
}

async function handleFavorite(link) {
  if (state.role === "guest") {
    toast(t("app.fav.guestHint"), "sad");
    return;
  }
  try {
    const added = await core.toggleFavorite(link.id);
    if (added) {
      state.favoriteSet.add(link.id);
    } else {
      state.favoriteSet.delete(link.id);
    }
    renderHeader();
    renderList();
    toast(added ? t("app.fav.added") : t("app.fav.removed"), added ? "happy" : "idle");
  } catch (err) {
    toast(t("app.fav.guestHint"), "sad");
  }
}

function openDialog(link) {
  if (!refs.dialog) return;
  state.editingId = link ? link.id : null;
  state.iconDraft = link && link.iconData ? link.iconData : "";
  state.iconOriginal = state.iconDraft;
  setText(refs.dialogTitle, link ? t("app.edit") : t("app.addTitle"));
  refs.inputUrl.value = link ? link.url : "";
  refs.inputTitle.value = link ? link.title : "";
  refs.inputDesc.value = link ? link.desc : "";
  refs.inputIcon.value = link ? link.icon : "";
  refs.inputAudience.value = link ? link.audience : "guest";
  refs.inputTags.value = link ? link.tags.join(", ") : "";
  refs.inputPinned.checked = link ? link.pinned : false;
  updateUrlHint();
  renderIconPreview();
  updateIconHint("", "");
  refs.dialog.showModal();
  refs.inputUrl.focus();
}

function renderIconPreview() {
  if (!refs.iconPreview) return;
  const hasImage = !!state.iconDraft;
  if (refs.iconPreviewImg) {
    if (hasImage) {
      refs.iconPreviewImg.src = state.iconDraft;
      refs.iconPreviewImg.hidden = false;
    } else {
      refs.iconPreviewImg.removeAttribute("src");
      refs.iconPreviewImg.hidden = true;
    }
  }
  if (refs.iconFallback) {
    const emoji = refs.inputIcon && refs.inputIcon.value.trim() ? refs.inputIcon.value.trim() : "＋";
    refs.iconFallback.textContent = emoji;
    refs.iconFallback.hidden = hasImage;
  }
  refs.iconPreview.dataset.empty = hasImage ? "false" : "true";
  if (refs.btnFetchIcon) {
    refs.btnFetchIcon.hidden = !(state.role === "admin" && state.canRemote);
  }
}

function updateIconHint(text, stateName) {
  if (!refs.iconHint) return;
  setText(refs.iconHint, text || "");
  refs.iconHint.dataset.state = stateName || "";
}

function readFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ""));
    };
    reader.onerror = function () {
      reject(reader.error || new Error("READ_FAILED"));
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () {
      resolve(img);
    };
    img.onerror = function () {
      reject(new Error("IMAGE_LOAD_FAILED"));
    };
    img.src = src;
  });
}

function drawIcon(img, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  const width = img.naturalWidth || img.width || size;
  const height = img.naturalHeight || img.height || size;
  const scale = Math.max(size / width, size / height);
  const drawW = Math.max(1, Math.round(width * scale));
  const drawH = Math.max(1, Math.round(height * scale));
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, Math.round((size - drawW) / 2), Math.round((size - drawH) / 2), drawW, drawH);
  return canvas.toDataURL("image/png");
}

async function compressIcon(source, size) {
  const img = await loadImage(source);
  return drawIcon(img, size);
}

function loadCorsImage(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      reject(new Error("TIMEOUT"));
    }, timeoutMs || 9000);
    img.crossOrigin = "anonymous";
    img.onload = function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };
    img.src = url;
  });
}

function toIconDataUriFromImage(img) {
  let out = drawIcon(img, 64);
  if (out.length > core.MAX_ICON_BYTES) out = drawIcon(img, 48);
  if (out.length > core.MAX_ICON_BYTES) throw new Error("ICON_TOO_LARGE");
  return out;
}

async function fetchFaviconAuto() {
  if (state.fetchBusy || !state.canRemote || state.role !== "admin") return;
  if (!refs.dialog || !refs.dialog.open) return;
  const url = core.sanitizeUrl(refs.inputUrl ? refs.inputUrl.value : "");
  if (!url) return;
  const domain = core.hostOf(url);
  if (!domain) return;
  state.fetchBusy = true;
  updateIconHint(t("app.icon.fetching"), "");
  try {
    const img = await loadCorsImage(FAVICON_SERVICE + encodeURIComponent(domain), 9000);
    state.iconDraft = toIconDataUriFromImage(img);
    renderIconPreview();
    updateIconHint(t("app.icon.ready"), "ok");
  } catch (err) {
    updateIconHint(t("app.icon.fetchFail"), "warn");
  } finally {
    state.fetchBusy = false;
  }
}

async function toIconDataUri(source) {
  let out = await compressIcon(source, 64);
  if (out.length > core.MAX_ICON_BYTES) out = await compressIcon(source, 48);
  if (out.length > core.MAX_ICON_BYTES) throw new Error("ICON_TOO_LARGE");
  return out;
}

async function handlePickIconFile(file) {
  if (!file) return;
  updateIconHint(t("app.icon.processing"), "");
  try {
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error("BAD_TYPE");
    if (file.size > 256 * 1024) throw new Error("TOO_LARGE_RAW");
    const raw = await readFileAsDataUrl(file);
    state.iconDraft = await toIconDataUri(raw);
    renderIconPreview();
    updateIconHint(t("app.icon.ready"), "ok");
  } catch (err) {
    const code = err && err.message;
    const message = code === "BAD_TYPE" ? t("app.icon.badType") : t("app.icon.tooLarge");
    updateIconHint(message, "error");
  }
}

function handleClearIcon() {
  state.iconDraft = "";
  renderIconPreview();
  updateIconHint("", "");
}

async function persistIcon(link) {
  if (state.iconDraft === state.iconOriginal) return;
  if (state.iconDraft) {
    await core.removeIcon(link.id, state.role);
    await core.saveIcon(link.id, state.iconDraft, link.audience, state.role);
  } else if (state.iconOriginal) {
    await core.removeIcon(link.id, state.role);
  }
}

function closeDialog() {
  if (refs.dialog) refs.dialog.close();
  state.editingId = null;
}

function updateUrlHint() {
  if (!refs.urlHint || !refs.inputUrl) return;
  const value = refs.inputUrl.value.trim();
  if (!value) {
    setText(refs.urlHint, "");
    refs.urlHint.dataset.state = "";
    return;
  }
  const url = core.sanitizeUrl(value);
  if (!url) {
    setText(refs.urlHint, t("app.err.url"));
    refs.urlHint.dataset.state = "error";
    return;
  }
  const target = core.resolveTarget(url, state.openUrls);
  setText(refs.urlHint, target ? t("app.openable") : t("app.searchOnly"));
  refs.urlHint.dataset.state = target ? "ok" : "warn";
}

async function saveDialog() {
  const url = core.sanitizeUrl(refs.inputUrl.value);
  if (!url) {
    toast(t("app.err.url"), "sad");
    refs.inputUrl.focus();
    return;
  }
  const title = refs.inputTitle.value.trim() || core.hostOf(url) || url;
  const tags = refs.inputTags.value
    .split(/[,，]/)
    .map(function (tag) {
      return tag.trim();
    })
    .filter(Boolean)
    .slice(0, 8);
  const previous = state.editingId ? findLink(state.editingId) : null;
  const link = {
    id: previous ? previous.id : core.newLinkId(),
    url: url,
    title: title,
    target: core.resolveTarget(url, state.openUrls),
    icon: refs.inputIcon.value.trim().slice(0, 8),
    desc: refs.inputDesc.value.trim().slice(0, 300),
    tags: tags,
    audience: refs.inputAudience.value,
    pinned: refs.inputPinned.checked,
    order: previous ? previous.order : state.links.length * 10,
    addedAt: previous ? previous.addedAt : Date.now(),
    addedBy: previous ? previous.addedBy : "",
  };
  const next = state.links.filter(function (item) {
    return item.id !== link.id;
  });
  next.push(link);
  try {
    await core.saveLinks(next, state.role);
    await persistIcon(link);
    await core.pruneIcons(
      next.map(function (item) {
        return item.id;
      }),
      state.role,
    );
    closeDialog();
    await reload(false);
    toast(t("app.saved"), "happy");
  } catch (err) {
    const code = err && err.message;
    toast(code === "ICON_QUOTA" || code === "ICON_TOO_LARGE" ? t("app.icon.quota") : t("app.saveFail"), "sad");
  }
}

async function handleDelete(link) {
  let confirmed = false;
  try {
    confirmed = await Tapp.ui.confirm(t("app.confirmDelete", { title: link.title }));
  } catch (err) {
    confirmed = false;
  }
  if (!confirmed) return;
  const next = state.links.filter(function (item) {
    return item.id !== link.id;
  });
  try {
    await core.saveLinks(next, state.role);
    await core.removeIcon(link.id, state.role);
    await core.pruneIcons(
      next.map(function (item) {
        return item.id;
      }),
      state.role,
    );
    await reload(false);
    toast(t("app.deleted"), "sad");
  } catch (err) {
    toast(t("app.saveFail"), "sad");
  }
}

function bindEvents() {
  if (refs.search) {
    refs.search.addEventListener("input", function () {
      state.query = refs.search.value;
      if (refs.searchClear) refs.searchClear.hidden = !state.query;
      renderList();
    });
  }
  if (refs.viewAll) {
    refs.viewAll.addEventListener("click", function () {
      state.view = "all";
      refs.viewAll.classList.add("is-active");
      refs.viewAll.setAttribute("aria-selected", "true");
      if (refs.viewFav) {
        refs.viewFav.classList.remove("is-active");
        refs.viewFav.setAttribute("aria-selected", "false");
      }
      renderList();
    });
  }
  if (refs.viewFav) {
    refs.viewFav.addEventListener("click", function () {
      state.view = "fav";
      refs.viewFav.classList.add("is-active");
      refs.viewFav.setAttribute("aria-selected", "true");
      if (refs.viewAll) {
        refs.viewAll.classList.remove("is-active");
        refs.viewAll.setAttribute("aria-selected", "false");
      }
      renderList();
    });
  }
  if (refs.list) {
    refs.list.addEventListener("click", function (event) {
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode) return;
      const card = actionNode.closest(".ln-card");
      const link = card ? findLink(card.dataset.id) : null;
      if (!link) return;
      const action = actionNode.dataset.action;
      if (action === "open") {
        handleOpen(link);
      } else if (action === "copy") {
        handleCopy(link, false);
      } else if (action === "search") {
        handleSearch(link);
      } else if (action === "fav") {
        event.stopPropagation();
        handleFavorite(link);
      } else if (action === "edit") {
        openDialog(link);
      } else if (action === "delete") {
        handleDelete(link);
      }
    });
  }
  document.addEventListener("click", function (event) {
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    if (action === "add") {
      openDialog(null);
    } else if (action === "clear-search") {
      state.query = "";
      refs.search.value = "";
      refs.searchClear.hidden = true;
      renderList();
    } else if (action === "close-dialog") {
      closeDialog();
    } else if (action === "close-copy") {
      refs.copyPanel.hidden = true;
    } else if (action === "save-link") {
      saveDialog();
    } else if (action === "pick-icon") {
      if (refs.iconFile) refs.iconFile.click();
    } else if (action === "clear-icon") {
      handleClearIcon();
    } else if (action === "fetch-icon") {
      fetchFaviconAuto();
    }
  });
  if (refs.inputUrl) {
    refs.inputUrl.addEventListener("input", updateUrlHint);
    refs.inputUrl.addEventListener("blur", function () {
      if (!state.iconDraft) fetchFaviconAuto();
    });
  }
  if (refs.inputIcon) {
    refs.inputIcon.addEventListener("input", renderIconPreview);
  }
  if (refs.iconFile) {
    refs.iconFile.addEventListener("change", function () {
      const file = refs.iconFile.files && refs.iconFile.files[0];
      handlePickIconFile(file);
      refs.iconFile.value = "";
    });
  }
  if (refs.dialog) {
    refs.dialog.addEventListener("close", function () {
      state.editingId = null;
      state.iconDraft = "";
      state.iconOriginal = "";
    });
    refs.dialog.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      const target = event.target;
      if (!target || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
      event.preventDefault();
      saveDialog();
    });
  }
  if (refs.copyPanel) {
    refs.copyPanel.addEventListener("click", function (event) {
      if (event.target === refs.copyPanel) refs.copyPanel.hidden = true;
    });
  }
}

function bindDataSignals() {
  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function () {
      reload(false).catch(function () {});
    }, 250);
  }
  try {
    Tapp.storage.onChanged(function (event) {
      if (!event || !event.key || event.key === core.FAV_KEY) scheduleReload();
    });
  } catch (err) {
    /* ignore */
  }
  try {
    Tapp.shared.onChanged(scheduleReload);
  } catch (err) {
    /* ignore */
  }
  if (state.role === "admin") {
    try {
      Tapp.private.onChanged(scheduleReload);
    } catch (err) {
      /* ignore */
    }
  }
}

Tapp.lifecycle.onReady(async function () {
  collectRefs();
  state.role = await core.getRole();
  state.openUrls = await core.listOpenUrls();
  try {
    state.canRemote = Array.isArray(Tapp.permissions) && Tapp.permissions.indexOf("network:fetch") >= 0;
  } catch (err) {
    state.canRemote = false;
  }
  try {
    state.motion = (await Tapp.animation.getLevel()) !== "none";
  } catch (err) {
    state.motion = true;
  }
  if (!state.motion && refs.app) refs.app.classList.add("ln-motion-off");
  bindStaticText();
  bindEvents();
  bindDataSignals();
  await reload(false);
});
