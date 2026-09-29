const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '..');
const ctx = vm.createContext({console});
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
for (const [, src] of html.matchAll(/<script src="((?:data\/|engine\.js)[^"?]+|engine\.js)(?:\?[^\"]*)?"/g)) {
  vm.runInContext(fs.readFileSync(path.join(base, src), 'utf8'), ctx, {filename: src});
}
const E = ctx.OrderUp, jobs = E.TOP['jobs.workers'];
assert.ok(jobs);
assert.equal(jobs.list.length, 250);
assert.equal(new Set(jobs.list.map(i => i.id)).size, 250);
assert.equal(jobs.cat.id, 'stuff');
for (const cat of ['stuff', 'wild']) assert.ok(E.CAT[cat].views.some(v => v.id === jobs.id));
assert.equal(E.fmtVal(jobs, 3400000), '3.4 million people');
assert.equal(E.fmtVal(jobs, 875000), '875,000 people');
assert.equal(E.fmtVal(jobs, 42500), '42,500 people');
const seen = new Set();
function check(R) {
  assert.equal(R.ids.length, 5);
  assert.equal(new Set(R.ids).size, 5);
  const items = R.ids.map(id => R.t.byId[id]);
  assert.ok(items.every(Boolean));
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) assert.ok(E.far(R.t, items[a], items[b]));
  assert.equal(E.scoreOrder(E.rightOrder(R), R), 115);
}
for (let i = 0; i < 10000; i++) {
  const five = E.pick5(jobs);
  assert.ok(five);
  five.forEach(it => seen.add(it.id));
  check({t: jobs, ids: five.map(it => it.id)});
}
assert.equal(seen.size, 250);
for (const cats of [['stuff'], ['wild'], ['stuff', 'wild'], null, ...E.PRESETS.map(p => p.cats)]) {
  const history = E.newHistory(); let jobsRounds = 0;
  for (let i = 0; i < 30; i++) {
    const rounds = E.makeRounds(10, cats, history);
    assert.equal(rounds.length, 10);
    assert.equal(new Set(rounds.map(s => s.split('|').slice(0,2).join('|'))).size, 10);
    for (const s of rounds) {const r = E.parseRound(s); check(r); if (r.t.id === jobs.id) jobsRounds++;}
  }
  if (!cats || cats.includes('stuff') || cats.includes('wild')) assert.ok(jobsRounds > 0);
}
console.log('PASS: 250 jobs, 10,000 valid Jobs rounds, all jobs sampled, 2,700 full-game rounds across mixes/presets, formatting and scoring.');
