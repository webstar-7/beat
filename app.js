/* Beat · NYANSATEK — beat maker and frequency lab. Everything runs in the browser with the Web Audio API. */
(() => {
'use strict';

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const semi = n => Math.pow(2, n / 12);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const fileSafe = s => (String(s).trim() || 'beat').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 60);
const fmtHz = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2).replace(/\.?0+$/, '') + ' kHz' : (f < 10 ? f.toFixed(2) : f < 100 ? f.toFixed(1) : f.toFixed(f % 1 ? 2 : 0)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + ' Hz';

/* ---------------- tracks, scales, presets ---------------- */
const KINDS = [
  {kind: 'kick', name: 'Kick', c: '#ff6b6b', gm: 36, vol: .9, pan: 0, info: 'The thump. Body sits around 50–80 Hz, the click around 2–4 kHz. Tone adds punch and click.'},
  {kind: 'snare', name: 'Snare', c: '#ffa94d', gm: 38, vol: .72, pan: 0, info: 'The backbeat. Body around 150–250 Hz, crack and rattle 2–8 kHz. Tone balances body against noise.'},
  {kind: 'clap', name: 'Clap', c: '#ffd34d', gm: 39, vol: .7, pan: 0, info: 'Several hands in quick bursts, centred around 1–2 kHz. Tune moves the band; tone brightens it.'},
  {kind: 'chh', name: 'Closed hat', c: '#c0eb75', gm: 42, vol: .42, pan: .15, info: 'Short metallic tick above 7 kHz. A closed hat cuts off (chokes) a ringing open hat, like a real hi-hat.'},
  {kind: 'ohh', name: 'Open hat', c: '#69db7c', gm: 46, vol: .38, pan: .15, info: 'Longer metallic wash above 7 kHz. Gets choked by the closed hat.'},
  {kind: 'rim', name: 'Rim', c: '#38d9a9', gm: 37, vol: .5, pan: -.1, info: 'Stick on the drum rim, around 0.8–2 kHz. Great for Afrobeats and highlife patterns.'},
  {kind: 'shaker', name: 'Shaker', c: '#3bc9db', gm: 70, vol: .4, pan: -.25, info: 'Soft high noise around 4–8 kHz. Run it on every 16th with changing velocity for groove.'},
  {kind: 'conga', name: 'Conga', c: '#4dabf7', gm: 63, vol: .55, pan: .25, info: 'Hand drum with a short pitched tone around 300–400 Hz.'},
  {kind: 'tom', name: 'Tom', c: '#9775fa', gm: 45, vol: .6, pan: -.15, info: 'Pitched drum sweeping down from about 165 Hz. Use it for fills.'},
  {kind: 'bass', name: '808', c: '#f783ac', gm: null, vol: .85, pan: 0, info: 'Tuned sine bass. Its fundamental sits in the sub-bass (30–80 Hz). Tone adds distortion harmonics so it is still heard on phone speakers. Set its notes below.'},
];
const SCALES = {minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], penta: [0, 3, 5, 7, 10]};
const PATS = ['A', 'B', 'C', 'D'];
const MAXS = 32;
const rootNote = key => 24 + key + (key < 4 ? 12 : 0); // 808 root in octave 1–2 (E1–D#2)
const noteName = m => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const PRESETS = {
  afro: {name: 'Afrobeats', bpm: 104, swing: 56, key: 9, scale: 'minor',
    rows: {kick: 'x.....o.x.....o.', clap: '....x.......x...', rim: '...x..x....x..x.', shaker: 'xo-oxo-oxo-oxo-o', conga: '......x...o..x-.', bass: 'x.....x.x.....x.'},
    notes: {0: 0, 6: 0, 8: 3, 14: -2}, params: {bass: {decay: .9}}},
  amapiano: {name: 'Amapiano', bpm: 112, swing: 58, key: 5, scale: 'minor',
    rows: {kick: 'x...x...x...x...', clap: '....o.......o...', ohh: '..o...o...o...o.', shaker: 'o-x-o-x-o-x-o-x-', rim: '...x..x.....x...', bass: '..x..x....x..x..'},
    notes: {2: 0, 5: 0, 10: 3, 13: 5}, params: {bass: {decay: .45, tone: .75}, ohh: {decay: .6}}},
  hiplife: {name: 'Highlife / Hiplife', bpm: 116, swing: 55, key: 7, scale: 'major',
    rows: {kick: 'x..x....x..x....', snare: '....x.......x...', rim: 'x.x..x.x.x..x.x.', conga: '..x...x...x.x.x.', shaker: 'x-o-x-o-x-o-x-o-', bass: 'x..x....x..x....'},
    notes: {0: 0, 3: 0, 8: 5, 11: 4}, params: {bass: {decay: .6, tone: .4}}},
  trap: {name: 'Trap', bpm: 140, swing: 50, key: 1, scale: 'minor',
    rows: {kick: 'x......x..x.....', snare: '........x.......', clap: '........x.......', chh: 'x.o.x.o.x.oxo.x.', ohh: '..............o.', bass: 'x......x..x.....'},
    notes: {0: 0, 7: 0, 10: -2}, params: {bass: {decay: 1.9, tone: .6}}},
  boombap: {name: 'Boom bap', bpm: 90, swing: 62, key: 2, scale: 'minor',
    rows: {kick: 'x......o..x.....', snare: '....x.......x...', chh: 'x.o.x.o.x.o.x.o.', ohh: '..............o.', bass: 'x.........x.....'},
    notes: {0: 0, 10: -2}, params: {bass: {decay: .8, tone: .3}, kick: {tone: .7}}},
  house: {name: 'House', bpm: 124, swing: 52, key: 7, scale: 'minor',
    rows: {kick: 'x...x...x...x...', clap: '....x.......x...', chh: '-.-.-.-.-.-.-.-.', ohh: '..x...x...x...x.', bass: '..x...x...x...x.'},
    notes: {2: 0, 6: 0, 10: 3, 14: -2}, params: {bass: {decay: .4}, ohh: {decay: .7}}},
  empty: {name: 'Empty pattern'},
};
const VELCH = {x: 1, o: .7, '-': .45};

/* ---------------- project state ---------------- */
function defaultTrack(k) {
  return {kind: k.kind, name: k.name, vol: k.vol, pan: k.pan, tune: 0, decay: 1, tone: .5, mute: false, solo: false, glide: k.kind === 'bass', sample: null};
}
function newPattern(key) {
  return {t: KINDS.map(() => ({on: Array(MAXS).fill(0), vel: Array(MAXS).fill(.9), note: Array(MAXS).fill(rootNote(key))}))};
}
function defaultProject() {
  const p = {v: 1, uid: uid(), name: 'My beat', bpm: 105, swing: 50, steps: 16, key: 9, scale: 'minor', tuning: 440, mode: 'pattern', chain: 'A A B A', cur: 'A',
    tracks: KINDS.map(defaultTrack), patterns: {}, master: {vol: .8, glue: true, limit: true}, sel: 0};
  PATS.forEach(id => p.patterns[id] = newPattern(p.key));
  return p;
}
function fixProject(src) {
  const d = defaultProject(), p = Object.assign({}, d, src || {});
  p.master = Object.assign({}, d.master, p.master || {});
  p.tracks = KINDS.map((k, i) => Object.assign(defaultTrack(k), (p.tracks || [])[i] || {}, {kind: k.kind}));
  const pats = {};
  PATS.forEach(id => {
    const sp = (p.patterns || {})[id], np = newPattern(p.key);
    if (sp && sp.t) np.t.forEach((lane, i) => { const s = sp.t[i]; if (!s) return; ['on', 'vel', 'note'].forEach(f => { if (Array.isArray(s[f])) for (let j = 0; j < MAXS; j++) if (s[f][j] != null) lane[f][j] = +s[f][j]; }); });
    pats[id] = np;
  });
  p.patterns = pats;
  p.bpm = clamp(+p.bpm || 105, 40, 240); p.swing = clamp(+p.swing || 50, 50, 75);
  if (![8, 12, 16, 24, 32].includes(+p.steps)) p.steps = 16; p.steps = +p.steps;
  p.key = clamp(+p.key || 0, 0, 11); if (!SCALES[p.scale]) p.scale = 'minor';
  p.tuning = +p.tuning === 432 ? 432 : 440;
  if (!PATS.includes(p.cur)) p.cur = 'A';
  p.sel = clamp(+p.sel || 0, 0, KINDS.length - 1);
  if (!p.uid) p.uid = uid();
  return p;
}
let P = fixProject(store.get('beat.current', null));
if (!store.get('beat.current', null)) applyPreset('afro', true);
let saveT;
function dirty() { clearTimeout(saveT); saveT = setTimeout(() => store.set('beat.current', P), 500); }

function applyPreset(id, silent) {
  const pr = PRESETS[id]; if (!pr) return;
  const pat = P.patterns[P.cur];
  if (pr.rows) {
    P.bpm = pr.bpm; P.swing = pr.swing; P.scale = pr.scale; P.key = pr.key; P.steps = 16;
    P.tracks.forEach((t, i) => { const d = defaultTrack(KINDS[i]); Object.assign(t, {tune: 0, decay: 1, tone: .5, mute: false, solo: false, glide: d.glide}, (pr.params || {})[t.kind] || {}); });
  }
  const rn = rootNote(P.key);
  pat.t.forEach((lane, i) => {
    const row = (pr.rows || {})[KINDS[i].kind] || '';
    for (let s = 0; s < MAXS; s++) {
      const ch = row[s];
      lane.on[s] = ch && VELCH[ch] ? 1 : 0; lane.vel[s] = ch && VELCH[ch] ? VELCH[ch] : .9;
      lane.note[s] = rn + ((pr.notes || {})[s] || 0);
    }
  });
  if (!silent) { refreshAll(); dirty(); toast(pr.rows ? `${pr.name} loaded into pattern ${P.cur}` : `Pattern ${P.cur} cleared`); }
}

/* ---------------- samples (IndexedDB) ---------------- */
const SMP = KINDS.map(() => null); // {buf, raw, name}
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('beat', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('samples');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('samples', mode), st = t.objectStore('samples'); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  return {get: k => tx('readonly', s => s.get(k)), put: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k))};
})();
const decodeCtx = () => A.ctx || (A.dctx || (A.dctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100)));
async function decode(raw) { return await decodeCtx().decodeAudioData(raw.slice(0)); }
async function loadProjectSamples() {
  for (let i = 0; i < KINDS.length; i++) {
    SMP[i] = null;
    if (!P.tracks[i].sample) continue;
    try { const rec = await idb.get(P.uid + ':' + i); if (rec) SMP[i] = {buf: await decode(rec.raw), raw: rec.raw, name: rec.name}; else P.tracks[i].sample = null; }
    catch (e) { P.tracks[i].sample = null; }
  }
  refreshTrack(); buildGrid();
}

/* ---------------- audio core ---------------- */
const A = {ctx: null};
function buildMaster(ctx, dest) {
  const input = ctx.createGain(), comp = ctx.createDynamicsCompressor(), lim = ctx.createDynamicsCompressor(), out = ctx.createGain();
  input.connect(comp); comp.connect(lim); lim.connect(out); out.connect(dest);
  const m = {input, comp, lim, out, apply() {
    const g = P.master.glue, l = P.master.limit;
    comp.threshold.value = g ? -14 : 0; comp.ratio.value = g ? 3 : 1; comp.knee.value = 8; comp.attack.value = .012; comp.release.value = .16;
    lim.threshold.value = l ? -1.5 : 0; lim.ratio.value = l ? 20 : 1; lim.knee.value = 0; lim.attack.value = .002; lim.release.value = .08;
    out.gain.value = P.master.vol;
  }};
  m.apply(); return m;
}
function effGain(i) {
  const t = P.tracks[i], solo = P.tracks.some(x => x.solo);
  return t.mute || (solo && !t.solo) ? 0 : t.vol;
}
function buildStrips(ctx, dest, only) {
  return KINDS.map((k, i) => {
    const g = ctx.createGain(); let pan = null;
    if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = P.tracks[i].pan; g.connect(pan); pan.connect(dest); } else g.connect(dest);
    g.gain.value = only == null ? effGain(i) : (i === only ? P.tracks[i].vol : 0);
    return {in: g, pan};
  });
}
function updateStrips() {
  if (!A.ctx) return;
  A.strips.forEach((s, i) => { s.in.gain.setTargetAtTime(effGain(i), A.ctx.currentTime, .01); if (s.pan) s.pan.pan.setTargetAtTime(P.tracks[i].pan, A.ctx.currentTime, .01); });
}
function ensureCtx() {
  if (!A.ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    A.ctx = new C({latencyHint: 'interactive'});
    const ctx = A.ctx;
    A.an = ctx.createAnalyser(); A.an.fftSize = 8192; A.an.smoothingTimeConstant = .75; A.an.connect(ctx.destination);
    A.m = buildMaster(ctx, A.an);
    A.strips = buildStrips(ctx, A.m.input);
    A.FD = new Float32Array(A.an.frequencyBinCount); A.TD = new Float32Array(A.an.fftSize);
  }
  if (A.ctx.state !== 'running') A.ctx.resume();
  return A.ctx;
}

