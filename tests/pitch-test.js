// Pitch reading under real-life disturbances (music leaking from speakers, breaths, overtone flips).
// Runs the page's own detector and smoothing on synthetic held notes; no browser needed.
// Run: node pitch-test.js [path/to/index.html]
// A steady sung note with real-life disturbances, run through the page's detector + smoothing.
// Counts how often the shown pitch is more than a semitone away from the note being held.
const fs = require('fs');
function load(file) {
  const s = fs.readFileSync(file, 'utf8').split('<script>')[1].split('</script>')[0];
  const grab = name => { const a = s.indexOf('function ' + name + '('); if (a < 0) return ''; let depth = 0, i = s.indexOf('{', a); for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}' && --depth === 0) break; } return s.slice(a, i + 1); };
  if (s.includes('function detectPitch(')) {
    // current version: McLeod pitch method + time-based steadying
    const det = new Function(grab('detectPitch') + '; return detectPitch;')();
    const sp = new Function(grab('stablePitch') + '; return stablePitch;')();
    return { make: () => { const d = {}; return buf => det(buf, SR, d); }, smooth: (st, raw, t) => sp(st, raw, t) };
  }
  // older versions: YIN
  const pre = s.includes('const YIN_LIM') ? s.slice(s.indexOf('const YIN_LIM'), s.indexOf(';', s.indexOf('const YIN_LIM')) + 1) + '\n' + grab('toneAmp') + '\n' : '';
  const yin = new Function(pre + grab('yin') + '; return yin;')();
  const make = () => buf => yin(buf, SR);
  const stable = grab('stablePitch');
  if (stable) { const sp = new Function(stable + '; return stablePitch;')(); return { make, smooth: (st, raw) => sp(st, raw) }; }
  // first version: median of the last 3 readings
  return { make, smooth: (st, raw) => { st.h = st.h || []; st.h.push(raw); if (st.h.length > 3) st.h.shift(); const v = st.h.filter(x => x != null).sort((a, b) => a - b); return raw == null || v.length < 2 ? null : v[v.length >> 1]; } };
}
const SR = 48000, N = 2048, HOP = 1600;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
const tone = (f0, amps, t) => { let v = 0; for (let k = 1; k <= amps.length; k++) v += amps[k - 1] * Math.sin(2 * Math.PI * k * f0 * t + k); return v; };
function scene(midi, sec, o) {
  const f0 = 440 * Math.pow(2, (midi - 69) / 12), n = Math.floor(sec * SR), x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f0 * Math.pow(2, (0.25 * Math.sin(2 * Math.PI * 5.3 * t) + 0.04 * Math.sin(2 * Math.PI * 0.7 * t)) / 12);
    ph += 2 * Math.PI * f / SR;
    let v = 0; o.amps.forEach((a, k) => { v += a * Math.sin((k + 1) * ph + k); });
    let y = 0.2 * v * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * t));
    // music leaking from speakers: other voices' notes, changing every second
    if (o.leak) { const lm = [midi + 4, midi + 7, midi - 5, midi + 12][Math.floor(t) % 4]; y += o.leak * 0.2 * tone(440 * Math.pow(2, (lm - 69) / 12), [1, 0.5, 0.3], t); }
    // breaths / consonants: short noise bursts with the voice dipping
    if (o.bursts && (t % 1.7) < 0.12) y = y * 0.2 + 0.12 * rnd();
    // momentary overtone flips: the 2nd overtone swells for a moment
    if (o.flips && (t % 2.3) < 0.08) y += 0.5 * Math.sin(2 * ph);
    x[i] = y + 0.008 * rnd();
  }
  return x;
}
const cases = [
  ['steady, bright voice', 57, { amps: [0.3, 1, 0.6, 0.4, 0.2] }],
  ['quiet leak (laptop speakers)', 60, { amps: [0.7, 0.6, 0.4, 0.2], leak: 0.15 }],
  ['louder leak', 60, { amps: [0.7, 0.6, 0.4, 0.2], leak: 0.3 }],
  ['breaths and consonants', 52, { amps: [0.6, 0.8, 0.4, 0.2], bursts: true }],
  ['overtone flips', 55, { amps: [0.25, 1, 0.3, 0.3], flips: true }],
  ['all of it', 59, { amps: [0.4, 0.9, 0.4, 0.2], leak: 0.2, bursts: true, flips: true }]
];
const files = process.argv.length > 2 ? process.argv.slice(2) : [require('path').join(__dirname, '..', 'index.html')];
let worst = 0;
for (const file of files) {
  const { make, smooth } = load(file);
  console.log('== ' + file);
  let J = 0, T = 0;
  for (const [name, midi, o] of cases) {
    const x = scene(midi, 12, o), st = {}, detect = make();
    let n = 0, jumps = 0, blank = 0;
    for (let p = 0; p + N <= x.length; p += HOP) {
      const f = detect(x.subarray(p, p + N));
      const t = p / SR;
      const shown = smooth(st, f ? 69 + 12 * Math.log2(f / 440) : null, t);
      n++;
      if (shown == null) blank++; else if (Math.abs(shown - midi) > 1) jumps++;
    }
    J += jumps; T += n;
    console.log('  ' + name.padEnd(30), 'jumps ' + String(jumps).padStart(3) + ' / ' + n + '   blank ' + blank);
  }
  console.log('  jump rate ' + (100 * J / T).toFixed(1) + '%');
  worst = Math.max(worst, J / T);
}
// fail if the shown pitch jumps away from a held note more than 3% of the time
if (worst > 0.03) { console.log('FAIL: jump rate above 3%'); process.exit(1); } else console.log('PASS: jump rate within 3%');
