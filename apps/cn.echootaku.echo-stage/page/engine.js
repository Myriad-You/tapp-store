(function (global) {
  'use strict';

  var MAX_SCRIPT_BYTES = 1024 * 1024;
  var COMMANDS = new Set([
    'background', 'speaker', 'say', 'narrate', 'label', 'choice',
    'set', 'if', 'jump', 'music', 'end'
  ]);

  function fail(message, line) {
    var error = new Error(line ? 'Line ' + line + ': ' + message : message);
    error.code = 'ECHO_SCRIPT_INVALID';
    throw error;
  }

  function valueOf(raw) {
    var text = String(raw || '').trim();
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    if (/^-?(?:\d+|\d*\.\d+)$/.test(text)) return Number(text);
    if ((text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    return text;
  }

  function parseChoice(payload, line) {
    var options = payload.split(/\s+\|\s+/).map(function (part) {
      var match = part.match(/^(.+?)\s*=>\s*([a-zA-Z0-9._-]+)$/);
      if (!match) fail('Choice must use "text => label"', line);
      return { text: match[1].trim(), target: match[2] };
    });
    if (options.length < 2 || options.length > 8) fail('Choice needs 2–8 options', line);
    return options;
  }

  function parseScript(source) {
    if (typeof source !== 'string') fail('Script must be text');
    if (new TextEncoder().encode(source).length > MAX_SCRIPT_BYTES) fail('Script exceeds 1 MiB');
    var commands = [];
    var labels = Object.create(null);
    source.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (rawLine, index) {
      var lineNumber = index + 1;
      var line = rawLine.trim();
      if (!line || line.startsWith('#')) return;
      if (!line.startsWith('@')) fail('Every instruction must start with @', lineNumber);
      var space = line.indexOf(' ');
      var name = (space < 0 ? line.slice(1) : line.slice(1, space)).trim();
      var payload = space < 0 ? '' : line.slice(space + 1).trim();
      if (!COMMANDS.has(name)) fail('Unknown command @' + name, lineNumber);
      var command = { type: name, line: lineNumber };
      if (name === 'label') {
        if (!/^[a-zA-Z0-9._-]+$/.test(payload)) fail('Invalid label', lineNumber);
        if (Object.prototype.hasOwnProperty.call(labels, payload)) fail('Duplicate label ' + payload, lineNumber);
        command.name = payload;
        labels[payload] = commands.length;
      } else if (name === 'choice') {
        command.options = parseChoice(payload, lineNumber);
      } else if (name === 'set') {
        var setMatch = payload.match(/^([a-zA-Z][a-zA-Z0-9._-]*)\s*=\s*(.+)$/);
        if (!setMatch) fail('Set must use "name = value"', lineNumber);
        command.key = setMatch[1];
        command.value = valueOf(setMatch[2]);
      } else if (name === 'if') {
        var ifMatch = payload.match(/^([a-zA-Z][a-zA-Z0-9._-]*)\s*(==|!=)\s*(.+?)\s*->\s*([a-zA-Z0-9._-]+)$/);
        if (!ifMatch) fail('If must use "name == value -> label"', lineNumber);
        command.key = ifMatch[1];
        command.operator = ifMatch[2];
        command.value = valueOf(ifMatch[3]);
        command.target = ifMatch[4];
      } else if (name === 'jump') {
        if (!/^[a-zA-Z0-9._-]+$/.test(payload)) fail('Invalid jump label', lineNumber);
        command.target = payload;
      } else if (name === 'end') {
        var divider = payload.indexOf('|');
        command.title = (divider < 0 ? payload : payload.slice(0, divider)).trim();
        command.text = (divider < 0 ? '' : payload.slice(divider + 1)).trim();
        if (!command.title) fail('End title is required', lineNumber);
      } else {
        if (!payload && name !== 'music') fail('@' + name + ' needs a value', lineNumber);
        command.value = payload;
      }
      commands.push(command);
    });
    if (!commands.length) fail('Script is empty');
    commands.forEach(function (command) {
      if ((command.type === 'jump' || command.type === 'if') && !Object.prototype.hasOwnProperty.call(labels, command.target)) {
        fail('Unknown label ' + command.target, command.line);
      }
      if (command.type === 'choice') command.options.forEach(function (option) {
        if (!Object.prototype.hasOwnProperty.call(labels, option.target)) fail('Unknown label ' + option.target, command.line);
      });
    });
    return { commands: commands, labels: labels };
  }

  function Runtime(program, snapshot) {
    if (!program || !Array.isArray(program.commands)) fail('Program is invalid');
    this.program = program;
    this.index = 0;
    this.variables = Object.create(null);
    this.speaker = '';
    this.background = '';
    this.music = '';
    this.ended = false;
    if (snapshot) this.restore(snapshot);
  }

  Runtime.prototype.restore = function (snapshot) {
    var index = Number(snapshot.index);
    if (!Number.isInteger(index) || index < 0 || index > this.program.commands.length) fail('Save index is invalid');
    this.index = index;
    this.variables = Object.assign(Object.create(null), snapshot.variables || {});
    this.speaker = typeof snapshot.speaker === 'string' ? snapshot.speaker : '';
    this.background = typeof snapshot.background === 'string' ? snapshot.background : '';
    this.music = typeof snapshot.music === 'string' ? snapshot.music : '';
    this.ended = Boolean(snapshot.ended);
  };

  Runtime.prototype.snapshot = function () {
    return {
      index: this.index,
      variables: Object.assign({}, this.variables),
      speaker: this.speaker,
      background: this.background,
      music: this.music,
      ended: this.ended
    };
  };

  Runtime.prototype.goto = function (label) {
    this.index = this.program.labels[label];
  };

  Runtime.prototype.choose = function (target) {
    if (!Object.prototype.hasOwnProperty.call(this.program.labels, target)) fail('Unknown choice target ' + target);
    this.goto(target);
    return this.next();
  };

  Runtime.prototype.event = function (type, extra) {
    return Object.assign({
      type: type,
      speaker: this.speaker,
      background: this.background,
      music: this.music
    }, extra || {});
  };

  Runtime.prototype.next = function () {
    if (this.ended) return this.event('end', { title: '', text: '' });
    var guard = 0;
    while (this.index < this.program.commands.length) {
      if (++guard > this.program.commands.length * 3) fail('Execution loop detected');
      var command = this.program.commands[this.index++];
      if (command.type === 'label') continue;
      if (command.type === 'background') { this.background = command.value; continue; }
      if (command.type === 'speaker') { this.speaker = command.value; continue; }
      if (command.type === 'music') { this.music = command.value === 'stop' ? '' : command.value; continue; }
      if (command.type === 'set') { this.variables[command.key] = command.value; continue; }
      if (command.type === 'jump') { this.goto(command.target); continue; }
      if (command.type === 'if') {
        var equal = this.variables[command.key] === command.value;
        if ((command.operator === '==' && equal) || (command.operator === '!=' && !equal)) this.goto(command.target);
        continue;
      }
      if (command.type === 'say') return this.event('say', { text: command.value });
      if (command.type === 'narrate') return this.event('narrate', { text: command.value, speaker: '' });
      if (command.type === 'choice') return this.event('choice', { options: command.options.slice() });
      if (command.type === 'end') {
        this.ended = true;
        return this.event('end', { title: command.title, text: command.text, speaker: '' });
      }
    }
    this.ended = true;
    return this.event('end', { title: 'End', text: '', speaker: '' });
  };

  global.EchoStageEngine = Object.freeze({
    parseScript: parseScript,
    Runtime: Runtime,
    limits: Object.freeze({ scriptBytes: MAX_SCRIPT_BYTES })
  });
})(globalThis);
