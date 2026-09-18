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
  ioMode: "export",
  ioFormat: "json",
  ioIncludeIcons: false,
  importRows: [],
  importFilter: "all",
  importBusy: false,
  importDefaultAudience: "guest",
  importDedupe: "skip",
  importFetchIcons: false,
  importFormat: "auto",
  importTotal: 0,
  importDone: 0,
  importResult: "",
  importResultState: "done",
};

const IMPORT_SAMPLES = {
  json:
    '{\n  "app": "io.github.xingjianya-86.linknav",\n  "schema": 1,\n  "links": [\n    { "title": "GitHub", "url": "https://github.com", "icon": "🐙", "tags": ["开发"], "audience": "guest", "pinned": true },\n    { "title": "MDN", "url": "https://developer.mozilla.org", "tags": ["文档"], "audience": "user" }\n  ]\n}\n',
  text:
    "GitHub https://github.com #开发 #工具\nhttps://developer.mozilla.org MDN #文档\nhttps://www.bilibili.com\n// 以 // 开头的行是注释\n",
  csv:
    "标题,网址,备注,标签,可见性,置顶,图标\nGitHub,https://github.com,代码托管,开发,guest,1,🐙\nMDN,https://developer.mozilla.org,文档,文档|前端,user,,\n",
};

const refs = {};
let toastTimer = 0;
let moodTimer = 0;
let reloadTimer = 0;
let parseTimer = 0;
let parseFlashTimer = 0;

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
    ioBtn: "[data-action='io-open']",
    ioText: "[data-ln-io-text]",
    ioDialog: "[data-ln-io-dialog]",
    ioTitle: "[data-ln-io-title]",
    ioPanelExport: "[data-ln-io-panel-export]",
    ioPanelImport: "[data-ln-io-panel-import]",
    ioFavOption: "[data-ln-io-fav-option]",
    ioIncludeIcons: "[data-ln-io-include-icons]",
    ioExportHint: "[data-ln-io-export-hint]",
    ioDrop: "[data-ln-io-drop]",
    ioFile: "[data-ln-io-file]",
    ioPaste: "[data-ln-io-paste]",
    ioDefaultAudience: "[data-ln-io-default-audience]",
    ioImportFormat: "[data-ln-io-import-format]",
    ioFetchIcons: "[data-ln-io-fetch-icons]",
    ioImportHint: "[data-ln-io-import-hint]",
    ioPreviewState: "[data-ln-io-preview-state]",
    ioStatus: "[data-ln-io-status]",
    ioStatusText: "[data-ln-io-status-text]",
    ioStatusTrack: "[data-ln-io-status-track]",
    ioStatusFill: "[data-ln-io-status-fill]",
    ioFilters: "[data-ln-io-filters]",
    ioList: "[data-ln-io-list]",
    ioSelectAll: "[data-ln-io-select-all]",
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
  renderFooter();
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
  setText(refs.ioText, t("app.io.open"));
  setText(refs.ioTitle, t("app.io.title"));
  setText(document.querySelector("[data-ln-io-tab-export]"), t("app.io.tab.export"));
  setText(document.querySelector("[data-ln-io-tab-import]"), t("app.io.tab.import"));
  setText(document.querySelector("[data-ln-io-title-export-format]"), t("app.io.export.format"));
  setText(document.querySelector("[data-ln-io-title-export-info]"), t("app.io.card.exportInfo"));
  setText(document.querySelector("[data-ln-io-title-source]"), t("app.io.card.source"));
  setText(document.querySelector("[data-ln-io-title-import-settings]"), t("app.io.card.importSettings"));
  setText(document.querySelector("[data-ln-io-title-preview]"), t("app.io.card.preview"));
  renderPreviewState("idle", t("app.io.preview.waiting"));
  setText(document.querySelector("[data-ln-io-fmt-json]"), t("app.io.export.json"));
  setText(document.querySelector("[data-ln-io-fmt-text]"), t("app.io.export.text"));
  setText(document.querySelector("[data-ln-io-fmt-csv]"), t("app.io.export.csv"));
  setText(document.querySelector("[data-ln-io-fmt-fav]"), t("app.io.export.favorites"));
  setText(document.querySelector("[data-ln-io-fmt-json-desc]"), t("app.io.export.jsonDesc"));
  setText(document.querySelector("[data-ln-io-fmt-text-desc]"), t("app.io.export.textDesc"));
  setText(document.querySelector("[data-ln-io-fmt-csv-desc]"), t("app.io.export.csvDesc"));
  setText(document.querySelector("[data-ln-io-fmt-fav-desc]"), t("app.io.export.favoritesDesc"));
  setText(document.querySelector("[data-ln-io-label-include-icons]"), t("app.io.export.includeIcons"));
  setText(document.querySelector("[data-ln-io-btn-copy]"), t("app.io.export.copy"));
  setText(document.querySelector("[data-ln-io-btn-download]"), t("app.io.export.download"));
  setText(document.querySelector("[data-ln-io-drop-text]"), t("app.io.import.drop"));
  setText(document.querySelector("[data-ln-io-btn-pick]"), t("app.io.import.pick"));
  setText(document.querySelector("[data-ln-io-btn-clear]"), t("app.io.import.clear"));
  setText(document.querySelector("[data-ln-io-btn-parse]"), t("app.io.import.parse"));
  setText(document.querySelector("[data-ln-io-label-default-audience]"), t("app.io.import.defaultAudience"));
  setText(document.querySelector("[data-ln-io-opt-guest]"), t("app.audience.guest"));
  setText(document.querySelector("[data-ln-io-opt-user]"), t("app.audience.user"));
  setText(document.querySelector("[data-ln-io-opt-admin]"), t("app.audience.admin"));
  setText(document.querySelector("[data-ln-io-dedupe-skip]"), t("app.io.import.dedupeSkip"));
  setText(document.querySelector("[data-ln-io-dedupe-overwrite]"), t("app.io.import.dedupeOverwrite"));
  setText(document.querySelector("[data-ln-io-label-fetch-icons]"), t("app.io.import.fetchIcons"));
  setText(document.querySelector("[data-ln-io-btn-reset]"), t("app.io.import.reset"));
  setText(document.querySelector("[data-ln-io-btn-import]"), t("app.io.import.run"));
  setText(document.querySelector("[data-ln-io-label-import-format]"), t("app.io.import.format"));
  setText(document.querySelector("[data-ln-io-ifmt-auto]"), t("app.io.import.format.auto"));
  setText(document.querySelector("[data-ln-io-ifmt-json]"), t("app.io.import.format.json"));
  setText(document.querySelector("[data-ln-io-ifmt-text]"), t("app.io.import.format.text"));
  setText(document.querySelector("[data-ln-io-ifmt-html]"), t("app.io.import.format.html"));
  setText(document.querySelector("[data-ln-io-ifmt-csv]"), t("app.io.import.format.csv"));
  setText(document.querySelector("[data-ln-io-sample-json]"), t("app.io.import.sampleJson"));
  setText(document.querySelector("[data-ln-io-sample-text]"), t("app.io.import.sampleText"));
  setText(document.querySelector("[data-ln-io-sample-csv]"), t("app.io.import.sampleCsv"));
  setText(document.querySelector("[data-ln-io-template]"), t("app.io.import.template"));
  if (refs.ioPaste) refs.ioPaste.placeholder = t("app.io.import.pastePlaceholder");
  setText(document.querySelector("[data-ln-io-note]"), t("app.io.import.note"));
}

