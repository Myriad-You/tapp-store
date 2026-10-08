(function (root) {
  "use strict";

  var Core = typeof require === "function" ? require("../main.js") : root.FootprintEarthCore;
  var controllers = new Map();
  var generations = new Map();
  var lastContainer = null;

  function safeGet(key) {
    return root.Tapp.shared.get(key).catch(function () { return null; });
  }

  function setText(container, selector, value) {
    var node = container.querySelector(selector);
    if (node) node.textContent = String(value == null ? "—" : value);
  }

  function pointFor(index, item) {
    return Core.representativePoint(index, item.code) || Core.representativePoint(index, item.countryCode);
  }

  function markersFor(index, config, owner, projection) {
    var markers = [];
    var add = function (item, kind) {
      var point = pointFor(index, item);
      if (point) markers.push({ code: item.code, countryCode: item.countryCode || item.code, kind: kind, countBucket: item.countBucket, point: point });
    };
    if (owner && owner.v === 1) {
      (owner.countries || []).concat(owner.regions || []).forEach(function (item) {
        if (item && (item.status === "resident" || item.status === "travel")) add(item, item.status);
      });
    }
    if (projection && projection.v === 1 && (!config || projection.campaignId === config.campaignId)) {
      (projection.countries || []).concat(projection.regions || []).forEach(function (item) { if (item && item.countBucket) add(item, "visitor"); });
    }
    return markers;
  }

  async function render(container, props) {
    var current = (generations.get(container) || 0) + 1;
    generations.set(container, current);
    var results = await Promise.all([
      root.Tapp.assets.getArrayBuffer("assets/world-110m.json"),
      root.Tapp.assets.getArrayBuffer("assets/admin1-50m.json"),
      safeGet(Core.SHARED_KEYS.config),
      safeGet(Core.SHARED_KEYS.owner),
      safeGet(Core.SHARED_KEYS.publicProjection)
    ]);
    if (generations.get(container) !== current) return;
    var world = Core.loadMapAsset(results[0]);
    var admin1 = Core.loadMapAsset(results[1]);
    var dataset = Core.mergeMapAssets(world, admin1);
    var index = Core.createMapIndex(dataset);
    var config = results[2];
    var checkedOwner = Core.validateOwnerFootprints(results[3] || { v: 1, countries: [], regions: [] }, index);
    var checkedProjection = Core.validatePublicProjection(results[4], index, config && config.campaignId);
    var markers = markersFor(index, config, checkedOwner.ok ? checkedOwner.value : null, checkedProjection.ok ? checkedProjection.value : null);
    var scope = container.querySelector("[data-widget-root]") || container;
    var canvas = scope.querySelector("[data-globe]");
    if (!canvas) throw new Error("widget_canvas_missing");
    var previous = controllers.get(container);
    if (previous) previous.destroy();
    var controller = new Core.GlobeController(canvas, {
      dataset: dataset,
      markers: markers,
      theme: props && props.theme,
      view: { centerLon: 18, centerLat: 18, zoom: props && props.size === "2x2" ? .88 : 1 },
      autoRotate: true,
      reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    });
    controllers.set(container, controller);
    lastContainer = container;
    scope.dataset.theme = props && props.theme === "dark" ? "dark" : "light";
    scope.dataset.size = props && props.size || "4x2";
    if (scope.style && scope.style.setProperty) {
      scope.style.setProperty("--widget-scale", String(props && props.scale || 1));
      scope.style.setProperty("--widget-font-scale", String(props && props.fontScale || 1));
    }
    var published = checkedProjection.ok && checkedProjection.value.publishedDate;
    var contributors = checkedProjection.ok && checkedProjection.value.totalContributorsBucket;
    setText(scope, "[data-title]", root.Tapp.i18n.t("widget.title"));
    setText(scope, "[data-subtitle]", root.Tapp.i18n.t("widget.subtitle"));
    setText(scope, "[data-contributors]", contributors || root.Tapp.i18n.t("widget.waiting"));
    setText(scope, "[data-contributor-label]", root.Tapp.i18n.t("widget.contributors"));
    setText(scope, "[data-updated]", published || root.Tapp.i18n.t("widget.notPublished"));
    setText(scope, "[data-locations]", String(root.Tapp.i18n.t("widget.locations")).replace("{count}", String(markers.length)));
    scope.setAttribute("aria-label", root.Tapp.i18n.t("widget.aria"));
    if (canvas.setAttribute) canvas.setAttribute("aria-label", root.Tapp.i18n.t("widget.canvasAria"));
  }

  if (root.Tapp && root.Tapp.widgets) root.Tapp.widgets["footprint-globe"] = { render: render };

  if (root.Tapp && root.Tapp.lifecycle) {
    if (root.Tapp.lifecycle.onPause) root.Tapp.lifecycle.onPause(function () { controllers.forEach(function (controller) { controller.pause(); }); });
    if (root.Tapp.lifecycle.onResume) root.Tapp.lifecycle.onResume(function () { controllers.forEach(function (controller) { controller.resume(); }); });
    if (root.Tapp.lifecycle.onDestroy) root.Tapp.lifecycle.onDestroy(function () {
      generations.forEach(function (generation, container) { generations.set(container, generation + 1); });
      controllers.forEach(function (controller) { controller.destroy(); });
      controllers.clear();
      generations.clear();
      lastContainer = null;
    });
  }

  root.FootprintEarthWidget = Object.freeze({
    render: render,
    markersFor: markersFor,
    getController: function (container) { return controllers.get(container || lastContainer) || null; }
  });
})(globalThis);