/* noise buffers, cached per context */
const NB = new WeakMap();
function noiseBuf(ctx, color = 'white') {
  let m = NB.get(ctx); if (!m) NB.set(ctx, m = {});
  if (m[color]) return m[color];
  // 'white' is the short mono buffer the drums use; the lab beds are 8 s stereo loops
  const sec = color === 'white' ? 2 : 8, n = Math.floor(ctx.sampleRate * sec), X = 4096;
  const b = ctx.createBuffer(color === 'white' ? 1 : 2, n, ctx.sampleRate);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const r = new Float32Array(n + X), d = b.getChannelData(c);
    if (color === 'pink') { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < r.length; i++) { const w = Math.random() * 2 - 1; b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; r[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; } }
    else if (color === 'brown') { let l = 0; for (let i = 0; i < r.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; r[i] = l * 3.5; } }
    else for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
    // seamless loop: the first X samples crossfade from the overflow, which is what naturally follows the last sample
    d.set(r.subarray(0, n));
    for (let i = 0; i < X; i++) { const k = i / X; d[i] = r[i] * Math.sqrt(k) + r[n + i] * Math.sqrt(1 - k); }
  }
  return m[color] = b;
}
function noise(ctx, t, dur) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true;
  s.start(t, Math.random() * 1.5); s.stop(t + dur); return s;
}
function env(ctx, t, peak, attack, decay) {
  const g = ctx.createGain(), pk = Math.max(peak, .0002);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
  return g;
}
function filt(ctx, type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
function osc(ctx, type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
const SHAPES = new Map();
function shaperCurve(k) {
  k = Math.round(k * 10) / 10; if (SHAPES.has(k)) return SHAPES.get(k);
  const n = 2048, c = new Float32Array(n), t = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / t; }
  SHAPES.set(k, c); return c;
}

/* drum voices: each returns how long it rings (s) */
const VOICES = {
  kick(ctx, out, t, p) {
    const d = .5 * p.decay, o = osc(ctx, 'sine', 0), top = 140 * semi(p.tune) * (1 + p.tone * .8), base = 48 * semi(p.tune);
    o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(base, t + .06 + .06 * (1 - p.tone));
    const g = env(ctx, t, p.vel, .002, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .1);
    const n = noise(ctx, t, .03), hp = filt(ctx, 'highpass', 2500), ng = env(ctx, t, p.vel * .3 * (.2 + p.tone), .001, .012);
    n.connect(hp); hp.connect(ng); ng.connect(out);
    return d;
  },
  snare(ctx, out, t, p) {
    const d = .2 * p.decay, o = osc(ctx, 'triangle', 0);
    o.frequency.setValueAtTime(200 * semi(p.tune), t); o.frequency.exponentialRampToValueAtTime(165 * semi(p.tune), t + .06);
    const og = env(ctx, t, p.vel * (1 - p.tone * .6), .001, .12 * p.decay); o.connect(og); og.connect(out); o.start(t); o.stop(t + .4 * p.decay + .1);
    const n = noise(ctx, t, d + .1), hp = filt(ctx, 'highpass', 1200 * semi(p.tune * .5)), ng = env(ctx, t, p.vel * (.45 + p.tone * .5), .001, d);
    n.connect(hp); hp.connect(ng); ng.connect(out);
    return d;
  },
  clap(ctx, out, t, p) {
    const d = .22 * p.decay, n = noise(ctx, t, d + .1), bp = filt(ctx, 'bandpass', 1150 * semi(p.tune), 1.1), hp = filt(ctx, 'highpass', 500 + p.tone * 900), g = ctx.createGain(), v = p.vel * 1.3;
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 3; k++) { const tt = t + k * .011; g.gain.setValueAtTime(v, tt); g.gain.exponentialRampToValueAtTime(v * .08, tt + .0105); }
    g.gain.setValueAtTime(v * .9, t + .033); g.gain.exponentialRampToValueAtTime(.0001, t + .033 + d);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
    return d + .033;
  },
  chh(ctx, out, t, p) { return metal(ctx, out, t, p, .055 * p.decay); },
  ohh(ctx, out, t, p) { return metal(ctx, out, t, p, .38 * p.decay); },
  rim(ctx, out, t, p) {
    const d = .04 * p.decay, bp = filt(ctx, 'bandpass', 1600 * semi(p.tune) * (.8 + p.tone * .5), 3), g = env(ctx, t, p.vel * 1.1, .0005, d);
    [['square', 820], ['triangle', 1660]].forEach(([ty, f]) => { const o = osc(ctx, ty, f * semi(p.tune)); o.connect(bp); o.start(t); o.stop(t + d + .05); });
    bp.connect(g); g.connect(out);
    return d;
  },
  shaker(ctx, out, t, p) {
    const d = .07 * p.decay, n = noise(ctx, t, d + .05), bp = filt(ctx, 'bandpass', 5500 * (.8 + p.tone * .6) * semi(p.tune * .5), 1.5), hp = filt(ctx, 'highpass', 3000), g = env(ctx, t, p.vel * .9, .012, d);
    n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(out);
    return d;
  },
  conga(ctx, out, t, p) {
    const d = .22 * p.decay, o = osc(ctx, 'sine', 0);
    o.frequency.setValueAtTime(380 * semi(p.tune), t); o.frequency.exponentialRampToValueAtTime(320 * semi(p.tune), t + .04);
    const g = env(ctx, t, p.vel, .001, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
    const n = noise(ctx, t, .03), bp = filt(ctx, 'bandpass', 2200, 1.5), ng = env(ctx, t, p.vel * .35 * p.tone, .001, .015);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    return d;
  },
  tom(ctx, out, t, p) {
    const d = .45 * p.decay, o = osc(ctx, 'sine', 0);
    o.frequency.setValueAtTime(170 * semi(p.tune), t); o.frequency.exponentialRampToValueAtTime(105 * semi(p.tune), t + .22);
    const g = env(ctx, t, p.vel, .002, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
    const n = noise(ctx, t, .03), lp = filt(ctx, 'lowpass', 1800), ng = env(ctx, t, p.vel * .2 * p.tone, .001, .02);
    n.connect(lp); lp.connect(ng); ng.connect(out);
    return d;
  },
  bass(ctx, out, t, p) {
    const d = 1.1 * p.decay, o = osc(ctx, 'sine', 0);
    if (p.from) { o.frequency.setValueAtTime(p.from, t); o.frequency.exponentialRampToValueAtTime(p.freq, t + .07); }
    else { o.frequency.setValueAtTime(p.freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(p.freq, t + .025); }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(Math.max(p.vel, .0002), t + .004);
    g.gain.setValueAtTime(Math.max(p.vel, .0002), t + Math.min(.08, d * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    const sh = ctx.createWaveShaper(); sh.curve = shaperCurve(.5 + p.tone * p.tone * 9); sh.oversample = '2x';
    const lp = filt(ctx, 'lowpass', 2500), trim = ctx.createGain(); trim.gain.value = 1 - p.tone * .25;
    o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(trim); trim.connect(out);
    o.start(t); o.stop(t + d + .05);
    return d;
  },
};
function metal(ctx, out, t, p, len) {
  const g = env(ctx, t, p.vel * .55, .001, len), hp = filt(ctx, 'highpass', 6500 + p.tone * 3000), bp = filt(ctx, 'bandpass', 10000 * semi(p.tune * .5), .8), mix = ctx.createGain();
  mix.gain.value = .14;
  const f0 = 40 * semi(p.tune);
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) { const o = osc(ctx, 'square', f0 * r); o.connect(mix); o.start(t); o.stop(t + len + .05); }
  mix.connect(bp); bp.connect(hp);
  const n = noise(ctx, t, len + .05), ng = ctx.createGain(); ng.gain.value = .5; n.connect(ng); ng.connect(hp);
  hp.connect(g); g.connect(out);
  return len;
}
function sampleVoice(ctx, out, t, p, buf, shift) {
  const s = ctx.createBufferSource(); s.buffer = buf;
  const rate = semi(p.tune + shift); s.playbackRate.value = rate;
  const full = buf.duration / rate, len = Math.min(full, full * Math.min(1, p.decay));
  const g = ctx.createGain(); g.gain.setValueAtTime(p.vel, t);
  if (len < full - .001) { g.gain.setValueAtTime(p.vel, t + len * .6); g.gain.linearRampToValueAtTime(0, t + len); }
  let node = s;
  if (p.tone < .49) { const lp = filt(ctx, 'lowpass', 200 * Math.pow(100, p.tone * 2)); s.connect(lp); node = lp; }
  node.connect(g); g.connect(out); s.start(t); s.stop(t + len + .02);
  return len;
}
const midiF = m => P.tuning * Math.pow(2, (m - 69) / 12);
function choke(g, t) { g.gain.setValueAtTime(1, t); g.gain.setTargetAtTime(0, t, .006); }
function trigger(ctx, strips, st, i, t, vel, note) {
  const tr = P.tracks[i], k = tr.kind, p = {vel, tune: tr.tune, decay: tr.decay, tone: tr.tone};
  if (k === 'bass') {
    p.freq = midiF(note) * semi(tr.tune);
    if (tr.glide && st.bassNote != null && t < st.bassEnd && st.bassNote !== note) p.from = midiF(st.bassNote) * semi(tr.tune);
    if (st.bass) choke(st.bass, t);
  }
  if (k === 'chh' && st.ohh) { choke(st.ohh, t); st.ohh = null; }
  const ch = ctx.createGain(); ch.connect(strips[i].in);
  const s = SMP[i];
  const len = s ? sampleVoice(ctx, ch, t, Object.assign(p, {tune: tr.tune}), s.buf, k === 'bass' ? note - rootNote(P.key) : 0) : VOICES[k](ctx, ch, t, p);
  if (k === 'ohh') st.ohh = ch;
  if (k === 'bass') { st.bass = ch; st.bassNote = note; st.bassEnd = t + len; }
}
function preview(i, note) {
  const ctx = ensureCtx(); A.pst = A.pst || {};
  trigger(ctx, A.strips, A.pst, i, ctx.currentTime + .01, .9, note != null ? note : rootNote(P.key));
}

/* ---------------- sequencer ---------------- */
const SQ = {on: false, step: 0, song: 0, next: 0, st: {}, q: []};
const stepDur = () => 60 / P.bpm / 4;
const swingOff = () => (P.swing - 50) / 50 * stepDur();
function chainIds() { const ids = String(P.chain).toUpperCase().split(/[^ABCD]+/).join('').split('').filter(c => PATS.includes(c)); return ids.length ? ids : [P.cur]; }
function tick() {
  if (!SQ.on) return;
  const ctx = A.ctx;
  if (SQ.next < ctx.currentTime - .25) SQ.next = ctx.currentTime + .05;
  while (SQ.next < ctx.currentTime + .12) {
    const ids = chainIds(), pid = P.mode === 'song' ? ids[SQ.song % ids.length] : P.cur, pat = P.patterns[pid], s = SQ.step;
    const t = SQ.next + (s % 2 ? swingOff() : 0);
    pat.t.forEach((lane, i) => { if (lane.on[s]) trigger(ctx, A.strips, SQ.st, i, t, lane.vel[s], lane.note[s]); });
    SQ.q.push({t, s, pid}); if (SQ.q.length > 64) SQ.q.shift();
    SQ.next += stepDur();
    if (++SQ.step >= P.steps) { SQ.step = 0; SQ.song++; }
  }
}
const ticker = (() => {
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['let t=null;onmessage=e=>{clearInterval(t);t=null;if(e.data)t=setInterval(()=>postMessage(0),25)}'], {type: 'text/javascript'})));
    w.onmessage = tick; return {on: () => w.postMessage(1), off: () => w.postMessage(0)};
  } catch (e) { let h = null; return {on: () => { clearInterval(h); h = setInterval(tick, 25); }, off: () => clearInterval(h)}; }
})();
function play() {
  const ctx = ensureCtx();
  Object.assign(SQ, {on: true, step: 0, song: 0, next: ctx.currentTime + .06, st: {}, q: []});
  ticker.on(); tick(); playUI();
}
function stop() { SQ.on = false; ticker.off(); SQ.q = []; playUI(); markStep(-1); markPlayingPat(null); }
function playUI() {
  const b = $('#playBtn'); b.classList.toggle('on', SQ.on);
  b.querySelector('span').textContent = SQ.on ? 'Stop' : 'Play';
  b.querySelector('svg').innerHTML = SQ.on ? '<rect x="6" y="6" width="12" height="12" rx="1"/>' : '<path d="M7 4l13 8-13 8z"/>';
}

