/* Order Up! question engine.
   Loaded by order-up/index.html after the data files in order-up/data/, and by tests under node.

   HOW CONTENT IS ORGANIZED
   - A DATASET is one pool of items (songs, movies, dog breeds...) where each item is stored once with several
     attributes, plus a list of COMPARISONS that say how to rank items by one attribute. Datasets live in
     order-up/data/*.js and register themselves with OrderUpData.push({...}). See data/README.md for the format.
   - A comparison can narrow the dataset to a THEMED SUBSET with `filter` (by item `tags`, artist `note`, or a
     value range), so one movies file gives "Pixar movies", "MCU movies" and "Movies" rounds without repeating
     any movie. Each comparison also says what kind of thinking it asks for (`type`: chronology, popularity,
     measure, nutrition, ranking, age, sequence, knowledge) so a game can mix them up, how often it should come
     up (`weight`, 1 by default), and optionally which `category` it belongs to if not the dataset's own.
   - CURATED SEQUENCES (data/sequences.js) are hand-written orders that aren't a number on a shared list of
     things: poker hands, steak doneness, the stages of grief. They become one-comparison datasets, so they go
     through the same rounds, scoring and reveal as everything else. Keep them a small share of the content.
   - Every (dataset, comparison) pair becomes a VIEW: the flat topic shape the game renders and scores
     (title, ask, hi/lo labels, unit, gap, type, and a list of {id, name, note, v} for the items that pass the
     filter and have the attribute). Round strings are `${viewId}|id,id,id,id,id`, so every player rebuilds the
     same round.

   THE FUN TEST: "I recognize all five of these things... but what order do they go in?" A comparison earns its
   place when friends would enjoy arguing about it (recognition, guessability, discussion, surprise), not just
   because the numbers exist. Technically sortable but dull comparisons get a low `weight`.

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

// a comparison's `filter` keeps only matching items: {tag: 'pixar'} or {tags: ['a', 'b']} (any of them),
// {note: 'The Beatles'} (exact), and any other key is an inclusive [min, max] range on that attribute
function matches(it, f) {
  if (!f) return true;
  for (const [k, want] of Object.entries(f)) {
    if (k === 'tag') { if (!(it.tags || []).includes(want)) return false; }
    else if (k === 'tags') { if (!want.some(t => (it.tags || []).includes(t))) return false; }
    else if (k === 'note') { if (it.note !== want) return false; }
    else if (!(typeof it[k] === 'number' && it[k] >= want[0] && it[k] <= want[1])) return false;
  }
  return true;
}
// what kind of thinking a comparison asks for, when it doesn't say
const typeOf = c => c.type || (c.year ? 'chronology' : 'measure');

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
    const id = `${ds.id}.${c.id || c.key}`;
    if (VIEWS[id]) throw new Error(`duplicate comparison ${id}: give filtered comparisons their own id`);
    // an item takes part in a comparison only when it passes the filter and has a real value for it
    const list = items.filter(it => typeof it[c.key] === 'number' && isFinite(it[c.key]) && matches(it, c.filter)).map(it => ({
      id: it.id, name: it.name, v: it[c.key],
      note: (it.notes && it.notes[c.key]) || it.note || '',
      label: it.label || '', // shown on the reveal instead of the number (curated sequences)
      emo: '',
      tier: it.fam == null ? 1 : it.fam >= 4 ? 0 : it.fam <= 2 ? 2 : 1,
    }));
    if (list.length < N) { console.warn(`Order Up: ${id} has only ${list.length} items, skipped`); continue; }
    const src = [c.src || ds.src, c.asOf ? `Snapshot as of ${asOfLabel(c.asOf)}.` : ''].filter(Boolean).join(' ');
    const view = {
      id, set: ds, key: c.key, title: c.title || `${ds.label} by ${c.label}`, ask: c.ask, hi: c.hi, lo: c.lo,
      unit: c.unit, gap: c.gap, year: !!c.year, abs: !!c.abs, asc: c.dir === 'asc' || !!c.asc, about: !!c.about,
      type: typeOf(c), weight: c.weight ?? 1, catId: c.category || null,
      flags: !!ds.flags, src, famous: hasFam, mixed: ds.mixed, list, byId: Object.fromEntries(list.map(i => [i.id, i])),
    };
    VIEWS[id] = view;
    ds.views.push(view);
  }
}
for (const ds of root.OrderUpData || []) addSet(ds);
// a curated sequence lists its items in order; it becomes a dataset whose one comparison is that order
for (const q of root.OrderUpSequences || []) addSet({
  id: `seq-${q.id}`, label: q.title, sequence: true,
  comparisons: [{key: 'order', title: q.title, ask: q.ask, hi: q.hi, lo: q.lo, dir: 'asc', unit: 'seq', gap: 1, abs: true,
    type: q.type || 'sequence', weight: q.weight ?? 1, category: q.category || 'wild', src: q.src}],
  items: q.items.map((it, i) => ({...(typeof it === 'string' ? {name: it} : it), order: i + 1})),
});

/* broad categories players can pick from, each listing its datasets. A new dataset just goes in one list here.
   A comparison with its own `category` shows up there instead (Internet Nostalgia lives in tech.js but is a
   Nostalgia round); curated sequences default to Wild Cards. */
