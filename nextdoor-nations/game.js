(() => {
'use strict';

const DATA = window.NN_DATA;
const ROUNDS = 10, SECONDS = 25, REVEAL_MS = 9000, MAX_PLAYERS = 16;
const COLORS = ['#E4572E','#3A7FD0','#23905A','#9B5DE5','#D99A00','#D6337F','#12A4B6','#7F8F2A','#C0632B','#5C6BC0'];
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
const rid = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const LS = {
  get(k) {
    try {
      return localStorage.getItem('nextdoor.' + k) || (k === 'name' ? (localStorage.getItem('orderup.name') || localStorage.getItem('sizeup.name')) : null);
    } catch { return null; }
  },
  set(k, v) {
    try { v == null ? localStorage.removeItem('nextdoor.' + k) : localStorage.setItem('nextdoor.' + k, v); } catch {}
  }
};

let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, 3400);
}

const countryByKey = new Map();
DATA.countries.forEach(c => countryByKey.set(norm(c), c));
Object.keys(DATA.answerAliases).forEach(k => countryByKey.set(norm(k), DATA.answerAliases[k]));
function resolveCountry(value) { return countryByKey.get(norm(value)) || null; }

let world = null, features = [], featureByKey = new Map(), usableRoutes = [];
let mapReady = false, mapFailed = false;

function featureFor(name) {
  const tries = [name].concat(DATA.geometryAliases[name] || []);
  for (const n of tries) {
    const f = featureByKey.get(norm(n));
    if (f) return f;
  }
  return null;
}

function routeObject(r) {
  return {from:r[0], city:r[1], lon:r[2], lat:r[3], d:r[4], targets:r[5].slice()};
}

async function loadMap() {
  if (!window.d3 || !window.topojson || !DATA) throw new Error('Map libraries unavailable');
  const res = await fetch(WORLD_URL, {cache:'force-cache'});
  if (!res.ok) throw new Error('Map data unavailable');
  world = await res.json();
  features = topojson.feature(world, world.objects.countries).features;
  featureByKey = new Map(features.map(f => [norm(f.properties && f.properties.name), f]));

  const geoms = world.objects.countries.geometries;
  const neighbors = topojson.neighbors(geoms);
  const geoIndex = new Map();
  geoms.forEach((g, i) => geoIndex.set(norm(g.properties && g.properties.name), i));
  function idxFor(name) {
    const tries = [name].concat(DATA.geometryAliases[name] || []);
    for (const n of tries) {
      const i = geoIndex.get(norm(n));
      if (i != null) return i;
    }
    return null;
  }

  usableRoutes = DATA.routes.map(routeObject).map(r => {
    const fi = idxFor(r.from);
    if (fi == null || !featureFor(r.from)) return null;
    r.targets = r.targets.filter(t => {
      const ti = idxFor(t);
      return ti != null && featureFor(t) && neighbors[fi] && neighbors[fi].includes(ti);
    });
    return r.targets.length ? r : null;
  }).filter(Boolean);

  if (usableRoutes.length < ROUNDS) throw new Error('Not enough map routes');
  mapReady = true;
  mapFailed = false;
  setNet();
  drawDemo();
}

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(10, rect.width), h = Math.max(10, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rw = Math.round(w * dpr), rh = Math.round(h * dpr);
  if (canvas.width !== rw || canvas.height !== rh) { canvas.width = rw; canvas.height = rh; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  return {ctx,w,h};
}

function drawArrow(ctx, x1, y1, x2, y2, color) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = 14;
  const neckX = x2 - Math.cos(a) * 10;
  const neckY = y2 - Math.sin(a) * 10;

  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  // dark halo behind the shaft
  ctx.strokeStyle = 'rgba(0,0,0,.48)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(neckX,neckY);
  ctx.stroke();

  // yellow shaft stops cleanly at the base of the arrowhead
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(neckX,neckY);
  ctx.stroke();

  // arrowhead shadow
  ctx.fillStyle = 'rgba(0,0,0,.48)';
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(a-Math.PI/6), y2-head*Math.sin(a-Math.PI/6));
  ctx.lineTo(x2-head*Math.cos(a+Math.PI/6), y2-head*Math.sin(a+Math.PI/6));
  ctx.closePath();
  ctx.fill();

  // clean arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(a-Math.PI/6), y2-head*Math.sin(a-Math.PI/6));
  ctx.lineTo(x2-head*Math.cos(a+Math.PI/6), y2-head*Math.sin(a+Math.PI/6));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function roundFeature(r, key) { return featureFor(r[key]); }

function nearestProjectedPoint(feature, projection, origin) {
  if (!feature || !feature.geometry) return null;
  let best = null, bestD = Infinity;

  function visit(coords) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number') {
      const p = projection(coords);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
      const dx = p[0] - origin[0], dy = p[1] - origin[1];
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
      return;
    }
    for (const c of coords) visit(c);
  }

  visit(feature.geometry.coordinates);
  return best;
}
function mainLand(f) {
  if (!f || !f.geometry || f.geometry.type !== 'MultiPolygon') return f;
  let best = null, area = -1;
  for (const coords of f.geometry.coordinates) {
    const p = {type:'Feature', properties:f.properties, geometry:{type:'Polygon', coordinates:coords}};
    const a = d3.geoArea(p);
    if (a > area) { area = a; best = p; }
  }
  return best || f;
}

