(function (global) {
  'use strict';

  var Project = global.RailwayProject;
  var Network = global.RailwayNetwork;
  if (typeof require === 'function') {
    if (!Project) Project = require('./project.js');
    if (!Network) Network = require('./network.js');
  }

  function createId(prefix) {
    var bytes = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    }
    return prefix + '-' + Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function stationNameKey(name) {
    return String(name || '').trim().toLocaleLowerCase();
  }

  function createStation(project, name, options) {
    var normalizedName = String(name || '').trim();
    if (!normalizedName || normalizedName.length > 80 || /[\u0000-\u001f\u007f]/.test(normalizedName)) throw new TypeError('Station name is invalid');
    var key = stationNameKey(normalizedName);
    if ((project.stations || []).some(function (station) { return stationNameKey(station.name) === key; })) throw new Error('Station already exists');
    var input = options || {};
    var station = {
      id: (input.idFactory || createId)('station'),
      name: normalizedName,
      placement: null,
      style: { radius: 8, color: '#f5f1e8' }
    };
    project.stations.push(station);
    return station;
  }

  function ensureRequest(project, input, options) {
    var stations = new Set((project.stations || []).map(function (station) { return station.id; }));
    if (!stations.has(input.fromStationId) || !stations.has(input.toStationId)) throw new Error('Route request references an unknown station');
    if (input.fromStationId === input.toStationId) throw new Error('Route request requires different stations');
    var service = String(input.service || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(service)) throw new TypeError('Service code is invalid');
    var preferredLineId = input.preferredLineId || null;
    if (preferredLineId && !(project.lines || []).some(function (line) { return line.id === preferredLineId; })) throw new Error('Route request references an unknown line');
    var existing = project.network.routeRequests.find(function (request) {
      return request.fromStationId === input.fromStationId && request.toStationId === input.toStationId && request.service === service && request.preferredLineId === preferredLineId;
    });
    if (existing) {
      existing.dismissed = false;
      return existing;
    }
    var settings = options || {};
    var request = {
      id: (settings.idFactory || createId)('route-request'),
      fromStationId: input.fromStationId,
      toStationId: input.toStationId,
      service: service,
      preferredLineId: preferredLineId,
      createdAt: settings.now || new Date().toISOString(),
      dismissed: false
    };
    project.network.routeRequests.push(request);
    return request;
  }

  function classifyRequest(project, request) {
    var stations = new Map((project.stations || []).map(function (station) { return [station.id, station]; }));
    var origin = stations.get(request.fromStationId);
    var destination = stations.get(request.toStationId);
    if (!origin || !destination) throw new Error('Route request references an unknown station');
    var missingOrigin = !Project.isStationPlaced(origin);
    var missingDestination = !Project.isStationPlaced(destination);
    if (missingOrigin && missingDestination) return { state: 'missing-both', missingStationIds: [origin.id, destination.id], route: null };
    if (missingOrigin) return { state: 'missing-origin', missingStationIds: [origin.id], route: null };
    if (missingDestination) return { state: 'missing-destination', missingStationIds: [destination.id], route: null };

    var routeProject = project;
    if (request.preferredLineId) {
      routeProject = Object.assign({}, project, {
        network: Object.assign({}, project.network, {
          edges: project.network.edges.filter(function (edge) { return edge.lineId === request.preferredLineId; })
        })
      });
    }
    try {
      return { state: 'ready', missingStationIds: [], route: Network.findRoute(routeProject, origin.id, destination.id) };
    } catch (error) {
      if (error && error.code === 'UNREACHABLE') return { state: 'disconnected', missingStationIds: [], route: null };
      throw error;
    }
  }

  function listPending(project, options) {
    var includeDismissed = Boolean(options && options.includeDismissed);
    return (project.network.routeRequests || []).map(function (request) {
      return { request: request, classification: classifyRequest(project, request) };
    }).filter(function (entry) {
      return entry.classification.state !== 'ready' && (includeDismissed || !entry.request.dismissed);
    });
  }

  var api = {
    createStation: createStation,
    ensureRequest: ensureRequest,
    classifyRequest: classifyRequest,
    listPending: listPending
  };

  global.RailwayRoutePlanner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