const CATEGORIES = [
  {id: 'screen', name: 'Movies', sets: 'movies', pillar: true},
  {id: 'music', name: 'Music', sets: 'songs', pillar: true},
  {id: 'gaming', name: 'Gaming', sets: 'games pokemon', pillar: true},
  {id: 'tech', name: 'Tech & Internet', sets: 'tech', pillar: true},
  {id: 'nostalgia', name: 'Nostalgia', sets: 'toys', pillar: true},
  {id: 'people', name: 'Celebrities', sets: 'people', pillar: true},
  {id: 'food', name: 'Food & Drink', sets: 'food drinks'},
  {id: 'animals', name: 'Animals', sets: 'animals dogs'},
  {id: 'cars', name: 'Cars', sets: 'cars'},
  {id: 'stuff', name: 'Everyday Stuff', sets: 'stuff'},
  {id: 'geo', name: 'US States', sets: 'states'},
  {id: 'wild', name: 'Wild Cards', sets: ''},
];
const CAT = {};
const home = {};
for (const c of CATEGORIES) for (const id of c.sets.split(' ').filter(Boolean)) {
  home[id] = c.id;
  if (!SETS[id]) console.warn(`Order Up: dataset "${id}" did not load`);
}
// a dataset file that didn't load (a network hiccup, a stale cache) is skipped instead of breaking the game;
// a category with nothing left in it is dropped
for (const c of CATEGORIES) { c.views = []; c.list = []; }
for (const ds of Object.values(SETS)) for (const v of ds.views) {
  const c = CATEGORIES.find(x => x.id === (v.catId || home[ds.id]));
  if (!c) { console.warn(`Order Up: ${v.id} is not in any category`); delete VIEWS[v.id]; continue; }
  v.cat = c; c.views.push(v);
  if (!c.list.includes(ds)) c.list.push(ds);
  if (!ds.cat) ds.cat = c;
}
for (const c of CATEGORIES.slice()) { if (c.views.length) CAT[c.id] = c; else CATEGORIES.splice(CATEGORIES.indexOf(c), 1); }
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
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
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
    case 'seq': return ordinal(v);
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
   Rounds are picked one at a time. Every candidate round (a view) gets a score, lowest wins:
   - categories go round in passes (one that already had its turn this pass costs extra), so each chosen
     category gets its share, and the same category never comes twice in a row
   - the same kind of thinking (`type`) twice in a row, or too often in one game, costs a lot
   - so does reusing a dataset or a themed subset, and comparisons already seen this session cost a little
   - low-`weight` comparisons (technically fine but less fun) come up less
   - two stat rounds (measure, nutrition) back to back cost extra; pillar categories (pop culture, nostalgia,
     tech) get a small head start; curated sequences are capped at about one round in five
   - two rounds from one dataset in a game can't share three or more items (Pixar movies, then all movies)
   Then five items are picked with the value gap and familiarity mix, and a round (view + the same five items)
   never repeats within a game and is avoided if seen recently. */