function drawRoundMap(canvas, r, reveal) {
  if (!mapReady || !canvas || !r) return;
  const fromF = roundFeature(r, 'from'), toF = roundFeature(r, 'to');
  if (!fromF || !toF) return;

  const fromMain = mainLand(fromF), toMain = mainLand(toF);
  const s = prepareCanvas(canvas), ctx = s.ctx, w = s.w, h = s.h;
  const padX = Math.max(42, w * .075), padY = Math.max(34, h * .085);

  // Frame the starting country, the destination neighbor and the city together.
  // This guarantees the clue can never be projected off-screen.
  const focus = {
    type: 'FeatureCollection',
    features: [
      fromMain,
      toMain,
      {type:'Feature', properties:{}, geometry:{type:'Point', coordinates:[r.lon,r.lat]}}
    ]
  };
  const projection = d3.geoMercator().fitExtent([[padX,padY],[w-padX,h-padY]], focus);
  const path = d3.geoPath(projection, ctx);

  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,w,h); ctx.clip();
  ctx.fillStyle = css('--map'); ctx.fillRect(0,0,w,h);

  // Draw the world underneath, but fade it so the clue countries dominate.
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  for (const f of features) {
    ctx.beginPath(); path(f);
    ctx.fillStyle = css('--neighbor'); ctx.fill();
    ctx.strokeStyle = css('--line'); ctx.stroke();
  }

  // Strong start-country treatment: bright fill, blue outline and glow.
  ctx.save();
  ctx.shadowColor = css('--blue');
  ctx.shadowBlur = 14;
  ctx.beginPath(); path(fromF);
  ctx.fillStyle = css('--blue2'); ctx.fill();
  ctx.strokeStyle = css('--blue'); ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();

  if (reveal) {
    ctx.save();
    ctx.shadowColor = css('--green');
    ctx.shadowBlur = 12;
    ctx.beginPath(); path(toF);
    ctx.fillStyle = css('--greenBg'); ctx.fill();
    ctx.strokeStyle = css('--green'); ctx.lineWidth = 3.5; ctx.stroke();
    ctx.restore();
  }

  const city = projection([r.lon, r.lat]);
  const target = city ? nearestProjectedPoint(toMain, projection, city) : null;
  if (city && target && Number.isFinite(city[0]) && Number.isFinite(target[0])) {
    const dx = target[0]-city[0], dy = target[1]-city[1], mag = Math.hypot(dx,dy) || 1;
    const ux = dx/mag, uy = dy/mag;

    // Keep this deliberately short: it is only a directional clue.
    // Aim at the nearest edge of the chosen neighboring country, not its center.
    const len = Math.min(62, Math.max(48, Math.min(w,h) * .105));
    const startX = city[0] + ux*11, startY = city[1] + uy*11;
    const endX = city[0] + ux*len, endY = city[1] + uy*len;
    drawArrow(ctx,startX,startY,endX,endY,css('--yellow'));

    // Large city halo + dot.
    ctx.beginPath(); ctx.arc(city[0],city[1],12,0,Math.PI*2);
    ctx.fillStyle = 'rgba(244,190,54,.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(city[0],city[1],7,0,Math.PI*2);
    ctx.fillStyle = css('--yellow'); ctx.fill();
    ctx.strokeStyle = css('--yellowInk'); ctx.lineWidth = 2.5; ctx.stroke();

    ctx.font = '600 12px "IBM Plex Mono", monospace';
    const label = r.city;
    const tw = ctx.measureText(label).width;
    let lx = city[0] + 13, ly = city[1] - 17;
    if (lx + tw + 16 > w) lx = city[0] - tw - 25;
    if (ly < 18) ly = city[1] + 27;
    ctx.fillStyle = css('--surface');
    ctx.strokeStyle = css('--line');
    ctx.lineWidth = 1;
    const bx = lx-6, by = ly-13, bw = tw+12, bh = 21;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,4); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(bx,by,bw,bh); ctx.strokeRect(bx,by,bw,bh); }
    ctx.fillStyle = css('--ink'); ctx.fillText(label,lx,ly+1);
  }
  ctx.restore();
}

function demoRound() {
  return {from:'France',city:'Paris',lon:2.3522,lat:48.8566,to:'Germany',d:1};
}
function drawDemo() { if (screen === 'home' && mapReady) drawRoundMap($('#demo'), demoRound(), false); }

