var daysCore = require('./main.js');

if (!daysCore || typeof daysCore.registerWidgetLayer !== 'function') {
  throw new Error('Days core did not export registerWidgetLayer');
}

daysCore.registerWidgetLayer();
