import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as game from '../game.mjs';
const fixture=JSON.parse(readFileSync(new URL('./server-fixtures.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
function setup(){
 const dom=new JSDOM(html,{url:'https://example.test/transformacion-en-tension/?sala=QA-FIXTURE',runScripts:'outside-only'});
 const w=dom.window,document=w.document;let current=0,joined=false,room={...fixture.room},failDecision=false,clipboard='',lastBlob=null;
 const requests=[],intervals=new Map();let intervalId=0;
 w.setInterval=(fn,ms)=>{intervals.set(++intervalId,{fn,ms});return intervalId;};w.clearInterval=id=>intervals.delete(id);
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.QRCode=class{static CorrectLevel={M:0};constructor(el,options){el.dataset.encoded=options.text;}};
 w.URL.createObjectURL=blob=>{lastBlob=blob;return 'blob:test-download';};w.URL.revokeObjectURL=()=>{};w.Blob=Blob;
 w.HTMLAnchorElement.prototype.click=function(){if(this.download)requests.push({download:this.download});};
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{clipboard=text;}}});
 let signedIn=null;const authListeners=[];
 w.testGame=game;w.testAuth={restore:async()=>signedIn,signIn:async(email,password)=>{if(password!=='valid-password')throw Error('Correo o contraseña incorrectos.');signedIn={uid:'fac-A',email};authListeners.forEach(fn=>fn(signedIn));return signedIn;},getToken:async()=>{if(!signedIn)throw Error('Inicia sesión como facilitador.');return 'test-firebase-token';},signOut:async()=>{signedIn=null;authListeners.forEach(fn=>fn(null));},observe:fn=>{authListeners.push(fn);return ()=>{};},authError:e=>e.message};
w.GAME_CONFIG={SUPABASE_URL:'https://database.test',SUPABASE_ANON_KEY:'publishable-test-key'};
 function snapshot(){const s=structuredClone(fixture.snapshots[current]);s.deadline=new Date(Date.now()+420000).toISOString();s.server_now=new Date().toISOString();return s;}
 w.fetch=async(url,options)=>{
  let req=JSON.parse(options.body);
  if(url.includes('/functions/v1/')){assert.equal(options.headers.Authorization,'Bearer test-firebase-token');req={p_action:req.action,p_code:req.code,p_data:req.data};}
  requests.push(req);
  let data;
  switch(req.p_action){
   case 'list':data=requests.some(r=>r.p_action==='create')?[room]:[];break;
   case 'create':room={...room,title:req.p_data.title,code:req.p_code};data=room;break;
   case 'room':data=room;break;
   case 'join':joined=true;data=snapshot();break;
   case 'host':data={room,teams:joined?[snapshot()]:[]};break;
   case 'status':room.status=req.p_data.status;data={room,teams:joined?[snapshot()]:[]};break;
   case 'team':data=snapshot();break;
   case 'leaderboard':{const s=snapshot();delete s.history;delete s.scores;data=[s];break;}
   case 'decide':if(failDecision){failDecision=false;throw new TypeError('Offline');}current=req.p_data.round*2-1;data=snapshot();break;
   case 'next':current=req.p_data.round*2;data=snapshot();break;
   default:throw Error('Unexpected action '+req.p_action);
  }
  return {ok:true,json:async()=>data};
 };
 w.eval('const {rounds,levers,metrics,roomLink,decisionsCsv}=window.testGame;const FacAuth=window.testAuth;\n'+app);
 return {w,document,requests,intervals,joinExternal:()=>{joined=true;},clipboard:()=>clipboard,blob:()=>lastBlob,failNextDecision:()=>{failDecision=true;},close:()=>dom.window.close()};
}
async function submit(document,id){document.querySelector(id).dispatchEvent(new document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await flush();}
async function login(ui){const d=ui.document;await click(d,'#facilitator-btn');assert.ok(d.querySelector('#login-screen').classList.contains('active'));d.querySelector('#fac-login-email').value='test@example.test';d.querySelector('#fac-login-password').value='valid-password';await submit(d,'#fac-login-form');assert.ok(d.querySelector('#fac-screen').classList.contains('active'));}
async function click(document,selector){const el=document.querySelector(selector);assert.ok(el,'Missing control '+selector);el.click();await flush();}

test('complete interface: room invitation, four rounds with debt, private decisions and CSV export',async()=>{
 const ui=setup(),{document:d}=ui;
 try{
  assert.equal(d.querySelector('#class-code').value,'QA-FIXTURE');
  await login(ui);d.querySelector('#room-title').value='Sala de prueba';d.querySelector('#new-code').value='QA-FIXTURE';
  await submit(d,'#room-form');assert.ok(d.querySelector('#host-screen').classList.contains('active'));
  assert.equal(d.querySelector('#host-team-count').textContent,'0');
  assert.equal(ui.requests.find(r=>r.p_action==='create').p_key,undefined);
  assert.equal(d.querySelector('#share-link').value,'https://example.test/transformacion-en-tension/?sala=QA-FIXTURE');
  assert.equal(d.querySelector('#room-qr').dataset.encoded,d.querySelector('#share-link').value);
  await click(d,'#copy-invite');assert.match(ui.clipboard(),/Código: QA-FIXTURE/);assert.ok(!ui.clipboard().includes('test-firebase-token'));
  await click(d,'#back-rooms');await click(d,'[data-home]');d.querySelector('#team-name').value='Equipo de prueba';await submit(d,'#team-form');
  assert.ok(d.querySelector('#game-screen').classList.contains('active'));
  assert.equal(d.querySelector('#credits-label').textContent,'120');
  for(let round=1;round<=4;round++){
   assert.equal(d.querySelector('#round-label').textContent,String(round));
   for(const name of ['Arquitectura organizacional','Procesos y tecnología','Liderazgo']){
    const lever=[...d.querySelectorAll('.lever')].find(x=>x.querySelector('strong').textContent===name);assert.equal(lever.disabled,false);lever.click();
   }
   d.querySelector('#reason-input').value='Alineamos procesos, estructura y liderazgo para responder al diagnóstico.';
   d.querySelector('#reason-input').dispatchEvent(new ui.w.Event('input'));
   if(round===2){assert.match(d.querySelector('#budget-preview').textContent,/deuda de 20/);assert.ok(d.querySelector('#budget-preview').classList.contains('debt-bg'));}
   if(round===1){ui.failNextDecision();await click(d,'#execute-btn');assert.match(d.querySelector('#sync-message').textContent,/aún no está confirmada/);assert.equal(d.querySelectorAll('#history .decision-card').length,0);}
   await click(d,'#execute-btn');assert.equal(d.querySelectorAll('#history .decision-card').length,round);
   if(round>=2){assert.ok(d.querySelector('#balance-pill').classList.contains('debt'));assert.equal(d.querySelector('#credits-label').textContent,String(120-round*70));}
   await click(d,'#next-btn');
  }
  assert.ok(d.querySelector('#finish-screen').classList.contains('active'));
  assert.equal(d.querySelector('#final-credits').textContent,'-160');assert.equal(d.querySelector('#final-penalty').textContent,'−50 puntos');
  await click(d,'#facilitator-btn');await click(d,'.saved-room button');assert.equal(d.querySelector('#host-team-count').textContent,'1');
  const details=d.querySelector('.host-team');details.open=true;
  assert.equal(d.querySelectorAll('#host-teams .decision-card').length,4);assert.match(d.querySelector('#host-teams').textContent,/Deuda 160/);
  d.querySelector('#round-filter').value='3';d.querySelector('#round-filter').dispatchEvent(new ui.w.Event('change'));assert.equal(d.querySelectorAll('#host-teams .decision-card').length,1);assert.match(d.querySelector('#host-teams').textContent,/Ronda 3/);
  await click(d,'#export-decisions');assert.ok(ui.requests.some(r=>r.download==='decisiones-QA-FIXTURE.csv'));
  const csv=await ui.blob().text();assert.match(csv,/Alineamos procesos/);assert.match(csv,/"160";"50"/);
  await click(d,'#toggle-room');assert.equal(d.querySelector('#toggle-room').textContent,'Reabrir ingreso');
  await click(d,'#fac-signout');assert.ok(d.querySelector('#login-screen').classList.contains('active'));assert.equal(d.querySelector('#host-teams').children.length,0);
 }finally{ui.close();}
});

test('document controls are unique and every referenced local asset exists',()=>{
 const dom=new JSDOM(html),ids=[...dom.window.document.querySelectorAll('[id]')].map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length,'Duplicate ids break live ranking updates');
 for(const element of dom.window.document.querySelectorAll('script[src],link[rel="stylesheet"]')){
  const src=(element.getAttribute('src')||element.getAttribute('href')).split('?')[0];assert.ok(readFileSync(new URL('../'+src,import.meta.url)).length>0);
 }
 dom.window.close();
});