function makeRounds(n) {
  const buckets = {1:shuffle(usableRoutes.filter(r=>r.d===1).slice()),2:shuffle(usableRoutes.filter(r=>r.d===2).slice()),3:shuffle(usableRoutes.filter(r=>r.d===3).slice())};
  const plan = [1,1,2,1,2,2,1,3,2,3];
  const out = [], usedFrom = new Set(), usedTo = new Set();
  for (let i=0;i<n;i++) {
    let d = plan[i % plan.length], pool = buckets[d].filter(r=>!usedFrom.has(r.from));
    if (!pool.length) pool = usableRoutes.filter(r=>!usedFrom.has(r.from));
    if (!pool.length) { usedFrom.clear(); pool = usableRoutes.slice(); }
    const r = pick(pool);
    usedFrom.add(r.from);
    let choices = r.targets.filter(t=>!usedTo.has(t));
    if (!choices.length) choices = r.targets.slice();
    const to = pick(choices);
    usedTo.add(to);
    out.push({from:r.from,city:r.city,lon:r.lon,lat:r.lat,to:to,d:r.d});
    Object.keys(buckets).forEach(k => {
      const idx = buckets[k].indexOf(r);
      if (idx >= 0) buckets[k].splice(idx,1);
    });
  }
  return out;
}

function scoreAnswer(a, r, ms) {
  if (!a || a !== r.to) return 0;
  const speed = Math.max(0, Math.round(50 * (1 - Math.min(ms,SECONDS*1000)/(SECONDS*1000))));
  return 100 + speed;
}
function difficultyText(d) { return d === 1 ? 'Easy' : d === 2 ? 'Medium' : 'Hard'; }

/* tiny in-memory store: host owns it, guests mirror it */
function makeMemDB(onChange) {
  const docs = new Map(), subs = new Set();
  const snap = p => { const d = docs.get(p); return {id:p.split('/').pop(),exists:!!d,data:()=>d&&structuredClone(d)}; };
  const ping = () => queueMicrotask(() => { subs.forEach(f=>f()); if (onChange) onChange(); });
  const merge = (a,b) => { for (const k in b) { const v=b[k]; if (v && typeof v==='object' && !Array.isArray(v) && a[k] && typeof a[k]==='object' && !Array.isArray(a[k])) merge(a[k],v); else a[k]=structuredClone(v); } };
  const listen = f => { subs.add(f); queueMicrotask(f); return ()=>subs.delete(f); };
  const docRef = p => ({path:p,id:p.split('/').pop(),get:async()=>snap(p),set:async d=>{docs.set(p,structuredClone(d));ping();},update:async d=>{const cur=docs.get(p);if(!cur)throw {code:'invalid_argument'};merge(cur,d);ping();},delete:async()=>{docs.delete(p);ping();},onSnapshot:next=>listen(()=>next(snap(p)))});
  const query = cp => { const out=[]; for (const p of docs.keys()) if (p.slice(0,p.lastIndexOf('/'))===cp) out.push(snap(p)); return {docs:out,size:out.length,empty:!out.length}; };
  return {doc:docRef,collection:cp=>({path:cp,doc:id=>docRef(cp+'/'+(id||rid(10))),get:async()=>query(cp),onSnapshot:next=>listen(()=>next(query(cp)))}),dump:()=>Object.fromEntries(docs),load:obj=>{docs.clear();Object.keys(obj).forEach(k=>docs.set(k,obj[k]));ping();}};
}
function makeGuestDB(mirror, send) {
  return {doc:p=>({...mirror.doc(p),set:async d=>send({t:'write',op:'set',path:p,data:d}),update:async d=>send({t:'write',op:'update',path:p,data:d}),delete:async()=>send({t:'write',op:'delete',path:p})}),collection:cp=>mirror.collection(cp)};
}

let db=null, mode=null, code=null, room=null, players=[], unsubs=[], screen='home';
let local={key:null}, hostT={key:null,t:null,busy:false};
const me={pid:LS.get('pid')||rid(10),name:LS.get('name')||''};
LS.set('pid',me.pid);

const isHost = () => !!room && room.host===me.pid;
const mine = () => players.find(p=>p.pid===me.pid);
const activePlayers = () => players.filter(p=>p.online!==false);
const scoreRec = (p,i) => p && p.scores && room && p.scores[room.game] && p.scores[room.game]['r'+i];
const totalOf = p => {
  const g = p && p.scores && room && p.scores[room.game];
  return g ? Object.values(g).reduce((t,x)=>t+(x && x.p || 0),0) : 0;
};

function show(name) {
  if (screen!==name) window.scrollTo(0,0);
  screen=name;
  ['home','lobby','round','final'].forEach(s=>$('#scr-'+s).hidden=s!==name);
  const inRoom=name!=='home';
  $('#btn-leave').hidden=!inRoom; $('#btn-hub').hidden=inRoom; $('#room-chip').hidden=!inRoom;
  $('#room-chip').textContent=mode==='solo'?'Solo practice':'Room '+(code||'');
  $('#btn-leave').textContent=mode==='solo'?'Quit':mode==='host'?'Close room':'Leave room';
  document.body.classList.toggle('in-room',inRoom);
  keepAwake(inRoom);
  if (name==='home') requestAnimationFrame(drawDemo);
}