/* ---------------- beat maker UI ---------------- */
let cells = [];
function buildGrid() {
  const g = $('#grid'), N = P.steps;
  g.style.gridTemplateColumns = `auto repeat(${N}, var(--cell))`;
  let h = '<div></div>';
  for (let s = 0; s < N; s++) h += `<div class="steplbl">${s % 4 === 0 ? s / 4 + 1 : ''}</div>`;
  KINDS.forEach((k, i) => {
    const t = P.tracks[i];
    h += `<div class="thead" style="--c:${k.c}"><button class="tname${P.sel === i ? ' sel' : ''}${SMP[i] ? ' smp' : ''}" data-sel="${i}" title="${esc(SMP[i] ? 'Sample: ' + SMP[i].name : k.name)}">${esc(k.name)}</button>` +
      `<button class="ms m" data-ms="mute" data-i="${i}" aria-pressed="${t.mute}" title="Mute">M</button><button class="ms s" data-ms="solo" data-i="${i}" aria-pressed="${t.solo}" title="Solo">S</button></div>`;
    for (let s = 0; s < N; s++) h += `<button class="step${Math.floor(s / 4) % 2 ? ' alt' : ''}" style="--c:${k.c}" data-i="${i}" data-s="${s}" aria-label="${k.name} step ${s + 1}"></button>`;
  });
  g.innerHTML = h;
  cells = KINDS.map(() => []);
  $$('.step', g).forEach(b => cells[+b.dataset.i][+b.dataset.s] = b);
  updateGrid();
}
function updateGrid() {
  const pat = P.patterns[P.cur];
  cells.forEach((row, i) => row.forEach((b, s) => {
    const on = !!pat.t[i].on[s]; b.classList.toggle('on', on); b.style.setProperty('--v', pat.t[i].vel[s]); b.setAttribute('aria-pressed', on);
  }));
  renderPats();
}
let lastMark = -1;
function markStep(s) {
  if (lastMark >= 0) cells.forEach(r => r[lastMark] && r[lastMark].classList.remove('now'));
  lastMark = s;
  if (s >= 0) cells.forEach(r => r[s] && r[s].classList.add('now'));
}
function markPlayingPat(pid) { $$('#pats button').forEach(b => b.classList.toggle('playing', b.dataset.p === pid)); }
function patHas(id) { return P.patterns[id].t.some(l => l.on.slice(0, P.steps).some(Boolean)); }
function renderPats() {
  $('#pats').innerHTML = PATS.map(id => `<button data-p="${id}" aria-pressed="${P.cur === id}" class="${patHas(id) ? 'has' : ''}" title="Pattern ${id}">${id}</button>`).join('');
}
function setStep(i, s, on) {
  const lane = P.patterns[P.cur].t[i]; lane.on[s] = on ? 1 : 0;
  const b = cells[i][s]; b.classList.toggle('on', on); b.style.setProperty('--v', lane.vel[s]); b.setAttribute('aria-pressed', on);
  if (i === P.sel) renderLanes();
}
// grid: tap, drag to paint, names, mute/solo
(() => {
  const g = $('#grid'); let paint = null;
  g.addEventListener('pointerdown', e => {
    const b = e.target.closest('.step'); if (!b) return;
    e.preventDefault();
    const i = +b.dataset.i, s = +b.dataset.s, on = !P.patterns[P.cur].t[i].on[s];
    paint = {i, on, done: new Set([s])}; setStep(i, s, on);
    if (on && !SQ.on) preview(i, P.patterns[P.cur].t[i].note[s]);
    dirty(); renderPats();
  });
  window.addEventListener('pointermove', e => {
    if (!paint) return;
    const b = document.elementFromPoint(e.clientX, e.clientY); if (!b || !b.classList || !b.classList.contains('step')) return;
    const i = +b.dataset.i, s = +b.dataset.s; if (i !== paint.i || paint.done.has(s)) return;
    paint.done.add(s); setStep(i, s, paint.on);
  });
  window.addEventListener('pointerup', () => { if (paint) { paint = null; dirty(); renderPats(); } });
  g.addEventListener('click', e => {
    const n = e.target.closest('[data-sel]'), m = e.target.closest('[data-ms]');
    if (n) { P.sel = +n.dataset.sel; $$('.tname', g).forEach(x => x.classList.toggle('sel', x === n)); refreshTrack(); preview(P.sel); dirty(); }
    if (m) { const t = P.tracks[+m.dataset.i], f = m.dataset.ms; t[f] = !t[f]; m.setAttribute('aria-pressed', t[f]); updateStrips(); dirty(); }
  });
  g.addEventListener('keydown', e => { // keyboard: arrow keys move between steps
    const b = e.target.closest('.step'); if (!b) return;
    let i = +b.dataset.i, s = +b.dataset.s;
    if (e.key === 'ArrowRight') s = (s + 1) % P.steps; else if (e.key === 'ArrowLeft') s = (s - 1 + P.steps) % P.steps;
    else if (e.key === 'ArrowDown') i = (i + 1) % KINDS.length; else if (e.key === 'ArrowUp') i = (i - 1 + KINDS.length) % KINDS.length;
    else if (e.key === 'Enter') { e.preventDefault(); const on = !P.patterns[P.cur].t[i].on[s]; setStep(i, s, on); if (on && !SQ.on) preview(i); dirty(); renderPats(); return; }
    else return;
    e.preventDefault(); cells[i][s].focus();
  });
})();

/* track editor */
const TK = [['tVol', 'vol', v => Math.round(v * 100) + '%'], ['tPan', 'pan', v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)],
  ['tTune', 'tune', v => (v > 0 ? '+' : '') + v], ['tDecay', 'decay', v => '×' + (+v).toFixed(2)], ['tTone', 'tone', v => Math.round(v * 100) + '%']];
function refreshTrack() {
  const i = P.sel, t = P.tracks[i], k = KINDS[i];
  $('#trkTitle').textContent = k.name; $('#trackCard').style.setProperty('--c', k.c);
  $('#trkInfo').textContent = SMP[i] ? `Using your sample "${SMP[i].name}". Tune shifts its pitch, length shortens it, tone below 50% darkens it.` : k.info;
  TK.forEach(([id, f, fmt]) => { const el = $('#' + id); el.value = t[f]; el.nextElementSibling.textContent = fmt(t[f]); });
  $('#tGlide').checked = !!t.glide; $('#glideWrap').hidden = k.kind !== 'bass';
  $('#noteWrap').hidden = k.kind !== 'bass';
  $('#sampleClear').hidden = !SMP[i];
  renderLanes();
}
TK.forEach(([id, f, fmt]) => $('#' + id).addEventListener('input', e => {
  const v = +e.target.value; P.tracks[P.sel][f] = v; e.target.nextElementSibling.textContent = fmt(v);
  if (f === 'vol' || f === 'pan') updateStrips(); dirty();
}));
['tTune', 'tDecay', 'tTone'].forEach(id => $('#' + id).addEventListener('change', () => { if (!SQ.on) preview(P.sel); }));
$('#tGlide').addEventListener('change', e => { P.tracks[P.sel].glide = e.target.checked; dirty(); });
function inScale(m) { return SCALES[P.scale].includes(((m - P.key) % 12 + 12) % 12); }
function renderLanes() {
  const i = P.sel, lane = P.patterns[P.cur].t[i], N = P.steps, c = KINDS[i].c;
  const vl = $('#velLane'); vl.style.setProperty('--c', c);
  vl.innerHTML = Array.from({length: N}, (_, s) => `<div class="v${lane.on[s] ? '' : ' off'}${s && s % 4 === 0 ? ' bar' : ''}" data-s="${s}" title="Step ${s + 1}: ${Math.round(lane.vel[s] * 100)}%"><i style="height:calc(${lane.vel[s] * 100}% - 4px)"></i></div>`).join('');
  if (KINDS[i].kind === 'bass') {
    let opts = ''; for (let m = 59; m >= 24; m--) opts += `<option value="${m}">${noteName(m)}${inScale(m) ? ' •' : ''}</option>`;
    const nl = $('#noteLane'); nl.innerHTML = Array.from({length: N}, (_, s) => `<select data-s="${s}" ${lane.on[s] ? '' : 'disabled'} aria-label="808 note, step ${s + 1}">${opts}</select>`).join('');
    $$('select', nl).forEach(sel => sel.value = lane.note[+sel.dataset.s]);
  }
}
(() => {
  const vl = $('#velLane'); let drag = false;
  const set = e => {
    const bars = $$('.v', vl), b = bars.find(x => { const r = x.getBoundingClientRect(); return e.clientX >= r.left - 2 && e.clientX <= r.right + 2; }); if (!b) return;
    const r = b.getBoundingClientRect(), v = Math.round(clamp(1 - (e.clientY - r.top) / r.height, .05, 1) * 100) / 100, s = +b.dataset.s;
    const lane = P.patterns[P.cur].t[P.sel]; lane.vel[s] = v;
    b.firstChild.style.height = `calc(${v * 100}% - 4px)`; b.title = `Step ${s + 1}: ${Math.round(v * 100)}%`;
    cells[P.sel][s].style.setProperty('--v', v);
  };
  vl.addEventListener('pointerdown', e => { drag = true; vl.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
  vl.addEventListener('pointermove', e => { if (drag) set(e); });
  vl.addEventListener('pointerup', () => { drag = false; dirty(); });
  vl.addEventListener('pointercancel', () => { drag = false; });
  $('#noteLane').addEventListener('change', e => {
    const s = +e.target.dataset.s, m = +e.target.value; P.patterns[P.cur].t[P.sel].note[s] = m; dirty();
    if (!SQ.on) preview(P.sel, m);
  });
})();
$('#sampleFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const raw = await f.arrayBuffer(), buf = await decode(raw), i = P.sel;
    if (buf.duration > 30) { toast('That file is longer than 30 seconds. Use a one-shot drum sample.'); return; }
    SMP[i] = {buf, raw, name: f.name}; P.tracks[i].sample = f.name;
    idb.put(P.uid + ':' + i, {raw, name: f.name}).catch(() => toast('Could not save the sample in this browser; it works until you reload.'));
    refreshTrack(); buildGrid(); dirty(); preview(i); toast(`${KINDS[i].name} now plays ${f.name}`);
  } catch (err) { toast('Could not read that audio file. Try WAV or MP3.'); }
});
$('#sampleClear').addEventListener('click', () => {
  const i = P.sel; SMP[i] = null; P.tracks[i].sample = null; idb.del(P.uid + ':' + i).catch(() => {});
  refreshTrack(); buildGrid(); dirty(); preview(i);
});