test('browser and server agree on the score at every saved stage',()=>{
 for(const snapshot of fixture.snapshots)assert.deepEqual(game.metrics(snapshot.scores,snapshot.credits),snapshot.metrics);
});


test('new teams appear automatically in the facilitator panel without a manual refresh',async()=>{
 const ui=setup(),{document:d}=ui;
 try{
  await login(ui);d.querySelector('#room-title').value='Sala de prueba';d.querySelector('#new-code').value='QA-FIXTURE';
  await submit(d,'#room-form');assert.equal(d.querySelector('#host-team-count').textContent,'0');
  ui.joinExternal();
  for(const {fn,ms} of ui.intervals.values())if(ms===4000)await fn();
  assert.equal(d.querySelector('#host-team-count').textContent,'1');
  assert.match(d.querySelector('#host-teams').textContent,/Equipo de prueba/);
 }finally{ui.close();}
});


test('facilitator entry requires login and invalid credentials never open the room panel',async()=>{
 const ui=setup(),{document:d}=ui;
 try{
  await click(d,'#facilitator-btn');
  assert.ok(d.querySelector('#login-screen').classList.contains('active'));
  assert.ok(!d.querySelector('#fac-screen').classList.contains('active'));
  assert.ok(!ui.requests.some(r=>['list','host','create'].includes(r.p_action)));
  d.querySelector('#fac-login-email').value='test@example.test';d.querySelector('#fac-login-password').value='incorrect';
  await submit(d,'#fac-login-form');
  assert.match(d.querySelector('#login-message').textContent,/incorrectos/);
  assert.ok(d.querySelector('#login-screen').classList.contains('active'));
  assert.ok(!ui.requests.some(r=>['list','host','create'].includes(r.p_action)));
 }finally{ui.close();}
});
