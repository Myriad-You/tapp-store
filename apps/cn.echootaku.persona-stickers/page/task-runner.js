'use strict';

function taskIdOf(value) {
  var current = value;
  for (var depth = 0; depth < 6 && current && typeof current === 'object'; depth += 1) {
    var id = current.taskId || current.task_id || current.id;
    if (id) return String(id);
    current = current.task || current.data || current.value;
  }
  return '';
}

function statusOf(value) {
  return String(value && (value.status || value.state || (value.data && value.data.status)) || '').toLowerCase();
}

function resultOf(value) {
  var current = value;
  for (var depth = 0; depth < 7 && current != null; depth += 1) {
    if (current && typeof current === 'object' && (current.format === 'image' || (current.value && current.value.url) || current.url)) return current;
    if (!current || typeof current !== 'object') return null;
    current = current.result != null ? current.result : current.output != null ? current.output : current.data != null ? current.data : current.value;
  }
  return null;
}

function failureOf(value, fallbackCode) {
  var detail = value && value.error ? value.error : value;
  var message = '';
  var current = detail;
  var code = '';
  for (var depth = 0; depth < 6 && current; depth += 1) {
    if (!code && typeof current.code === 'string') code = current.code;
    if (!message && typeof current.message === 'string') message = current.message;
    current = current.error || current.details || current.data || current.cause;
  }
  var error = new Error(message || fallbackCode || 'AI task failed');
  error.code = String(code || fallbackCode || 'AI_TASK_FAILED').toUpperCase();
  error.taskId = taskIdOf(value);
  error.status = statusOf(value);
  if (value && value.usage) error.usage = value.usage;
  return error;
}