function renderFooter() {
  let suffix = "";
  try {
    const info = Tapp.lifecycle && typeof Tapp.lifecycle.getInfo === "function" ? Tapp.lifecycle.getInfo() : null;
    if (info && typeof info.version === "string" && info.version) suffix = " · v" + info.version;
  } catch (err) {
    suffix = "";
  }
  setText(refs.footer, t("app.footer") + suffix);
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

function topLayerContainer() {
  if (refs.ioDialog && refs.ioDialog.open) return refs.ioDialog;
  if (refs.dialog && refs.dialog.open) return refs.dialog;
  return document.body;
}

function moveOverlay(node) {
  if (!node) return;
  const host = topLayerContainer();
  if (node.parentElement !== host) host.appendChild(node);
}

function returnOverlay(node) {
  if (node && node.parentElement !== document.body) document.body.appendChild(node);
}

function toast(text, mood) {
  if (!refs.toast) return;
  moveOverlay(refs.toast);
  refs.toast.textContent = text;
  refs.toast.dataset.mood = mood || "idle";
  refs.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    if (refs.toast) {
      refs.toast.hidden = true;
      returnOverlay(refs.toast);
    }
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
  if (refs.ioBtn) refs.ioBtn.hidden = state.role !== "admin";
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
  moveOverlay(refs.copyPanel);
  if (refs.copyInput) {
    refs.copyInput.value = url;
    refs.copyInput.select();
  }
  refs.copyPanel.hidden = false;
}

function hideCopyPanel() {
  if (!refs.copyPanel) return;
  refs.copyPanel.hidden = true;
  returnOverlay(refs.copyPanel);
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

/* ---------- 批量导入 / 导出 ---------- */

function ioStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseImportJson(text) {
  const data = JSON.parse(text);
  let rawLinks = [];
  let icons = {};
  if (Array.isArray(data)) {
    rawLinks = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.links)) rawLinks = data.links;
    else if (Array.isArray(data.apps)) rawLinks = data.apps;
    if (data.icons && typeof data.icons === "object" && !Array.isArray(data.icons)) icons = data.icons;
  }
  return rawLinks.map(function (raw) {
    const url = raw && typeof raw.url === "string" ? core.sanitizeUrl(raw.url) : "";
    const iconData = url && typeof icons[url] === "string" ? icons[url] : "";
    return { raw: raw, iconData: core.isIconDataUri(iconData) ? iconData : "" };
  });
}

function parseCsvImport(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const header = rows[0].map(function (cell) {
    return String(cell || "").trim().toLowerCase();
  });
  function column(names) {
    for (let i = 0; i < names.length; i++) {
      const index = header.indexOf(names[i]);
      if (index >= 0) return index;
    }
    return -1;
  }
  const iTitle = column(["标题", "title", "name"]);
  const iUrl = column(["网址", "url", "link", "地址"]);
  const iDesc = column(["备注", "desc", "description", "描述"]);
  const iTags = column(["标签", "tags"]);
  const iAudience = column(["可见性", "audience", "visibility"]);
  const iPinned = column(["置顶", "pinned"]);
  const iIcon = column(["图标", "icon", "emoji"]);
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.some(function (cell) {
      return String(cell || "").trim();
    })) {
      continue;
    }
    function cell(index) {
      return index >= 0 && row[index] != null ? String(row[index]).trim() : "";
    }
    out.push({
      raw: {
        title: cell(iTitle),
        url: iUrl >= 0 ? cell(iUrl) : String(row[0] || "").trim(),
        desc: cell(iDesc),
        tags: iTags >= 0 ? cell(iTags).split(/[|,，]/) : [],
        audience: cell(iAudience),
        pinned: iPinned >= 0 ? /^(1|true|yes|y|是|置顶)$/i.test(cell(iPinned)) : false,
        icon: cell(iIcon),
      },
    });
  }
  return out;
}

