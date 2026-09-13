(() => {
  const ROUND_SECONDS = 7 * 60;
  const STARTING_CREDITS = 120;
  const MIN_REASON = 20;
  const MAX_REASON = 180;
  const initialScores = { Strategy:4, Structure:2, Systems:1, "Shared Values":2, Skills:3, Style:1, Staff:4 };

  const rounds = [
    {
      title:"La promesa de autonomía",
      context:"La organización anunció una transformación Agile. Los equipos escuchan mensajes de autonomía, pero continúan dependiendo de múltiples aprobaciones y controles.",
      dilemma:"¿Cómo reducir la distancia entre el discurso de autonomía y la forma real de trabajar?",
      signals:[
        "💬 ‘Nos dicen que seamos autónomos, pero todo necesita aprobación.’",
        "📊 La estrategia Agile existe, pero los sistemas siguen premiando cumplimiento individual.",
        "🧭 Los líderes promueven experimentación, aunque penalizan errores visibles."
      ],
      preferred:["architecture","process","leadership"],
      pressure:{Structure:-1,Systems:-1},
      consequence:"La burocracia se mantiene y aumenta la distancia entre el discurso y la operación."
    },
    {
      title:"La resistencia de los mandos medios",
      context:"Los primeros equipos piloto mejoraron tiempos de respuesta. Sin embargo, algunos mandos medios sienten que la autonomía reduce su control y empiezan a frenar decisiones.",
      dilemma:"¿Cómo sostener la autonomía sin romper la coordinación ni convertir el cambio en una lucha de poder?",
      signals:[
        "🧱 Algunos líderes vuelven a centralizar decisiones que ya habían delegado.",
        "🤝 Los equipos reportan ambigüedad sobre responsabilidades y límites de decisión.",
        "📣 La narrativa del cambio es conocida, pero no todos los líderes la modelan."
      ],
      preferred:["leadership","change","culture"],
      pressure:{Style:-1,Structure:-1},
      consequence:"La resistencia de liderazgo se convierte en cuello de botella y la autonomía pierde credibilidad."
    },
    {
      title:"Fatiga de transformación",
      context:"La transformación avanza, pero se acumulan iniciativas, reuniones y nuevos rituales. Parte de la organización empieza a sentir cansancio y pérdida de foco.",
      dilemma:"¿Cómo sostener el cambio sin saturar a las personas ni convertir Agile en una colección de ceremonias?",
      signals:[
        "😮‍💨 Las personas reportan fatiga y demasiadas iniciativas simultáneas.",
        "🧪 Hay interés por experimentar, pero faltan capacidades prácticas en varios equipos.",
        "🪑 Algunos espacios y herramientas siguen dificultando colaboración y trabajo transversal."
      ],
      preferred:["talent","culture","workspace","change"],
      pressure:{Staff:-1,Skills:-1},
      consequence:"La sobrecarga reduce energía, aprendizaje y disposición para sostener nuevas prácticas."
    },
    {
      title:"¿Escalar o consolidar?",
      context:"La alta dirección quiere extender Agile a toda la organización. Los pilotos muestran resultados, pero todavía existen diferencias importantes entre áreas y sistemas.",
      dilemma:"¿Conviene escalar ya o consolidar primero las condiciones que hacen sostenible la cultura?",
      signals:[
        "🚀 El comité directivo pide expansión rápida y resultados visibles.",
        "📚 Algunos equipos aprendieron, pero otros todavía dependen de personas clave.",
        "🔄 Procesos, métricas y estructuras no están igual de alineados en toda la organización."
      ],
      preferred:["strategy","process","architecture","change"],
      pressure:{Systems:-1,"Shared Values":-1},
      consequence:"La organización escala prácticas sin consolidar el sistema y aumenta el riesgo de retroceso."
    }
  ];

  const levers = [
    {id:"strategy", name:"Estrategia", cost:15, desc:"Definir qué debe suceder y alinear proyectos e iniciativas con objetivos culturales.", effects:{Strategy:2,"Shared Values":1}},
    {id:"leadership", name:"Liderazgo", cost:20, desc:"Alinear comportamientos, decisiones y estilo de liderazgo con la cultura deseada.", effects:{Style:2,"Shared Values":1}},
    {id:"talent", name:"Prácticas de Talento Humano", cost:20, desc:"Alinear selección, desarrollo, desempeño y reconocimiento con la cultura.", effects:{Skills:2,Staff:1}},
    {id:"culture", name:"Prácticas Culturales", cost:15, desc:"Instalar rituales, símbolos, conversaciones y hábitos que refuercen la cultura.", effects:{"Shared Values":2,Style:1}},
    {id:"architecture", name:"Arquitectura organizacional", cost:25, desc:"Ajustar estructura, roles, responsabilidades y flujo de decisiones.", effects:{Structure:2,Systems:1}},
    {id:"workspace", name:"Espacio de trabajo", cost:10, desc:"Diseñar espacios físicos o digitales que favorezcan colaboración y nuevas dinámicas.", effects:{Staff:1,Systems:1}},
    {id:"process", name:"Procesos y tecnología", cost:25, desc:"Alinear procesos, herramientas y tecnología con comportamientos y formas de trabajo esperadas.", effects:{Systems:2,Structure:1}},
    {id:"change", name:"Gestión de cambio", cost:15, desc:"Gestionar transición, adopción y apropiación de la cultura deseada.", effects:{"Shared Values":1,Skills:1,Strategy:1}}
  ];

  const state = { team:"", classCode:"", round:1, credits:STARTING_CREDITS, selected:[], scores:{...initialScores}, history:[], finished:false, timer:ROUND_SECONDS, timerId:null, liveInterval:null, roundResolved:false };
  const $ = s => document.querySelector(s);
  const screens=[...document.querySelectorAll('.screen')];
  const clamp=v=>Math.max(1,Math.min(5,v));
  const show=id=>{screens.forEach(x=>x.classList.remove('active'));$(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});};

  let supabaseClient=null;
  const cfg=window.GAME_CONFIG||{};
  if(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase) supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);

  function metrics(){
    const vals=Object.values(state.scores), avg=vals.reduce((a,b)=>a+b,0)/vals.length, spread=Math.max(...vals)-Math.min(...vals);
    const coherence=Math.max(0,Math.min(100,Math.round(100-spread*18)));
    const agile=Math.max(0,Math.min(100,Math.round((avg/5)*70+coherence*.3)));
    const efficiency=Math.round((state.credits/STARTING_CREDITS)*100);
    const total=Math.max(0,Math.min(100,Math.round(agile*.5+coherence*.4+efficiency*.1)));
    return {avg,coherence,agile,efficiency,total};
  }

  function renderRound(){
    const r=rounds[state.round-1];
    $('#round-label').textContent=state.round;
    $('#round-title').textContent=r.title;
    $('#situation-title').textContent=r.title;
    $('#situation-context').textContent=r.context;
    $('#situation-dilemma').textContent=r.dilemma;
    $('#signals-caption').textContent=`Ronda ${state.round} · Lee las señales antes de intervenir.`;
    $('#signals').innerHTML=r.signals.map(s=>`<div class="signal">${s}</div>`).join('');
    renderScores(); renderLevers(); renderHistory();
  }

  function renderScores(){
    $('#scores-grid').innerHTML=Object.entries(state.scores).map(([k,v])=>`<div class="score-card"><span>${k}</span><strong>${v}<small>/5</small></strong></div>`).join('');
    const m=metrics();
    $('#coherence-label').textContent=m.coherence+'%'; $('#coherence-bar').style.width=m.coherence+'%'; $('#agile-badge').textContent='Agile '+m.agile+'/100';
    $('#credits-label').textContent=state.credits; $('#trend-agile-main').textContent=m.agile+'/100'; $('#trend-coherence-main').textContent=m.coherence+'%'; $('#trend-credits-main').textContent=state.credits;
    const last=state.history.at(-1);
    $('#trend-agile-delta').innerHTML=last?deltaHtml(last.deltaAgile,false):'Sin cambios todavía';
    $('#trend-coherence-delta').innerHTML=last?deltaHtml(last.deltaCoherence,true):'Sin cambios todavía';
    renderBoard();
  }

  function renderLevers(){
    const box=$('#levers-grid'); box.innerHTML='';
    levers.forEach(l=>{
      const selected=state.selected.includes(l.id), unaffordable=l.cost>state.credits&&!selected;
      const b=document.createElement('button'); b.type='button'; b.className='lever'+(selected?' selected':'')+(unaffordable?' unaffordable':''); b.disabled=state.roundResolved||unaffordable;
      b.innerHTML=`<div class="lever-top"><div><strong>${l.name}</strong><p>${l.desc}</p></div><strong>${l.cost}</strong></div>`;
      b.addEventListener('click',()=>toggleLever(l.id)); box.appendChild(b);
    });
    $('#selection-label').textContent=state.selected.length+' seleccionada'+(state.selected.length===1?'':'s');
  }

  function toggleLever(id){
    if(state.roundResolved) return;
    $('#validation-msg').textContent='';
    const i=state.selected.indexOf(id);
    if(i>=0) state.selected.splice(i,1);
    else { if(state.selected.length>=3){$('#validation-msg').textContent='Máximo 3 palancas por ronda.';return;} state.selected.push(id); }
    renderLevers();
  }

  function renderHistory(){
    const el=$('#history');
    if(!state.history.length){el.className='history empty';el.textContent='Aún no has ejecutado intervenciones.';return;}
    el.className='history';
    el.innerHTML=state.history.map(h=>`<div class="history-item"><strong>Ronda ${h.round} · ${h.title}</strong><br>${h.levers.length?h.levers.join(', '):'Sin intervención'}<br><span class="small">${escapeHtml(h.reason)} · Agile ${h.agile} (${fmt(h.deltaAgile)}) · Coherencia ${h.coherence}% (${fmt(h.deltaCoherence,true)})</span></div>`).join('');
  }

  function renderBoard(){
    const box=$('#round-board');
    if(!state.history.length){box.className='round-board empty';box.textContent='Aún no hay rondas ejecutadas.';return;}
    box.className='round-board';
    box.innerHTML=`<table><thead><tr><th>Ronda</th><th>Agile</th><th>Δ Agile</th><th>Coherencia</th><th>Δ Coherencia</th><th>Créditos</th></tr></thead><tbody>${state.history.map(h=>`<tr><td>${h.round}</td><td>${h.agile}</td><td>${deltaHtml(h.deltaAgile,false)}</td><td>${h.coherence}%</td><td>${deltaHtml(h.deltaCoherence,true)}</td><td>${h.creditsLeft}</td></tr>`).join('')}</tbody></table>`;
  }

  function deltaHtml(v,pct){const s=pct?'%':'';return v>0?`<span class="delta-up">▲ +${v}${s}</span>`:v<0?`<span class="delta-down">▼ ${v}${s}</span>`:`<span class="delta-neutral">• 0${s}</span>`}
  function fmt(v,p=false){const s=p?'%':'';return v>0?`+${v}${s}`:`${v}${s}`}
  function totalCost(){return state.selected.reduce((sum,id)=>sum+levers.find(l=>l.id===id).cost,0)}

  function startTimer(){
    clearTimer(); state.timer=ROUND_SECONDS; updateTimer();
    state.timerId=setInterval(()=>{ state.timer--; updateTimer(); if(state.timer<=0){clearTimer(); resolveRound(true);} },1000);
  }
  function clearTimer(){if(state.timerId){clearInterval(state.timerId);state.timerId=null}}
  function updateTimer(){
    const min=String(Math.floor(state.timer/60)).padStart(2,'0'), sec=String(state.timer%60).padStart(2,'0');
    $('#timer-label').textContent=`${min}:${sec}`; $('#timer-pill').classList.toggle('urgent',state.timer<=60);
  }

  function validateDecision(timedOut=false){
    const reason=$('#reason-input').value.trim();
    if(!timedOut && reason.length<MIN_REASON){$('#validation-msg').textContent=`Justifica tu decisión en al menos ${MIN_REASON} caracteres.`;return false;}
    if(totalCost()>state.credits){$('#validation-msg').textContent='No tienes créditos suficientes.';return false;}
    return true;
  }

  function applyPressure(round,matchCount){
    if(matchCount>=2) return {level:'resuelta',delta:{},text:'La intervención estuvo bien alineada con la tensión principal y evitó que el problema escalara.'};
    const factor=matchCount===1?0.5:1;
    const delta={}; Object.entries(round.pressure).forEach(([k,v])=>delta[k]=Math.round(v*factor)||v);
    Object.entries(delta).forEach(([k,v])=>state.scores[k]=clamp(state.scores[k]+v));
    return matchCount===1?{level:'parcial',delta,text:'La intervención atendió parte del problema, pero quedó una tensión relevante sin resolver.'}:{level:'no resuelta',delta,text:round.consequence};
  }

  function resolveRound(timedOut=false){
    if(state.roundResolved) return;
    if(!validateDecision(timedOut)) return;
    state.roundResolved=true; clearTimer();

    const r=rounds[state.round-1], before=metrics();
    const chosen=state.selected.map(id=>levers.find(l=>l.id===id));
    const reason=$('#reason-input').value.trim() || (timedOut?'Tiempo agotado sin justificación válida.':'Decisión sin intervención.');
    const cost=totalCost(); state.credits-=cost;
    chosen.forEach(l=>Object.entries(l.effects).forEach(([k,d])=>state.scores[k]=clamp(state.scores[k]+d)));

    const matchCount=state.selected.filter(id=>r.preferred.includes(id)).length;
    const outcome=applyPressure(r,matchCount);
    const after=metrics();
    const h={round:state.round,title:r.title,levers:chosen.map(x=>x.name),reason,agile:after.agile,coherence:after.coherence,creditsLeft:state.credits,deltaAgile:after.agile-before.agile,deltaCoherence:after.coherence-before.coherence,outcome:outcome.level,timedOut};
    state.history.push(h);

    $('#footer-result-title').textContent=timedOut?'⏱ Tiempo agotado':'Ronda resuelta';
    $('#footer-result-text').textContent=`${outcome.text} Agile ${fmt(h.deltaAgile)} · Coherencia ${fmt(h.deltaCoherence,true)} · Créditos ${state.credits}.`;
    $('#round-footer').classList.remove('hidden');
    $('#execute-btn').disabled=true; $('#reason-input').disabled=true; state.selected=[];
    renderScores(); renderLevers(); renderHistory(); saveProgress(); loadLiveLeaderboard();

    if(state.round<4){$('#next-btn').textContent=`Continuar a la ronda ${state.round+1}`;} else {$('#next-btn').textContent='Ver resultado final';}
    $('#round-footer').scrollIntoView({behavior:'smooth',block:'end'});
  }

  function nextRound(){
    if(!state.roundResolved) return;
    if(state.round>=4){finishGame();return;}
    state.round++; state.roundResolved=false; state.selected=[]; $('#reason-input').value=''; $('#reason-input').disabled=false; $('#reason-count').textContent='0/180'; $('#validation-msg').textContent=''; $('#round-footer').classList.add('hidden'); $('#execute-btn').disabled=false;
    renderRound(); startTimer(); saveProgress(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function currentPayload(statusOverride=null){const m=metrics();return{team_name:state.team,class_code:state.classCode,score:m.total,agile_score:m.agile,coherence:m.coherence,credits_left:state.credits,decisions:state.history,current_round:state.round,status:statusOverride||(state.finished?'finished':'in_progress')}}
  async function saveProgress(statusOverride=null){if(!supabaseClient||!state.team||!state.classCode)return;const{error}=await supabaseClient.from('game_results').upsert(currentPayload(statusOverride),{onConflict:'class_code,team_name'});if(error)console.error(error.message)}

  async function finishGame(){
    clearTimer(); state.finished=true; const m=metrics();
    $('#finish-title').textContent=m.total>=80?'Transformación sobresaliente':m.total>=65?'Transformación sólida':m.total>=50?'Transformación parcial':'Transformación frágil'; $('#final-score').textContent=m.total; $('#final-agile').textContent=m.agile+'/100'; $('#final-coherence').textContent=m.coherence+'%'; $('#final-credits').textContent=state.credits;
    $('#finish-copy').textContent='El resultado combina Cultura Agile, coherencia del sistema y eficiencia del presupuesto. Las rondas no resueltas generan consecuencias sobre las 7S.';
    await saveProgress('finished'); show('#finish-screen');
  }

  async function fetchLeaderboard(){if(!supabaseClient||!state.classCode)return{data:[],error:true};return await supabaseClient.from('game_results').select('team_name,score,agile_score,coherence,credits_left,current_round,status,created_at').eq('class_code',state.classCode).order('score',{ascending:false}).order('created_at',{ascending:true}).limit(100)}
  function statusBadge(r){return r.status==='finished'?'<span class="status-badge status-finished">Finalizado</span>':`<span class="status-badge status-live">En juego · R${r.current_round||1}</span>`}
  async function loadLiveLeaderboard(){
    const body=$('#live-body'),status=$('#live-status'),podium=$('#podium-live');
    if(!body || !status || !podium) return;
    const{data,error}=await fetchLeaderboard();
    if(error){status.textContent='No se pudo cargar el ranking en vivo.';body.innerHTML='';podium.innerHTML='';return;}
    status.textContent=data.length?`${data.length} equipo(s) · actualización cada 5 segundos.`:'Aún no hay equipos registrados.';
    const medals=['🥇','🥈','🥉'];
    podium.innerHTML=data.slice(0,3).map((r,i)=>`<div class="podium-card ${r.team_name===state.team?'me':''}"><div class="podium-rank">${medals[i]}</div><div class="podium-team">${escapeHtml(r.team_name)}${r.team_name===state.team?' · Tú':''}</div><div class="podium-score">${r.score}</div></div>`).join('');
    body.innerHTML=data.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.team_name)}${r.team_name===state.team?' <strong>(Tú)</strong>':''}</td><td><strong>${r.score}</strong></td><td>${r.agile_score}</td><td>${r.coherence}%</td><td>${statusBadge(r)}</td></tr>`).join('');
  }
  async function loadLeaderboard(){$('#leaderboard-code').textContent=state.classCode;const{data,error}=await fetchLeaderboard();$('#leaderboard-status').textContent=error?'No se pudo cargar el ranking.':`${data.length} equipo(s) registrados.`;$('#leaderboard-body').innerHTML=(data||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.team_name)}</td><td><strong>${r.score}</strong></td><td>${r.agile_score}</td><td>${r.coherence}%</td><td>${r.credits_left}</td><td>${statusBadge(r)}</td></tr>`).join('')}
  function startLiveRefresh(){if(state.liveInterval)clearInterval(state.liveInterval);state.liveInterval=setInterval(loadLiveLeaderboard,5000)}
  function escapeHtml(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML}

  $('#team-form').addEventListener('submit',async e=>{e.preventDefault();state.team=$('#team-name').value.trim();state.classCode=$('#class-code').value.trim().toUpperCase();if(!state.team||!state.classCode)return;$('#team-label').textContent=state.team;show('#game-screen');renderRound();startTimer();await saveProgress();await loadLiveLeaderboard();startLiveRefresh();});
  $('#execute-btn').addEventListener('click',()=>resolveRound(false));
  $('#next-btn').addEventListener('click',nextRound);
  $('#reason-input').addEventListener('input',e=>{$('#reason-count').textContent=`${e.target.value.length}/${MAX_REASON}`;$('#validation-msg').textContent='';});
  $('#refresh-live-btn').addEventListener('click',loadLiveLeaderboard);
  $('#leaderboard-btn').addEventListener('click',async()=>{show('#leaderboard-screen');await loadLeaderboard()});
  $('#back-finish-btn').addEventListener('click',()=>show('#finish-screen'));
  $('#restart-btn').addEventListener('click',()=>location.reload());
})();