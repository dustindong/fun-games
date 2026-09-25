/* Order Up! question engine.
   Loaded by order-up/index.html after the data files in order-up/data/, and by tests under node.

   HOW CONTENT IS ORGANIZED
   - A DATASET is one pool of items (songs, movies, dog breeds...) where each item is stored once with several
     attributes, plus a list of COMPARISONS that say how to rank items by one attribute. Datasets live in
     order-up/data/*.js and register themselves with OrderUpData.push({...}). See data/README.md for the format.
   - Every (dataset, comparison) pair becomes a VIEW: the flat topic shape the game renders and scores
     (title, ask, hi/lo labels, unit, gap, and a list of {id, name, note, v} for the items that have that
     attribute). Round strings are `${viewId}|id,id,id,id,id`, so every player rebuilds the same round.

   THE QUALITY RULE for adding topics and items: a good round gives a casual player something to reason with:
   what things look like, how big they feel, when they happened, how popular they are, where they are, or plain
   common knowledge. The target feeling is "I'm not sure, but I can make an educated guess", never "there's no way
   I could know this" (five unfamiliar names) and never "this is completely obvious".
   Tools for that:
   - `fam` on dataset items: 5 extremely recognizable ... 1 obscure (unset counts as 3). A round aims for
     about 2 very familiar (4-5), 2 medium and at most
     1 hard (1-2) item: at least 2 and at most 4 familiar, at most 1 hard, and never five obscure names.
   - `gap`: the minimum ratio (or plain difference for `abs` / `year` comparisons) between any two items in a
     round, so values are never frustratingly close and small source differences can't flip the answer.
   - `mixed: false` on a dataset keeps it out of the default All Topics game. It still comes up when a player
     picks its category. Use it for datasets that are mostly trivia recall.
   - Only give an item an attribute when the value is defensible. Items without it simply sit out that comparison.
*/
(function (root) {
'use strict';

const N = 5;
// 20 per item in the right spot, so 100 for a perfect list, plus the Perfect Order bonus
const BASE_MAX = N * 20, PERFECT_BONUS = 15, ROUND_MAX = BASE_MAX + PERFECT_BONUS;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------- datasets -> views ---------------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asOfLabel = d => { const [y, m] = String(d).split('-'); return m ? `${MONTHS[+m - 1]} ${y}` : y; };

const SETS = {}, VIEWS = {};
function addSet(ds) {
  if (SETS[ds.id]) throw new Error(`duplicate dataset ${ds.id}`);
  SETS[ds.id] = ds;
  ds.views = [];
  const items = ds.items.map(it => ({...it, id: slug(it.id || it.name)}));
  const seen = new Set();
  for (const it of items) { if (seen.has(it.id)) throw new Error(`duplicate item ${ds.id}/${it.id}`); seen.add(it.id); }
  const hasFam = items.some(it => it.fam != null);
  for (const c of ds.comparisons) {
    const id = `${ds.id}.${c.key}`;
    // an item takes part in a comparison only when it has a real value for it
    const list = items.filter(it => typeof it[c.key] === 'number' && isFinite(it[c.key])).map(it => ({
      id: it.id, name: it.name, v: it[c.key],
      note: (it.notes && it.notes[c.key]) || it.note || '',
      emo: '',
      tier: it.fam == null ? 1 : it.fam >= 4 ? 0 : it.fam <= 2 ? 2 : 1,
    }));
    const src = [c.src || ds.src, c.asOf ? `Snapshot as of ${asOfLabel(c.asOf)}.` : ''].filter(Boolean).join(' ');
    const view = {
      id, set: ds, key: c.key, title: c.title || `${ds.label} by ${c.label}`, ask: c.ask, hi: c.hi, lo: c.lo,
      unit: c.unit, gap: c.gap, year: !!c.year, abs: !!c.abs, asc: c.dir === 'asc' || !!c.asc, about: !!c.about,
      flags: !!ds.flags, src, famous: hasFam, mixed: ds.mixed, list, byId: Object.fromEntries(list.map(i => [i.id, i])),
    };
    VIEWS[id] = view;
    ds.views.push(view);
  }
}
for (const ds of root.OrderUpData || []) addSet(ds);

/* broad categories players can pick from, each listing its datasets. A new dataset just goes in one list here. */
const CATEGORIES = [
  {id: 'geo', name: 'US States', sets: 'states'},
  {id: 'animals', name: 'Animals', sets: 'animals dogs'},
  {id: 'screen', name: 'Movies', sets: 'movies'},
  {id: 'gaming', name: 'Gaming', sets: 'games'},
  {id: 'music', name: 'Music', sets: 'songs'},
  {id: 'food', name: 'Food & Drink', sets: 'food drinks'},
  {id: 'cars', name: 'Cars', sets: 'cars'},
  {id: 'stuff', name: 'Everyday Stuff', sets: 'stuff'},
];
const CAT = {};
for (const c of CATEGORIES) {
  CAT[c.id] = c;
  c.list = c.sets.split(' ').map(id => { if (!SETS[id]) throw new Error(`unknown dataset ${id} in ${c.id}`); return SETS[id]; });
  for (const ds of c.list) { ds.cat = c; for (const v of ds.views) v.cat = c; }
}
// null means every category; otherwise a list of category ids (possibly empty while someone is choosing)
const cleanCats = v => Array.isArray(v) ? CATEGORIES.map(c => c.id).filter(id => v.includes(id)) : null;
const catsLabel = cats => !cats ? 'All topics' : cats.length ? cats.map(id => CAT[id].name).join(' · ') : 'None yet';

/* numbers are stored in metric (as the sources give them) and shown in US units */
function sig(x, n = 3) {
  if (!x) return 0;
  const p = Math.pow(10, n - 1 - Math.floor(Math.log10(Math.abs(x))));
  return Math.round(x * p) / p;
}
const num = x => sig(x).toLocaleString('en-US', {maximumFractionDigits: 6});
function big(x, unit) {
  if (x >= 1e9) return `${sig(x / 1e9)} billion ${unit}`;
  if (x >= 1e6) return `${sig(x / 1e6)} million ${unit}`;
  return `${num(x)} ${unit}`;
}
const KM2_PER_SQMI = 2.589988, MI_PER_KM = 0.621371;
function fmtVal(t, v) {
  switch (t.unit) {
    case 'people': return big(v, 'people');
    case 'km2': return big(v / KM2_PER_SQMI, 'sq mi');
    case 'sqmi': return `${v < 100 ? num(v) : Math.round(v).toLocaleString('en-US')} sq mi`;
    case 'km': return `${num(v * MI_PER_KM)} mi`;
    case 'kg': { const lb = v * 2.20462; return (t.about ? 'about ' : '') + (lb < 1 ? `${num(lb * 16)} oz` : big(lb, 'lb')); }
    case 'kmh': return `${num(v * MI_PER_KM)} mph`;
    case 'm': return `${Math.round(v * 3.28084).toLocaleString('en-US')} ft`;
    case 'year': return v < 1000 ? `AD ${v}` : String(v);
    case 'born': return `born ${v}`;
    case 'ftin': {
      const inch = v * 39.3701;
      if (inch < 12) return `${num(inch)} in`;
      if (inch >= 1200) return `${Math.round(inch / 12).toLocaleString('en-US')} ft`;
      let ft = Math.floor(inch / 12), i = Math.round(inch - ft * 12);
      if (i === 12) { ft++; i = 0; }
      return i ? `${ft} ft ${i} in` : `${ft} ft`;
    }
    case 'ft': return `${Math.round(v).toLocaleString('en-US')} ft`;
    case 'mph': return `${num(v)} mph`;
    case 'kcal': return `${t.about ? 'about ' : ''}${v.toLocaleString('en-US')} calories`;
    case 'mg': return `${v} mg`;
    case 'shu': return big(v, 'Scoville units');
    case 'yrs': { const d = v * 365; return 'about ' + (v >= 1 ? `${num(v)} years` : d >= 14 ? `${Math.round(d / 7)} weeks` : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`); }
    case 'hp': return `${v.toLocaleString('en-US')} hp`;
    case 'zs': return `${v} seconds`;
    case 'seats': return `${t.about ? 'about ' : ''}${v.toLocaleString('en-US')} seats`;
    case 'mpop': return `about ${v >= 1 ? `${num(v)} million` : num(v * 1e6)} people`;
    case 'mvisit': return `about ${v >= 1 ? `${num(v)} million` : num(v * 1e6)} visitors`;
    case 'mpass': return `about ${num(v)} million passengers`;
    case 'count': return v.toLocaleString('en-US');
    case 'streams': return v >= 1e9 ? `${num(v / 1e9)} billion streams` : v >= 1e6 ? `${num(v / 1e6)} million streams` : `${num(v)} streams`;
    case 'rank': return `#${v}`;
    case 'min': return v >= 60 ? `${Math.floor(v / 60)} h ${v % 60} min` : `${v} min`;
    case 'lb': return `${t.about ? 'about ' : ''}${Math.round(v).toLocaleString('en-US')} lb`;
    case 'in': return `${t.about ? 'about ' : ''}${num(v)} in`;
    case 'g': return `${num(v)} g`;
    case 'ml': {
      const oz = v / 29.5735;
      if (v < 14) return `${num(v / 4.929)} tsp`;
      if (oz < 128) return `${num(oz)} fl oz`;
      return big(oz / 128, 'gallons');
    }
    case 'dex': return `#${String(v).padStart(4, '0')}`;
    case 'mfollow': return `about ${num(v)} million followers`;
    case 'msubs': return `about ${num(v)} million subscribers`;
    case 'stores': return `about ${num(v)} locations`;
    case 'mcopies': return `${t.about ? 'about ' : ''}${num(v)} million copies`;
    case 'munits': return `${t.about ? 'about ' : ''}${num(v)} million sold`;
    case 'musd': return (t.about ? 'about ' : '') + (v >= 1000 ? `$${num(v / 1000)} billion` : `$${num(v)} million`);
    case 'bstreams': return `about ${v >= 1 ? `${num(v)} billion` : `${num(v * 1000)} million`} streams`;
    case 'meta': return `${v} / 100`;
    case 'imdb': return `${v.toFixed(1)} / 10`;
    case 'oscars': return `${v} Oscar${v === 1 ? '' : 's'}`;
    case 'eps': return `${v.toLocaleString('en-US')} episodes`;
    case 'sec': return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  }
  return String(v);
}

/* ---------------- rounds and scoring ---------------- */
const far = (t, a, b) => t.year || t.abs ? Math.abs(a.v - b.v) >= t.gap : Math.max(a.v, b.v) / Math.min(a.v, b.v) >= t.gap;
// for topics with recognizability tiers: at least 2 and at most 4 famous anchors, and at most 1 hard item
// (the cap of 4 only applies when the topic has enough less-famous items to fill the fifth spot; for everyday
// things that everyone knows, like foods and household objects, the challenge is in the values instead)
const goodMix = (t, got) => {
  if (!t.famous) return true;
  const famous = got.filter(i => i.tier === 0).length, hard = got.filter(i => i.tier === 2).length;
  if (t.capFamous === undefined) t.capFamous = t.list.filter(i => i.tier !== 0).length >= t.list.length * 0.3;
  return famous >= 2 && (famous <= 4 || !t.capFamous) && hard <= 1;
};
function pick5(t) {
  const pool = t.list.slice().sort((a, b) => b.v - a.v);
  // draw from a window of neighbors most of the time so rounds aren't all giant-vs-tiny;
  // prefer a good mix of familiar and harder items, and only give that up if nothing fits
  for (let tries = 0; tries < 240; tries++) {
    const w = tries < 120 ? Math.min(pool.length, Math.max(10, Math.ceil(pool.length * 0.55))) : pool.length;
    const s = Math.floor(Math.random() * (pool.length - w + 1));
    const got = [];
    for (const it of shuffle(pool.slice(s, s + w))) {
      if (got.every(g => far(t, g, it))) got.push(it);
      if (got.length === N) break;
    }
    if (got.length === N && (tries >= 200 || goodMix(t, got))) return got;
  }
  return null;
}
// most topics go biggest first; dates go oldest first, which reads like a timeline
const rightOrder = R => R.ids.slice().sort((a, b) => (R.t.byId[b].v - R.t.byId[a].v) * (R.t.asc ? -1 : 1));
function scoreOrder(order, R) {
  if (!order) return 0;
  const right = rightOrder(R);
  const base = order.reduce((p, id, i) => { const d = Math.abs(right.indexOf(id) - i); return p + (d === 0 ? 20 : d === 1 ? 10 : 0); }, 0);
  // all five in exactly the right spot (the only way to reach the full base) earns the Perfect Order bonus
  return base === BASE_MAX ? base + PERFECT_BONUS : base;
}
const isPerfect = p => p === ROUND_MAX;

/* ---------------- round generation ----------------
   1. plan which dataset each round uses (the player's categories, or the All Topics mix)
   2. for each, pick the comparison used least so far (this game, then this session)
   3. pick five items that have that attribute, keeping the value gap and familiarity mix
   4. never repeat a round (view + the same five items) within a game, and avoid ones seen recently */
// a deep dataset can come up twice in a game (with different comparisons); a one-list topic once
const weightOf = ds => Math.min(ds.views.length, 2);
const roundKey = (view, five) => view.id + '|' + five.map(x => x.id).sort().join(',');
function newHistory() { return {used: new Set(), order: [], cmpUse: {}}; }
function remember(hist, key, view) {
  hist.used.add(key); hist.order.push(key);
  if (hist.order.length > 400) hist.used.delete(hist.order.shift());
  hist.cmpUse[view.id] = (hist.cmpUse[view.id] || 0) + 1;
}
function planSets(n, cats) {
  const all = !cats;
  const pool = sets => shuffle(sets.filter(ds => ds.mixed !== false || !all).flatMap(ds => Array(weightOf(ds)).fill(ds)));
  const draw = (q, prev) => { const i = q.findIndex(ds => ds !== prev); return i < 0 ? q.pop() : q.splice(i, 1)[0]; };
  const plan = [];
  // All Topics works like picking every category (minus datasets marked mixed: false)
  if (!cats) cats = CATEGORIES.filter(c => c.list.some(ds => ds.mixed !== false)).map(c => c.id);
  // chosen categories: shuffled passes through the categories so each gets a fair share;
  // within a category, datasets come round in turn before any repeats
  const order = [];
  while (order.length < n) {
    const pass = shuffle(cats.slice());
    if (pass.length > 1 && pass[0] === order[order.length - 1]) pass.push(pass.shift());
    order.push(...pass);
  }
  const queues = {};
  for (const c of order.slice(0, n)) {
    const prev = plan[plan.length - 1];
    // refill before the queue runs dry or is left holding only the dataset we just used
    if (!queues[c]?.length || queues[c].every(ds => ds === prev)) queues[c] = [...(queues[c] || []), ...pool(CAT[c].list)];
    plan.push(draw(queues[c], prev));
  }
  return plan;
}
function makeRounds(n, cats, hist = newHistory()) {
  const out = [], inGame = new Set(), gameUse = {};
  const tryView = (view, strict) => {
    for (let k = 0; k < 12; k++) {
      const five = pick5(view);
      if (!five) return null;
      const key = roundKey(view, five);
      if (inGame.has(key) || (strict && hist.used.has(key))) continue;
      return {view, five, key};
    }
    return null;
  };
  const build = ds => {
    // least-used comparison first: this game, then this session, ties at random
    const views = shuffle(ds.views.slice()).sort((a, b) => (gameUse[a.id] || 0) - (gameUse[b.id] || 0) || (hist.cmpUse[a.id] || 0) - (hist.cmpUse[b.id] || 0));
    for (const strict of [true, false]) for (const v of views) { const got = tryView(v, strict); if (got) return got; }
    return null;
  };
  const plan = planSets(n, cats);
  const spare = shuffle(Object.values(SETS).filter(ds => cats ? cats.includes(ds.cat.id) : ds.mixed !== false));
  for (let i = 0; out.length < n && i < plan.length + spare.length; i++) {
    const got = build(i < plan.length ? plan[i] : spare[i - plan.length]);
    if (!got) continue;
    inGame.add(got.key); remember(hist, got.key, got.view);
    gameUse[got.view.id] = (gameUse[got.view.id] || 0) + 1;
    const R = {t: got.view, ids: got.five.map(x => x.id)};
    // the starting order is the same for everyone; reshuffle only if it would already score 80+
    for (let k = 0; k < 50; k++) { shuffle(R.ids); if (scoreOrder(R.ids, R) < 80) break; }
    out.push(`${got.view.id}|${R.ids.join(',')}`);
  }
  return out;
}

root.OrderUp = {N, BASE_MAX, PERFECT_BONUS, ROUND_MAX, TOP: VIEWS, SETS, CATEGORIES, CAT, cleanCats, catsLabel,
  fmtVal, far, goodMix, pick5, rightOrder, scoreOrder, isPerfect, makeRounds, newHistory, roundKey};
})(typeof window !== 'undefined' ? window : globalThis);
