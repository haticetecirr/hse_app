// Super admin girisinde calan nese dolu "basari" ses efekti (3 sn).
// Harici dosya gerektirmez; Web Audio API ile uretilir (offline/CSP dostu).
export function playAdminChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const DURATION = 3; // saniye

    // Ana cikis - tum efekt boyunca yumusak zarf
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
    master.gain.setValueAtTime(0.3, now + DURATION - 0.5);
    master.gain.exponentialRampToValueAtTime(0.0001, now + DURATION);
    master.connect(ctx.destination);

    // Tek bir "cinlayan" nota calan yardimci fonksiyon (zil/marimba hissi)
    const bell = (
      freq: number,
      t0: number,
      dur: number,
      vol: number,
      type: OscillatorType = 'triangle'
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);

      // Ustune hafif bir oktav parlaklik (mutlu, isiltili tini)
      const shine = ctx.createOscillator();
      const sg = ctx.createGain();
      shine.type = 'sine';
      shine.frequency.setValueAtTime(freq * 2, t0);
      sg.gain.setValueAtTime(0.0001, t0);
      sg.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
      shine.connect(sg);
      sg.connect(master);
      shine.start(t0);
      shine.stop(t0 + dur);
    };

    // 1) Neseli yukselen melodi: C - E - G - C (majör, "ta-ra-ra-raa")
    const melody: [number, number][] = [
      [523.25, 0.0], // C5
      [659.25, 0.14], // E5
      [783.99, 0.28], // G5
      [1046.5, 0.42], // C6
    ];
    melody.forEach(([freq, offset]) => {
      bell(freq, now + offset, 0.5, 0.26);
    });

    // 2) Finalde patlayan mutlu majör akor (C - E - G - C) uzun cinlama
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, i) => {
      bell(freq, now + 0.62 + i * 0.02, 1.9, 0.2);
    });

    // 3) Akorun altinda sicak bas destegi
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(130.81, now + 0.6); // C3
    bassGain.gain.setValueAtTime(0.0001, now + 0.6);
    bassGain.gain.exponentialRampToValueAtTime(0.18, now + 0.7);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    bass.connect(bassGain);
    bassGain.connect(master);
    bass.start(now + 0.6);
    bass.stop(now + 2.65);

    // 4) Ustte pirilti: hizli, hafif yuksek notalar (konfeti hissi)
    const sparkles = [
      1318.51, 1567.98, 2093.0, 1567.98, 1760.0, 2093.0, 1318.51, 2349.32,
    ];
    sparkles.forEach((freq, i) => {
      bell(freq, now + 0.9 + i * 0.17, 0.28, 0.09, 'sine');
    });

    // Calma bitince context'i kapat
    setTimeout(() => ctx.close().catch(() => {}), (DURATION + 0.4) * 1000);
  } catch {
    // Ses calinamazsa sessizce gec (girisi engelleme)
  }
}
