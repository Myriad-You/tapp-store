(function () {
  'use strict';

  var STORAGE_KEY = 'echo_stage_saves_v1';
  var VOICE_STORAGE_KEY = 'echo_stage_voice_cast_v1';
  var MAX_FILES = 512;
  var MAX_MANIFEST_BYTES = 256 * 1024;
  var MEDIA_PATTERN = /\.(?:png|jpe?g|webp|gif|avif|mp3|ogg|wav|m4a|aac|opus|webm|mp4)$/i;
  var BUILTIN_DEMOS = Object.freeze({
    shore: Object.freeze({
      id: 'cn.echootaku.echo-stage.before-leaving-shore',
      root: 'assets/demo',
      cover: 'echo-theatre-stage.png'
    }),
    starlight: Object.freeze({
      id: 'cn.echootaku.echo-stage.unsent-star-map',
      root: 'assets/starlight',
      cover: 'echo-theatre-starlight.png'
    })
  });
  var state = {
    locale: 'zh-CN',
    game: null,
    gameHash: '',
    source: '',
    runtime: null,
    currentEvent: null,
    history: [],
    saves: {},
    resolveAsset: null,
    objectUrls: new Map(),
    builtinUrls: new Map(),
    autoplay: false,
    autoplayTimer: 0,
    voiceEnabled: false,
    voiceReady: false,
    voiceStatus: null,
    voices: [],
    voiceSettings: { enabled: false, games: {} },
    voicePromise: Promise.resolve(false),
    voiceGeneration: 0,
    voiceObjectUrl: '',
    voiceFailureShown: false,
    voiceInitPromise: null,
    bgmVolumeBeforeVoice: 1,
    paused: false,
    resumeBgm: false,
    generation: 0,
    overlayReturnFocus: null,
    cleanups: [],
    abort: new AbortController()
  };

  function el(id) { return document.getElementById(id); }
  function tr(key, fallback) {
    try {
      var translated = Tapp.i18n && Tapp.i18n.t ? Tapp.i18n.t(key) : '';
      return translated && translated !== key ? translated : fallback;
    } catch (_) { return fallback; }
  }
  function hasPermission(permission) {
    try {
      if (Array.isArray(Tapp.permissions)) return Tapp.permissions.indexOf(permission) >= 0;
      var info = Tapp.lifecycle && Tapp.lifecycle.getInfo ? Tapp.lifecycle.getInfo() : null;
      if (info && Array.isArray(info.permissions)) return info.permissions.indexOf(permission) >= 0;
    } catch (_) {}
    return true;
  }
  function errorText(error, fallback) {
    var current = error;
    for (var depth = 0; depth < 5; depth++) {
      if (current == null) break;
      if (typeof current === 'string') return current.slice(0, 500);
      if (typeof current !== 'object') return String(current).slice(0, 500);
      var code = current.code || current.errorCode || current.error_code;
      var message = current.message || current.detail || current.description;
      if (message) return (code ? String(code) + '：' : '') + String(message).slice(0, 500);
      current = current.error || current.data || current.result || current.value;
    }
    return fallback;
  }
  function normalizeLocale(value) {
    var locale = String(value || '').toLowerCase();
    if (locale.startsWith('ja')) return 'ja-JP';
    if (locale.startsWith('en')) return 'en-US';
    return 'zh-CN';
  }
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = tr(node.getAttribute('data-i18n'), node.textContent);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      node.setAttribute('aria-label', tr(node.getAttribute('data-i18n-aria'), node.getAttribute('aria-label')));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) {
      node.setAttribute('placeholder', tr(node.getAttribute('data-i18n-placeholder'), node.getAttribute('placeholder')));
    });
  }
  function setStatus(message, tone) {
    var node = el('library-status');
    node.textContent = message || '';
    node.dataset.tone = tone || 'info';
  }
  function showLoading(title, detail) {
    el('loading-title').textContent = title || tr('loading.boot', '正在准备回声剧场…');
    el('loading-message').textContent = detail || tr('loading.hint', '故事会在素材准备好后立即开始');
    el('loading-layer').hidden = false;
    el('echo-app').setAttribute('aria-busy', 'true');
  }
  function hideLoading() {
    el('loading-layer').hidden = true;
    el('echo-app').removeAttribute('aria-busy');
  }
  function safePath(path) {
    var value = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!value || value.startsWith('/') || value.split('/').some(function (part) { return !part || part === '.' || part === '..'; })) {
      throw new Error(tr('error.path', '游戏包包含不安全路径：') + value);
    }
    return value;
  }
  function fingerprint(game, script) {
    var input = game.id + '\n' + script;
    var hash = 2166136261;
    for (var i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function chooseEntry(game) {
    if (game.entries && typeof game.entries === 'object') {
      return game.entries[state.locale] || game.entries['zh-CN'] || game.entries['en-US'] || Object.values(game.entries)[0];
    }
    return game.entry;
  }
  function validateGame(game) {
    if (!game || game.format !== 'echo-stage/v1') throw new Error(tr('error.format', '只支持 echo-stage/v1 游戏包'));
    if (typeof game.id !== 'string' || !/^[a-zA-Z0-9._-]{3,128}$/.test(game.id)) throw new Error(tr('error.gameId', '游戏 ID 无效'));
    if (typeof game.title !== 'string' || !game.title.trim()) throw new Error(tr('error.title', '游戏缺少标题'));
    var entry = chooseEntry(game);
    if (!entry) throw new Error(tr('error.entry', '游戏缺少入口剧本'));
    safePath(entry);
    if (!game.assets || typeof game.assets !== 'object' || Array.isArray(game.assets)) game.assets = {};
    Object.keys(game.assets).forEach(function (key) {
      if (!/^[a-zA-Z0-9._-]+$/.test(key)) throw new Error(tr('error.assetId', '素材 ID 无效：') + key);
      var path = safePath(game.assets[key]);
      if (!MEDIA_PATTERN.test(path)) throw new Error(tr('error.assetType', '不支持的素材类型：') + path);
    });
    return game;
  }
  async function readBuiltinText(path) {
    var result = await Tapp.assets.getArrayBuffer(path);
    var buffer = result && result.buffer !== undefined ? result.buffer : result;
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  }
  async function builtinUrl(path) {
    if (state.builtinUrls.has(path)) return state.builtinUrls.get(path);
    var pending = Promise.resolve(Tapp.assets.getUrl(path)).then(function (result) {
      var url = result && result.url ? result.url : result;
      state.builtinUrls.set(path, url);
      return url;
    }, function (error) {
      state.builtinUrls.delete(path);
      throw error;
    });
    state.builtinUrls.set(path, pending);
    return pending;
  }
  function revokeLocalUrls() {
    state.objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    state.objectUrls.clear();
  }
  async function loadDemo(key, resume) {
    var demo = BUILTIN_DEMOS[key];
    if (!demo) return;
    showLoading(tr('loading.game', '正在载入故事与首个场景…'), tr('loading.hint', '故事会在素材准备好后立即开始'));
    try {
      setStatus(tr('status.loading', '正在加载故事…'), 'info');
      var game = validateGame(JSON.parse(await readBuiltinText(demo.root + '/game.json')));
      var entry = chooseEntry(game);
      var script = await readBuiltinText(demo.root + '/' + safePath(entry));
      await startGame(game, script, tr('source.builtin', '内置示例'), async function (assetId) {
        var relative = game.assets[assetId];
        if (!relative) throw new Error(tr('error.assetMissing', '找不到素材：') + assetId);
        return builtinUrl(demo.root + '/' + safePath(relative));
      }, resume);
    } catch (error) { setStatus(error.message, 'error'); }
    finally { hideLoading(); }
  }
  async function loadLibraryAssets() {
    var assets = [
      { id: 'library-backdrop', path: 'assets/launcher/echo-stage-library.png' },
      { id: 'sample-cover-shore', path: BUILTIN_DEMOS.shore.root + '/' + BUILTIN_DEMOS.shore.cover },
      { id: 'sample-cover-starlight', path: BUILTIN_DEMOS.starlight.root + '/' + BUILTIN_DEMOS.starlight.cover }
    ];
    try {
      await Promise.all(assets.map(async function (asset) {
        var image = el(asset.id);
        image.src = await builtinUrl(asset.path);
        if (typeof image.decode === 'function') await image.decode();
      }));
    } catch (error) { setStatus(error.message, 'error'); }
  }
  async function loadLibraryDecoration() {
    var generation = state.generation;
    try {
      var url = await builtinUrl('assets/ui/echo-ripples.png');
      if (generation !== state.generation) return;
      el('library-ripple-image').src = url;
    } catch (_) {}
  }
  function relativeFiles(fileList) {
    if (!fileList.length) throw new Error(tr('error.emptyFolder', '没有选择任何文件'));
    if (fileList.length > MAX_FILES) throw new Error(tr('error.tooManyFiles', '第一版最多读取 512 个文件'));
    var paths = Array.from(fileList).map(function (file) {
      return { file: file, path: String(file.webkitRelativePath || file.name).replace(/\\/g, '/') };
    });
    var manifestItem = paths.filter(function (item) { return /(^|\/)game\.json$/i.test(item.path); })
      .sort(function (a, b) { return a.path.length - b.path.length; })[0];
    if (!manifestItem) throw new Error(tr('error.noManifest', '所选目录中没有 game.json'));
    var root = manifestItem.path.slice(0, manifestItem.path.length - 'game.json'.length);
    var map = new Map();
    paths.forEach(function (item) {
      if (!item.path.startsWith(root)) return;
      var relative = safePath(item.path.slice(root.length));
      if (map.has(relative)) throw new Error(tr('error.duplicatePath', '游戏包存在重复路径：') + relative);
      map.set(relative, item.file);
    });
    return map;
  }
  async function loadFolder(fileList) {
    showLoading(tr('loading.folder', '正在检查目录并载入游戏…'), tr('loading.hint', '故事会在素材准备好后立即开始'));
    try {
      setStatus(tr('status.inspecting', '正在检查本地游戏包…'), 'info');
      var files = relativeFiles(fileList);
      var manifestFile = files.get('game.json');
      if (!manifestFile || manifestFile.size > MAX_MANIFEST_BYTES) throw new Error(tr('error.manifestSize', 'game.json 不得超过 256 KiB'));
      var game = validateGame(JSON.parse(await manifestFile.text()));
      var entry = safePath(chooseEntry(game));
      var scriptFile = files.get(entry);
      if (!scriptFile) throw new Error(tr('error.scriptMissing', '找不到入口剧本：') + entry);
      if (scriptFile.size > EchoStageEngine.limits.scriptBytes) throw new Error(tr('error.scriptSize', '剧本不得超过 1 MiB'));
      var script = await scriptFile.text();
      revokeLocalUrls();
      await startGame(game, script, tr('source.local', '本地目录'), async function (assetId) {
        var relative = game.assets[assetId];
        if (!relative) throw new Error(tr('error.assetMissing', '找不到素材：') + assetId);
        var path = safePath(relative);
        var file = files.get(path);
        if (!file) throw new Error(tr('error.fileMissing', '素材文件不存在：') + path);
        if (!MEDIA_PATTERN.test(path)) throw new Error(tr('error.assetType', '不支持的素材类型：') + path);
        if (!state.objectUrls.has(path)) state.objectUrls.set(path, URL.createObjectURL(file));
        return state.objectUrls.get(path);
      }, true);
      setStatus('', 'info');
    } catch (error) { setStatus(error.message, 'error'); }
    finally { el('folder-input').value = ''; hideLoading(); }
  }
  async function downloadDemo() {
    var button = el('download-demo');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      if (!Tapp.file || typeof Tapp.file.download !== 'function') {
        throw new Error(tr('error.downloadUnavailable', '当前运行环境不支持文件下载'));
      }
      if (typeof EchoStageDemoArchive === 'undefined') {
        throw new Error(tr('error.downloadUnavailable', '当前运行环境不支持文件下载'));
      }
      var archive = EchoStageDemoArchive.build();
      await Tapp.file.download(archive, EchoStageDemoArchive.filename, EchoStageDemoArchive.mimeType);
      setStatus(tr('status.demoDownloaded', '开发示例已开始下载：EchoStageDemo.tar'), 'success');
    } catch (error) {
      setStatus(tr('error.downloadFailed', '开发示例下载失败：') + (error && error.message ? error.message : String(error)), 'error');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
  async function startGame(game, script, source, resolveAsset, resume) {
    var program = EchoStageEngine.parseScript(script);
    var hash = fingerprint(game, script);
    var autoSave = state.saves[game.id] && state.saves[game.id][0];
    var snapshot = resume && autoSave && autoSave.gameHash === hash ? autoSave.snapshot : null;
    state.game = game;
    state.gameHash = hash;
    state.source = source;
    state.resolveAsset = resolveAsset;
    state.runtime = new EchoStageEngine.Runtime(program, snapshot);
    state.history = snapshot && Array.isArray(autoSave.history) ? autoSave.history.slice(-100) : [];
    state.currentEvent = null;
    state.generation++;
    clearAutoplay();
    stopVoice();
    document.documentElement.classList.add('echo-playing');
    el('echo-background').classList.add('scene-active');
    el('library-view').hidden = true;
    el('editor-view').hidden = true;
    el('player-view').hidden = false;
    document.documentElement.classList.remove('echo-editing');
    el('ending-card').hidden = true;
    el('dialogue-panel').hidden = false;
    el('player-title').textContent = game.title;
    el('player-source').textContent = source;
    if (state.voiceEnabled && !state.voiceReady) await initializeSpeech();
    await renderEvent(state.runtime.next());
  }
  async function renderEvent(event) {
    if (!event || !state.game) return;
    state.currentEvent = event;
    var generation = state.generation;
    if (event.background) {
      try {
        var url = await state.resolveAsset(event.background);
        if (generation !== state.generation) return;
        var image = el('scene-image');
        if (image.src !== url) {
          image.style.opacity = '0';
          image.src = url;
          if (typeof image.decode === 'function') {
            try { await image.decode(); } catch (_) { /* load/error handling remains with the browser */ }
          }
          if (generation !== state.generation) return;
          requestAnimationFrame(function () { image.style.opacity = '1'; });
        }
      } catch (error) { setStatus(error.message, 'error'); }
    }
    await syncMusic(event.music, generation);
    var choices = el('choice-list');
    choices.replaceChildren();
    el('ending-card').hidden = event.type !== 'end';
    el('dialogue-panel').hidden = event.type === 'end';
    if (event.type === 'end') {
      el('ending-title').textContent = event.title;
      el('ending-text').textContent = event.text;
      clearAutoplay();
      stopVoice();
      await persistAutoSave();
      return;
    }
    el('speaker-name').textContent = event.speaker || '';
    el('dialogue-text').textContent = event.text || '';
    el('advance-story').hidden = event.type === 'choice';
    if (event.type === 'say' || event.type === 'narrate') {
      state.history.push({ speaker: event.speaker || '', text: event.text });
      if (state.history.length > 100) state.history.shift();
    }
    if (event.type === 'choice') event.options.forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.text;
      button.addEventListener('click', async function () {
        clearAutoplay();
        stopVoice();
        await renderEvent(state.runtime.choose(option.target));
      }, { once: true });
      choices.appendChild(button);
    });
    await persistAutoSave();
    state.voicePromise = speakEvent(event, generation);
    scheduleAutoplay();
  }
  async function syncMusic(assetId, generation) {
    var audio = el('bgm-player');
    if (!assetId) {
      if (!audio.paused) audio.pause();
      audio.removeAttribute('src');
      return;
    }
    try {
      var url = await state.resolveAsset(assetId);
      if (generation !== state.generation || audio.src === url) return;
      audio.src = url;
      await audio.play();
    } catch (_) {
      setStatus(tr('status.audioGesture', '浏览器等待一次用户操作后才能播放音频'), 'warning');
    }
  }
  function unwrapVoices(value) {
    var current = value;
    for (var depth = 0; depth < 6; depth++) {
      if (Array.isArray(current)) return current;
      if (!current || typeof current !== 'object') return [];
      current = current.voices || current.items || current.data || current.result || current.value;
    }
    return [];
  }
  function normalizeVoice(value, index) {
    function integer(input) {
      if (typeof input === 'string' && /^-?\d+$/.test(input.trim())) input = Number(input);
      return Number.isSafeInteger(input) && input >= -2147483648 && input <= 2147483647 ? input : null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      var primitive = integer(value);
      return primitive == null ? null : { id: String(primitive), value: primitive, label: String(value), locale: '', tier: 'other', gender: '', description: '', emotionSupport: false };
    }
    if (!value || typeof value !== 'object') return null;
    var candidates = ['voice_type', 'voiceType', 'voice_id', 'voiceId', 'voice_code', 'voiceCode', 'type_id', 'typeId', 'id', 'value', 'code'];
    var nativeValue = null;
    for (var i = 0; i < candidates.length; i++) {
      nativeValue = integer(value[candidates[i]]);
      if (nativeValue != null) break;
    }
    if (nativeValue == null) return null;
    var label = value.displayName || value.display_name || value.label || value.name || value.title || nativeValue;
    var locale = value.locale || value.language || value.lang || '';
    var tier = String(value.voice_type || value.voiceType || '').trim().toLowerCase() || 'other';
    var gender = value.gender || '';
    var description = value.description || '';
    var emotionSupport = value.emotion_support === true || value.emotionSupport === true;
    return {
      id: String(nativeValue), value: nativeValue, label: String(label), locale: String(locale || ''),
      tier: tier, gender: String(gender || ''), description: String(description || ''), emotionSupport: emotionSupport,
    };
  }
  function normalizeVoices(value) {
    var seen = new Set();
    return unwrapVoices(value).map(normalizeVoice).filter(function (voice) {
      if (!voice || seen.has(voice.id)) return false;
      seen.add(voice.id); return true;
    });
  }
  function groupVoices(voices) {
    var tiers = ['premium', 'llm', 'ultra_natural'];
    var groups = tiers.map(function (tier) { return { tier: tier, voices: [] }; });
    var other = { tier: 'other', voices: [] };
    (voices || []).forEach(function (voice) {
      var index = tiers.indexOf(voice.tier);
      (index >= 0 ? groups[index] : other).voices.push(voice);
    });
    return groups.concat(other).filter(function (group) { return group.voices.length > 0; });
  }
  function voiceTierLabel(tier) {
    if (tier === 'premium') return tr('voice.tierPremium', '基础 / 精品音色');
    if (tier === 'llm') return tr('voice.tierLlm', '大模型音色');
    if (tier === 'ultra_natural') return tr('voice.tierUltraNatural', '超自然大模型音色');
    return tr('voice.tierOther', '其他音色');
  }
  function voiceOptionText(voice) {
    return [voice.label, voice.gender, voice.locale].filter(Boolean).join(' · ');
  }
  function voiceDetailText(voice) {
    if (!voice) return '';
    return [voice.description, voice.emotionSupport ? tr('voice.emotionSupported', '支持情感演绎') : ''].filter(Boolean).join(' · ');
  }
  function speechExplicitlyUnavailable(status) {
    if (!status || typeof status !== 'object') return false;
    return status.available === false || status.enabled === false || status.configured === false || status.ready === false;
  }
  function speechCall(promise) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () { reject(new Error(tr('voice.timeout', '语音服务响应超时，请稍后重试'))); }, 8000);
      Promise.resolve(promise).then(function (value) { clearTimeout(timeout); resolve(value); }, function (error) { clearTimeout(timeout); reject(error); });
    });
  }
  async function initializeSpeech() {
    if (state.voiceReady) return true;
    if (state.voiceInitPromise) return state.voiceInitPromise;
    state.voiceInitPromise = (async function () {
      state.voiceReady = false;
      if (!hasPermission('speech:tts') || !Tapp.speech || typeof Tapp.speech.tts !== 'function') {
        state.voiceStatus = new Error(tr('voice.permission', '未授予宿主语音合成权限'));
        return false;
      }
      try {
        state.voiceStatus = typeof Tapp.speech.getStatus === 'function' ? await speechCall(Tapp.speech.getStatus()) : null;
        if (speechExplicitlyUnavailable(state.voiceStatus)) throw new Error(tr('voice.unavailable', 'Myriad 语音服务尚未配置或不可用'));
        state.voices = typeof Tapp.speech.getVoices === 'function' ? normalizeVoices(await speechCall(Tapp.speech.getVoices())) : [];
        state.voiceReady = true;
        state.voiceFailureShown = false;
      } catch (error) {
        state.voiceStatus = error;
        state.voices = [];
      }
      return state.voiceReady;
    })();
    updateVoiceControls();
    try {
      return await state.voiceInitPromise;
    } finally {
      state.voiceInitPromise = null;
      updateVoiceControls();
    }
  }
  function updateVoiceControls() {
    var toggle = el('toggle-voice');
    var cast = el('open-cast');
    if (!toggle || !cast) return;
    toggle.disabled = Boolean(state.voiceInitPromise);
    toggle.setAttribute('aria-busy', String(Boolean(state.voiceInitPromise)));
    toggle.setAttribute('aria-pressed', String(state.voiceEnabled && state.voiceReady));
    cast.disabled = Boolean(state.voiceInitPromise);
    cast.setAttribute('aria-busy', String(Boolean(state.voiceInitPromise)));
    var indicator = el('voice-indicator');
    if (indicator) indicator.hidden = !(state.voiceEnabled && state.voiceReady);
  }
  function currentGameCast() {
    if (!state.game) return {};
    var games = state.voiceSettings.games || (state.voiceSettings.games = {});
    return games[state.game.id] || (games[state.game.id] = {});
  }
  function speakersForGame() {
    if (!state.runtime || !state.runtime.program) return [];
    var speakers = [];
    var seen = new Set();
    var hasNarrator = false;
    state.runtime.program.commands.forEach(function (command) {
      if (command.type === 'narrate') hasNarrator = true;
      if (command.type === 'speaker') {
        var name = String(command.value || '').trim();
        if (name && !seen.has(name)) { seen.add(name); speakers.push(name); }
      }
    });
    if (hasNarrator) speakers.unshift('__narrator__');
    return speakers;
  }
  async function persistVoiceSettings() {
    state.voiceSettings.enabled = state.voiceEnabled;
    await Tapp.storage.set(VOICE_STORAGE_KEY, state.voiceSettings);
  }
  function selectedVoiceFor(event) {
    if (!event) return null;
    var key = event.type === 'narrate' ? '__narrator__' : String(event.speaker || '');
    var selectedId = currentGameCast()[key];
    return selectedId ? state.voices.find(function (voice) { return voice.id === selectedId; }) || null : null;
  }
  function audioSource(value, mimeHint) {
    var current = value;
    var mime = mimeHint || 'audio/mpeg';
    for (var depth = 0; depth < 7; depth++) {
      if (current instanceof ArrayBuffer) {
        state.voiceObjectUrl = URL.createObjectURL(new Blob([current], { type: mime }));
        return state.voiceObjectUrl;
      }
      if (ArrayBuffer.isView(current)) {
        state.voiceObjectUrl = URL.createObjectURL(new Blob([current], { type: mime }));
        return state.voiceObjectUrl;
      }
      if (typeof current === 'string') {
        if (/^(?:https:|blob:|data:audio\/)/i.test(current)) return current;
        var compact = current.replace(/\s+/g, '');
        if (compact.length > 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return 'data:' + mime + ';base64,' + compact;
        break;
      }
      if (!current || typeof current !== 'object') break;
      mime = current.mimeType || current.mime_type || current.contentType || current.content_type || mime;
      var directUrl = current.url || current.audioUrl || current.audio_url;
      if (typeof directUrl === 'string' && /^(?:https:|blob:|data:audio\/)/i.test(directUrl)) return directUrl;
      current = current.audio || current.base64 || current.b64_json || current.bytes || current.buffer || current.data || current.result || current.value;
    }
    throw new Error(tr('voice.resultInvalid', '语音服务没有返回可播放的音频'));
  }
  function releaseVoiceObjectUrl() {
    if (!state.voiceObjectUrl) return;
    URL.revokeObjectURL(state.voiceObjectUrl);
    state.voiceObjectUrl = '';
  }
  function stopVoice() {
    state.voiceGeneration++;
    var audio = el('voice-player');
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
    }
    releaseVoiceObjectUrl();
    var bgm = el('bgm-player');
    if (bgm) bgm.volume = state.bgmVolumeBeforeVoice;
    var indicator = el('voice-indicator');
    if (indicator) indicator.classList.remove('is-speaking');
  }
  async function reportSpeechError(error) {
    var message = errorText(error, tr('voice.failed', '配音生成失败，已继续使用字幕'));
    setStatus(message, 'error');
    if (state.voiceFailureShown || !Tapp.ui || typeof Tapp.ui.showNotification !== 'function') return;
    state.voiceFailureShown = true;
    try {
      await Tapp.ui.showNotification({ title: tr('voice.errorTitle', '自动配音失败'), message: message, type: 'error', duration: 7000 });
    } catch (_) {}
  }
  function playVoiceSource(source, token) {
    return new Promise(function (resolve, reject) {
      var audio = el('voice-player');
      if (!audio || token !== state.voiceGeneration) { resolve(false); return; }
      audio.onended = function () { audio.onended = null; audio.onerror = null; releaseVoiceObjectUrl(); resolve(token === state.voiceGeneration); };
      audio.onerror = function () { audio.onended = null; audio.onerror = null; reject(new Error(tr('voice.playFailed', '生成的配音无法播放'))); };
      audio.src = source;
      Promise.resolve(audio.play()).catch(reject);
    });
  }
  async function speakEvent(event, gameGeneration) {
    stopVoice();
    if (state.paused || !state.voiceEnabled || !state.voiceReady || !event || !['say', 'narrate'].includes(event.type) || !event.text) return false;
    var token = state.voiceGeneration;
    var indicator = el('voice-indicator');
    if (indicator) indicator.classList.add('is-speaking');
    var bgm = el('bgm-player');
    if (bgm) { state.bgmVolumeBeforeVoice = bgm.volume; bgm.volume = Math.min(0.32, bgm.volume); }
    try {
      var request = { text: event.text };
      var voice = selectedVoiceFor(event);
      if (voice) request.voiceType = voice.value;
      var result = await Tapp.speech.tts(request);
      if (token !== state.voiceGeneration || gameGeneration !== state.generation) return false;
      return await playVoiceSource(audioSource(result), token);
    } catch (error) {
      if (token === state.voiceGeneration) await reportSpeechError(error);
      return false;
    } finally {
      if (token === state.voiceGeneration) {
        if (bgm) bgm.volume = state.bgmVolumeBeforeVoice;
        if (indicator) indicator.classList.remove('is-speaking');
      }
    }
  }
  function voiceStatusText() {
    if (state.voiceReady) return state.voices.length
      ? tr('voice.readyCount', '语音服务可用，可选音色：') + state.voices.length
      : tr('voice.readyDefault', '语音服务可用，将使用宿主默认音色');
    return errorText(state.voiceStatus, tr('voice.unavailable', 'Myriad 语音服务尚未配置或不可用'));
  }
  function showVoiceCast() {
    openOverlay(tr('player.cast', '选角'), function (content) {
      var summary = document.createElement('p'); summary.className = 'cast-summary'; summary.textContent = tr('voice.castHint', '为本剧目的角色选择 Myriad 宿主音色。未指定时使用默认音色。'); content.appendChild(summary);
      var billing = document.createElement('p'); billing.className = 'cast-billing-note'; billing.textContent = tr('voice.billingHint', '回声剧场只选择音色；资源包与后付费扣减由 Myriad 宿主账户决定。'); content.appendChild(billing);
      var status = document.createElement('p'); status.className = 'cast-status' + (state.voiceReady ? ' is-ready' : ''); status.textContent = voiceStatusText(); content.appendChild(status);
      var speakers = speakersForGame();
      if (!speakers.length) { var empty = document.createElement('p'); empty.className = 'cast-empty'; empty.textContent = tr('voice.noSpeakers', '剧本中还没有可分配音色的对白。'); content.appendChild(empty); return; }
      var list = document.createElement('div'); list.className = 'cast-list'; var cast = currentGameCast();
      speakers.forEach(function (speaker, speakerIndex) {
        var row = document.createElement('label'); row.className = 'cast-row';
        var name = document.createElement('strong'); name.textContent = speaker === '__narrator__' ? tr('voice.narrator', '旁白') : speaker;
        var select = document.createElement('select'); select.setAttribute('aria-label', name.textContent + ' · ' + tr('voice.select', '选择音色'));
        var automatic = document.createElement('option'); automatic.value = ''; automatic.textContent = tr('voice.default', '宿主默认音色'); select.appendChild(automatic);
        groupVoices(state.voices).forEach(function (group) {
          var options = document.createElement('optgroup'); options.label = voiceTierLabel(group.tier);
          group.voices.forEach(function (voice) { var option = document.createElement('option'); option.value = voice.id; option.textContent = voiceOptionText(voice); options.appendChild(option); });
          select.appendChild(options);
        });
        var detail = document.createElement('span'); detail.id = 'cast-voice-detail-' + speakerIndex; detail.className = 'cast-voice-detail'; detail.setAttribute('aria-live', 'polite');
        select.setAttribute('aria-describedby', detail.id);
        function updateDetail() {
          var selected = state.voices.find(function (voice) { return voice.id === select.value; }) || null;
          detail.textContent = voiceDetailText(selected); detail.hidden = !detail.textContent;
        }
        select.value = cast[speaker] || '';
        select.addEventListener('change', function () { if (select.value) cast[speaker] = select.value; else delete cast[speaker]; updateDetail(); persistVoiceSettings().catch(function (error) { setStatus(errorText(error, tr('voice.saveFailed', '音色映射保存失败')), 'error'); }); });
        updateDetail(); row.append(name, select, detail); list.appendChild(row);
      });
      content.appendChild(list);
    });
  }
  function clearAutoplay() {
    if (state.autoplayTimer) clearTimeout(state.autoplayTimer);
    state.autoplayTimer = 0;
  }
  function scheduleAutoplay() {
    clearAutoplay();
    if (state.paused || !state.autoplay || !state.currentEvent || !['say', 'narrate'].includes(state.currentEvent.type)) return;
    var delay = Math.min(8000, Math.max(2600, (state.currentEvent.text || '').length * 85));
    var expectedEvent = state.currentEvent;
    if (state.voiceEnabled && state.voiceReady) {
      Promise.resolve(state.voicePromise).then(function (played) {
        if (!state.autoplay || state.currentEvent !== expectedEvent) return;
        state.autoplayTimer = setTimeout(advance, played ? 420 : delay);
      });
      return;
    }
    state.autoplayTimer = setTimeout(advance, delay);
  }
  async function advance() {
    if (!state.runtime || !state.currentEvent || ['choice', 'end'].includes(state.currentEvent.type)) return;
    stopVoice();
    await renderEvent(state.runtime.next());
  }
  function saveSummary(event) {
    if (!event) return '';
    if (event.type === 'end') return event.title;
    return (event.speaker ? event.speaker + ' · ' : '') + (event.text || '').slice(0, 90);
  }
  function snapshotForSave() {
    var snapshot = state.runtime.snapshot();
    if (state.currentEvent && snapshot.index > 0) {
      snapshot.index -= 1;
      snapshot.ended = false;
    }
    return snapshot;
  }
  function historyForSave() {
    var history = state.history.slice(-100);
    if (state.currentEvent && ['say', 'narrate'].includes(state.currentEvent.type)) history.pop();
    return history;
  }
  async function writeSave(slot, silent) {
    if (!state.game || !state.runtime) return;
    var candidate = JSON.parse(JSON.stringify(state.saves || {}));
    if (!candidate[state.game.id]) candidate[state.game.id] = {};
    candidate[state.game.id][slot] = {
      gameHash: state.gameHash,
      gameTitle: state.game.title,
      source: state.source,
      savedAt: new Date().toISOString(),
      summary: saveSummary(state.currentEvent),
      snapshot: snapshotForSave(),
      history: historyForSave()
    };
    await Tapp.storage.set(STORAGE_KEY, candidate);
    state.saves = candidate;
    updateContinueButtons();
    if (!silent) setStatus(tr('status.saved', '存档已保存'), 'success');
  }
  async function persistAutoSave() {
    try { await writeSave(0, true); } catch (_) { /* manual save surfaces errors */ }
  }
  async function loadSave(slot) {
    var save = state.game && state.saves[state.game.id] && state.saves[state.game.id][slot];
    if (!save) return;
    if (save.gameHash !== state.gameHash) throw new Error(tr('error.saveVersion', '存档对应的游戏内容已经变化'));
    state.runtime.restore(save.snapshot);
    state.history = Array.isArray(save.history) ? save.history.slice(-100) : [];
    state.generation++;
    stopVoice();
    closeOverlay();
    await renderEvent(state.runtime.next());
  }
  function updateContinueButtons() {
    document.querySelectorAll('[data-continue-builtin]').forEach(function (button) {
      var demo = BUILTIN_DEMOS[button.getAttribute('data-continue-builtin')];
      button.hidden = !demo || !(state.saves[demo.id] && state.saves[demo.id][0]);
    });
  }
  function showLibrary() {
    state.generation++;
    clearAutoplay();
    stopVoice();
    el('bgm-player').pause();
    state.resumeBgm = false;
    document.documentElement.classList.remove('echo-playing');
    el('echo-background').classList.remove('scene-active');
    el('player-view').hidden = true;
    el('editor-view').hidden = true;
    el('library-view').hidden = false;
    document.documentElement.classList.remove('echo-editing');
    updateContinueButtons();
  }
  function openOverlay(title, render) {
    closeOverlay();
    state.overlayReturnFocus = document.activeElement;
    var overlay = el('overlay');
    overlay.hidden = false;
    el('overlay-title').textContent = title;
    var content = el('overlay-content');
    content.replaceChildren();
    render(content);
    var background = !el('player-view').hidden ? el('player-view') : !el('editor-view').hidden ? el('editor-view') : el('library-view');
    background.inert = true;
    background.setAttribute('aria-hidden', 'true');
    el('close-overlay').focus();
  }
  function closeOverlay() {
    var overlay = el('overlay');
    if (overlay.hidden) return;
    overlay.hidden = true;
    el('library-view').inert = false;
    el('editor-view').inert = false;
    el('player-view').inert = false;
    el('library-view').removeAttribute('aria-hidden');
    el('editor-view').removeAttribute('aria-hidden');
    el('player-view').removeAttribute('aria-hidden');
    if (state.overlayReturnFocus && state.overlayReturnFocus.isConnected) state.overlayReturnFocus.focus();
  }
  function showHistory() {
    openOverlay(tr('player.history', '回看'), function (content) {
      if (!state.history.length) {
        var empty = document.createElement('p'); empty.textContent = tr('history.empty', '还没有可回看的对白。'); content.appendChild(empty); return;
      }
      state.history.slice().reverse().forEach(function (item) {
        var entry = document.createElement('article'); entry.className = 'history-entry';
        if (item.speaker) { var name = document.createElement('strong'); name.textContent = item.speaker; entry.appendChild(name); }
        var text = document.createElement('p'); text.textContent = item.text; entry.appendChild(text); content.appendChild(entry);
      });
    });
  }
  function showSaves() {
    openOverlay(tr('player.saves', '存档'), function (content) {
      [1, 2, 3].forEach(function (slot) {
        var save = state.game && state.saves[state.game.id] && state.saves[state.game.id][slot];
        var row = document.createElement('div'); row.className = 'save-slot';
        var copy = document.createElement('div'); copy.className = 'save-slot-copy';
        var title = document.createElement('strong'); title.textContent = tr('save.slot', '存档位') + ' ' + slot;
        var detail = document.createElement('span'); detail.textContent = save ? save.summary + ' · ' + new Date(save.savedAt).toLocaleString() : tr('save.empty', '空');
        copy.append(title, detail);
        var saveButton = document.createElement('button'); saveButton.type = 'button'; saveButton.className = 'button subtle'; saveButton.textContent = tr('save.write', '保存');
        saveButton.addEventListener('click', async function () { try { await writeSave(slot, false); closeOverlay(); } catch (error) { setStatus(error.message, 'error'); } });
        var loadButton = document.createElement('button'); loadButton.type = 'button'; loadButton.className = 'button subtle'; loadButton.textContent = tr('save.load', '读取'); loadButton.disabled = !save;
        loadButton.addEventListener('click', async function () { try { await loadSave(slot); } catch (error) { setStatus(error.message, 'error'); } });
        row.append(copy, saveButton, loadButton); content.appendChild(row);
      });
    });
  }
  async function restart() {
    if (!state.game) return;
    state.runtime = new EchoStageEngine.Runtime(state.runtime.program);
    state.history = [];
    state.generation++;
    stopVoice();
    el('ending-card').hidden = true;
    el('dialogue-panel').hidden = false;
    await renderEvent(state.runtime.next());
  }
  function bindEvents() {
    var signal = state.abort.signal;
    el('open-folder').addEventListener('click', function () { el('folder-input').click(); }, { signal: signal });
    el('open-editor').addEventListener('click', function () { EchoStageEditor.open(); }, { signal: signal });
    el('editor-back').addEventListener('click', function () { EchoStageEditor.close(); }, { signal: signal });
    el('download-demo').addEventListener('click', downloadDemo, { signal: signal });
    el('folder-input').addEventListener('change', function (event) { loadFolder(event.target.files); }, { signal: signal });
    document.querySelectorAll('[data-play-builtin]').forEach(function (button) {
      button.addEventListener('click', function () { loadDemo(button.getAttribute('data-play-builtin'), false); }, { signal: signal });
    });
    document.querySelectorAll('[data-continue-builtin]').forEach(function (button) {
      button.addEventListener('click', function () { loadDemo(button.getAttribute('data-continue-builtin'), true); }, { signal: signal });
    });
    el('back-library').addEventListener('click', showLibrary, { signal: signal });
    el('advance-story').addEventListener('click', advance, { signal: signal });
    el('dialogue-panel').addEventListener('click', function (event) {
      if (event.target === el('dialogue-panel') || event.target === el('dialogue-text')) advance();
    }, { signal: signal });
    el('toggle-auto').addEventListener('click', function () {
      state.autoplay = !state.autoplay;
      this.setAttribute('aria-pressed', String(state.autoplay));
      el('auto-indicator').hidden = !state.autoplay;
      scheduleAutoplay();
    }, { signal: signal });
    el('toggle-voice').addEventListener('click', async function () {
      if (!state.voiceReady && !(await initializeSpeech())) { showVoiceCast(); return; }
      state.voiceEnabled = !state.voiceEnabled;
      updateVoiceControls();
      try { await persistVoiceSettings(); } catch (error) { setStatus(errorText(error, tr('voice.saveFailed', '音色映射保存失败')), 'error'); }
      stopVoice();
      if (state.voiceEnabled && state.currentEvent && ['say', 'narrate'].includes(state.currentEvent.type)) {
        state.voicePromise = speakEvent(state.currentEvent, state.generation);
      } else state.voicePromise = Promise.resolve(false);
      scheduleAutoplay();
    }, { signal: signal });
    el('open-cast').addEventListener('click', async function () { if (!state.voiceReady) await initializeSpeech(); showVoiceCast(); }, { signal: signal });
    el('open-history').addEventListener('click', showHistory, { signal: signal });
    el('open-saves').addEventListener('click', showSaves, { signal: signal });
    el('restart-story').addEventListener('click', restart, { signal: signal });
    el('close-overlay').addEventListener('click', closeOverlay, { signal: signal });
    el('overlay-backdrop').addEventListener('click', closeOverlay, { signal: signal });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Tab' && !el('overlay').hidden) {
        var focusable = Array.from(el('overlay').querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === 'Escape' && !el('overlay').hidden) { event.preventDefault(); closeOverlay(); return; }
      if (!el('player-view').hidden && el('overlay').hidden && (event.key === ' ' || event.key === 'Enter')) {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault(); advance();
      }
    }, { signal: signal });
  }
  async function applyHostPreferences() {
    try {
      var theme = await Tapp.ui.getTheme();
      document.documentElement.classList.toggle('dark', theme === 'dark' || theme === true);
      var offTheme = Tapp.ui.onThemeChange(function (next) { document.documentElement.classList.toggle('dark', next === 'dark' || next === true); });
      if (typeof offTheme === 'function') state.cleanups.push(offTheme);
    } catch (_) {}
    try {
      var animate = await Tapp.animation.shouldAnimate();
      el('echo-background').dataset.motion = animate ? 'on' : 'off';
    } catch (_) { el('echo-background').dataset.motion = 'on'; }
  }
  async function mount() {
    try {
      var locale = Tapp.i18n && Tapp.i18n.getLocale ? Tapp.i18n.getLocale() : await Tapp.ui.getLocale();
      state.locale = normalizeLocale(locale);
    } catch (_) {}
    applyTranslations();
    try { state.saves = await Tapp.storage.get(STORAGE_KEY) || {}; } catch (_) { state.saves = {}; }
    try {
      var storedVoice = await Tapp.storage.get(VOICE_STORAGE_KEY);
      if (storedVoice && typeof storedVoice === 'object') {
        state.voiceSettings = {
          enabled: Boolean(storedVoice.enabled),
          games: storedVoice.games && typeof storedVoice.games === 'object' ? storedVoice.games : {}
        };
      }
    } catch (_) {}
    state.voiceEnabled = Boolean(state.voiceSettings.enabled);
    updateVoiceControls();
    await EchoStageEditor.mount({
      tr: tr,
      locale: state.locale,
      startGame: startGame,
      fallbackAsset: function () { return builtinUrl('assets/launcher/echo-stage-library.png'); }
    });
    bindEvents();
    updateContinueButtons();
    await loadLibraryAssets();
    await applyHostPreferences();
    el('library-view').hidden = false;
    hideLoading();
    loadLibraryDecoration();
  }
  function destroy() {
    state.paused = true;
    state.generation++;
    clearAutoplay();
    stopVoice();
    state.abort.abort();
    try { EchoStageEditor.destroy(); } catch (_) {}
    document.documentElement.classList.remove('echo-playing');
    document.documentElement.classList.remove('echo-editing');
    state.cleanups.splice(0).forEach(function (cleanup) { try { cleanup(); } catch (_) {} });
    revokeLocalUrls();
    try { Tapp.assets.revokeAll(); } catch (_) {}
    state.builtinUrls.clear();
    var audio = el('bgm-player');
    if (audio) { audio.pause(); audio.removeAttribute('src'); }
  }

  Tapp.lifecycle.onReady(mount);
  Tapp.lifecycle.onPause(function () {
    state.paused = true;
    clearAutoplay();
    stopVoice();
    var audio = el('bgm-player');
    state.resumeBgm = Boolean(audio && audio.src && !audio.paused);
    if (audio) audio.pause();
  });
  Tapp.lifecycle.onResume(async function () {
    state.paused = false;
    var audio = el('bgm-player');
    if (state.resumeBgm && audio && audio.src) {
      try { await audio.play(); } catch (_) { setStatus(tr('status.audioGesture', '浏览器等待一次用户操作后才能播放音频'), 'warning'); }
    }
    state.resumeBgm = false;
    if (state.voiceEnabled && state.currentEvent && ['say', 'narrate'].includes(state.currentEvent.type)) state.voicePromise = speakEvent(state.currentEvent, state.generation);
    scheduleAutoplay();
  });
  Tapp.lifecycle.onDestroy(destroy);
})();
