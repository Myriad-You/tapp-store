'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');

const appRoot = path.resolve(__dirname, '..');
const context = vm.createContext({ TextEncoder });
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(appRoot, 'page', 'engine.js'), 'utf8'), context);
const Engine = context.EchoStageEngine;

function demoProgram(locale = 'zh-CN') {
  const source = fs.readFileSync(path.join(appRoot, 'assets', 'demo', `main.${locale}.echo`), 'utf8');
  return Engine.parseScript(source);
}

function starlightProgram(locale = 'zh-CN') {
  const source = fs.readFileSync(path.join(appRoot, 'assets', 'starlight', `main.${locale}.echo`), 'utf8');
  return Engine.parseScript(source);
}

function reachChoice(runtime) {
  for (let i = 0; i < 20; i += 1) {
    const event = runtime.next();
    if (event.type === 'choice') return event;
  }
  throw new Error('demo did not reach a choice');
}

function reachEnd(runtime, firstEvent) {
  let event = firstEvent;
  for (let i = 0; i < 30 && event.type !== 'end'; i += 1) event = runtime.next();
  return event;
}

test('三种语言的内置剧本都能解析', () => {
  for (const locale of ['zh-CN', 'en-US', 'ja-JP']) {
    const shore = demoProgram(locale);
    const starlight = starlightProgram(locale);
    assert.ok(shore.commands.length > 20);
    assert.ok(starlight.commands.length > 20);
    assert.ok(Object.hasOwn(shore.labels, 'ending'));
    assert.ok(Object.hasOwn(starlight.labels, 'rewrite'));
  }
});

test('三个选择分别抵达三个结局', () => {
  const expected = ['余响', '潮汐', '留白'];
  const program = demoProgram();
  expected.forEach((title, index) => {
    const runtime = new Engine.Runtime(program);
    const choice = reachChoice(runtime);
    const ending = reachEnd(runtime, runtime.choose(choice.options[index].target));
    assert.equal(ending.type, 'end');
    assert.equal(ending.title, title);
  });
});

test('第二部剧目的三个选择分别抵达三个结局', () => {
  const expected = ['抵达', '暗星', '新星图'];
  const program = starlightProgram();
  expected.forEach((title, index) => {
    const runtime = new Engine.Runtime(program);
    const choice = reachChoice(runtime);
    const ending = reachEnd(runtime, runtime.choose(choice.options[index].target));
    assert.equal(ending.type, 'end');
    assert.equal(ending.title, title);
  });
});

test('回退一条指令的快照会重放当前选项', () => {
  const program = demoProgram();
  const runtime = new Engine.Runtime(program);
  reachChoice(runtime);
  const snapshot = runtime.snapshot();
  snapshot.index -= 1;
  snapshot.ended = false;
  const restored = new Engine.Runtime(program, snapshot);
  assert.equal(restored.next().type, 'choice');
});

test('拒绝未知命令和未知跳转目标', () => {
  assert.throws(() => Engine.parseScript('@eval alert(1)'), /Unknown command/);
  assert.throws(() => Engine.parseScript('@jump nowhere'), /Unknown label/);
});