function parseBookmarksImport(text) {
  const doc = new DOMParser().parseFromString(String(text || ""), "text/html");
  const nodes = doc.querySelectorAll("a[href]");
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const anchor = nodes[i];
    out.push({
      raw: {
        title: String(anchor.textContent || "").trim(),
        url: anchor.getAttribute("href") || "",
      },
    });
  }
  return out;
}

function parseUrlText(text) {
  const out = [];
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  lines.forEach(function (line) {
    const raw = line.trim();
    if (!raw || raw.indexOf("//") === 0) return;
    let rest = raw;
    const tags = [];
    const tagMatch = rest.match(/(\s+#[^\s#]+)+\s*$/);
    if (tagMatch) {
      tagMatch[0].trim().split(/\s+/).forEach(function (token) {
        tags.push(token.replace(/^#/, ""));
      });
      rest = rest.slice(0, rest.length - tagMatch[0].length).trim();
    }
    const tokens = rest.split(/\s+/).filter(Boolean);
    let urlIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (/^https?:\/\//i.test(tokens[i])) {
        urlIndex = i;
        break;
      }
    }
    if (urlIndex < 0) {
      out.push({ raw: { title: "", url: "", tags: tags }, invalid: true });
      return;
    }
    const url = tokens[urlIndex].replace(/[)\]}>，。；;]+$/, "");
    const title = tokens.filter(function (_, i) {
      return i !== urlIndex;
    }).join(" ").trim();
    out.push({ raw: { title: title, url: url, tags: tags } });
  });
  return out;
}

function autoDetectParse(text, filename) {
  const name = String(filename || "").toLowerCase();
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  if (name.slice(-5) === ".json" || trimmed.charAt(0) === "[" || trimmed.charAt(0) === "{") {
    try {
      return parseImportJson(trimmed);
    } catch (err) {
      return null;
    }
  }
  if (name.slice(-4) === ".csv") return parseCsvImport(text);
  if (name.slice(-5) === ".html" || name.slice(-4) === ".htm" || /<a[\s>]/i.test(trimmed)) {
    return parseBookmarksImport(text);
  }
  return parseUrlText(text);
}

function detectAndParse(text, filename) {
  const forced = state.importFormat;
  if (forced === "json") {
    try {
      const parsed = parseImportJson(String(text || "").trim());
      if (parsed && parsed.length) return parsed;
    } catch (err) {
      /* 交给自动识别兜底 */
    }
    return autoDetectParse(text, filename);
  }
  if (forced === "csv") {
    const parsed = parseCsvImport(text);
    if (parsed && parsed.length) return parsed;
    return autoDetectParse(text, filename);
  }
  if (forced === "html") {
    const parsed = parseBookmarksImport(text);
    if (parsed && parsed.length) return parsed;
    return autoDetectParse(text, filename);
  }
  if (forced === "text") return parseUrlText(text);
  return autoDetectParse(text, filename);
}

function buildImportRows(parsed) {
  const existing = {};
  state.links.forEach(function (link) {
    const key = core.sanitizeUrl(link.url) || link.url;
    existing[key] = link;
  });
  const seen = {};
  const rows = [];
  (parsed || []).forEach(function (item, index) {
    const raw = item && item.raw ? item.raw : {};
    const iconData = item && item.iconData ? item.iconData : "";
    const link = core.normalizeLink(
      {
        title: raw.title,
        url: raw.url,
        icon: raw.icon,
        desc: raw.desc,
        tags: raw.tags,
        audience: raw.audience || state.importDefaultAudience,
        pinned: raw.pinned === true,
      },
      index,
    );
    if (!link) {
      rows.push({
        key: "bad_" + index + "_" + rows.length,
        invalid: true,
        checked: false,
        status: "invalid",
        title: String(raw.title || "").slice(0, 80),
        url: String(raw.url || "").slice(0, 200),
        tags: [],
        audience: state.importDefaultAudience,
        icon: "",
        iconData: "",
        pinned: false,
        message: t("app.io.import.noteInvalid"),
      });
      return;
    }
    const key = core.sanitizeUrl(link.url) || link.url;
    const duplicate = !!existing[key] || !!seen[key];
    seen[key] = true;
    rows.push({
      key: key + "#" + index,
      invalid: false,
      checked: !duplicate,
      status: duplicate ? "duplicate" : "new",
      title: link.title,
      url: link.url,
      tags: link.tags,
      audience: link.audience,
      icon: link.icon,
      iconData: core.isIconDataUri(iconData) ? iconData : "",
      pinned: link.pinned,
      message: duplicate ? t("app.io.import.noteDuplicate") : "",
    });
  });
  return rows;
}

function importCounts() {
  const counts = { all: state.importRows.length, new: 0, duplicate: 0, invalid: 0, checked: 0 };
  state.importRows.forEach(function (row) {
    if (row.status === "invalid") counts.invalid += 1;
    else if (row.status === "duplicate" || row.status === "skipped") counts.duplicate += 1;
    else counts.new += 1;
    if (row.checked && !row.invalid) counts.checked += 1;
  });
  return counts;
}

function importRowVisible(row) {
  if (state.importFilter === "all") return true;
  if (state.importFilter === "invalid") return row.status === "invalid";
  if (state.importFilter === "duplicate") return row.status === "duplicate" || row.status === "skipped";
  return row.status === "new" || row.status === "imported" || row.status === "fetched";
}

