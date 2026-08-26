(function (global) {
  'use strict';

  function bindHost(tapp, handlers) {
    var active = true;
    var disposed = false;
    var unsubscribe = [];
    function guarded(handler) {
      return function (value) { if (active && typeof handler === 'function') handler(value); };
    }
    function add(value) { if (typeof value === 'function') unsubscribe.push(value); }
    if (tapp.ui && typeof tapp.ui.onThemeChange === 'function') add(tapp.ui.onThemeChange(guarded(handlers.onTheme)));
    if (tapp.ui && typeof tapp.ui.onLocaleChange === 'function') add(tapp.ui.onLocaleChange(guarded(handlers.onLocale)));
    if (tapp.animation && typeof tapp.animation.onLevelChange === 'function') add(tapp.animation.onLevelChange(guarded(handlers.onAnimationLevel)));
    if (tapp.lifecycle) {
      if (typeof tapp.lifecycle.onPause === 'function') tapp.lifecycle.onPause(guarded(handlers.onPause));
      if (typeof tapp.lifecycle.onResume === 'function') tapp.lifecycle.onResume(guarded(handlers.onResume));
      if (typeof tapp.lifecycle.onDestroy === 'function') tapp.lifecycle.onDestroy(function () {
        if (!active) return;
        if (typeof handlers.onDestroy === 'function') handlers.onDestroy();
        dispose();
      });
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      unsubscribe.splice(0).forEach(function (off) { try { off(); } catch (_) {} });
    }
    return { dispose: dispose };
  }

  function createProjectController(options) {
    var project = options.initialProject;
    var generation = 0;
    function replace(next, reason) {
      generation += 1;
      project = next;
      if (typeof options.onProject === 'function') options.onProject(project, reason || 'replace');
      return project;
    }
    async function restore() {
      var expected = generation;
      var snapshot = await options.loadSnapshot();
      if (generation !== expected || snapshot === null || typeof snapshot === 'undefined') return false;
      var restored = options.parseSnapshot(snapshot);
      if (generation !== expected) return false;
      project = restored;
      generation += 1;
      if (typeof options.onProject === 'function') options.onProject(project, 'restore');
      return true;
    }
    return { replace: replace, restore: restore, getProject: function () { return project; }, getGeneration: function () { return generation; } };
  }

  function createTappStorageAdapter(tapp) {
    if (!tapp || !tapp.storage) throw new Error('Tapp storage API is unavailable');
    return {
      get: function (key) { return tapp.storage.get(key); },
      set: function (key, value) { return tapp.storage.set(key, value); },
      remove: function (key) { return tapp.storage.remove(key); },
      list: async function (prefix) {
        var keys = await tapp.storage.keys();
        return keys.filter(function (key) { return key.indexOf(prefix) === 0; }).sort();
      }
    };
  }

  function mount(root, tapp) {
    if (!root || typeof root.querySelector !== 'function') throw new Error('Page root is required');
    if (!tapp) throw new Error('Tapp SDK is required');

    var Project = global.RailwayProject;
    var Migrations = global.RailwayMigrations;
    var Geometry = global.RailwayGeometry;
    var History = global.RailwayHistory;
    var Serialization = global.RailwaySerialization;
    var Storage = global.RailwayStorage;
    var Editor = global.RailwayEditor;
    var Files = global.RailwayFiles;
    var Ticket = global.RailwayTicket;
    var Network = global.RailwayNetwork;
    var RoutePlanner = global.RailwayRoutePlanner;
    var RouteAnimation = global.RailwayRouteAnimation;
    var Animation = global.RailwayAnimation;
    if (!Project || !Migrations || !Geometry || !History || !Serialization || !Storage || !Editor || !Files || !Ticket || !Network || !RoutePlanner || !RouteAnimation || !Animation) {
      throw new Error('Railway Studio modules are incomplete');
    }

    var destroyed = false;
    var cleanup = [];
    var saveTimer = null;
    var saveGeneration = 0;
    var viewport = { x: 0, y: 0, scale: 1 };
    var pointerState = null;
    var previousFocus = null;
    var sessionBackgrounds = new Map();
    var backgroundImage = null;
    var backgroundImageSource = null;
    var backgroundLoadToken = 0;
    var project = Project.createProject();
    var history = null;
    var editor = null;
    var currentTimelinePosition = 0;
    var routePlacement = null;
    var routeInventoryFilter = 'pending';
    var routeReminderDismissed = false;
    var idCounter = 0;
    var store = Storage.createStore(createTappStorageAdapter(tapp), { prefix: 'railway-studio.project.v1' });

    function query(selector) { return root.querySelector(selector); }
    function queryAll(selector) { return Array.from(root.querySelectorAll(selector)); }
    var sceneSvg = query('#railway-scene');
    var sceneViewport = query('#scene-viewport');
    var stage = query('#drafting-stage');
    var backgroundCanvas = query('#background-canvas');
    if (!sceneSvg || !sceneViewport || !stage || !backgroundCanvas) throw new Error('Page root is missing required editor elements');

    function listen(target, type, handler, options) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(type, handler, options);
      cleanup.push(function () { target.removeEventListener(type, handler, options); });
    }

    function translate(key, fallback) {
      try {
        var value = tapp.i18n && typeof tapp.i18n.t === 'function' ? tapp.i18n.t(key) : null;
        if (typeof value === 'string' && value && value !== key) return value;
      } catch (_) {}
      return fallback || key;
    }

    function setStatus(key, fallback) {
      var output = query('#app-status');
      if (output) output.textContent = translate(key, fallback);
    }

    function applyI18n() {
      queryAll('[data-i18n]').forEach(function (element) {
        element.textContent = translate(element.getAttribute('data-i18n'), element.textContent);
      });
      queryAll('[data-i18n-aria]').forEach(function (element) {
        element.setAttribute('aria-label', translate(element.getAttribute('data-i18n-aria'), element.getAttribute('aria-label')));
      });
    }

    function applyTheme(theme) {
      var light = theme === true || theme === 'light' || theme === 'Light';
      root.setAttribute('data-theme', light ? 'light' : 'dark');
    }

    function touchProject() {
      project.meta.updatedAt = new Date().toISOString();
    }

    function createRuntimeId(prefix) {
      var bytes = new Uint8Array(8);
      if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
        global.crypto.getRandomValues(bytes);
        return prefix + '-' + Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
      }
      idCounter += 1;
      return prefix + '-' + Date.now().toString(36) + '-' + idCounter.toString(36);
    }

    function scheduleSave() {
      if (destroyed) return;
      saveGeneration += 1;
      var expected = saveGeneration;
      if (saveTimer !== null) global.clearTimeout(saveTimer);
      saveTimer = global.setTimeout(function () {
        saveTimer = null;
        var snapshot;
        try { snapshot = Serialization.serializePortable(project); }
        catch (error) { setStatus('status.invalid', '工程无效，未保存'); return; }
        store.save(snapshot).then(function () {
          if (!destroyed && expected === saveGeneration) setStatus('status.saved', '工程已自动保存');
        }).catch(function (error) {
          if (!destroyed && expected === saveGeneration) {
            console.error('[Railway Studio] autosave failed', error);
            setStatus('status.saveFailed', '自动保存失败，请导出 JSON 备份');
          }
        });
      }, 350);
    }

    function markChanged() {
      touchProject();
      renderAll();
      scheduleSave();
    }

    function makeEditor() {
      history = History.createHistory(100);
      editor = Editor.createEditor({
        project: project,
        history: history,
        idFactory: createRuntimeId,
        onChange: function () { markChanged(); }
      });
    }

    function diagnostics() {
      var result = Project.validateProject(project).errors.slice();
      var linkedStations = new Set();
      project.network.edges.forEach(function (edge) { linkedStations.add(edge.fromStationId); linkedStations.add(edge.toStationId); });
      project.stations.forEach(function (station) {
        if (!Project.isStationPlaced(station)) result.push({ code: 'unplaced-station', targetId: station.id, message: station.name + ': station is not placed' });
        else if (!linkedStations.has(station.id)) result.push({ code: 'unlinked-station', targetId: station.id, message: station.name + ': unlinked station' });
      });
      project.lines.forEach(function (line) {
        if (!line.paths.length) result.push({ code: 'empty-line', targetId: line.id, message: line.name + ': line has no geometry' });
      });
      return result;
    }

    function createSvg(name, attributes) {
      var element = sceneSvg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', name);
      Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, attributes[key]); });
      return element;
    }

    function renderGrid() {
      stage.setAttribute('data-grid-enabled', project.settings.grid.enabled ? 'true' : 'false');
      if (!project.settings.grid.enabled) return;
      var rect = sceneSvg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      var frame = Geometry.containFrame(project.canvas, { width: rect.width, height: rect.height });
      var step = project.settings.grid.size * frame.scale * viewport.scale;
      stage.style.setProperty('--railway-grid-step', step + 'px');
      stage.style.setProperty('--railway-grid-origin-x', (frame.offsetX + viewport.x * frame.scale) + 'px');
      stage.style.setProperty('--railway-grid-origin-y', (frame.offsetY + viewport.y * frame.scale) + 'px');
    }

    function backgroundSource() {
      var asset = project.assets.find(function (entry) { return entry.id === project.canvas.backgroundAssetId; });
      if (!asset) return null;
      return asset.mode === 'embedded' ? asset.dataUrl : sessionBackgrounds.get(asset.id) || null;
    }

    function layoutBackground() {
      var rect = sceneSvg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      var plane = Geometry.scenePlane(project.canvas, { width: rect.width, height: rect.height }, viewport);
      backgroundCanvas.style.left = plane.left + 'px';
      backgroundCanvas.style.top = plane.top + 'px';
      backgroundCanvas.style.width = plane.width + 'px';
      backgroundCanvas.style.height = plane.height + 'px';
      backgroundCanvas.style.transform = 'matrix(' + plane.scale + ', 0, 0, ' + plane.scale + ', ' + plane.translateX + ', ' + plane.translateY + ')';
    }

    function paintBackground(image) {
      var width = project.canvas.width;
      var height = project.canvas.height;
      var context = backgroundCanvas.getContext('2d');
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!image) return;
      var scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      var drawWidth = image.naturalWidth * scale;
      var drawHeight = image.naturalHeight * scale;
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function drawBackground() {
      var canvas = backgroundCanvas;
      var width = project.canvas.width;
      var height = project.canvas.height;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      layoutBackground();
      var source = backgroundSource();
      if (!source) {
        backgroundImage = null;
        backgroundImageSource = null;
        backgroundLoadToken += 1;
        paintBackground(null);
        return;
      }
      if (backgroundImage && backgroundImageSource === source) {
        paintBackground(backgroundImage);
        return;
      }
      if (backgroundImageSource === source) return;
      backgroundImageSource = source;
      backgroundImage = null;
      backgroundLoadToken += 1;
      var loadToken = backgroundLoadToken;
      paintBackground(null);
      var image = new Image();
      var expectedProject = project.meta.id;
      image.onload = function () {
        if (destroyed || loadToken !== backgroundLoadToken || project.meta.id !== expectedProject || source !== backgroundSource()) return;
        backgroundImage = image;
        paintBackground(image);
      };
      image.onerror = function () {
        if (loadToken !== backgroundLoadToken) return;
        backgroundImageSource = null;
        setStatus('status.backgroundFailed', '背景图无法解码');
      };
      image.src = source;
    }

    function findSelectedObject() {
      var selection = editor.getSelection();
      if (!selection) return null;
      var collection = selection.type === 'line' ? project.lines : selection.type === 'station' ? project.stations : selection.type === 'text' ? project.texts : [];
      return collection.find(function (entry) { return entry.id === selection.id; }) || null;
    }

    function appendOption(select, value, label) {
      var option = select.ownerDocument.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }

    function refillSelect(select, values, selected) {
      if (!select) return;
      var previous = select.value;
      if (!values.some(function (entry) { return entry.id === previous; })) previous = selected || '';
      select.replaceChildren();
      values.forEach(function (entry) { appendOption(select, entry.id, entry.name); });
      if (values.some(function (entry) { return entry.id === previous; })) select.value = previous;
    }

    function renderObjectList() {
      var list = query('#object-list');
      if (!list) return;
      list.replaceChildren();
      var selection = editor.getSelection();
      [
        { type: 'line', values: project.lines },
        { type: 'station', values: project.stations },
        { type: 'text', values: project.texts }
      ].forEach(function (group) {
        group.values.forEach(function (value) {
          var item = list.ownerDocument.createElement('li');
          var button = list.ownerDocument.createElement('button');
          button.type = 'button';
          button.setAttribute('data-action', 'select-object');
          button.setAttribute('data-type', group.type);
          button.setAttribute('data-id', value.id);
          button.textContent = (group.type === 'line' ? '⌁ ' : group.type === 'station' ? '● ' : 'T ') + (value.name || value.text);
          if (selection && selection.type === group.type && selection.id === value.id) button.classList.add('is-selected');
          item.appendChild(button);
          list.appendChild(item);
        });
      });
    }

    function renderProperties() {
      var selected = findSelectedObject();
      var selection = editor.getSelection();
      var name = query('#property-name');
      var color = query('#property-color');
      var width = query('#property-width');
      [name, color, width].forEach(function (control) { if (control) control.disabled = !selected; });
      if (selected) {
        name.value = selected.name || selected.text || '';
        color.value = selected.style.color;
        width.max = selection.type === 'text' ? '256' : '64';
        width.value = selection.type === 'line' ? selected.style.width : selection.type === 'station' ? selected.style.radius : selected.style.size;
      } else {
        name.value = '';
      }
      var track = selection && ['line', 'station', 'text'].includes(selection.type) ? project.timeline.tracks.find(function (entry) {
        return entry.targetType === selection.type && entry.targetId === selection.id;
      }) : null;
      query('#track-start').value = track ? track.startMs : 0;
      query('#track-duration').value = track ? track.durationMs : 900;
      query('#track-effect').value = track ? track.effect : 'fade';
      query('#track-easing').value = track ? track.easing : 'ease-out';
      var trackButton = query('[data-action="set-track"]');
      if (trackButton) trackButton.disabled = !selected;
      var upgradeButton = query('#upgrade-endpoint-button');
      if (upgradeButton) {
        var reference = selection && selection.type === 'point' ? pointReference(selection.id) : null;
        var endpoint = reference && (reference.pointIndex === 0 || reference.pointIndex === reference.path.points.length - 1);
        var occupied = endpoint && reference.point.junctionId && project.stations.some(function (station) { return station.placement && station.placement.junctionId === reference.point.junctionId; });
        upgradeButton.hidden = !endpoint || Boolean(occupied);
        upgradeButton.disabled = !endpoint || Boolean(occupied);
      }
    }

    function routeAnimationControls() {
      return {
        from: query('#route-animation-from'),
        to: query('#route-animation-to'),
        summary: query('#route-animation-summary'),
        showBase: query('#route-animation-show-base'),
        baseState: query('#route-animation-base-state'),
        color: query('#route-animation-color'),
        width: query('#route-animation-width'),
        start: query('#route-animation-start'),
        duration: query('#route-animation-duration'),
        easing: query('#route-animation-easing'),
        apply: query('[data-action="apply-route-animation"]'),
        recalculate: query('[data-action="recalculate-route-animation"]'),
        remove: query('[data-action="remove-route-animation"]')
      };
    }

    function matchingRouteTrack(fromStationId, toStationId) {
      return project.timeline.tracks.find(function (track) {
        return track.targetType === 'route' && track.route && track.route.fromStationId === fromStationId && track.route.toStationId === toStationId;
      }) || null;
    }

    function readRouteAnimationSettings(controls) {
      return {
        startMs: Number(controls.start.value),
        durationMs: Number(controls.duration.value),
        easing: controls.easing.value,
        showBaseRoute: controls.showBase.checked,
        color: controls.color.value,
        width: Number(controls.width.value)
      };
    }

    function routeAnimationErrorText(error) {
      if (error && error.code === 'MISSING_GEOMETRY') return translate('animation.missingGeometry', '路线缺少线路几何绑定，请先补齐交通连接');
      if (error && error.code === 'UNREACHABLE') return translate('animation.unreachable', '起点与终点尚未连通');
      return translate('animation.invalid', '无法创建这条行程动画');
    }

    function renderAnimationPanel() {
      var controls = routeAnimationControls();
      var stations = project.stations.filter(Project.isStationPlaced);
      var values = stations.map(function (station) { return { id: station.id, name: station.name }; });
      refillSelect(controls.from, values);
      refillSelect(controls.to, values, values[1] && values[1].id);
      if (values.length > 1 && controls.from.value === controls.to.value) controls.to.value = values[1].id;
      var existing = matchingRouteTrack(controls.from.value, controls.to.value);
      if (existing && root.ownerDocument.activeElement !== controls.start && root.ownerDocument.activeElement !== controls.duration) {
        controls.start.value = existing.startMs;
        controls.duration.value = existing.durationMs;
        controls.easing.value = existing.easing;
        controls.showBase.checked = existing.showBaseRoute;
        controls.color.value = existing.overlayStyle.color;
        controls.width.value = existing.overlayStyle.width;
      }
      controls.baseState.textContent = translate(controls.showBase.checked ? 'animation.on' : 'animation.off', controls.showBase.checked ? '开' : '关');
      controls.showBase.setAttribute('aria-checked', controls.showBase.checked ? 'true' : 'false');
      controls.remove.disabled = !existing;
      controls.recalculate.disabled = !existing;
      controls.apply.disabled = true;
      if (values.length < 2 || !controls.from.value || !controls.to.value || controls.from.value === controls.to.value) {
        controls.summary.textContent = translate('animation.noRoute', '请选择可连通的起点和终点');
        return;
      }
      try {
        RouteAnimation.createTrack(project, controls.from.value, controls.to.value, Object.assign(readRouteAnimationSettings(controls), {
          idFactory: function () { return 'track-route-preview'; }
        }));
        var route = Network.findRoute(project, controls.from.value, controls.to.value);
        var names = new Map(project.stations.map(function (station) { return [station.id, station.name]; }));
        controls.summary.textContent = translate('animation.routeSummary', '{stations} · {minutes} 分钟 · {distance} 距离单位 · {transfers} 次换乘')
          .replace('{stations}', route.stationIds.map(function (stationId) { return names.get(stationId) || stationId; }).join(' → '))
          .replace('{minutes}', String(Number(route.totalMinutes.toFixed(2))))
          .replace('{distance}', String(Number(route.totalDistanceUnits.toFixed(2))))
          .replace('{transfers}', String(route.transferCount));
        controls.apply.disabled = false;
        controls.recalculate.disabled = !existing;
      } catch (error) {
        controls.summary.textContent = routeAnimationErrorText(error);
      }
    }

    function renderNetwork() {
      var stationValues = project.stations.filter(Project.isStationPlaced).map(function (station) { return { id: station.id, name: station.name }; });
      var lineValues = project.lines.map(function (line) { return { id: line.id, name: line.name }; });
      refillSelect(query('#edge-from'), stationValues);
      refillSelect(query('#edge-to'), stationValues, stationValues[1] && stationValues[1].id);
      refillSelect(query('#edge-line'), lineValues);
      if (stationValues.length > 1 && query('#edge-from').value === query('#edge-to').value) query('#edge-to').value = stationValues[1].id;
      var ticketStations = query('#ticket-stations');
      ticketStations.replaceChildren();
      project.stations.forEach(function (station) {
        var option = ticketStations.ownerDocument.createElement('option');
        option.value = station.name;
        ticketStations.appendChild(option);
      });
      var list = query('#edge-list');
      list.replaceChildren();
      var stations = new Map(project.stations.map(function (station) { return [station.id, station.name]; }));
      var lines = new Map(project.lines.map(function (line) { return [line.id, line.name]; }));
      project.network.edges.forEach(function (edge) {
        var item = list.ownerDocument.createElement('li');
        var label = list.ownerDocument.createElement('span');
        label.textContent = (stations.get(edge.fromStationId) || edge.fromStationId) + (edge.bidirectional ? ' ↔ ' : ' → ') + (stations.get(edge.toStationId) || edge.toStationId) + ' · ' + (lines.get(edge.lineId) || edge.lineId);
        var button = list.ownerDocument.createElement('button');
        button.type = 'button';
        button.setAttribute('data-action', 'delete-edge');
        button.setAttribute('data-edge-id', edge.id);
        button.textContent = '×';
        button.setAttribute('aria-label', translate('network.delete', '删除交通边'));
        item.appendChild(label);
        item.appendChild(button);
        list.appendChild(item);
      });
    }

    function routeStateLabel(state) {
      var values = {
        'missing-both': ['route.missingBoth', '缺少起点和终点位置'],
        'missing-origin': ['route.missingOrigin', '缺少起点位置'],
        'missing-destination': ['route.missingDestination', '缺少终点位置'],
        disconnected: ['route.disconnected', '站点之间尚未连通']
      };
      var value = values[state] || ['route.disconnected', '站点之间尚未连通'];
      return translate(value[0], value[1]);
    }

    function renderRouteInventory() {
      var inventory = query('#route-inventory');
      var list = query('#route-card-list');
      var stations = new Map(project.stations.map(function (station) { return [station.id, station]; }));
      var allPending = RoutePlanner.listPending(project, { includeDismissed: true });
      var visible = allPending.filter(function (entry) {
        return routeInventoryFilter === 'ignored' ? entry.request.dismissed : !entry.request.dismissed;
      });
      list.replaceChildren();
      visible.forEach(function (entry) {
        var request = entry.request;
        var origin = stations.get(request.fromStationId);
        var destination = stations.get(request.toStationId);
        var card = list.ownerDocument.createElement('article');
        card.className = 'route-card';
        card.setAttribute('role', 'listitem');
        card.tabIndex = 0;
        card.setAttribute('data-request-id', request.id);
        card.setAttribute('data-state', entry.classification.state);

        var heading = list.ownerDocument.createElement('div');
        heading.className = 'route-card-heading';
        var title = list.ownerDocument.createElement('strong');
        title.textContent = origin.name + ' → ' + destination.name;
        var service = list.ownerDocument.createElement('span');
        service.textContent = request.service;
        heading.appendChild(title);
        heading.appendChild(service);

        var status = list.ownerDocument.createElement('div');
        status.className = 'route-card-status';
        status.textContent = routeStateLabel(entry.classification.state);
        card.appendChild(heading);
        card.appendChild(status);

        if (!request.dismissed) {
          var controls = list.ownerDocument.createElement('div');
          controls.className = 'route-card-controls';
          var lineSelect = list.ownerDocument.createElement('select');
          lineSelect.setAttribute('data-role', 'route-line');
          lineSelect.setAttribute('aria-label', translate('network.line', '所属线路'));
          appendOption(lineSelect, '', translate('route.newLine', '新建线路'));
          project.lines.forEach(function (line) { appendOption(lineSelect, line.id, line.name); });
          if (request.preferredLineId) lineSelect.value = request.preferredLineId;
          var minutes = list.ownerDocument.createElement('input');
          minutes.type = 'number';
          minutes.min = '0.1';
          minutes.step = '0.1';
          minutes.value = '5';
          minutes.setAttribute('data-role', 'route-minutes');
          minutes.setAttribute('aria-label', translate('route.minutes', '预计分钟'));
          controls.appendChild(lineSelect);
          controls.appendChild(minutes);
          card.appendChild(controls);
        }

        var actions = list.ownerDocument.createElement('div');
        actions.className = 'route-card-actions';
        var primary = list.ownerDocument.createElement('button');
        primary.type = 'button';
        primary.setAttribute('data-request-id', request.id);
        primary.setAttribute('data-action', request.dismissed ? 'restore-route' : 'start-route-placement');
        primary.textContent = request.dismissed ? translate('route.restore', '恢复') : translate('route.place', '开始放置');
        primary.disabled = Boolean(routePlacement);
        actions.appendChild(primary);
        if (!request.dismissed) {
          var ignore = list.ownerDocument.createElement('button');
          ignore.type = 'button';
          ignore.setAttribute('data-action', 'ignore-route');
          ignore.setAttribute('data-request-id', request.id);
          ignore.textContent = translate('route.ignore', '暂时忽略');
          ignore.disabled = Boolean(routePlacement);
          actions.appendChild(ignore);
        }
        card.appendChild(actions);
        list.appendChild(card);
      });
      if (!visible.length) {
        var empty = list.ownerDocument.createElement('p');
        empty.textContent = translate('route.empty', '没有符合筛选条件的路线');
        list.appendChild(empty);
      }
      query('#route-inventory-count').textContent = String(visible.length);
      query('#route-placement-actions').hidden = !routePlacement;
      query('#close-route-inventory').disabled = Boolean(routePlacement);
      queryAll('[data-action="show-pending-routes"], [data-action="show-ignored-routes"]').forEach(function (button) {
        var active = button.getAttribute('data-action') === (routeInventoryFilter === 'ignored' ? 'show-ignored-routes' : 'show-pending-routes');
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      var activeCount = allPending.filter(function (entry) { return !entry.request.dismissed; }).length;
      query('#route-toolbar-count').textContent = String(activeCount);
      query('#route-inventory-toggle').setAttribute('aria-expanded', inventory.hidden ? 'false' : 'true');
      query('#route-inventory-toggle').disabled = Boolean(routePlacement);
      query('#route-reminder-text').textContent = translate('route.reminder', '有 {count} 条车票路线尚未绘制').replace('{count}', String(activeCount));
      query('#route-reminder').hidden = !activeCount || routeReminderDismissed || !inventory.hidden || Boolean(routePlacement);
    }

    function renderDiagnostics() {
      var list = query('#diagnostic-list');
      list.replaceChildren();
      var values = diagnostics();
      if (!values.length) {
        var clean = list.ownerDocument.createElement('li');
        clean.textContent = translate('diagnostics.clean', '工程结构完整');
        list.appendChild(clean);
        return;
      }
      values.forEach(function (entry) {
        var item = list.ownerDocument.createElement('li');
        item.textContent = entry.path ? entry.path + ': ' + entry.message : entry.message;
        list.appendChild(item);
      });
    }

    function renderPreviewGesture() {
      var layer = query('#interaction-layer');
      if (routePlacement && layer) {
        var routePoints = routePlacement.points.slice();
        if (routePlacement.preview) routePoints.push(routePlacement.preview);
        if (routePlacement.fixedDestination && routePoints.length > 1) routePoints.push(routePlacement.fixedDestination);
        if (routePoints.length > 1) {
          var routeCommands = routePoints.map(function (point, index) { return (index ? 'L ' : 'M ') + point.x + ' ' + point.y; });
          layer.appendChild(createSvg('path', { d: routeCommands.join(' '), class: 'gesture-preview route-placement-preview' }));
        }
        routePlacement.points.forEach(function (point) {
          layer.appendChild(createSvg('circle', { cx: point.x, cy: point.y, r: 5, class: 'gesture-preview' }));
        });
        return;
      }
      var preview = editor.getPreview();
      if (!preview || !layer) return;
      if (preview.type === 'line') {
        var path = createSvg('path', { d: 'M ' + preview.start.x + ' ' + preview.start.y + ' L ' + preview.end.x + ' ' + preview.end.y, class: 'gesture-preview' });
        layer.appendChild(path);
      } else if (preview.type === 'line-draft') {
        var points = preview.points.slice();
        if (preview.end) points.push(preview.end);
        if (points.length > 1) {
          var commands = points.map(function (point, index) { return (index ? 'L ' : 'M ') + point.x + ' ' + point.y; });
          layer.appendChild(createSvg('path', { d: commands.join(' '), class: 'gesture-preview' }));
        }
        preview.points.forEach(function (point) {
          layer.appendChild(createSvg('circle', { cx: point.x, cy: point.y, r: 5, class: 'gesture-preview' }));
        });
      } else if (preview.type === 'station') {
        layer.appendChild(createSvg('circle', { cx: preview.end.x, cy: preview.end.y, r: 8, class: 'gesture-preview' }));
      }
    }

    function ease(value, easing) {
      if (easing === 'ease-in') return value * value;
      if (easing === 'ease-out') return 1 - Math.pow(1 - value, 2);
      if (easing === 'ease-in-out') return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
      return value;
    }

    function applyTrackAnimation(position) {
      queryAll('#line-layer [data-type], #station-layer [data-type], #text-layer [data-type]').forEach(function (element) {
        element.style.opacity = '';
        element.style.strokeDasharray = '';
        element.style.strokeDashoffset = '';
      });
      project.timeline.tracks.forEach(function (track) {
        if (track.targetType === 'route') return;
        var raw = Math.max(0, Math.min(1, (position - track.startMs) / track.durationMs));
        var progress = ease(raw, track.easing);
        queryAll('[data-type="' + track.targetType + '"]').filter(function (element) { return element.getAttribute('data-id') === track.targetId; }).forEach(function (element) {
          if (track.effect === 'draw' && track.targetType === 'line' && typeof element.getTotalLength === 'function') {
            var length = element.getTotalLength();
            element.style.strokeDasharray = String(length);
            element.style.strokeDashoffset = String(length * (1 - progress));
          } else if (track.effect === 'pulse' && raw > 0 && raw < 1) {
            element.style.opacity = String(0.58 + Math.sin(progress * Math.PI * 4) * 0.32);
          } else {
            element.style.opacity = String(progress);
          }
        });
      });
      Editor.renderRouteAnimation(sceneSvg, project, position);
    }

    function renderTimeline(position, duration) {
      currentTimelinePosition = position;
      var slider = query('#timeline-position');
      slider.max = String(duration);
      slider.value = String(position);
      query('#timeline-time').textContent = (position / 1000).toFixed(1) + 's / ' + (duration / 1000).toFixed(1) + 's';
      var playButton = query('[data-action="play-timeline"]');
      if (playButton) playButton.setAttribute('aria-pressed', timeline.getState().playing ? 'true' : 'false');
      applyTrackAnimation(position);
    }

    var timeline = Animation.createTimeline(
      function () { return global.performance && typeof global.performance.now === 'function' ? global.performance.now() : Date.now(); },
      {
        request: function (callback) { return global.requestAnimationFrame(callback); },
        cancel: function (id) { global.cancelAnimationFrame(id); }
      },
      { durationMs: project.timeline.durationMs, onFrame: function (_, position, duration) { renderTimeline(position, duration); } }
    );

    function renderAll() {
      if (destroyed) return;
      sceneSvg.setAttribute('viewBox', '0 0 ' + project.canvas.width + ' ' + project.canvas.height);
      sceneViewport.setAttribute('transform', 'translate(' + viewport.x + ' ' + viewport.y + ') scale(' + viewport.scale + ')');
      Editor.renderSvg(sceneSvg, Editor.buildScene(project, editor.getSelection(), diagnostics()));
      renderGrid();
      renderPreviewGesture();
      drawBackground();
      renderObjectList();
      renderProperties();
      renderNetwork();
      renderAnimationPanel();
      renderRouteInventory();
      renderDiagnostics();
      var projectNameInput = query('#project-name');
      if (root.ownerDocument.activeElement !== projectNameInput) projectNameInput.value = project.meta.name;
      query('#zoom-level').textContent = Math.round(viewport.scale * 100) + '%';
      query('#empty-canvas').hidden = Boolean(project.lines.length || project.stations.some(Project.isStationPlaced) || project.texts.length || project.canvas.backgroundAssetId);
      query('[data-action="undo"]').disabled = !history.canUndo();
      query('[data-action="redo"]').disabled = !history.canRedo();
      query('[data-action="delete-selection"]').disabled = !editor.getSelection();
      query('[data-action="toggle-grid"]').setAttribute('aria-pressed', project.settings.grid.enabled ? 'true' : 'false');
      var snapSwitch = query('#snap-toggle');
      snapSwitch.checked = project.settings.snap.enabled;
      snapSwitch.setAttribute('aria-checked', project.settings.snap.enabled ? 'true' : 'false');
      query('#snap-state').textContent = translate(project.settings.snap.enabled ? 'canvas.snapOn' : 'canvas.snapOff', project.settings.snap.enabled ? '开' : '关');
      applyTrackAnimation(currentTimelinePosition);
    }

    function adoptProject(next, reason) {
      project = Project.normalizeProject(next);
      viewport = { x: 0, y: 0, scale: 1 };
      routePlacement = null;
      routeReminderDismissed = false;
      if (reason !== 'restore') sessionBackgrounds.clear();
      makeEditor();
      timeline.stop();
      timeline.setDuration(project.timeline.durationMs);
      renderAll();
      if (reason === 'restore') setStatus('status.restored', '已恢复上次工程');
      else if (reason === 'import') setStatus('status.imported', '工程导入成功');
      else if (reason === 'new') setStatus('status.created', '已创建新工程');
      if (reason && reason !== 'restore') scheduleSave();
    }

    makeEditor();
    var controller = createProjectController({
      initialProject: project,
      loadSnapshot: function () { return store.load(); },
      parseSnapshot: function (snapshot) { return Serialization.parseProjectText(snapshot); },
      onProject: adoptProject
    });

    function screenPoint(event) {
      var rect = sceneSvg.getBoundingClientRect();
      var frame = Geometry.containFrame(project.canvas, { width: rect.width, height: rect.height });
      return {
        x: (event.clientX - rect.left - frame.offsetX) / frame.scale,
        y: (event.clientY - rect.top - frame.offsetY) / frame.scale
      };
    }

    function snapTarget(event, excludedIds) {
      var world = Geometry.screenToWorld(screenPoint(event), viewport);
      var excluded = new Set(excludedIds || []);
      var targets = new Map();
      var candidates = [];
      project.junctions.forEach(function (junction) {
        if (excluded.has(junction.id)) return;
        candidates.push({ id: junction.id, x: junction.x, y: junction.y });
        targets.set(junction.id, { type: 'junction', id: junction.id });
      });
      project.lines.forEach(function (line) {
        line.paths.forEach(function (path) {
          path.points.forEach(function (point) {
            if (point.junctionId || excluded.has(point.id)) return;
            candidates.push({ id: point.id, x: point.x, y: point.y });
            targets.set(point.id, { type: 'point', id: point.id, lineId: line.id, pathId: path.id });
          });
        });
      });
      project.stations.forEach(function (station) {
        if (!Project.isStationPlaced(station) || station.placement.junctionId || excluded.has(station.id)) return;
        candidates.push({ id: station.id, x: station.placement.x, y: station.placement.y });
        targets.set(station.id, { type: 'station', id: station.id });
      });
      var result = Geometry.snapPoint(world, {
        enabled: project.settings.snap.enabled,
        threshold: project.settings.snap.distance / viewport.scale,
        gridSize: project.settings.grid.size,
        candidates: candidates
      });
      return { point: result.point, target: result.targetId ? targets.get(result.targetId) || null : null };
    }

    function snappedWorld(event, excludedIds) {
      return snapTarget(event, excludedIds).point;
    }

    function pointReference(pointId) {
      for (var lineIndex = 0; lineIndex < project.lines.length; lineIndex += 1) {
        var line = project.lines[lineIndex];
        for (var pathIndex = 0; pathIndex < line.paths.length; pathIndex += 1) {
          var path = line.paths[pathIndex];
          var pointIndex = path.points.findIndex(function (entry) { return entry.id === pointId; });
          var point = pointIndex >= 0 ? path.points[pointIndex] : null;
          if (point) return { lineId: line.id, pathId: path.id, pointId: point.id, point: point, path: path, pointIndex: pointIndex };
        }
      }
      return null;
    }

    function restoreTransientPointer() {
      if (!pointerState) return;
      if (pointerState.kind === 'object' && pointerState.target) {
        if (pointerState.junctionId) Project.syncJunction(project, pointerState.junctionId, pointerState.original);
        else {
          pointerState.target.x = pointerState.original.x;
          pointerState.target.y = pointerState.original.y;
        }
        return;
      }
      if (!pointerState.reference) return;
      var point = pointerState.reference.point;
      if (pointerState.kind === 'point') {
        if (pointerState.junctionId) Project.syncJunction(project, pointerState.junctionId, pointerState.original);
        else {
          point.x = pointerState.original.x;
          point.y = pointerState.original.y;
        }
      } else if (pointerState.kind === 'handle') {
        point[pointerState.handle] = pointerState.original ? { x: pointerState.original.x, y: pointerState.original.y } : null;
      }
    }

    function selectFromTarget(target) {
      var selectable = target && target.closest ? target.closest('[data-type][data-id]') : null;
      if (!selectable || !sceneSvg.contains(selectable)) {
        editor.select(null);
        renderAll();
        return false;
      }
      editor.select({ type: selectable.getAttribute('data-type'), id: selectable.getAttribute('data-id') });
      renderAll();
      return true;
    }

    listen(stage, 'pointerdown', function (event) {
      if (event.button !== 0) return;
      if (routePlacement) {
        event.preventDefault();
        return;
      }
      var handle = event.target.closest && event.target.closest('[data-handle][data-point-id]');
      var pointElement = event.target.closest && event.target.closest('[data-type="point"]');
      if (editor.getTool() === 'station' && pointElement) {
        var upgradeReference = pointReference(pointElement.getAttribute('data-id'));
        if (!upgradeReference) return;
        try {
          editor.upgradeEndpointToStation(upgradeReference);
          setStatus('status.stationUpgraded', '线路端点已升级为站点');
        } catch (error) {
          setStatus('status.actionFailed', error.message || '端点无法升级');
        }
        renderAll();
        event.preventDefault();
        return;
      }
      if (editor.getTool() === 'line') {
        event.preventDefault();
        return;
      }
      if (editor.getTool() === 'select' && (handle || pointElement)) {
        var pointId = (handle || pointElement).getAttribute(handle ? 'data-point-id' : 'data-id');
        var reference = pointReference(pointId);
        if (!reference) return;
        editor.select({ type: 'point', id: pointId });
        var handleName = handle && handle.getAttribute('data-handle');
        var original = handleName ? reference.point[handleName] : reference.point;
        var pointJunction = !handleName && reference.point.junctionId ? Project.findJunction(project, reference.point.junctionId) : null;
        var pointOriginal = pointJunction || original;
        pointerState = { kind: handleName ? 'handle' : 'point', handle: handleName, reference: reference, junctionId: pointJunction && pointJunction.id, original: { x: pointOriginal.x, y: pointOriginal.y }, last: snappedWorld(event, [reference.point.id, reference.point.junctionId]), pointerId: event.pointerId };
        stage.setPointerCapture(event.pointerId);
        renderAll();
        event.preventDefault();
        return;
      }
      if (editor.getTool() === 'select') {
        var objectElement = event.target.closest && event.target.closest('[data-type="station"], [data-type="text"]');
        if (objectElement && sceneSvg.contains(objectElement)) {
          var type = objectElement.getAttribute('data-type');
          var collection = type === 'station' ? project.stations : project.texts;
          var target = collection.find(function (entry) { return entry.id === objectElement.getAttribute('data-id'); });
          if (target) {
            editor.select({ type: type, id: target.id });
            var stationPlacement = type === 'station' ? target.placement : null;
            var objectJunction = stationPlacement && stationPlacement.junctionId ? Project.findJunction(project, stationPlacement.junctionId) : null;
            var objectCoordinates = stationPlacement || target;
            var objectOriginal = objectJunction || objectCoordinates;
            pointerState = { kind: 'object', pointerId: event.pointerId, target: objectCoordinates, targetId: target.id, junctionId: objectJunction && objectJunction.id, original: { x: objectOriginal.x, y: objectOriginal.y }, last: snappedWorld(event, [target.id, stationPlacement && stationPlacement.junctionId]) };
            stage.setPointerCapture(event.pointerId);
            renderAll();
            event.preventDefault();
            return;
          }
        }
        selectFromTarget(event.target);
        return;
      }
      if (editor.getTool() === 'text') {
        try { editor.createText(snappedWorld(event), translate('tool.defaultText', '文字')); setStatus('status.textCreated', '已添加文字'); }
        catch (error) { setStatus('status.actionFailed', error.message); }
        return;
      }
      if (editor.getTool() === 'pan') {
        pointerState = { kind: 'pan', pointerId: event.pointerId, startClient: { x: event.clientX, y: event.clientY }, originalViewport: Object.assign({}, viewport) };
      } else {
        editor.pointerDown(snappedWorld(event), { curve: event.altKey });
        pointerState = { kind: 'gesture', pointerId: event.pointerId };
      }
      stage.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    listen(stage, 'pointermove', function (event) {
      if (routePlacement && !pointerState) {
        routePlacement.preview = snappedWorld(event);
        renderAll();
        return;
      }
      if (!pointerState && editor.getTool() === 'line' && editor.getPreview()) {
        editor.updateLinePreview(snapTarget(event).point);
        renderAll();
        return;
      }
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      if (pointerState.kind === 'pan') {
        var rect = sceneSvg.getBoundingClientRect();
        var frame = Geometry.containFrame(project.canvas, { width: rect.width, height: rect.height });
        viewport.x = pointerState.originalViewport.x + (event.clientX - pointerState.startClient.x) / frame.scale;
        viewport.y = pointerState.originalViewport.y + (event.clientY - pointerState.startClient.y) / frame.scale;
      } else if (pointerState.kind === 'gesture') {
        editor.pointerMove(snappedWorld(event));
      } else if (pointerState.kind === 'object') {
        var objectPoint = snappedWorld(event, [pointerState.targetId, pointerState.junctionId]);
        pointerState.last = objectPoint;
        if (pointerState.junctionId) Project.syncJunction(project, pointerState.junctionId, objectPoint);
        else {
          pointerState.target.x = objectPoint.x;
          pointerState.target.y = objectPoint.y;
        }
      } else {
        var next = snappedWorld(event, [pointerState.reference.point.id, pointerState.junctionId]);
        pointerState.last = next;
        if (pointerState.kind === 'point') {
          if (pointerState.junctionId) Project.syncJunction(project, pointerState.junctionId, next);
          else {
            pointerState.reference.point.x = next.x;
            pointerState.reference.point.y = next.y;
          }
        } else {
          pointerState.reference.point[pointerState.handle] = { x: next.x, y: next.y };
        }
      }
      renderAll();
    });

    listen(stage, 'pointerup', function (event) {
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      var completed = pointerState;
      pointerState = null;
      if (completed.kind === 'gesture') editor.pointerUp(snappedWorld(event), { curve: event.altKey });
      if (completed.kind === 'object') {
        if (completed.junctionId) Project.syncJunction(project, completed.junctionId, completed.original);
        else {
          completed.target.x = completed.original.x;
          completed.target.y = completed.original.y;
        }
        editor.moveSelection(completed.last);
      }
      if (completed.kind === 'point' || completed.kind === 'handle') {
        var point = completed.reference.point;
        if (completed.kind === 'point') {
          if (completed.junctionId) Project.syncJunction(project, completed.junctionId, completed.original);
          else {
            point.x = completed.original.x;
            point.y = completed.original.y;
          }
          editor.movePoint(completed.reference, completed.last);
        } else {
          point[completed.handle] = { x: completed.original.x, y: completed.original.y };
          editor.setControlHandle(completed.reference, completed.handle, completed.last);
        }
      }
      renderAll();
    });

    listen(stage, 'click', function (event) {
      if (routePlacement) {
        if (event.detail > 1) finishRoutePlacement();
        else {
          routePlacement.points.push(snappedWorld(event));
          routePlacement.preview = null;
          renderAll();
        }
        event.preventDefault();
        return;
      }
      if (editor.getTool() !== 'line') return;
      if (editor.getLineMode() === 'polyline' && event.detail > 1) {
        var completed = editor.finishLine({ curve: event.altKey });
        if (completed) setStatus('status.lineCreated', '多段线路已创建');
        renderAll();
        event.preventDefault();
        return;
      }
      var snapped = snapTarget(event);
      var line = editor.addLinePoint(snapped.point, snapped.target, { curve: event.altKey });
      if (line) setStatus('status.lineCreated', '线路已创建');
      renderAll();
      event.preventDefault();
    });

    listen(stage, 'pointercancel', function () {
      if (routePlacement) {
        routePlacement.preview = null;
        renderAll();
        return;
      }
      restoreTransientPointer();
      pointerState = null;
      editor.cancelGesture();
      renderAll();
    });

    listen(stage, 'wheel', function (event) {
      viewport = Geometry.zoomAround(viewport, event.deltaY < 0 ? 1.12 : 1 / 1.12, screenPoint(event), { min: 0.2, max: 6 });
      renderAll();
      event.preventDefault();
    }, { passive: false });

    listen(global, 'resize', function () { renderAll(); });

    async function confirmNewProject() {
      if (tapp.ui && typeof tapp.ui.confirm === 'function') {
        return Boolean(await tapp.ui.confirm(translate('project.newConfirm', '创建新工程？当前工程会被自动保存并替换。')));
      }
      return true;
    }

    function safeFilename(extension) {
      var base = project.meta.name.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'railway-project';
      return base + extension;
    }

    function openModal() {
      var modal = query('#png-limit-dialog');
      previousFocus = root.ownerDocument.activeElement;
      query('.railway-shell').setAttribute('inert', '');
      modal.hidden = false;
      var close = modal.querySelector('button');
      if (close) close.focus();
    }

    function closeModal() {
      var modal = query('#png-limit-dialog');
      modal.hidden = true;
      query('.railway-shell').removeAttribute('inert');
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      previousFocus = null;
    }

    function showInspectorPanel(name) {
      ['objects', 'properties', 'animation', 'diagnostics'].forEach(function (value) {
        var panel = query('#' + value + '-panel');
        var tab = query('[data-action="inspector-tab"][data-panel="' + value + '"]');
        panel.hidden = value !== name;
        tab.setAttribute('aria-selected', value === name ? 'true' : 'false');
      });
    }

    function zoom(factor) {
      viewport = Geometry.zoomAround(viewport, factor, { x: project.canvas.width / 2, y: project.canvas.height / 2 }, { min: 0.2, max: 6 });
      renderAll();
    }

    function setView(view) {
      query('#editor-view').hidden = view !== 'editor';
      query('#ticket-view').hidden = view !== 'ticket';
      queryAll('[data-action="switch-view"]').forEach(function (entry) {
        var active = entry.getAttribute('data-view') === view;
        entry.classList.toggle('is-active', active);
        entry.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (view === 'editor') renderAll();
    }

    function ticketFields(requirePassenger) {
      var fields = {
        originName: query('#ticket-origin').value.trim(),
        destinationName: query('#ticket-destination').value.trim(),
        nickname: query('#ticket-nickname').value.trim(),
        service: query('#ticket-service').value.trim().toUpperCase(),
        departureLocal: query('#ticket-departure').value
      };
      if (!fields.originName || fields.originName.length > 80 || !fields.destinationName || fields.destinationName.length > 80) throw new TypeError('起点和终点名称无效');
      if (fields.originName.toLocaleLowerCase() === fields.destinationName.toLocaleLowerCase()) throw new Error('起点和终点不能相同');
      if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(fields.service)) throw new TypeError('班次格式无效');
      if (requirePassenger && (!fields.nickname || fields.nickname.length > 32 || /[\u0000-\u001f\u007f]/.test(fields.nickname))) throw new TypeError('游戏昵称无效');
      if (requirePassenger && (!fields.departureLocal || !Number.isFinite(new Date(fields.departureLocal).getTime()))) throw new TypeError('发车时间无效');
      return fields;
    }

    function stationForName(name) {
      var key = name.trim().toLocaleLowerCase();
      var existing = project.stations.find(function (station) { return station.name.trim().toLocaleLowerCase() === key; });
      return existing || RoutePlanner.createStation(project, name, { idFactory: createRuntimeId });
    }

    function resolveTicketRoute(requirePassenger) {
      var fields = ticketFields(requirePassenger);
      var origin = stationForName(fields.originName);
      var destination = stationForName(fields.destinationName);
      return { fields: fields, origin: origin, destination: destination };
    }

    function saveTicketRoute(openEditor) {
      var resolved = resolveTicketRoute(false);
      var request = RoutePlanner.ensureRequest(project, {
        fromStationId: resolved.origin.id,
        toStationId: resolved.destination.id,
        service: resolved.fields.service,
        preferredLineId: null
      }, { idFactory: createRuntimeId });
      markChanged();
      setStatus('status.routeSaved', '待绘制路线已保存');
      if (openEditor) {
        routeReminderDismissed = true;
        query('#route-inventory').hidden = false;
        routeInventoryFilter = 'pending';
        setView('editor');
      }
      return request;
    }

    function startRoutePlacement(button) {
      var requestId = button.getAttribute('data-request-id');
      var request = project.network.routeRequests.find(function (entry) { return entry.id === requestId; });
      if (!request) throw new Error('待绘制路线不存在');
      var card = button.closest('.route-card');
      var lineId = card.querySelector('[data-role="route-line"]').value || null;
      var travelMinutes = Number(card.querySelector('[data-role="route-minutes"]').value);
      if (!Number.isFinite(travelMinutes) || travelMinutes <= 0) throw new TypeError('预计分钟必须大于零');
      if (request.preferredLineId && lineId !== request.preferredLineId) throw new Error('请选择路线需求指定的线路');
      var classification = RoutePlanner.classifyRequest(project, request);
      var origin = project.stations.find(function (station) { return station.id === request.fromStationId; });
      var destination = project.stations.find(function (station) { return station.id === request.toStationId; });
      var originPosition = Project.stationPosition(project, origin);
      var destinationPosition = Project.stationPosition(project, destination);
      routePlacement = {
        requestId: request.id,
        points: originPosition ? [originPosition] : [],
        minimumPoints: originPosition ? 1 : 0,
        fixedDestination: destinationPosition,
        preview: null,
        lineId: lineId,
        newLineName: lineId ? null : origin.name + '—' + destination.name,
        travelMinutes: travelMinutes,
        classification: classification.state
      };
      routeReminderDismissed = true;
      stage.focus();
      setStatus('status.routePlacementStarted', '在画布上放置站点或途径点，按 Enter 完成，Esc 取消');
      renderAll();
    }

    function finishRoutePlacement() {
      if (!routePlacement) return false;
      var points = routePlacement.points.slice();
      if (routePlacement.fixedDestination) {
        var last = points[points.length - 1];
        if (!last || last.x !== routePlacement.fixedDestination.x || last.y !== routePlacement.fixedDestination.y) points.push(routePlacement.fixedDestination);
      }
      if (points.length < 2) {
        setStatus('status.routePlacementNeedsPoints', '路线至少需要起点和终点');
        return false;
      }
      editor.materializeRouteRequest(routePlacement.requestId, {
        lineId: routePlacement.lineId,
        newLineName: routePlacement.newLineName,
        points: points,
        travelMinutes: routePlacement.travelMinutes,
        bidirectional: true
      });
      routePlacement = null;
      setStatus('status.routeMaterialized', '站点、线路和交通连接已创建');
      renderAll();
      return true;
    }

    function cancelRoutePlacement() {
      if (!routePlacement) return false;
      routePlacement = null;
      setStatus('status.routePlacementCancelled', '已取消路线放置，工程未修改');
      renderAll();
      return true;
    }

    async function handleAction(button) {
      var action = button.getAttribute('data-action');
      if (action === 'switch-view') {
        if (routePlacement) cancelRoutePlacement();
        setView(button.getAttribute('data-view'));
      } else if (action === 'open-route-inventory') {
        routeReminderDismissed = true;
        query('#route-inventory').hidden = false;
        routeInventoryFilter = 'pending';
        renderAll();
      } else if (action === 'toggle-route-inventory') {
        var routeInventory = query('#route-inventory');
        routeInventory.hidden = !routeInventory.hidden;
        routeReminderDismissed = true;
        if (!routeInventory.hidden) routeInventoryFilter = 'pending';
        renderAll();
      } else if (action === 'close-route-reminder') {
        routeReminderDismissed = true;
        renderAll();
      } else if (action === 'close-route-inventory') {
        query('#route-inventory').hidden = true;
        routeReminderDismissed = true;
        renderAll();
      } else if (action === 'finish-route-placement') {
        finishRoutePlacement();
      } else if (action === 'cancel-route-placement') {
        cancelRoutePlacement();
      } else if (action === 'show-pending-routes' || action === 'show-ignored-routes') {
        routeInventoryFilter = action === 'show-ignored-routes' ? 'ignored' : 'pending';
        renderAll();
      } else if (action === 'ignore-route' || action === 'restore-route') {
        var routeRequest = project.network.routeRequests.find(function (entry) { return entry.id === button.getAttribute('data-request-id'); });
        if (!routeRequest) throw new Error('待绘制路线不存在');
        routeRequest.dismissed = action === 'ignore-route';
        markChanged();
      } else if (action === 'start-route-placement') {
        startRoutePlacement(button);
      } else if (action === 'set-tool') {
        if (routePlacement) cancelRoutePlacement();
        var tool = editor.setTool(button.getAttribute('data-tool'));
        queryAll('[data-action="set-tool"]').forEach(function (entry) {
          var active = entry === button;
          entry.classList.toggle('is-active', active);
          entry.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        query('#line-mode-switch').hidden = tool !== 'line';
        renderAll();
      } else if (action === 'set-line-mode') {
        var lineMode = editor.setLineMode(button.getAttribute('data-line-mode'));
        queryAll('[data-action="set-line-mode"]').forEach(function (entry) {
          entry.setAttribute('aria-pressed', entry.getAttribute('data-line-mode') === lineMode ? 'true' : 'false');
        });
        renderAll();
      } else if (action === 'new-project') {
        if (await confirmNewProject()) controller.replace(Project.createProject(), 'new');
      } else if (action === 'open-project') {
        query('#project-file-input').click();
      } else if (action === 'import-background') {
        query('#background-file-input').click();
      } else if (action === 'export-json') {
        await Files.downloadText(tapp, Serialization.serializePortable(project), safeFilename('.railway.json'), 'application/json');
        setStatus('status.exported', 'JSON 已交给宿主保存');
      } else if (action === 'export-svg') {
        await Files.downloadText(tapp, Serialization.projectToSvg(project), safeFilename('.svg'), 'image/svg+xml');
        setStatus('status.exported', 'SVG 已交给宿主保存');
      } else if (action === 'export-png-info') {
        openModal();
      } else if (action === 'close-png-info') {
        closeModal();
      } else if (action === 'undo') {
        history.undo(); renderAll();
      } else if (action === 'redo') {
        history.redo(); renderAll();
      } else if (action === 'zoom-in') {
        zoom(1.2);
      } else if (action === 'zoom-out') {
        zoom(1 / 1.2);
      } else if (action === 'fit-canvas') {
        viewport = { x: 0, y: 0, scale: 1 }; renderAll();
      } else if (action === 'toggle-grid') {
        project.settings.grid.enabled = !project.settings.grid.enabled; markChanged();
      } else if (action === 'toggle-snap') {
        project.settings.snap.enabled = Boolean(button.checked);
        markChanged();
        setStatus(project.settings.snap.enabled ? 'status.snapOn' : 'status.snapOff', project.settings.snap.enabled ? '吸附已开启' : '吸附已关闭');
      } else if (action === 'inspector-tab') {
        showInspectorPanel(button.getAttribute('data-panel'));
      } else if (action === 'select-object') {
        editor.select({ type: button.getAttribute('data-type'), id: button.getAttribute('data-id') }); renderAll();
      } else if (action === 'delete-selection') {
        var deletion = editor.deleteSelection();
        if (!deletion.deleted) setStatus('status.deleteBlocked', '对象仍被交通连接或待绘制路线引用，请先解除引用');
      } else if (action === 'upgrade-endpoint') {
        var pointSelection = editor.getSelection();
        var pointRef = pointSelection && pointSelection.type === 'point' ? pointReference(pointSelection.id) : null;
        if (!pointRef) throw new Error('请选择线路端点');
        editor.upgradeEndpointToStation(pointRef);
        setStatus('status.stationUpgraded', '线路端点已升级为站点');
        renderAll();
      } else if (action === 'add-edge') {
        editor.createEdge({
          fromStationId: query('#edge-from').value,
          toStationId: query('#edge-to').value,
          lineId: query('#edge-line').value,
          distanceUnits: Number(query('#edge-distance').value),
          travelMinutes: Number(query('#edge-minutes').value),
          bidirectional: query('#edge-bidirectional').checked
        });
        setStatus('status.edgeCreated', '交通连接已添加');
      } else if (action === 'delete-edge') {
        editor.deleteEdge(button.getAttribute('data-edge-id'));
      } else if (action === 'set-track') {
        editor.setSelectionTrack({
          startMs: Number(query('#track-start').value),
          durationMs: Number(query('#track-duration').value),
          effect: query('#track-effect').value,
          easing: query('#track-easing').value
        });
        setStatus('status.trackApplied', '对象动画时序已更新');
      } else if (action === 'apply-route-animation' || action === 'recalculate-route-animation') {
        var routeControls = routeAnimationControls();
        editor.setRouteTrack(routeControls.from.value, routeControls.to.value, readRouteAnimationSettings(routeControls));
        setStatus(action === 'recalculate-route-animation' ? 'status.routeAnimationRecalculated' : 'status.routeAnimationApplied', action === 'recalculate-route-animation' ? '行程路线已重新计算' : '行程动画已应用');
        renderAll();
        showInspectorPanel('animation');
      } else if (action === 'remove-route-animation') {
        var removeControls = routeAnimationControls();
        var routeTrack = matchingRouteTrack(removeControls.from.value, removeControls.to.value);
        if (routeTrack && editor.removeRouteTrack(routeTrack.id)) {
          setStatus('status.routeAnimationRemoved', '行程动画已移除');
          renderAll();
          showInspectorPanel('animation');
        }
      } else if (action === 'play-timeline') {
        timeline.play();
      } else if (action === 'stop-timeline') {
        timeline.stop();
      } else if (action === 'save-route-request') {
        saveTicketRoute(false);
      } else if (action === 'save-route-and-open') {
        saveTicketRoute(true);
      } else if (action === 'generate-ticket') {
        var resolved = resolveTicketRoute(true);
        var probe = {
          id: 'route-probe',
          fromStationId: resolved.origin.id,
          toStationId: resolved.destination.id,
          service: resolved.fields.service,
          preferredLineId: null,
          createdAt: new Date().toISOString(),
          dismissed: false
        };
        var classification = RoutePlanner.classifyRequest(project, probe);
        if (classification.state !== 'ready') {
          RoutePlanner.ensureRequest(project, probe, { idFactory: createRuntimeId });
          markChanged();
          query('#route-details').textContent = routeStateLabel(classification.state) + '。已保存到线路图的待绘制路线栏。';
          setStatus('status.routeSavedInstead', '当前路线尚未完成，已保存为待绘制路线');
        } else {
          var ticket = Ticket.createTicket(project, {
            fromStationId: resolved.origin.id,
            toStationId: resolved.destination.id,
            nickname: resolved.fields.nickname,
            service: resolved.fields.service,
            departureLocal: resolved.fields.departureLocal
          });
          var parsed = new DOMParser().parseFromString(Ticket.ticketToSvg(ticket), 'image/svg+xml').documentElement;
          query('#ticket-preview').replaceChildren(root.ownerDocument.importNode(parsed, true));
          query('#route-details').textContent = ticket.route.legs.map(function (leg) { return leg.lineName; }).join(' → ') + ' · ' + Ticket.formatMetric(ticket.route.totalMinutes) + ' min · ' + Ticket.formatMetric(ticket.route.totalDistanceUnits) + ' units · ' + ticket.route.transferCount + ' transfer · ' + ticket.fare.totalMinor + ' ' + ticket.fare.currency + ' minor units';
          setStatus('status.ticketCreated', '车票已根据当前交通网络生成');
        }
      }
    }

    listen(root, 'click', function (event) {
      var button = event.target.closest && event.target.closest('[data-action]');
      if (!button || !root.contains(button)) return;
      handleAction(button).catch(function (error) {
        console.error('[Railway Studio] action failed', error);
        setStatus('status.actionFailed', error.message || '操作失败');
      });
    });
    listen(query('#snap-toggle'), 'keydown', function (event) {
      if (event.key !== ' ' && event.key !== 'Spacebar' && event.code !== 'Space') return;
      event.preventDefault();
      this.checked = !this.checked;
      handleAction(this).catch(function (error) {
        console.error('[Railway Studio] action failed', error);
        setStatus('status.actionFailed', error.message || '操作失败');
      });
    });
    listen(query('#route-card-list'), 'keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      var cards = queryAll('#route-card-list .route-card');
      if (!cards.length) return;
      var active = root.ownerDocument.activeElement;
      var current = cards.findIndex(function (card) { return card === active || card.contains(active); });
      var next = event.key === 'ArrowRight' ? Math.min(cards.length - 1, current + 1) : Math.max(0, current < 0 ? 0 : current - 1);
      cards[next].focus();
      cards[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      event.preventDefault();
    });
    listen(query('#route-card-list'), 'wheel', function (event) {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      this.scrollLeft += event.deltaY;
      event.preventDefault();
    }, { passive: false });

    function commitProjectName() {
      var input = query('#project-name');
      var next = input.value.trim();
      if (!next) {
        input.value = project.meta.name;
        setStatus('status.projectNameRequired', '工程名称不能为空');
        return;
      }
      if (next === project.meta.name) {
        input.value = project.meta.name;
        return;
      }
      project.meta.name = next;
      markChanged();
      setStatus('status.projectRenamed', '工程名称已更新');
    }
    listen(query('#project-name'), 'change', commitProjectName);
    listen(query('#project-name'), 'blur', commitProjectName);
    listen(query('#project-name'), 'keydown', function (event) {
      if (event.key === 'Enter') {
        commitProjectName();
        this.blur();
        event.preventDefault();
      } else if (event.key === 'Escape') {
        this.value = project.meta.name;
        this.blur();
        event.preventDefault();
      }
    });

    function commitPropertyName() {
      var selection = editor.getSelection();
      if (!selection) return;
      var selected = findSelectedObject();
      var current = selected && (selection.type === 'text' ? selected.text : selected.name);
      if (!selected || current === query('#property-name').value) return;
      var patch = selection.type === 'text' ? { text: query('#property-name').value } : { name: query('#property-name').value };
      editor.updateSelection(patch);
    }
    listen(query('#property-name'), 'change', commitPropertyName);
    listen(query('#property-name'), 'blur', commitPropertyName);
    listen(query('#property-name'), 'keydown', function (event) { if (event.key === 'Enter') { commitPropertyName(); event.preventDefault(); } });
    listen(query('#property-color'), 'change', function () { if (editor.getSelection()) editor.updateSelection({ style: { color: this.value } }); });
    listen(query('#property-width'), 'change', function () {
      var selection = editor.getSelection();
      if (!selection) return;
      var value = Number(this.value);
      var style = selection.type === 'line' ? { width: value } : selection.type === 'station' ? { radius: value } : { size: value };
      editor.updateSelection({ style: style });
    });
    listen(query('#timeline-position'), 'input', function () { timeline.seek(Number(this.value)); });
    listen(query('#route-animation-from'), 'change', renderAnimationPanel);
    listen(query('#route-animation-to'), 'change', renderAnimationPanel);
    listen(query('#route-animation-show-base'), 'change', function () {
      var controls = routeAnimationControls();
      controls.baseState.textContent = translate(controls.showBase.checked ? 'animation.on' : 'animation.off', controls.showBase.checked ? '开' : '关');
      controls.showBase.setAttribute('aria-checked', controls.showBase.checked ? 'true' : 'false');
    });

    listen(query('#project-file-input'), 'change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      Files.readProjectFile(file).then(function (next) { controller.replace(next, 'import'); }).catch(function (error) {
        console.error('[Railway Studio] import failed', error);
        setStatus('status.importFailed', '工程文件无效，当前工程未被替换');
      });
    });

    listen(query('#background-file-input'), 'change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      Files.readImageFile(file).then(function (result) {
        var next = Project.cloneProject(project);
        var previousId = next.canvas.backgroundAssetId;
        next.assets = next.assets.filter(function (asset) { return asset.id !== previousId && asset.id !== result.asset.id; });
        next.assets.push(result.asset);
        next.canvas.backgroundAssetId = result.asset.id;
        sessionBackgrounds.set(result.asset.id, result.previewDataUrl);
        controller.replace(next, 'background');
        sessionBackgrounds.set(result.asset.id, result.previewDataUrl);
        renderAll();
        setStatus(result.asset.mode === 'embedded' ? 'status.backgroundEmbedded' : 'status.backgroundDetached', result.asset.mode === 'embedded' ? '背景图已嵌入工程' : '大图仅在本次会话预览，工程中保存校验信息');
      }).catch(function (error) {
        console.error('[Railway Studio] background failed', error);
        setStatus('status.backgroundFailed', '背景图不受支持或超过限制');
      });
    });

    listen(root.ownerDocument, 'keydown', function (event) {
      var tag = event.target && event.target.tagName;
      var editing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (event.key === 'Escape' && !query('#png-limit-dialog').hidden) { closeModal(); event.preventDefault(); return; }
      if (editing) return;
      if (routePlacement && event.key === 'Enter') { finishRoutePlacement(); event.preventDefault(); return; }
      if (routePlacement && event.key === 'Backspace') {
        if (routePlacement.points.length > routePlacement.minimumPoints) routePlacement.points.pop();
        routePlacement.preview = null;
        renderAll();
        event.preventDefault();
        return;
      }
      if (routePlacement && event.key === 'Escape') { cancelRoutePlacement(); event.preventDefault(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.shiftKey ? history.redo() : history.undo(); renderAll(); event.preventDefault(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { history.redo(); renderAll(); event.preventDefault(); }
      else if (event.key === 'Enter' && editor.getTool() === 'line' && editor.getPreview() && editor.getPreview().type === 'line-draft') {
        var completedLine = editor.finishLine();
        if (completedLine) setStatus('status.lineCreated', '多段线路已创建');
        renderAll();
        event.preventDefault();
      }
      else if (event.key === 'Backspace' && editor.getTool() === 'line' && editor.getPreview() && editor.getPreview().type === 'line-draft') {
        editor.removeLastLinePoint();
        renderAll();
        event.preventDefault();
      }
      else if (event.key === 'Delete' || event.key === 'Backspace') { editor.deleteSelection(); event.preventDefault(); }
      else if (event.key === 'Escape') { restoreTransientPointer(); pointerState = null; editor.cancelGesture(); renderAll(); }
    });

    function localInputValue(date) {
      var local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    }
    query('#ticket-departure').value = localInputValue(new Date());

    var hostBinding = bindHost(tapp, {
      onTheme: applyTheme,
      onLocale: function () { applyI18n(); renderAll(); },
      onAnimationLevel: function (level) { timeline.setLevel(level); },
      onPause: function () { timeline.pause(); },
      onResume: function () { timeline.resume(); },
      onDestroy: destroy
    });

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (saveTimer !== null) global.clearTimeout(saveTimer);
      timeline.destroy();
      cleanup.splice(0).forEach(function (off) { try { off(); } catch (_) {} });
      if (hostBinding) hostBinding.dispose();
      sessionBackgrounds.clear();
    }

    applyI18n();
    renderAll();
    if (tapp.ui && typeof tapp.ui.getTheme === 'function') Promise.resolve(tapp.ui.getTheme()).then(applyTheme).catch(function () {});
    if (tapp.animation && typeof tapp.animation.shouldAnimate === 'function') Promise.resolve(tapp.animation.shouldAnimate()).then(function (value) { timeline.setEnabled(value); }).catch(function () {});
    controller.restore().catch(function (error) {
      console.error('[Railway Studio] restore failed', error);
      setStatus('status.restoreFailed', '已忽略损坏的自动恢复数据');
    });

    return {
      destroy: destroy,
      getProject: function () { return Project.cloneProject(project); },
      replaceProject: function (next) { return controller.replace(next, 'external'); }
    };
  }

  var api = {
    bindHost: bindHost,
    createProjectController: createProjectController,
    createTappStorageAdapter: createTappStorageAdapter,
    mount: mount
  };
  global.RailwayApp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
