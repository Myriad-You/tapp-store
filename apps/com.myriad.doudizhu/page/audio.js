(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  let context = null;
  let musicNodes = [];

  function unlock() {
    try {
      if (!context) context = new AudioContext();
      if (context.state === 'suspended') context.resume();
    } catch (_) { context = null; }
  }

  function play(name, settings) {
    if (!settings.sound) return;
    unlock();
    if (!context) return;
    const config = {
      click: [420, 620, 'sine', 0.07], select: [360, 520, 'triangle', 0.08], deal: [220, 330, 'triangle', 0.12],
      play: [260, 440, 'sine', 0.12], pass: [240, 180, 'sine', 0.16], tick: [760, 760, 'square', 0.07],
      bomb: [95, 45, 'sawtooth', 0.42], rocket: [180, 920, 'sawtooth', 0.62],
      win: [440, 880, 'triangle', 0.7], lose: [330, 120, 'sine', 0.75]
    };
    const item = config[name] || config.click;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = item[2];
      oscillator.frequency.setValueAtTime(item[0], context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(item[1], 1), context.currentTime + item[3]);
      gain.gain.setValueAtTime(Math.min(0.18, settings.volume * 0.16), context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + item[3]);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + item[3]);
    } catch (_) { /* audio is decorative */ }
  }

  function stopMusic() {
    musicNodes.forEach(function (node) { try { node.stop(); } catch (_) { /* stopped */ } });
    musicNodes = [];
  }

  function suspend() {
    stopMusic();
    if (context && context.state === 'running') {
      try { context.suspend(); } catch (_) { /* decorative audio */ }
    }
  }

  function setMusic(enabled, volume) {
    stopMusic();
    if (!enabled) return;
    unlock();
    if (!context) return;
    [110, 164.81, 220].forEach(function (frequency) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = volume * 0.006;
      oscillator.connect(gain).connect(context.destination); oscillator.start(); musicNodes.push(oscillator);
    });
  }

  function destroy() {
    stopMusic();
    if (context) { try { context.close(); } catch (_) { /* ignore */ } context = null; }
  }

  DDZ.audio = { unlock: unlock, play: play, setMusic: setMusic, stopMusic: stopMusic, suspend: suspend, destroy: destroy };
})(globalThis);
