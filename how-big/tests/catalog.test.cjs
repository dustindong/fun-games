const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'objects.js'),'utf8'),context);
const data=context.window.HOW_BIG_OBJECTS;
const groups=['RAW','RAW2','RAW3','RAW4','RAW5'];
const rawRows=groups.flatMap(name=>data[name]);
const ids=new Set(rawRows.map(row=>row[0]));
const allIds=new Set([...ids,...data.STD.map(row=>row[0])]);

test('catalog contains only generated-sprite objects and retains their metadata',()=>{
 const snapshot={RAW:data.RAW,RAW2:data.RAW2,RAW3:data.RAW3,RAW4:data.RAW4,RAW5:data.RAW5,STD:data.STD,NOT_UPRIGHT:data.NOT_UPRIGHT,ANCHORS:data.ANCHORS};
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),'716d546768cf814f3131b4631ccad3afde514e19dc433f5b8b49d3e9d592ab36');
 assert.equal(ids.size,112);
 assert.equal(data.STD.length,100);
 assert.equal(allIds.size,152);
 const spritesContext=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(path.join(root,'assets/stickers-v1/manifest.js'),'utf8'),spritesContext);
 for(const id of allIds) assert(spritesContext.window.HOW_BIG_SPRITES[id],id+' has generated artwork');
 for(const id of ['harrypotter','hermione','batman','godzilla','horse','lion','eiffel','raptor','car']) assert(allIds.has(id),id+' remains in the catalog');
});

test('the page loads objects.js before game logic and does not duplicate catalog rows',()=>{
 const dataTag=html.indexOf('<script src="objects.js?v=2"></script>');
 const inline=html.indexOf('<script>\n(() => {');
 assert(dataTag>=0&&dataTag<inline);
 assert.doesNotMatch(html,/const (?:RAW|RAW2|RAW3|RAW4|RAW5|STD) = \[/);
 assert.match(html,/window\.HOW_BIG_OBJECTS/);
});

test('every unordered pair of catalog objects is represented exactly once',()=>{
 const from=html.indexOf('const PAIRS_RAW = ['),to=html.indexOf('\n];',from)+3;
 const pairContext=vm.createContext({});
 vm.runInContext(html.slice(from,to).replace('const PAIRS_RAW','globalThis.PAIRS_RAW'),pairContext);
 const byId=Object.fromEntries(rawRows.map(([id,e,a,height])=>[id,{id,e,height,unit:'m'}]));
 for(const [id,pic,phrase,ft,note,name,cat,fam] of data.STD){
  const o=byId[id]||{id}; Object.assign(o,{height:ft*.3048,unit:'m',cat,fam}); if(pic)o.e=pic; byId[id]=o;
 }
 const genStart=html.indexOf('function genPairs()'),genEnd=html.indexOf('\nconst PAIRS =',genStart);
 assert(genStart>=0&&genEnd>genStart,'pair generator exists');
 const genContext=vm.createContext({BY:byId,PAIRS_RAW:pairContext.PAIRS_RAW});
 vm.runInContext(`${html.slice(genStart,genEnd)}; globalThis.generated=genPairs();`,genContext);
 const curated=pairContext.PAIRS_RAW.map(([a,b])=>[a,b]);
 const generated=genContext.generated.map(p=>[p.ref,p.tgt]);
 const pairs=[...curated,...generated], key=([a,b])=>[a,b].sort().join('|');
 assert.equal(new Set(curated.map(key)).size,curated.length,'curated pairs have no duplicate unordered pair');
 assert.equal(new Set(pairs.map(key)).size,pairs.length,'no pair is duplicated');
 assert.equal(pairs.length,allIds.size*(allIds.size-1)/2);
 assert.deepEqual([...new Set(pairs.flatMap(([a,b])=>[a,b]))].sort(),[...allIds].sort());
 const kinds=new Map(genContext.generated.map(p=>[key([p.ref,p.tgt]),p.kind]));
 for(const [a,b] of generated){
  const q=Math.max(byId[a].height,byId[b].height)/Math.min(byId[a].height,byId[b].height),kind=kinds.get(key([a,b]));
  assert(['close','normal','giant'].includes(kind),`${a}|${b} has a supported round kind`);
  if(kind==='close')assert(q<=1.25+1e-9,`${a}|${b} is within the close-call range`);
  if(kind==='normal')assert(q>1.25&&q<=4,`${a}|${b} is within the normal range`);
  if(kind==='giant')assert(q>4,`${a}|${b} is within the giant range`);
 }
 assert.match(html,/giant: \{min: 4, max: Infinity,/,'giant rounds admit every height ratio');
});
