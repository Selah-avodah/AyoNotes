/* Jar of Notes — tiny electric-piano synth (Web Audio, no files needed) */
window.Sound = (function () {
  "use strict";

  var ctx = null, master, comp, send, delay, feedback, tone;
  var STORE = "jar-of-notes-sound";

  // Knob settings
  var VOL_LEVELS = [0, 0.45, 0.75, 1];          // 0 = muted
  var VERB_LEVELS = [0, 0.22, 0.42];
  var TONES = [
    { name: "E.PIANO", ratio: 1,   index: 1.6, modDecay: 0.55, dur: 1.9 },
    { name: "VIBES",   ratio: 4,   index: 0.9, modDecay: 0.25, dur: 2.6 },
    { name: "BELL",    ratio: 3.5, index: 2.4, modDecay: 1.3,  dur: 2.8 },
    { name: "SOFT",    ratio: 1,   index: 0.3, modDecay: 0.2,  dur: 1.3 }
  ];

  var state = { vol: 2, tone: 0, verb: 1 };
  try { var saved = JSON.parse(localStorage.getItem(STORE) || "null"); if (saved) state = Object.assign(state, saved); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);

      // simple echo "room"
      send = ctx.createGain();
      delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.27;
      feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 2600;
      send.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(master);
      apply();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function apply() {
    if (!ctx) return;
    master.gain.setTargetAtTime(VOL_LEVELS[state.vol] * 0.9, ctx.currentTime, 0.02);
    send.gain.setTargetAtTime(VERB_LEVELS[state.verb], ctx.currentTime, 0.02);
  }

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // One FM electric-piano voice
  function play(midi, when, velocity, durScale) {
    var c = ensure();
    if (!c || state.vol === 0) return;
    var p = TONES[state.tone];
    var f = freq(midi);
    var t = c.currentTime + (when || 0) + 0.005;
    var vel = velocity == null ? 0.8 : velocity;
    var dur = p.dur * (durScale || 1) * (f > 800 ? 0.75 : 1);

    var car = c.createOscillator();
    car.type = "sine";
    car.frequency.value = f;

    var mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.value = f * p.ratio;
    var modGain = c.createGain();
    modGain.gain.setValueAtTime(f * p.index * (0.6 + vel * 0.6), t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.02 + 0.01, t + p.modDecay);
    mod.connect(modGain);
    modGain.connect(car.frequency);

    // a little "tine" click on the attack
    var tine = c.createOscillator();
    tine.type = "triangle";
    tine.frequency.value = f * 4;
    var tineAmp = c.createGain();
    tineAmp.gain.setValueAtTime(0.0001, t);
    tineAmp.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.004);
    tineAmp.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    tine.connect(tineAmp);

    var amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.12 * vel, t + 0.35);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(amp);

    var pan = c.createStereoPanner ? c.createStereoPanner() : null;
    var out = amp;
    if (pan) { pan.pan.value = Math.max(-0.6, Math.min(0.6, (midi - 66) / 30)); amp.connect(pan); out = pan; }
    tineAmp.connect(master);
    out.connect(master);
    out.connect(send);

    car.start(t); mod.start(t); tine.start(t);
    car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1); tine.stop(t + 0.15);
  }

  function seq(notes, step, vel) {
    notes.forEach(function (m, i) {
      if (Array.isArray(m)) m.forEach(function (x) { play(x, i * step, vel); });
      else if (m != null) play(m, i * step, vel);
    });
  }

  return {
    unlock: ensure,
    play: play,
    powerOn: function () { seq([48, 52, 55, 59, 62, 64, [60, 64, 67, 71]], 0.09, 0.6); },
    powerOff: function () { seq([67, 64, 60, 55], 0.08, 0.45); },
    success: function () { seq([62, 65, 69, 72, null, [60, 64, 67, 71, 74]], 0.11, 0.7); },
    error: function () { seq([[43, 44]], 0.1, 0.6); },
    tick: function () { play(84, 0, 0.25, 0.25); },
    // knobs
    get: function () { return { vol: state.vol, tone: state.tone, verb: state.verb, toneName: TONES[state.tone].name }; },
    cycle: function (which) {
      var max = which === "vol" ? VOL_LEVELS.length : which === "tone" ? TONES.length : VERB_LEVELS.length;
      state[which] = (state[which] + 1) % max;
      save(); apply();
      return this.get();
    },
    counts: { vol: VOL_LEVELS.length, tone: TONES.length, verb: VERB_LEVELS.length }
  };
})();
