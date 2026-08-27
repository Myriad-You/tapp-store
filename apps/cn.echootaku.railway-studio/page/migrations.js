(function (global) {
  'use strict';

  var Project = global.RailwayProject;
  if (!Project && typeof require === 'function') Project = require('./project.js');

  var ROOT_FIELDS = new Set([
    'schema', 'version', 'meta', 'canvas', 'settings', 'assets', 'lines',
    'junctions', 'stations', 'network', 'texts', 'timeline', 'extensions'
  ]);

  function reject(message, code) {
    var error = new Error(message);
    error.name = 'ProjectMigrationError';
    error.code = code;
    throw error;
  }

  function moveUnknownRootFields(project) {
    var extensions = project.extensions && typeof project.extensions === 'object' && !Array.isArray(project.extensions)
      ? project.extensions
      : {};
    Object.keys(project).forEach(function (key) {
      if (ROOT_FIELDS.has(key)) return;
      extensions[key] = project[key];
      delete project[key];
    });
    project.extensions = extensions;
  }

  function migrateDraftToV1(project) {
    project.version = 1;
    moveUnknownRootFields(project);
    return project;
  }

  function migrateV1ToV2(project) {
    project.version = 2;
    project.junctions = [];
    (project.lines || []).forEach(function (line) {
      (line.paths || []).forEach(function (path) {
        (path.points || []).forEach(function (point) { point.junctionId = null; });
      });
    });
    (project.stations || []).forEach(function (station) { station.junctionId = null; });
    return project;
  }

  function migrateV2ToV3(project) {
    project.version = 3;
    (project.stations || []).forEach(function (station) {
      if (typeof station.placement === 'undefined') {
        station.placement = {
          x: station.x,
          y: station.y,
          junctionId: typeof station.junctionId === 'string' ? station.junctionId : null
        };
      }
      delete station.x;
      delete station.y;
      delete station.junctionId;
    });
    if (!project.network || typeof project.network !== 'object' || Array.isArray(project.network)) project.network = {};
    if (!Array.isArray(project.network.routeRequests)) project.network.routeRequests = [];
    return project;
  }

  function migrateV3ToV4(project) {
    project.version = 4;
    return project;
  }

  function importProject(candidate) {
    var project = Project.cloneProject(candidate);
    if (project.schema !== Project.SCHEMA) reject('Unsupported project schema', 'SCHEMA');
    if (typeof project.version === 'number' && project.version > Project.VERSION) {
      reject('Newer project version is not supported', 'FUTURE_VERSION');
    }
    if (typeof project.version === 'undefined' || project.version === 0) {
      project = migrateDraftToV1(project);
    }
    if (project.version === 1) project = migrateV1ToV2(project);
    if (project.version === 2) project = migrateV2ToV3(project);
    if (project.version === 3) project = migrateV3ToV4(project);
    if (project.version !== Project.VERSION) reject('Unsupported project version', 'VERSION');
    moveUnknownRootFields(project);
    return Project.normalizeProject(project);
  }

  var api = {
    importProject: importProject
  };

  global.RailwayMigrations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
