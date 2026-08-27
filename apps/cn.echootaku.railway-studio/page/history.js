(function (global) {
  'use strict';

  function createHistory(limit) {
    var maximum = Number.isInteger(limit) && limit > 0 ? limit : 100;
    var undoStack = [];
    var redoStack = [];

    function validateCommand(command) {
      if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
        throw new TypeError('History command must provide execute and undo');
      }
    }

    function execute(command) {
      validateCommand(command);
      command.execute();
      undoStack.push(command);
      if (undoStack.length > maximum) undoStack.shift();
      redoStack.length = 0;
      return true;
    }

    function undo() {
      if (undoStack.length === 0) return false;
      var command = undoStack[undoStack.length - 1];
      command.undo();
      undoStack.pop();
      redoStack.push(command);
      return true;
    }

    function redo() {
      if (redoStack.length === 0) return false;
      var command = redoStack[redoStack.length - 1];
      command.execute();
      redoStack.pop();
      undoStack.push(command);
      return true;
    }

    function clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    }

    return {
      execute: execute,
      undo: undo,
      redo: redo,
      clear: clear,
      canUndo: function () { return undoStack.length > 0; },
      canRedo: function () { return redoStack.length > 0; },
      size: function () { return undoStack.length + redoStack.length; }
    };
  }

  var api = { createHistory: createHistory };
  global.RailwayHistory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
