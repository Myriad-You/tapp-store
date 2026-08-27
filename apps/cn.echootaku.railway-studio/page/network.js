(function (global) {
  'use strict';

  function routeError(message, code) {
    var error = new Error(message);
    error.name = 'RailwayRouteError';
    error.code = code;
    return error;
  }

  function buildGraph(project) {
    var stations = new Map();
    var lines = new Map();
    var adjacency = new Map();
    (project.stations || []).forEach(function (station) {
      stations.set(station.id, station);
      adjacency.set(station.id, []);
    });
    (project.lines || []).forEach(function (line) { lines.set(line.id, line); });
    ((project.network && project.network.edges) || []).forEach(function (edge) {
      if (!stations.has(edge.fromStationId) || !stations.has(edge.toStationId) || !lines.has(edge.lineId)) {
        throw routeError('Network contains a dangling edge', 'INVALID_NETWORK');
      }
      if (!Number.isFinite(edge.travelMinutes) || edge.travelMinutes <= 0 || !Number.isFinite(edge.distanceUnits) || edge.distanceUnits <= 0) {
        throw routeError('Network contains invalid edge metrics', 'INVALID_NETWORK');
      }
      adjacency.get(edge.fromStationId).push({
        edgeId: edge.id,
        fromStationId: edge.fromStationId,
        toStationId: edge.toStationId,
        lineId: edge.lineId,
        travelMinutes: edge.travelMinutes,
        distanceUnits: edge.distanceUnits
      });
      if (edge.bidirectional) {
        adjacency.get(edge.toStationId).push({
          edgeId: edge.id,
          fromStationId: edge.toStationId,
          toStationId: edge.fromStationId,
          lineId: edge.lineId,
          travelMinutes: edge.travelMinutes,
          distanceUnits: edge.distanceUnits
        });
      }
    });
    adjacency.forEach(function (entries) {
      entries.sort(function (left, right) { return left.edgeId.localeCompare(right.edgeId); });
    });
    return { stations: stations, lines: lines, adjacency: adjacency };
  }

  function compareCost(left, right) {
    if (left.minutes !== right.minutes) return left.minutes - right.minutes;
    if (left.transfers !== right.transfers) return left.transfers - right.transfers;
    if (left.distance !== right.distance) return left.distance - right.distance;
    return left.signature.localeCompare(right.signature);
  }

  function groupLegs(segments) {
    var legs = [];
    segments.forEach(function (segment) {
      var current = legs[legs.length - 1];
      if (!current || current.lineId !== segment.lineId) {
        current = {
          lineId: segment.lineId,
          fromStationId: segment.fromStationId,
          toStationId: segment.toStationId,
          stationIds: [segment.fromStationId, segment.toStationId],
          edgeIds: [segment.edgeId],
          travelMinutes: segment.travelMinutes,
          distanceUnits: segment.distanceUnits
        };
        legs.push(current);
      } else {
        current.toStationId = segment.toStationId;
        current.stationIds.push(segment.toStationId);
        current.edgeIds.push(segment.edgeId);
        current.travelMinutes += segment.travelMinutes;
        current.distanceUnits += segment.distanceUnits;
      }
    });
    return legs;
  }

  function findRoute(project, fromStationId, toStationId) {
    var graph = buildGraph(project);
    if (!graph.stations.has(fromStationId) || !graph.stations.has(toStationId)) {
      throw routeError('Unknown station', 'UNKNOWN_STATION');
    }
    if (fromStationId === toStationId) throw routeError('Origin and destination are the same station', 'SAME_STATION');

    var queue = [{
      stationId: fromStationId,
      lineId: null,
      minutes: 0,
      transfers: 0,
      distance: 0,
      signature: '',
      segments: []
    }];
    var best = new Map();
    best.set(fromStationId + '|', queue[0]);

    while (queue.length > 0) {
      queue.sort(compareCost);
      var current = queue.shift();
      var key = current.stationId + '|' + (current.lineId || '');
      if (best.get(key) !== current) continue;
      if (current.stationId === toStationId) {
        var edgeIds = current.segments.map(function (segment) { return segment.edgeId; });
        var stationIds = [fromStationId].concat(current.segments.map(function (segment) { return segment.toStationId; }));
        return {
          fromStationId: fromStationId,
          toStationId: toStationId,
          totalMinutes: current.minutes,
          totalDistanceUnits: current.distance,
          transferCount: current.transfers,
          edgeIds: edgeIds,
          stationIds: stationIds,
          segments: current.segments.map(function (segment) { return Object.assign({}, segment); }),
          legs: groupLegs(current.segments)
        };
      }

      graph.adjacency.get(current.stationId).forEach(function (segment) {
        var next = {
          stationId: segment.toStationId,
          lineId: segment.lineId,
          minutes: current.minutes + segment.travelMinutes,
          transfers: current.transfers + (current.lineId && current.lineId !== segment.lineId ? 1 : 0),
          distance: current.distance + segment.distanceUnits,
          signature: current.signature + '\u0000' + segment.edgeId,
          segments: current.segments.concat([segment])
        };
        var nextKey = next.stationId + '|' + next.lineId;
        var previous = best.get(nextKey);
        if (!previous || compareCost(next, previous) < 0) {
          best.set(nextKey, next);
          queue.push(next);
        }
      });
    }

    throw routeError('Destination is unreachable', 'UNREACHABLE');
  }

  var api = { buildGraph: buildGraph, findRoute: findRoute };
  global.RailwayNetwork = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