function importStatusLabel(row) {
  if (row.status === "invalid") return t("app.io.import.statusInvalid");
  if (row.status === "duplicate") return t("app.io.import.statusDuplicate");
  if (row.status === "skipped") return t("app.io.import.statusSkipped");
  if (row.status === "imported") return t("app.io.import.statusImported");
  if (row.status === "fetched") return t("app.io.import.statusFetched");
  return t("app.io.import.statusNew");
}

function createImportRow(row) {
  const rowEl = el("div", "ln-io-row");
  rowEl.dataset.key = row.key;
  if (row.invalid) rowEl.classList.add("is-invalid");
  else if (row.status === "duplicate" || row.status === "skipped") rowEl.classList.add("is-duplicate");
  else if (row.status === "imported" || row.status === "fetched") rowEl.classList.add("is-done");

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = !row.invalid && row.checked;
  check.disabled = row.invalid || state.importBusy;
  check.setAttribute("aria-label", row.title || row.url || "link");
  check.addEventListener("change", function () {
    row.checked = check.checked;
    renderImportStatus();
  });
  rowEl.appendChild(check);

  let icon;
  if (row.iconData) {
    icon = document.createElement("img");
    icon.className = "ln-io-row-icon";
    icon.src = row.iconData;
    icon.alt = "";
    icon.decoding = "async";
  } else {
    icon = el("span", "ln-io-row-icon ln-io-row-icon-text");
    icon.textContent = row.icon || (row.title ? row.title.trim().charAt(0).toUpperCase() : "☆");
  }
  rowEl.appendChild(icon);

  const main = el("div", "ln-io-row-main");
  main.appendChild(el("span", "ln-io-row-title", row.title || row.url || ""));
  main.appendChild(el("span", "ln-io-row-host", row.url ? core.hostOf(row.url) || row.url : ""));
  if (row.message) main.appendChild(el("span", "ln-io-row-msg", row.message));
  rowEl.appendChild(main);

  const select = document.createElement("select");
  select.className = "ln-io-row-audience";
  select.disabled = row.invalid || state.importBusy;
  select.setAttribute("aria-label", t("app.field.audience"));
  [
    ["guest", t("app.audience.guest")],
    ["user", t("app.audience.user")],
    ["admin", t("app.audience.admin")],
  ].forEach(function (pair) {
    const option = document.createElement("option");
    option.value = pair[0];
    option.textContent = pair[1];
    select.appendChild(option);
  });
  select.value = row.audience;
  select.addEventListener("change", function () {
    row.audience = select.value;
  });
  rowEl.appendChild(select);

  rowEl.appendChild(el("span", "ln-io-badge", importStatusLabel(row)));
  return rowEl;
}

function renderImportStatus() {
  if (!refs.ioStatus) return;
  let text = "";
  let stateName = "idle";
  let progress = -1;
  if (state.importBusy) {
    stateName = "run";
    text = t("app.io.import.progress", { done: state.importDone, total: state.importTotal });
    progress = state.importTotal ? Math.min(100, Math.round((state.importDone / state.importTotal) * 100)) : 0;
  } else if (state.importResult) {
    stateName = state.importResultState || "done";
    text = state.importResult;
  } else {
    const counts = importCounts();
    text = t("app.io.import.summary", {
      total: counts.all,
      checked: counts.checked,
      duplicate: counts.duplicate,
      invalid: counts.invalid,
    });
    stateName = counts.invalid ? "warn" : "idle";
  }
  refs.ioStatus.dataset.state = stateName;
  setText(refs.ioStatusText, text);
  if (refs.ioStatusTrack && refs.ioStatusFill) {
    if (progress >= 0) {
      refs.ioStatusTrack.hidden = false;
      refs.ioStatusFill.style.width = progress + "%";
    } else {
      refs.ioStatusTrack.hidden = true;
      refs.ioStatusFill.style.width = "0%";
    }
  }
}

function flashParseButton(label) {
  const btn = document.querySelector("[data-ln-io-btn-parse]");
  if (!btn) return;
  if (parseFlashTimer) clearTimeout(parseFlashTimer);
  btn.textContent = label;
  parseFlashTimer = setTimeout(function () {
    btn.textContent = t("app.io.import.parse");
  }, 1800);
}

function renderPreviewState(kind, text) {
  if (!refs.ioPreviewState) return;
  refs.ioPreviewState.textContent = text || "";
  refs.ioPreviewState.dataset.state = kind || "idle";
}

function autoGrowPaste() {
  if (!refs.ioPaste) return;
  refs.ioPaste.style.height = "auto";
  const next = Math.min(refs.ioPaste.scrollHeight || 0, 140);
  refs.ioPaste.style.height = next + "px";
}

function setImportLock(locked) {
  const importBtn = document.querySelector("[data-ln-io-btn-import]");
  const resetBtn = document.querySelector("[data-ln-io-btn-reset]");
  const parseBtn = document.querySelector("[data-ln-io-btn-parse]");
  const closeBtn = document.querySelector("[data-action='close-io']");
  if (importBtn) {
    importBtn.disabled = locked;
    setText(importBtn, locked ? t("app.io.import.running") : t("app.io.import.run"));
  }
  if (resetBtn) resetBtn.disabled = locked;
  if (parseBtn) parseBtn.disabled = locked;
  if (closeBtn) closeBtn.disabled = locked;
}

