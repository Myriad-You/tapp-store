(function (root) {
  "use strict";

  var Core = root.SignatureBoardCore;
  var DEFAULT_WIDTH = Core.LIMITS.canvasWidth;
  var DEFAULT_HEIGHT = Core.LIMITS.canvasHeight;

  function safeImage(value) {
    return typeof value === "string" && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value) ? value : "";
  }

  function distanceToSegment(point, start, end) {
    var dx = end[0] - start[0];
    var dy = end[1] - start[1];
    if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    var ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
  }

  function BoardEditor(options) {
    options = options || {};
    this.canvas = options.canvas;
    this.minimap = options.minimap;
    this.context = this.canvas.getContext("2d");
    this.minimapContext = this.minimap && this.minimap.getContext("2d");
    this.drawings = [];
    this.draft = [];
    this.redoStack = [];
    this.tool = "draw";
    this.color = "#2f2938";
    this.width = 6;
    this.boardWidth = Number(options.boardWidth) || DEFAULT_WIDTH;
    this.boardHeight = Number(options.boardHeight) || DEFAULT_HEIGHT;
    this.view = { centerX: this.boardWidth / 2, centerY: this.boardHeight / 2, scale: 0.9 };
    this.historyFraction = 1;
    this.enabled = false;
    this.snapshotImage = null;
    this.pointers = new Map();
    this.gesture = null;
    this.activeStroke = null;
    this.panOrigin = null;
    this.spaceDown = false;
    this.renderFrame = 0;
    this.onChange = options.onChange || function () {};
    this.onViewChange = options.onViewChange || function () {};
    this.onSelect = options.onSelect || function () {};
    this.resizeObserver = new ResizeObserver(this.resize.bind(this));
    this.resizeObserver.observe(this.canvas.parentElement);
    this.bind();
    this.resize();
  }

  BoardEditor.prototype.bind = function () {
    this.canvas.addEventListener("pointerdown", this.pointerDown.bind(this));
    this.canvas.addEventListener("pointermove", this.pointerMove.bind(this));
    this.canvas.addEventListener("pointerup", this.pointerUp.bind(this));
    this.canvas.addEventListener("pointercancel", this.pointerUp.bind(this));
    this.canvas.addEventListener("wheel", this.wheel.bind(this), { passive: false });
    window.addEventListener("keydown", this.keyDown.bind(this));
    window.addEventListener("keyup", this.keyUp.bind(this));
  };

  BoardEditor.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.viewport = { width: rect.width, height: rect.height, ratio: ratio };
    this.render();
  };

  BoardEditor.prototype.setEnabled = function (enabled) {
    this.enabled = Boolean(enabled);
  };

  BoardEditor.prototype.setCanvasSize = function (width, height) {
    this.boardWidth = Math.max(1, Number(width) || DEFAULT_WIDTH);
    this.boardHeight = Math.max(1, Number(height) || DEFAULT_HEIGHT);
    this.view.centerX = this.boardWidth / 2;
    this.view.centerY = this.boardHeight / 2;
    if (this.viewport) this.fitView();
  };

  BoardEditor.prototype.setTool = function (tool) {
    this.tool = ["draw", "erase", "pan"].indexOf(tool) >= 0 ? tool : "draw";
  };

  BoardEditor.prototype.setColor = function (color) {
    this.color = color;
  };

  BoardEditor.prototype.setWidth = function (width) {
    this.width = Math.max(1, Math.min(Core.LIMITS.maxStrokeWidth, Number(width) || 6));
  };

  BoardEditor.prototype.setDrawings = function (drawings) {
    this.drawings = drawings || [];
    this.render();
  };

  BoardEditor.prototype.setHistoryFraction = function (fraction) {
    this.historyFraction = Math.max(0, Math.min(1, Number(fraction) || 0));
    this.render();
  };

  BoardEditor.prototype.setSnapshot = function (dataUrl) {
    var safeUrl = safeImage(dataUrl);
    var self = this;
    if (!safeUrl) {
      this.snapshotImage = null;
      this.render();
      return !dataUrl;
    }
    var image = new Image();
    image.onload = function () { self.snapshotImage = image; self.render(); };
    image.onerror = function () { self.snapshotImage = null; self.render(); };
    image.src = safeUrl;
    return true;
  };

  BoardEditor.prototype.screenToWorld = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    return [
      this.view.centerX + (clientX - rect.left - rect.width / 2) / this.view.scale,
      this.view.centerY + (clientY - rect.top - rect.height / 2) / this.view.scale
    ];
  };

  BoardEditor.prototype.worldToScreen = function (x, y) {
    return [
      this.viewport.width / 2 + (x - this.view.centerX) * this.view.scale,
      this.viewport.height / 2 + (y - this.view.centerY) * this.view.scale
    ];
  };

  BoardEditor.prototype.pointerDown = function (event) {
    if (event.button !== 0 && event.button !== 1) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });

    if (event.pointerType === "touch" && this.pointers.size >= 2) {
      this.cancelActiveStroke();
      this.startGesture();
      return;
    }

    var shouldPan = this.tool === "pan" || this.spaceDown || event.button === 1;
    if (shouldPan) {
      this.panOrigin = { x: event.clientX, y: event.clientY, centerX: this.view.centerX, centerY: this.view.centerY, moved: false };
      return;
    }
    if (!this.enabled) return;
    var point = this.screenToWorld(event.clientX, event.clientY);
    if (point[0] < 0 || point[1] < 0 || point[0] > this.boardWidth || point[1] > this.boardHeight) return;
    if (this.tool === "erase") {
      this.eraseAt(point);
      return;
    }
    this.activeStroke = { color: this.color, width: this.width, points: [point] };
    this.redoStack = [];
  };

  BoardEditor.prototype.pointerMove = function (event) {
    var pointer = this.pointers.get(event.pointerId);
    if (pointer) { pointer.x = event.clientX; pointer.y = event.clientY; }
    if (event.pointerType === "touch" && this.pointers.size >= 2) {
      this.updateGesture();
      return;
    }
    if (this.panOrigin) {
      var dx = event.clientX - this.panOrigin.x;
      var dy = event.clientY - this.panOrigin.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.panOrigin.moved = true;
      this.view.centerX = this.panOrigin.centerX - dx / this.view.scale;
      this.view.centerY = this.panOrigin.centerY - dy / this.view.scale;
      this.constrainView();
      this.render();
      return;
    }
    if (!this.enabled) return;
    var point = this.screenToWorld(event.clientX, event.clientY);
    if (this.tool === "erase" && event.buttons) {
      this.eraseAt(point);
      return;
    }
    if (!this.activeStroke) return;
    this.appendPointerSamples(event);
    this.render();
  };

  BoardEditor.prototype.pointerUp = function (event) {
    var wasPan = this.panOrigin;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.gesture = null;
    if (this.activeStroke) {
      this.appendPointerSamples(event);
      var normalized = Core.normalizeStroke(this.activeStroke);
      if (normalized) this.draft.push(normalized);
      this.activeStroke = null;
      this.emitChange();
    } else if (wasPan && !wasPan.moved && this.tool === "pan") {
      var selected = this.findDrawingAt(this.screenToWorld(event.clientX, event.clientY));
      if (selected) this.onSelect(selected);
    }
    this.panOrigin = null;
    this.render();
  };

  BoardEditor.prototype.appendPointerSamples = function (event) {
    if (!this.activeStroke) return;
    var samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    if (!samples.length) samples = [event];
    var self = this;
    samples.forEach(function (sample) {
      var point = self.screenToWorld(sample.clientX, sample.clientY);
      point[0] = Math.max(0, Math.min(self.boardWidth, point[0]));
      point[1] = Math.max(0, Math.min(self.boardHeight, point[1]));
      var previous = self.activeStroke.points[self.activeStroke.points.length - 1];
      if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 0.6 / self.view.scale) self.activeStroke.points.push(point);
    });
  };

  BoardEditor.prototype.cancelActiveStroke = function () {
    this.activeStroke = null;
    this.render();
  };

  BoardEditor.prototype.startGesture = function () {
    var points = Array.from(this.pointers.values()).slice(0, 2);
    var midpoint = [(points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2];
    this.gesture = {
      distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
      midpoint: midpoint,
      scale: this.view.scale,
      centerX: this.view.centerX,
      centerY: this.view.centerY
    };
  };

  BoardEditor.prototype.updateGesture = function () {
    if (!this.gesture) this.startGesture();
    var points = Array.from(this.pointers.values()).slice(0, 2);
    var midpoint = [(points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2];
    var distance = Math.max(10, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
    var nextScale = Math.max(0.12, Math.min(8, this.gesture.scale * distance / Math.max(10, this.gesture.distance)));
    this.view.scale = nextScale;
    this.view.centerX = this.gesture.centerX - (midpoint[0] - this.gesture.midpoint[0]) / nextScale;
    this.view.centerY = this.gesture.centerY - (midpoint[1] - this.gesture.midpoint[1]) / nextScale;
    this.constrainView();
    this.render();
  };

  BoardEditor.prototype.eraseAt = function (point) {
    var radius = Math.max(12, this.width * 1.8) / this.view.scale;
    for (var strokeIndex = this.draft.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
      var stroke = this.draft[strokeIndex];
      for (var pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
        if (distanceToSegment(point, stroke.points[pointIndex - 1], stroke.points[pointIndex]) <= radius) {
          this.redoStack = [];
          this.draft.splice(strokeIndex, 1);
          this.emitChange();
          this.render();
          return;
        }
      }
    }
  };

  BoardEditor.prototype.undo = function () {
    if (!this.draft.length) return;
    this.redoStack.push(this.draft.pop());
    this.emitChange();
    this.render();
  };

  BoardEditor.prototype.redo = function () {
    if (!this.redoStack.length) return;
    this.draft.push(this.redoStack.pop());
    this.emitChange();
    this.render();
  };

  BoardEditor.prototype.clearDraft = function () {
    this.draft = [];
    this.redoStack = [];
    this.activeStroke = null;
    this.emitChange();
    this.render();
  };

  BoardEditor.prototype.getDraft = function () {
    return this.draft.map(function (stroke) { return { color: stroke.color, width: stroke.width, points: stroke.points.map(function (point) { return point.slice(); }) }; });
  };

  BoardEditor.prototype.getDraftStats = function () {
    return { strokes: this.draft.length, points: this.draft.reduce(function (sum, stroke) { return sum + stroke.points.length; }, 0), bounds: Core.drawingBounds(this.draft) };
  };

  BoardEditor.prototype.emitChange = function () {
    this.onChange(this.getDraftStats());
  };

  BoardEditor.prototype.keyDown = function (event) {
    if (event.target && /input|select|textarea/i.test(event.target.tagName)) return;
    if (event.code === "Space") { this.spaceDown = true; event.preventDefault(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); }
    if (event.key.toLowerCase() === "b") this.setTool("draw");
    if (event.key.toLowerCase() === "e") this.setTool("erase");
    if (event.key.toLowerCase() === "h") this.setTool("pan");
  };

  BoardEditor.prototype.keyUp = function (event) {
    if (event.code === "Space") this.spaceDown = false;
  };

  BoardEditor.prototype.wheel = function (event) {
    event.preventDefault();
    var factor = Math.exp(-event.deltaY * 0.0015);
    this.zoomAt(factor, event.clientX, event.clientY);
  };

  BoardEditor.prototype.zoomAt = function (factor, clientX, clientY) {
    var before = this.screenToWorld(clientX == null ? this.canvas.getBoundingClientRect().left + this.viewport.width / 2 : clientX, clientY == null ? this.canvas.getBoundingClientRect().top + this.viewport.height / 2 : clientY);
    this.view.scale = Math.max(0.12, Math.min(8, this.view.scale * factor));
    var after = this.screenToWorld(clientX == null ? this.canvas.getBoundingClientRect().left + this.viewport.width / 2 : clientX, clientY == null ? this.canvas.getBoundingClientRect().top + this.viewport.height / 2 : clientY);
    this.view.centerX += before[0] - after[0];
    this.view.centerY += before[1] - after[1];
    this.constrainView();
    this.render();
  };

  BoardEditor.prototype.fitView = function () {
    this.view.centerX = this.boardWidth / 2;
    this.view.centerY = this.boardHeight / 2;
    this.view.scale = Math.max(0.12, Math.min(this.viewport.width * 0.9 / this.boardWidth, this.viewport.height * 0.9 / this.boardHeight));
    this.render();
  };

  BoardEditor.prototype.focusDrawing = function (drawing) {
    if (!drawing || !drawing.bounds) return;
    this.view.centerX = (drawing.bounds.minX + drawing.bounds.maxX) / 2;
    this.view.centerY = (drawing.bounds.minY + drawing.bounds.maxY) / 2;
    this.view.scale = Math.max(0.5, Math.min(2.5, Math.min(this.viewport.width, this.viewport.height) / Math.max(180, drawing.bounds.width, drawing.bounds.height) * 0.65));
    this.render();
  };

  BoardEditor.prototype.findBlank = function () {
    var occupied = new Set();
    this.drawings.forEach(function (drawing) {
      if (!drawing.bounds) return;
      var fromX = Math.floor(drawing.bounds.minX / 512);
      var toX = Math.floor(drawing.bounds.maxX / 512);
      var fromY = Math.floor(drawing.bounds.minY / 512);
      var toY = Math.floor(drawing.bounds.maxY / 512);
      for (var y = fromY; y <= toY; y += 1) for (var x = fromX; x <= toX; x += 1) occupied.add(x + ":" + y);
    });
    var candidates = [];
    var columns = Math.ceil(this.boardWidth / 512);
    var rows = Math.ceil(this.boardHeight / 512);
    for (var y = 0; y < rows; y += 1) for (var x = 0; x < columns; x += 1) if (!occupied.has(x + ":" + y)) candidates.push([x, y]);
    var choice = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : [Math.floor(columns / 2), Math.floor(rows / 2)];
    this.view.centerX = Math.min(this.boardWidth, choice[0] * 512 + 256);
    this.view.centerY = Math.min(this.boardHeight, choice[1] * 512 + 256);
    this.view.scale = 1;
    this.render();
  };

  BoardEditor.prototype.constrainView = function () {
    var marginX = this.viewport.width / this.view.scale * 0.42;
    var marginY = this.viewport.height / this.view.scale * 0.42;
    this.view.centerX = Math.max(-marginX, Math.min(this.boardWidth + marginX, this.view.centerX));
    this.view.centerY = Math.max(-marginY, Math.min(this.boardHeight + marginY, this.view.centerY));
  };

  BoardEditor.prototype.findDrawingAt = function (point) {
    var visible = this.drawings.slice(0, Math.ceil(this.drawings.length * this.historyFraction));
    for (var index = visible.length - 1; index >= 0; index -= 1) {
      var drawing = visible[index];
      var bounds = drawing.bounds;
      if (!bounds || point[0] < bounds.minX - 20 || point[0] > bounds.maxX + 20 || point[1] < bounds.minY - 20 || point[1] > bounds.maxY + 20) continue;
      for (var strokeIndex = drawing.strokes.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
        var stroke = drawing.strokes[strokeIndex];
        for (var pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
          if (distanceToSegment(point, stroke.points[pointIndex - 1], stroke.points[pointIndex]) <= Math.max(14 / this.view.scale, stroke.width)) return drawing;
        }
      }
    }
    return null;
  };

  BoardEditor.prototype.strokePath = function (context, stroke, transform) {
    if (!stroke.points.length) return;
    context.beginPath();
    var first = transform(stroke.points[0]);
    context.moveTo(first[0], first[1]);
    if (stroke.points.length === 2) {
      var end = transform(stroke.points[1]);
      context.lineTo(end[0], end[1]);
    } else {
      for (var index = 1; index < stroke.points.length - 1; index += 1) {
        var current = transform(stroke.points[index]);
        var next = transform(stroke.points[index + 1]);
        context.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2);
      }
      var last = transform(stroke.points[stroke.points.length - 1]);
      context.lineTo(last[0], last[1]);
    }
    var color = String(stroke.color || "").toLowerCase();
    context.strokeStyle = color === "#f8fafc" || color === "#ffffff" ? "#332e3b" : stroke.color;
    context.lineWidth = Math.max(.65, stroke.width * (transform.scale || 1));
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };

  BoardEditor.prototype.renderBoardContent = function (context, transform, drawings, includeDraft) {
    var self = this;
    drawings.forEach(function (drawing) {
      drawing.strokes.forEach(function (stroke) { self.strokePath(context, stroke, transform); });
    });
    if (includeDraft) {
      this.draft.forEach(function (stroke) { self.strokePath(context, stroke, transform); });
      if (this.activeStroke) this.strokePath(context, this.activeStroke, transform);
    }
  };

  BoardEditor.prototype.render = function () {
    if (this.renderFrame) return;
    var self = this;
    this.renderFrame = requestAnimationFrame(function () { self.renderFrame = 0; self.renderNow(); });
  };

  BoardEditor.prototype.renderNow = function () {
    if (!this.viewport) return;
    var context = this.context;
    var width = this.viewport.width;
    var height = this.viewport.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#e9e5ed";
    context.fillRect(0, 0, width, height);
    var origin = this.worldToScreen(0, 0);
    var boardPixelWidth = this.boardWidth * this.view.scale;
    var boardPixelHeight = this.boardHeight * this.view.scale;
    context.fillStyle = "#fffefe";
    context.fillRect(origin[0], origin[1], boardPixelWidth, boardPixelHeight);
    if (this.snapshotImage && !this.drawings.length) context.drawImage(this.snapshotImage, origin[0], origin[1], boardPixelWidth, boardPixelHeight);

    var gridStep = this.view.scale >= .45 ? 128 : 512;
    context.beginPath();
    for (var x = 0; x <= this.boardWidth; x += gridStep) {
      var vertical = this.worldToScreen(x, 0);
      context.moveTo(vertical[0], origin[1]); context.lineTo(vertical[0], origin[1] + boardPixelHeight);
    }
    for (var y = 0; y <= this.boardHeight; y += gridStep) {
      var horizontal = this.worldToScreen(0, y);
      context.moveTo(origin[0], horizontal[1]); context.lineTo(origin[0] + boardPixelWidth, horizontal[1]);
    }
    context.strokeStyle = "rgba(47,41,56,.07)";
    context.lineWidth = 1;
    context.stroke();

    var self = this;
    var transform = function (point) { return self.worldToScreen(point[0], point[1]); };
    transform.scale = this.view.scale;
    var visible = this.drawings.slice(0, Math.ceil(this.drawings.length * this.historyFraction));
    this.renderBoardContent(context, transform, visible, true);
    context.strokeStyle = "rgba(47,41,56,.18)";
    context.lineWidth = 1;
    context.strokeRect(origin[0], origin[1], boardPixelWidth, boardPixelHeight);
    this.renderMinimap(visible);
    this.onViewChange(this.view);
  };

  BoardEditor.prototype.renderMinimap = function (drawings) {
    if (!this.minimapContext) return;
    var context = this.minimapContext;
    var width = this.minimap.width;
    var height = this.minimap.height;
    var scale = Math.min((width - 8) / this.boardWidth, (height - 8) / this.boardHeight);
    var boardPixelWidth = this.boardWidth * scale;
    var boardPixelHeight = this.boardHeight * scale;
    var offsetX = (width - boardPixelWidth) / 2;
    var offsetY = (height - boardPixelHeight) / 2;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(242,239,245,.98)"; context.fillRect(0, 0, width, height);
    context.fillStyle = "#fffefe"; context.fillRect(offsetX, offsetY, boardPixelWidth, boardPixelHeight);
    var transform = function (point) { return [offsetX + point[0] * scale, offsetY + point[1] * scale]; };
    transform.scale = scale;
    this.renderBoardContent(context, transform, drawings, true);
    var visibleWidth = this.viewport.width / this.view.scale * scale;
    var visibleHeight = this.viewport.height / this.view.scale * scale;
    var centerX = offsetX + this.view.centerX * scale;
    var centerY = offsetY + this.view.centerY * scale;
    context.strokeStyle = "rgba(124,95,196,.9)";
    context.lineWidth = 1;
    context.strokeRect(centerX - visibleWidth / 2, centerY - visibleHeight / 2, visibleWidth, visibleHeight);
  };

  BoardEditor.prototype.createSnapshot = function () {
    var canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.max(1, Math.round(1024 * this.boardHeight / this.boardWidth));
    var context = canvas.getContext("2d");
    context.fillStyle = "#fffefe";
    context.fillRect(0, 0, canvas.width, canvas.height);
    var exportScale = canvas.width / this.boardWidth;
    var transform = function (point) { return [point[0] * exportScale, point[1] * exportScale]; };
    transform.scale = exportScale;
    this.renderBoardContent(context, transform, this.drawings, false);
    return canvas.toDataURL("image/jpeg", .76);
  };

  BoardEditor.safeImage = safeImage;
  root.SignatureBoardEditor = BoardEditor;
})(globalThis);
