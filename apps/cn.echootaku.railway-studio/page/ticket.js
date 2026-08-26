(function (global) {
  'use strict';

  var Network = global.RailwayNetwork;
  var Fares = global.RailwayFares;
  if (typeof require === 'function') {
    if (!Network) Network = require('./network.js');
    if (!Fares) Fares = require('./fares.js');
  }

  function pad(value, length) {
    return String(value).padStart(length || 2, '0');
  }

  function parseLocalDateTime(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) throw new TypeError('Departure time is invalid');
    var parts = match.slice(1).map(Number);
    var timestamp = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
    var check = new Date(timestamp);
    if (check.getUTCFullYear() !== parts[0] || check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2] || check.getUTCHours() !== parts[3] || check.getUTCMinutes() !== parts[4]) {
      throw new TypeError('Departure time is invalid');
    }
    return { timestamp: timestamp, year: parts[0], month: parts[1], day: parts[2], hour: parts[3], minute: parts[4] };
  }

  function formatLocal(date) {
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + 'T' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes());
  }

  function randomBytes(source) {
    if (typeof source === 'function') return source();
    var bytes = new Uint8Array(6);
    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') throw new Error('Secure ticket randomness is unavailable');
    global.crypto.getRandomValues(bytes);
    return bytes;
  }

  function ticketId(departure, source) {
    var bytes = randomBytes(source);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 6) throw new TypeError('Ticket random source must return six bytes');
    var date = pad(departure.year, 4) + pad(departure.month) + pad(departure.day);
    var suffix = Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
    return 'RS-' + date + '-' + suffix;
  }

  function createTicket(project, input, now) {
    var nickname = String(input && input.nickname || '').trim();
    var service = String(input && input.service || '').trim().toUpperCase();
    if (!nickname || nickname.length > 32 || /[\u0000-\u001f\u007f]/.test(nickname)) throw new TypeError('Nickname is invalid');
    if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(service)) throw new TypeError('Service code is invalid');
    var departure = parseLocalDateTime(input.departureLocal);
    var route = Network.findRoute(project, input.fromStationId, input.toStationId);
    var fare = Fares.calculateFare(project, route);
    var stations = new Map(project.stations.map(function (station) { return [station.id, station]; }));
    var lines = new Map(project.lines.map(function (line) { return [line.id, line]; }));
    var arrivalDate = new Date(departure.timestamp + route.totalMinutes * 60000);
    var departureDay = Date.UTC(departure.year, departure.month - 1, departure.day);
    var arrivalDay = Date.UTC(arrivalDate.getUTCFullYear(), arrivalDate.getUTCMonth(), arrivalDate.getUTCDate());
    var dayOffset = Math.round((arrivalDay - departureDay) / 86400000);
    var departureDisplay = pad(departure.hour) + ':' + pad(departure.minute);
    var arrivalDisplay = pad(arrivalDate.getUTCHours()) + ':' + pad(arrivalDate.getUTCMinutes()) + (dayOffset > 0 ? ' +' + dayOffset : '');
    var ticketRoute = Object.assign({}, route, {
      legs: route.legs.map(function (leg) {
        return Object.assign({}, leg, { lineName: lines.has(leg.lineId) ? lines.get(leg.lineId).name : leg.lineId });
      })
    });
    return {
      id: ticketId(departure, input.randomBytes),
      issuedAt: (now instanceof Date ? now : new Date()).toISOString(),
      passenger: nickname,
      service: service,
      from: { id: input.fromStationId, name: stations.get(input.fromStationId).name },
      to: { id: input.toStationId, name: stations.get(input.toStationId).name },
      departure: { local: input.departureLocal, display: departureDisplay },
      arrival: { local: formatLocal(arrivalDate), display: arrivalDisplay, dayOffset: dayOffset },
      route: ticketRoute,
      fare: fare
    };
  }

  function escapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function formatMetric(value) {
    if (!Number.isFinite(value)) throw new TypeError('Ticket metric is invalid');
    return String(Math.round(value * 100) / 100);
  }

  function ticketToSvg(ticket) {
    var routeNames = ticket.route.legs.map(function (leg) { return leg.lineName; }).join(' → ');
    var breakdown = ticket.fare.breakdown;
    var explanation = 'base ' + breakdown.baseMinor + ' + distance ' + breakdown.distanceMinor + ' + transfer ' + breakdown.transferMinor + ' + rounding ' + breakdown.roundingMinor;
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 420" width="960" height="420">',
      '<rect width="960" height="420" rx="28" fill="#f5f1e8"/>',
      '<rect x="24" y="24" width="912" height="372" rx="20" fill="none" stroke="#1f8ca8" stroke-width="3"/>',
      '<text x="54" y="72" font-family="sans-serif" font-size="18" font-weight="700" fill="#1f8ca8">RAILWAY STUDIO · ' + escapeXml(ticket.service) + '</text>',
      '<text x="54" y="136" font-family="serif" font-size="38" font-weight="700" fill="#102a36">' + escapeXml(ticket.from.name) + ' → ' + escapeXml(ticket.to.name) + '</text>',
      '<text x="54" y="184" font-family="sans-serif" font-size="20" fill="#53666b">' + escapeXml(ticket.departure.display) + ' — ' + escapeXml(ticket.arrival.display) + ' · ' + escapeXml(routeNames) + '</text>',
      '<line x1="54" y1="220" x2="906" y2="220" stroke="#c6bfae" stroke-dasharray="8 8"/>',
      '<text x="54" y="270" font-family="sans-serif" font-size="16" fill="#53666b">PASSENGER</text>',
      '<text x="54" y="306" font-family="sans-serif" font-size="25" font-weight="700" fill="#102a36">' + escapeXml(ticket.passenger) + '</text>',
      '<text x="420" y="270" font-family="sans-serif" font-size="16" fill="#53666b">ROUTE</text>',
      '<text x="420" y="306" font-family="sans-serif" font-size="18" fill="#102a36">' + formatMetric(ticket.route.totalMinutes) + ' min · ' + formatMetric(ticket.route.totalDistanceUnits) + ' units · ' + ticket.route.transferCount + ' transfer</text>',
      '<text x="54" y="358" font-family="monospace" font-size="14" fill="#53666b">' + escapeXml(ticket.id) + '</text>',
      '<text x="906" y="306" text-anchor="end" font-family="sans-serif" font-size="28" font-weight="800" fill="#102a36">' + ticket.fare.totalMinor + ' ' + escapeXml(ticket.fare.currency) + ' minor units</text>',
      '<text x="906" y="358" text-anchor="end" font-family="monospace" font-size="13" fill="#53666b">' + escapeXml(explanation) + '</text>',
      '</svg>'
    ].join('');
  }

  var api = { createTicket: createTicket, ticketToSvg: ticketToSvg, formatMetric: formatMetric };
  global.RailwayTicket = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
