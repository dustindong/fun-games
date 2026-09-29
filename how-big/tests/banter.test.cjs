// Run with: node --test how-big/tests/banter.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const from=source.indexOf('function roundBanter('),to=source.indexOf('/* ---------------- helpers ---------------- */',from);
const context=vm.createContext({});
vm.runInContext(source.slice(from,to),context);
const roundBanter=context.roundBanter;
const entry=(name,g)=>({pl:{name},rec:{g}});

test('round banter calls out shared underestimates and close clusters',()=>{
 assert.equal(roundBanter([entry('A',1.5),entry('B',1.8)],2),'EVERYONE UNDERESTIMATED THIS');
 assert.equal(roundBanter([entry('A',1.9),entry('B',2.1),entry('C',1)],2),'2 PLAYERS WITHIN 10%');
});
test('round banter calls out huge misses and nobody close',()=>{
 assert.equal(roundBanter([entry('Dustin',5.4),entry('Ling',2)],2),'DUSTIN WENT HUGE — 2.7× TOO TALL');
 assert.equal(roundBanter([entry('A',.5),entry('B',2.8)],2),'NOBODY WAS EVEN CLOSE');
});
test('round banter falls back to the most accurate player and handles no answers',()=>{
 assert.equal(roundBanter([entry('Ling',2.04),entry('Dustin',1.7)],2),'LING WAS 2.0% OFF');
 assert.equal(roundBanter([{pl:{name:'No answer'},rec:{g:null}}],2),'NOBODY EVEN TOOK A SWING');
});
