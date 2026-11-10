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
