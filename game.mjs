export const initialScores = { Strategy:4, Structure:2, Systems:1, "Shared Values":2, Skills:3, Style:1, Staff:4 };

export const rounds = [
    {
      title:"La promesa de autonomía",
      context:"La organización anunció una transformación Agile. Los equipos escuchan mensajes de autonomía, pero continúan dependiendo de múltiples aprobaciones y controles.",
      dilemma:"¿Cómo reducir la distancia entre el discurso de autonomía y la forma real de trabajar?",
      signals:[
        "💬 ‘Nos dicen que seamos autónomos, pero todo necesita aprobación.’",
        "📊 La estrategia Agile existe, pero los sistemas siguen premiando cumplimiento individual.",
        "🧭 Los líderes promueven experimentación, aunque penalizan errores visibles."
      ],
      relevance:{strategy:1,leadership:2,talent:0,culture:0,architecture:3,workspace:-1,process:3,change:1},
      unresolved:{Structure:-1,Systems:-1},
      misaligned:{"Shared Values":-1,Systems:-1},
      synergies:[
        {needs:["architecture","process"],delta:{Structure:1,Systems:1},text:"Arquitectura + procesos reducen fricción estructural y burocrática."},
        {needs:["leadership","architecture"],delta:{Style:1},text:"Liderazgo + arquitectura hacen creíble la autonomía."}
      ],
      consequence:"La burocracia permanece y aumenta la distancia entre el discurso de autonomía y la experiencia real."
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
      relevance:{strategy:1,leadership:3,talent:1,culture:2,architecture:1,workspace:-1,process:0,change:3},
      unresolved:{Style:-1,Structure:-1},
      misaligned:{Style:-1,"Shared Values":-1},
      synergies:[
        {needs:["leadership","change"],delta:{Style:1,"Shared Values":1},text:"Liderazgo + gestión de cambio reducen resistencia y refuerzan credibilidad."},
        {needs:["leadership","culture"],delta:{"Shared Values":1},text:"Liderazgo + prácticas culturales convierten el discurso en comportamientos observables."}
      ],
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
      relevance:{strategy:1,leadership:1,talent:3,culture:2,architecture:-1,workspace:2,process:0,change:3},
      unresolved:{Staff:-1,Skills:-1},
      misaligned:{Staff:-1,"Shared Values":-1},
      synergies:[
        {needs:["talent","change"],delta:{Skills:1,Staff:1},text:"Talento + gestión de cambio aumentan capacidad sin sobrecargar el sistema."},
        {needs:["culture","workspace"],delta:{Staff:1},text:"Prácticas culturales + espacios adecuados reducen fricción cotidiana."}
      ],
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
      relevance:{strategy:3,leadership:1,talent:1,culture:-1,architecture:3,workspace:0,process:3,change:2},
      unresolved:{Systems:-1,"Shared Values":-1},
      misaligned:{Systems:-1,Structure:-1},
      synergies:[
        {needs:["strategy","process"],delta:{Strategy:1,Systems:1},text:"Estrategia + procesos convierten el escalamiento en una decisión operable."},
        {needs:["architecture","change"],delta:{Structure:1,"Shared Values":1},text:"Arquitectura + gestión de cambio ayudan a escalar sin perder apropiación."}
      ],
      consequence:"La organización escala prácticas sin consolidar el sistema y aumenta el riesgo de retroceso."
    }
  ];

export const levers = [
    {id:"strategy", name:"Estrategia", cost:15, desc:"Definir qué debe suceder y alinear proyectos e iniciativas con objetivos culturales.", effects:{Strategy:2,"Shared Values":1}},
    {id:"leadership", name:"Liderazgo", cost:20, desc:"Alinear comportamientos, decisiones y estilo de liderazgo con la cultura deseada.", effects:{Style:2,"Shared Values":1}},
    {id:"talent", name:"Prácticas de Talento Humano", cost:20, desc:"Alinear selección, desarrollo, desempeño y reconocimiento con la cultura.", effects:{Skills:2,Staff:1}},
    {id:"culture", name:"Prácticas Culturales", cost:15, desc:"Instalar rituales, símbolos, conversaciones y hábitos que refuercen la cultura.", effects:{"Shared Values":2,Style:1}},
    {id:"architecture", name:"Arquitectura organizacional", cost:25, desc:"Ajustar estructura, roles, responsabilidades y flujo de decisiones.", effects:{Structure:2,Systems:1}},
    {id:"workspace", name:"Espacio de trabajo", cost:10, desc:"Diseñar espacios físicos o digitales que favorezcan colaboración y nuevas dinámicas.", effects:{Staff:1,Systems:1}},
    {id:"process", name:"Procesos y tecnología", cost:25, desc:"Alinear procesos, herramientas y tecnología con comportamientos y formas de trabajo esperadas.", effects:{Systems:2,Structure:1}},
    {id:"change", name:"Gestión de cambio", cost:15, desc:"Gestionar transición, adopción y apropiación de la cultura deseada.", effects:{"Shared Values":1,Skills:1,Strategy:1}}
  ];