/* PeerJS room networking */
const PeerCtor = window.Peer || (window.peerjs && window.peerjs.Peer);
const PEER_PREFIX='nextdoor-nations-v1-';
const peerOpts=(()=>{
  const o={debug:0}, q=new URLSearchParams(location.search).get('peer');
  if(q){const bits=q.split(':');const port=+bits[1]||443;Object.assign(o,{host:bits[0],port:port,path:'/',secure:port===443});}
  return o;
})();
let peer=null, hostConn=null;
const conns=new Map();

function cleanupPeer() {
  const p=peer; hostConn=null; peer=null;
  for(const c of conns.values()) try{c.close();}catch{}
  conns.clear();
  if(p) try{p.destroy();}catch{}
}
function broadcast() {
  if(mode!=='host'||!db)return;
  const msg={t:'state',docs:db.dump()};
  for(const c of conns.values()) if(c.open) try{c.send(msg);}catch{}
}
function genCode(){return Array.from(crypto.getRandomValues(new Uint8Array(4)),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[b%24]).join('');}
function openHostPeer(c){
  return new Promise((resolve,reject)=>{
    const p=new PeerCtor(PEER_PREFIX+c.toLowerCase(),peerOpts);
    const timer=setTimeout(()=>{p.off('error',onErr);try{p.destroy();}catch{}reject({type:'timeout'});},12000);
    const onErr=e=>{clearTimeout(timer);p.off('error',onErr);try{p.destroy();}catch{}reject(e);};
    p.on('error',onErr);
    p.on('open',()=>{clearTimeout(timer);p.off('error',onErr);resolve(p);});
  });
}
async function hostHandle(conn,msg){
  if(!msg||typeof msg!=='object'||!code||mode!=='host')return;
  if(msg.t==='hello'){
    const pid=String(msg.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24);
    if(!pid||pid===me.pid){try{conn.send({t:'error',reason:'dup'});}catch{}return;}
    const name=String(msg.name||'').replace(/\s+/g,' ').trim().slice(0,16)||'Player';
    const ref=db.doc('rooms/'+code+'/players/'+pid), s=await ref.get();
    if(!s.exists&&players.length>=MAX_PLAYERS){try{conn.send({t:'error',reason:'full'});}catch{}return;}
    const old=conns.get(pid); if(old&&old!==conn){old.pid=null;try{old.close();}catch{}}
    conn.pid=pid;conns.set(pid,conn);
    if(s.exists)await ref.update({name:name,online:true});
    else{const taken=new Set(players.map(p=>p.color));await ref.set({pid:pid,name:name,color:COLORS.find(x=>!taken.has(x))||pick(COLORS),joined:Date.now(),online:true,scores:{}});}
    try{conn.send({t:'state',docs:db.dump()});}catch{}
    return;
  }
  if(!conn.pid)return;
  const own='rooms/'+code+'/players/'+conn.pid;
  if(msg.t==='write'&&msg.op==='update'&&msg.path===own&&room&&room.game&&room.phase!=='final'){
    const rec=msg.data && msg.data.scores && msg.data.scores[room.game] && msg.data.scores[room.game]['r'+room.round];
    const pl=players.find(p=>p.pid===conn.pid);
    if(!rec||!pl||scoreRec(pl,room.round))return;
    const a=rec.a==null?null:resolveCountry(rec.a);
    if(rec.a!=null&&!a)return;
    const ms=Math.max(0,Math.min(SECONDS*1000,Date.now()-(room.at||Date.now())));
    const p=scoreAnswer(a,room.rounds[room.round],ms);
    await db.doc(own).update({scores:{[room.game]:{['r'+room.round]:{a:a,p:p,ms:ms}}}});
  }else if(msg.t==='bye'){
    if(conns.get(conn.pid)===conn)conns.delete(conn.pid);
    await db.doc(own).delete();
    try{conn.close();}catch{}
  }
}
function hostDrop(conn){
  if(mode!=='host'||!conn.pid||conns.get(conn.pid)!==conn)return;
  conns.delete(conn.pid);
  const ref=db.doc('rooms/'+code+'/players/'+conn.pid);
  ref.get().then(s=>{if(s.exists)ref.update({online:false});});
}
function onGuestConn(conn){conn.on('data',msg=>hostHandle(conn,msg));conn.on('close',()=>hostDrop(conn));conn.on('error',()=>hostDrop(conn));}
function connectAsGuest(c){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=new PeerCtor(peerOpts);peer=p;
    const fail=msg=>{if(settled)return;settled=true;clearTimeout(timer);try{p.destroy();}catch{}reject(new Error(msg));};
    const timer=setTimeout(()=>fail("Couldn't reach room "+c+". Check the code and make sure the host still has the game open."),15000);
    p.on('error',e=>{if(e&&e.type==='peer-unavailable')fail('No room called '+c+' is open right now.');else if(!settled)fail("Couldn't connect. Check your internet connection and try again.");});
    p.on('open',()=>{
      const conn=p.connect(PEER_PREFIX+c.toLowerCase(),{reliable:true,serialization:'json'});hostConn=conn;
      const mirror=makeMemDB();
      const send=async d=>{if(!conn.open)throw {code:'unavailable'};conn.send(d);};
      conn.on('open',()=>conn.send({t:'hello',pid:me.pid,name:me.name}));
      conn.on('data',msg=>{
        if(msg&&msg.t==='state'&&msg.docs&&typeof msg.docs==='object'){
          mirror.load(msg.docs);
          if(!settled){settled=true;clearTimeout(timer);mode='guest';db=makeGuestDB(mirror,send);LS.set('room',c);enterRoom(c);resolve();}
        }else if(msg&&msg.t==='error'){
          fail(msg.reason==='dup'?"You're already in this room in another tab.":msg.reason==='full'?'That room is full ('+MAX_PLAYERS+' players max).':"Couldn't join that room.");
        }else if(msg&&msg.t==='closed'&&hostConn===conn){
          LS.set('room',null);toast('The host closed the room.');exitToHome();
        }
      });
      conn.on('close',()=>{if(!settled){fail("Couldn't reach room "+c+'.');return;}if(hostConn===conn){toast('Lost the connection to the host, so the game ended.');exitToHome();}});
    });
  });
}

