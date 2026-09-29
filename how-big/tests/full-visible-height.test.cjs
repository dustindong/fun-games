// Run with: node --test how-big/tests/full-visible-height.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const objectSource=fs.readFileSync(path.join(root,'objects.js'),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(objectSource,context);
const data=context.window.HOW_BIG_OBJECTS;
const database=new Map();
for(const name of ['RAW','RAW2','RAW3','RAW4','RAW5']) for(const row of data[name]) database.set(row[0],{height:row[3],note:row[4],row});
for(const row of data.STD) database.set(row[0],{height:row[3]*.3048,note:row[4],row});
const get=id=>database.get(id);

test('height geometry always uses the complete visible artwork bounds',()=>{
 const from=html.indexOf('function shapeOf('),to=html.indexOf('\n/* s:',from);
 const geom=vm.createContext({meas:()=>({w:90,h:100}),artOf:()=>({measurementFraction:.5})});
 vm.runInContext(html.slice(from,to),geom);
 assert.deepEqual({...geom.shapeOf({mfrac:.6})},{m:{w:90,h:100},w:.9,h:1});
});

test('animal heights include the highest visible head, ears, mane, horns, or antlers',()=>{
 const expected={
  horse:6.75*.3048,lion:5.25*.3048,tiger:4.25*.3048,elephant:12*.3048,moose:8*.3048,
  camel:7.5*.3048,bison:6.3*.3048,greatdane:3.7*.3048,hippo:1.55,cow:1.68,rhino:1.98,
  mammoth:3.66,cat:.335,chihuahua:.305,labrador:.76,
  polarbear:10*.3048,grizzly:8.5*.3048
 };
 for(const [id,height] of Object.entries(expected)) {
  assert.ok(Math.abs(get(id).height-height)<1e-9,id+' total visible height');
  assert.doesNotMatch(get(id).note,/shoulder|withers|hip height/i,id+' avoids a partial-body convention');
  if(data.STD.some(row=>row[0]===id)) assert.equal(get(id).row.length,8,id+' has no hidden measurement fraction');
 }
});

test('other illustrations no longer stop at an internal measurement point',()=>{
 assert.equal(get('hoop').height,13*.3048);
 assert.match(get('hoop').note,/top of the backboard/i);
 assert.equal(get('empire').height,1454*.3048);
 assert.match(get('empire').note,/top of its antenna/i);
 assert(Math.abs(get('counter').height-1.097)<1e-9);
 assert.match(get('counter').note,/top of the visible backsplash/i);
 assert.equal(get('triceratops').height,12*.3048);
 assert.match(get('triceratops').note,/top of its horns/i);
 assert(Math.abs(get('ttable').height-.9144)<1e-9);
 assert.match(get('ttable').note,/top of the net/i);
 assert(Math.abs(get('pisa').height-61.6)<1e-9);
 assert.match(get('pisa').note,/top of the flag/i);
 assert.equal(get('fury325').height,335*.3048);
 assert.match(get('fury325').note,/top of the decorative marker/i);
});

test('sprite alpha bounds remain the sole artwork crop; legacy fractions are gone',()=>{
 const source=fs.readFileSync(path.join(root,'assets/stickers-v1/manifest.js'),'utf8');
 assert.doesNotMatch(source,/measurementFraction/);
 assert.doesNotMatch(html,/measurementFraction|mfrac/);
});
