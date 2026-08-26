(function (global) {
  'use strict';

  function assertViewport(viewport) {
    if (!viewport || !Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.scale) || viewport.scale <= 0) {
      throw new TypeError('Viewport is invalid');
    }
  }

  function screenToWorld(point, viewport) {
    assertViewport(viewport);
    return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale };
  }

  function zoomAround(viewport, factor, anchor, limits) {
    assertViewport(viewport);
    if (!Number.isFinite(factor) || factor <= 0) throw new TypeError('Zoom factor is invalid');
    var range = limits || { min: 0.1, max: 16 };
    var scale = Math.min(range.max, Math.max(range.min, viewport.scale * factor));
    var world = screenToWorld(anchor, viewport);
    return {
      x: anchor.x - world.x * scale,
      y: anchor.y - world.y * scale,
      scale: scale
    };
  }

  function containFrame(content, surface) {
    if (!content || !Number.isFinite(content.width) || content.width <= 0 || !Number.isFinite(content.height) || content.height <= 0) {
      throw new TypeError('Contained content is invalid');
    }
    if (!surface || !Number.isFinite(surface.width) || surface.width <= 0 || !Number.isFinite(surface.height) || surface.height <= 0) {
      throw new TypeError('Containing surface is invalid');
    }
    var scale = Math.min(surface.width / content.width, surface.height / content.height);
    var renderedWidth = content.width * scale;
    var renderedHeight = content.height * scale;
    return {
      scale: scale,
      offsetX: (surface.width - renderedWidth) / 2,
      offsetY: (surface.height - renderedHeight) / 2,
      renderedWidth: renderedWidth,
      renderedHeight: renderedHeight
    };
  }

  function scenePlane(content, surface, viewport) {
    assertViewport(viewport);
    var frame = containFrame(content, surface);
    return {
      left: frame.offsetX,
      top: frame.offsetY,
      width: frame.renderedWidth,
      height: frame.renderedHeight,
      scale: viewport.scale,
      translateX: viewport.x * frame.scale,
      translateY: viewport.y * frame.scale
    };
  }

  function distance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function snapPoint(point, options) {
    var settings = options || {};
    if (!settings.enabled) return { point: { x: point.x, y: point.y }, kind: 'none', targetId: null };
    var threshold = Number.isFinite(settings.threshold) ? Math.max(0, settings.threshold) : 0;
    var nearest = null;
    (settings.candidates || []).forEach(function (candidate) {
      var separation = distance(point, candidate);
      if (separation <= threshold && (!nearest || separation < nearest.distance || (separation === nearest.distance && String(candidate.id) < String(nearest.candidate.id)))) {
        nearest = { candidate: candidate, distance: separation };
      }
    });
    if (nearest) {
      return {
        point: { x: nearest.candidate.x, y: nearest.candidate.y },
        kind: 'object',
        targetId: nearest.candidate.id || null
      };
    }
    var grid = Number.isFinite(settings.gridSize) && settings.gridSize > 0 ? settings.gridSize : 1;
    return {
      point: { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid },
      kind: 'grid',
      targetId: null
    };
  }

  function number(value) {
    return Number(value.toFixed(4)).toString();
  }

  function pathToSvgD(points) {
    if (!Array.isArray(points) || points.length === 0) return '';
    var output = 'M ' + number(points[0].x) + ' ' + number(points[0].y);
    for (var index = 1; index < points.length; index += 1) {
      var previous = points[index - 1];
      var current = points[index];
      if (previous.out || current.in) {
        var first = previous.out || previous;
        var second = current.in || current;
        output += ' C ' + number(first.x) + ' ' + number(first.y) + ' ' + number(second.x) + ' ' + number(second.y) + ' ' + number(current.x) + ' ' + number(current.y);
      } else {
        output += ' L ' + number(current.x) + ' ' + number(current.y);
      }
    }
    return output;
  }

  function cubicPoint(start, controlA, controlB, end, t) {
    var inverse = 1 - t;
    return {
      x: inverse * inverse * inverse * start.x + 3 * inverse * inverse * t * controlA.x + 3 * inverse * t * t * controlB.x + t * t * t * end.x,
      y: inverse * inverse * inverse * start.y + 3 * inverse * inverse * t * controlA.y + 3 * inverse * t * t * controlB.y + t * t * t * end.y
    };
  }

  function distanceOnPath(points, samplesPerCurve) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    var samples = Number.isInteger(samplesPerCurve) && samplesPerCurve > 1 ? samplesPerCurve : 24;
    var total = 0;
    for (var index = 1; index < points.length; index += 1) {
      var previous = points[index - 1];
      var current = points[index];
      if (!previous.out && !current.in) {
        total += distance(previous, current);
        continue;
      }
      var controlA = previous.out || previous;
      var controlB = current.in || current;
      var cursor = previous;
      for (var sample = 1; sample <= samples; sample += 1) {
        var next = cubicPoint(previous, controlA, controlB, current, sample / samples);
        total += distance(cursor, next);
        cursor = next;
      }
    }
    return total;
  }

  var api = {
    screenToWorld: screenToWorld,
    zoomAround: zoomAround,
    containFrame: containFrame,
    scenePlane: scenePlane,
    snapPoint: snapPoint,
    pathToSvgD: pathToSvgD,
    distanceOnPath: distanceOnPath
  };

  global.RailwayGeometry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