function stopSubs(){unsubs.forEach(u=>{try{u();}catch{}});unsubs=[];}
function enterRoom(c){
  stopSubs();code=c;room=null;players=[];local={key:null};
  unsubs.push(db.doc('rooms/'+c).onSnapshot(s=>{if(!s.exists){if(code){toast('This room has closed.');exitToHome();}return;}room=s.data();sync();}));
  unsubs.push(db.collection('rooms/'+c+'/players').onSnapshot(q=>{players=q.docs.filter(d=>d.exists).map(d=>d.data()).sort((a,b)=>(a.joined||0)-(b.joined||0));sync();}));
}
function exitToHome(){
  stopSubs();clearTimeout(hostT.t);hostT={key:null,t:null,busy:false};cleanupPeer();
  code=null;room=null;players=[];local={key:null};mode=null;db=null;show('home');setNet();
}
async function withBusy(btn,fn){btn.disabled=true;try{await fn();}finally{btn.disabled=false;setNet();}}
function readName(){
  const n=$('#nm').value.trim().replace(/\s+/g,' ').slice(0,16);
  if(!n){homeErr('Add your name first.');$('#nm').focus();return false;}
  me.name=n;LS.set('name',n);return true;
}
function homeErr(msg){const e=$('#home-err');e.textContent=msg||'';e.hidden=!msg;}
async function createRoom(){
  homeErr();
  if(!mapReady||!readName()||!PeerCtor)return;
  let p=null,c='';
  for(let i=0;i<5&&!p;i++){c=genCode();try{p=await openHostPeer(c);}catch(e){if(!e||e.type!=='unavailable-id'){homeErr("Couldn't open a room. Check your internet connection and try again.");return;}}}
  if(!p){homeErr("Couldn't open a room. Try again.");return;}
  peer=p;mode='host';db=makeMemDB(broadcast);
  p.on('connection',onGuestConn);
  p.on('disconnected',()=>setTimeout(()=>{if(peer===p&&!p.destroyed)try{p.reconnect();}catch{}},1500));
  p.on('error',()=>{});
  await db.doc('rooms/'+c).set({code:c,host:me.pid,phase:'lobby',game:'',round:0,rounds:[],created:Date.now()});
  await db.doc('rooms/'+c+'/players/'+me.pid).set({pid:me.pid,name:me.name,color:COLORS[0],joined:Date.now(),online:true,scores:{}});
  enterRoom(c);
}
async function joinRoom(){
  homeErr();
  if(!mapReady||!readName()||!PeerCtor)return;
  const c=$('#code-in').value.trim().toUpperCase();
  if(!/^[A-Z]{4}$/.test(c)){homeErr('Room codes are 4 letters. Ask your host for theirs.');$('#code-in').focus();return;}
  $('#net-note').textContent='Connecting to room '+c+'…';
  try{await connectAsGuest(c);}catch(e){homeErr(e.message);}finally{setNet();}
}
async function startSolo(){
  homeErr();if(!mapReady)return;
  me.name=$('#nm').value.trim().slice(0,16)||'You';LS.set('name',me.name);
  mode='solo';db=makeMemDB();
  await db.doc('rooms/SOLO').set({code:'SOLO',host:me.pid,phase:'lobby',game:'',round:0,rounds:[],created:Date.now()});
  await db.doc('rooms/SOLO/players/'+me.pid).set({pid:me.pid,name:me.name,color:COLORS[0],joined:Date.now(),online:true,scores:{}});
  enterRoom('SOLO');await startGame();
}
function leave(){
  const m=mode;
  if(m==='guest'&&hostConn&&hostConn.open)try{hostConn.send({t:'bye'});}catch{}
  if(m==='host')for(const c of conns.values())try{c.send({t:'closed'});}catch{}
  if(m==='guest')LS.set('room',null);
  const p=peer,list=[...conns.values()];peer=null;hostConn=null;conns.clear();exitToHome();
  setTimeout(()=>{list.forEach(c=>{try{c.close();}catch{}});if(p)try{p.destroy();}catch{}},350);
}
async function startGame(){
  if(!db||(!isHost()&&mode!=='solo')||!mapReady)return;
  await db.doc('rooms/'+code).update({phase:'play',game:'g'+rid(6),round:0,rounds:makeRounds(ROUNDS),at:Date.now()});
}
function hostDuty(){
  if(!room||!isHost()||mode==='guest'){clearTimeout(hostT.t);hostT={key:null,t:null,busy:false};return;}
  const key=room.phase+'|'+room.game+'|'+room.round;
  if(hostT.key!==key){
    clearTimeout(hostT.t);hostT={key:key,t:null,busy:false};
    if(room.phase==='play')hostT.t=setTimeout(()=>advance(key),(SECONDS+2)*1000);
    if(room.phase==='reveal')hostT.t=setTimeout(()=>advance(key),REVEAL_MS);
  }
  const act=activePlayers();
  if(room.phase==='play'&&act.length&&act.every(p=>!!scoreRec(p,room.round)))advance(key);
}
async function advance(key){
  if(!room||!isHost()||hostT.busy||hostT.key!==key)return;
  hostT.busy=true;let patch=null;
  if(room.phase==='play')patch={phase:'reveal',at:Date.now()};
  else if(room.phase==='reveal')patch=room.round+1>=room.rounds.length?{phase:'final',at:Date.now()}:{phase:'play',round:room.round+1,at:Date.now()};
  if(!patch){hostT.busy=false;return;}
  await db.doc('rooms/'+code).update(patch);
}

