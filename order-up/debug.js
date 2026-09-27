/* Order Up! content simulator: a developer tool, loaded only with ?debug=1 (and by tests under node).
   It plays thousands of games through the real round generator (OrderUp.makeRounds) and reports what came
   out, so tuning weights, caps and content can be judged by numbers instead of by feel. Nothing here
   changes how rounds are made. */
(function (root) {
'use strict';
const O = root.OrderUp;
const inc = (m, k, by = 1) => { m[k] = (m[k] || 0) + by; };
const famOf = (t, id) => t.set.sequence ? 4 : (t.byId[id].fam ?? 3);
// how far apart a round's five values are, as a share of the whole pool's spread (0 = identical, 1 = extremes)
function spread(t, ids) {
  const v = ids.map(id => t.byId[id].v), all = t.list.map(i => i.v);
  const log = !(t.year || t.abs) && Math.min(...all) > 0;
  const f = x => log ? Math.log(x) : x, range = f(Math.max(...all)) - f(Math.min(...all));
  return range ? (f(Math.max(...v)) - f(Math.min(...v))) / range : 0;
}

/* games: how many to play. cats: a category list (null = everything). session: games per shared history,
   like Play Again with the same group. examples: how many whole games to keep for reading. */
function simulate({games = 1000, cats = null, rounds = 10, session = 5, examples = 8} = {}) {
  const st = {games, rounds, cat: {}, set: {}, view: {}, type: {}, flag: {}, flagGames: {}, specialsPerGame: {},
    repeats: {set: 0, cat: 0, type: 0, statRun: 0, subsetTwice: 0, sameFive: 0}, short: 0, total: 0,
    fam: 0, famPos: Array(rounds).fill(0), posCount: Array(rounds).fill(0), spread: {}, typeMax: {}, examples: []};
  const keep = new Set(Array.from({length: Math.min(examples, games)}, () => Math.floor(Math.random() * games)));
  let hist, seen;
  for (let g = 0; g < games; g++) {
    if (g % session === 0) { hist = O.newHistory(); seen = new Set(); }
    const rs = O.makeRounds(rounds, cats, hist).map(O.parseRound);
    if (rs.length < rounds) st.short++;
    const perType = {}, perSubset = {}, flags = {};
    let run = 0;
    rs.forEach((R, i) => {
      const t = R.t, key = O.roundKey(t, R.ids.map(id => t.byId[id]));
      st.total++;
      inc(st.cat, t.cat.name); inc(st.set, t.set.label); inc(st.view, t.id); inc(st.type, t.type); inc(perType, t.type);
      if (R.flag) { inc(st.flag, R.flag); flags[R.flag] = 1; }
      if (t.subset) inc(perSubset, t.id);
      const fam = R.ids.reduce((a, id) => a + famOf(t, id), 0) / R.ids.length;
      st.fam += fam; st.famPos[i] += fam; st.posCount[i]++;
      const sp = spread(t, R.ids), bucket = R.flag === 'close' ? 'close' : R.flag === 'final' ? 'final' : i < 2 ? 'opening' : 'other';
      (st.spread[bucket] = st.spread[bucket] || {sum: 0, n: 0}).sum += sp; st.spread[bucket].n++;
      if (seen.has(key)) st.repeats.sameFive++;
      seen.add(key);
      run = ['measure', 'nutrition'].includes(t.type) ? run + 1 : 0;
      if (run >= 3) st.repeats.statRun++;
      if (i) {
        const p = rs[i - 1].t;
        if (p.set === t.set) st.repeats.set++;
        if (p.cat === t.cat) st.repeats.cat++;
        if (p.type === t.type) st.repeats.type++;
      }
    });
    for (const [k, c] of Object.entries(perType)) st.typeMax[k] = Math.max(st.typeMax[k] || 0, c);
    st.repeats.subsetTwice += Object.values(perSubset).filter(c => c > 1).length;
    for (const f of Object.keys(flags)) inc(st.flagGames, f);
    inc(st.specialsPerGame, rs.filter(R => R.flag && R.flag !== 'final').length);
    if (keep.has(g)) st.examples.push({game: g + 1, rounds: rs.map(R => ({title: R.t.title, cat: R.t.cat.name, ask: R.t.ask, type: R.t.type,
      flag: R.flag, items: R.ids.map(id => R.t.byId[id].name)}))});
  }
  st.famAvg = st.fam / st.total;
  st.famByPos = st.famPos.map((s, i) => s / (st.posCount[i] || 1));
  for (const b of Object.values(st.spread)) b.avg = b.sum / b.n;
  return st;
}
// every view: how often pick5 fails to build a round, with and without the stricter pacing options
function failures(tries = 60) {
  const out = [];
  for (const t of Object.values(O.TOP)) {
    let plain = 0, close = 0;
    for (let k = 0; k < tries; k++) { if (!O.pick5(t)) plain++; if (!O.pick5(t, {win: 0.2, min: 7, strict: true})) close++; }
    out.push({id: t.id, title: t.title, items: t.list.length, plain: plain / tries, close: close / tries});
  }
  return out.sort((a, b) => b.plain - a.plain || a.items - b.items);
}

/* ---------------- the ?debug=1 panel ---------------- */
function mount(el) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pct = (x, of) => (100 * x / of).toFixed(1) + '%';
  const table = (title, m, of, limit = 200) => `<h3>${esc(title)}</h3><table>${Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td><td>${pct(v, of)}</td></tr>`).join('')}</table>`;
  el.innerHTML = `<h2>Content simulator</h2>
    <p>Plays games through the real round generator. Sessions share history the way Play Again does.</p>
    <div class="dbg-controls"><label>Games <input id="dbg-n" type="number" value="1000" min="10" max="20000"></label>
    <label>Mix <select id="dbg-mix">${O.PRESETS.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
    <label>Games per session <input id="dbg-s" type="number" value="5" min="1" max="50"></label>
    <button id="dbg-run" class="btn primary small">Run</button></div><div id="dbg-out"></div>`;
  el.querySelector('#dbg-run').addEventListener('click', () => {
    const n = +el.querySelector('#dbg-n').value || 1000, preset = O.PRESETS.find(p => p.id === el.querySelector('#dbg-mix').value);
    const t0 = performance.now(), st = simulate({games: n, cats: preset.cats, session: +el.querySelector('#dbg-s').value || 5});
    const ms = Math.round(performance.now() - t0), R = st.total, fails = failures(40);
    const rep = st.repeats, back = st.games * (st.rounds - 1);
    el.querySelector('#dbg-out').innerHTML = `
      <p><b>${st.games}</b> games of ${st.rounds}, ${esc(preset.name)}, ${R} rounds in ${ms} ms. Short games: ${st.short}.
      Average familiarity of the five items: <b>${st.famAvg.toFixed(2)}</b> (1–5).</p>
      <h3>Familiarity by round</h3><table><tr>${st.famByPos.map((f, i) => `<td>R${i + 1}<br><b>${f.toFixed(2)}</b></td>`).join('')}</tr></table>
      <h3>Repeats</h3><table>
        <tr><td>Same dataset back to back</td><td>${rep.set}</td><td>${pct(rep.set, back)}</td></tr>
        <tr><td>Same category back to back</td><td>${rep.cat}</td><td>${pct(rep.cat, back)}</td></tr>
        <tr><td>Same type back to back</td><td>${rep.type}</td><td>${pct(rep.type, back)}</td></tr>
        <tr><td>3+ stat rounds in a row</td><td>${rep.statRun}</td><td></td></tr>
        <tr><td>Same themed subset twice in a game</td><td>${rep.subsetTwice}</td><td></td></tr>
        <tr><td>Same five items again in a session</td><td>${rep.sameFive}</td><td>${pct(rep.sameFive, R)}</td></tr></table>
      <h3>Special rounds</h3><table>${Object.entries(O.FLAGS).map(([k, name]) => `<tr><td>${esc(name)}</td><td>${st.flag[k] || 0}</td><td>${pct(st.flag[k] || 0, R)} of rounds, in ${pct(st.flagGames[k] || 0, st.games)} of games</td></tr>`).join('')}
        ${Object.entries(st.specialsPerGame).sort().map(([k, v]) => `<tr><td>Games with ${k} labels besides the finale</td><td>${v}</td><td>${pct(v, st.games)}</td></tr>`).join('')}</table>
      <h3>How close the values are</h3><table>${Object.entries(st.spread).map(([k, b]) => `<tr><td>${esc(k)}</td><td>${b.avg.toFixed(2)}</td><td>${b.n} rounds</td></tr>`).join('')}</table>
      <p class="note">Share of the pool's full range the five values cover (lower = closer). Close Call should sit well below the others.</p>
      <div class="dbg-cols">${table('Categories', st.cat, R)}${table('Round types', st.type, R)}</div>
      <p>Most of one type in a single game: ${Object.entries(st.typeMax).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</p>
      <div class="dbg-cols">${table('Datasets', st.set, R)}${table('Comparisons', st.view, R)}</div>
      <h3>Comparisons that struggle to build a round</h3><table><tr><th>View</th><th>Items</th><th>Fails</th><th>Close Call fails</th></tr>
        ${fails.filter(f => f.plain > 0 || f.close > 0.5 && f.items >= 20).map(f => `<tr><td>${esc(f.id)}</td><td>${f.items}</td><td>${pct(f.plain, 1)}</td><td>${pct(f.close, 1)}</td></tr>`).join('') || '<tr><td>None</td></tr>'}</table>
      <h3>Example games</h3>${st.examples.map(e => `<h4>Game ${e.game}</h4><ol>${e.rounds.map(r => `<li>${r.flag ? `<b>[${esc(O.FLAGS[r.flag])}]</b> ` : ''}${esc(r.title)}: ${esc(r.ask)} <small>(${esc(r.cat)}, ${esc(r.type)}) · ${esc(r.items.join(', '))}</small></li>`).join('')}</ol>`).join('')}`;
  });
}

root.OrderUpDebug = {simulate, failures, mount};
})(typeof window !== 'undefined' ? window : globalThis);