/* transport */
$('#key').innerHTML = NOTE.map((n, i) => `<option value="${i}">${n}</option>`).join('');
$('#preset').innerHTML = '<option value="">Choose a style…</option>' + Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
function refreshTransport() {
  $('#bpm').value = P.bpm; $('#swing').value = P.swing; $('#swingOut').textContent = P.swing + '%';
  $('#steps').value = P.steps; $('#key').value = P.key; $('#scale').value = P.scale;
  $$('.tuningSel').forEach(s => s.value = P.tuning);
  $('#mode').value = P.mode; $('#chain').value = P.chain; $('#projName').value = P.name;
  $('#mVol').value = P.master.vol; $('#mVol').nextElementSibling.textContent = Math.round(P.master.vol * 100) + '%';
  $('#mGlue').checked = P.master.glue; $('#mLimit').checked = P.master.limit;
  $('#exWhat').value = P.mode;
}
function refreshAll() { refreshTransport(); buildGrid(); refreshTrack(); }
$('#playBtn').addEventListener('click', () => SQ.on ? stop() : play());
$('#bpm').addEventListener('change', e => { P.bpm = clamp(Math.round(+e.target.value) || 105, 40, 240); e.target.value = P.bpm; dirty(); });
$('#swing').addEventListener('input', e => { P.swing = +e.target.value; $('#swingOut').textContent = P.swing + '%'; dirty(); });
$('#steps').addEventListener('change', e => { P.steps = +e.target.value; if (SQ.step >= P.steps) SQ.step = 0; buildGrid(); renderLanes(); dirty(); });
$('#key').addEventListener('change', e => {
  const nk = +e.target.value; let d = ((nk - P.key) % 12 + 12) % 12; if (d > 6) d -= 12;
  PATS.forEach(id => P.patterns[id].t[KINDS.length - 1].note.forEach((m, s, a) => a[s] = clamp(m + d, 24, 59)));
  P.key = nk; renderLanes(); dirty(); toast(`Key is now ${NOTE[nk]} ${P.scale}. 808 notes moved with it.`);
});
$('#scale').addEventListener('change', e => { P.scale = e.target.value; renderLanes(); dirty(); });
$('#preset').addEventListener('change', e => {
  const id = e.target.value; e.target.value = ''; if (!id) return;
  if (patHas(P.cur) && !confirm(`Replace pattern ${P.cur} with the ${PRESETS[id].name} ${id === 'empty' ? '' : 'groove'}?`)) return;
  applyPreset(id);
});
$('#tapBtn').addEventListener('click', () => {
  const now = performance.now(); A.taps = (A.taps || []).filter(t => now - t < 2500); A.taps.push(now);
  if (A.taps.length >= 3) { const d = (A.taps[A.taps.length - 1] - A.taps[0]) / (A.taps.length - 1); P.bpm = clamp(Math.round(60000 / d), 40, 240); $('#bpm').value = P.bpm; dirty(); }
});
$('#pats').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; P.cur = b.dataset.p; updateGrid(); renderLanes(); dirty(); });
$('#copyPat').textContent = 'Duplicate to next';
$('#copyPat').addEventListener('click', () => {
  const from = PATS.indexOf(P.cur); let to = PATS.find((id, k) => k > from && !patHas(id)) || PATS.find(id => id !== P.cur && !patHas(id));
  if (!to) { to = PATS[(from + 1) % 4]; if (!confirm(`All patterns have notes. Overwrite pattern ${to}?`)) return; }
  P.patterns[to] = JSON.parse(JSON.stringify(P.patterns[P.cur])); P.cur = to; updateGrid(); renderLanes(); dirty();
  toast(`Copied into pattern ${to}. Change a few steps to make a variation.`);
});
$('#clearPat').addEventListener('click', () => { if (!patHas(P.cur) || confirm(`Clear pattern ${P.cur}?`)) applyPreset('empty'); });
$('#mode').addEventListener('change', e => { P.mode = e.target.value; $('#exWhat').value = P.mode; SQ.song = 0; dirty(); });
$('#chain').addEventListener('change', e => { P.chain = e.target.value.toUpperCase().replace(/[^ABCD ,]/g, ' ').replace(/\s+/g, ' ').trim() || 'A'; e.target.value = P.chain; dirty(); });
$('#mVol').addEventListener('input', e => { P.master.vol = +e.target.value; e.target.nextElementSibling.textContent = Math.round(P.master.vol * 100) + '%'; if (A.m) A.m.apply(); dirty(); });
$('#mGlue').addEventListener('change', e => { P.master.glue = e.target.checked; if (A.m) A.m.apply(); dirty(); });
$('#mLimit').addEventListener('change', e => { P.master.limit = e.target.checked; if (A.m) A.m.apply(); dirty(); });
$$('.tuningSel').forEach(s => s.addEventListener('change', e => setTuning(+e.target.value)));
function setTuning(v) {
  P.tuning = v; $$('.tuningSel').forEach(s => s.value = v); dirty();
  updateToneFacts(); renderNoteTable(); toast(`Tuning set to A = ${v} Hz for the 808 and all notes.`);
}

/* ---------------- export: WAV, stems, MIDI ---------------- */
function wavBlob(chans, sr, bits) {
  const ch = chans.length, n = chans[0].length, bps = bits / 8, dataLen = n * ch * bps, ab = new ArrayBuffer(44 + dataLen), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * bps, true); v.setUint16(32, ch * bps, true); v.setUint16(34, bits, true);
  w(36, 'data'); v.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    let x = chans[c][i];
    if (bits === 16) { x += (Math.random() - Math.random()) / 32768; const s = Math.round(clamp(x, -1, 1) * 32767); v.setInt16(o, s, true); o += 2; }
    else { const s = Math.round(clamp(x, -1, 1) * 8388607); v.setUint8(o, s & 255); v.setUint8(o + 1, (s >> 8) & 255); v.setUint8(o + 2, (s >> 16) & 255); o += 3; }
  }
  return new Blob([ab], {type: 'audio/wav'});
}
function exportSeq() {
  const ids = $('#exWhat').value === 'song' ? chainIds() : [P.cur], loops = +$('#exLoops').value, seq = [];
  for (let l = 0; l < loops; l++) seq.push(...ids);
  return seq;
}
async function renderBeat(seq, only, withMaster, rate) {
  const sd = stepDur(), len = seq.length * P.steps * sd, tail = 3;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil((len + tail) * rate), rate);
  const dest = withMaster ? buildMaster(ctx, ctx.destination).input : ctx.destination;
  const strips = buildStrips(ctx, dest, only), st = {};
  let base = 0;
  for (const pid of seq) {
    const pat = P.patterns[pid];
    for (let s = 0; s < P.steps; s++) {
      const t = base + s * sd + (s % 2 ? swingOff() : 0);
      pat.t.forEach((lane, i) => { if ((only == null || i === only) && lane.on[s] && (only != null || effGain(i) > 0)) trigger(ctx, strips, st, i, t, lane.vel[s], lane.note[s]); });
    }
    base += P.steps * sd;
  }
  const buf = await ctx.startRendering();
  const n = Math.round(len * rate), chans = [buf.getChannelData(0), buf.getChannelData(1)];
  if ($('#exWrap').checked) { // loop-ready: exact bar length, with the ringing tail folded back onto the start
    return chans.map(d => { const a = new Float32Array(n); a.set(d.subarray(0, n)); for (let j = n; j < d.length; j++) a[(j - n) % n] += d[j]; return a; });
  }
  let last = n; for (let j = chans[0].length - 1; j >= n; j--) if (Math.abs(chans[0][j]) > 1e-4 || Math.abs(chans[1][j]) > 1e-4) { last = Math.min(chans[0].length, j + Math.round(.05 * rate)); break; }
  return chans.map(d => d.slice(0, last));
}
function baseName() { return `${fileSafe(P.name)}_${P.bpm}bpm_${NOTE[P.key].replace('#', 's')}${P.scale === 'major' ? 'maj' : P.scale === 'minor' ? 'min' : P.scale}`; }
function exBusy(on, msg) { ['#exMix', '#exStems', '#exMidi'].forEach(s => $(s).disabled = on); if (msg) $('#exStatus').textContent = msg; }
$('#exMix').addEventListener('click', async () => {
  const seq = exportSeq(), rate = +$('#exRate').value, bits = +$('#exBits').value;
  exBusy(true, 'Rendering your beat…');
  try {
    const ch = await renderBeat(seq, null, true, rate);
    download(wavBlob(ch, rate, bits), `${baseName()}_mix.wav`);
    exBusy(false, `Exported ${(ch[0].length / rate).toFixed(1)} s, ${bits}-bit / ${rate / 1000} kHz stereo. Drop it into your DAW at ${P.bpm} BPM.`);
  } catch (e) { exBusy(false, 'Export failed: ' + e.message); }
});
$('#exStems').addEventListener('click', async () => {
  const seq = exportSeq(), rate = +$('#exRate').value, bits = +$('#exBits').value;
  const used = KINDS.map((k, i) => i).filter(i => seq.some(pid => P.patterns[pid].t[i].on.slice(0, P.steps).some(Boolean)));
  if (!used.length) { toast('Nothing to export yet: switch on some steps first.'); return; }
  exBusy(true);
  try {
    for (const [n, i] of used.entries()) {
      $('#exStatus').textContent = `Rendering stem ${n + 1} of ${used.length}: ${KINDS[i].name}…`;
      const ch = await renderBeat(seq, i, false, rate);
      download(wavBlob(ch, rate, bits), `${baseName()}_${n + 1}-${fileSafe(KINDS[i].name)}.wav`);
      await sleep(500);
    }
    exBusy(false, `Exported ${used.length} stems. If your browser asks, allow multiple downloads. Line them all up at bar 1 in your DAW.`);
  } catch (e) { exBusy(false, 'Export failed: ' + e.message); }
});
$('#exMidi').addEventListener('click', () => {
  const seq = exportSeq(), PPQ = 96, S16 = 24, sw = Math.round((P.swing - 50) / 50 * S16);
  const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const txt = (type, s) => { const b = [...new TextEncoder().encode(s)]; return [0xff, type, ...vlq(b.length), ...b]; };
  const trk = (name, evs) => {
    evs.sort((a, b) => a.tick - b.tick || ((a.data[0] & 0xf0) === 0x80 ? -1 : 1));
    let last = 0; const bytes = [0, ...txt(3, name)];
    evs.forEach(e => { bytes.push(...vlq(e.tick - last), ...e.data); last = e.tick; });
    bytes.push(0, 0xff, 0x2f, 0); return [0x4d, 0x54, 0x72, 0x6b, ...u32(bytes.length), ...bytes];
  };
  const us = Math.round(60000000 / P.bpm), drums = [], bass = [], bassIdx = KINDS.length - 1, bassLen = Math.round(1.1 * P.tracks[bassIdx].decay * P.bpm / 60 * PPQ);
  let base = 0, bassOn = [];
  seq.forEach(pid => {
    const pat = P.patterns[pid];
    for (let s = 0; s < P.steps; s++) {
      const tk = base + s * S16 + (s % 2 ? sw : 0);
      pat.t.forEach((lane, i) => {
        if (!lane.on[s] || effGain(i) === 0) return;
        const vel = clamp(Math.round(lane.vel[s] * 127), 1, 127);
        if (i === bassIdx) bassOn.push({tk, m: clamp(lane.note[s] + P.tracks[i].tune, 0, 127), vel});
        else { const gm = KINDS[i].gm; drums.push({tick: tk, data: [0x99, gm, vel]}, {tick: tk + 12, data: [0x89, gm, 0]}); }
      });
    }
    base += P.steps * S16;
  });
  bassOn.forEach((b, k) => { const end = Math.min(b.tk + bassLen, k + 1 < bassOn.length ? bassOn[k + 1].tk : Infinity, base); bass.push({tick: b.tk, data: [0x90, b.m, b.vel]}, {tick: Math.max(b.tk + 1, end), data: [0x80, b.m, 0]}); });
  const tempo = trk(P.name, [{tick: 0, data: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255]}, {tick: 0, data: [0xff, 0x58, 4, 4, 2, 24, 8]}]);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 3, 0, PPQ];
  const bytes = new Uint8Array([...head, ...tempo, ...trk('Drums (GM, ch 10)', drums), ...trk('808 bass', bass)]);
  download(new Blob([bytes], {type: 'audio/midi'}), `${baseName()}.mid`);
  $('#exStatus').textContent = 'MIDI exported: tempo, drums on channel 10 (General MIDI drum map), 808 notes on channel 1.';
});

/* ---------------- projects ---------------- */
const listKey = 'beat.projects';
function renderProjList() {
  const names = store.get(listKey, []);
  $('#projList').innerHTML = names.length ? names.map(n => `<option>${esc(n)}</option>`).join('') : '<option value="">No saved projects yet</option>';
}
$('#projName').addEventListener('change', e => { P.name = e.target.value.trim() || 'My beat'; e.target.value = P.name; dirty(); });
$('#projSave').addEventListener('click', () => {
  P.name = $('#projName').value.trim() || 'My beat';
  const names = store.get(listKey, []), prev = store.get('beat.p:' + P.name, null);
  if (prev && prev.uid !== P.uid && !confirm(`A different project called "${P.name}" exists. Replace it?`)) return;
  if (!store.set('beat.p:' + P.name, P)) { toast('Browser storage is full. Download the project file instead.'); return; }
  if (!names.includes(P.name)) names.unshift(P.name);
  store.set(listKey, names); renderProjList(); $('#projList').value = P.name; dirty(); toast(`Saved "${P.name}"`);
});
$('#projNew').addEventListener('click', () => {
  if (!confirm('Start a new project? Save this one first if you want to keep it.')) return;
  stop(); P = defaultProject(); SMP.fill(null); refreshAll(); dirty(); toast('New empty project');
});
$('#projLoad').addEventListener('click', () => {
  const n = $('#projList').value; if (!n) return; const p = store.get('beat.p:' + n, null); if (!p) { toast('Could not open that project.'); return; }
  stop(); P = fixProject(p); refreshAll(); loadProjectSamples(); dirty(); toast(`Opened "${P.name}"`);
});
$('#projDel').addEventListener('click', () => {
  const n = $('#projList').value; if (!n || !confirm(`Delete the saved project "${n}"?`)) return;
  const p = store.get('beat.p:' + n, null);
  if (p && p.uid !== P.uid) KINDS.forEach((k, i) => idb.del(p.uid + ':' + i).catch(() => {}));
  store.del('beat.p:' + n); store.set(listKey, store.get(listKey, []).filter(x => x !== n)); renderProjList();
});
const b64 = {
  enc(ab) { const u = new Uint8Array(ab); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  dec(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
};
$('#projExport').addEventListener('click', () => {
  const out = JSON.parse(JSON.stringify(P)); out.samples = {};
  SMP.forEach((s, i) => { if (s) out.samples[i] = {name: s.name, data: b64.enc(s.raw)}; });
  download(new Blob([JSON.stringify(out)], {type: 'application/json'}), fileSafe(P.name) + '.beat.json');
});
$('#projImport').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text()); if (!data.patterns) throw new Error('not a beat project');
    stop(); P = fixProject(data); SMP.fill(null);
    for (const [i, s] of Object.entries(data.samples || {})) {
      try { const raw = b64.dec(s.data); SMP[+i] = {buf: await decode(raw), raw, name: s.name}; P.tracks[+i].sample = s.name; await idb.put(P.uid + ':' + i, {raw, name: s.name}); } catch (err) {}
    }
    refreshAll(); dirty(); toast(`Opened "${P.name}" from file`);
  } catch (err) { toast('That file is not a Beat project.'); }
});