function syncLocal(){
  const key=room.game+'|'+room.round;
  if(local.key===key)return;
  const rec=scoreRec(mine(),room.round);
  local={key:key,start:performance.now(),selected:rec&&rec.a||null,locked:!!rec,submitted:!!rec,revealAt:0};
  $('#answer').value=rec&&rec.a||'';
  hideSuggestions();
}

async function submit(manual){
  if(local.submitted||!room||room.phase==='final')return;
  const a=local.selected||resolveCountry($('#answer').value);
  if(manual&&!a){$('#answer').focus();toast('Choose a country from the list first.');return;}
  hideSuggestions();local.locked=true;local.submitted=true;renderRound();
  const ms=Math.max(0,Math.min(SECONDS*1000,Date.now()-(room.at||Date.now())));
  const p=scoreAnswer(a,room.rounds[room.round],ms);
  const body={scores:{[room.game]:{['r'+room.round]:{a:a,p:p,ms:ms}}}};
  try{await db.doc('rooms/'+code+'/players/'+me.pid).update(body);}catch{local.submitted=false;local.locked=false;toast("Couldn't submit. Try again.");renderRound();}
}

function sync(){
  if(!room)return;
  if(room.phase==='lobby'){show('lobby');renderLobby();}
  else if(room.phase==='play'||room.phase==='reveal'){
    if(!room.rounds||!room.rounds[room.round])return;
    syncLocal();
    if(room.phase==='reveal'){
      if(!local.submitted)submit(false);
      if(!local.revealAt)local.revealAt=performance.now();
    }
    show('round');renderRound();
  }else if(room.phase==='final'){show('final');renderFinal();}
  hostDuty();
}
function renderLobby(){
  $('#lb-code').innerHTML=String(code||'').split('').map(c=>'<span>'+esc(c)+'</span>').join('');
  $('#lb-players').innerHTML=players.map(p=>'<li class="'+(p.online===false?'away':'')+'"><i class="dot" style="background:'+esc(p.color)+'"></i><span class="nm">'+esc(p.name)+'</span>'+(p.pid===room.host?'<span class="tag">host</span>':'')+(p.pid===me.pid?'<span class="tag">you</span>':'')+(p.online===false?'<span class="tag">away</span>':'')+'</li>').join('');
  const host=isHost(), hp=players.find(p=>p.pid===room.host);
  $('#btn-start').hidden=!host;$('#btn-start').disabled=!players.length;
  $('#lb-wait').hidden=host;$('#lb-link').value=inviteLink();
  $('#lb-share').textContent=host?'Send the invite link or room code. Keep this tab open: the room runs in your browser.':"You're in. The game ends if the host closes their tab.";
  $('#lb-wait').textContent=hp?'Waiting for '+hp.name+' to start the game':'Waiting for the host to start the game';
}
function renderRound(){
  if(!room||screen!=='round')return;
  const r=room.rounds[room.round], reveal=room.phase==='reveal', rec=scoreRec(mine(),room.round);
  $('#rb-num').textContent=room.round+1;$('#rb-of').textContent='/'+room.rounds.length;
  $('#rb-score').textContent=totalOf(mine())-(reveal||!rec?0:(rec.p||0));
  $('#from-name').textContent=r.from;$('#difficulty').textContent=difficultyText(r.d);
  $('#map-overlay').textContent=r.city+' • '+r.from+(reveal?' → '+r.to:' → ?');
  drawRoundMap($('#game-map'),r,reveal);

  $('#play-ui').hidden=reveal;$('#reveal').hidden=!reveal;
  if(!reveal){
    $('#answer').disabled=local.locked;$('#btn-lock').disabled=local.locked||!local.selected;
    const w=$('#waiting');w.hidden=!local.locked;
    if(!w.hidden){
      const left=activePlayers().filter(p=>!scoreRec(p,room.round)).map(p=>p.name);
      w.innerHTML=mode==='solo'?'<b>Locked in.</b> Revealing…':left.length?'<b>Locked in.</b> Waiting on '+esc(left.join(', '))+'.':'<b>Locked in.</b> Everyone is ready.';
    }
  }else{
    const a=rec&&rec.a||null,p=rec&&rec.p||0;
    $('#rv-answer').textContent=r.to;
    $('#rv-yours').innerHTML=a?'You chose <strong>'+esc(a)+'</strong>.':'You did not lock in an answer.';
    $('#rv-points').textContent='+'+p+' pts';
    $('#rv-note').textContent=r.city+', '+r.from+' points toward '+r.to+'. Correct answers are worth 100 points plus up to 50 for speed.';
    const rows=players.map(pl=>({pl:pl,rec:scoreRec(pl,room.round)})).sort((a,b)=>(b.rec&&b.rec.p||-1)-(a.rec&&a.rec.p||-1));
    $('#rv-list').innerHTML=rows.map(x=>'<li><i class="dot" style="background:'+esc(x.pl.color)+'"></i><span class="nm">'+esc(x.pl.name)+'</span><span class="ans">'+esc(x.rec&&x.rec.a||'No answer')+'</span><span class="pts">'+(x.rec&&x.rec.p||0)+'</span></li>').join('');
    const last=room.round+1>=room.rounds.length;
    $('#btn-next').hidden=!isHost();$('#btn-next').textContent=last?'See final scores':'Next round';
  }
}
function renderFinal(){
  const rows=players.map(p=>({p:p,total:totalOf(p),per:room.rounds.map((_,i)=>scoreRec(p,i)&&scoreRec(p,i).p||0)})).sort((a,b)=>b.total-a.total||a.p.name.localeCompare(b.p.name));
  if(rows.length===1){$('#fn-title').textContent=rows[0].total+' points';$('#fn-sub').textContent='Nice run. Geography brain officially warmed up.';}
  else{$('#fn-title').textContent=rows.length&&rows[0].p.name?rows[0].p.name+' wins!':'Game over';$('#fn-sub').textContent=rows.length?'Final score: '+rows[0].total+' points.':'Thanks for playing.';}
  $('#fn-board').innerHTML=rows.map((r,i)=>'<li class="'+(i===0&&rows.length>1?'win':'')+'"><span class="rank">'+(i+1)+'</span><i class="dot" style="background:'+esc(r.p.color)+'"></i><span class="nm">'+esc(r.p.name)+(r.p.pid===me.pid?' <span class="tag">you</span>':'')+'</span><span class="bars">'+r.per.map(v=>'<s style="--v:'+v+'"></s>').join('')+'</span><span class="total">'+r.total+'</span></li>').join('');
  $('#btn-again').hidden=!isHost();
  const hp=players.find(p=>p.pid===room.host);$('#fn-wait').hidden=isHost();$('#fn-wait').textContent=(hp?hp.name:'The host')+' can start another game.';
}