function renderImportFilters() {
  if (!refs.ioFilters) return;
  refs.ioFilters.replaceChildren();
  const counts = importCounts();
  [
    ["all", t("app.io.import.filterAll"), counts.all],
    ["new", t("app.io.import.filterNew"), counts.new],
    ["duplicate", t("app.io.import.filterDuplicate"), counts.duplicate],
    ["invalid", t("app.io.import.filterInvalid"), counts.invalid],
  ].forEach(function (def) {
    const chip = el("button", "ln-chip", def[1] + " " + def[2]);
    chip.type = "button";
    if (state.importFilter === def[0]) chip.classList.add("is-active");
    chip.addEventListener("click", function () {
      state.importFilter = def[0];
      renderImportList();
    });
    refs.ioFilters.appendChild(chip);
  });
}

function renderImportList() {
  if (!refs.ioList) return;
  renderImportFilters();
  refs.ioList.replaceChildren();
  const visible = state.importRows.filter(importRowVisible);
  visible.forEach(function (row) {
    refs.ioList.appendChild(createImportRow(row));
  });
  if (!visible.length) {
    refs.ioList.appendChild(el("p", "ln-io-empty", t("app.io.import.pastePlaceholder")));
  }
  if (refs.ioSelectAll) {
    const allChecked = visible.length > 0 && visible.every(function (row) {
      return row.invalid || row.checked;
    });
    setText(refs.ioSelectAll, allChecked ? t("app.io.import.deselectAll") : t("app.io.import.selectAll"));
  }
  renderImportStatus();
}

function handleImportParse(text, filename) {
  try {
    const source = String(text == null ? "" : text);
    if (!filename && !source.trim()) {
      renderPreviewState("warn", t("app.io.import.emptySource"));
      if (refs.ioImportHint) {
        setText(refs.ioImportHint, t("app.io.import.emptySource"));
        refs.ioImportHint.dataset.state = "warn";
      }
      flashParseButton(t("app.io.import.parseNone"));
      toast(t("app.io.import.emptySource"), "sad");
      return;
    }
    const parsed = detectAndParse(source, filename);
    if (!parsed) {
      renderPreviewState("error", t("app.io.preview.error"));
      if (refs.ioImportHint) {
        setText(refs.ioImportHint, t("app.io.import.jsonFail"));
        refs.ioImportHint.dataset.state = "error";
      }
      flashParseButton(t("app.io.import.parseNone"));
      toast(t("app.io.import.jsonFail"), "sad");
      return;
    }
    const rows = buildImportRows(parsed);
    if (!rows.length) {
      state.importRows = [];
      state.importFilter = "all";
      state.importResult = "";
      renderPreviewState("warn", t("app.io.preview.none"));
      if (refs.ioImportHint) {
        setText(refs.ioImportHint, t("app.io.import.noRows"));
        refs.ioImportHint.dataset.state = "warn";
      }
      renderImportList();
      flashParseButton(t("app.io.import.parseNone"));
      toast(t("app.io.import.noRows"), "sad");
      return;
    }
    state.importRows = rows;
    state.importFilter = "all";
    state.importResult = "";
    if (refs.ioImportHint) {
      setText(refs.ioImportHint, "");
      refs.ioImportHint.dataset.state = "";
    }
    renderPreviewState("ok", t("app.io.preview.parsed", { count: rows.length }));
    renderImportList();
    if (refs.ioList) refs.ioList.scrollIntoView({ block: "nearest" });
    flashParseButton(t("app.io.import.parseOk", { count: rows.length }));
    toast(t("app.io.import.parsed", { count: rows.length }), "happy");
  } catch (err) {
    const detail = err && err.message ? "：" + err.message : "";
    renderPreviewState("error", t("app.io.preview.error") + detail);
    flashParseButton(t("app.io.import.parseNone"));
    toast(t("app.io.preview.error") + detail, "sad");
  }
}

function handleIoFile(file) {
  if (!file) return;
  state.importFormat = "auto";
  if (refs.ioImportFormat) refs.ioImportFormat.value = "auto";
  const reader = new FileReader();
  reader.onload = function () {
    const text = String(reader.result || "");
    if (refs.ioPaste) refs.ioPaste.value = text.length > 20000 ? "" : text;
    autoGrowPaste();
    handleImportParse(text, file.name || "");
  };
  reader.onerror = function () {
    if (refs.ioImportHint) {
      setText(refs.ioImportHint, t("app.io.import.parseFail"));
      refs.ioImportHint.dataset.state = "error";
    }
  };
  reader.readAsText(file);
}

function applyImportSample(kind) {
  state.importFormat = kind === "json" ? "json" : kind === "csv" ? "csv" : "text";
  if (refs.ioImportFormat) refs.ioImportFormat.value = state.importFormat;
  const sample = IMPORT_SAMPLES[kind] || "";
  if (refs.ioPaste) refs.ioPaste.value = sample;
  autoGrowPaste();
  handleImportParse(sample, "");
}

async function downloadImportTemplate() {
  const template = {
    app: "io.github.xingjianya-86.linknav",
    schema: 1,
    links: [{ title: "", url: "https://", icon: "", desc: "", tags: [], audience: "guest", pinned: false }],
  };
  const content = JSON.stringify(template, null, 2) + "\n";
  const filename = "linknav-template-" + ioStamp() + ".json";
  try {
    await Tapp.file.download(content, filename, "application/json");
    toast(t("app.io.export.downloaded"), "happy");
  } catch (err) {
    await handleCopyText(content, t("app.io.export.downloadFail"));
  }
}