/* ======================= FREQUENCY LAB ======================= */
const LDEF = {tone: {on: false, freq: 432, wave: 'sine', vol: .35}, beat: {on: false, mode: 'binaural', carrier: 200, rate: 10, vol: .35},
  pad: {on: false, root: 136.1, chord: 'fifth', warm: .45, breath: .4, vol: .35}, noise: {on: false, color: 'pink', soft: .3, wave: .3, vol: .25}, vol: .5, space: .25, timer: 0};
const LAYERS = ['tone', 'beat', 'pad', 'noise'];
const clone = o => JSON.parse(JSON.stringify(o));
let L = (() => { const s = store.get('beat.lab', null), d = clone(LDEF); if (s) { LAYERS.forEach(k => Object.assign(d[k], s[k] || {}, {on: false})); ['vol', 'space', 'timer'].forEach(k => { if (s[k] != null) d[k] = s[k]; }); } return d; })();
let labSaveT; const labDirty = () => { clearTimeout(labSaveT); labSaveT = setTimeout(() => store.set('beat.lab', L), 400); };
const lv = v => v * v;
const IMP = new WeakMap();
function impulse(ctx) {
  if (IMP.has(ctx)) return IMP.get(ctx);
  const n = Math.floor(ctx.sampleRate * 3.5), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2) * .5; }
  IMP.set(ctx, b); return b;
}
function labChain(ctx, dest) {
  const sum = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), conv = ctx.createConvolver(), out = ctx.createGain(), safe = ctx.createDynamicsCompressor();
  conv.buffer = impulse(ctx);
  safe.threshold.value = -3; safe.knee.value = 0; safe.ratio.value = 12; safe.attack.value = .003; safe.release.value = .2;
  sum.connect(dry); dry.connect(out); sum.connect(conv); conv.connect(wet); wet.connect(out); out.connect(safe); safe.connect(dest);
  return {sum, out, set(s, live) {
    const now = ctx.currentTime;
    dry.gain.value = 1 - s.space * .45; wet.gain.value = s.space * 1.2;
    if (live) out.gain.setTargetAtTime(lv(s.vol) * 4, now, .05); else out.gain.value = lv(s.vol) * 4;
  }};
}
const CHORDS = {drone: [1, 2], fifth: [1, 1.5, 2], major: [1, 1.25, 1.5, 2], minor: [1, 1.2, 1.5, 2], sus: [1, 4 / 3, 1.5, 2], harm: [1, 2, 3, 4, 5]};
function mkLfo(ctx, rate, depth, param, base) {
  param.value = base; const o = osc(ctx, 'sine', rate), g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return {o, g};
}
const layerKey = (k, s) => k === 'beat' ? 'beat:' + s.mode : k === 'pad' ? 'pad:' + s.chord : k === 'noise' ? 'noise:' + s.color : k;
function mkLayer(ctx, kind, s, dest, fadeIn) {
  const out = ctx.createGain(), now = ctx.currentTime, srcs = [], SCALE = {tone: .5, beat: .5, pad: .4, noise: .7}[kind];
  out.connect(dest);
  out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(lv(s.vol) * SCALE, now + fadeIn);
  const L2 = {key: layerKey(kind, s), srcs};
  const start = o => { o.start(); srcs.push(o); return o; };
  if (kind === 'tone') {
    const o = start(osc(ctx, s.wave, s.freq)), wg = ctx.createGain(); o.connect(wg); wg.connect(out);
    const trim = w => ({sine: 1, triangle: .9, square: .35, sawtooth: .45}[w]);
    wg.gain.value = trim(s.wave);
    L2.upd = (s, t) => { o.type = s.wave; wg.gain.value = trim(s.wave); o.frequency.setTargetAtTime(s.freq, t, .015); };
  } else if (kind === 'beat') {
    const a = start(osc(ctx, 'sine', s.carrier - s.rate / 2));
    if (s.mode !== 'isochronic') {
      const b = start(osc(ctx, 'sine', s.carrier + s.rate / 2));
      if (s.mode === 'binaural') { const m = ctx.createChannelMerger(2); a.connect(m, 0, 0); b.connect(m, 0, 1); m.connect(out); }
      else { const g = ctx.createGain(); g.gain.value = .5; a.connect(g); b.connect(g); g.connect(out); }
      L2.upd = (s, t) => { a.frequency.setTargetAtTime(s.carrier - s.rate / 2, t, .02); b.frequency.setTargetAtTime(s.carrier + s.rate / 2, t, .02); };
    } else { // isochronic: one tone pulsed on and off
      const am = ctx.createGain(), sh = ctx.createWaveShaper(), lg = ctx.createGain(), lfo = start(osc(ctx, 'sine', s.rate));
      a.frequency.value = s.carrier; sh.curve = shaperCurve(6); lg.gain.value = .5; am.gain.value = .5;
      lfo.connect(sh); sh.connect(lg); lg.connect(am.gain); a.connect(am); am.connect(out);
      L2.upd = (s, t) => { a.frequency.setTargetAtTime(s.carrier, t, .02); lfo.frequency.setTargetAtTime(s.rate, t, .02); };
    }
  } else if (kind === 'pad') {
    const ratios = CHORDS[s.chord], ws = ratios.map((r, i) => s.chord === 'harm' ? 1 / (i + 1) : (i === 0 ? 1 : .7)), tot = ws.reduce((x, y) => x + y, 0);
    const lp = filt(ctx, 'lowpass', 250 + Math.pow(1 - s.warm, 2) * 6000, .5), br = ctx.createGain(), oscs = [];
    ratios.forEach((r, i) => {
      const pg = ctx.createGain(); pg.gain.value = ws[i] / tot * .8; pg.connect(lp);
      [-5, 5].forEach(dt => { const o = start(osc(ctx, 'triangle', s.root * r)); o.detune.value = dt; o.connect(pg); oscs.push([o, r]); });
    });
    const lf = mkLfo(ctx, .07, s.breath * .45, br.gain, 1 - s.breath * .45); srcs.push(lf.o);
    lp.connect(br); br.connect(out);
    L2.upd = (s, t) => {
      oscs.forEach(([o, r]) => o.frequency.setTargetAtTime(s.root * r, t, .03));
      lp.frequency.setTargetAtTime(250 + Math.pow(1 - s.warm, 2) * 6000, t, .05);
      lf.g.gain.value = s.breath * .45; br.gain.value = 1 - s.breath * .45;
    };
  } else if (kind === 'noise') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, s.color === 'white' ? 'whiteS' : s.color); src.loop = true; start(src);
    const lp = filt(ctx, 'lowpass', 300 + Math.pow(1 - s.soft, 2) * 19000, .3), wv = ctx.createGain();
    const lf = mkLfo(ctx, .055, s.wave * .5, wv.gain, 1 - s.wave * .5); srcs.push(lf.o);
    src.connect(lp); lp.connect(wv); wv.connect(out);
    L2.upd = (s, t) => { lp.frequency.setTargetAtTime(300 + Math.pow(1 - s.soft, 2) * 19000, t, .05); lf.g.gain.value = s.wave * .5; wv.gain.value = 1 - s.wave * .5; };
  }
  L2.set = s => { const t = ctx.currentTime; L2.upd(s, t); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(lv(s.vol) * SCALE, t, .05); };
  L2.stop = () => {
    const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.setTargetAtTime(0, t, .12);
    srcs.forEach(o => { try { o.stop(t + 1); } catch (e) {} }); setTimeout(() => out.disconnect(), 1300);
  };
  return L2;
}
const LAB = {chain: null, layers: {}, started: null, ending: false};
function syncLab() {
  const anyOn = LAYERS.some(k => L[k].on);
  if (!anyOn && !Object.keys(LAB.layers).length) { LAB.started = null; layerUI(); return; }
  const ctx = ensureCtx();
  if (!LAB.chain) LAB.chain = labChain(ctx, A.an);
  if (!LAB.ending) LAB.chain.set(L, true);
  LAYERS.forEach(k => {
    let cur = LAB.layers[k]; const s = L[k];
    if (s.on) {
      if (cur && cur.key !== layerKey(k, s)) { cur.stop(); cur = null; }
      if (!cur) LAB.layers[k] = mkLayer(ctx, k, s, LAB.chain.sum, .6); else cur.set(s);
    } else if (cur) { cur.stop(); delete LAB.layers[k]; }
  });
  if (anyOn && LAB.started == null) LAB.started = ctx.currentTime;
  if (!anyOn) LAB.started = null;
  layerUI();
}
function layerUI() { LAYERS.forEach(k => { $(`#${k}On`).checked = L[k].on; $(`.layer[data-layer="${k}"]`).classList.toggle('live', L[k].on); }); }
function labStopAll() { LAYERS.forEach(k => L[k].on = false); LAB.ending = false; syncLab(); }

/* facts and lookups */
const logF = v => 20 * Math.pow(1000, v / 1000), unlogF = f => clamp(1000 * Math.log(f / 20) / Math.log(1000), 0, 1000);
function aWeight(f) { const f2 = f * f, ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)); return 20 * Math.log10(ra) + 2; }
const BANDS = [
  {lo: 20, hi: 60, name: 'Sub-bass', c: '#f783ac', what: '808s and kick fundamentals. Felt in the chest more than heard.', more: 'Rumble, distortion, speakers flapping; eats all your headroom.', less: 'Thin on big systems and in cars.'},
  {lo: 60, hi: 250, name: 'Bass', c: '#ff6b6b', what: 'Body of kick and bass, warmth of male voices, low piano.', more: 'Boomy, bloated, the mix sounds "heavy" and slow.', less: 'Weak, no punch, no warmth.'},
  {lo: 250, hi: 500, name: 'Low mids', c: '#ffa94d', what: 'Body of vocals, guitars, snare. The "mud zone".', more: 'Muddy, boxy, like a cardboard box.', less: 'Hollow and cold.'},
  {lo: 500, hi: 2000, name: 'Mids', c: '#ffd34d', what: 'The core of almost every instrument and voice. Phones play mostly this.', more: 'Honky, nasal, like an old telephone.', less: 'Scooped, distant, instruments lose their identity.'},
  {lo: 2000, hi: 4000, name: 'Upper mids', c: '#69db7c', what: 'Attack and clarity: consonants, guitar pick, snare crack. Your ears are most sensitive here.', more: 'Harsh, tiring, painful at volume.', less: 'Dull and unclear; words get lost.'},
  {lo: 4000, hi: 6000, name: 'Presence', c: '#3bc9db', what: 'Definition and closeness: makes a vocal sound "in front".', more: 'Piercing, edgy.', less: 'Vocal sits behind the music.'},
  {lo: 6000, hi: 20000, name: 'Brilliance & air', c: '#9775fa', what: 'Hi-hats, cymbals, shakers, "s" sounds (5–8 kHz) and air (10 kHz+).', more: 'Hissy, sibilant ("sss" stings).', less: 'Dull, lifeless, muffled.'},
];
function bandOf(f) { if (f < 20) return {name: 'Infrasound', what: 'Below hearing. Felt as vibration or pressure, not heard as pitch.'}; if (f > 20000) return {name: 'Ultrasound', what: 'Above human hearing.'}; return BANDS.find(b => f < b.hi) || BANDS[BANDS.length - 1]; }
const BRAIN = [
  {lo: 0, hi: 4, name: 'Delta', what: 'deep, dreamless sleep'}, {lo: 4, hi: 8, name: 'Theta', what: 'drowsiness, deep meditation, dreams'},
  {lo: 8, hi: 13, name: 'Alpha', what: 'relaxed and awake, calm focus'}, {lo: 13, hi: 30, name: 'Beta', what: 'alert, active thinking'}, {lo: 30, hi: 1e9, name: 'Gamma', what: 'intense focus and processing'}];
