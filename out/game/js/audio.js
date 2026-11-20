// Sunfall City — procedural WebAudio. No sound files: every effect is an
// oscillator/noise burst created on demand, and the engine hum / siren are
// looping nodes whose frequency follows gameplay state.
const AudioSys = {
  ctx: null,
  master: null,
  engine: null,   // { osc, gain } drone while driving
  siren: null,    // { osc, lfo } wail while wanted
  lastShot: 0,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  // One-shot filtered noise burst, used for gunshots and explosions.
  burst(freq, dur, gain, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
  },

  shot() {
    if (!this.ctx) return;
    this.burst(1400, 0.12, 0.5);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.1);
  },
  punch() { this.burst(300, 0.08, 0.3); },
  explosion() { this.burst(220, 0.9, 0.9); },

  // Mission-complete jingle: a quick three-note arpeggio.
  jingle(win) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.14;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.32);
    });
  },

  // Engine drone while the player drives; pitch follows speed.
  setEngine(on, speed01) {
    if (!this.ctx) return;
    if (on && !this.engine) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.2);
      osc.connect(g); g.connect(this.master);
      osc.start();
      this.engine = { osc, g };
    } else if (!on && this.engine) {
      this.engine.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
      const e = this.engine; this.engine = null;
      setTimeout(() => { try { e.osc.stop(); } catch (err) {} }, 300);
    }
    if (this.engine) this.engine.osc.frequency.value = 50 + speed01 * 120;
  },

  // Police siren wail, tied to the wanted level.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.siren) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 720;
      lfo.type = 'square';
      lfo.frequency.value = 1.6;
      lfoG.gain.value = 180;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      g.gain.value = 0.05;
      osc.connect(g); g.connect(this.master);
      osc.start(); lfo.start();
      this.siren = { osc, g, lfo };
    } else if (!on && this.siren) {
      const s = this.siren; this.siren = null;
      s.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      setTimeout(() => { try { s.osc.stop(); s.lfo.stop(); } catch (err) {} }, 400);
    }
  },
};
