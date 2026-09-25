# Order Up! datasets

Each file here adds one **dataset**: a pool of items stored once, with several attributes, plus the
**comparisons** that rank items by one attribute. The engine (`../engine.js`) turns every comparison into
rounds, so a new dataset usually needs no code changes.

```js
(globalThis.OrderUpData = globalThis.OrderUpData || []).push({
  id: 'songs', label: 'Songs',
  comparisons: [
    {key: 'len', title: 'Song length', ask: 'Longest song to shortest', hi: 'Longest', lo: 'Shortest',
     unit: 'sec', gap: 1.2, src: 'Where the numbers come from.'},
    {key: 'year', title: 'When songs came out', ask: 'Oldest song to newest', hi: 'Came out first', lo: 'Came out last',
     dir: 'asc', unit: 'year', gap: 3, year: true, src: '...'},
    {key: 'streams', title: 'Spotify streams', ..., asOf: '2026-09'},   // time-sensitive: shown as "Snapshot as of Sep 2026"
  ],
  items: [
    {name: 'Blinding Lights', note: 'The Weeknd', fam: 5, year: 2019, len: 200, streams: 5569e6},
    {name: 'Y.M.C.A.', note: 'Village People', fam: 5, year: 1978},     // no length: sits out length rounds
  ],
});
```

**Comparison fields**
- `key`: the item attribute to rank by. An item only takes part if it has a number for it.
- `title`, `ask`, `hi`, `lo`: what the round shows (the title is only revealed when the round starts).
- `dir: 'asc'` puts the lowest value at the top (oldest first, quickest 0–60). The default is highest first.
- `unit`: how values are displayed (see `fmtVal` in engine.js; add a case there for a new unit).
- `gap`: minimum ratio between any two items in a round, or a plain difference with `abs: true` / `year: true`.
  Make it wide enough that small source differences can never flip the answer.
- `about: true` prefixes values with "about". `src` is shown on the reveal. `asOf` adds a snapshot date.

**Item fields**
- `name` (unique in the dataset), `note` (shown under the name: an artist, a serving size, a model year),
  `notes: {key: '...'}` for a note that only applies to one comparison.
- `fam`: 5 extremely recognizable … 1 obscure. Rounds aim for 2+ familiar items and at most 1 hard one.
- Only add a value you can defend. Leaving an attribute out is always better than guessing it.

**Registering a new dataset:** add a `<script src="data/NAME.js">` tag in `../index.html` and put the id in
one category's `sets` in `engine.js`.

See THE QUALITY RULE at the top of `engine.js` for what makes a good round.