// the most rounds of one type in a 10-round game before it gets pushed back hard (chronology is the main pillar)
const TYPE_CAP = {chronology: 4, measure: 3, popularity: 3};
const SEQ_SHARE = 0.2;
const STATS = new Set(['measure', 'nutrition']);
const roundKey = (view, five) => view.id + '|' + five.map(x => x.id).sort().join(',');
function newHistory() { return {used: new Set(), order: [], cmpUse: {}}; }
function remember(hist, key, view) {
  hist.used.add(key); hist.order.push(key);
  if (hist.order.length > 400) hist.used.delete(hist.order.shift());
  hist.cmpUse[view.id] = (hist.cmpUse[view.id] || 0) + 1;
}
function makeRounds(n, cats, hist = newHistory()) {
  const all = !cats;
  // All Topics works like picking every category (minus datasets marked mixed: false)
  const usable = v => !all || v.mixed !== false;
  if (!cats) cats = CATEGORIES.filter(c => c.views.some(usable)).map(c => c.id);
  cats = cats.filter(id => CAT[id]);
  const out = [], inGame = new Set(), useView = {}, useSet = {}, useType = {}, picked = {};
  let prev = null, pass = [], seqs = 0;
  // curated sequences are a side dish: at most about one round in five
  const seqCap = Math.max(1, Math.round(n * SEQ_SHARE));
  const score = v => {
    let s = Math.random() * 12;
    if (!pass.includes(v.cat.id)) s += 100;
    if (v.cat.pillar) s -= 30; // pop culture, nostalgia and chronology are the heart of the game
    if (prev && v.set === prev.set) s += 200;
    if (prev && v.type === prev.type) s += 120;
    else if (prev && STATS.has(v.type) && STATS.has(prev.type)) s += 60; // two stat rounds in a row feel samey
    const t = useType[v.type] || 0;
    s += t * 30 + (t >= (TYPE_CAP[v.type] ?? 2) ? 150 : 0);
    s += (useSet[v.set.id] || 0) * 45 + (useView[v.id] || 0) * 400;
    s += (hist.cmpUse[v.id] || 0) * 6;
    s += (1 - v.weight) * 70;
    if (v.set.sequence) s += 25 + (seqs >= seqCap ? 400 : 0);
    return s;
  };
  const tryView = (view, strict) => {
    for (let k = 0; k < 12; k++) {
      const five = pick5(view);
      if (!five) return null;
      const key = roundKey(view, five);
      if (inGame.has(key) || (strict && hist.used.has(key))) continue;
      // two rounds from one dataset (say Pixar and all movies) shouldn't show mostly the same things
      if (strict && (picked[view.set.id] || []).some(ids => five.filter(x => ids.has(x.id)).length >= 3)) continue;
      return {view, five, key};
    }
    return null;
  };
  const choose = cands => {
    const ranked = cands.map(v => [score(v), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    for (const strict of [true, false]) for (const v of ranked) { const got = tryView(v, strict); if (got) return got; }
    return null;
  };
  for (let guard = 0; out.length < n && guard < n * 3; guard++) {
    // this pass: the categories not used yet in it (a fresh pass once they've all had a turn)
    if (!pass.length) pass = cats.slice();
    // every other category is a candidate too, at a cost, so the end of a pass isn't forced into a repeat type
    const open = cats.length > 1 && prev ? cats.filter(c => c !== prev.cat.id) : cats;
    let got = choose(open.flatMap(c => CAT[c].views.filter(usable)));
    // a category that has run out of fresh rounds hands over to any chosen category
    if (!got) got = choose(cats.flatMap(c => CAT[c].views.filter(usable)));
    if (!got) break;
    const v = got.view;
    pass = pass.filter(c => c !== v.cat.id);
    inGame.add(got.key); remember(hist, got.key, v);
    (picked[v.set.id] = picked[v.set.id] || []).push(new Set(got.five.map(x => x.id)));
    if (v.set.sequence) seqs++;
    useView[v.id] = (useView[v.id] || 0) + 1; useSet[v.set.id] = (useSet[v.set.id] || 0) + 1; useType[v.type] = (useType[v.type] || 0) + 1;
    prev = v;
    const R = {t: v, ids: got.five.map(x => x.id)};
    // the starting order is the same for everyone; reshuffle only if it would already score 80+
    for (let k = 0; k < 50; k++) { shuffle(R.ids); if (scoreOrder(R.ids, R) < 80) break; }
    out.push(`${v.id}|${R.ids.join(',')}`);
  }
  return out;
}

root.OrderUp = {N, BASE_MAX, PERFECT_BONUS, ROUND_MAX, TOP: VIEWS, SETS, CATEGORIES, CAT, cleanCats, catsLabel,
  fmtVal, far, goodMix, pick5, rightOrder, scoreOrder, isPerfect, makeRounds, newHistory, roundKey};
})(typeof window !== 'undefined' ? window : globalThis);