const brainOf = r => BRAIN.find(b => r < b.hi);
function nearestNote(f) {
  const m = 69 + 12 * Math.log2(f / P.tuning), n = Math.round(m);
  return {name: noteName(n), cents: Math.round((m - n) * 100), midi: n};
}
function updateToneFacts() {
  const f = L.tone.freq, nn = nearestNote(f), b = bandOf(f), aw = aWeight(f), per = 1000 / f, wl = 343 / f;
  const items = [
    ['Period', per >= 1 ? per.toFixed(per < 10 ? 2 : 1) + ' ms' : (per * 1000).toFixed(0) + ' µs', 'time for one cycle'],
    ['Wavelength', wl >= 1 ? wl.toFixed(2) + ' m' : (wl * 100).toFixed(1) + ' cm', 'length of one wave in air'],
    ['Nearest note', f >= 8 ? `${nn.name} ${nn.cents ? (nn.cents > 0 ? '+' : '') + nn.cents + '¢' : '(exact)'}` : '—', `at A4 = ${P.tuning} Hz`],
    ['Octaves', `${fmtHz(f / 2)} · ${fmtHz(f * 2)}`, 'same note, an octave down · up'],
    ['Mix band', b.name, b.lo ? `${fmtHz(b.lo)}–${fmtHz(b.hi)}` : ''],
    ['Ear sensitivity', f >= 20 && f <= 20000 ? (aw >= 0 ? '+' : '') + aw.toFixed(1) + ' dB' : '—', 'vs 1 kHz (A-weighting)'],
  ];
  let html = items.map(([k, v, s]) => `<div><span>${k}</span><b>${v}</b><span>${s}</span></div>`).join('');
  const pw = Math.pow(f / 1000, 2);
  html += `<div class="wide"><span>Energy</span><br>${b.what || ''} For the same speaker movement this tone carries <b style="display:inline">${pw >= 10 ? Math.round(pw) : pw >= .01 ? pw.toFixed(2) : pw.toExponential(1)}×</b> the power of a 1 kHz tone (power grows with frequency²), yet your ear hears it ${Math.abs(aw) < 1 ? 'about as loud as 1 kHz' : (aw < 0 ? `${(-aw).toFixed(0)} dB quieter` : `${aw.toFixed(0)} dB louder`)} at the same level.${f < 45 ? ` As a pulse rate, ${fmtHz(f)} is in the <b style="display:inline">${brainOf(f).name}</b> brainwave band (${brainOf(f).what}). To feel it, use the Brainwave beat layer with this as the beat rate.` : ''}</div>`;
  $('#toneFacts').innerHTML = html;
  if (f >= 16) { $('#toneNote').value = ((nn.midi % 12) + 12) % 12; $('#toneOct').value = clamp(Math.floor(nn.midi / 12) - 1, 0, 8); }
}
function updateBeatFacts() {
  const s = L.beat, b = brainOf(s.rate);
  $('#beatFacts').innerHTML = [
    ['Left ear', s.mode === 'isochronic' ? fmtHz(s.carrier) : fmtHz(s.carrier - s.rate / 2), s.mode === 'binaural' ? 'left channel only' : 'both channels'],
    ['Right ear', s.mode === 'isochronic' ? fmtHz(s.carrier) : fmtHz(s.carrier + s.rate / 2), s.mode === 'binaural' ? 'right channel only' : 'both channels'],
    ['Pulse', fmtHz(s.rate), `one pulse every ${(1000 / s.rate).toFixed(0)} ms`],
    ['Band', b.name, b.what],
  ].map(([k, v, x]) => `<div><span>${k}</span><b>${v}</b><span>${x}</span></div>`).join('') +
  (s.mode === 'binaural' ? '<div class="wide"><span>Headphones needed.</span> Each ear gets a different tone; your brain creates the beat. On speakers you will hear only a plain tone (or a faint wobble).</div>' : '');
  $$('#bandChips .chip').forEach(c => c.classList.toggle('on', Math.abs(+c.dataset.rate - s.rate) < .005));
}

/* lab UI wiring */
$('#toneNote').innerHTML = NOTE.map((n, i) => `<option value="${i}">${n}</option>`).join('');
$('#toneOct').innerHTML = Array.from({length: 9}, (_, o) => `<option value="${o}">${o}</option>`).join('');
const pct = v => Math.round(v * 100) + '%';
function setLab(path, v, opt = {}) {
  const [a, b] = path.split('.');
  if (b) L[a][b] = v; else L[a] = v;
  if (opt.on && b && !L[a].on) L[a].on = true;
  syncLab(); labDirty();
  if (a === 'tone') updateToneFacts();
  if (a === 'beat') updateBeatFacts();
}
function labToUI() {
  $('#toneFreq').value = +L.tone.freq.toFixed(2); $('#toneSlider').value = unlogF(L.tone.freq); $('#toneWave').value = L.tone.wave;
  $('#beatMode').value = L.beat.mode; $('#beatCarrier').value = L.beat.carrier; $('#beatCarrierR').value = L.beat.carrier; $('#beatRate').value = L.beat.rate; $('#beatRateR').value = L.beat.rate;
  $('#padRoot').value = L.pad.root; $('#padChord').value = L.pad.chord; $('#noiseColor').value = L.noise.color;
  [['toneVol', 'tone.vol'], ['beatVol', 'beat.vol'], ['padWarm', 'pad.warm'], ['padBreath', 'pad.breath'], ['padVol', 'pad.vol'], ['noiseSoft', 'noise.soft'], ['noiseWave', 'noise.wave'], ['noiseVol', 'noise.vol'], ['labVol', 'vol'], ['labSpace', 'space']]
    .forEach(([id, p]) => { const [a, b] = p.split('.'), v = b ? L[a][b] : L[a], el = $('#' + id); el.value = v; el.nextElementSibling.textContent = pct(v); });
  $('#labTimer').value = L.timer;
  updateToneFacts(); updateBeatFacts(); layerUI();
}
// sliders with % outputs
[['toneVol', 'tone.vol'], ['beatVol', 'beat.vol'], ['padWarm', 'pad.warm'], ['padBreath', 'pad.breath'], ['padVol', 'pad.vol'], ['noiseSoft', 'noise.soft'], ['noiseWave', 'noise.wave'], ['noiseVol', 'noise.vol'], ['labVol', 'vol'], ['labSpace', 'space']]
  .forEach(([id, p]) => $('#' + id).addEventListener('input', e => { e.target.nextElementSibling.textContent = pct(+e.target.value); setLab(p, +e.target.value); }));
LAYERS.forEach(k => $(`#${k}On`).addEventListener('change', e => { L[k].on = e.target.checked; LAB.ending = false; syncLab(); }));
function setToneFreq(f, fromSlider) {
  f = clamp(Math.round(f * 100) / 100, 1, 20000);
  $('#toneFreq').value = f; if (!fromSlider) $('#toneSlider').value = unlogF(f);
  setLab('tone.freq', f);
}
$('#toneFreq').addEventListener('input', e => { const f = +e.target.value; if (f >= 1 && f <= 20000) { $('#toneSlider').value = unlogF(f); setLab('tone.freq', f); } });
$('#toneFreq').addEventListener('change', e => setToneFreq(+e.target.value || 432));
$('#toneSlider').addEventListener('input', e => { const v = +e.target.value, f = logF(v); setToneFreq(f >= 100 ? Math.round(f) : Math.round(f * 10) / 10, true); });
$$('[data-nudge]').forEach(b => b.addEventListener('click', () => setToneFreq(L.tone.freq + +b.dataset.nudge)));
$$('[data-oct]').forEach(b => b.addEventListener('click', () => setToneFreq(L.tone.freq * +b.dataset.oct)));
$('#toneWave').addEventListener('change', e => setLab('tone.wave', e.target.value));
const noteToFreq = () => P.tuning * Math.pow(2, ((+$('#toneOct').value + 1) * 12 + +$('#toneNote').value - 69) / 12);
$('#toneNote').addEventListener('change', () => setToneFreq(noteToFreq()));
$('#toneOct').addEventListener('change', () => setToneFreq(noteToFreq()));
$('#beatMode').addEventListener('change', e => setLab('beat.mode', e.target.value));
[['beatCarrier', 'beatCarrierR', 'beat.carrier', 40, 1000], ['beatRate', 'beatRateR', 'beat.rate', .5, 45]].forEach(([n, r, p, lo, hi]) => {
  $('#' + n).addEventListener('change', e => { const v = clamp(+e.target.value || lo, lo, hi); e.target.value = v; $('#' + r).value = v; setLab(p, v); });
  $('#' + r).addEventListener('input', e => { const v = +e.target.value; $('#' + n).value = v; setLab(p, v); });
});
$('#bandChips').innerHTML = [['Delta · 2 Hz', 2], ['Theta · 6 Hz', 6], ['Schumann · 7.83 Hz', 7.83], ['Alpha · 10 Hz', 10], ['Beta · 18 Hz', 18], ['Gamma · 40 Hz', 40]]
  .map(([n, r]) => `<button class="chip" data-rate="${r}">${n}</button>`).join('');
$('#bandChips').addEventListener('click', e => { const c = e.target.closest('[data-rate]'); if (!c) return; const r = +c.dataset.rate; $('#beatRate').value = r; $('#beatRateR').value = r; setLab('beat.rate', r, {on: true}); });
$('#padRoot').addEventListener('change', e => { const v = clamp(+e.target.value || 136.1, 20, 2000); e.target.value = v; setLab('pad.root', v); });
$('#padFromTone').addEventListener('click', () => { let f = L.tone.freq; while (f > 600) f /= 2; while (f < 40) f *= 2; f = Math.round(f * 100) / 100; $('#padRoot').value = f; setLab('pad.root', f); toast(`Pad root set to ${fmtHz(f)} (same note as the tone${f !== L.tone.freq ? ', moved by octaves' : ''})`); });
$('#padChord').addEventListener('change', e => setLab('pad.chord', e.target.value));
$('#noiseColor').addEventListener('change', e => setLab('noise.color', e.target.value));
$('#labStop').addEventListener('click', labStopAll);
$('#labTimer').addEventListener('change', e => { L.timer = +e.target.value; labDirty(); if (LAB.started != null) LAB.started = A.ctx.currentTime; });

