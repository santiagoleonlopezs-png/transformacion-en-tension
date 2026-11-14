import {rounds,levers,metrics,roomLink,decisionsCsv,dimensionLabels,roundAnalysis} from './game.mjs?v=20261113-nexus';
import * as FacAuth from './facilitator-auth.mjs';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='tension.rooms.v2';
const cfg=window.GAME_CONFIG||{};
const state={screen:'start-screen',team:null,credential:null,host:null,hostData:null,selected:[],busy:false,poll:null,timer:null,offset:0,refreshing:false,facilitator:null,rooms:[],authEpoch:0};
let local;
try{local=JSON.parse(localStorage.getItem(STORE)||'{"hosts":[],"teams":[],"drafts":{}}');if(!Array.isArray(local.hosts)||!Array.isArray(local.teams))throw Error();local.drafts||={};}catch{local={hosts:[],teams:[],drafts:{}};}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(local));}catch{throw Error('Este navegador no permite conservar el acceso. Habilita el almacenamiento para crear o retomar una sala.');}}
function randomKey(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
function normalizeCode(value){return value.trim().toUpperCase();}
function validCode(code){return /^[A-Z0-9-]{4,20}$/.test(code);}
async function api(action,code,key=null,data={}){
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)throw Error('Falta configurar la conexión de la experiencia.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/tension_api`,{method:'POST',headers:{apikey:cfg.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_code:code,p_key:key,p_data:data}),signal:controller.signal,cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw Error(result.message||'No se pudo completar la solicitud.');
    return result;
  }catch(error){
    if(error.name==='AbortError'||error instanceof TypeError)throw Error('No se pudo conectar. Revisa tu conexión y vuelve a intentarlo; tu acceso se conserva en este navegador.');
    throw error;
  }finally{clearTimeout(timeout);}
}
async function facApi(action,code=null,data={}){
  if(!state.facilitator)throw Error('Inicia sesión como facilitador.');
  const uid=state.facilitator.uid,epoch=state.authEpoch,token=await FacAuth.getToken(uid);
  const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/tension-facilitator`,{method:'POST',headers:{apikey:cfg.SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,code,data}),signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(epoch!==state.authEpoch||state.facilitator?.uid!==uid)throw Error('La sesión cambió. Vuelve a iniciar sesión.');
  const result=await response.json();
  if(!response.ok){
    if(response.status===401){clearFacilitator();show('login-screen');}
    throw Error(result.message||'No se pudo completar la solicitud.');
  }
  return result;
}
function clearFacilitator(){
  state.authEpoch++;state.facilitator=null;state.rooms=[];state.host=null;state.hostData=null;
  $('#saved-rooms').replaceChildren();$('#host-teams').replaceChildren();$('#share-link').value='';$('#room-qr').replaceChildren();$('#fac-email').textContent='';
}
async function loadRooms(){state.rooms=await facApi('list');renderSavedRooms();}
async function enterFacilitator(){
  show('login-screen');$('#login-message').textContent='Comprobando sesión…';
  try{const user=await FacAuth.restore();if(!user){$('#login-message').textContent='';return;}state.facilitator=user;state.authEpoch++;await loadRooms();show('fac-screen');$('#login-message').textContent='';}
  catch(error){clearFacilitator();$('#login-message').textContent=FacAuth.authError(error);}
}
function show(id){
  if(['fac-screen','host-screen'].includes(id)&&!state.facilitator)id='login-screen';
  clearInterval(state.poll);clearInterval(state.timer);state.poll=null;state.timer=null;state.screen=id;
  document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));
  $('#facilitator-btn').hidden=['fac-screen','host-screen','login-screen'].includes(id);
  $('#fac-session').classList.toggle('hidden',!state.facilitator||!['fac-screen','host-screen'].includes(id));
  $('#fac-email').textContent=state.facilitator?.email||'';
  window.scrollTo({top:0,behavior:'instant'});
  if(id==='game-screen'||id==='finish-screen'){refreshGame();state.poll=setInterval(refreshGame,4000);if(id==='game-screen')state.timer=setInterval(tick,500);}
  if(id==='host-screen')state.poll=setInterval(refreshHost,4000);
}
function setBusy(button,busy){button.disabled=busy;button.setAttribute('aria-busy',String(busy));}
function renderSavedRooms(){
  const box=$('#saved-rooms');box.replaceChildren();
  $('#legacy-recovery').classList.toggle('hidden',!local.hosts.length);
  if(!state.rooms.length){box.innerHTML='<p class="empty">Todavía no has creado salas con esta cuenta.</p>';return;}
  for(const room of state.rooms){
    const row=document.createElement('div');row.className='saved-room';
    row.innerHTML=`<div><strong>${esc(room.title)}</strong><span>${esc(room.code)}</span></div>`;
    const button=document.createElement('button');button.className='secondary';button.textContent='Abrir';
    button.onclick=async()=>{setBusy(button,true);try{await openHost(room);}catch(error){row.querySelector('span').textContent=error.message;}finally{setBusy(button,false);}};
    row.append(button);box.append(row);
  }
}
async function openHost(host){
  const data=await facApi('host',host.code);state.host=host;state.hostData=data;
  $('#host-title').textContent=data.room.title;
  $('#share-code').textContent=host.code;
  const link=roomLink(host.code,location.href);$('#share-link').value=link;$('#room-qr').replaceChildren();
  if(window.QRCode)new window.QRCode($('#room-qr'),{text:link,width:160,height:160,colorDark:'#0b1224',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
  else $('#room-qr').textContent='Usa el enlace directo';
  $('#share-message').textContent='Código, enlace y QR llevan a esta misma sala.';
  renderHost();show('host-screen');
}
async function refreshHost(){
  if(state.screen!=='host-screen'||state.refreshing||!state.host)return;
  state.refreshing=true;const code=state.host.code;
  try{const data=await facApi('host',code);if(state.screen!=='host-screen'||state.host.code!==code)return;state.hostData=data;renderHost();}
  catch(e){if(state.screen==='host-screen')$('#host-status').textContent=`No se pudo actualizar: ${e.message}`;}
  finally{state.refreshing=false;}
}
const formatDate=value=>new Date(value).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'});
function decisionCard(h){
  return `<article class="decision-card"><h3>Ronda ${h.round} · ${esc(h.title)}</h3><p><strong>Palancas:</strong> ${h.levers.length?h.levers.map(esc).join(' · '):'Decidieron no intervenir'}</p><blockquote>${esc(h.reason)}</blockquote><p><strong>${esc(h.outcome.charAt(0).toUpperCase()+h.outcome.slice(1))}.</strong> ${esc(h.consequence)}</p>${h.synergies?.length?`<p>${h.synergies.map(esc).join(' ')}</p>`:''}<div class="decision-metrics"><span>Costo ${h.cost}</span><span class="${h.debt?'debt':''}">Saldo ${h.creditsLeft}${h.debt?` · Deuda ${h.debt}`:''}</span><span>Penalización −${h.penalty}</span><span>Agile ${h.agile} (${h.deltaAgile>0?'+':''}${h.deltaAgile})</span><span>Coherencia ${h.coherence}% (${h.deltaCoherence>0?'+':''}${h.deltaCoherence})</span><span>Puntaje ${h.total}/100</span></div><div class="decision-date">${esc(formatDate(h.at))}${h.timedOut?' · Tiempo agotado':''}</div>${scoringHtml(h)}</article>`;
}
function renderHost(){
  const {room,teams}=state.hostData;
 $('#host-phase').textContent=`${room.mode==='guided'?'Dirigida':'Autónoma'} · Ronda ${room.current_round||1} · ${{waiting:'En espera',deciding:'Decisiones abiertas',discussion:'Conversación'}[room.phase]||'En curso'}`;
 $('#open-round').disabled=room.mode!=='guided';$('#close-round').disabled=room.mode!=='guided';
 const selectedRound=Number($('#control-round').value)||room.current_round||1,analysis=roundAnalysis(teams,selectedRound);
 $('#host-round-analysis').innerHTML=`<h3>Ranking · Ronda ${selectedRound}</h3>${analysis.entries.length?`<ol>${analysis.entries.map(t=>`<li value="${t.place}">${esc(t.name)} · <strong>${t.decision.total}/100</strong></li>`).join('')}</ol>`:'<p class="hint">Sin decisiones confirmadas.</p>'}${analysis.patterns.map(x=>`<p class="hint">${esc(x)}</p>`).join('')}<h3>Preguntas para conversar</h3><ul>${analysis.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`;

  $('#host-status').textContent=`Ingreso ${room.status==='open'?'abierto':'cerrado'} · Actualización automática cada 4 segundos.`;
  $('#toggle-room').textContent=room.status==='open'?'Cerrar ingreso':'Reabrir ingreso';
  $('#host-team-count').textContent=teams.length;
  $('#host-decision-count').textContent=teams.reduce((n,t)=>n+t.history.length,0);
  $('#host-debt-count').textContent=teams.filter(t=>t.credits<0).length;
  const filter=$('#team-filter'),previous=filter.value;
  const options='<option value="">Todos los equipos</option>'+teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  if(filter.innerHTML!==options){filter.innerHTML=options;filter.value=teams.some(t=>t.id===previous)?previous:'';}
  const opened=new Set([...document.querySelectorAll('.host-team[open]')].map(el=>el.dataset.id));
  const round=Number($('#round-filter').value),selected=filter.value;
  const visible=teams.filter(t=>(!selected||t.id===selected)&&(!round||t.history.some(h=>h.round===round)));
  $('#host-teams').innerHTML=visible.length?visible.map(t=>`<details class="host-team" data-id="${t.id}" ${opened.has(t.id)||selected?'open':''}><summary><h3>${esc(t.name)}</h3><span class="team-meta"><strong>${t.metrics.total}/100</strong><span class="${t.credits<0?'debt':''}">Saldo ${t.credits}${t.credits<0?` · Deuda ${-t.credits}`:''}</span><span>${t.finished?'Finalizado':`Ronda ${t.round}/4`}</span><span>${t.history.length} decisiones ▾</span></span></summary><button class="secondary danger remove-team" type="button" data-team="${t.id}">Retirar equipo</button>${t.history.length?t.history.filter(h=>!round||h.round===round).map(decisionCard).join(''):'<p class="hint">El equipo ya entró. Aún no ha ejecutado una decisión.</p>'}</details>`).join(''):`<p class="empty">${teams.length?'No hay decisiones para este filtro.':'Comparte la sala. Los equipos aparecerán aquí al ingresar.'}</p>`;
}
function draftKey(){return `${state.team.id}:${state.team.round}`;}
function saveDraft(){if(!state.team||state.team.resolved)return;local.drafts[draftKey()]={selected:state.selected,reason:$('#reason-input').value,attention:inputValues('attention'),bets:inputValues('prediction'),target:$('#target-input').value};try{persist();}catch(e){$('#sync-message').textContent=e.message;}}
function inputValues(kind){return Object.fromEntries([...document.querySelectorAll(`[data-${kind}]`)].map(el=>[el.dataset[kind],Number(el.value)]));}
function canDecide(t=state.team){return !t.resolved&&(t.room?.mode!=='guided'||(t.room.phase==='deciding'&&t.round<=t.room.current_round));}
function renderDecisionInputs(){
 const t=state.team,draft=local.drafts[draftKey()]||{},prior=t.resolved?t.history.at(-1):null,locked=!canDecide();
 for(const [kind,selector,min,max] of [['attention','#attention-inputs',0,100],['prediction','#prediction-inputs',-4,4]]){
 const values=(kind==='attention'?(prior?.attention||draft.attention):(prior?.bets||draft.bets))||{};
 $(selector).innerHTML=Object.entries(dimensionLabels).map(([k,label])=>`<label class="dimension-input"><span>${label}</span><input type="number" data-${kind}="${k}" aria-label="${kind==='attention'?'Atención':'Predicción'}: ${label}" min="${min}" max="${max}" step="1" value="${Number(values[k])||0}" ${locked?'disabled':''}></label>`).join('');
 $(selector).querySelectorAll('input').forEach(el=>el.oninput=()=>{updateAttention();saveDraft();});
 }
 $('#target-input').innerHTML=Object.entries(dimensionLabels).map(([k,label])=>`<option value="${k}">${label}</option>`).join('');
 $('#target-input').value=prior?.target||draft.target||'Strategy';$('#target-input').disabled=locked;$('#target-input').onchange=saveDraft;updateAttention();
}
function updateAttention(){const sum=Object.values(inputValues('attention')).reduce((a,b)=>a+b,0);$('#attention-sum').textContent=`Atención asignada: ${sum}/100`;}
function scoringHtml(h){
 if(!h?.scoring)return '';
 const labels={relevance:'Pertinencia',diagnosis:'Diagnóstico',forecast:'Predicción',impact:'Efecto en el sistema',focus:'Foco',speed:'Agilidad'},s=h.scoring;
 return `<p>Esta ronda: <strong>${h.roundScore}/100</strong> · Ranking: promedio de tus rondas, menos ${h.penalty} puntos por deuda = <strong>${h.total}/100</strong>.</p><div class="score-breakdown">${Object.entries(s.points).map(([k,v])=>`<div><span>${labels[k]}</span><strong>+${v}</strong></div>`).join('')}${Object.entries(s.penalties).map(([k,v])=>`<div class="${v?'debt':''}"><span>${({overload:'Demasiadas acciones a la vez',wrong:'Acciones inoportunas',delay:'Demora al decidir'})[k]}</span><strong>−${v}</strong></div>`).join('')}</div><p class="feedback-note">${s.penalties.overload?'Las acciones exigieron más trabajo del que la organización podía sostener. Para la próxima, prioriza las que mejor respondan al problema.':'El esfuerzo de las acciones estuvo dentro de lo que la organización podía asumir.'} ${s.points.speed?'La rapidez sumó porque estuvo acompañada de pertinencia y un diagnóstico alineado.':'La rapidez solo suma cuando la decisión responde a las señales del caso.'}</p>`;
}
function evolutionHtml(t){
 const series=[{label:'Inicio',scores:t.history[0]?.scoresBefore||t.scores},...t.history.map(h=>({label:'R'+h.round,scores:h.scoresAfter}))],colors=['#81e1c9','#77a6ff','#d2b5ff','#f2ca85','#e58ca4','#6dd2ef','#a6d69b'];
 const paths=Object.keys(dimensionLabels).map((k,i)=>`<polyline fill="none" stroke="${colors[i]}" stroke-width="2.4" points="${series.map((v,j)=>`${40+j*120},${180-(Number(v.scores?.[k])||1)*30}`).join(' ')}"/>${series.map((v,j)=>`<circle cx="${40+j*120}" cy="${180-(Number(v.scores?.[k])||1)*30}" r="3" fill="${colors[i]}"/>`).join('')}`).join('');
 return `<svg viewBox="0 0 560 215" role="img" aria-label="Evolución de las siete dimensiones, de 1 a 5">${[1,2,3,4,5].map(v=>`<line x1="32" y1="${180-v*30}" x2="535" y2="${180-v*30}" stroke="#293c58"/><text x="12" y="${184-v*30}" fill="#a5b6d0" font-size="11">${v}</text>`).join('')}${paths}${series.map((v,j)=>`<text x="${32+j*120}" y="190" fill="#a5b6d0" font-size="11">${v.label}</text>`).join('')}</svg><div class="chart-legend">${Object.entries(dimensionLabels).map(([k,label],i)=>`<span style="--dot:${colors[i]}">${label}</span>`).join('')}</div>`;
}
function applyTeam(team,restoreDraft=false){
  state.team=team;state.offset=team.server_now?Date.parse(team.server_now)-Date.now():0;
  state.selected=team.resolved?(team.history.at(-1)?.leverIds||[]):[];
  if(restoreDraft&&!team.resolved){const draft=local.drafts[draftKey()];if(draft){state.selected=draft.selected.filter(id=>levers.some(l=>l.id===id));$('#reason-input').value=String(draft.reason||'').slice(0,180);}else $('#reason-input').value='';}
  else $('#reason-input').value=team.resolved?(team.history.at(-1)?.reason||''):'';
  if(team.resolved){delete local.drafts[draftKey()];try{persist();}catch{}}
}
function renderGame(){
  const t=state.team,r=rounds[t.round-1],m=t.metrics;renderDecisionInputs();$('#evolution-chart').innerHTML=evolutionHtml(t);$('#room-stage').textContent=t.room?.mode==='guided'?`Ronda ${t.room.current_round} · ${t.room.phase==='deciding'?'Decisiones abiertas':t.room.phase==='discussion'?'Conversación con tu facilitador':'Esperando al facilitador'}`:'Modalidad autónoma · Avanza a tu ritmo';
  $('#team-label').textContent=t.name;$('#team-room').textContent=t.room_code;
  $('#round-title').textContent=r.title;$('#round-label').textContent=t.round;$('#credits-label').textContent=t.credits;
  $('#balance-pill').classList.toggle('debt',t.credits<0);$('#balance-pill').classList.toggle('debt-bg',t.credits<0);
  $('#situation-title').textContent=r.title;$('#situation-context').textContent=r.context;$('#situation-dilemma').textContent=r.dilemma;
  $('#signals').innerHTML=r.signals.map(s=>`<div class="signal">${esc(s)}</div>`).join('');
  $('#round-progress').innerHTML=rounds.map((_,i)=>`<div class="progress-step ${i<t.history.length?'done':i+1===t.round?'current':''}"></div>`).join('');
  const labels={'Strategy':'Estrategia','Structure':'Estructura','Systems':'Sistemas','Shared Values':'Valores compartidos','Skills':'Capacidades','Style':'Estilo de liderazgo','Staff':'Personas'};
  $('#scores-grid').innerHTML=Object.entries(t.scores).map(([k,v])=>`<div class="score-card"><span>${labels[k]||esc(k)}</span><strong>${v}<small>/5</small></strong><div class="score-dots" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<v?'on':''}"></i>`).join('')}</div></div>`).join('');
  $('#agile-badge').textContent=`Agile ${m.agile}/100`;$('#coherence-label').textContent=`${m.coherence}%`;$('#coherence-bar').style.width=`${m.coherence}%`;
  $('#history').innerHTML=t.history.length?t.history.map(decisionCard).join(''):'<p class="hint">Aquí verás las consecuencias de tus decisiones.</p>';
  $('#round-board').innerHTML=t.history.length?`<table><thead><tr><th>Ronda</th><th>Agile</th><th>Coherencia</th><th>Saldo</th><th>Deuda</th><th>Puntaje</th></tr></thead><tbody>${t.history.map(h=>`<tr><td>${h.round}</td><td>${h.agile}</td><td>${h.coherence}%</td><td class="${h.debt?'debt':''}">${h.creditsLeft}</td><td>${h.debt}</td><td>${h.total}</td></tr>`).join('')}</tbody></table>`:'';
  $('#reason-input').disabled=!canDecide();$('#reason-count').textContent=`${$('#reason-input').value.length}/180`;$('#execute-btn').disabled=!canDecide()||state.busy;
  $('#round-footer').classList.toggle('hidden',!t.resolved);$('#next-btn').disabled=t.room?.mode==='guided'&&t.round<4&&(t.room.phase!=='deciding'||t.room.current_round<=t.round);$('#score-breakdown').innerHTML=t.resolved?scoringHtml(t.history.at(-1)):'';
  if(t.resolved){const h=t.history.at(-1);$('#footer-result-title').textContent=h.timedOut?'Tiempo agotado':`Decisión ${h.outcome}`;$('#footer-result-text').textContent=`${h.consequence} ${h.synergies.join(' ')} Agile ${h.agile}/100 · Coherencia ${h.coherence}% · Saldo ${h.creditsLeft}${h.debt?` · Deuda ${h.debt} · Penalización −${h.penalty} puntos`:''}.`;$('#next-btn').textContent=t.round<4?`Continuar a la ronda ${t.round+1}`:'Ver resultado final';}
  renderLevers();tick();
}
function renderLevers(){
  const t=state.team,box=$('#levers-grid');box.replaceChildren();
  for(const l of levers){const selected=state.selected.includes(l.id),button=document.createElement('button');button.type='button';button.className=`lever${selected?' selected':''}`;button.setAttribute('aria-pressed',String(selected));button.disabled=!canDecide()||state.busy;button.innerHTML=`<strong>${esc(l.name)}</strong><span class="lever-cost">${l.cost} cr.</span><p>${esc(l.desc)}</p>`;button.onclick=()=>{if(state.busy||!canDecide())return;const index=state.selected.indexOf(l.id);if(index>=0)state.selected.splice(index,1);else state.selected.push(l.id);$('#validation-msg').textContent='';renderLevers();saveDraft();};box.append(button);}
  $('#selection-label').textContent=`${state.selected.length} seleccionadas`;
  const cost=t.resolved?0:state.selected.reduce((sum,id)=>sum+levers.find(l=>l.id===id).cost,0),balance=t.credits-cost,forecast=metrics(t.scores,balance);
  $('#budget-preview').classList.toggle('debt-bg',balance<0);
  $('#budget-preview').innerHTML=`<div><span>Costo de esta decisión</span><strong>${cost} cr.</strong></div><div><span>Saldo ${t.resolved?'actual':'previsto'}</span><strong class="${balance<0?'debt':''}">${balance} cr.</strong></div><p>${balance<0?`Continúas con una deuda de ${forecast.debt} créditos. La experiencia continúa.`:'El presupuesto es único para las cuatro rondas.'}</p>`;
}
function tick(){
  if(state.screen!=='game-screen'||!state.team)return;
  const t=state.team,elapsed=Math.max(0,Math.floor((Number(t.decision_elapsed)||0)+(t.decision_started? (Date.now()+state.offset-Date.parse(t.decision_started))/1000 : t.room?.phase==='discussion'?0:(Date.now()+state.offset-(Date.parse(t.deadline)-420000))/1000))),remaining=elapsed;
  $('#timer-label').textContent=t.resolved?'Decisión guardada':t.room?.mode==='guided'&&t.room.phase!=='deciding'?'En pausa':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  $('#timer-pill').classList.toggle('urgent',false);
  // El tiempo no guarda decisiones ni cierra automáticamente la ronda.
}
async function executeDecision(timedOut=false){
  if(state.busy||!canDecide())return;
  const reason=$('#reason-input').value.trim(),attention=inputValues('attention'),bets=inputValues('prediction'),target=$('#target-input').value;if(Object.values(attention).reduce((a,b)=>a+b,0)!==100){$('#validation-msg').textContent='Distribuye exactamente 100 puntos de atención.';return;}
  if(!timedOut&&reason.length<20){$('#validation-msg').textContent='Justifica tu decisión con al menos 20 caracteres.';$('#reason-input').focus();return;}
  state.busy=true;setBusy($('#execute-btn'),true);renderLevers();$('#validation-msg').textContent='Guardando decisión…';
  try{
    const t=await api('decide',state.team.room_code,state.credential.key,{id:state.team.id,round:state.team.round,selected:state.selected,reason,attention,bets,target,epoch:state.team.room?.epoch||0});
    applyTeam(t);$('#validation-msg').textContent='Decisión guardada.';$('#sync-message').textContent='Tu decisión y sus consecuencias quedaron guardadas.';$('#sync-message').classList.remove('error');
    renderGame();await loadLeaderboard();$('#round-footer').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(e){state.retryAfter=Date.now()+10000;$('#validation-msg').textContent=e.message;$('#sync-message').textContent='La decisión aún no está confirmada. Puedes volver a intentarlo.';$('#sync-message').classList.add('error');}
  finally{state.busy=false;$('#execute-btn').disabled=!canDecide();renderLevers();}
}
async function nextRound(){
  if(state.busy)return;state.busy=true;setBusy($('#next-btn'),true);
  try{const t=await api('next',state.team.room_code,state.credential.key,{id:state.team.id,round:state.team.round,epoch:state.team.room?.epoch||0});applyTeam(t,true);$('#validation-msg').textContent='';if(t.finished){renderFinish();show('finish-screen');}else{renderGame();window.scrollTo({top:0,behavior:'smooth'});}}
  catch(e){$('#validation-msg').textContent=e.message;$('#sync-message').textContent=e.message;$('#sync-message').classList.add('error');}
  finally{state.busy=false;setBusy($('#next-btn'),false);if(!state.team.finished)renderGame();}
}
function renderFinish(){
  const t=state.team,m=t.metrics;
  $('#finish-title').textContent=m.total>=80?'Transformación sobresaliente':m.total>=65?'Transformación sólida':m.total>=50?'Transformación parcial':'Transformación frágil';
  $('#final-score').textContent=m.total;$('#final-agile').textContent=`${m.agile}/100`;$('#final-coherence').textContent=`${m.coherence}%`;$('#final-credits').textContent=t.credits;$('#final-credits').classList.toggle('debt',t.credits<0);$('#final-penalty').textContent=`−${m.penalty} puntos`;$('#final-penalty').classList.toggle('debt',m.penalty>0);
  $('#finish-copy').textContent=t.history.some(h=>h.scoring)?'El ranking es el promedio de las rondas evaluadas menos la penalización por deuda. Cada decisión combina pertinencia, diagnóstico, predicción, efecto, foco y agilidad; descuenta acciones inoportunas y exceso de esfuerzo.':'Esta partida conserva la puntuación de su versión original.';
  $('#finish-history').innerHTML=t.history.map(decisionCard).join('');
}
function rankingRows(teams){return teams.map((t,i)=>`<tr class="${t.id===state.team?.id?'me':''}"><td>${i<3?['🥇','🥈','🥉'][i]:i+1}</td><td>${esc(t.name)}${t.id===state.team?.id?' · Tú':''}</td><td><strong>${t.metrics.total}</strong>${t.metrics.penalty?` <span class="debt" title="Penalización por deuda">(−${t.metrics.penalty})</span>`:''}</td><td>${t.metrics.agile}</td><td>${t.metrics.coherence}%</td><td class="${t.credits<0?'debt':''}">${t.credits}${t.credits<0?` / ${-t.credits} deuda`:''}</td><td><span class="status-badge ${t.finished?'status-finished':''}">${t.finished?'Finalizado':`Ronda ${t.round}`}</span></td></tr>`).join('');}
async function loadLeaderboard(){
  const code=state.team.room_code,teams=await api('leaderboard',code);
  if(state.team.room_code!==code)return;
  $('#live-body').innerHTML=rankingRows(teams);$('#final-live-body').innerHTML=rankingRows(teams);
  const text=`${teams.length} equipos · Actualización automática cada 4 segundos. El puntaje ya incluye la penalización por deuda.`;
  $('#live-status').textContent=text;$('#final-live-status').textContent=text;$('#ranking-count').textContent=teams.length;
}
async function refreshGame(){
  if(!state.team||state.refreshing||state.busy||!['game-screen','finish-screen'].includes(state.screen))return;
  state.refreshing=true;
  try{
    const t=await api('team',state.team.room_code,state.credential.key,{id:state.team.id});
    if(!['game-screen','finish-screen'].includes(state.screen))return;
    if(Date.parse(t.updated_at)>Date.parse(state.team.updated_at)||JSON.stringify(t.room)!==JSON.stringify(state.team.room)){applyTeam(t,true);if(t.finished){renderFinish();if(state.screen!=='finish-screen')show('finish-screen');}else renderGame();}
    await loadLeaderboard();$('#sync-message').textContent='Progreso guardado · Puedes retomar desde este navegador.';$('#sync-message').classList.remove('error');
  }catch(e){$('#sync-message').textContent=`No se pudo actualizar. ${e.message}`;$('#sync-message').classList.add('error');$('#live-status').textContent='No se pudo actualizar el ranking. Mostramos la última información disponible.';$('#final-live-status').textContent=$('#live-status').textContent;}
  finally{state.refreshing=false;}
}
async function copy(text){if(!navigator.clipboard?.writeText)throw Error('No se pudo copiar automáticamente. Selecciona y copia el enlace de la sala.');await navigator.clipboard.writeText(text);}
const invite=()=>`Te invito a Transformación en tensión.\nSala: ${state.hostData.room.title}\nCódigo: ${state.host.code}\nEntra aquí: ${$('#share-link').value}`;

$('#facilitator-btn').onclick=enterFacilitator;
$('#login-back').onclick=()=>show('start-screen');
$('#fac-login-form').onsubmit=async event=>{
  event.preventDefault();const button=$('#fac-login-submit');setBusy(button,true);$('#login-message').textContent='Validando acceso…';
  try{const user=await FacAuth.signIn($('#fac-login-email').value.trim(),$('#fac-login-password').value);state.facilitator=user;state.authEpoch++;await loadRooms();$('#fac-login-password').value='';$('#login-message').textContent='';show('fac-screen');}
  catch(error){clearFacilitator();$('#login-message').textContent=FacAuth.authError(error);show('login-screen');}
  finally{setBusy(button,false);}
};
$('#fac-signout').onclick=async()=>{clearFacilitator();show('login-screen');$('#login-message').textContent='Sesión cerrada.';try{await FacAuth.signOut();}catch(error){$('#login-message').textContent=FacAuth.authError(error);}};
$('[data-home]').onclick=()=>show('start-screen');
$('#back-rooms').onclick=async()=>{try{await loadRooms();show('fac-screen');}catch(error){$('#host-status').textContent=error.message;}};
$('#room-form').onsubmit=async event=>{
  event.preventDefault();const code=normalizeCode($('#new-code').value),title=$('#room-title').value.trim(),button=$('#create-room-btn');
  if(!validCode(code))return;setBusy(button,true);$('#create-message').textContent='Creando sala…';
  try{const room=await facApi('create',code,{title,mode:$('#room-mode').value});await openHost(room);$('#create-message').textContent='';}
  catch(error){$('#create-message').textContent=error.message;}finally{setBusy(button,false);}
};
$('#recover-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;setBusy(button,true);try{const room=await facApi('claim',normalizeCode($('#recover-code').value),{key:$('#recover-key').value.trim()});$('#recover-key').value='';await loadRooms();await openHost(room);$('#recover-message').textContent='';}catch(error){$('#recover-message').textContent=error.message;}finally{setBusy(button,false);}};
$('#team-form').onsubmit=async event=>{
  event.preventDefault();const code=normalizeCode($('#class-code').value),name=$('#team-name').value.trim(),button=$('#join-btn');if(!validCode(code)||!name)return;
  setBusy(button,true);$('#join-message').textContent='Conectando con tu sala…';
  try{
    let credential=local.teams.find(t=>t.code===code&&t.name.toLowerCase()===name.toLowerCase());
    if(!credential){credential={code,name,key:randomKey()};local.teams.push(credential);persist();}
    const t=await api('join',code,credential.key,{name});credential.id=t.id;persist();state.credential=credential;applyTeam(t,true);$('#join-message').textContent='';
    if(t.finished){renderFinish();show('finish-screen');}else{show('game-screen');renderGame();}
  }catch(e){$('#join-message').textContent=e.message;}finally{setBusy(button,false);}
};
$('#execute-btn').onclick=()=>executeDecision(false);$('#next-btn').onclick=nextRound;
$('#reason-input').oninput=event=>{$('#reason-count').textContent=`${event.target.value.length}/180`;$('#validation-msg').textContent='';saveDraft();};
$('#team-filter').onchange=renderHost;$('#round-filter').onchange=renderHost;$('#control-round').onchange=renderHost;
$('#host-refresh').onclick=refreshHost;
$('#toggle-room').onclick=async()=>{const button=$('#toggle-room');setBusy(button,true);try{state.hostData=await facApi('status',state.host.code,{status:state.hostData.room.status==='open'?'closed':'open'});renderHost();}catch(e){$('#host-status').textContent=e.message;}finally{setBusy(button,false);}};
$('#copy-invite').onclick=async()=>{try{await copy(invite());$('#share-message').textContent='Invitación copiada con el código y el enlace directo.';}catch(e){$('#share-message').textContent=e.message;$('#share-link').select();}};
$('#share-invite').onclick=async()=>{try{if(navigator.share){await navigator.share({title:'Transformación en tensión',text:`Sala: ${state.hostData.room.title}\nCódigo: ${state.host.code}`,url:$('#share-link').value});$('#share-message').textContent='Invitación compartida.';}else{await copy(invite());$('#share-message').textContent='Invitación copiada. Pégala en WhatsApp, correo o el canal de tu grupo.';}}catch(e){if(e.name!=='AbortError')$('#share-message').textContent=e.message;}};
$('#export-decisions').onclick=()=>{const blob=new Blob([decisionsCsv(state.hostData.room,state.hostData.teams)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`decisiones-${state.host.code}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);};
$('#review-decisions').onclick=()=>$('#finish-history').classList.toggle('hidden');
$('#finish-home').onclick=()=>show('start-screen');
let roomLookup=0;
$('#class-code').oninput=()=>{clearTimeout(roomLookup);const code=normalizeCode($('#class-code').value);roomLookup=setTimeout(async()=>{if(!validCode(code)){ $('#room-hint').textContent='Tu facilitador te comparte el código o el enlace.';return;}try{const room=await api('room',code);if(normalizeCode($('#class-code').value)!==code)return;$('#room-hint').textContent=`Sala: ${room.title}${room.status==='closed'?' · Cerrada para nuevos equipos':''}`;}catch(e){if(normalizeCode($('#class-code').value)===code)$('#room-hint').textContent=e.message;}},350);};
const prefilled=normalizeCode(new URL(location.href).searchParams.get('sala')||'');
if(validCode(prefilled)){$('#class-code').value=prefilled;const saved=local.teams.find(t=>t.code===prefilled);if(saved)$('#team-name').value=saved.name;$('#class-code').oninput();}
window.addEventListener('online',()=>{state.retryAfter=0;if(state.screen==='host-screen')refreshHost();else refreshGame();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(state.screen==='host-screen')refreshHost();else{refreshGame();tick();}}});

try{FacAuth.observe(user=>{if(state.facilitator&&(!user||user.uid!==state.facilitator.uid)){clearFacilitator();if(['fac-screen','host-screen'].includes(state.screen)){show('login-screen');$('#login-message').textContent='Tu sesión cambió. Inicia sesión para continuar.';}}});}catch{/* Login reports a loading error when requested; participant access remains available. */}

$('#go-player').onclick=()=>{$('#team-form').scrollIntoView({behavior:'smooth',block:'center'});$('#class-code').focus({preventScroll:true});};
$('#refresh-ranking').onclick=()=>loadLeaderboard().catch(e=>{$('#live-status').textContent=e.message;});
async function controlRoom(action,data={}){if(state.controlBusy)return;state.controlBusy=true;const code=state.host.code;try{state.hostData=await facApi(action,code,data);renderHost();}catch(e){$('#host-status').textContent=e.message;}finally{state.controlBusy=false;}}
$('#open-round').onclick=()=>controlRoom('control',{round:Number($('#control-round').value),phase:'deciding'});
$('#close-round').onclick=()=>controlRoom('control',{round:Number($('#control-round').value),phase:'discussion'});
$('#reset-room').onclick=()=>{if(confirm('¿Reiniciar esta sala? Los equipos deberán volver a entrar. El historial anterior se conservará archivado.'))controlRoom('reset');};
$('#host-teams').onclick=e=>{const button=e.target.closest('[data-team]');if(button&&confirm('¿Retirar este equipo de la sala y del ranking?'))controlRoom('remove',{id:button.dataset.team});};

$('#leave-team').onclick=()=>{saveDraft();show('start-screen');};
