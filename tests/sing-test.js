// Singing mode, end to end in Chromium: a simulated singer replaces the microphone and sings
// Tenor I of the built-in example in time with playback. Expected scores are checked.
// Run: npm test   (or: node sing-test.js)
const { chromium } = require('playwright');
const serve = require('./serve');
const cases = [
  // name, semitone shift, loudness, [min score, max score]
  ['correct', 0, 1, [85, 100]],
  ['a semitone high', 1, 1, [0, 35]],
  ['an octave low (Any octave on)', -12, 1, [85, 100]],
  ['silent', 0, 0, [0, 0]]
];
(async () => {
  const srv = await serve();
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let failed = 0;
  for (const [name, shift, loud, [lo, hi]] of cases) {
    const pg = await b.newPage({ viewport: { width: 1000, height: 1300 } });
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    // the "microphone" is a stream fed by the page's own audio context
    await pg.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { window.__dest = ctx.createMediaStreamDestination(); return window.__dest.stream; };
    });
    await pg.goto(srv.url);
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { $('tempo').value = 150; $('tempo').dispatchEvent(new Event('input')); });
    await pg.click('#singOn');
    await pg.keyboard.press('Space');
    await pg.waitForFunction(() => !!session, null, { timeout: 5000 });
    await pg.evaluate(([shift, loud]) => {
      const bd = session.bd, t0 = session.t0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 18; lfo.connect(lg); lfo.start();
      events.filter(e => e.v === 0).forEach(e => {
        const s = t0 + e.start * bd + 0.05, end = t0 + (e.start + e.dur) * bd + 0.02;
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = 440 * Math.pow(2, (e.midi + shift - 69) / 12); o.detune.value = 8; lg.connect(o.detune);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.25 * loud, s + 0.05); g.gain.setValueAtTime(0.25 * loud, end - 0.05); g.gain.linearRampToValueAtTime(0, end);
        o.connect(lp); lp.connect(g); g.connect(window.__dest); o.start(s); o.stop(end + 0.05);
      });
    }, [shift, loud]);
    await pg.waitForFunction(() => !$('singResult').hidden, null, { timeout: 60000 });
    const r = await pg.evaluate(() => ({ score: +$('rScore').textContent, stats: $('rStats').textContent }));
    const ok = r.score >= lo && r.score <= hi && !errs.length;
    if (!ok) failed++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(32) + ' score ' + r.score + ' (expected ' + lo + '-' + hi + ')  ' + r.stats + (errs.length ? '  errors: ' + errs.join('; ') : ''));
    await pg.close();
  }
  await b.close(); srv.close();
  process.exit(failed ? 1 : 0);
})();
