(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SignatureBoardCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LIMITS = Object.freeze({
    protocolVersion: 1,
    messageType: "signature-board.v1",
    canvasSize: 4096,
    canvasWidth: 4096,
    canvasHeight: 2304,
    legacyCanvasSize: 4096,
    maxBounds: 1024,
    maxPoints: 2000,
    maxBytes: 256 * 1024,
    cooldownMs: 30 * 1000,
    occupancyGrid: 64,
    occupancyWarning: 0.8,
    maxSignature: 48,
    maxStrokeWidth: 48
  });

  var SHARED_KEYS = Object.freeze({
    active: "signature-board.active.v1",
    blocklist: "signature-board.blocklist.v1",
    guestSnapshot: "signature-board.guest-snapshot.v1",
    archiveSnapshotPrefix: "signature-board.archive-snapshot.v1."
  });

  var KINDS = Object.freeze({
    drawing: "drawing.submit",
    report: "moderation.report",
    resolveReport: "moderator.resolve-report",
    hide: "moderator.hide",
    restore: "moderator.restore",
    snapshot: "board.snapshot",
    archive: "board.archive"
  });

  var REPORT_REASONS = Object.freeze(["spam", "abuse", "privacy", "other"]);

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeActor(value) {
    if (!value) return "";
    if (typeof value === "object") {
      value = value.actor_url || value.actorUrl || value.actor || value.actor_id || value.actorId || value.id || "";
    }
    return String(value).trim().replace(/\/$/, "").toLowerCase();
  }

  function sameActor(left, right) {
    return Boolean(normalizeActor(left)) && normalizeActor(left) === normalizeActor(right);
  }

  function actorFrom(value) {
    if (!value || typeof value !== "object") return "";
    return value.sender_actor || value.senderActor || value.actor_url || value.actorUrl || value.actor || "";
  }

  function nicknameFromIdentity(identity) {
    identity = identity || {};
    var candidate = identity.display_name || identity.displayName || identity.name || identity.username || identity.preferred_username;
    if (candidate) return sanitizeSignature(candidate);
    var actor = identity.actor_url || identity.actor || identity.actor_id || identity.id || "";
    var tail = String(actor).split(/[\/@]/).filter(Boolean).pop();
    return sanitizeSignature(tail || "访客");
  }

  function sanitizeSignature(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, LIMITS.maxSignature);
  }

  function makeNonce(prefix) {
    var random = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      random = Array.prototype.map.call(bytes, function (item) { return item.toString(16).padStart(2, "0"); }).join("");
    } else {
      random = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return String(prefix || "evt") + "-" + random;
  }

  function byteLength(value) {
    var text = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function safeColor(value) {
    return typeof value === "string" && (/^#[0-9a-f]{6}$/i.test(value) || /^var\(--[a-z0-9-]+\)$/i.test(value));
  }

  function normalizePoint(point) {
    if (!Array.isArray(point) || point.length < 2 || !finiteNumber(point[0]) || !finiteNumber(point[1])) return null;
    return [
      Math.round(clamp(point[0], 0, LIMITS.canvasSize) * 10) / 10,
      Math.round(clamp(point[1], 0, LIMITS.canvasSize) * 10) / 10
    ];
  }

  function simplifyPoints(points, minimumDistance) {
    if (!Array.isArray(points) || points.length < 3) return (points || []).map(normalizePoint).filter(Boolean);
    var threshold = Math.max(0.5, Number(minimumDistance) || 1.5);
    var output = [];
    for (var index = 0; index < points.length; index += 1) {
      var point = normalizePoint(points[index]);
      if (!point) continue;
      var previous = output[output.length - 1];
      if (!previous || index === points.length - 1 || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= threshold) {
        output.push(point);
      }
    }
    return output;
  }

  function normalizeStroke(stroke) {
    if (!stroke || typeof stroke !== "object") return null;
    var points = simplifyPoints(stroke.points, 0.5);
    if (points.length < 2) return null;
    return {
      color: safeColor(stroke.color) ? stroke.color : "#2f2938",
      width: Math.round(clamp(Number(stroke.width) || 4, 1, LIMITS.maxStrokeWidth) * 10) / 10,
      points: points
    };
  }

  function drawingBounds(strokes) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    (strokes || []).forEach(function (stroke) {
      (stroke.points || []).forEach(function (point) {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
      });
    });
    if (!Number.isFinite(minX)) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, width: maxX - minX, height: maxY - minY };
  }

  function validateDrawing(payload, options) {
    options = options || {};
    var canvasWidth = Number(options.canvasWidth || payload && payload.canvasWidth) || LIMITS.canvasWidth;
    var canvasHeight = Number(options.canvasHeight || payload && payload.canvasHeight) || LIMITS.canvasHeight;
    var errors = [];
    if (!payload || typeof payload !== "object") return { ok: false, errors: ["payload_missing"] };
    if (payload.v !== LIMITS.protocolVersion) errors.push("version_invalid");
    if (payload.kind !== KINDS.drawing) errors.push("kind_invalid");
    if (!payload.boardId || typeof payload.boardId !== "string") errors.push("board_missing");
    if (!payload.drawingId || typeof payload.drawingId !== "string") errors.push("drawing_id_missing");
    if (!payload.nonce || typeof payload.nonce !== "string") errors.push("nonce_missing");
    if (!sanitizeSignature(payload.signature)) errors.push("signature_missing");
    if (!Array.isArray(payload.strokes) || payload.strokes.length === 0) errors.push("strokes_missing");

    var strokes = [];
    var pointCount = 0;
    (payload.strokes || []).forEach(function (stroke) {
      var normalized = normalizeStroke(stroke);
      if (!normalized) errors.push("stroke_invalid");
      else {
        strokes.push(normalized);
        pointCount += normalized.points.length;
        if (normalized.points.some(function (point) { return point[0] > canvasWidth || point[1] > canvasHeight; })) errors.push("canvas_exceeded");
      }
    });
    if (pointCount > LIMITS.maxPoints) errors.push("points_exceeded");
    var bounds = drawingBounds(strokes);
    if (bounds && (bounds.width > LIMITS.maxBounds || bounds.height > LIMITS.maxBounds)) errors.push("bounds_exceeded");

    var normalizedPayload = {
      v: LIMITS.protocolVersion,
      kind: KINDS.drawing,
      boardId: String(payload.boardId || ""),
      drawingId: String(payload.drawingId || ""),
      nonce: String(payload.nonce || ""),
      signature: sanitizeSignature(payload.signature),
      createdAt: typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString(),
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      strokes: strokes
    };
    if (byteLength(normalizedPayload) > LIMITS.maxBytes) errors.push("bytes_exceeded");
    return { ok: errors.length === 0, errors: errors, payload: normalizedPayload, bounds: bounds, pointCount: pointCount };
  }

  function decodeFederationEnvelope(raw, expectedType) {
    if (!raw || typeof raw !== "object") return null;
    var outer = raw;
    var data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    var message = data.message && typeof data.message === "object" ? data.message : data;
    var content = message.content && typeof message.content === "object" ? message.content : message;
    var messageType = content.message_type || message.message_type || data.message_type || outer.message_type;
    var payload = content.payload !== undefined ? content.payload : (message.payload !== undefined ? message.payload : (data.payload !== undefined ? data.payload : null));
    if (messageType !== (expectedType || LIMITS.messageType) || !payload || typeof payload !== "object") return null;
    return {
      payload: payload,
      sender: normalizeActor(actorFrom(message) || actorFrom(data) || actorFrom(outer)),
      roomId: outer.roomId || outer.room_id || data.roomId || data.room_id || "",
      messageId: message.id || message.message_id || message.messageId || data.id || data.message_id || "",
      createdAt: message.created_at || message.createdAt || message.published || data.created_at || data.createdAt || payload.createdAt || ""
    };
  }

  function eventSort(left, right) {
    var time = String(left.createdAt || left.payload && left.payload.createdAt || "").localeCompare(String(right.createdAt || right.payload && right.payload.createdAt || ""));
    if (time) return time;
    return String(left.messageId || "").localeCompare(String(right.messageId || ""));
  }

  function replayEvents(events, options) {
    options = options || {};
    var boardId = String(options.boardId || "");
    var ownerActor = normalizeActor(options.ownerActor);
    var blocked = new Set((options.blockedActors || []).map(normalizeActor).filter(Boolean));
    var drawings = new Map();
    var nonces = new Set();
    var reports = [];
    var adminEvents = [];

    (events || []).slice().sort(eventSort).forEach(function (record) {
      if (!record || !record.payload) return;
      var payload = record.payload;
      var sender = normalizeActor(record.sender);
      if (boardId && payload.boardId !== boardId) return;
      if (payload.nonce && nonces.has(payload.nonce)) return;

      if (payload.kind === KINDS.drawing) {
        if (!sender) return;
        var checked = validateDrawing(payload, { canvasWidth: options.canvasWidth, canvasHeight: options.canvasHeight });
        if (!checked.ok || drawings.has(checked.payload.drawingId)) return;
        nonces.add(checked.payload.nonce);
        drawings.set(checked.payload.drawingId, {
          id: checked.payload.drawingId,
          author: sender,
          signature: checked.payload.signature,
          createdAt: record.createdAt || checked.payload.createdAt,
          strokes: checked.payload.strokes,
          bounds: checked.bounds,
          blocked: blocked.has(sender),
          hidden: false,
          hiddenReason: ""
        });
        return;
      }

      if (payload.kind === KINDS.report) {
        if (!sender || blocked.has(sender) || REPORT_REASONS.indexOf(payload.reason) < 0 || !drawings.has(payload.targetId)) return;
        if (payload.nonce) nonces.add(payload.nonce);
        reports.push({ id: payload.nonce || record.messageId, targetId: payload.targetId, reason: payload.reason, reporter: sender, createdAt: record.createdAt || payload.createdAt });
        return;
      }

      if (!ownerActor || !sameActor(sender, ownerActor)) return;
      if (payload.nonce) nonces.add(payload.nonce);
      if (payload.kind === KINDS.hide || payload.kind === KINDS.restore) {
        var target = drawings.get(payload.targetId);
        if (!target) return;
        target.hidden = payload.kind === KINDS.hide;
        target.hiddenReason = target.hidden ? String(payload.reason || "moderated") : "";
        adminEvents.push({ kind: payload.kind, targetId: payload.targetId, createdAt: record.createdAt || payload.createdAt });
      } else if (payload.kind === KINDS.resolveReport) {
        var report = reports.find(function (item) { return item.id === payload.reportId; });
        if (!report) return;
        report.resolved = true;
        report.resolution = String(payload.resolution || "reviewed");
        report.resolvedAt = record.createdAt || payload.createdAt;
        adminEvents.push({ kind: payload.kind, reportId: payload.reportId, createdAt: report.resolvedAt });
      } else if (payload.kind === KINDS.snapshot || payload.kind === KINDS.archive) {
        adminEvents.push({ kind: payload.kind, createdAt: record.createdAt || payload.createdAt });
      }
    });

    var audit = Array.from(drawings.values());
    var acceptedEvents = audit.length + reports.length + adminEvents.length;
    return {
      drawings: audit.filter(function (drawing) { return !drawing.hidden && !drawing.blocked; }),
      audit: audit,
      reports: reports,
      adminEvents: adminEvents,
      stats: {
        totalEvents: (events || []).length,
        acceptedEvents: acceptedEvents,
        ignoredEvents: Math.max(0, (events || []).length - acceptedEvents),
        hiddenDrawings: audit.filter(function (drawing) { return drawing.hidden; }).length,
        blockedDrawings: audit.filter(function (drawing) { return drawing.blocked; }).length,
        pendingReports: reports.filter(function (report) { return !report.resolved; }).length
      }
    };
  }

  function occupancy(drawings, dimensions) {
    dimensions = dimensions || {};
    var canvasWidth = Number(dimensions.width || dimensions.canvasWidth) || LIMITS.canvasWidth;
    var canvasHeight = Number(dimensions.height || dimensions.canvasHeight) || LIMITS.canvasHeight;
    var size = LIMITS.occupancyGrid;
    var cells = new Uint8Array(size * size);
    function mark(x, y) {
      var column = clamp(Math.floor(x / canvasWidth * size), 0, size - 1);
      var row = clamp(Math.floor(y / canvasHeight * size), 0, size - 1);
      cells[row * size + column] = 1;
    }
    (drawings || []).forEach(function (drawing) {
      (drawing.strokes || []).forEach(function (stroke) {
        for (var index = 1; index < stroke.points.length; index += 1) {
          var from = stroke.points[index - 1];
          var to = stroke.points[index];
          var steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / (Math.min(canvasWidth, canvasHeight) / size / 2)));
          for (var step = 0; step <= steps; step += 1) {
            var ratio = step / steps;
            mark(from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio);
          }
        }
      });
    });
    var used = cells.reduce(function (sum, item) { return sum + item; }, 0);
    return { used: used, total: cells.length, ratio: used / cells.length, warning: used / cells.length >= LIMITS.occupancyWarning };
  }

  function makeEvent(kind, boardId, extra) {
    return Object.assign({
      v: LIMITS.protocolVersion,
      kind: kind,
      boardId: boardId,
      nonce: makeNonce("evt"),
      createdAt: new Date().toISOString()
    }, extra || {});
  }

  return Object.freeze({
    LIMITS: LIMITS,
    SHARED_KEYS: SHARED_KEYS,
    KINDS: KINDS,
    REPORT_REASONS: REPORT_REASONS,
    normalizeActor: normalizeActor,
    sameActor: sameActor,
    nicknameFromIdentity: nicknameFromIdentity,
    sanitizeSignature: sanitizeSignature,
    makeNonce: makeNonce,
    byteLength: byteLength,
    simplifyPoints: simplifyPoints,
    normalizeStroke: normalizeStroke,
    drawingBounds: drawingBounds,
    validateDrawing: validateDrawing,
    decodeFederationEnvelope: decodeFederationEnvelope,
    replayEvents: replayEvents,
    occupancy: occupancy,
    makeEvent: makeEvent
  });
});
