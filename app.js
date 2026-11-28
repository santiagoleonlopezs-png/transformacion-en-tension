import {rounds,levers,metrics,roomLink,decisionsCsv,episodes,creditPlan,roundDebrief} from './game.mjs?v=20261128-physical';
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
  $('#saved-rooms').replaceChildren();$('#host-teams').replaceChildren();$('#manage-teams').replaceChildren();$('#manage-message').textContent='';$('#host-live-body').replaceChildren();$('#host-discussion').replaceChildren();$('#share-link').value='';$('#room-qr').replaceChildren();$('#fac-email').textContent='';
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
  if(id==='host-screen'){state.poll=setInterval(refreshHost,4000);state.timer=setInterval(tickHost,500);tickHost();}
}
function setBusy(button,busy){button.disabled=busy;button.setAttribute('aria-busy',String(busy));}
function renderSavedRooms(){
  const box=$('#saved-rooms');box.replaceChildren();
  $('#legacy-recovery').classList.toggle('hidden',!local.hosts.length);
  if(!state.rooms.length){box.innerHTML='<p class="empty">Todavía no has creado salas con esta cuenta.</p>';return;}
  for(const room of state.rooms){
    const row=document.createElement('div');row.className='saved-room';
    row.innerHTML=`<div><strong>${esc(room.title)}</strong><span>${esc(room.code)} · ${room.mode==='guided'?'Dirigida':'Autogestionada'}</span></div>`;
    const button=document.createElement('button');button.className='secondary';button.textContent='Abrir';
    button.onclick=async()=>{setBusy(button,true);try{await openHost(room);}catch(error){row.querySelector('span').textContent=error.message;}finally{setBusy(button,false);}};
    row.append(button);box.append(row);
  }
}
async function openHost(host){
  const data=await facApi('host',host.code);state.host=host;state.hostData=data;
  $('#host-title').textContent=data.room.title;$('#round-filter').value=data.room.mode==='guided'?String(data.room.current_round):'';$('#round-control-message').textContent='';
  $('#share-code').textContent=host.code;
  const link=roomLink(host.code,'https://www.hacerlofc.com/laboratorio/transformacion-en-tension/');$('#share-link').value=link;$('#room-qr').replaceChildren();
  if(window.QRCode)new window.QRCode($('#room-qr'),{text:link,width:160,height:160,colorDark:'#0b1224',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
  else $('#room-qr').textContent='Usa el enlace directo';
  $('#share-message').textContent='Código, enlace y QR llevan a esta misma sala.';
  renderHost();show('host-screen');
}
async function refreshHost(){
  if(state.screen!=='host-screen'||state.refreshing||state.managing||!state.host)return;
  state.refreshing=true;const code=state.host.code;
  try{const data=await facApi('host',code);if(state.screen!=='host-screen'||state.host.code!==code||state.managing)return;state.hostData=data;renderHost();}
  catch(e){if(state.screen==='host-screen')$('#host-status').textContent=`No se pudo actualizar: ${e.message}`;}
  finally{state.refreshing=false;}
}
const formatDate=value=>new Date(value).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'});
function debriefHtml(h){const d=roundDebrief(h);return `<div class="impact-story"><strong>Lo que sucede con las personas</strong><p>${esc(d.story)}</p></div>${d.actions.length?`<div class="action-feedback"><strong>¿Por qué funcionó o no?</strong>${d.actions.map(a=>`<p><b>${esc(a.name)}:</b> ${esc(a.text)}</p>`).join('')}</div>`:''}${d.changes.length?`<p class="hint">Cambios en las 7S: ${d.changes.map(c=>esc(c.name)+' '+(c.delta>0?'+':'')+c.delta).join(' · ')}</p>`:''}`;}
function decisionCard(h){
  return `<article class="decision-card"><h3>Ronda ${h.round} · ${esc(h.title)}</h3><p><strong>Palancas:</strong> ${h.levers.length?h.levers.map(esc).join(' · '):'Decidieron no intervenir'}</p><blockquote>${esc(h.reason)}</blockquote><p><strong>${esc(h.outcome.charAt(0).toUpperCase()+h.outcome.slice(1))}.</strong> ${esc(h.consequence)}</p>${h.synergies?.length?`<p>${h.synergies.map(esc).join(' ')}</p>`:''}${debriefHtml(h)}<div class="decision-metrics"><span>Costo ${h.cost}</span><span class="${h.debt?'debt':''}">Saldo ${h.creditsLeft}${h.debt?` · Deuda ${h.debt}`:''}</span><span>Penalización −${h.penalty}</span><span>Agile ${h.agile} (${h.deltaAgile>0?'+':''}${h.deltaAgile})</span><span>Coherencia ${h.coherence}% (${h.deltaCoherence>0?'+':''}${h.deltaCoherence})</span><span>Puntaje ${h.total}/100</span></div><div class="decision-date">${esc(formatDate(h.at))}${h.timedOut?' · Tiempo agotado':''}</div></article>`;
}
function renderManagement(teams){
  $('#manage-count').textContent=teams.length+' equipos';
  const box=$('#manage-teams');
  if(state.managing)return;
  const markup=teams.length?`<table><thead><tr><th>Equipo</th><th>Progreso</th><th>Saldo</th><th>Acciones</th></tr></thead><tbody>${teams.map(t=>`<tr><td><strong>${esc(t.name)}</strong></td><td>${t.finished?'Finalizado':'Ronda '+t.round+'/4'} · ${t.history.length} decisiones</td><td class="${t.credits<0?'debt':''}">${t.credits} cr.</td><td><div class="manage-actions"><button type="button" class="secondary" data-action="rename_team" data-id="${esc(t.id)}">Renombrar</button><button type="button" class="secondary" data-action="reset_team" data-id="${esc(t.id)}">Reiniciar</button><button type="button" class="danger-action" data-action="delete_team" data-id="${esc(t.id)}">Eliminar</button></div></td></tr>`).join('')}</tbody></table>`:'<p class="empty">Todavía no hay equipos en esta sala.</p>';
  if(box.dataset.markup!==markup||!box.children.length){box.innerHTML=markup;box.dataset.markup=markup;}
}
async function manageTeam(action,id){
  if(state.managing||!state.host)return;
  const team=state.hostData.teams.find(t=>t.id===id);if(!team)return;
  const data={id};
  if(action==='rename_team'){
    const name=window.prompt('Nuevo nombre del equipo:',team.name);if(name===null||name.trim()===team.name)return;
    data.name=name.trim();if(!data.name||data.name.length>40){$('#manage-message').textContent='Escribe un nombre de 1 a 40 caracteres.';return;}
  }else if(action==='reset_team'){
    if(!window.confirm('¿Reiniciar a '+team.name+'? Se borrarán sus decisiones, deuda y puntaje. Volverá a la ronda 1 con 120 créditos.'))return;
  }else if(action==='delete_team'){
    if(!window.confirm('¿Eliminar a '+team.name+' de esta sala? Se borrarán sus respuestas, historial y posición en el ranking. Esta acción no se puede deshacer.'))return;
  }else return;
  const code=state.host.code;state.managing=true;$('#manage-message').textContent='Guardando cambio…';
  $('#manage-teams').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{const result=await facApi(action,code,data);if(state.host?.code!==code||state.screen!=='host-screen')return;state.hostData=result;$('#manage-message').textContent=action==='delete_team'?'Equipo eliminado.':action==='reset_team'?'Equipo reiniciado.':'Nombre actualizado.';}
  catch(e){if(state.host?.code===code)$('#manage-message').textContent=e.message;}
  finally{state.managing=false;if(state.host?.code===code&&state.screen==='host-screen'){renderHost();$('#manage-teams').querySelectorAll('button').forEach(b=>b.disabled=false);}}
}
$('#manage-teams').onclick=e=>{const button=e.target.closest('button[data-action]');if(button)manageTeam(button.dataset.action,button.dataset.id);};
function tickHost(){
  if(state.screen!=='host-screen'||!state.hostData)return;
  const room=state.hostData.room,view=$('#host-round-timer');
  if(room.mode!=='guided'){view.textContent='';return;}
  if(room.phase==='waiting'){view.textContent='Al abrir la ronda comenzará el contador de 06:00.';return;}
  if(room.phase==='discussion'){view.textContent='Decisiones cerradas · espacio para conversar.';return;}
  if(room.phase==='finished'){view.textContent='Simulación finalizada.';return;}
  const remaining=room.round_deadline?Math.max(0,Math.ceil((Date.parse(room.round_deadline)-Date.now()-(state.hostClockOffset||0))/1000)):0;
  view.textContent='Tiempo restante para decidir: '+String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0')+' · máximo 6 minutos por ronda';
  view.classList.toggle('urgent',remaining<=60);
  if(remaining===0&&Date.now()>(state.nextHostExpiryRefresh||0)){state.nextHostExpiryRefresh=Date.now()+2500;refreshHost();}
}
function renderRoundControl(room,teams){
 const guided=room.mode==='guided',r=room.current_round||1,phase=room.phase||'open',done=teams.filter(t=>t.round===r&&t.resolved).length;
 $('#round-control').classList.toggle('hidden',!guided);
 if(!guided)return;
 $('#host-round-label').textContent='Ronda '+r+' de 4';
 $('#host-round-status').textContent=({waiting:'Esperando apertura',open:'Decisiones abiertas',discussion:'Ronda cerrada · espacio de conversación',finished:'Simulación finalizada'})[phase]+' · '+done+' de '+teams.length+' equipos respondieron';
 $('#open-round').classList.toggle('hidden',!['waiting','discussion'].includes(phase));$('#open-round').textContent=phase==='discussion'?'Reabrir ronda':'Abrir ronda';
 $('#close-round').classList.toggle('hidden',phase!=='open');
 $('#advance-round').classList.toggle('hidden',phase!=='discussion');$('#advance-round').textContent=r===4?'Finalizar simulación':'Abrir ronda '+(r+1);
 $('#advance-round').disabled=state.managing||done!==teams.length||!teams.length;
 if(phase==='discussion'&&done!==teams.length)$('#host-round-status').textContent+=' · Reabre durante el tiempo restante o espera el cierre automático a los 6 minutos.';
  tickHost();
}
async function controlRound(action){
 if(state.managing||!state.host)return;
 const code=state.host.code;
 if(action==='close_round'&&!window.confirm('¿Cerrar esta ronda y abrir el espacio de conversación? Podrás reabrirla si hace falta.'))return;
 state.managing=true;$('#round-control-message').textContent='Guardando…';
 try{const result=await facApi(action,code);if(state.host?.code!==code||state.screen!=='host-screen')return;state.hostData=result;$('#round-filter').value=String(result.room.current_round);$('#round-control-message').textContent='Control actualizado.';}
 catch(e){if(state.host?.code===code)$('#round-control-message').textContent=e.message;}
 finally{state.managing=false;if(state.host?.code===code&&state.screen==='host-screen')renderHost();}
}
$('#open-round').onclick=()=>controlRound('open_round');
$('#close-round').onclick=()=>controlRound('close_round');
$('#advance-round').onclick=()=>controlRound('advance_round');
function guidedBlocked(t){return t.mode==='guided'&&(t.phase!=='open'||t.current_round!==t.round||!t.round_deadline||Date.now()+state.offset>=Date.parse(t.round_deadline));}
function renderHost(){
  const {room,teams}=state.hostData;state.hostClockOffset=room.server_now?Date.parse(room.server_now)-Date.now():0;renderManagement(teams);renderRoundControl(room,teams);
  $('#host-status').textContent=`${room.mode==='guided'?'Dirigida':'Autogestionada'} · Ingreso ${room.status==='open'?'abierto':'cerrado'} · Actualización automática cada 4 segundos.`;
  $('#toggle-room').textContent=room.status==='open'?'Cerrar ingreso':'Reabrir ingreso';
  $('#host-team-count').textContent=teams.length;
  $('#host-decision-count').textContent=teams.reduce((n,t)=>n+t.history.length,0);
  $('#host-debt-count').textContent=teams.filter(t=>t.credits<0).length;
  $('#host-live-body').innerHTML=rankingRows([...teams].sort((a,b)=>b.metrics.total-a.metrics.total||a.name.localeCompare(b.name)));
  const filter=$('#team-filter'),previous=filter.value;
  const options='<option value="">Todos los equipos</option>'+teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  if(filter.innerHTML!==options){filter.innerHTML=options;filter.value=teams.some(t=>t.id===previous)?previous:'';}
  const opened=new Set([...document.querySelectorAll('.host-team[open]')].map(el=>el.dataset.id));
  const round=Number($('#round-filter').value),selected=filter.value;
  $('#host-discussion').innerHTML=(round?[episodes[round-1]]:episodes).map(e=>`<div><strong>${esc(e.headline)}</strong>${e.talk.map(q=>`<p>${esc(q)}</p>`).join('')}</div>`).join('');
  const visible=teams.filter(t=>(!selected||t.id===selected)&&(!round||t.history.some(h=>h.round===round)));
  $('#host-teams').innerHTML=visible.length?visible.map(t=>`<details class="host-team" data-id="${t.id}" ${opened.has(t.id)||selected?'open':''}><summary><h3>${esc(t.name)}</h3><span class="team-meta"><strong>${t.metrics.total}/100</strong><span class="${t.credits<0?'debt':''}">Saldo ${t.credits}${t.credits<0?` · Deuda ${-t.credits}`:''}</span><span>${t.finished?'Finalizado':`Ronda ${t.round}/4`}</span><span>${t.history.length} decisiones ▾</span></span></summary>${t.history.length?t.history.filter(h=>!round||h.round===round).map(decisionCard).join(''):'<p class="hint">El equipo ya entró. Aún no ha ejecutado una decisión.</p>'}</details>`).join(''):`<p class="empty">${teams.length?'No hay decisiones para este filtro.':'Comparte la sala. Los equipos aparecerán aquí al ingresar.'}</p>`;
}
function draftKey(){return `${state.team.id}:${state.team.round}`;}
function saveDraft(){if(!state.team||state.team.resolved)return;local.drafts[draftKey()]={selected:state.selected,reason:$('#reason-input').value};try{persist();}catch(e){$('#sync-message').textContent=e.message;}}
function applyTeam(team,restoreDraft=false){
  state.team=team;state.loanApproved=false;state.offset=team.server_now?Date.parse(team.server_now)-Date.now():0;
  state.selected=[];
  if(restoreDraft&&!team.resolved){const draft=local.drafts[draftKey()];if(draft){state.selected=[...new Set(draft.selected.filter(id=>levers.some(l=>l.id===id)))];$('#reason-input').value=String(draft.reason||'').slice(0,180);}else $('#reason-input').value='';}
  else $('#reason-input').value=team.resolved?(team.history.at(-1)?.reason||''):'';
  if(team.resolved){delete local.drafts[draftKey()];try{persist();}catch{}}
}
function renderGame(){
  const t=state.team,r=rounds[t.round-1],m=t.metrics;
  $('#team-label').textContent=t.name;$('#team-room').textContent=t.room_code;
  $('#round-title').textContent=r.title;$('#round-label').textContent=t.round;$('#credits-label').textContent=t.credits;
  $('#balance-pill').classList.toggle('debt',t.credits<0);$('#balance-pill').classList.toggle('debt-bg',t.credits<0);
  const ep=episodes[t.round-1];$('#round-moment').textContent=ep.moment;$('#situation-title').textContent=ep.headline;$('#situation-context').textContent=ep.scene;$('#situation-dilemma').textContent=ep.question;$('#round-stake').textContent=ep.stake;$('#reason-label').textContent=ep.prompt;
  const previous=t.history.find(h=>h.round===t.round-1);$('#carryover').textContent=previous?`Llegas de una decisión ${previous.outcome}. Agile ${previous.agile}/100 · Coherencia ${previous.coherence}% · Saldo ${previous.creditsLeft} cr.${previous.debt?' · Deuda '+previous.debt+' cr.':''}`:'Tienes 120 créditos para toda la transformación.';
  $('#signals').innerHTML=r.signals.map(s=>`<div class="signal">${esc(s)}</div>`).join('');
  $('#round-progress').innerHTML=rounds.map((_,i)=>`<div class="progress-step ${i<t.history.length?'done':i+1===t.round?'current':''}"></div>`).join('');
  const labels={'Strategy':'Estrategia','Structure':'Estructura','Systems':'Sistemas','Shared Values':'Valores compartidos','Skills':'Capacidades','Style':'Estilo de liderazgo','Staff':'Personas'};
  $('#scores-grid').innerHTML=Object.entries(t.scores).map(([k,v])=>`<div class="score-card"><span>${labels[k]||esc(k)}</span><strong>${v}<small>/5</small></strong><div class="score-dots" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<v?'on':''}"></i>`).join('')}</div></div>`).join('');
  $('#agile-badge').textContent=`Agile ${m.agile}/100`;$('#coherence-label').textContent=`${m.coherence}%`;$('#coherence-bar').style.width=`${m.coherence}%`;
  $('#history').innerHTML=t.history.length?t.history.map(decisionCard).join(''):'<p class="hint">Aquí verás las consecuencias de tus decisiones.</p>';
  $('#round-board').innerHTML=t.history.length?`<table><thead><tr><th>Ronda</th><th>Agile</th><th>Coherencia</th><th>Saldo</th><th>Deuda</th><th>Puntaje</th></tr></thead><tbody>${t.history.map(h=>`<tr><td>${h.round}</td><td>${h.agile}</td><td>${h.coherence}%</td><td class="${h.debt?'debt':''}">${h.creditsLeft}</td><td>${h.debt}</td><td>${h.total}</td></tr>`).join('')}</tbody></table>`:'';
  const guided=t.mode==='guided',blocked=guidedBlocked(t);$('#guided-status').classList.toggle('hidden',!guided);if(guided)$('#guided-status').textContent=t.resolved?(t.history.at(-1)?.timedOut?'Se agotaron los 6 minutos. Tu ronda se registró sin intervención; espera la siguiente.':'Decisión registrada. Espera a que el facilitador habilite la siguiente ronda.'):blocked?(t.phase==='discussion'?'Ronda cerrada. Escucha la conversación; el facilitador puede reabrirla.':'Espera a que el facilitador abra la ronda.'):'Ronda abierta. Tienes hasta 6 minutos desde que el facilitador la abrió.';
  $('#reason-input').disabled=t.resolved||blocked;$('#reason-count').textContent=`${$('#reason-input').value.length}/180`;$('#execute-btn').disabled=t.resolved||state.busy||blocked;$('#next-btn').classList.toggle('hidden',guided);
  $('#round-footer').classList.toggle('hidden',!t.resolved);
  if(t.resolved){const h=t.history.at(-1);$('#footer-result-title').textContent=h.timedOut?'Tiempo agotado':`Decisión ${h.outcome}`;$('#footer-result-text').textContent=`${h.consequence} ${h.synergies.join(' ')} Agile ${h.agile}/100 · Coherencia ${h.coherence}% · Saldo ${h.creditsLeft}${h.debt?` · Deuda ${h.debt} · Penalización −${h.penalty} puntos`:''}.`;$('#round-debrief').innerHTML=debriefHtml(h);$('#round-talk').textContent=episodes[t.round-1].talk[0];$('#next-btn').textContent=t.round<4?`Continuar a la ronda ${t.round+1}`:'Ver resultado final';}
  renderLevers();tick();
}
function renderLevers(){
  const t=state.team,box=$('#levers-grid');box.replaceChildren();
  for(const l of levers){const selected=state.selected.includes(l.id),button=document.createElement('button');button.type='button';button.className=`lever${selected?' selected':''}`;button.setAttribute('aria-pressed',String(selected));button.disabled=t.resolved||state.busy||guidedBlocked(t);button.innerHTML=`<strong>${esc(l.name)}</strong><span class="lever-cost">${l.cost} cr.</span><p>${esc(l.desc)}</p>`;button.onclick=()=>{if(state.busy||t.resolved||guidedBlocked(t))return;const index=state.selected.indexOf(l.id);if(index>=0)state.selected.splice(index,1);else state.selected.push(l.id);state.loanApproved=false;$('#validation-msg').textContent='';renderLevers();saveDraft();};box.append(button);}
  $('#selection-label').textContent=`${state.selected.length} de ${levers.length}`;
  const p=creditPlan(t.credits,state.selected);
  $('#budget-preview').classList.toggle('debt-bg',p.debt>0);
  $('#budget-preview').innerHTML=`<div><span>Costo de esta decisión</span><strong>${p.cost} cr.</strong></div><div><span>Saldo ${t.resolved?'actual':'previsto'}</span><strong class="${p.debt?'debt':''}">${p.after} cr.</strong></div><p>${p.debt?`Deuda de ${p.debt} créditos · Penalización total −${p.penalty} puntos en el ranking.`:'El presupuesto es único para las cuatro rondas.'}</p>${!t.resolved&&!guidedBlocked(t)&&p.loan?`<p>El Comité Financiero puede prestar ${p.loan} créditos adicionales. Esto añade ${p.extraPenalty} puntos de penalización. No necesitas salir del juego.</p><button type="button" class="${state.loanApproved?'secondary':'primary'} wide" id="loan-btn" ${state.busy?'disabled':''}>${state.loanApproved?'Financiación aceptada · Cancelar':'Solicitar '+p.loan+' créditos'}</button><p class="hint">${state.loanApproved?'El préstamo quedará registrado cuando ejecutes esta decisión.':'Solicita financiación o reduce tus intervenciones antes de ejecutar.'}</p>`:''}`;
  const loan=$('#loan-btn');if(loan)loan.onclick=()=>{state.loanApproved=!state.loanApproved;renderLevers();};
}
function tick(){
  if(state.screen!=='game-screen'||!state.team)return;
  const t=state.team;if(t.mode==='guided'){
    const remaining=t.round_deadline?Math.max(0,Math.ceil((Date.parse(t.round_deadline)-Date.now()-state.offset)/1000)):0;
    const isOpen=t.phase==='open'&&t.current_round===t.round;
    const expired=isOpen&&remaining===0;
    $('#timer-label').textContent=t.resolved?'En espera':isOpen?(expired?'00:00':String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0')):'Cerrada';
    $('#timer-pill').classList.toggle('urgent',!t.resolved&&isOpen&&remaining<=60);
    if(expired&&!t.resolved){
      if(!$('#execute-btn').disabled){$('#execute-btn').disabled=true;$('#reason-input').disabled=true;renderLevers();$('#guided-status').textContent='Se agotaron los 6 minutos. La ronda se cerrará automáticamente y podrás ver las consecuencias.';}
      if(Date.now()>(state.nextGuidedExpiryRefresh||0)){state.nextGuidedExpiryRefresh=Date.now()+2500;refreshGame();}
    }
    return;
  }const remaining=t.resolved?0:Math.max(0,Math.ceil((Date.parse(t.deadline)-Date.now()-state.offset)/1000));
  $('#timer-label').textContent=t.resolved?'Ronda cerrada':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  $('#timer-pill').classList.toggle('urgent',!t.resolved&&remaining<=60);
  if(remaining===0&&!t.resolved&&!state.busy&&navigator.onLine&&Date.now()>(state.retryAfter||0))executeDecision(true);
}
async function executeDecision(timedOut=false){
  if(state.busy||state.team.resolved||guidedBlocked(state.team))return;
  const plan=creditPlan(state.team.credits,state.selected);
  if(!timedOut&&plan.loan&&!state.loanApproved){$('#validation-msg').textContent='Solicita financiación al Comité Financiero o ajusta las palancas.';return;}
  const unfunded=timedOut&&plan.loan&&!state.loanApproved;
  const chosen=unfunded?[]:state.selected;
  const reason=unfunded?'Tiempo agotado sin aceptar financiación; no se ejecutaron las palancas.':$('#reason-input').value.trim();
  if(!timedOut&&reason.length<20){$('#validation-msg').textContent='Justifica tu decisión con al menos 20 caracteres.';$('#reason-input').focus();return;}
  state.busy=true;setBusy($('#execute-btn'),true);renderLevers();$('#validation-msg').textContent='Guardando decisión…';
  try{
    const t=await api('decide',state.team.room_code,state.credential.key,{id:state.team.id,round:state.team.round,selected:chosen,reason});
    applyTeam(t);$('#validation-msg').textContent='Decisión guardada.';$('#sync-message').textContent='Tu decisión y sus consecuencias quedaron guardadas.';$('#sync-message').classList.remove('error');
    renderGame();await loadLeaderboard();$('#round-footer').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(e){state.retryAfter=Date.now()+10000;$('#validation-msg').textContent=e.message;$('#sync-message').textContent='La decisión aún no está confirmada. Puedes volver a intentarlo.';$('#sync-message').classList.add('error');}
  finally{state.busy=false;$('#execute-btn').disabled=state.team.resolved||guidedBlocked(state.team);renderLevers();}
}
async function nextRound(){
  if(state.busy||state.team.mode==='guided')return;state.busy=true;setBusy($('#next-btn'),true);
  try{const t=await api('next',state.team.room_code,state.credential.key,{id:state.team.id,round:state.team.round});applyTeam(t,true);$('#validation-msg').textContent='';if(t.finished){renderFinish();show('finish-screen');}else{renderGame();window.scrollTo({top:0,behavior:'smooth'});}}
  catch(e){$('#validation-msg').textContent=e.message;$('#sync-message').textContent=e.message;$('#sync-message').classList.add('error');}
  finally{state.busy=false;setBusy($('#next-btn'),false);if(!state.team.finished)renderGame();}
}
function renderFinish(){
  const t=state.team,m=t.metrics;
  $('#finish-title').textContent=m.total>=80?'Transformación sobresaliente':m.total>=65?'Transformación sólida':m.total>=50?'Transformación parcial':'Transformación frágil';
  $('#final-score').textContent=m.total;$('#final-agile').textContent=`${m.agile}/100`;$('#final-coherence').textContent=`${m.coherence}%`;$('#final-credits').textContent=t.credits;$('#final-credits').classList.toggle('debt',t.credits<0);$('#final-penalty').textContent=`−${m.penalty} puntos`;$('#final-penalty').classList.toggle('debt',m.penalty>0);
  $('#finish-copy').textContent=`El puntaje combina Cultura Agile (50 %), coherencia del sistema (40 %) y presupuesto disponible (10 %).${m.debt?` La deuda de ${m.debt} créditos restó ${m.penalty} puntos.`:' Administraron la transformación sin deuda.'} Las decisiones también se valoran por su pertinencia y sus sinergias.`;
  $('#finish-history').innerHTML=t.history.map(decisionCard).join('');
}
function rankingRows(teams){return teams.map((t,i)=>`<tr class="${t.id===state.team?.id?'me':''}"><td>${i+1}</td><td>${esc(t.name)}${t.id===state.team?.id?' · Tú':''}</td><td><strong>${t.metrics.total}</strong>${t.metrics.penalty?` <span class="debt" title="Penalización por deuda">(−${t.metrics.penalty})</span>`:''}</td><td>${t.metrics.agile}</td><td>${t.metrics.coherence}%</td><td class="${t.credits<0?'debt':''}">${t.credits}${t.credits<0?` / ${-t.credits} deuda`:''}</td><td><span class="status-badge ${t.finished?'status-finished':''}">${t.finished?'Finalizado':`Ronda ${t.round}`}</span></td></tr>`).join('');}
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
    if(Date.parse(t.updated_at)>Date.parse(state.team.updated_at)||t.phase!==state.team.phase||t.current_round!==state.team.current_round){const previous=state.team;const reset=t.round===1&&t.history.length===0&&(previous.history.length>0||t.deadline!==previous.deadline);if(reset){for(const key of Object.keys(local.drafts))if(key.startsWith(t.id+':'))delete local.drafts[key];}if(state.credential.name!==t.name){state.credential.name=t.name;$('#team-name').value=t.name;}try{persist();}catch{}applyTeam(t,!reset);if(t.finished){renderFinish();if(state.screen!=='finish-screen')show('finish-screen');}else{if(state.screen==='finish-screen')show('game-screen');renderGame();}}
    await loadLeaderboard();$('#sync-message').textContent='Progreso guardado · Puedes retomar desde este navegador.';$('#sync-message').classList.remove('error');
  }catch(e){if(e.message==='No se pudo verificar el acceso de este equipo.'){const removed=state.team;local.teams=local.teams.filter(c=>c.id!==removed.id);for(const key of Object.keys(local.drafts))if(key.startsWith(removed.id+':'))delete local.drafts[key];try{persist();}catch{}state.team=null;state.credential=null;show('start-screen');$('#join-message').textContent='Tu equipo ya no está en esta sala. Consulta con el facilitador antes de volver a ingresar.';return;}$('#sync-message').textContent=`No se pudo actualizar. ${e.message}`;$('#sync-message').classList.add('error');$('#live-status').textContent='No se pudo actualizar el ranking. Mostramos la última información disponible.';$('#final-live-status').textContent=$('#live-status').textContent;}
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
    let t;if(credential.id){try{t=await api('team',code,credential.key,{id:credential.id});}catch(e){if(e.message!=='No se pudo verificar el acceso de este equipo.')throw e;}}if(!t)t=await api('join',code,credential.key,{name});credential.name=t.name;credential.id=t.id;persist();state.credential=credential;applyTeam(t,true);$('#join-message').textContent='';
    if(t.finished){renderFinish();show('finish-screen');}else{show('game-screen');renderGame();}
  }catch(e){$('#join-message').textContent=e.message;}finally{setBusy(button,false);}
};
$('#execute-btn').onclick=()=>executeDecision(false);$('#next-btn').onclick=nextRound;
$('#reason-input').oninput=event=>{$('#reason-count').textContent=`${event.target.value.length}/180`;$('#validation-msg').textContent='';saveDraft();};
$('#team-filter').onchange=renderHost;$('#round-filter').onchange=renderHost;
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