function createTaskRunner(options) {
  options = options || {};
  var tasks = options.tasks;
  var setTimer = options.setTimeout || setTimeout;
  var clearTimer = options.clearTimeout || clearTimeout;
  var timeoutMs = Number(options.timeoutMs) || 315000;
  var pollMs = Number(options.pollMs) || 1600;
  var onState = typeof options.onState === 'function' ? options.onState : function () {};
  var active = null;
  var destroyed = false;
  var paused = false;

  function emit(status, extra) {
    onState(Object.assign({ status: status }, extra || {}));
  }

  function cleanup(run) {
    if (!run) return;
    if (run.timeout) clearTimer(run.timeout);
    if (run.pollTimer) clearTimer(run.pollTimer);
    run.timeout = null;
    run.pollTimer = null;
    if (typeof run.unsubscribe === 'function') {
      try { run.unsubscribe(); } catch (_) {}
      run.unsubscribe = null;
    }
  }

  function settle(run, error, result, status) {
    if (!run || run.settled) return;
    run.settled = true;
    cleanup(run);
    if (active === run) active = null;
    emit(status || (error ? 'error' : 'success'), { error: error || null, result: result || null, taskId: run.taskId || '' });
    if (error) run.reject(error); else run.resolve(result);
  }

  function inspect(run, value) {
    if (!run || run.settled || destroyed) return true;
    var result = resultOf(value);
    if (result) { settle(run, null, result, 'success'); return true; }
    var status = statusOf(value);
    if (['failed', 'error', 'expired'].indexOf(status) >= 0) {
      settle(run, failureOf(value, 'AI_TASK_FAILED'), null, 'error');
      return true;
    }
    if (['cancelled', 'canceled'].indexOf(status) >= 0) {
      settle(run, failureOf(value, 'AI_TASK_CANCELLED'), null, 'cancelled');
      return true;
    }
    return false;
  }

  function schedulePoll(run) {
    if (!run || run.settled || destroyed || paused || run.pollTimer) return;
    run.pollTimer = setTimer(function () {
      run.pollTimer = null;
      if (run.settled || destroyed || paused) return;
      Promise.resolve(tasks.get(run.taskId)).then(function (value) {
        if (!inspect(run, value)) schedulePoll(run);
      }).catch(function (error) { settle(run, failureOf(error, 'AI_TASK_STATUS_ERROR'), null, 'error'); });
    }, pollMs);
  }

  function run(request) {
    if (destroyed) return Promise.reject(failureOf(null, 'AI_TASK_DESTROYED'));
    if (active) return Promise.reject(failureOf(null, 'AI_TASK_BUSY'));
    emit('creating');
    var runState = { taskId: '', settled: false, cancelWhenCreated: false, timeout: null, pollTimer: null, unsubscribe: null, resolve: null, reject: null };
    var promise = new Promise(function (resolve, reject) { runState.resolve = resolve; runState.reject = reject; });
    active = runState;
    Promise.resolve().then(function () { return tasks.create(request); }).then(function (initial) {
      if (runState.cancelWhenCreated) {
        var lateTaskId = taskIdOf(initial);
        if (lateTaskId) {
          try { Promise.resolve(tasks.cancel(lateTaskId)).catch(function () {}); } catch (_) {}
        }
        return;
      }
      if (destroyed) { settle(runState, failureOf(null, 'AI_TASK_DESTROYED'), null, 'destroyed'); return; }
      if (inspect(runState, initial)) return;
      runState.taskId = taskIdOf(initial);
      if (!runState.taskId) { settle(runState, failureOf(initial, 'AI_TASK_ID_MISSING'), null, 'error'); return; }
      emit('waiting', { taskId: runState.taskId });
      runState.timeout = setTimer(function () {
        if (runState.settled) return;
        try { Promise.resolve(tasks.cancel(runState.taskId)).catch(function () {}); } catch (_) {}
        settle(runState, failureOf(null, 'AI_TASK_TIMEOUT'), null, 'timeout');
      }, timeoutMs);
      schedulePoll(runState);
      try {
        Promise.resolve(tasks.subscribe(runState.taskId, function (event) {
          if (!event || runState.settled || destroyed) return;
          if (event.event === 'result') { inspect(runState, event.data); return; }
          if (event.event === 'error') { settle(runState, failureOf(event.data, 'AI_TASK_FAILED'), null, 'error'); return; }
          inspect(runState, event.data);
        })).then(function (unsubscribe) {
          if (runState.settled || destroyed) { if (typeof unsubscribe === 'function') unsubscribe(); return; }
          runState.unsubscribe = unsubscribe;
        }).catch(function () {});
      } catch (_) {}
    }).catch(function (error) { settle(runState, failureOf(error, 'AI_TASK_CREATE_FAILED'), null, 'error'); });
    return promise;
  }

  async function cancel() {
    var runState = active;
    if (!runState || runState.settled) return false;
    runState.cancelWhenCreated = !runState.taskId;
    if (runState.taskId) {
      try { await tasks.cancel(runState.taskId); } catch (_) {}
    }
    settle(runState, failureOf(null, 'AI_TASK_CANCELLED'), null, 'cancelled');
    return true;
  }

  function pause() {
    paused = true;
    if (active && active.pollTimer) { clearTimer(active.pollTimer); active.pollTimer = null; }
  }

  function resume() {
    if (destroyed) return;
    paused = false;
    if (active && active.taskId && !active.settled) schedulePoll(active);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    var runState = active;
    if (!runState || runState.settled) return;
    runState.cancelWhenCreated = !runState.taskId;
    if (runState.taskId) {
      try { Promise.resolve(tasks.cancel(runState.taskId)).catch(function () {}); } catch (_) {}
    }
    settle(runState, failureOf(null, 'AI_TASK_DESTROYED'), null, 'destroyed');
  }

  return { run: run, cancel: cancel, pause: pause, resume: resume, destroy: destroy, isBusy: function () { return Boolean(active); } };
}

module.exports = { createTaskRunner: createTaskRunner, failureOf: failureOf, resultOf: resultOf, statusOf: statusOf, taskIdOf: taskIdOf };
