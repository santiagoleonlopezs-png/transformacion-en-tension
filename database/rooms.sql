-- Additive installation: legacy public.game_results is deliberately preserved.
-- Room/team capabilities are 256-bit random keys. Only SHA-256 hashes are stored.
-- The room code is an invitation, never a facilitator credential.
create schema if not exists tension_private;
revoke all on schema tension_private from public;
grant usage on schema tension_private to anon, authenticated;

create table tension_private.rules (id boolean primary key default true check(id), model jsonb not null);
create table tension_private.rooms (
  code text primary key check(code ~ '^[A-Z0-9-]{4,20}$'),
  title text not null check(char_length(title) between 1 and 80),
  host_hash text not null,
  status text not null default 'open' check(status in ('open','closed')),
  created_at timestamptz not null default now()
);
create table tension_private.teams (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references tension_private.rooms(code),
  name text not null check(char_length(name) between 1 and 40),
  key_hash text not null,
  round integer not null default 1 check(round between 1 and 4),
  credits integer not null default 120 check(credits between -180 and 120),
  scores jsonb not null,
  history jsonb not null default '[]'::jsonb check(jsonb_array_length(history)<=4),
  deadline timestamptz not null default (now()+interval '7 minutes'),
  resolved boolean not null default false,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tension_teams_room_name on tension_private.teams(room_code,lower(name));
alter table tension_private.rules enable row level security;
alter table tension_private.rooms enable row level security;
alter table tension_private.teams enable row level security;
revoke all on all tables in schema tension_private from public, anon, authenticated;
create policy deny_client_access on tension_private.rules as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_client_access on tension_private.rooms as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_client_access on tension_private.teams as restrictive for all to anon,authenticated using(false) with check(false);

insert into tension_private.rules(model) values ('{"rounds":[{"title":"La promesa de autonomía","context":"La organización anunció una transformación Agile. Los equipos escuchan mensajes de autonomía, pero continúan dependiendo de múltiples aprobaciones y controles.","dilemma":"¿Cómo reducir la distancia entre el discurso de autonomía y la forma real de trabajar?","signals":["💬 ‘Nos dicen que seamos autónomos, pero todo necesita aprobación.’","📊 La estrategia Agile existe, pero los sistemas siguen premiando cumplimiento individual.","🧭 Los líderes promueven experimentación, aunque penalizan errores visibles."],"relevance":{"strategy":1,"leadership":2,"talent":0,"culture":0,"architecture":3,"workspace":-1,"process":3,"change":1},"unresolved":{"Structure":-1,"Systems":-1},"misaligned":{"Shared Values":-1,"Systems":-1},"synergies":[{"needs":["architecture","process"],"delta":{"Structure":1,"Systems":1},"text":"Arquitectura + procesos reducen fricción estructural y burocrática."},{"needs":["leadership","architecture"],"delta":{"Style":1},"text":"Liderazgo + arquitectura hacen creíble la autonomía."}],"consequence":"La burocracia permanece y aumenta la distancia entre el discurso de autonomía y la experiencia real."},{"title":"La resistencia de los mandos medios","context":"Los primeros equipos piloto mejoraron tiempos de respuesta. Sin embargo, algunos mandos medios sienten que la autonomía reduce su control y empiezan a frenar decisiones.","dilemma":"¿Cómo sostener la autonomía sin romper la coordinación ni convertir el cambio en una lucha de poder?","signals":["🧱 Algunos líderes vuelven a centralizar decisiones que ya habían delegado.","🤝 Los equipos reportan ambigüedad sobre responsabilidades y límites de decisión.","📣 La narrativa del cambio es conocida, pero no todos los líderes la modelan."],"relevance":{"strategy":1,"leadership":3,"talent":1,"culture":2,"architecture":1,"workspace":-1,"process":0,"change":3},"unresolved":{"Style":-1,"Structure":-1},"misaligned":{"Style":-1,"Shared Values":-1},"synergies":[{"needs":["leadership","change"],"delta":{"Style":1,"Shared Values":1},"text":"Liderazgo + gestión de cambio reducen resistencia y refuerzan credibilidad."},{"needs":["leadership","culture"],"delta":{"Shared Values":1},"text":"Liderazgo + prácticas culturales convierten el discurso en comportamientos observables."}],"consequence":"La resistencia de liderazgo se convierte en cuello de botella y la autonomía pierde credibilidad."},{"title":"Fatiga de transformación","context":"La transformación avanza, pero se acumulan iniciativas, reuniones y nuevos rituales. Parte de la organización empieza a sentir cansancio y pérdida de foco.","dilemma":"¿Cómo sostener el cambio sin saturar a las personas ni convertir Agile en una colección de ceremonias?","signals":["😮‍💨 Las personas reportan fatiga y demasiadas iniciativas simultáneas.","🧪 Hay interés por experimentar, pero faltan capacidades prácticas en varios equipos.","🪑 Algunos espacios y herramientas siguen dificultando colaboración y trabajo transversal."],"relevance":{"strategy":1,"leadership":1,"talent":3,"culture":2,"architecture":-1,"workspace":2,"process":0,"change":3},"unresolved":{"Staff":-1,"Skills":-1},"misaligned":{"Staff":-1,"Shared Values":-1},"synergies":[{"needs":["talent","change"],"delta":{"Skills":1,"Staff":1},"text":"Talento + gestión de cambio aumentan capacidad sin sobrecargar el sistema."},{"needs":["culture","workspace"],"delta":{"Staff":1},"text":"Prácticas culturales + espacios adecuados reducen fricción cotidiana."}],"consequence":"La sobrecarga reduce energía, aprendizaje y disposición para sostener nuevas prácticas."},{"title":"¿Escalar o consolidar?","context":"La alta dirección quiere extender Agile a toda la organización. Los pilotos muestran resultados, pero todavía existen diferencias importantes entre áreas y sistemas.","dilemma":"¿Conviene escalar ya o consolidar primero las condiciones que hacen sostenible la cultura?","signals":["🚀 El comité directivo pide expansión rápida y resultados visibles.","📚 Algunos equipos aprendieron, pero otros todavía dependen de personas clave.","🔄 Procesos, métricas y estructuras no están igual de alineados en toda la organización."],"relevance":{"strategy":3,"leadership":1,"talent":1,"culture":-1,"architecture":3,"workspace":0,"process":3,"change":2},"unresolved":{"Systems":-1,"Shared Values":-1},"misaligned":{"Systems":-1,"Structure":-1},"synergies":[{"needs":["strategy","process"],"delta":{"Strategy":1,"Systems":1},"text":"Estrategia + procesos convierten el escalamiento en una decisión operable."},{"needs":["architecture","change"],"delta":{"Structure":1,"Shared Values":1},"text":"Arquitectura + gestión de cambio ayudan a escalar sin perder apropiación."}],"consequence":"La organización escala prácticas sin consolidar el sistema y aumenta el riesgo de retroceso."}],"levers":[{"id":"strategy","name":"Estrategia","cost":15,"desc":"Definir qué debe suceder y alinear proyectos e iniciativas con objetivos culturales.","effects":{"Strategy":2,"Shared Values":1}},{"id":"leadership","name":"Liderazgo","cost":20,"desc":"Alinear comportamientos, decisiones y estilo de liderazgo con la cultura deseada.","effects":{"Style":2,"Shared Values":1}},{"id":"talent","name":"Prácticas de Talento Humano","cost":20,"desc":"Alinear selección, desarrollo, desempeño y reconocimiento con la cultura.","effects":{"Skills":2,"Staff":1}},{"id":"culture","name":"Prácticas Culturales","cost":15,"desc":"Instalar rituales, símbolos, conversaciones y hábitos que refuercen la cultura.","effects":{"Shared Values":2,"Style":1}},{"id":"architecture","name":"Arquitectura organizacional","cost":25,"desc":"Ajustar estructura, roles, responsabilidades y flujo de decisiones.","effects":{"Structure":2,"Systems":1}},{"id":"workspace","name":"Espacio de trabajo","cost":10,"desc":"Diseñar espacios físicos o digitales que favorezcan colaboración y nuevas dinámicas.","effects":{"Staff":1,"Systems":1}},{"id":"process","name":"Procesos y tecnología","cost":25,"desc":"Alinear procesos, herramientas y tecnología con comportamientos y formas de trabajo esperadas.","effects":{"Systems":2,"Structure":1}},{"id":"change","name":"Gestión de cambio","cost":15,"desc":"Gestionar transición, adopción y apropiación de la cultura deseada.","effects":{"Shared Values":1,"Skills":1,"Strategy":1}}],"initialScores":{"Strategy":4,"Structure":2,"Systems":1,"Shared Values":2,"Skills":3,"Style":1,"Staff":4}}'::jsonb);

create function tension_private.metrics(p_scores jsonb,p_credits integer) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare c integer; a integer; e integer; d integer; p integer; b integer;
begin
 select greatest(0,least(100,round(100-(max(value::numeric)-min(value::numeric))*18)::integer)),
        round(avg(value::numeric)/5*70)::integer into c,a from jsonb_each_text(p_scores);
 -- Round after combining both terms, exactly as in the browser.
 select greatest(0,least(100,round(avg(value::numeric)/5*70+c*.3)::integer)) into a from jsonb_each_text(p_scores);
 e:=round(greatest(0,p_credits)::numeric/120*100); d:=greatest(0,-p_credits);
 p:=least(50,round(d*.4)); b:=round(a*.5+c*.4+e*.1);
 return jsonb_build_object('agile',a,'coherence',c,'efficiency',e,'debt',d,'penalty',p,'base',b,'total',greatest(0,b-p));
end; $$;
create function tension_private.delta(p_scores jsonb,p_delta jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare k text; v text; s jsonb:=p_scores;
begin
 for k,v in select key,value from jsonb_each_text(p_delta) loop
  s:=jsonb_set(s,array[k],to_jsonb(greatest(1,least(5,(s->>k)::integer+v::integer))));
 end loop;
 return s;
end; $$;
create function tension_private.team_json(t tension_private.teams,p_history boolean) returns jsonb
language sql stable security invoker set search_path='' as $$
 select (case when p_history then to_jsonb(t)-'key_hash' else
   jsonb_build_object('id',t.id,'name',t.name,'round',t.round,'credits',t.credits,'finished',t.finished,'resolved',t.resolved,'created_at',t.created_at,'updated_at',t.updated_at) end)
   ||jsonb_build_object('metrics',tension_private.metrics(t.scores,t.credits),'server_now',now());
$$;

create function tension_private.api(p_action text,p_code text,p_key text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 r tension_private.rooms; t tension_private.teams; model jsonb; rr jsonb; lever jsonb; synergy jsonb;
 chosen jsonb; v_scores jsonb; names jsonb:='[]'; notes jsonb:='[]'; before_m jsonb; after_m jsonb; h jsonb;
 reason text; level text; outcome text; hash text; nm text; expected integer;
 cost integer:=0; relevance integer:=0; strong integer:=0; counter integer:=0; n integer; rel integer; expired boolean; matches boolean;
begin
 if p_action is null or p_action not in ('create','room','leaderboard','host','status','join','team','decide','next') then raise exception 'Acción desconocida.'; end if;
 if p_code is null or p_code !~ '^[A-Z0-9-]{4,20}$' then raise exception 'El código debe tener entre 4 y 20 letras, números o guiones.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then raise exception 'Solicitud inválida.'; end if;
 if p_action not in ('room','leaderboard') then
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Falta la clave privada de acceso.'; end if;
  hash:=encode(sha256(convert_to(p_key,'UTF8')),'hex');
 end if;
 if p_action='create' then
  nm:=btrim(p_data->>'title');
  if nm is null or char_length(nm) not between 1 and 80 then raise exception 'Escribe el nombre de la sala (máximo 80 caracteres).'; end if;
  insert into tension_private.rooms(code,title,host_hash) values(p_code,nm,hash) on conflict do nothing;
  select * into r from tension_private.rooms where code=p_code;
  if r.host_hash is distinct from hash then raise exception 'Ese código ya está en uso. Elige otro.'; end if;
  return to_jsonb(r)-'host_hash';
 end if;
 select * into r from tension_private.rooms where code=p_code;
 if not found then raise exception 'Sala no encontrada. Comprueba el código con tu facilitador.'; end if;
 if p_action='room' then return to_jsonb(r)-'host_hash'; end if;
 if p_action='leaderboard' then
  return (select coalesce(jsonb_agg(x.payload order by x.total desc,x.debt,x.created_at),'[]') from
   (select tension_private.team_json(tt,false) payload,
     (tension_private.metrics(tt.scores,tt.credits)->>'total')::integer total,
     greatest(0,-tt.credits) debt,tt.created_at
    from tension_private.teams tt where room_code=p_code order by total desc,debt,created_at limit 200) x);
 end if;
 if p_action in ('host','status') then
  if hash is distinct from r.host_hash then raise exception 'La clave privada no corresponde a esta sala.'; end if;
  if p_action='status' then
   if p_data->>'status' is null or p_data->>'status' not in ('open','closed') then raise exception 'Estado inválido.'; end if;
   update tension_private.rooms set status=p_data->>'status' where code=p_code returning * into r;
  end if;
  return jsonb_build_object('room',to_jsonb(r)-'host_hash','teams',
    (select coalesce(jsonb_agg(tension_private.team_json(tt,true) order by tt.created_at),'[]') from tension_private.teams tt where room_code=p_code));
 end if;
 select rules.model into model from tension_private.rules where id=true;
 if p_action='join' then
  nm:=btrim(p_data->>'name');
  if nm is null or char_length(nm) not between 1 and 40 then raise exception 'Escribe un nombre de equipo (máximo 40 caracteres).'; end if;
  select * into t from tension_private.teams where room_code=p_code and lower(name)=lower(nm);
  if found then
   if t.key_hash is distinct from hash then raise exception 'Ya existe un equipo con ese nombre. Usa otro o vuelve desde el navegador donde ingresaron.'; end if;
   return tension_private.team_json(t,true);
  end if;
  if r.status<>'open' then raise exception 'Esta sala está cerrada para nuevos equipos.'; end if;
  insert into tension_private.teams(room_code,name,key_hash,scores) values(p_code,nm,hash,model->'initialScores') returning * into t;
  return tension_private.team_json(t,true);
 end if;
 if p_action not in ('team','decide','next') then raise exception 'Acción desconocida.'; end if;
 select * into t from tension_private.teams where room_code=p_code and id=(p_data->>'id')::uuid for update;
 if not found or t.key_hash is distinct from hash then raise exception 'No se pudo verificar el acceso de este equipo.'; end if;
 if p_action='team' then return tension_private.team_json(t,true); end if;
 expected:=(p_data->>'round')::integer;
 if expected is null or expected<>t.round then raise exception 'La ronda cambió. Actualiza para recuperar tu progreso.'; end if;
 if p_action='next' then
  if not t.resolved then raise exception 'Primero ejecuta la decisión de esta ronda.'; end if;
  if t.round=4 then update tension_private.teams set finished=true,updated_at=now() where id=t.id returning * into t;
  else update tension_private.teams set round=round+1,resolved=false,deadline=now()+interval '7 minutes',updated_at=now() where id=t.id returning * into t;
  end if;
  return tension_private.team_json(t,true);
 end if;
 if t.resolved or t.finished then return tension_private.team_json(t,true); end if;
 chosen:=p_data->'selected'; reason:=btrim(coalesce(p_data->>'reason','')); expired:=now()>=t.deadline;
 if chosen is null or jsonb_typeof(chosen)<>'array' then raise exception 'Selecciona hasta tres palancas.'; end if;
 n:=jsonb_array_length(chosen);
 if n>3 or n<>(select count(distinct value) from jsonb_array_elements_text(chosen)) then raise exception 'Selecciona hasta tres palancas diferentes.'; end if;
 if (not expired and char_length(reason)<20) or char_length(reason)>180 then raise exception 'La justificación debe tener entre 20 y 180 caracteres.'; end if;
 if reason='' then reason:='Tiempo agotado sin justificación.'; end if;
 rr:=model->'rounds'->(t.round-1); v_scores:=t.scores; before_m:=tension_private.metrics(v_scores,t.credits);
 for nm in select value from jsonb_array_elements_text(chosen) loop
  select value into lever from jsonb_array_elements(model->'levers') where value->>'id'=nm;
  if not found then raise exception 'Palanca inválida.'; end if;
  cost:=cost+(lever->>'cost')::integer; names:=names||jsonb_build_array(lever->>'name');
  v_scores:=tension_private.delta(v_scores,lever->'effects');
  rel:=(rr->'relevance'->>nm)::integer; relevance:=relevance+rel;
  if rel>=2 then strong:=strong+1; end if; if rel<0 then counter:=counter+1; end if;
 end loop;
 if n=0 then level:='sin intervención'; outcome:='No hubo intervención. '||(rr->>'consequence');
 elsif counter>=1 and strong=0 then level:='contraproducente'; outcome:='La decisión consume recursos, pero no responde al problema central. El sistema se deteriora.';
 elsif relevance<=1 then level:='baja pertinencia'; outcome:='La intervención está lejos del diagnóstico. El problema continúa y aparecen pérdidas explícitas.';
 elsif strong=0 or relevance<=3 then level:='parcial'; outcome:='La intervención atiende una parte del problema, pero deja una tensión relevante sin resolver.';
 else level:='alineada'; outcome:='La decisión está alineada con el diagnóstico y contiene la tensión principal.'; end if;
 if level in ('sin intervención','contraproducente','baja pertinencia','parcial') then v_scores:=tension_private.delta(v_scores,rr->'unresolved'); end if;
 if level in ('sin intervención','contraproducente','baja pertinencia') then v_scores:=tension_private.delta(v_scores,rr->'misaligned'); end if;
 if n=3 and relevance::numeric/n<2 then
  v_scores:=tension_private.delta(v_scores,'{"Staff":-1}'); outcome:=outcome||' La sobreintervención genera fatiga y dispersión.';
 end if;
 for synergy in select value from jsonb_array_elements(rr->'synergies') loop
  select bool_and(chosen ? v) into matches from jsonb_array_elements_text(synergy->'needs') v;
  if matches then v_scores:=tension_private.delta(v_scores,synergy->'delta'); notes:=notes||jsonb_build_array(synergy->>'text'); end if;
 end loop;
 after_m:=tension_private.metrics(v_scores,t.credits-cost);
 h:=jsonb_build_object('round',t.round,'title',rr->>'title','leverIds',chosen,'levers',names,'reason',reason,
  'outcome',level,'consequence',outcome,'synergies',notes,'cost',cost,'creditsLeft',t.credits-cost,
  'debt',after_m->'debt','penalty',after_m->'penalty','total',after_m->'total',
  'agile',after_m->'agile','coherence',after_m->'coherence',
  'deltaAgile',(after_m->>'agile')::integer-(before_m->>'agile')::integer,
  'deltaCoherence',(after_m->>'coherence')::integer-(before_m->>'coherence')::integer,
  'scoresBefore',t.scores,'scoresAfter',v_scores,'timedOut',expired,'at',now());
 update tension_private.teams set credits=credits-cost,scores=v_scores,history=history||jsonb_build_array(h),resolved=true,updated_at=now() where id=t.id returning * into t;
 return tension_private.team_json(t,true);
end; $$;
revoke all on all functions in schema tension_private from public,anon,authenticated;
grant execute on function tension_private.api(text,text,text,jsonb) to anon,authenticated;
create function public.tension_api(p_action text,p_code text,p_key text default null,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select tension_private.api(p_action,p_code,p_key,p_data); $$;
revoke all on function public.tension_api(text,text,text,jsonb) from public;
grant execute on function public.tension_api(text,text,text,jsonb) to anon,authenticated;
notify pgrst, 'reload schema';
