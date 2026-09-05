(function (global) {
  'use strict';

  var Geometry = global.RailwayGeometry;
  var Project = global.RailwayProject;
  var RouteAnimation = global.RailwayRouteAnimation;
  if (!Geometry && typeof require === 'function') Geometry = require('./geometry.js');
  if (!Project && typeof require === 'function') Project = require('./project.js');
  if (!RouteAnimation && typeof require === 'function') RouteAnimation = require('./route-animation.js');

  var TOOLS = new Set(['select', 'pan', 'line', 'station', 'text']);

  function interpolate(first, second, ratio) {
    return { x: first.x + (second.x - first.x) * ratio, y: first.y + (second.y - first.y) * ratio };
  }

  function curveHandles(start, end, offset) {
    var vector = { x: end.x - start.x, y: end.y - start.y };
    var length = Math.hypot(vector.x, vector.y) || 1;
    var normal = { x: -vector.y / length, y: vector.x / length };
    var first = interpolate(start, end, 1 / 3);
    var second = interpolate(start, end, 2 / 3);
    return {
      out: { x: first.x + normal.x * offset, y: first.y + normal.y * offset },
      incoming: { x: second.x + normal.x * offset, y: second.y + normal.y * offset }
    };
  }

  function createEditor(options) {
    var project = options.project;
    var history = options.history;
    var idFactory = options.idFactory;
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    if (!project || !history || typeof idFactory !== 'function') throw new TypeError('Editor options are invalid');

    var tool = 'select';
    var lineMode = 'segment';
    var selection = null;
    var gesture = null;
    var lineDraft = null;

    function command(label, execute, undo) {
      history.execute({
        label: label,
        execute: function () { execute(); onChange(label); },
        undo: function () { undo(); onChange('undo-' + label); }
      });
    }

    function setTool(next) {
      if (!TOOLS.has(next)) throw new Error('Unknown tool: ' + next);
      tool = next;
      gesture = null;
      lineDraft = null;
      return tool;
    }

    function setLineMode(next) {
      if (!['segment', 'polyline'].includes(next)) throw new Error('Unknown line mode: ' + next);
      lineMode = next;
      lineDraft = null;
      return lineMode;
    }

    function commitLine(draftPoints, modifiers) {
      if (!Array.isArray(draftPoints) || draftPoints.length < 2) return null;
      var input = modifiers || {};
      var handles = input.curve && draftPoints.length === 2
        ? curveHandles(draftPoints[0], draftPoints[1], Number.isFinite(input.curveOffset) ? input.curveOffset : 64)
        : null;
      var points = draftPoints.map(function (point, index) {
        return {
          id: idFactory('point'),
          x: point.x,
          y: point.y,
          in: handles && index === 1 ? handles.incoming : null,
          out: handles && index === 0 ? handles.out : null,
          junctionId: null
        };
      });
      var line = {
        id: idFactory('line'),
        name: '新线路',
        style: { color: '#1f8ca8', width: 8, dash: [] },
        paths: [{ id: idFactory('path'), points: points }]
      };
      var createdJunctions = [];
      var bindings = [];
      var targetJunctions = new Map();

      function createJunction(position) {
        var junction = { id: idFactory('junction'), x: position.x, y: position.y };
        createdJunctions.push(junction);
        return junction;
      }

      function planBinding(target, junction) {
        if (target.junctionId === junction.id) return;
        bindings.push({
          target: target,
          previous: { junctionId: typeof target.junctionId === 'string' ? target.junctionId : null, x: target.x, y: target.y },
          next: { junctionId: junction.id, x: junction.x, y: junction.y }
        });
      }

      function junctionForDraft(draft, modelPoint, endpoint) {
        var target = draft.target;
        var junction = null;
        var key = target ? target.type + ':' + target.id : null;
        if (key && targetJunctions.has(key)) return targetJunctions.get(key);
        if (target && target.type === 'junction') {
          junction = Project.findJunction(project, target.id);
          if (!junction) throw new Error('Line target junction does not exist');
        } else if (target && target.type === 'point') {
          var pointTarget = findPoint(target);
          junction = pointTarget.junctionId ? Project.findJunction(project, pointTarget.junctionId) : null;
          if (!junction) {
            junction = createJunction({ x: pointTarget.x, y: pointTarget.y });
            planBinding(pointTarget, junction);
          }
        } else if (target && target.type === 'station') {
          var stationTarget = project.stations.find(function (station) { return station.id === target.id; });
          if (!stationTarget) throw new Error('Line target station does not exist');
          if (!Project.isStationPlaced(stationTarget)) throw new Error('Line target station is not placed');
          var stationPlacement = stationTarget.placement;
          junction = stationPlacement.junctionId ? Project.findJunction(project, stationPlacement.junctionId) : null;
          if (!junction) {
            junction = createJunction({ x: stationPlacement.x, y: stationPlacement.y });
            planBinding(stationPlacement, junction);
          }
        } else if (endpoint) {
          junction = createJunction(modelPoint);
        }
        if (junction && key) targetJunctions.set(key, junction);
        return junction;
      }

      points.forEach(function (point, pointIndex) {
        var junction = junctionForDraft(draftPoints[pointIndex], point, pointIndex === 0 || pointIndex === points.length - 1);
        if (!junction) return;
        point.junctionId = junction.id;
        point.x = junction.x;
        point.y = junction.y;
      });
      var index = project.lines.length;
      command('create-line', function () {
        createdJunctions.forEach(function (junction) { if (!project.junctions.includes(junction)) project.junctions.push(junction); });
        bindings.forEach(function (binding) {
          binding.target.junctionId = binding.next.junctionId;
          binding.target.x = binding.next.x;
          binding.target.y = binding.next.y;
        });
        project.lines.splice(index, 0, line);
      }, function () {
        project.lines.splice(project.lines.indexOf(line), 1);
        bindings.forEach(function (binding) {
          binding.target.junctionId = binding.previous.junctionId;
          binding.target.x = binding.previous.x;
          binding.target.y = binding.previous.y;
        });
        createdJunctions.forEach(function (junction) {
          var junctionIndex = project.junctions.indexOf(junction);
          if (junctionIndex >= 0) project.junctions.splice(junctionIndex, 1);
        });
      });
      selection = { type: 'line', id: line.id };
      return line;
    }

    function addLinePoint(point, target, modifiers) {
      if (tool !== 'line') throw new Error('Line tool is required');
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new TypeError('Line point is invalid');
      if (!lineDraft) lineDraft = { points: [], end: null, curve: false };
      lineDraft.points.push({ x: point.x, y: point.y, target: target || null });
      lineDraft.end = { x: point.x, y: point.y };
      lineDraft.curve = lineDraft.curve || Boolean(modifiers && modifiers.curve);
      if (lineMode === 'segment' && lineDraft.points.length === 2) return finishLine(modifiers);
      return null;
    }

    function updateLinePreview(point) {
      if (!lineDraft || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return getPreview();
      lineDraft.end = { x: point.x, y: point.y };
      return getPreview();
    }

    function removeLastLinePoint() {
      if (!lineDraft || !lineDraft.points.length) return false;
      lineDraft.points.pop();
      if (!lineDraft.points.length) lineDraft = null;
      else lineDraft.end = { x: lineDraft.points[lineDraft.points.length - 1].x, y: lineDraft.points[lineDraft.points.length - 1].y };
      return true;
    }

    function finishLine(modifiers) {
      if (!lineDraft || lineDraft.points.length < 2) return null;
      var completed = lineDraft;
      lineDraft = null;
      return commitLine(completed.points, {
        curve: completed.curve || Boolean(modifiers && modifiers.curve),
        curveOffset: modifiers && modifiers.curveOffset
      });
    }

    function pointerDown(point, modifiers) {
      var input = modifiers || {};
      if (tool === 'line') {
        gesture = { type: 'line', start: { x: point.x, y: point.y }, end: { x: point.x, y: point.y }, curve: Boolean(input.curve) };
      } else if (tool === 'station') {
        gesture = { type: 'station', start: { x: point.x, y: point.y }, end: { x: point.x, y: point.y } };
      } else if (tool === 'pan') {
        gesture = { type: 'pan', start: { x: point.x, y: point.y }, end: { x: point.x, y: point.y } };
      }
      return getPreview();
    }

    function pointerMove(point) {
      if (gesture) gesture.end = { x: point.x, y: point.y };
      return getPreview();
    }

    function pointerUp(point, modifiers) {
      if (!gesture) return null;
      gesture.end = { x: point.x, y: point.y };
      var completed = gesture;
      gesture = null;
      if (completed.type === 'line') {
        if (Math.hypot(completed.end.x - completed.start.x, completed.end.y - completed.start.y) < 1) return null;
        var input = modifiers || {};
        var isCurve = completed.curve || Boolean(input.curve);
        return commitLine([completed.start, completed.end], { curve: isCurve, curveOffset: input.curveOffset });
      }
      if (completed.type === 'station') {
        var station = {
          id: idFactory('station'),
          name: '新站点',
          placement: { x: completed.end.x, y: completed.end.y, junctionId: null },
          style: { radius: 8, color: '#f5f1e8' }
        };
        var stationIndex = project.stations.length;
        command('create-station', function () { project.stations.splice(stationIndex, 0, station); }, function () { project.stations.splice(project.stations.indexOf(station), 1); });
        selection = { type: 'station', id: station.id };
        return station;
      }
      return completed;
    }

    function cancelGesture() {
      gesture = null;
      lineDraft = null;
    }

    function getPreview() {
      if (lineDraft) {
        return {
          type: 'line-draft',
          mode: lineMode,
          points: lineDraft.points.map(function (point) { return { x: point.x, y: point.y }; }),
          end: { x: lineDraft.end.x, y: lineDraft.end.y }
        };
      }
      if (!gesture) return null;
      return {
        type: gesture.type,
        start: { x: gesture.start.x, y: gesture.start.y },
        end: { x: gesture.end.x, y: gesture.end.y },
        curve: gesture.type === 'line' ? gesture.curve : false
      };
    }

    function findPointReference(reference) {
      var line = project.lines.find(function (entry) { return entry.id === reference.lineId; });
      var path = line && line.paths.find(function (entry) { return entry.id === reference.pathId; });
      var pointIndex = path ? path.points.findIndex(function (entry) { return entry.id === (reference.pointId || reference.id); }) : -1;
      var point = pointIndex >= 0 ? path.points[pointIndex] : null;
      if (!point) throw new Error('Unknown point reference');
      return { line: line, path: path, point: point, pointIndex: pointIndex };
    }

    function findPoint(reference) {
      return findPointReference(reference).point;
    }

    function movePoint(reference, next) {
      var point = findPoint(reference);
      if (point.junctionId) {
        var junction = Project.findJunction(project, point.junctionId);
        if (!junction) throw new Error('Point junction does not exist');
        var previousJunction = { x: junction.x, y: junction.y };
        command('move-junction', function () { Project.syncJunction(project, junction.id, next); }, function () { Project.syncJunction(project, junction.id, previousJunction); });
        return;
      }
      var previous = {
        x: point.x,
        y: point.y,
        in: point.in ? { x: point.in.x, y: point.in.y } : null,
        out: point.out ? { x: point.out.x, y: point.out.y } : null
      };
      var delta = { x: next.x - point.x, y: next.y - point.y };
      var moved = {
        x: next.x,
        y: next.y,
        in: point.in ? { x: point.in.x + delta.x, y: point.in.y + delta.y } : null,
        out: point.out ? { x: point.out.x + delta.x, y: point.out.y + delta.y } : null
      };
      function apply(value) {
        point.x = value.x;
        point.y = value.y;
        point.in = value.in ? { x: value.in.x, y: value.in.y } : null;
        point.out = value.out ? { x: value.out.x, y: value.out.y } : null;
      }
      command('move-point', function () { apply(moved); }, function () { apply(previous); });
    }

    function upgradeEndpointToStation(reference) {
      var located = findPointReference(reference);
      if (located.pointIndex !== 0 && located.pointIndex !== located.path.points.length - 1) throw new Error('Only a path endpoint can be upgraded');
      var point = located.point;
      var junction = point.junctionId ? Project.findJunction(project, point.junctionId) : null;
      var createdJunction = null;
      if (!junction) {
        createdJunction = { id: idFactory('junction'), x: point.x, y: point.y };
        junction = createdJunction;
      }
      if (project.stations.some(function (station) { return station.placement && station.placement.junctionId === junction.id; })) throw new Error('Junction already has a station');
      var station = {
        id: idFactory('station'),
        name: '新站点',
        placement: { x: junction.x, y: junction.y, junctionId: junction.id },
        style: { radius: 8, color: '#f5f1e8' }
      };
      var previous = { junctionId: typeof point.junctionId === 'string' ? point.junctionId : null, x: point.x, y: point.y };
      var stationIndex = project.stations.length;
      command('upgrade-endpoint', function () {
        if (createdJunction && !project.junctions.includes(createdJunction)) project.junctions.push(createdJunction);
        point.junctionId = junction.id;
        point.x = junction.x;
        point.y = junction.y;
        project.stations.splice(stationIndex, 0, station);
      }, function () {
        project.stations.splice(project.stations.indexOf(station), 1);
        point.junctionId = previous.junctionId;
        point.x = previous.x;
        point.y = previous.y;
        if (createdJunction) {
          var junctionIndex = project.junctions.indexOf(createdJunction);
          if (junctionIndex >= 0) project.junctions.splice(junctionIndex, 1);
        }
      });
      selection = { type: 'station', id: station.id };
      return station;
    }

    function setControlHandle(reference, handle, next) {
      if (!['in', 'out'].includes(handle)) throw new Error('Unknown control handle');
      var point = findPoint(reference);
      var previous = point[handle] ? { x: point[handle].x, y: point[handle].y } : null;
      var value = next ? { x: next.x, y: next.y } : null;
      command('move-handle', function () { point[handle] = value; }, function () { point[handle] = previous; });
    }

    function createText(point, text) {
      var value = String(text || '').trim();
      if (!value) throw new Error('Text content is required');
      var textObject = {
        id: idFactory('text'), text: value, x: point.x, y: point.y,
        style: { color: '#102a36', size: 24, weight: 600, align: 'start' }
      };
      var index = project.texts.length;
      command('create-text', function () { project.texts.splice(index, 0, textObject); }, function () { project.texts.splice(project.texts.indexOf(textObject), 1); });
      selection = { type: 'text', id: textObject.id };
      return textObject;
    }

    function select(next) {
      selection = next ? { type: next.type, id: next.id } : null;
      return getSelection();
    }

    function getSelection() {
      return selection ? { type: selection.type, id: selection.id } : null;
    }

    function deleteSelection() {
      if (!selection) return { deleted: false, reason: 'no-selection' };
      var collection;
      if (selection.type === 'station') {
        if (project.timeline.tracks.some(function (track) {
          return track.targetType === 'route' && track.route && (track.route.fromStationId === selection.id || track.route.toStationId === selection.id ||
            track.route.segments.some(function (segment) { return segment.fromStationId === selection.id || segment.toStationId === selection.id; }));
        })) return { deleted: false, reason: 'referenced-by-animation' };
        if (project.network.edges.some(function (edge) { return edge.fromStationId === selection.id || edge.toStationId === selection.id; })) {
          return { deleted: false, reason: 'referenced-by-edge' };
        }
        if (project.network.routeRequests.some(function (request) { return request.fromStationId === selection.id || request.toStationId === selection.id; })) {
          return { deleted: false, reason: 'referenced-by-route' };
        }
        collection = project.stations;
      } else if (selection.type === 'line') {
        if (project.timeline.tracks.some(function (track) {
          if (track.targetType !== 'route' || !track.route) return false;
          var edgeIds = new Set(track.route.segments.map(function (segment) { return segment.edgeId; }));
          return project.network.edges.some(function (edge) { return edgeIds.has(edge.id) && edge.lineId === selection.id; });
        })) return { deleted: false, reason: 'referenced-by-animation' };
        if (project.network.edges.some(function (edge) { return edge.lineId === selection.id; })) {
          return { deleted: false, reason: 'referenced-by-edge' };
        }
        if (project.network.routeRequests.some(function (request) { return request.preferredLineId === selection.id; })) {
          return { deleted: false, reason: 'referenced-by-route' };
        }
        collection = project.lines;
      } else if (selection.type === 'text') {
        collection = project.texts;
      } else {
        return { deleted: false, reason: 'unsupported-selection' };
      }
      var index = collection.findIndex(function (entry) { return entry.id === selection.id; });
      if (index < 0) return { deleted: false, reason: 'missing-object' };
      var value = collection[index];
      var candidateJunctionIds = [];
      if (selection.type === 'line') {
        value.paths.forEach(function (path) {
          path.points.forEach(function (point) { if (point.junctionId) candidateJunctionIds.push(point.junctionId); });
        });
      } else if (selection.type === 'station' && value.placement && value.placement.junctionId) {
        candidateJunctionIds.push(value.placement.junctionId);
      }
      candidateJunctionIds = Array.from(new Set(candidateJunctionIds));
      var removedJunctions = [];
      var removedTracks = project.timeline.tracks.map(function (track, trackIndex) {
        return track.targetType === selection.type && track.targetId === selection.id ? { index: trackIndex, value: track } : null;
      }).filter(Boolean);

      function junctionIsReferenced(junctionId) {
        return project.lines.some(function (line) {
          return line.paths.some(function (path) { return path.points.some(function (point) { return point.junctionId === junctionId; }); });
        }) || project.stations.some(function (station) { return station.placement && station.placement.junctionId === junctionId; });
      }

      function removeUnusedJunctions() {
        removedJunctions = candidateJunctionIds.map(function (junctionId) {
          var junctionIndex = project.junctions.findIndex(function (junction) { return junction.id === junctionId; });
          return junctionIndex >= 0 && !junctionIsReferenced(junctionId) ? { index: junctionIndex, value: project.junctions[junctionIndex] } : null;
        }).filter(Boolean).sort(function (first, second) { return second.index - first.index; });
        removedJunctions.forEach(function (entry) { project.junctions.splice(entry.index, 1); });
      }

      function restoreJunctions() {
        removedJunctions.slice().sort(function (first, second) { return first.index - second.index; }).forEach(function (entry) {
          project.junctions.splice(entry.index, 0, entry.value);
        });
      }

      function removeObjectTracks() {
        removedTracks.slice().sort(function (first, second) { return second.index - first.index; }).forEach(function (entry) {
          var trackIndex = project.timeline.tracks.findIndex(function (track) { return track.id === entry.value.id; });
          if (trackIndex >= 0) project.timeline.tracks.splice(trackIndex, 1);
        });
      }

      function restoreObjectTracks() {
        removedTracks.slice().sort(function (first, second) { return first.index - second.index; }).forEach(function (entry) {
          project.timeline.tracks.splice(Math.min(entry.index, project.timeline.tracks.length), 0, entry.value);
        });
      }

      command('delete-object', function () {
        removeObjectTracks();
        collection.splice(index, 1);
        removeUnusedJunctions();
      }, function () {
        restoreJunctions();
        collection.splice(index, 0, value);
        restoreObjectTracks();
      });
      selection = null;
      return { deleted: true, reason: null };
    }

    function updateSelection(patch) {
      if (!selection || !['line', 'station', 'text'].includes(selection.type)) throw new Error('Editable object selection is required');
      var collection = selection.type === 'line' ? project.lines : selection.type === 'station' ? project.stations : project.texts;
      var target = collection.find(function (entry) { return entry.id === selection.id; });
      if (!target) throw new Error('Selected object no longer exists');
      var previous = { name: target.name, text: target.text, style: Object.assign({}, target.style) };
      var next = { name: target.name, text: target.text, style: Object.assign({}, target.style) };
      if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim().slice(0, 80);
      if (typeof patch.text === 'string') next.text = patch.text.slice(0, 500);
      if (patch.style && typeof patch.style === 'object') {
        if (typeof patch.style.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.style.color)) next.style.color = patch.style.color;
        if (Number.isFinite(patch.style.width) && patch.style.width >= 1 && patch.style.width <= 64) next.style.width = patch.style.width;
        if (Number.isFinite(patch.style.radius) && patch.style.radius >= 2 && patch.style.radius <= 64) next.style.radius = patch.style.radius;
        if (Number.isFinite(patch.style.size) && patch.style.size >= 6 && patch.style.size <= 256) next.style.size = patch.style.size;
      }
      function apply(value) {
        if (typeof value.name !== 'undefined') target.name = value.name;
        if (typeof value.text !== 'undefined') target.text = value.text;
        target.style = Object.assign({}, value.style);
      }
      command('update-object', function () { apply(next); }, function () { apply(previous); });
      return target;
    }

    function createEdge(input) {
      var fromStation = project.stations.find(function (station) { return station.id === input.fromStationId; });
      var toStation = project.stations.find(function (station) { return station.id === input.toStationId; });
      if (!fromStation || !toStation) {
        throw new Error('Network edge references an unknown station');
      }
      if (!Project.isStationPlaced(fromStation) || !Project.isStationPlaced(toStation)) throw new Error('Network edge requires placed stations');
      if (input.fromStationId === input.toStationId) throw new Error('Network edge requires different stations');
      if (!project.lines.some(function (line) { return line.id === input.lineId; })) throw new Error('Network edge references an unknown line');
      if (!Number.isFinite(input.distanceUnits) || input.distanceUnits <= 0 || !Number.isFinite(input.travelMinutes) || input.travelMinutes <= 0) {
        throw new Error('Network edge metrics are invalid');
      }
      var duplicate = project.network.edges.some(function (edge) {
        return edge.lineId === input.lineId && ((edge.fromStationId === input.fromStationId && edge.toStationId === input.toStationId) ||
          (edge.bidirectional && edge.fromStationId === input.toStationId && edge.toStationId === input.fromStationId));
      });
      if (duplicate) throw new Error('Network edge already exists');
      var edge = {
        id: idFactory('edge'),
        fromStationId: input.fromStationId,
        toStationId: input.toStationId,
        lineId: input.lineId,
        distanceUnits: input.distanceUnits,
        travelMinutes: input.travelMinutes,
        bidirectional: Boolean(input.bidirectional)
      };
      var index = project.network.edges.length;
      command('create-edge', function () { project.network.edges.splice(index, 0, edge); }, function () { project.network.edges.splice(project.network.edges.indexOf(edge), 1); });
      return edge;
    }

    function deleteEdge(edgeId) {
      var index = project.network.edges.findIndex(function (edge) { return edge.id === edgeId; });
      if (index < 0) return false;
      if (project.timeline.tracks.some(function (track) {
        return track.targetType === 'route' && track.route && track.route.segments.some(function (segment) { return segment.edgeId === edgeId; });
      })) return false;
      var edge = project.network.edges[index];
      command('delete-edge', function () { project.network.edges.splice(index, 1); }, function () { project.network.edges.splice(index, 0, edge); });
      return true;
    }

    function materializeRouteRequest(requestId, input) {
      var request = project.network.routeRequests.find(function (entry) { return entry.id === requestId; });
      if (!request) throw new Error('Unknown route request');
      var origin = project.stations.find(function (station) { return station.id === request.fromStationId; });
      var destination = project.stations.find(function (station) { return station.id === request.toStationId; });
      if (!origin || !destination || origin === destination) throw new Error('Route request stations are invalid');
      if (!input || !Array.isArray(input.points) || input.points.length < 2 || input.points.some(function (point) {
        return !point || !Number.isFinite(point.x) || !Number.isFinite(point.y);
      })) throw new TypeError('Route materialization points are invalid');
      if (!Number.isFinite(input.travelMinutes) || input.travelMinutes <= 0) throw new TypeError('Route travel minutes are invalid');

      var existingLine = input.lineId ? project.lines.find(function (line) { return line.id === input.lineId; }) : null;
      if (input.lineId && !existingLine) throw new Error('Route materialization line does not exist');
      if (request.preferredLineId && (!existingLine || existingLine.id !== request.preferredLineId)) throw new Error('Route materialization must use the preferred line');
      var newLineName = String(input.newLineName || '').trim();
      if (!existingLine && (!newLineName || newLineName.length > 80)) throw new TypeError('New route line name is invalid');

      var positions = input.points.map(function (point) { return { x: point.x, y: point.y }; });
      var originPosition = Project.stationPosition(project, origin);
      var destinationPosition = Project.stationPosition(project, destination);
      if (originPosition) positions[0] = originPosition;
      if (destinationPosition) positions[positions.length - 1] = destinationPosition;
      var distanceUnits = 0;
      for (var positionIndex = 1; positionIndex < positions.length; positionIndex += 1) {
        distanceUnits += Math.hypot(positions[positionIndex].x - positions[positionIndex - 1].x, positions[positionIndex].y - positions[positionIndex - 1].y);
      }
      if (!Number.isFinite(distanceUnits) || distanceUnits <= 0) throw new TypeError('Route materialization points must cover a positive distance');

      var createdJunctions = [];
      function endpointPlan(station, position) {
        var previous = station.placement ? {
          x: station.placement.x,
          y: station.placement.y,
          junctionId: station.placement.junctionId || null
        } : null;
        var junction = previous && previous.junctionId ? Project.findJunction(project, previous.junctionId) : null;
        if (!junction) {
          junction = { id: idFactory('junction'), x: position.x, y: position.y };
          createdJunctions.push(junction);
        }
        return {
          station: station,
          previous: previous,
          next: { x: junction.x, y: junction.y, junctionId: junction.id },
          junction: junction
        };
      }

      var originPlan = endpointPlan(origin, positions[0]);
      var destinationPlan = endpointPlan(destination, positions[positions.length - 1]);
      positions[0] = { x: originPlan.junction.x, y: originPlan.junction.y };
      positions[positions.length - 1] = { x: destinationPlan.junction.x, y: destinationPlan.junction.y };
      var path = {
        id: idFactory('path'),
        points: positions.map(function (position, index) {
          return {
            id: idFactory('point'),
            x: position.x,
            y: position.y,
            in: null,
            out: null,
            junctionId: index === 0 ? originPlan.junction.id : index === positions.length - 1 ? destinationPlan.junction.id : null
          };
        })
      };
      var line = existingLine || {
        id: idFactory('line'),
        name: newLineName,
        style: { color: '#1f8ca8', width: 8, dash: [] },
        paths: []
      };
      var edge = {
        id: idFactory('edge'),
        fromStationId: origin.id,
        toStationId: destination.id,
        lineId: line.id,
        distanceUnits: distanceUnits,
        travelMinutes: input.travelMinutes,
        bidirectional: Boolean(input.bidirectional),
        geometryRef: {
          pathId: path.id,
          fromPointId: path.points[0].id,
          toPointId: path.points[path.points.length - 1].id
        }
      };
      var lineIndex = project.lines.length;
      var pathIndex = line.paths.length;
      var edgeIndex = project.network.edges.length;

      command('materialize-route', function () {
        createdJunctions.forEach(function (junction) {
          if (!project.junctions.includes(junction)) project.junctions.push(junction);
        });
        originPlan.station.placement = Object.assign({}, originPlan.next);
        destinationPlan.station.placement = Object.assign({}, destinationPlan.next);
        if (existingLine) {
          if (!line.paths.includes(path)) line.paths.splice(pathIndex, 0, path);
        } else if (!project.lines.includes(line)) {
          line.paths.splice(0, line.paths.length, path);
          project.lines.splice(lineIndex, 0, line);
        }
        if (!project.network.edges.includes(edge)) project.network.edges.splice(edgeIndex, 0, edge);
      }, function () {
        var currentEdgeIndex = project.network.edges.indexOf(edge);
        if (currentEdgeIndex >= 0) project.network.edges.splice(currentEdgeIndex, 1);
        if (existingLine) {
          var currentPathIndex = line.paths.indexOf(path);
          if (currentPathIndex >= 0) line.paths.splice(currentPathIndex, 1);
        } else {
          var currentLineIndex = project.lines.indexOf(line);
          if (currentLineIndex >= 0) project.lines.splice(currentLineIndex, 1);
        }
        originPlan.station.placement = originPlan.previous ? Object.assign({}, originPlan.previous) : null;
        destinationPlan.station.placement = destinationPlan.previous ? Object.assign({}, destinationPlan.previous) : null;
        createdJunctions.forEach(function (junction) {
          var junctionIndex = project.junctions.indexOf(junction);
          if (junctionIndex >= 0) project.junctions.splice(junctionIndex, 1);
        });
      });
      selection = { type: 'line', id: line.id };
      return { request: request, line: line, path: path, edge: edge };
    }

    function setSelectionTrack(input) {
      if (!selection || !['line', 'station', 'text'].includes(selection.type)) {
        throw new Error('Timeline track requires an editable object selection');
      }
      if (!input || !Number.isFinite(input.startMs) || input.startMs < 0 || !Number.isFinite(input.durationMs) || input.durationMs < 1 ||
        !['linear', 'ease-in', 'ease-out', 'ease-in-out'].includes(input.easing) || !['draw', 'fade', 'pulse'].includes(input.effect)) {
        throw new Error('Timeline track settings are invalid');
      }
      var tracks = project.timeline.tracks;
      var index = tracks.findIndex(function (track) { return track.targetType === selection.type && track.targetId === selection.id; });
      var next = {
        id: index >= 0 ? tracks[index].id : idFactory('track'),
        targetType: selection.type,
        targetId: selection.id,
        startMs: input.startMs,
        durationMs: input.durationMs,
        easing: input.easing,
        effect: input.effect
      };
      if (index < 0) {
        command('create-track', function () { tracks.push(next); }, function () { tracks.splice(tracks.indexOf(next), 1); });
      } else {
        var previous = Object.assign({}, tracks[index]);
        command('update-track', function () { tracks.splice(index, 1, next); }, function () { tracks.splice(index, 1, previous); });
      }
      return next;
    }

    function setRouteTrack(fromStationId, toStationId, input) {
      var tracks = project.timeline.tracks;
      var index = tracks.findIndex(function (track) {
        return track.targetType === 'route' && track.route && track.route.fromStationId === fromStationId && track.route.toStationId === toStationId;
      });
      var next = RouteAnimation.createTrack(project, fromStationId, toStationId, Object.assign({}, input || {}, {
        idFactory: function (prefix) { return index >= 0 ? tracks[index].id : idFactory(prefix); }
      }));
      if (index < 0) {
        var insertionIndex = tracks.length;
        command('create-route-track', function () { tracks.splice(insertionIndex, 0, next); }, function () { tracks.splice(tracks.indexOf(next), 1); });
      } else {
        var previous = Project.cloneProject(tracks[index]);
        command('update-route-track', function () { tracks.splice(index, 1, next); }, function () { tracks.splice(index, 1, previous); });
      }
      return next;
    }

    function removeRouteTrack(trackId) {
      var tracks = project.timeline.tracks;
      var index = tracks.findIndex(function (track) { return track.id === trackId && track.targetType === 'route'; });
      if (index < 0) return false;
      var track = tracks[index];
      command('remove-route-track', function () { tracks.splice(index, 1); }, function () { tracks.splice(index, 0, track); });
      return true;
    }

    function moveSelection(next) {
      if (!selection || !['station', 'text'].includes(selection.type) || !next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) {
        throw new Error('A movable selection and finite coordinates are required');
      }
      var collection = selection.type === 'station' ? project.stations : project.texts;
      var target = collection.find(function (entry) { return entry.id === selection.id; });
      if (!target) throw new Error('A movable selection is required');
      if (selection.type === 'station' && !Project.isStationPlaced(target)) throw new Error('A placed station is required');
      if (selection.type === 'station' && target.placement.junctionId) {
        var junction = Project.findJunction(project, target.placement.junctionId);
        if (!junction) throw new Error('Station junction does not exist');
        var junctionPrevious = { x: junction.x, y: junction.y };
        command('move-junction', function () { Project.syncJunction(project, junction.id, next); }, function () { Project.syncJunction(project, junction.id, junctionPrevious); });
        return target;
      }
      var coordinateTarget = selection.type === 'station' ? target.placement : target;
      var previous = { x: coordinateTarget.x, y: coordinateTarget.y };
      command('move-object', function () { coordinateTarget.x = next.x; coordinateTarget.y = next.y; }, function () { coordinateTarget.x = previous.x; coordinateTarget.y = previous.y; });
      return target;
    }

    return {
      setTool: setTool,
      getTool: function () { return tool; },
      setLineMode: setLineMode,
      getLineMode: function () { return lineMode; },
      addLinePoint: addLinePoint,
      updateLinePreview: updateLinePreview,
      removeLastLinePoint: removeLastLinePoint,
      finishLine: finishLine,
      pointerDown: pointerDown,
      pointerMove: pointerMove,
      pointerUp: pointerUp,
      cancelGesture: cancelGesture,
      getPreview: getPreview,
      movePoint: movePoint,
      upgradeEndpointToStation: upgradeEndpointToStation,
      setControlHandle: setControlHandle,
      createText: createText,
      select: select,
      getSelection: getSelection,
      deleteSelection: deleteSelection,
      updateSelection: updateSelection,
      createEdge: createEdge,
      deleteEdge: deleteEdge,
      materializeRouteRequest: materializeRouteRequest,
      setSelectionTrack: setSelectionTrack,
      setRouteTrack: setRouteTrack,
      removeRouteTrack: removeRouteTrack,
      moveSelection: moveSelection
    };
  }

  function buildScene(project, selection, diagnostics) {
    var lines = [];
    var handles = [];
    var anchors = [];
    project.lines.forEach(function (line) {
      line.paths.forEach(function (path) {
        var positionedPoints = path.points.map(function (point) {
          var position = Project.pointPosition(project, point);
          return Object.assign({}, point, position);
        });
        lines.push({ id: line.id, pathId: path.id, name: line.name, d: Geometry.pathToSvgD(positionedPoints), style: line.style });
        path.points.forEach(function (point) {
          var position = Project.pointPosition(project, point);
          anchors.push({ id: point.id, lineId: line.id, pathId: path.id, x: position.x, y: position.y, junctionId: point.junctionId, selected: Boolean(selection && selection.type === 'point' && selection.id === point.id) });
          if (selection && selection.type === 'point' && selection.id === point.id) {
            handles.push({ id: point.id, x: position.x, y: position.y, in: point.in, out: point.out });
          }
        });
      });
    });
    return {
      lines: lines,
      stations: project.stations.filter(Project.isStationPlaced).map(function (station) {
        return Object.assign({}, station, Project.stationPosition(project, station), { junctionId: station.placement.junctionId });
      }),
      texts: project.texts.map(function (textValue) { return textValue; }),
      anchors: anchors,
      handles: handles,
      diagnostics: (diagnostics || []).map(function (entry) { return Object.assign({}, entry); })
    };
  }

  function svgElement(documentValue, name, attributes) {
    var element = documentValue.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, attributes[key]); });
    return element;
  }

  function renderSvg(svg, scene) {
    if (!svg || !svg.ownerDocument) throw new TypeError('SVG root is invalid');
    var documentValue = svg.ownerDocument;
    var layers = {
      lines: svg.querySelector('#line-layer'),
      routeAnimation: svg.querySelector('#route-animation-layer'),
      animationDefs: svg.querySelector('#animation-defs'),
      stations: svg.querySelector('#station-layer'),
      texts: svg.querySelector('#text-layer'),
      interaction: svg.querySelector('#interaction-layer')
    };
    Object.keys(layers).forEach(function (key) { if (layers[key]) layers[key].replaceChildren(); });
    scene.lines.forEach(function (line) {
      var path = svgElement(documentValue, 'path', {
        d: line.d, fill: 'none', stroke: line.style.color, 'stroke-width': line.style.width,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-type': 'line', 'data-id': line.id,
        'data-path-id': line.pathId,
        tabindex: '0', role: 'button', 'aria-label': line.name
      });
      if (line.style.dash && line.style.dash.length) path.setAttribute('stroke-dasharray', line.style.dash.join(' '));
      layers.lines.appendChild(path);
    });
    scene.stations.forEach(function (station) {
      var group = svgElement(documentValue, 'g', { 'data-type': 'station', 'data-id': station.id, 'data-junction-id': station.junctionId || '', tabindex: '0', role: 'button', 'aria-label': station.name });
      group.appendChild(svgElement(documentValue, 'circle', { cx: station.x, cy: station.y, r: station.style.radius, fill: station.style.color, stroke: '#102a36', 'stroke-width': 2 }));
      var label = svgElement(documentValue, 'text', { x: station.x, y: station.y + station.style.radius + 18, 'text-anchor': 'middle' });
      label.textContent = station.name;
      group.appendChild(label);
      layers.stations.appendChild(group);
    });
    scene.texts.forEach(function (textValue) {
      var element = svgElement(documentValue, 'text', {
        x: textValue.x, y: textValue.y, fill: textValue.style.color, 'font-size': textValue.style.size,
        'font-weight': textValue.style.weight, 'text-anchor': textValue.style.align,
        'data-type': 'text', 'data-id': textValue.id, tabindex: '0', role: 'button'
      });
      element.textContent = textValue.text;
      layers.texts.appendChild(element);
    });
    scene.handles.forEach(function (handle) {
      ['in', 'out'].forEach(function (name) {
        if (!handle[name]) return;
        layers.interaction.appendChild(svgElement(documentValue, 'line', { x1: handle.x, y1: handle.y, x2: handle[name].x, y2: handle[name].y, class: 'control-line' }));
        layers.interaction.appendChild(svgElement(documentValue, 'circle', { cx: handle[name].x, cy: handle[name].y, r: 6, class: 'control-handle', 'data-handle': name, 'data-point-id': handle.id }));
      });
    });
    scene.anchors.forEach(function (anchor) {
      layers.interaction.appendChild(svgElement(documentValue, 'circle', {
        cx: anchor.x, cy: anchor.y, r: anchor.selected ? 7 : 5,
        class: 'anchor-point' + (anchor.junctionId ? ' is-junction' : '') + (anchor.selected ? ' is-selected' : ''),
        'data-type': 'point', 'data-id': anchor.id, 'data-line-id': anchor.lineId, 'data-path-id': anchor.pathId,
        'data-junction-id': anchor.junctionId || '',
        tabindex: '0', role: 'button', 'aria-label': 'Path anchor'
      }));
    });
  }

  function renderRouteAnimation(svg, project, positionMs) {
    if (!svg || !svg.ownerDocument) throw new TypeError('SVG root is invalid');
    var documentValue = svg.ownerDocument;
    var definitions = svg.querySelector('#animation-defs');
    var animationLayer = svg.querySelector('#route-animation-layer');
    if (!definitions || !animationLayer) throw new Error('Route animation SVG layers are missing');
    definitions.replaceChildren();
    animationLayer.replaceChildren();
    var basePaths = Array.from(svg.querySelectorAll('#line-layer [data-path-id]'));
    basePaths.forEach(function (path) { path.removeAttribute('mask'); });

    var errors = [];
    var controlledStations = new Set();
    var visibleStations = new Set();
    var hiddenSegments = new Map();
    var linesById = new Map((project.lines || []).map(function (line) { return [line.id, line]; }));
    var routeTracks = ((project.timeline && project.timeline.tracks) || []).filter(function (track) { return track.targetType === 'route'; });

    routeTracks.forEach(function (track) {
      try {
        var resolved = RouteAnimation.resolve(project, track);
        var state = RouteAnimation.frame(resolved, track, positionMs);
        resolved.stations.forEach(function (station) { controlledStations.add(station.stationId); });
        state.visibleStationIds.forEach(function (stationId) { visibleStations.add(stationId); });
        if (!track.showBaseRoute) {
          resolved.segments.forEach(function (segment) {
            if (!hiddenSegments.has(segment.pathId)) hiddenSegments.set(segment.pathId, []);
            hiddenSegments.get(segment.pathId).push(segment);
          });
        }
        state.segments.forEach(function (segment) {
          animationLayer.appendChild(svgElement(documentValue, 'path', {
            d: segment.d,
            fill: 'none',
            stroke: track.overlayStyle.color,
            'stroke-width': track.overlayStyle.width,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            pathLength: 1,
            'stroke-dasharray': 1,
            'stroke-dashoffset': Number((1 - segment.progress).toFixed(6)),
            opacity: segment.progress > 0 ? 1 : 0,
            'data-route-track-id': track.id,
            'data-edge-id': segment.edgeId,
            'data-path-id': segment.pathId
          }));
        });
      } catch (error) {
        errors.push({ trackId: track.id, code: error.code || 'INVALID_ROUTE_ANIMATION', message: error.message });
      }
    });

    hiddenSegments.forEach(function (segments, pathId) {
      var basePath = basePaths.find(function (path) { return path.getAttribute('data-path-id') === pathId; });
      if (!basePath) return;
      var maskId = 'route-mask-' + definitions.children.length;
      var mask = svgElement(documentValue, 'mask', { id: maskId, maskUnits: 'userSpaceOnUse' });
      mask.appendChild(svgElement(documentValue, 'rect', { x: -1000000, y: -1000000, width: 2000000, height: 2000000, fill: '#ffffff' }));
      segments.forEach(function (segment) {
        var line = linesById.get(segment.lineId);
        mask.appendChild(svgElement(documentValue, 'path', {
          d: segment.d,
          fill: 'none',
          stroke: '#000000',
          'stroke-width': (line && line.style && line.style.width || 8) + 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }));
      });
      definitions.appendChild(mask);
      basePath.setAttribute('mask', 'url(#' + maskId + ')');
    });

    Array.from(svg.querySelectorAll('#station-layer [data-type="station"]')).forEach(function (station) {
      var stationId = station.getAttribute('data-id');
      if (controlledStations.has(stationId)) station.style.opacity = visibleStations.has(stationId) ? '1' : '0';
    });
    return { errors: errors };
  }

  var api = { createEditor: createEditor, buildScene: buildScene, renderSvg: renderSvg, renderRouteAnimation: renderRouteAnimation };
  global.RailwayEditor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
