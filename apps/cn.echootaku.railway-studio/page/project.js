(function (global) {
  'use strict';

  var SCHEMA = 'myriad-railway-project';
  var VERSION = 4;
  var LIMITS = {
    assets: 64,
    lines: 128,
    junctions: 10000,
    paths: 512,
    points: 10000,
    stations: 2000,
    edges: 5000,
    routeRequests: 2000,
    texts: 1000,
    tracks: 4000
  };

  function createId(prefix) {
    var bytes = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    return prefix + '-' + Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  function createProject(options) {
    var input = options || {};
    var now = input.now || new Date().toISOString();
    return {
      schema: SCHEMA,
      version: VERSION,
      meta: {
        id: input.id || createId('project'),
        name: input.name || '未命名线路工程',
        createdAt: now,
        updatedAt: now
      },
      canvas: {
        width: 1600,
        height: 900,
        backgroundAssetId: null
      },
      settings: {
        grid: { enabled: true, size: 24 },
        snap: { enabled: true, distance: 10 },
        units: 'px'
      },
      assets: [],
      lines: [],
      junctions: [],
      stations: [],
      network: {
        edges: [],
        routeRequests: [],
        farePolicy: {
          currency: 'CNY',
          baseFareMinor: 200,
          distanceStepUnits: 10,
          distanceFareMinor: 50,
          transferFareMinor: 100,
          roundingMinor: 10
        }
      },
      texts: [],
      timeline: { durationMs: 6000, tracks: [] },
      extensions: {}
    };
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function assertJsonValue(value, path, seen) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
      throw new TypeError('Project must contain only serializable JSON values at ' + path);
    }
    if (typeof value !== 'object') throw new TypeError('Project contains a non-serializable value at ' + path);
    if (seen.has(value)) throw new TypeError('Project must be serializable without circular references at ' + path);
    if (!Array.isArray(value) && !isPlainObject(value)) {
      throw new TypeError('Project must contain only serializable plain objects at ' + path);
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(function (entry, index) {
        assertJsonValue(entry, path + '[' + index + ']', seen);
      });
    } else {
      Object.keys(value).forEach(function (key) {
        assertJsonValue(value[key], path + '.' + key, seen);
      });
    }
    seen.delete(value);
  }

  function cloneProject(project) {
    assertJsonValue(project, '$', new Set());
    return JSON.parse(JSON.stringify(project));
  }

  function findJunction(project, junctionId) {
    return project && Array.isArray(project.junctions)
      ? project.junctions.find(function (junction) { return junction.id === junctionId; }) || null
      : null;
  }

  function pointPosition(project, point) {
    var junction = point && point.junctionId ? findJunction(project, point.junctionId) : null;
    return junction ? { x: junction.x, y: junction.y } : { x: point.x, y: point.y };
  }

  function isStationPlaced(station) {
    return Boolean(station && isPlainObject(station.placement));
  }

  function stationPosition(project, station) {
    if (!isStationPlaced(station)) return null;
    var junction = station.placement.junctionId ? findJunction(project, station.placement.junctionId) : null;
    return junction ? { x: junction.x, y: junction.y } : { x: station.placement.x, y: station.placement.y };
  }

  function syncJunction(project, junctionId, next) {
    var junction = findJunction(project, junctionId);
    if (!junction) throw new Error('Unknown junction');
    if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) throw new TypeError('Junction coordinates are invalid');
    var delta = { x: next.x - junction.x, y: next.y - junction.y };
    junction.x = next.x;
    junction.y = next.y;
    (project.lines || []).forEach(function (line) {
      (line.paths || []).forEach(function (path) {
        (path.points || []).forEach(function (point) {
          if (point.junctionId === junctionId) {
            point.x = next.x;
            point.y = next.y;
            ['in', 'out'].forEach(function (handle) {
              if (point[handle]) {
                point[handle].x += delta.x;
                point[handle].y += delta.y;
              }
            });
          }
        });
      });
    });
    (project.stations || []).forEach(function (station) {
      if (isStationPlaced(station) && station.placement.junctionId === junctionId) {
        station.placement.x = next.x;
        station.placement.y = next.y;
      }
    });
    return junction;
  }

  function mergeDefaults(target, defaults) {
    Object.keys(defaults).forEach(function (key) {
      if (typeof target[key] === 'undefined') {
        target[key] = cloneProject(defaults[key]);
      } else if (isPlainObject(target[key]) && isPlainObject(defaults[key])) {
        mergeDefaults(target[key], defaults[key]);
      }
    });
    return target;
  }

  function diagnostic(errors, code, path, message) {
    errors.push({ code: code, path: path, message: message });
  }

  function isFiniteInRange(value, minimum, maximum) {
    return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
  }

  function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  }

  function isDashPattern(value) {
    return Array.isArray(value) && value.length <= 32 && value.every(function (entry) {
      return isFiniteInRange(entry, 0, 10000);
    });
  }

  function validateProject(candidate) {
    var errors = [];
    if (!isPlainObject(candidate)) {
      diagnostic(errors, 'type', '$', 'Project must be an object');
      return { valid: false, errors: errors };
    }

    if (candidate.schema !== SCHEMA) diagnostic(errors, 'schema', '$.schema', 'Unsupported project schema');
    if (candidate.version !== VERSION) diagnostic(errors, 'version', '$.version', 'Unsupported project version');

    var registry = new Map();
    function registerId(id, path) {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id)) {
        diagnostic(errors, 'id', path, 'ID must be a stable non-empty string');
        return;
      }
      if (registry.has(id)) {
        diagnostic(errors, 'duplicate-id', path, 'ID duplicates ' + registry.get(id));
        return;
      }
      registry.set(id, path);
    }

    var meta = candidate.meta;
    if (!isPlainObject(meta)) {
      diagnostic(errors, 'type', '$.meta', 'Meta must be an object');
    } else {
      registerId(meta.id, '$.meta.id');
      if (typeof meta.name !== 'string' || !meta.name.trim() || meta.name.length > 120) {
        diagnostic(errors, 'string', '$.meta.name', 'Project name is invalid');
      }
      ['createdAt', 'updatedAt'].forEach(function (field) {
        if (typeof meta[field] !== 'string' || !Number.isFinite(Date.parse(meta[field]))) {
          diagnostic(errors, 'date', '$.meta.' + field, 'Timestamp is invalid');
        }
      });
    }

    var canvas = candidate.canvas;
    if (!isPlainObject(canvas)) {
      diagnostic(errors, 'type', '$.canvas', 'Canvas must be an object');
    } else {
      if (!isFiniteInRange(canvas.width, 1, 32768)) diagnostic(errors, 'range', '$.canvas.width', 'Canvas width is out of range');
      if (!isFiniteInRange(canvas.height, 1, 32768)) diagnostic(errors, 'range', '$.canvas.height', 'Canvas height is out of range');
      if (canvas.backgroundAssetId !== null && typeof canvas.backgroundAssetId !== 'string') {
        diagnostic(errors, 'type', '$.canvas.backgroundAssetId', 'Background asset reference is invalid');
      }
    }

    var settings = candidate.settings;
    if (!isPlainObject(settings) || !isPlainObject(settings.grid) || !isPlainObject(settings.snap)) {
      diagnostic(errors, 'type', '$.settings', 'Settings are invalid');
    } else {
      if (typeof settings.grid.enabled !== 'boolean' || !isFiniteInRange(settings.grid.size, 2, 512)) {
        diagnostic(errors, 'range', '$.settings.grid', 'Grid settings are invalid');
      }
      if (typeof settings.snap.enabled !== 'boolean' || !isFiniteInRange(settings.snap.distance, 0, 128)) {
        diagnostic(errors, 'range', '$.settings.snap', 'Snap settings are invalid');
      }
      if (settings.units !== 'px') diagnostic(errors, 'value', '$.settings.units', 'Only logical pixels are supported');
    }

    var assets = Array.isArray(candidate.assets) ? candidate.assets : [];
    if (!Array.isArray(candidate.assets)) diagnostic(errors, 'type', '$.assets', 'Assets must be an array');
    if (assets.length > LIMITS.assets) diagnostic(errors, 'limit', '$.assets', 'Too many assets');
    var assetIds = new Set();
    assets.forEach(function (asset, index) {
      var path = '$.assets[' + index + ']';
      if (!isPlainObject(asset)) {
        diagnostic(errors, 'type', path, 'Asset must be an object');
        return;
      }
      registerId(asset.id, path + '.id');
      assetIds.add(asset.id);
      if (asset.kind !== 'image' || !['embedded', 'detached'].includes(asset.mode)) diagnostic(errors, 'value', path, 'Asset type or mode is invalid');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) diagnostic(errors, 'value', path + '.mimeType', 'Unsupported image MIME');
      if (!isFiniteInRange(asset.width, 1, 32768) || !isFiniteInRange(asset.height, 1, 32768)) diagnostic(errors, 'range', path, 'Image dimensions are invalid');
      if (!Number.isInteger(asset.byteLength) || asset.byteLength < 1) diagnostic(errors, 'range', path + '.byteLength', 'Image byte length is invalid');
      if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(asset.sha256)) diagnostic(errors, 'hash', path + '.sha256', 'Image digest is invalid');
      if (asset.mode === 'embedded' && (typeof asset.dataUrl !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(asset.dataUrl))) {
        diagnostic(errors, 'data-url', path + '.dataUrl', 'Embedded image data is invalid');
      }
    });
    if (canvas && canvas.backgroundAssetId && !assetIds.has(canvas.backgroundAssetId)) {
      diagnostic(errors, 'missing-asset', '$.canvas.backgroundAssetId', 'Background asset does not exist');
    }

    var junctions = Array.isArray(candidate.junctions) ? candidate.junctions : [];
    if (!Array.isArray(candidate.junctions)) diagnostic(errors, 'type', '$.junctions', 'Junctions must be an array');
    if (junctions.length > LIMITS.junctions) diagnostic(errors, 'limit', '$.junctions', 'Too many junctions');
    var junctionIds = new Set();
    junctions.forEach(function (junction, index) {
      var path = '$.junctions[' + index + ']';
      if (!isPlainObject(junction)) {
        diagnostic(errors, 'type', path, 'Junction must be an object');
        return;
      }
      registerId(junction.id, path + '.id');
      junctionIds.add(junction.id);
      if (!isFiniteInRange(junction.x, -1000000, 1000000) || !isFiniteInRange(junction.y, -1000000, 1000000)) {
        diagnostic(errors, 'range', path, 'Junction coordinates are invalid');
      }
    });

    var lines = Array.isArray(candidate.lines) ? candidate.lines : [];
    if (!Array.isArray(candidate.lines)) diagnostic(errors, 'type', '$.lines', 'Lines must be an array');
    if (lines.length > LIMITS.lines) diagnostic(errors, 'limit', '$.lines', 'Too many lines');
    var lineIds = new Set();
    var pathIds = new Set();
    var pointIds = new Set();
    var pathPointIds = new Map();
    var pathCount = 0;
    var pointCount = 0;
    lines.forEach(function (line, lineIndex) {
      var linePath = '$.lines[' + lineIndex + ']';
      if (!isPlainObject(line)) {
        diagnostic(errors, 'type', linePath, 'Line must be an object');
        return;
      }
      registerId(line.id, linePath + '.id');
      lineIds.add(line.id);
      if (typeof line.name !== 'string' || !line.name.trim() || line.name.length > 80) diagnostic(errors, 'string', linePath + '.name', 'Line name is invalid');
      if (!isPlainObject(line.style) || !isHexColor(line.style.color) || !isFiniteInRange(line.style.width, 1, 64) || !isDashPattern(line.style.dash)) {
        diagnostic(errors, 'style', linePath + '.style', 'Line style is invalid');
      }
      var paths = Array.isArray(line.paths) ? line.paths : [];
      if (!Array.isArray(line.paths)) diagnostic(errors, 'type', linePath + '.paths', 'Line paths must be an array');
      pathCount += paths.length;
      paths.forEach(function (pathValue, pathIndex) {
        var path = linePath + '.paths[' + pathIndex + ']';
        if (!isPlainObject(pathValue)) {
          diagnostic(errors, 'type', path, 'Path must be an object');
          return;
        }
        registerId(pathValue.id, path + '.id');
        pathIds.add(pathValue.id);
        var points = Array.isArray(pathValue.points) ? pathValue.points : [];
        var pointsOnPath = new Set();
        pathPointIds.set(pathValue.id, pointsOnPath);
        if (!Array.isArray(pathValue.points) || points.length < 2) diagnostic(errors, 'points', path + '.points', 'Path needs at least two points');
        pointCount += points.length;
        points.forEach(function (point, pointIndex) {
          var pointPath = path + '.points[' + pointIndex + ']';
          if (!isPlainObject(point)) {
            diagnostic(errors, 'type', pointPath, 'Point must be an object');
            return;
          }
          registerId(point.id, pointPath + '.id');
          pointIds.add(point.id);
          pointsOnPath.add(point.id);
          if (!isFiniteInRange(point.x, -1000000, 1000000) || !isFiniteInRange(point.y, -1000000, 1000000)) diagnostic(errors, 'range', pointPath, 'Point coordinates are invalid');
          if (typeof point.junctionId !== 'undefined' && point.junctionId !== null) {
            if (typeof point.junctionId !== 'string' || !junctionIds.has(point.junctionId)) diagnostic(errors, 'missing-junction', pointPath + '.junctionId', 'Point junction does not exist');
            else {
              var pointJunction = findJunction(candidate, point.junctionId);
              if (pointJunction && (point.x !== pointJunction.x || point.y !== pointJunction.y)) diagnostic(errors, 'junction-position', pointPath, 'Point coordinates do not match its junction');
            }
          }
          ['in', 'out'].forEach(function (handle) {
            var value = point[handle];
            if (value !== null && (!isPlainObject(value) || !isFiniteInRange(value.x, -1000000, 1000000) || !isFiniteInRange(value.y, -1000000, 1000000))) {
              diagnostic(errors, 'range', pointPath + '.' + handle, 'Control handle is invalid');
            }
          });
        });
      });
    });
    if (pathCount > LIMITS.paths) diagnostic(errors, 'limit', '$.lines[*].paths', 'Too many paths');
    if (pointCount > LIMITS.points) diagnostic(errors, 'limit', '$.lines[*].paths[*].points', 'Too many points');

    var stations = Array.isArray(candidate.stations) ? candidate.stations : [];
    if (!Array.isArray(candidate.stations)) diagnostic(errors, 'type', '$.stations', 'Stations must be an array');
    if (stations.length > LIMITS.stations) diagnostic(errors, 'limit', '$.stations', 'Too many stations');
    var stationIds = new Set();
    var placedStationIds = new Set();
    var stationJunctions = new Map();
    var stationNames = new Map();
    stations.forEach(function (station, index) {
      var path = '$.stations[' + index + ']';
      if (!isPlainObject(station)) {
        diagnostic(errors, 'type', path, 'Station must be an object');
        return;
      }
      registerId(station.id, path + '.id');
      stationIds.add(station.id);
      if (typeof station.name !== 'string' || !station.name.trim() || station.name.length > 80) diagnostic(errors, 'string', path + '.name', 'Station name is invalid');
      else {
        var normalizedName = station.name.trim().toLocaleLowerCase();
        if (stationNames.has(normalizedName)) diagnostic(errors, 'duplicate-station-name', path + '.name', 'Station name duplicates ' + stationNames.get(normalizedName));
        else stationNames.set(normalizedName, path + '.name');
      }
      if (station.placement !== null && !isPlainObject(station.placement)) {
        diagnostic(errors, 'type', path + '.placement', 'Station placement must be an object or null');
      } else if (isPlainObject(station.placement)) {
        placedStationIds.add(station.id);
        if (!isFiniteInRange(station.placement.x, -1000000, 1000000) || !isFiniteInRange(station.placement.y, -1000000, 1000000)) diagnostic(errors, 'range', path + '.placement', 'Station coordinates are invalid');
        var stationJunctionId = station.placement.junctionId;
        if (typeof stationJunctionId !== 'undefined' && stationJunctionId !== null) {
          if (typeof stationJunctionId !== 'string' || !junctionIds.has(stationJunctionId)) diagnostic(errors, 'missing-junction', path + '.placement.junctionId', 'Station junction does not exist');
          else {
            if (stationJunctions.has(stationJunctionId)) diagnostic(errors, 'duplicate-junction-station', path + '.placement.junctionId', 'Junction already has a station');
            stationJunctions.set(stationJunctionId, station.id);
            var stationJunction = findJunction(candidate, stationJunctionId);
            if (stationJunction && (station.placement.x !== stationJunction.x || station.placement.y !== stationJunction.y)) diagnostic(errors, 'junction-position', path + '.placement', 'Station coordinates do not match its junction');
          }
        }
      }
      if (!isPlainObject(station.style) || !isFiniteInRange(station.style.radius, 2, 64) || !isHexColor(station.style.color)) diagnostic(errors, 'style', path + '.style', 'Station style is invalid');
    });

    var network = candidate.network;
    var edges = network && Array.isArray(network.edges) ? network.edges : [];
    var edgesById = new Map();
    if (!isPlainObject(network) || !Array.isArray(network.edges)) diagnostic(errors, 'type', '$.network', 'Network is invalid');
    if (edges.length > LIMITS.edges) diagnostic(errors, 'limit', '$.network.edges', 'Too many edges');
    edges.forEach(function (edge, index) {
      var path = '$.network.edges[' + index + ']';
      if (!isPlainObject(edge)) {
        diagnostic(errors, 'type', path, 'Edge must be an object');
        return;
      }
      registerId(edge.id, path + '.id');
      if (typeof edge.id === 'string') edgesById.set(edge.id, edge);
      if (!stationIds.has(edge.fromStationId)) diagnostic(errors, 'missing-station', path + '.fromStationId', 'Origin station does not exist');
      if (!stationIds.has(edge.toStationId)) diagnostic(errors, 'missing-station', path + '.toStationId', 'Destination station does not exist');
      if ((stationIds.has(edge.fromStationId) && !placedStationIds.has(edge.fromStationId)) || (stationIds.has(edge.toStationId) && !placedStationIds.has(edge.toStationId))) diagnostic(errors, 'unplaced-edge-station', path, 'Network edge cannot reference an unplaced station');
      if (!lineIds.has(edge.lineId)) diagnostic(errors, 'missing-line', path + '.lineId', 'Line does not exist');
      if (!isFiniteInRange(edge.distanceUnits, 0.000001, 1000000000) || !isFiniteInRange(edge.travelMinutes, 0.000001, 1000000000)) diagnostic(errors, 'range', path, 'Edge metrics are invalid');
      if (typeof edge.bidirectional !== 'boolean') diagnostic(errors, 'type', path + '.bidirectional', 'Edge direction is invalid');
      if (edge.geometryRef !== null && typeof edge.geometryRef !== 'undefined') {
        if (!isPlainObject(edge.geometryRef) || !pathIds.has(edge.geometryRef.pathId)) diagnostic(errors, 'missing-path', path + '.geometryRef.pathId', 'Geometry path does not exist');
        if (isPlainObject(edge.geometryRef) && (!pointIds.has(edge.geometryRef.fromPointId) || !pointIds.has(edge.geometryRef.toPointId))) diagnostic(errors, 'missing-point', path + '.geometryRef', 'Geometry point does not exist');
        if (isPlainObject(edge.geometryRef) && pathPointIds.has(edge.geometryRef.pathId)) {
          var geometryPoints = pathPointIds.get(edge.geometryRef.pathId);
          if (!geometryPoints.has(edge.geometryRef.fromPointId) || !geometryPoints.has(edge.geometryRef.toPointId)) diagnostic(errors, 'geometry-path', path + '.geometryRef', 'Geometry points must belong to the referenced path');
        }
      }
    });

    var routeRequests = network && Array.isArray(network.routeRequests) ? network.routeRequests : [];
    if (!isPlainObject(network) || !Array.isArray(network.routeRequests)) diagnostic(errors, 'type', '$.network.routeRequests', 'Route requests must be an array');
    if (routeRequests.length > LIMITS.routeRequests) diagnostic(errors, 'limit', '$.network.routeRequests', 'Too many route requests');
    routeRequests.forEach(function (request, index) {
      var path = '$.network.routeRequests[' + index + ']';
      if (!isPlainObject(request)) {
        diagnostic(errors, 'type', path, 'Route request must be an object');
        return;
      }
      registerId(request.id, path + '.id');
      if (!stationIds.has(request.fromStationId)) diagnostic(errors, 'missing-station', path + '.fromStationId', 'Origin station does not exist');
      if (!stationIds.has(request.toStationId)) diagnostic(errors, 'missing-station', path + '.toStationId', 'Destination station does not exist');
      if (request.fromStationId === request.toStationId) diagnostic(errors, 'same-station', path, 'Route request requires different stations');
      if (typeof request.service !== 'string' || !/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(request.service)) diagnostic(errors, 'value', path + '.service', 'Service code is invalid');
      if (request.preferredLineId !== null && !lineIds.has(request.preferredLineId)) diagnostic(errors, 'missing-line', path + '.preferredLineId', 'Preferred line does not exist');
      if (typeof request.createdAt !== 'string' || !Number.isFinite(Date.parse(request.createdAt))) diagnostic(errors, 'date', path + '.createdAt', 'Route request timestamp is invalid');
      if (typeof request.dismissed !== 'boolean') diagnostic(errors, 'type', path + '.dismissed', 'Route request dismissed state is invalid');
    });

    var farePolicy = network && network.farePolicy;
    if (!isPlainObject(farePolicy)) {
      diagnostic(errors, 'type', '$.network.farePolicy', 'Fare policy is invalid');
    } else {
      if (typeof farePolicy.currency !== 'string' || !/^[A-Z]{3}$/.test(farePolicy.currency)) diagnostic(errors, 'value', '$.network.farePolicy.currency', 'Currency is invalid');
      ['baseFareMinor', 'distanceFareMinor', 'transferFareMinor'].forEach(function (field) {
        if (!Number.isInteger(farePolicy[field]) || farePolicy[field] < 0) diagnostic(errors, 'range', '$.network.farePolicy.' + field, 'Fare value is invalid');
      });
      ['distanceStepUnits', 'roundingMinor'].forEach(function (field) {
        if (!Number.isInteger(farePolicy[field]) || farePolicy[field] <= 0) diagnostic(errors, 'range', '$.network.farePolicy.' + field, 'Fare step is invalid');
      });
    }

    var texts = Array.isArray(candidate.texts) ? candidate.texts : [];
    if (!Array.isArray(candidate.texts)) diagnostic(errors, 'type', '$.texts', 'Texts must be an array');
    if (texts.length > LIMITS.texts) diagnostic(errors, 'limit', '$.texts', 'Too many text objects');
    var textIds = new Set();
    texts.forEach(function (textValue, index) {
      var path = '$.texts[' + index + ']';
      if (!isPlainObject(textValue)) {
        diagnostic(errors, 'type', path, 'Text must be an object');
        return;
      }
      registerId(textValue.id, path + '.id');
      textIds.add(textValue.id);
      if (typeof textValue.text !== 'string' || textValue.text.length > 500) diagnostic(errors, 'string', path + '.text', 'Text content is invalid');
      if (!isFiniteInRange(textValue.x, -1000000, 1000000) || !isFiniteInRange(textValue.y, -1000000, 1000000)) diagnostic(errors, 'range', path, 'Text coordinates are invalid');
      if (!isPlainObject(textValue.style) || !isHexColor(textValue.style.color) || !isFiniteInRange(textValue.style.size, 6, 256) ||
        !isFiniteInRange(textValue.style.weight, 1, 1000) || !['start', 'middle', 'end'].includes(textValue.style.align)) {
        diagnostic(errors, 'style', path + '.style', 'Text style is invalid');
      }
    });

    var timeline = candidate.timeline;
    var tracks = timeline && Array.isArray(timeline.tracks) ? timeline.tracks : [];
    if (!isPlainObject(timeline) || !isFiniteInRange(timeline.durationMs, 100, 3600000) || !Array.isArray(timeline.tracks)) diagnostic(errors, 'type', '$.timeline', 'Timeline is invalid');
    if (tracks.length > LIMITS.tracks) diagnostic(errors, 'limit', '$.timeline.tracks', 'Too many tracks');
    tracks.forEach(function (track, index) {
      var path = '$.timeline.tracks[' + index + ']';
      if (!isPlainObject(track)) {
        diagnostic(errors, 'type', path, 'Track must be an object');
        return;
      }
      registerId(track.id, path + '.id');
      if (!isFiniteInRange(track.startMs, 0, 3600000) || !isFiniteInRange(track.durationMs, 1, 3600000)) diagnostic(errors, 'range', path, 'Track timing is invalid');
      if (!['linear', 'ease-in', 'ease-out', 'ease-in-out'].includes(track.easing)) diagnostic(errors, 'value', path + '.easing', 'Track easing is invalid');
      if (track.targetType === 'route') {
        if (track.effect !== 'route-draw') diagnostic(errors, 'value', path + '.effect', 'Route track effect is invalid');
        if (typeof track.showBaseRoute !== 'boolean') diagnostic(errors, 'type', path + '.showBaseRoute', 'Route base visibility is invalid');
        if (!isPlainObject(track.overlayStyle) || !/^#[0-9a-f]{6}$/i.test(track.overlayStyle.color || '') || !isFiniteInRange(track.overlayStyle.width, 1, 64)) {
          diagnostic(errors, 'style', path + '.overlayStyle', 'Route overlay style is invalid');
        }
        var route = track.route;
        if (!isPlainObject(route)) {
          diagnostic(errors, 'type', path + '.route', 'Route snapshot must be an object');
          return;
        }
        if (!stationIds.has(route.fromStationId)) diagnostic(errors, 'missing-station', path + '.route.fromStationId', 'Route origin station does not exist');
        if (!stationIds.has(route.toStationId)) diagnostic(errors, 'missing-station', path + '.route.toStationId', 'Route destination station does not exist');
        if (route.fromStationId === route.toStationId) diagnostic(errors, 'same-station', path + '.route', 'Route track requires different stations');
        var segments = Array.isArray(route.segments) ? route.segments : [];
        if (!Array.isArray(route.segments) || segments.length < 1 || segments.length > LIMITS.edges) diagnostic(errors, 'route-segments', path + '.route.segments', 'Route track needs a bounded non-empty segment list');
        var cursor = route.fromStationId;
        segments.forEach(function (segment, segmentIndex) {
          var segmentPath = path + '.route.segments[' + segmentIndex + ']';
          if (!isPlainObject(segment)) {
            diagnostic(errors, 'type', segmentPath, 'Route segment must be an object');
            return;
          }
          var edge = edgesById.get(segment.edgeId);
          if (!edge) {
            diagnostic(errors, 'missing-edge', segmentPath + '.edgeId', 'Route segment edge does not exist');
            return;
          }
          if (segment.fromStationId !== cursor) diagnostic(errors, 'route-order', segmentPath + '.fromStationId', 'Route segments are not contiguous');
          var forward = segment.fromStationId === edge.fromStationId && segment.toStationId === edge.toStationId;
          var reverse = edge.bidirectional && segment.fromStationId === edge.toStationId && segment.toStationId === edge.fromStationId;
          if (!forward && !reverse) diagnostic(errors, 'edge-direction', segmentPath, 'Route segment direction is not allowed by the edge');
          if (!edge.geometryRef) diagnostic(errors, 'missing-geometry', segmentPath + '.edgeId', 'Route segment edge has no geometry binding');
          cursor = segment.toStationId;
        });
        if (segments.length && cursor !== route.toStationId) diagnostic(errors, 'route-order', path + '.route.toStationId', 'Route segments do not reach the destination');
      } else {
        var targetExists = (track.targetType === 'line' && lineIds.has(track.targetId)) ||
          (track.targetType === 'station' && stationIds.has(track.targetId)) ||
          (track.targetType === 'text' && textIds.has(track.targetId));
        if (!targetExists) diagnostic(errors, 'missing-target', path + '.targetId', 'Timeline target does not exist');
        if (!['draw', 'fade', 'pulse'].includes(track.effect)) diagnostic(errors, 'value', path + '.effect', 'Track effect is invalid');
      }
    });

    if (!isPlainObject(candidate.extensions)) diagnostic(errors, 'type', '$.extensions', 'Extensions must be an object');
    return { valid: errors.length === 0, errors: errors };
  }

  function normalizeProject(candidate) {
    var normalized = cloneProject(candidate);
    var base = createProject({
      id: normalized.meta && normalized.meta.id,
      name: normalized.meta && normalized.meta.name,
      now: normalized.meta && normalized.meta.createdAt
    });
    mergeDefaults(normalized, base);
    normalized.lines.forEach(function (line) {
      line.style = mergeDefaults(line.style || {}, { color: '#1f8ca8', width: 8, dash: [] });
      if (!Array.isArray(line.paths)) line.paths = [];
      line.paths.forEach(function (path) {
        if (!Array.isArray(path.points)) path.points = [];
        path.points.forEach(function (point) {
          if (typeof point.in === 'undefined') point.in = null;
          if (typeof point.out === 'undefined') point.out = null;
          if (typeof point.junctionId === 'undefined') point.junctionId = null;
        });
      });
    });
    normalized.stations.forEach(function (station) {
      station.style = mergeDefaults(station.style || {}, { radius: 8, color: '#f5f1e8' });
      if (typeof station.placement === 'undefined') station.placement = null;
      if (station.placement && typeof station.placement.junctionId === 'undefined') station.placement.junctionId = null;
    });
    normalized.junctions.forEach(function (junction) { syncJunction(normalized, junction.id, junction); });
    normalized.texts.forEach(function (textValue) {
      textValue.style = mergeDefaults(textValue.style || {}, { color: '#102a36', size: 24, weight: 600, align: 'start' });
    });
    var validation = validateProject(normalized);
    if (!validation.valid) {
      var error = new Error('Project validation failed: ' + validation.errors.map(function (entry) { return entry.path + ' ' + entry.message; }).join('; '));
      error.name = 'ProjectValidationError';
      error.diagnostics = validation.errors;
      throw error;
    }
    return normalized;
  }

  var api = {
    SCHEMA: SCHEMA,
    VERSION: VERSION,
    LIMITS: LIMITS,
    createProject: createProject,
    cloneProject: cloneProject,
    findJunction: findJunction,
    pointPosition: pointPosition,
    isStationPlaced: isStationPlaced,
    stationPosition: stationPosition,
    syncJunction: syncJunction,
    normalizeProject: normalizeProject,
    validateProject: validateProject
  };

  global.RailwayProject = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