function resetImport() {
  state.importRows = [];
  state.importFilter = "all";
  state.importResult = "";
  state.importBusy = false;
  state.importDone = 0;
  state.importTotal = 0;
  if (parseTimer) clearTimeout(parseTimer);
  if (parseFlashTimer) clearTimeout(parseFlashTimer);
  const parseButton = document.querySelector("[data-ln-io-btn-parse]");
  if (parseButton) parseButton.textContent = t("app.io.import.parse");
  setImportLock(false);
  if (refs.ioPaste) {
    refs.ioPaste.value = "";
    refs.ioPaste.style.height = "";
  }
  if (refs.ioFile) refs.ioFile.value = "";
  if (refs.ioImportHint) {
    setText(refs.ioImportHint, "");
    refs.ioImportHint.dataset.state = "";
  }
  renderPreviewState("idle", t("app.io.preview.waiting"));
  renderImportList();
}

function setIoMode(mode) {
  state.ioMode = mode === "import" ? "import" : "export";
  const isExport = state.ioMode === "export";
  if (refs.ioPanelExport) refs.ioPanelExport.hidden = !isExport;
  if (refs.ioPanelImport) refs.ioPanelImport.hidden = isExport;
  const exportTab = document.querySelector("[data-ln-io-tab-export]");
  const importTab = document.querySelector("[data-ln-io-tab-import]");
  if (exportTab) {
    exportTab.classList.toggle("is-active", isExport);
    exportTab.setAttribute("aria-selected", isExport ? "true" : "false");
  }
  if (importTab) {
    importTab.classList.toggle("is-active", !isExport);
    importTab.setAttribute("aria-selected", !isExport ? "true" : "false");
  }
}

function updateIoExportControls() {
  const isJson = state.ioFormat === "json";
  if (refs.ioIncludeIcons) {
    const toggle = refs.ioIncludeIcons.closest(".ln-toggle");
    if (toggle) toggle.hidden = !isJson;
  }
}

function openIoDialog() {
  if (!refs.ioDialog) return;
  state.importBusy = false;
  setImportLock(false);
  setIoMode("export");
  if (refs.ioFavOption) refs.ioFavOption.hidden = state.role === "guest";
  if (refs.ioExportHint) setText(refs.ioExportHint, t("app.io.export.hint"));
  if (refs.ioFetchIcons) {
    refs.ioFetchIcons.disabled = !state.canRemote;
    refs.ioFetchIcons.checked = state.canRemote;
    state.importFetchIcons = state.canRemote;
  }
  updateIoExportControls();
  refs.ioDialog.showModal();
}

function buildExportPackage() {
  const links = state.links.slice();
  if (!links.length) return null;
  const stamp = ioStamp();
  if (state.ioFormat === "favorites") {
    const urls = links
      .filter(function (link) {
        return state.favoriteSet.has(link.id);
      })
      .map(function (link) {
        return link.url;
      });
    if (!urls.length) return null;
    return {
      content: urls.join("\n") + "\n",
      filename: "linknav-favorites-" + stamp + ".txt",
      mime: "text/plain;charset=utf-8",
    };
  }
  if (state.ioFormat === "text") {
    return {
      content: links
        .map(function (link) {
          return link.url;
        })
        .join("\n") + "\n",
      filename: "linknav-urls-" + stamp + ".txt",
      mime: "text/plain;charset=utf-8",
    };
  }
  if (state.ioFormat === "csv") {
    const rows = [["标题", "网址", "备注", "标签", "可见性", "置顶", "图标"]];
    links.forEach(function (link) {
      rows.push([link.title, link.url, link.desc, link.tags.join("|"), link.audience, link.pinned ? "1" : "", link.icon]);
    });
    const content =
      "\uFEFF" +
      rows
        .map(function (row) {
          return row.map(csvEscape).join(",");
        })
        .join("\r\n") +
      "\r\n";
    return { content: content, filename: "linknav-links-" + stamp + ".csv", mime: "text/csv;charset=utf-8" };
  }
  const payload = {
    app: "io.github.xingjianya-86.linknav",
    schema: 1,
    exportedAt: new Date().toISOString(),
    links: links.map(function (link) {
      return {
        title: link.title,
        url: link.url,
        icon: link.icon,
        desc: link.desc,
        tags: link.tags,
        audience: link.audience,
        pinned: link.pinned,
        order: link.order,
      };
    }),
  };
  if (state.ioIncludeIcons) {
    const icons = {};
    links.forEach(function (link) {
      if (link.iconData) icons[link.url] = link.iconData;
    });
    if (Object.keys(icons).length) payload.icons = icons;
  }
  return {
    content: JSON.stringify(payload, null, 2) + "\n",
    filename: "linknav-links-" + stamp + ".json",
    mime: "application/json",
  };
}

async function handleCopyText(text, failMessage) {
  const ok = await core.copyText(text);
  if (ok) {
    toast(t("app.copied"), "happy");
    return true;
  }
  showCopyPanel(text);
  toast(failMessage || t("app.copyFail"), "sad");
  return false;
}

async function downloadExport() {
  const pkg = buildExportPackage();
  if (!pkg) {
    toast(t("app.io.export.empty"), "sad");
    return;
  }
  try {
    await Tapp.file.download(pkg.content, pkg.filename, pkg.mime);
    toast(t("app.io.export.downloaded"), "happy");
  } catch (err) {
    await handleCopyText(pkg.content, t("app.io.export.downloadFail"));
  }
}

async function copyExport() {
  const pkg = buildExportPackage();
  if (!pkg) {
    toast(t("app.io.export.empty"), "sad");
    return;
  }
  await handleCopyText(pkg.content, t("app.copyFail"));
}

function toggleImportSelection() {
  const visible = state.importRows.filter(importRowVisible).filter(function (row) {
    return !row.invalid;
  });
  const allChecked = visible.length > 0 && visible.every(function (row) {
    return row.checked;
  });
  visible.forEach(function (row) {
    row.checked = !allChecked;
  });
  renderImportList();
}