/* intent presets */
const INTENTS = [
  {name: 'Deep sleep', note: 'Delta 2 Hz binaural beat on a low 100 Hz carrier, warm low drone and soft brown noise. Use headphones, keep it quiet, set the timer.',
    s: {tone: {on: false}, beat: {on: true, mode: 'binaural', carrier: 100, rate: 2, vol: .3}, pad: {on: true, root: 98, chord: 'drone', warm: .8, breath: .6, vol: .25}, noise: {on: true, color: 'brown', soft: .6, wave: .5, vol: .3}, space: .35, timer: 30}},
  {name: 'Meditation (Om)', note: 'Natural harmonics of 136.1 Hz (the "Om" or Earth-year tone used for tanpuras and singing bowls) with a theta 6 Hz binaural beat.',
    s: {tone: {on: false}, beat: {on: true, mode: 'binaural', carrier: 136.1, rate: 6, vol: .3}, pad: {on: true, root: 136.1, chord: 'harm', warm: .6, breath: .5, vol: .35}, noise: {on: true, color: 'pink', soft: .6, wave: .4, vol: .12}, space: .45, timer: 20}},
  {name: 'Relax & soothe', note: 'A major pad on A = 216 Hz (432 tuning), alpha 10 Hz beat and gentle pink rain. Relaxed but awake.',
    s: {tone: {on: false}, beat: {on: true, mode: 'binaural', carrier: 216, rate: 10, vol: .25}, pad: {on: true, root: 216, chord: 'major', warm: .55, breath: .45, vol: .3}, noise: {on: true, color: 'pink', soft: .5, wave: .35, vol: .18}, space: .4, timer: 15}},
  {name: 'Healing (528 Hz)', note: '528 Hz is the Solfeggio tone traditionally linked to healing and "love". Soft sine plus an open-fifth pad an octave below and a theta 5 Hz pulse. Tradition, not proven medicine; let it be a calm space.',
    s: {tone: {on: true, freq: 528, wave: 'sine', vol: .2}, beat: {on: true, mode: 'binaural', carrier: 264, rate: 5, vol: .25}, pad: {on: true, root: 132, chord: 'fifth', warm: .6, breath: .5, vol: .3}, noise: {on: false}, space: .5, timer: 15}},
  {name: 'Manifestation', note: 'Traditional pairing of 528 Hz (transformation) and 963 Hz (the "crown" tone) over a 7.83 Hz Schumann pulse. Combine it with your own intention, breathing and visualisation.',
    s: {tone: {on: true, freq: 963, wave: 'sine', vol: .12}, beat: {on: true, mode: 'isochronic', carrier: 528, rate: 7.83, vol: .18}, pad: {on: true, root: 264, chord: 'sus', warm: .55, breath: .55, vol: .3}, noise: {on: false}, space: .55, timer: 15}},
  {name: 'Grounding (7.83 Hz)', note: 'Schumann resonance rate as a binaural beat on 136.1 Hz, with brown noise like distant waves.',
    s: {tone: {on: false}, beat: {on: true, mode: 'binaural', carrier: 136.1, rate: 7.83, vol: .3}, pad: {on: true, root: 68.05, chord: 'drone', warm: .75, breath: .5, vol: .25}, noise: {on: true, color: 'brown', soft: .5, wave: .5, vol: .25}, space: .35, timer: 15}},
  {name: 'Study focus', note: 'Beta 16 Hz monaural beat (works on speakers) with pink noise to mask distractions.',
    s: {tone: {on: false}, beat: {on: true, mode: 'monaural', carrier: 220, rate: 16, vol: .2}, pad: {on: false}, noise: {on: true, color: 'pink', soft: .35, wave: .15, vol: .25}, space: .15, timer: 30}},
  {name: '40 Hz gamma', note: '40 Hz isochronic pulse: the rate used in current brain-health research. Low volume; avoid if you have epilepsy.',
    s: {tone: {on: false}, beat: {on: true, mode: 'isochronic', carrier: 440, rate: 40, vol: .2}, pad: {on: false}, noise: {on: true, color: 'pink', soft: .5, wave: 0, vol: .15}, space: .1, timer: 10}},
];
$('#intentChips').innerHTML = INTENTS.map((p, i) => `<button class="chip" data-intent="${i}">${p.name}</button>`).join('');
$('#intentChips').addEventListener('click', e => {
  const c = e.target.closest('[data-intent]'); if (!c) return; const p = INTENTS[+c.dataset.intent];
  LAYERS.forEach(k => Object.assign(L[k], p.s[k] || {on: false}));
  ['space', 'timer'].forEach(k => { if (p.s[k] != null) L[k] = p.s[k]; });
  $$('#intentChips .chip').forEach(x => x.classList.toggle('on', x === c));
  $('#intentNote').textContent = p.note;
  LAB.ending = false; LAB.started = null; labToUI(); syncLab(); labDirty();
});

/* frequency library */
const LIB = [
  {hz: 2, name: 'Delta', cat: 'Brainwave', use: 'Deep sleep, rest and recovery.', ev: 'Delta waves dominate deep sleep on EEG. Delta beats may help some people relax toward sleep; evidence is mixed.', as: 'beat'},
  {hz: 6, name: 'Theta', cat: 'Brainwave', use: 'Deep meditation, creativity, dreamlike states.', ev: 'Theta rises in drowsiness and experienced meditators. Beat studies show small, inconsistent effects.', as: 'beat'},
  {hz: 7.83, name: 'Schumann resonance', cat: 'Nature & research', use: 'Grounding, feeling "in tune with the Earth".', ev: 'A real electromagnetic resonance between Earth and the ionosphere (not a sound). Health effects of listening to it are not established.', as: 'beat'},
  {hz: 10, name: 'Alpha', cat: 'Brainwave', use: 'Calm, relaxed alertness, stress relief.', ev: 'Alpha appears when relaxed with eyes closed. Some studies find reduced anxiety with alpha/theta beats.', as: 'beat'},
  {hz: 18, name: 'Beta', cat: 'Brainwave', use: 'Focus, alertness, studying.', ev: 'Beta is normal waking thought. Effects of beta beats on attention are small and variable.', as: 'beat'},
  {hz: 40, name: 'Gamma (40 Hz)', cat: 'Nature & research', use: 'Focus; studied for brain health and memory.', ev: 'Active research: 40 Hz light and sound stimulation reduced Alzheimer\'s markers in mice; early human trials are ongoing. Not a treatment yet.', as: 'beat'},
  {hz: 136.1, name: 'Om / Earth year tone', cat: 'Tuning & tradition', use: 'Yoga, chanting, tanpura and singing-bowl tuning.', ev: 'Calculated by Hans Cousto from the Earth\'s orbit, shifted up 32 octaves. Meaningful in practice; no special physiological effect shown.', as: 'tone'},
  {hz: 174, name: 'Solfeggio 174', cat: 'Solfeggio', use: 'Traditionally: pain relief, sense of safety.', ev: 'The Solfeggio set was popularised in the 1970s–90s from numerology. No controlled evidence for specific effects.', as: 'tone'},
  {hz: 285, name: 'Solfeggio 285', cat: 'Solfeggio', use: 'Traditionally: tissue and energy-field restoration.', ev: 'Tradition only; not tested in controlled trials.', as: 'tone'},
  {hz: 396, name: 'Solfeggio 396 (UT)', cat: 'Solfeggio', use: 'Traditionally: releasing fear and guilt.', ev: 'Tradition only. Any calming effect is likely shared with other soft, steady tones.', as: 'tone'},
  {hz: 417, name: 'Solfeggio 417 (RE)', cat: 'Solfeggio', use: 'Traditionally: undoing situations, facilitating change.', ev: 'Tradition only.', as: 'tone'},
  {hz: 528, name: 'Solfeggio 528 (MI)', cat: 'Solfeggio', use: 'Traditionally: "love frequency", transformation, healing.', ev: 'A few small early studies report relaxation; claims of DNA repair are not supported.', as: 'tone'},
  {hz: 639, name: 'Solfeggio 639 (FA)', cat: 'Solfeggio', use: 'Traditionally: connection and relationships.', ev: 'Tradition only.', as: 'tone'},
  {hz: 741, name: 'Solfeggio 741 (SOL)', cat: 'Solfeggio', use: 'Traditionally: expression, cleansing.', ev: 'Tradition only.', as: 'tone'},
  {hz: 852, name: 'Solfeggio 852 (LA)', cat: 'Solfeggio', use: 'Traditionally: intuition, spiritual order.', ev: 'Tradition only.', as: 'tone'},
  {hz: 963, name: 'Solfeggio 963', cat: 'Solfeggio', use: 'Traditionally: oneness, the "crown".', ev: 'Tradition only.', as: 'tone'},
  {hz: 432, name: 'A = 432 Hz tuning', cat: 'Tuning & tradition', use: 'Tuning music "warmer" and "natural".', ev: 'Many listeners prefer it; blind tests show little difference from 440. It is a tuning choice, not a healing switch.', as: 'tuning'},
  {hz: 440, name: 'A = 440 Hz (concert pitch)', cat: 'Tuning & tradition', use: 'World standard for tuning instruments.', ev: 'Set by the ISO 16 standard. Every DAW and tuner assumes it unless changed.', as: 'tuning'},
  {hz: 256, name: 'C = 256 Hz ("scientific pitch")', cat: 'Tuning & tradition', use: 'Older tuning where every C is a power of two (A ≈ 430.5).', ev: 'Mathematically neat; used in physics teaching and by some tuning-fork therapists.', as: 'tone'},
  {hz: 50, name: 'Mains hum (Ghana, Europe)', cat: 'Engineering', use: 'The buzz from power lines and bad cables. 60 Hz in the Americas.', ev: 'Measurable. Engineers notch it out with a narrow EQ cut at 50 Hz and its harmonics (100, 150 Hz).', as: 'tone'},
  {hz: 1000, name: '1 kHz test tone', cat: 'Engineering', use: 'Calibrating levels between gear and checking signal paths.', ev: 'The reference frequency for most audio specs and the A-weighting curve.', as: 'tone'},
  {hz: 0, name: 'Pink noise', cat: 'Nature & research', use: 'Sleep, masking noise, tuning speakers and rooms.', ev: 'Some studies link pink noise during sleep with deeper slow-wave sleep and better memory. Engineers use it to balance mixes.', as: 'noise'},
];
const LCATS = ['All', 'Brainwave', 'Solfeggio', 'Tuning & tradition', 'Nature & research', 'Engineering'];
let libCat = 'All';
function renderLib() {
  $('#libFilter').innerHTML = LCATS.map(c => `<button class="chip${c === libCat ? ' on' : ''}" data-cat="${c}">${c}</button>`).join('');
  $('#libTable tbody').innerHTML = LIB.map((x, i) => [x, i]).filter(([x]) => libCat === 'All' || x.cat === libCat).map(([x, i]) =>
    `<tr><td>${x.hz ? fmtHz(x.hz) : '—'}</td><td>${esc(x.name)}<br><span class="tag">${x.cat}</span></td><td>${esc(x.use)}</td><td>${esc(x.ev)}</td><td><button class="btn" data-lib="${i}">${{beat: 'Play as beat', tone: 'Play tone', tuning: 'Use tuning', noise: 'Play noise'}[x.as]}</button></td></tr>`).join('');
}
$('#libFilter').addEventListener('click', e => { const c = e.target.closest('[data-cat]'); if (c) { libCat = c.dataset.cat; renderLib(); } });
$('#libTable').addEventListener('click', e => {
  const b = e.target.closest('[data-lib]'); if (!b) return; const x = LIB[+b.dataset.lib];
  if (x.as === 'tone') { setToneFreq(x.hz); setLab('tone.on', true); toast(`Tone layer: ${fmtHz(x.hz)}`); }
  else if (x.as === 'beat') { $('#beatRate').value = x.hz; $('#beatRateR').value = Math.min(45, x.hz); L.beat.rate = x.hz; setLab('beat.on', true); toast(`Brainwave beat: ${fmtHz(x.hz)} on a ${fmtHz(L.beat.carrier)} carrier`); }
  else if (x.as === 'tuning') { setTuning(x.hz); if (L.tone.freq) setToneFreq(x.hz); setLab('tone.on', true); }
  else if (x.as === 'noise') { $('#noiseColor').value = 'pink'; L.noise.color = 'pink'; setLab('noise.on', true); }
  $('#lab').scrollIntoView({behavior: 'smooth'});
});

/* my frequencies */
function renderMine() {
  const list = store.get('beat.labMine', []);
  $('#mineList').innerHTML = list.length ? list.map((m, i) => `<li><span title="${esc(m.name)}">${esc(m.name)}</span><button class="btn" data-mload="${i}">Play</button><button class="btn" data-mdel="${i}" aria-label="Delete ${esc(m.name)}">✕</button></li>`).join('')
    : '<li class="mute small">Nothing saved yet. Build a sound with the layers above and save it here.</li>';
}
$('#mineSave').addEventListener('click', () => {
  const name = $('#mineName').value.trim(); if (!name) { $('#mineName').focus(); toast('Give your sound a name first.'); return; }
  const list = store.get('beat.labMine', []); list.unshift({name, s: clone(L)}); store.set('beat.labMine', list.slice(0, 50)); $('#mineName').value = ''; renderMine(); toast(`Saved "${name}"`);
});
$('#mineList').addEventListener('click', e => {
  const list = store.get('beat.labMine', []), l = e.target.closest('[data-mload]'), d = e.target.closest('[data-mdel]');
  if (l) { const s = list[+l.dataset.mload].s; LAYERS.forEach(k => Object.assign(L[k], s[k])); ['vol', 'space', 'timer'].forEach(k => L[k] = s[k]); LAB.ending = false; LAB.started = null; labToUI(); syncLab(); labDirty(); }
  if (d && confirm(`Delete "${list[+d.dataset.mdel].name}"?`)) { list.splice(+d.dataset.mdel, 1); store.set('beat.labMine', list); renderMine(); }
});

/* record the session */
$('#sesExport').addEventListener('click', async () => {
  const on = LAYERS.filter(k => L[k].on); if (!on.length) { toast('Switch on at least one layer first.'); return; }
  const min = +$('#sesLen').value, fade = +$('#sesFade').value, rate = 44100, dur = min * 60;
  const btn = $('#sesExport'); btn.disabled = true; $('#sesStatus').textContent = `Rendering ${min} min… this can take a little while.`;
  try {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, ctx = new OAC(2, dur * rate, rate), ch = labChain(ctx, ctx.destination);
    ch.set(L, false); const v = ch.out.gain.value;
    ch.out.gain.setValueAtTime(0, 0); ch.out.gain.linearRampToValueAtTime(v, fade); ch.out.gain.setValueAtTime(v, dur - fade); ch.out.gain.linearRampToValueAtTime(0, dur);
    on.forEach(k => mkLayer(ctx, k, L[k], ch.sum, .01));
    const buf = await ctx.startRendering(), chans = [buf.getChannelData(0), buf.getChannelData(1)];
    let pk = 0; chans.forEach(d => { for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } });
    if (pk > 1e-5) { const g = Math.pow(10, -3 / 20) / pk; chans.forEach(d => { for (let i = 0; i < d.length; i++) d[i] *= g; }); } // normalise to -3 dBFS peak
    const desc = on.map(k => k === 'tone' ? fmtHz(L.tone.freq) : k === 'beat' ? `${L.beat.mode} ${fmtHz(L.beat.rate)}` : k === 'pad' ? `pad ${fmtHz(L.pad.root)}` : `${L.noise.color} noise`).join(', ');
    download(wavBlob(chans, rate, 16), `session_${fileSafe(desc)}_${min}min.wav`);
    $('#sesStatus').textContent = `Exported ${min} min: ${desc}. Levelled to a -3 dBFS peak, so set your playback volume low first.`;
  } catch (e) { $('#sesStatus').textContent = 'Could not render that length on this device. Try a shorter one. (' + e.message + ')'; }
  btn.disabled = false;
});

