// Run with: node --test how-big/tests/session.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const extract=(from,to)=>source.slice(source.indexOf('function '+from+'('),source.indexOf('function '+to+'('));
const context=vm.createContext({BY:{door:{height:2,label:'Door'},giraffe:{height:6,label:'Giraffe'}}});
vm.runInContext(extract('matchHighlights','renderHighlights')+extract('sessionStandings','renderSession'),context);
const {matchHighlights,sessionStandings}=context;
const player=(pid,points,guesses=points.map(()=>3))=>({pid,name:pid,total:points.reduce((a,b)=>a+b,0),answers:points.map((p,i)=>({p,g:guesses[i]}))});
const match=(...players)=>({rounds:players[0].answers.map(()=> 'door|giraffe'),players});
test('highlights use guess accuracy rather than rounded score and exclude misses',()=>{
 const h=matchHighlights(match(player('A',[100,0],[3.09,null]),player('B',[100,0],[3.003,9])));
 assert.equal(h.closest.pl.pid,'B');assert.equal(h.closest.round,0);
 assert.equal(h.over.pl.pid,'B');assert.equal(h.over.ratio,3);
});
test('comeback names the recovering player and a real recovery comparison',()=>{
 const h=matchHighlights(match(player('A',[0,100,100]),player('B',[100,0,0]),player('C',[60,60,0])));
 assert.equal(h.comeback.pl.pid,'A');assert.equal(h.comeback.from,3);assert.equal(h.comeback.to,1);
 assert(h.comeback.moment.round>h.comeback.low);assert.equal(h.comeback.moment.ref.label,'Door');
});
test('no-answer, underestimates, and solo games do not invent awards',()=>{
 const empty=matchHighlights(match(player('A',[0],[null])));
 assert.equal(empty.closest,undefined);assert.equal(empty.over,undefined);assert.equal(empty.comeback,undefined);
 const under=matchHighlights(match(player('A',[60],[2.5])));
 assert.equal(under.over,undefined);assert.equal(under.comeback,undefined);
});
test('tied winners each earn a win, zero-score and solo results do not',()=>{
 const tied=match(player('A',[100]),player('B',[100]),player('C',[60]));
 const zero=match(player('A',[0]),player('B',[0]));
 const solo=match(player('C',[100]));
 const rows=sessionStandings({g1:tied,g2:zero,g3:solo});
 assert.equal(rows.find(p=>p.pid==='A').wins,1);assert.equal(rows.find(p=>p.pid==='B').wins,1);assert.equal(rows.find(p=>p.pid==='C').wins,0);
});
test('match IDs prevent repeat-render counting and departed players retain wins',()=>{
 const results={g1:match(player('A',[100]),player('B',[60]))};
 for(let i=0;i<10;i++)assert.equal(sessionStandings(results)[0].wins,1);
 results.g2=match(player('A',[100]),player('C',[60]));
 const rows=sessionStandings(results,[{pid:'A',name:'Renamed'},{pid:'D',name:'New player'}]);
 assert.equal(rows[0].name,'Renamed');assert.equal(rows[0].wins,2);
 assert(rows.some(p=>p.pid==='B'));assert.equal(rows.find(p=>p.pid==='D').wins,0);
 assert.equal(sessionStandings({}).length,0);
});
