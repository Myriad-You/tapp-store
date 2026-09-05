'use strict';

require('./project.js');
require('./migrations.js');
require('./geometry.js');
require('./history.js');
require('./network.js');
require('./route-animation.js');
require('./route-planner.js');
require('./fares.js');
require('./serialization.js');
require('./storage.js');
require('./editor.js');
require('./files.js');
require('./ticket.js');
require('./animation.js');
require('./app.js');

Tapp.lifecycle.onReady(function () {
  return globalThis.RailwayApp.mount(document.getElementById('railway-studio'), Tapp);
});