/* autocomplete */
let suggestions=[], activeSuggestion=-1;
function matchesFor(q){
  const k=norm(q);
  if(!k)return [];
  return DATA.countries.map(c=>({c:c,k:norm(c)})).filter(x=>x.k.startsWith(k)||x.k.includes(k)).sort((a,b)=>{
    const as=a.k.startsWith(k)?0:1,bs=b.k.startsWith(k)?0:1;return as-bs||a.c.length-b.c.length||a.c.localeCompare(b.c);
  }).slice(0,8).map(x=>x.c);
}
function hideSuggestions(){suggestions=[];activeSuggestion=-1;$('#suggestions').hidden=true;$('#suggestions').innerHTML='';}
function renderSuggestions(){
  const ul=$('#suggestions');
  if(!suggestions.length){hideSuggestions();return;}
  ul.innerHTML=suggestions.map((c,i)=>'<li role="option"><button type="button" data-i="'+i+'" class="'+(i===activeSuggestion?'active':'')+'">'+esc(c)+'</button></li>').join('');
  ul.hidden=false;
}
function selectSuggestion(c){
  local.selected=c;$('#answer').value=c;hideSuggestions();$('#btn-lock').disabled=local.locked||!local.selected;$('#btn-lock').focus();
}
$('#answer').addEventListener('input',e=>{
  if(local.locked)return;
  local.selected=resolveCountry(e.target.value);
  suggestions=matchesFor(e.target.value);activeSuggestion=-1;renderSuggestions();
  $('#btn-lock').disabled=!local.selected;
});
$('#answer').addEventListener('keydown',e=>{
  if($('#suggestions').hidden){
    if(e.key==='Enter'&&local.selected){e.preventDefault();$('#btn-lock').click();}
    return;
  }
  if(e.key==='ArrowDown'){e.preventDefault();activeSuggestion=Math.min(suggestions.length-1,activeSuggestion+1);renderSuggestions();}
  else if(e.key==='ArrowUp'){e.preventDefault();activeSuggestion=Math.max(0,activeSuggestion-1);renderSuggestions();}
  else if(e.key==='Enter'){e.preventDefault();if(activeSuggestion>=0)selectSuggestion(suggestions[activeSuggestion]);else if(local.selected){hideSuggestions();$('#btn-lock').click();}}
  else if(e.key==='Escape'){hideSuggestions();}
});
$('#suggestions').addEventListener('mousedown',e=>{const b=e.target.closest('button[data-i]');if(!b)return;e.preventDefault();selectSuggestion(suggestions[+b.dataset.i]);});
document.addEventListener('click',e=>{if(!e.target.closest('.answerbox'))hideSuggestions();});

