import { DEFAULT_SAFE } from "./Core";

export class AudioLayer {
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  master = this.ctx.createGain();

  constructor() {
    this.master.gain.value = Math.pow(10, DEFAULT_SAFE.audioMaxDb / 20);
    this.master.connect(this.ctx.destination);
  }

  burst(frequency = 440, duration = 0.12, volume = 0.4) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.value = Math.min(volume, 0.8);

    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration);

    // quick pitch-up chirp
    osc.frequency.linearRampToValueAtTime(frequency * 1.6, t0 + duration);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  }
}
