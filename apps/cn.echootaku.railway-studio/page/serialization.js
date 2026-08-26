(function (global) {
  'use strict';

  var Project = global.RailwayProject;
  var Migrations = global.RailwayMigrations;
  var Geometry = global.RailwayGeometry;
  if (typeof require === 'function') {
    if (!Project) Project = require('./project.js');
    if (!Migrations) Migrations = require('./migrations.js');
    if (!Geometry) Geometry = require('./geometry.js');
  }

  function utf8Length(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }

  function scanComplexity(value, options, depth, state) {
    if (depth > options.maxDepth) throw new RangeError('Project exceeds maximum depth');
    state.nodes += 1;
    if (state.nodes > options.maxNodes) throw new RangeError('Project exceeds maximum node count');
    if (typeof value === 'string' && value.length > options.maxStringLength) throw new RangeError('Project exceeds maximum string length');
    if (Array.isArray(value)) {
      value.forEach(function (entry) { scanComplexity(entry, options, depth + 1, state); });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (key) {
        if (key.length > 256) throw new RangeError('Project key is too long');
        scanComplexity(value[key], options, depth + 1, state);
      });
    }
  }

  function parseProjectText(text, limits) {
    if (typeof text !== 'string') throw new TypeError('Project source must be text');
    var options = Object.assign({
      maxBytes: 10 * 1024 * 1024,
      maxDepth: 32,
      maxNodes: 25000,
      maxStringLength: 10 * 1024 * 1024
    }, limits || {});
    if (utf8Length(text) > options.maxBytes) throw new RangeError('Project exceeds maximum byte length');
    var candidate;
    try {
      candidate = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch (error) {
      var parseError = new Error('Project JSON is invalid: ' + error.message);
      parseError.name = 'ProjectParseError';
      throw parseError;
    }
    scanComplexity(candidate, options, 0, { nodes: 0 });
    return Migrations.importProject(candidate);
  }

  function serializePortable(project) {
    return JSON.stringify(Project.normalizeProject(project), null, 2);
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
  }

  function projectToSvg(project) {
    var value = Project.normalizeProject(project);
    var width = value.canvas.width;
    var height = value.canvas.height;
    var output = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">',
      '<title>' + escapeXml(value.meta.name) + '</title>',
      '<rect width="100%" height="100%" fill="#f5f1e8"/>'
    ];
    var background = value.assets.find(function (asset) { return asset.id === value.canvas.backgroundAssetId; });
    if (background && background.mode === 'embedded' && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(background.dataUrl || '')) {
      output.push('<image href="' + escapeXml(background.dataUrl) + '" x="0" y="0" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid meet"/>');
    }
    value.lines.forEach(function (line) {
      line.paths.forEach(function (path) {
        var dash = line.style.dash.length ? ' stroke-dasharray="' + line.style.dash.map(Number).filter(Number.isFinite).join(' ') + '"' : '';
        var positionedPoints = path.points.map(function (point) { return Object.assign({}, point, Project.pointPosition(value, point)); });
        output.push('<path d="' + Geometry.pathToSvgD(positionedPoints) + '" fill="none" stroke="' + safeColor(line.style.color, '#1f8ca8') + '" stroke-width="' + line.style.width + '" stroke-linecap="round" stroke-linejoin="round"' + dash + '/>');
      });
    });
    value.stations.filter(Project.isStationPlaced).forEach(function (station) {
      var position = Project.stationPosition(value, station);
      output.push('<g><circle cx="' + position.x + '" cy="' + position.y + '" r="' + station.style.radius + '" fill="' + safeColor(station.style.color, '#f5f1e8') + '" stroke="#102a36" stroke-width="2"/>');
      output.push('<text x="' + position.x + '" y="' + (position.y + station.style.radius + 18) + '" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#102a36">' + escapeXml(station.name) + '</text></g>');
    });
    value.texts.forEach(function (textValue) {
      var anchor = { start: 'start', middle: 'middle', end: 'end' }[textValue.style.align] || 'start';
      output.push('<text x="' + textValue.x + '" y="' + textValue.y + '" text-anchor="' + anchor + '" font-family="sans-serif" font-size="' + textValue.style.size + '" font-weight="' + Number(textValue.style.weight || 400) + '" fill="' + safeColor(textValue.style.color, '#102a36') + '">' + escapeXml(textValue.text) + '</text>');
    });
    output.push('</svg>');
    return output.join('');
  }

  var api = {
    parseProjectText: parseProjectText,
    serializePortable: serializePortable,
    projectToSvg: projectToSvg
  };
  global.RailwaySerialization = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
