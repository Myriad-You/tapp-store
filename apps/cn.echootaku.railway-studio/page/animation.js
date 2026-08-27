(function (global) {
  'use strict';

  function createTimeline(clock, scheduler, options) {
    var settings = Object.assign({ durationMs: 6000, onFrame: function () {} }, options || {});
    var duration = settings.durationMs;
    var position = 0;
    var startedAt = 0;
    var frameId = null;
    var playing = false;
    var paused = false;
    var enabled = true;
    var level = 'standard';
    var destroyed = false;

    function allowed() {
      return enabled && level !== 'none';
    }

    function emit() {
      settings.onFrame(duration === 0 ? 1 : position / duration, position, duration);
    }

    function cancelFrame() {
      if (frameId !== null) scheduler.cancel(frameId);
      frameId = null;
    }

    function schedule() {
      if (!playing || destroyed || frameId !== null) return;
      frameId = scheduler.request(tick);
    }

    function tick() {
      frameId = null;
      if (!playing || destroyed) return;
      position = Math.min(duration, Math.max(0, clock() - startedAt));
      emit();
      if (position >= duration) {
        playing = false;
        paused = false;
      } else {
        schedule();
      }
    }

    function completeStatic() {
      cancelFrame();
      position = duration;
      playing = false;
      paused = false;
      if (!destroyed) emit();
    }

    function play() {
      if (destroyed) return false;
      if (!allowed()) {
        completeStatic();
        return false;
      }
      if (position >= duration) position = 0;
      startedAt = clock() - position;
      playing = true;
      paused = false;
      schedule();
      return true;
    }

    function pause() {
      if (destroyed) return;
      var shouldResume = playing;
      cancelFrame();
      playing = false;
      paused = shouldResume || paused;
    }

    function resume() {
      if (destroyed || !paused) return false;
      if (!allowed()) {
        completeStatic();
        return false;
      }
      startedAt = clock() - position;
      playing = true;
      paused = false;
      schedule();
      return true;
    }

    function stop() {
      if (destroyed) return;
      cancelFrame();
      playing = false;
      paused = false;
      position = 0;
      emit();
    }

    function seek(next) {
      if (destroyed) return;
      position = Math.min(duration, Math.max(0, Number(next) || 0));
      if (playing) startedAt = clock() - position;
      emit();
    }

    function setEnabled(next) {
      enabled = Boolean(next);
      if (!allowed() && playing) completeStatic();
    }

    function setLevel(next) {
      level = ['none', 'light', 'standard'].includes(next) ? next : 'standard';
      if (!allowed() && (playing || position < duration)) completeStatic();
    }

    function setDuration(next) {
      if (!Number.isFinite(next) || next < 100 || next > 3600000) throw new RangeError('Timeline duration is invalid');
      duration = next;
      position = Math.min(position, duration);
      if (playing) startedAt = clock() - position;
      emit();
    }

    function destroy() {
      if (destroyed) return;
      cancelFrame();
      playing = false;
      paused = false;
      destroyed = true;
    }

    return {
      play: play,
      pause: pause,
      resume: resume,
      stop: stop,
      seek: seek,
      setEnabled: setEnabled,
      setLevel: setLevel,
      setDuration: setDuration,
      destroy: destroy,
      getState: function () { return { playing: playing, paused: paused, position: position, duration: duration, enabled: enabled, level: level, destroyed: destroyed }; }
    };
  }

  var api = { createTimeline: createTimeline };
  global.RailwayAnimation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