async function runImport() {
  if (state.importBusy) return;
  if (!state.importRows.length && refs.ioPaste && refs.ioPaste.value.trim()) {
    handleImportParse(refs.ioPaste.value, "");
  }
  const selected = state.importRows.filter(function (row) {
    return row.checked && !row.invalid;
  });
  if (!selected.length) {
    const rows = state.importRows;
    if (!rows.length) {
      toast(t("app.io.import.emptySource"), "sad");
    } else if (rows.every(function (row) {
      return row.invalid;
    })) {
      toast(t("app.io.import.allInvalid"), "sad");
    } else if (rows.every(function (row) {
      return row.invalid || row.status === "duplicate" || row.status === "skipped";
    })) {
      toast(t("app.io.import.allDuplicate"), "sad");
    } else {
      toast(t("app.io.import.nothing"), "sad");
    }
    return;
  }

  const all = state.links.slice();
  const byUrl = {};
  all.forEach(function (link) {
    const key = core.sanitizeUrl(link.url) || link.url;
    byUrl[key] = link;
  });
  const newCount = selected.filter(function (row) {
    return !byUrl[core.sanitizeUrl(row.url) || row.url];
  }).length;
  if (state.links.length + newCount > core.MAX_LINKS) {
    toast(t("app.io.import.limit"), "sad");
    return;
  }

  state.importBusy = true;
  state.importResult = "";
  state.importDone = 0;
  state.importTotal = selected.length;
  setImportLock(true);
  if (refs.ioImportHint) {
    setText(refs.ioImportHint, "");
    refs.ioImportHint.dataset.state = "";
  }
  renderImportList();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const iconJobs = [];
  selected.forEach(function (row) {
    const key = core.sanitizeUrl(row.url) || row.url;
    const existing = byUrl[key];
    if (existing) {
      if (state.importDedupe !== "overwrite") {
        skipped += 1;
        row.status = "skipped";
        row.message = "";
        return;
      }
      existing.title = row.title || existing.title;
      existing.desc = row.desc || existing.desc;
      existing.icon = row.icon || existing.icon;
      if (row.tags.length) existing.tags = row.tags.slice(0, 8);
      existing.audience = row.audience;
      existing.pinned = row.pinned || existing.pinned;
      existing.target = core.resolveTarget(existing.url, state.openUrls) || existing.target;
      updated += 1;
      row.status = "imported";
      if (row.iconData) iconJobs.push({ link: existing, row: row, data: row.iconData });
      return;
    }
    const link = {
      id: core.newLinkId(),
      url: row.url,
      title: row.title || core.hostOf(row.url) || row.url,
      target: core.resolveTarget(row.url, state.openUrls),
      icon: row.icon || "",
      desc: row.desc || "",
      tags: row.tags.slice(0, 8),
      audience: row.audience,
      pinned: !!row.pinned,
      order: (all.length + added) * 10,
      addedAt: Date.now(),
      addedBy: "",
    };
    all.push(link);
    byUrl[key] = link;
    added += 1;
    row.status = "imported";
    if (row.iconData) iconJobs.push({ link: link, row: row, data: row.iconData });
  });
  state.importDone = selected.length;
  renderImportStatus();

  try {
    await core.saveLinks(all, state.role);
  } catch (err) {
    state.importBusy = false;
    state.importResult = t("app.saveFail");
    state.importResultState = "error";
    setImportLock(false);
    renderImportList();
    toast(t("app.saveFail"), "sad");
    return;
  }

  let iconOk = 0;
  let iconFail = 0;
  for (let i = 0; i < iconJobs.length; i++) {
    try {
      await core.saveIcon(iconJobs[i].link.id, iconJobs[i].data, iconJobs[i].link.audience, state.role);
      iconJobs[i].link.iconData = iconJobs[i].data;
      iconOk += 1;
    } catch (err) {
      iconFail += 1;
      iconJobs[i].row.message = t("app.icon.quota");
    }
    state.importDone += 1;
    renderImportStatus();
  }

  const fetchRows = [];
  if (state.importFetchIcons && state.canRemote) {
    selected.forEach(function (row) {
      if (row.status === "skipped") return;
      const target = byUrl[core.sanitizeUrl(row.url) || row.url];
      if (!target || target.iconData) return;
      if (!core.hostOf(row.url)) return;
      fetchRows.push({ row: row, target: target });
    });
    state.importTotal += fetchRows.length;
    renderImportStatus();
  }
  for (let i = 0; i < fetchRows.length; i++) {
    const row = fetchRows[i].row;
    const target = fetchRows[i].target;
    const domain = core.hostOf(row.url);
    row.message = t("app.icon.fetching");
    renderImportList();
    try {
      const img = await loadCorsImage(FAVICON_SERVICE + encodeURIComponent(domain), 9000);
      const dataUri = toIconDataUriFromImage(img);
      await core.saveIcon(target.id, dataUri, target.audience, state.role);
      target.iconData = dataUri;
      iconOk += 1;
      row.status = "fetched";
      row.message = "";
    } catch (err) {
      iconFail += 1;
      row.message = t("app.icon.fetchFail");
    }
    state.importDone += 1;
    renderImportStatus();
    renderImportList();
  }

  await core.pruneIcons(
    all.map(function (link) {
      return link.id;
    }),
    state.role,
  );
  await reload(false);
  state.importBusy = false;
  state.importDone = state.importTotal;
  state.importResult =
    t("app.io.import.done", { added: added, updated: updated, skipped: skipped, failed: 0 }) +
    (iconOk || iconFail ? " · " + t("app.io.import.iconsDone", { ok: iconOk, fail: iconFail }) : "");
  state.importResultState = iconFail ? "warn" : "done";
  setImportLock(false);
  renderImportList();
  toast(t("app.io.import.done", { added: added, updated: updated, skipped: skipped, failed: 0 }), "happy");
}

