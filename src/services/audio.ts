/**
 * Short, locally synthesised feedback tones (Web Audio API). No files, no
 * network. The AudioContext is created lazily inside a user gesture, so
 * nothing can play before the player has interacted.
 */
type Tone = { freq: number; to?: number; start: number; dur: number; type?: OscillatorType; gain?: number };

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function play(tones: Tone[]): void {
  const ac = context();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const t of tones) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, t0 + t.start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.start + t.dur);
    const peak = t.gain ?? 0.14;
    g.gain.setValueAtTime(0.0001, t0 + t.start);
    g.gain.exponentialRampToValueAtTime(peak, t0 + t.start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.start + t.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0 + t.start);
    osc.stop(t0 + t.start + t.dur + 0.02);
  }
}

export const sounds = {
  /** Call from a tap handler to unlock audio on iOS. */
  unlock(): void {
    context();
  },
  correct(): void {
    play([
      { freq: 660, start: 0, dur: 0.09 },
      { freq: 990, start: 0.07, dur: 0.14 },
    ]);
  },
  incorrect(): void {
    play([{ freq: 220, to: 150, start: 0, dur: 0.22, type: 'triangle', gain: 0.18 }]);
  },
  record(): void {
    play([
      { freq: 523, start: 0, dur: 0.1 },
      { freq: 659, start: 0.09, dur: 0.1 },
      { freq: 784, start: 0.18, dur: 0.1 },
      { freq: 1047, start: 0.27, dur: 0.22 },
    ]);
  },
  tick(): void {
    play([{ freq: 1200, start: 0, dur: 0.03, gain: 0.05 }]);
  },
};
