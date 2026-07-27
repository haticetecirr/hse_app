// Super admin girisinde calan "havali" ses efekti (~5 sn).
// Harici dosya gerektirmez; Web Audio API ile uretilir (offline/CSP dostu).
export function playAdminChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const DURATION = 5; // saniye

    // Ana cikis (genel ses seviyesi) - tum efekt boyunca yumusak zarf
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.28, now + 0.3);
    master.gain.setValueAtTime(0.28, now + DURATION - 0.6);
    master.gain.exponentialRampToValueAtTime(0.0001, now + DURATION);
    master.connect(ctx.destination);

    // 1) Alttan yuruyen pad akoru (C - E - G - C) tum sure boyunca
    const padFreqs = [261.63, 329.63, 392.0, 523.25];
    padFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      // hafif detune ile daha dolgun/havali
      osc.detune.setValueAtTime(-6, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.09, now + 0.5);
      g.gain.setValueAtTime(0.09, now + DURATION - 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, now + DURATION);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + DURATION);
    });

    // 2) Ustte surekli yukselen arpej (5 sn boyunca parildayan notalar)
    const arp = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
    const step = 0.16;
    for (let i = 0, t0 = now + 0.2; t0 < now + DURATION - 0.3; i++, t0 += step) {
      const freq = arp[i % arp.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.35);
    }

    // 3) Girise ve finale "power-up" sureni
    [now, now + DURATION - 0.9].forEach((t0) => {
      const sweep = ctx.createOscillator();
      const sg = ctx.createGain();
      sweep.type = 'sawtooth';
      sweep.frequency.setValueAtTime(300, t0);
      sweep.frequency.exponentialRampToValueAtTime(2200, t0 + 0.7);
      sg.gain.setValueAtTime(0.0001, t0);
      sg.gain.exponentialRampToValueAtTime(0.1, t0 + 0.06);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
      sweep.connect(sg);
      sg.connect(master);
      sweep.start(t0);
      sweep.stop(t0 + 0.8);
    });

    // Calma bitince context'i kapat
    setTimeout(() => ctx.close().catch(() => {}), (DURATION + 0.4) * 1000);
  } catch {
    // Ses calinamazsa sessizce gec (girisi engelleme)
  }
}