function bindIoEvents() {
  document.querySelectorAll("[data-io-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      setIoMode(tab.dataset.ioTab);
    });
  });
  document.querySelectorAll("[data-ln-io-format]").forEach(function (input) {
    input.addEventListener("change", function () {
      if (!input.checked) return;
      state.ioFormat = input.value;
      updateIoExportControls();
    });
  });
  if (refs.ioIncludeIcons) {
    refs.ioIncludeIcons.addEventListener("change", function () {
      state.ioIncludeIcons = refs.ioIncludeIcons.checked;
    });
  }
  if (refs.ioDefaultAudience) {
    refs.ioDefaultAudience.addEventListener("change", function () {
      state.importDefaultAudience = refs.ioDefaultAudience.value;
    });
  }
  if (refs.ioImportFormat) {
    refs.ioImportFormat.addEventListener("change", function () {
      state.importFormat = refs.ioImportFormat.value;
      if (refs.ioPaste && refs.ioPaste.value.trim()) handleImportParse(refs.ioPaste.value, "");
    });
  }
  const parseButton = document.querySelector("[data-ln-io-btn-parse]");
  if (parseButton) {
    parseButton.addEventListener("click", function () {
      handleImportParse(refs.ioPaste ? refs.ioPaste.value : "", "");
    });
  }
  if (refs.ioPaste) {
    refs.ioPaste.addEventListener("input", function () {
      autoGrowPaste();
      if (parseTimer) clearTimeout(parseTimer);
      const value = refs.ioPaste.value;
      parseTimer = setTimeout(function () {
        if (value.trim()) {
          handleImportParse(value, "");
        } else if (state.importRows.length) {
          state.importRows = [];
          state.importResult = "";
          renderImportList();
        }
      }, 500);
    });
  }
  document.querySelectorAll("[data-ln-io-dedupe]").forEach(function (input) {
    input.addEventListener("change", function () {
      if (!input.checked) return;
      state.importDedupe = input.value;
      const wantChecked = state.importDedupe === "overwrite";
      state.importRows.forEach(function (row) {
        if (row.invalid) return;
        if (row.status === "duplicate" || row.status === "skipped") {
          row.checked = wantChecked;
          if (wantChecked && row.status === "skipped") row.status = "duplicate";
        }
      });
      renderImportList();
    });
  });
  if (refs.ioFetchIcons) {
    refs.ioFetchIcons.addEventListener("change", function () {
      state.importFetchIcons = refs.ioFetchIcons.checked;
    });
  }
  if (refs.ioFile) {
    refs.ioFile.addEventListener("change", function () {
      const file = refs.ioFile.files && refs.ioFile.files[0];
      handleIoFile(file);
      refs.ioFile.value = "";
    });
  }
  if (refs.ioDrop) {
    ["dragenter", "dragover"].forEach(function (name) {
      refs.ioDrop.addEventListener(name, function (event) {
        event.preventDefault();
        refs.ioDrop.classList.add("is-drag");
      });
    });
    ["dragleave", "dragend"].forEach(function (name) {
      refs.ioDrop.addEventListener(name, function (event) {
        event.preventDefault();
        refs.ioDrop.classList.remove("is-drag");
      });
    });
    refs.ioDrop.addEventListener("drop", function (event) {
      event.preventDefault();
      refs.ioDrop.classList.remove("is-drag");
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) handleIoFile(files[0]);
    });
  }
  if (refs.ioDialog) {
    refs.ioDialog.addEventListener("cancel", function (event) {
      if (state.importBusy) event.preventDefault();
    });
    refs.ioDialog.addEventListener("close", function () {
      state.importBusy = false;
      setImportLock(false);
      returnOverlay(refs.toast);
      returnOverlay(refs.copyPanel);
    });
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
      hideCopyPanel();
    } else if (action === "save-link") {
      saveDialog();
    } else if (action === "pick-icon") {
      if (refs.iconFile) refs.iconFile.click();
    } else if (action === "clear-icon") {
      handleClearIcon();
    } else if (action === "fetch-icon") {
      fetchFaviconAuto();
    } else if (action === "io-open") {
      openIoDialog();
    } else if (action === "close-io") {
      if (!state.importBusy && refs.ioDialog) refs.ioDialog.close();
    } else if (action === "io-pick-file") {
      if (refs.ioFile) refs.ioFile.click();
    } else if (action === "io-clear") {
      resetImport();
    } else if (action === "io-sample-json") {
      applyImportSample("json");
    } else if (action === "io-sample-text") {
      applyImportSample("text");
    } else if (action === "io-sample-csv") {
      applyImportSample("csv");
    } else if (action === "io-template") {
      downloadImportTemplate();
    } else if (action === "io-select-all") {
      toggleImportSelection();
    } else if (action === "io-import") {
      runImport();
    } else if (action === "io-reset") {
      resetImport();
    } else if (action === "io-download") {
      downloadExport();
    } else if (action === "io-copy") {
      copyExport();
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
      returnOverlay(refs.toast);
      returnOverlay(refs.copyPanel);
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
      if (event.target === refs.copyPanel) hideCopyPanel();
    });
  }
  bindIoEvents();
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