export const STARTING_CREDITS = 120;
export const ROUND_SECONDS = 420;
export function metrics(scores, credits) {
  const values = Object.values(scores);
  const coherence = Math.max(0, Math.min(100, Math.round(100 - (Math.max(...values) - Math.min(...values)) * 18)));
  const agile = Math.max(0, Math.min(100, Math.round(values.reduce((a,b)=>a+b,0) / values.length / 5 * 70 + coherence * .3)));
  const efficiency = Math.round(Math.max(0, credits) / STARTING_CREDITS * 100);
  const debt = Math.max(0, -credits);
  const penalty = Math.min(50, Math.round(debt * .4));
  const base = Math.round(agile * .5 + coherence * .4 + efficiency * .1);
  return {agile, coherence, efficiency, debt, penalty, base, total: Math.max(0, base - penalty)};
}
export function roomLink(code, base) {
  const url = new URL(base);
  url.search = ''; url.hash = ''; url.searchParams.set('sala', code);
  return url.href;
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function decisionsCsv(room, teams) {
  const rows = [['Sala','Equipo','Ronda','Situación','Palancas','Justificación','Resultado','Costo','Saldo','Deuda','Penalización','Agile','Coherencia','Puntaje','Tiempo agotado','Fecha UTC']];
  for (const team of teams) {
    if (!team.history.length) rows.push([room.title,team.name,'','','','Sin decisiones registradas']);
    for (const h of team.history) rows.push([room.title,team.name,h.round,h.title,h.levers.join(' | '),h.reason,h.outcome,h.cost,h.creditsLeft,h.debt,h.penalty,h.agile,h.coherence,h.total,h.timedOut?'Sí':'No',h.at]);
  }
  return '\ufeff' + rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}

/* Narrative layer: the server remains authoritative for scores and stored decisions. */
export const episodes = [
 {moment:"08:15 · El lanzamiento",headline:"La autonomía que nadie se atreve a ejercer",scene:"El auditorio aplaude la nueva cultura. Horas después, Laura, líder de un equipo piloto, recibe una solicitud urgente de un usuario. Puede resolverla hoy, pero necesita tres aprobaciones. Su jefe le advierte: «Si algo sale mal, tú respondes». Laura vuelve a esperar.",stake:"La dirección espera resultados rápidos. Los equipos quieren permiso real para decidir. Tu presupuesto debe alcanzar para toda la transformación.",question:"¿Qué cambiarías primero para que la autonomía sea real y no solo una promesa?",prompt:"¿Qué señal priorizaron y qué dejarían sin intervenir por ahora?",win:"Laura encuentra mejores condiciones para decidir y el discurso empieza a parecer creíble.",loss:"Laura sigue atrapada entre la urgencia del usuario y el miedo a equivocarse.",partial:"Laura recibe señales de cambio, pero todavía encuentra obstáculos para decidir.",talk:["¿Qué diferencia existe entre anunciar autonomía y habilitarla?","¿Qué aprobación o incentivo sostiene el comportamiento actual?"]},
 {moment:"Semana 4 · La reunión a puerta cerrada",headline:"El poder que nadie quiere perder",scene:"Los pilotos empiezan a responder más rápido. Andrés, mando medio con quince años de experiencia, escucha que su equipo ya no necesita su autorización para todo. «¿Entonces cuál es mi papel?», pregunta. En la siguiente reunión vuelve a pedir que todas las decisiones pasen por él.",stake:"Puedes acelerar la autonomía, pero también despertar temor a perder estatus, control y seguridad. No todos se oponen por las mismas razones.",question:"¿Cómo transformar el papel de los líderes sin convertirlos en enemigos del cambio?",prompt:"¿Qué necesidad del liderazgo atenderían y qué comportamiento esperan observar?",win:"Andrés empieza a encontrar un papel distinto: habilitar decisiones en vez de acumularlas.",loss:"Andrés vuelve a centralizar decisiones; los equipos aprenden que es más seguro pedir permiso.",partial:"Algunos líderes empiezan a cambiar, pero la autonomía depende todavía de quién dirige el equipo.",talk:["¿Qué estaba protegiendo Andrés: control, identidad o seguridad?","¿Cómo se refuerza un nuevo comportamiento del liderazgo?"]},
 {moment:"Mes 3 · El mensaje de las 22:14",headline:"Cuando cambiar empieza a doler",scene:"Laura escribe en el chat: «No puedo con otro comité». Hay reuniones de seguimiento, nuevos rituales y entregas pendientes. Un compañero admite que está pensando en dejar el equipo. Mientras tanto, la dirección pide una nueva iniciativa para acelerar la adopción.",stake:"No intervenir también tiene consecuencias. Intervenir en exceso consume tiempo, energía y confianza. El saldo de las rondas anteriores pesa.",question:"¿Qué harías para recuperar la energía y sostener el aprendizaje sin añadir más ruido?",prompt:"¿Qué carga reducirían y qué capacidad necesitan fortalecer?",win:"El equipo encuentra espacio para aprender y recuperar energía sin abandonar la transformación.",loss:"Las personas perciben el cambio como otra obligación y comienzan a desconectarse.",partial:"La fatiga disminuye en algunos frentes, pero no desaparecen todas las causas de sobrecarga.",talk:["¿Qué dejarían de hacer para que el cambio sea sostenible?","¿Cómo diferenciar falta de capacidad de falta de energía?"]},
 {moment:"Mes 6 · El comité decisivo",headline:"El éxito que puede romper el sistema",scene:"El comité celebra los resultados de los pilotos y quiere anunciar la expansión a toda la organización. Finanzas exige justificar cada recurso adicional. Laura advierte que otras áreas aún no tienen las mismas capacidades ni condiciones. El presidente pregunta: «¿Escalamos o esperamos?»",stake:"La última decisión debe proteger lo construido. Una victoria visible hoy puede convertirse en un retroceso mañana. El resultado final incluye toda la deuda acumulada.",question:"¿Qué condiciones deben existir para escalar sin replicar las tensiones del piloto?",prompt:"¿Qué evidencia presentarían al comité y qué riesgo están dispuestos a asumir?",win:"El comité cuenta con mejores condiciones para sostener la transformación más allá del piloto.",loss:"El anuncio de expansión corre más rápido que las capacidades del sistema.",partial:"La expansión tiene bases parciales, pero todavía hay condiciones que requieren consolidación.",talk:["¿Qué evidencia distingue un piloto exitoso de un sistema listo para escalar?","¿Qué costo de corto plazo aceptarían para evitar un retroceso?"]}
];
export function creditPlan(balance, selected) {
 const cost=selected.reduce((sum,id)=>sum+(levers.find(l=>l.id===id)?.cost||0),0);
 const after=balance-cost, debt=Math.max(0,-after), loan=Math.max(0,debt-Math.max(0,-balance));
 const penalty=Math.min(50,Math.round(debt*.4));
 return {cost,after,debt,loan,penalty,extraPenalty:penalty-Math.min(50,Math.round(Math.max(0,-balance)*.4))};
}
export function roundDebrief(h) {
 const r=rounds[h.round-1],e=episodes[h.round-1];
 if(!r||!e)return {story:"",actions:[],changes:[],talk:[]};
 const ids=h.leverIds||levers.filter(l=>h.levers?.includes(l.name)).map(l=>l.id);
 const actions=ids.map(id=>{const l=levers.find(x=>x.id===id),v=r.relevance[id];return {name:l?.name||id,text:v>=2?"Responde directamente a las señales centrales de esta ronda.":v===1?"Aporta al cambio, pero no resuelve por sí sola la tensión principal.":v===0?"Consume recursos sin atender de forma directa el problema de esta ronda.":"No responde al problema central y puede añadir fricción."};});
 const labels={Strategy:"Estrategia",Structure:"Estructura",Systems:"Sistemas","Shared Values":"Valores compartidos",Skills:"Capacidades",Style:"Estilo de liderazgo",Staff:"Personas"};
 const changes=Object.keys(labels).map(k=>({name:labels[k],delta:(h.scoresAfter?.[k]??0)-(h.scoresBefore?.[k]??0)})).filter(x=>x.delta);
 return {story:h.outcome==="alineada"?e.win:h.outcome==="parcial"?e.partial:e.loss,actions,changes,talk:e.talk};
}
