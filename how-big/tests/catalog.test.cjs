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

test('external catalog keeps every source record and metadata value unchanged',()=>{
 const snapshot={RAW:data.RAW,RAW2:data.RAW2,RAW3:data.RAW3,RAW4:data.RAW4,RAW5:data.RAW5,STD:data.STD,NOT_UPRIGHT:data.NOT_UPRIGHT,ANCHORS:data.ANCHORS};
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),'d7c05e8ec7bd6bfccffd8fea853d03564f2dd57b460d41f795a0e9bfef99e34f');
 assert.equal(ids.size,334);
 assert.equal(data.STD.length,100);
 assert.equal(allIds.size,374);
 for(const id of ['harrypotter','hermione','batman','godzilla','horse','lion','eiffel','a380','car']) assert(allIds.has(id),id+' remains in the catalog');
});

test('the page loads objects.js before game logic and does not duplicate catalog rows',()=>{
 const dataTag=html.indexOf('<script src="objects.js?v=1"></script>');
 const inline=html.indexOf('<script>\n(() => {');
 assert(dataTag>=0&&dataTag<inline);
 assert.doesNotMatch(html,/const (?:RAW|RAW2|RAW3|RAW4|RAW5|STD) = \[/);
 assert.match(html,/window\.HOW_BIG_OBJECTS/);
});

test('every catalog object is referenced by a comparison or eligible standard pair generation',()=>{
 const from=html.indexOf('const PAIRS_RAW = ['),to=html.indexOf('\n];',from)+3;
 const pairContext=vm.createContext({});
 vm.runInContext(html.slice(from,to).replace('const PAIRS_RAW','globalThis.PAIRS_RAW'),pairContext);
 const covered=new Set(pairContext.PAIRS_RAW.flatMap(row=>[row[0],row[1]]));
 const meterRows=data.STD.map(([id,pic,phrase,ft,note,name,cat,fam])=>({id,pic,height:ft*.3048,fam}));
 for(let i=0;i<meterRows.length;i++)for(let j=i+1;j<meterRows.length;j++){
  const a=meterRows[i],b=meterRows[j],q=Math.max(a.height,b.height)/Math.min(a.height,b.height),f=Math.min(a.fam,b.fam);
  if((q>=1.15&&q<=2.5&&f>=6)||(q<1.15&&f>=8)){covered.add(a.id);covered.add(b.id);}
 }
 assert.equal(pairContext.PAIRS_RAW.filter(row=>row[4].includes('coverage')).length,115);
 assert.deepEqual([...allIds].filter(id=>!covered.has(id)),[]);
 const byId=new Map(rawRows.map(row=>[row[0],{height:row[3],e:row[1]}]));
 for(const [id,pic,phrase,ft] of data.STD){const o=byId.get(id)||{};o.height=ft*.3048;o.e=pic||o.e;byId.set(id,o);}
 for(const [a,b,theme,level,tags] of pairContext.PAIRS_RAW.filter(row=>row[4].includes('coverage'))){
  const x=byId.get(a),y=byId.get(b),q=Math.max(x.height,y.height)/Math.min(x.height,y.height);
  assert(x&&y&&x.height>0&&y.height>0,`${a}|${b} uses catalog entries with heights`);
  assert(['animals','dinos','everyday','vehicles','tech','landmarks','rides','rockets','people','sports','popculture'].includes(theme));
  if(tags.includes('close')) assert(q<=1.25+1e-9,`${a}|${b} is a close pair`);
  else if(tags.includes('tiny')) assert(q>=1.25&&q<=4&&Math.max(x.height,y.height)<=.3,`${a}|${b} is a tiny pair`);
  else if(tags.includes('giant')) assert(q>=4&&q<=30,`${a}|${b} is a giant pair`);
  else assert(q>1.25&&q<=4,`${a}|${b} is a normal pair`);
 }
});