/* ======================= LEARN ======================= */
let testSnd = null;
function stopTest() { if (testSnd) { try { testSnd.stop(); } catch (e) {} testSnd = null; } }
function playBand(lo, hi, dur = 2.5) {
  const ctx = ensureCtx(); stopTest();
  const t = ctx.currentTime + .02, src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 'pink'); src.loop = true;
  let node = src;
  [['highpass', lo], ['highpass', lo], ['lowpass', hi], ['lowpass', hi]].forEach(([ty, f]) => { const b = filt(ctx, ty, f, .707); node.connect(b); node = b; });
  const g = ctx.createGain(), lvl = .5 * clamp(Math.sqrt(4 / Math.log2(hi / lo)), .7, 2.5);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + .08); g.gain.setValueAtTime(lvl, t + dur - .15); g.gain.linearRampToValueAtTime(0, t + dur);
  node.connect(g); g.connect(A.an); src.start(t); src.stop(t + dur + .05); testSnd = src;
}
function playSine(f, dur = .9, vol = .25) {
  const ctx = ensureCtx(); stopTest();
  const t = ctx.currentTime + .02, o = osc(ctx, 'sine', f), g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .03); g.gain.setValueAtTime(vol, t + dur - .12); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(A.an); o.start(t); o.stop(t + dur + .05); testSnd = o;
}
$('#bandList').innerHTML = BANDS.map((b, i) => `<div class="band" style="--c:${b.c}"><div><b>${b.name}</b><small>${fmtHz(b.lo)} – ${fmtHz(b.hi)}</small></div>
  <p>${b.what}<br><span class="mute">Too much: ${b.more} Too little: ${b.less}</span></p><button class="btn" data-band="${i}">Hear it</button></div>`).join('');
$('#bandList').addEventListener('click', e => { const b = e.target.closest('[data-band]'); if (b) { const x = BANDS[+b.dataset.band]; playBand(x.lo, x.hi); } });

const EAR = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], EARL = ['63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const ear = {cur: null, done: false, right: 0, total: 0};
$('#earBtns').innerHTML = EAR.map((f, i) => `<button class="chip" data-ear="${i}">${EARL[i]} Hz</button>`).join('');
function earPlay() {
  if (ear.cur == null) return;
  const f = EAR[ear.cur];
  if ($('#earMode').value === 'tone') { const comp = clamp(Math.pow(10, -aWeight(f) / 40), 1, 2.5); playSine(f, 1.4, .16 * comp); }
  else {
    const ctx = ensureCtx(); stopTest();
    const t = ctx.currentTime + .02, src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 'pink'); src.loop = true;
    const pk = filt(ctx, 'peaking', f, 1.4), g = ctx.createGain();
    pk.gain.setValueAtTime(0, t); pk.gain.setValueAtTime(12, t + 1.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .05); g.gain.setValueAtTime(.3, t + 3.1); g.gain.linearRampToValueAtTime(0, t + 3.3);
    src.connect(pk); pk.connect(g); g.connect(A.an); src.start(t); src.stop(t + 3.4); testSnd = src;
    $('#earMsg').textContent = 'First 1.3 s flat, then one band boosted by 12 dB. Which one?';
  }
}
$('#earPlay').addEventListener('click', () => {
  let n; do { n = Math.floor(Math.random() * EAR.length); } while (n === ear.cur && EAR.length > 1);
  ear.cur = n; ear.done = false; $$('#earBtns .chip').forEach(c => c.classList.remove('right', 'wrong'));
  $('#earMsg').textContent = $('#earMode').value === 'tone' ? 'Which frequency was that?' : ''; earPlay();
});
$('#earAgain').addEventListener('click', earPlay);
$('#earBtns').addEventListener('click', e => {
  const c = e.target.closest('[data-ear]'); if (!c) return; const i = +c.dataset.ear;
  if (ear.cur == null) { playSine(EAR[i], .9, .16 * clamp(Math.pow(10, -aWeight(EAR[i]) / 40), 1, 2.5)); $('#earMsg').textContent = `That was ${EARL[i]} Hz. Press "Play a mystery sound" to start the quiz.`; return; }
  if (ear.done) return;
  ear.done = true; ear.total++;
  const ok = i === ear.cur; if (ok) ear.right++;
  c.classList.add(ok ? 'right' : 'wrong'); if (!ok) $$('#earBtns .chip')[ear.cur].classList.add('right');
  const off = Math.abs(i - ear.cur);
  $('#earMsg').textContent = ok ? `Correct: ${EARL[ear.cur]} Hz.` : `It was ${EARL[ear.cur]} Hz. You were ${off} octave${off > 1 ? 's' : ''} ${i > ear.cur ? 'too high' : 'too low'}${off === 1 ? ': very close' : ''}.`;
  $('#earScore').textContent = `Score: ${ear.right} / ${ear.total}`;
});

function renderNoteTable() {
  let h = '<tr><th>Oct</th>' + NOTE.map(n => `<th>${n}</th>`).join('') + '</tr>';
  for (let o = 0; o <= 8; o++) {
    h += `<tr><th>${o}</th>`;
    for (let n = 0; n < 12; n++) { const m = (o + 1) * 12 + n, f = midiF(m); h += `<td data-f="${f}" class="${m === 69 ? 'a4' : ''}" title="${NOTE[n]}${o}">${f < 100 ? f.toFixed(2) : f.toFixed(1)}</td>`; }
    h += '</tr>';
  }
  $('#noteTable').innerHTML = h;
}
$('#noteTable').addEventListener('click', e => { const td = e.target.closest('td[data-f]'); if (td) playSine(+td.dataset.f, .9, .2 * clamp(Math.pow(10, -aWeight(+td.dataset.f) / 40), 1, 2.5)); });
$$('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showTab(a.dataset.goto); }));

/* ======================= tabs, scopes, meter ======================= */
function showTab(id) {
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id));
  $$('.panel').forEach(p => { const on = p.id === id; p.hidden = !on; p.classList.toggle('on', on); });
  try { history.replaceState(null, '', '#' + id); } catch (e) {}
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const bs = $$('.tabs button'), i = bs.indexOf(document.activeElement); if (i < 0) return;
  const n = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length]; n.focus(); n.click();
});
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat) return;
  const t = e.target; if (t.closest('input, select, textarea, [contenteditable]')) return;
  if ($('#maker').hidden) return;
  e.preventDefault(); SQ.on ? stop() : play();
});

const GRIDF = [[50, '50'], [100, '100'], [200, '200'], [500, '500'], [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k']];
function drawScope(cv, withWave) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const fx = f => Math.log(f / 20) / Math.log(1000) * w;
  BANDS.forEach((b, i) => { if (i % 2) { g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(fx(b.lo), 0, fx(b.hi) - fx(b.lo), h); } });
  g.font = '10px system-ui, sans-serif'; g.fillStyle = '#5f6b84'; g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  GRIDF.forEach(([f, l]) => { const x = Math.round(fx(f)) + .5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.fillText(l, x + 3, h - 4); });
  if (!A.ctx) { g.fillStyle = '#5f6b84'; g.fillText('Press play to see the sound', 10, 16); return; }
  const FD = A.FD, sr = A.ctx.sampleRate, bins = FD.length, top = 14;
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) {
    const f0 = 20 * Math.pow(1000, x / w), f1 = 20 * Math.pow(1000, (x + 2) / w);
    let b0 = Math.floor(f0 / sr * 2 * bins), b1 = Math.max(b0, Math.floor(f1 / sr * 2 * bins)), m = -200;
    for (let b = b0; b <= b1 && b < bins; b++) if (FD[b] > m) m = FD[b];
    g.lineTo(x, h - clamp((m + 100) / 90, 0, 1) * (h - top));
  }
  g.lineTo(w, h); g.closePath();
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(212,160,23,.9)'); grd.addColorStop(1, 'rgba(212,160,23,.08)');
  g.fillStyle = grd; g.fill();
  if (withWave) {
    const TD = A.TD; let s = 1; while (s < TD.length / 2 && !(TD[s - 1] < 0 && TD[s] >= 0)) s++;
    const n = Math.min(2048, TD.length - s); g.beginPath(); g.strokeStyle = 'rgba(232,236,243,.7)'; g.lineWidth = 1.5;
    for (let i = 0; i < n; i++) { const x = i / n * w, y = h * .32 - TD[s + i] * h * .28; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    // dominant frequency readout
    let pb = 0, pv = -200; const lo = Math.ceil(18 / sr * 2 * bins);
    for (let b = lo; b < bins; b++) if (FD[b] > pv) { pv = FD[b]; pb = b; }
    if (pv > -75 && pb > 0 && pb < bins - 1) {
      const a = FD[pb - 1], c = FD[pb + 1], d = (a - c) / (2 * (a - 2 * pv + c)) || 0, f = (pb + clamp(d, -.5, .5)) * sr / 2 / bins;
      g.fillStyle = '#e8ecf3'; g.font = '600 12px system-ui, sans-serif'; g.fillText(`Strongest: ≈ ${fmtHz(f < 100 ? Math.round(f * 10) / 10 : Math.round(f))}  ·  ${(pv).toFixed(0)} dB`, 10, 16);
    }
  }
}
let peakHold = -100, peakT = 0;
function frame() {
  requestAnimationFrame(frame);
  if (A.ctx) {
    A.an.getFloatFrequencyData(A.FD); A.an.getFloatTimeDomainData(A.TD);
    let pk = 0; for (let i = 0; i < A.TD.length; i++) { const v = Math.abs(A.TD[i]); if (v > pk) pk = v; }
    const db = pk > 0 ? 20 * Math.log10(pk) : -100, now = performance.now();
    if (db >= peakHold || now - peakT > 1500) { peakHold = db; peakT = now; }
    $('#meterFill').style.width = clamp((db + 60) / 60, 0, 1) * 100 + '%';
    $('#meterPeak').style.left = `calc(${clamp((peakHold + 60) / 60, 0, 1) * 100}% - 2px)`;
    $('#meterTxt').textContent = peakHold > -60 ? peakHold.toFixed(1) : '-∞';
    // playhead
    let last = null; while (SQ.q.length && SQ.q[0].t <= A.ctx.currentTime) last = SQ.q.shift();
    if (last && SQ.on) { markStep(last.pid === P.cur ? last.s : -1); markPlayingPat(P.mode === 'song' ? last.pid : null); }
    // lab clock and timer
    if (LAB.started != null) {
      const el = A.ctx.currentTime - LAB.started, mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      if (L.timer > 0) {
        const left = L.timer * 60 - el;
        $('#labClock').textContent = left > 0 ? `Stops in ${mmss(left)}` : 'Fading out…';
        if (left <= 0 && !LAB.ending) {
          LAB.ending = true; LAB.chain.out.gain.setTargetAtTime(0, A.ctx.currentTime, 2.5);
          setTimeout(() => {
            if (!LAB.ending) return;
            LAYERS.forEach(k => L[k].on = false); syncLab();
            setTimeout(() => { if (!LAB.ending) return; LAB.ending = false; if (LAB.chain) LAB.chain.set(L, true); }, 1500);
          }, 9000);
        }
      } else $('#labClock').textContent = `Playing ${mmss(el)}`;
    } else $('#labClock').textContent = '';
  }
  if (!$('#maker').hidden) drawScope($('#beatScope'), false);
  if (!$('#lab').hidden) drawScope($('#labScope'), true);
}

/* ---------------- start ---------------- */
refreshAll(); renderProjList(); loadProjectSamples();
labToUI(); renderLib(); renderMine(); renderNoteTable();
{ const h = location.hash.slice(1); if (['maker', 'lab', 'learn'].includes(h)) showTab(h); }
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (!document.hidden && A.ctx && A.ctx.state === 'suspended' && (SQ.on || LAB.started != null)) A.ctx.resume(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