let wakeLock=null;
async function keepAwake(on){
  try{
    if(on&&!wakeLock&&navigator.wakeLock&&document.visibilityState==='visible'){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;});}
    if(!on&&wakeLock){await wakeLock.release();wakeLock=null;}
  }catch{}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&screen!=='home')keepAwake(true);});

let lastSec=-1;
function frame(now){
  requestAnimationFrame(frame);
  if(screen!=='round'||!room)return;
  const timer=$('#timer'),fill=$('#timer-fill');
  if(room.phase==='play'){
    const left=Math.max(0,SECONDS-(now-local.start)/1000);
    fill.style.width=(left/SECONDS*100).toFixed(1)+'%';
    const sec=Math.ceil(left);
    if(sec!==lastSec){lastSec=sec;$('#timer-sec').textContent=sec+'s';timer.classList.toggle('low',left<=5);}
    if(left<=0&&!local.locked)submit(false);
  }else if(room.phase==='reveal'){
    fill.style.width='0%';timer.classList.remove('low');$('#timer-sec').textContent='';
    const left=Math.max(0,Math.ceil((REVEAL_MS-(now-local.revealAt))/1000));
    const key='r'+local.key+left;
    if(key!==String(lastSec)){lastSec=key;const last=room.round+1>=room.rounds.length;$('#rv-auto').textContent=left>0?(last?'Final scores':'Next round')+' in '+left+'s':'Moving on…';}
  }
}

function setNet(){
  const ready=mapReady, net=!!PeerCtor;
  $('#btn-create').disabled=!ready||!net;$('#btn-join').disabled=!ready||!net;$('#code-in').disabled=!ready||!net;$('#btn-solo').disabled=!ready;
  if(!ready)$('#net-note').textContent=mapFailed?"Couldn't load the map data. Reload the page to try again.":'Loading the world map…';
  else if(!net)$('#net-note').textContent="Couldn't load the multiplayer library, so rooms are off. Solo practice still works.";
  else $('#net-note').textContent='Browsers connect directly, so the host needs to keep their tab open for the whole game.';
}
function inviteLink(){const u=new URL(location.href);u.hash='';u.searchParams.set('room',code);return u.toString();}

$('#btn-create').addEventListener('click',e=>withBusy(e.currentTarget,createRoom));
$('#btn-join').addEventListener('click',e=>withBusy(e.currentTarget,joinRoom));
$('#btn-solo').addEventListener('click',e=>withBusy(e.currentTarget,startSolo));
$('#btn-leave').addEventListener('click',leave);
$('#btn-start').addEventListener('click',e=>withBusy(e.currentTarget,startGame));
$('#btn-again').addEventListener('click',e=>withBusy(e.currentTarget,startGame));
$('#btn-next').addEventListener('click',()=>advance(hostT.key));
$('#btn-lock').addEventListener('click',()=>submit(true));
$('#code-in').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btn-join').click();});
$('#code-in').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'');});
$('#btn-copy').addEventListener('click',async()=>{const link=inviteLink();try{await navigator.clipboard.writeText(link);toast('Invite link copied.');}catch{$('#lb-link').select();}});
window.addEventListener('beforeunload',e=>{if(mode==='host'&&conns.size){for(const c of conns.values())try{c.send({t:'closed'});}catch{}e.preventDefault();e.returnValue='';}});
window.addEventListener('resize',()=>{if(screen==='home')drawDemo();else if(screen==='round'&&room&&room.rounds&&room.rounds[room.round])drawRoundMap($('#game-map'),room.rounds[room.round],room.phase==='reveal');});

async function init(){
  $('#nm').value=me.name;setNet();
  const q=new URLSearchParams(location.search).get('room');
  if(q&&/^[a-z]{4}$/i.test(q))$('#code-in').value=q.toUpperCase();
  try{await loadMap();}catch(e){mapFailed=true;mapReady=false;setNet();console.error(e);return;}
  if(q&&/^[a-z]{4}$/i.test(q)){if(!me.name)$('#nm').focus();else $('#btn-join').focus();}
  const saved=LS.get('room');
  if(PeerCtor&&saved&&me.name&&screen==='home'){
    $('#net-note').textContent='Reconnecting to room '+saved+'…';
    try{await connectAsGuest(saved);}catch{LS.set('room',null);}finally{setNet();}
  }
}
requestAnimationFrame(frame);
init();
})();
