(function (global) {
  'use strict';

  var Geometry = global.RailwayGeometry;
  var Network = global.RailwayNetwork;
  var Project = global.RailwayProject;
  if (!Geometry && typeof require === 'function') Geometry = require('./geometry.js');
  if (!Network && typeof require === 'function') Network = require('./network.js');
  if (!Project && typeof require === 'function') Project = require('./project.js');

  function routeAnimationError(message, code) {
    var error = new Error(message);
    error.name = 'RailwayRouteAnimationError';
    error.code = code;
    return error;
  }

  function cloneHandle(handle) {
    return handle ? { x: handle.x, y: handle.y } : null;
  }

  function clonePoint(project, point) {
    var position = Project.pointPosition(project, point);
    return {
      id: point.id,
      x: position.x,
      y: position.y,
      in: cloneHandle(point.in),
      out: cloneHandle(point.out),
      junctionId: typeof point.junctionId === 'string' ? point.junctionId : null
    };
  }

  function reversePoints(points) {
    return points.slice().reverse().map(function (point) {
      return Object.assign({}, point, {
        in: cloneHandle(point.out),
        out: cloneHandle(point.in)
      });
    });
  }

  function directedPoints(project, path, fromPointId, toPointId) {
    var fromIndex = path.points.findIndex(function (point) { return point.id === fromPointId; });
    var toIndex = path.points.findIndex(function (point) { return point.id === toPointId; });
    if (fromIndex < 0 || toIndex < 0) throw routeAnimationError('Route geometry point does not exist on the referenced path', 'MISSING_POINT');
    if (fromIndex === toIndex) throw routeAnimationError('Route geometry must cover at least two points', 'EMPTY_GEOMETRY');
    var low = Math.min(fromIndex, toIndex);
    var high = Math.max(fromIndex, toIndex);
    var points = path.points.slice(low, high + 1).map(function (point) { return clonePoint(project, point); });
    return fromIndex < toIndex ? points : reversePoints(points);
  }

  function routeMaps(project) {
    var paths = new Map();
    (project.lines || []).forEach(function (line) {
      (line.paths || []).forEach(function (path) { paths.set(path.id, { line: line, path: path }); });
    });
    return {
      edges: new Map((((project.network || {}).edges) || []).map(function (edge) { return [edge.id, edge]; })),
      paths: paths
    };
  }

  function resolve(project, track) {
    if (!project || !track || track.targetType !== 'route' || !track.route || !Array.isArray(track.route.segments)) {
      throw routeAnimationError('Route animation track is invalid', 'INVALID_TRACK');
    }
    var maps = routeMaps(project);
    var segments = track.route.segments.map(function (snapshot) {
      var edge = maps.edges.get(snapshot.edgeId);
      if (!edge) throw routeAnimationError('Route segment edge does not exist', 'MISSING_EDGE');
      if (!edge.geometryRef) throw routeAnimationError('Route segment has no geometry binding', 'MISSING_GEOMETRY');
      var pathRecord = maps.paths.get(edge.geometryRef.pathId);
      if (!pathRecord) throw routeAnimationError('Route geometry path does not exist', 'MISSING_PATH');
      var forward = snapshot.fromStationId === edge.fromStationId && snapshot.toStationId === edge.toStationId;
      var reverse = edge.bidirectional && snapshot.fromStationId === edge.toStationId && snapshot.toStationId === edge.fromStationId;
      if (!forward && !reverse) throw routeAnimationError('Route segment direction is not allowed', 'EDGE_DIRECTION');
      var fromPointId = forward ? edge.geometryRef.fromPointId : edge.geometryRef.toPointId;
      var toPointId = forward ? edge.geometryRef.toPointId : edge.geometryRef.fromPointId;
      var points = directedPoints(project, pathRecord.path, fromPointId, toPointId);
      var length = Geometry.distanceOnPath(points);
      if (!Number.isFinite(length) || length <= 0) throw routeAnimationError('Route geometry has no positive length', 'EMPTY_GEOMETRY');
      return {
        edgeId: edge.id,
        lineId: edge.lineId,
        pathId: pathRecord.path.id,
        fromStationId: snapshot.fromStationId,
        toStationId: snapshot.toStationId,
        points: points,
        d: Geometry.pathToSvgD(points),
        length: length,
        startRatio: 0,
        endRatio: 0
      };
    });
    if (!segments.length) throw routeAnimationError('Route animation needs at least one segment', 'EMPTY_ROUTE');
    var totalLength = segments.reduce(function (sum, segment) { return sum + segment.length; }, 0);
    var cursor = 0;
    var stations = [{ stationId: track.route.fromStationId, threshold: 0 }];
    segments.forEach(function (segment) {
      segment.startRatio = cursor / totalLength;
      cursor += segment.length;
      segment.endRatio = cursor / totalLength;
      stations.push({ stationId: segment.toStationId, threshold: segment.endRatio });
    });
    return { segments: segments, stations: stations, totalLength: totalLength };
  }

  function createTrack(project, fromStationId, toStationId, options) {
    var settings = options || {};
    if (typeof settings.idFactory !== 'function') throw new TypeError('Route animation ID factory is required');
    var startMs = typeof settings.startMs === 'undefined' ? 0 : settings.startMs;
    var durationMs = typeof settings.durationMs === 'undefined' ? 2400 : settings.durationMs;
    var easing = settings.easing || 'ease-in-out';
    var color = settings.color || (settings.overlayStyle && settings.overlayStyle.color) || '#18a8c7';
    var width = typeof settings.width === 'number' ? settings.width : settings.overlayStyle && settings.overlayStyle.width || 12;
    if (!Number.isFinite(startMs) || startMs < 0 || startMs > 3600000 || !Number.isFinite(durationMs) || durationMs < 1 || durationMs > 3600000) {
      throw new RangeError('Route animation timing is invalid');
    }
    if (!['linear', 'ease-in', 'ease-out', 'ease-in-out'].includes(easing)) throw new TypeError('Route animation easing is invalid');
    if (!/^#[0-9a-f]{6}$/i.test(color) || !Number.isFinite(width) || width < 1 || width > 64) throw new TypeError('Route animation style is invalid');
    var route = Network.findRoute(project, fromStationId, toStationId);
    var track = {
      id: settings.idFactory('track'),
      targetType: 'route',
      effect: 'route-draw',
      startMs: startMs,
      durationMs: durationMs,
      easing: easing,
      showBaseRoute: typeof settings.showBaseRoute === 'boolean' ? settings.showBaseRoute : true,
      overlayStyle: { color: color, width: width },
      route: {
        fromStationId: fromStationId,
        toStationId: toStationId,
        segments: route.segments.map(function (segment) {
          return { edgeId: segment.edgeId, fromStationId: segment.fromStationId, toStationId: segment.toStationId };
        })
      }
    };
    resolve(project, track);
    return track;
  }

  function ease(value, easing) {
    if (easing === 'ease-in') return value * value;
    if (easing === 'ease-out') return 1 - Math.pow(1 - value, 2);
    if (easing === 'ease-in-out') return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
    return value;
  }

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function frame(resolved, track, positionMs) {
    if (!resolved || !Array.isArray(resolved.segments) || !track) throw new TypeError('Resolved route animation is required');
    var raw = clamp((positionMs - track.startMs) / track.durationMs);
    var progress = ease(raw, track.easing);
    return {
      progress: progress,
      segments: resolved.segments.map(function (segment) {
        var span = segment.endRatio - segment.startRatio;
        return Object.assign({}, segment, { progress: span > 0 ? clamp((progress - segment.startRatio) / span) : progress >= segment.endRatio ? 1 : 0 });
      }),
      visibleStationIds: resolved.stations.filter(function (station) { return station.threshold <= progress + 0.0000001; }).map(function (station) { return station.stationId; })
    };
  }

  var api = {
    createTrack: createTrack,
    resolve: resolve,
    frame: frame
  };
  global.RailwayRouteAnimation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
