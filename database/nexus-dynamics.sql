-- Additive Nexus dynamics; existing rooms/history retain their original results.
alter table tension_private.rooms add column mode text not null default 'autonomous' check(mode in ('autonomous','guided'));
alter table tension_private.rooms add column phase text not null default 'deciding' check(phase in ('waiting','deciding','discussion'));
alter table tension_private.rooms add column current_round integer not null default 1 check(current_round between 1 and 4);
alter table tension_private.rooms add column dynamics_version integer not null default 1;
alter table tension_private.rooms add column epoch integer not null default 0;
alter table tension_private.teams add column decision_started timestamptz default now();
alter table tension_private.teams add column decision_elapsed numeric not null default 0;
alter table tension_private.teams add column removed boolean not null default false;
alter table tension_private.teams drop constraint teams_credits_check;
alter table tension_private.teams add constraint teams_credits_check check(credits between -540 and 120);
drop index tension_private.tension_teams_room_name;
create unique index tension_teams_room_name on tension_private.teams(room_code,lower(name)) where not removed;

create function tension_private.team_metrics(t tension_private.teams) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare m jsonb:=tension_private.metrics(t.scores,t.credits); b integer;
begin
 select round(avg((value->>'roundScore')::numeric)) into b from jsonb_array_elements(t.history) where value ? 'roundScore';
 if b is not null then m:=m||jsonb_build_object('base',b,'total',greatest(0,b-(m->>'penalty')::integer)); end if;
 return m;
end; $$;
create or replace function tension_private.team_json(t tension_private.teams,p_history boolean) returns jsonb
language sql stable security invoker set search_path='' as $$
 select (case when p_history then to_jsonb(t)-'key_hash' else
 jsonb_build_object('id',t.id,'name',t.name,'round',t.round,'credits',t.credits,'finished',t.finished,'resolved',t.resolved,'created_at',t.created_at,'updated_at',t.updated_at) end)
 || jsonb_build_object('metrics',tension_private.team_metrics(t),'server_now',now())
 || case when p_history then jsonb_build_object('room',(select to_jsonb(r)-'host_hash'-'owner_uid' from tension_private.rooms r where r.code=t.room_code)) else '{}'::jsonb end;
$$;

create function tension_private.score_decision(p_round integer,p_selected jsonb,p_before jsonb,p_after jsonb,p_data jsonb,p_seconds numeric) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare model jsonb; rr jsonb; focus jsonb; attention jsonb:=p_data->'attention'; bets jsonb:=p_data->'bets'; target text:=p_data->>'target'; k text; val jsonb; nm text; rel integer; load integer:=0; capacity integer; excess integer; fit numeric:=0; diagnosis numeric:=0; err numeric:=0; impact numeric:=0; wrong integer:=0; n integer:=jsonb_array_length(p_selected); pts jsonb; penalties jsonb; total integer; v numeric;
begin
 select rules.model into model from tension_private.rules where id=true;
 rr:=model->'rounds'->(p_round-1);
 focus:=( '[ ["Structure","Systems"], ["Style","Shared Values"], ["Staff","Skills"], ["Strategy","Systems"] ]'::jsonb)->(p_round-1);
 if jsonb_typeof(attention) is distinct from 'object' or jsonb_typeof(bets) is distinct from 'object' then raise exception 'Completa el diagnóstico y la predicción de las siete dimensiones.'; end if;
 if (select count(*) from jsonb_object_keys(attention))<>7 or (select count(*) from jsonb_object_keys(bets))<>7 then raise exception 'Completa las siete dimensiones.'; end if;
 for k,val in select key,value from jsonb_each(p_before) loop
  if jsonb_typeof(attention->k) is distinct from 'number' or jsonb_typeof(bets->k) is distinct from 'number' then raise exception 'Diagnóstico o predicción inválidos.'; end if;
  v:=(attention->>k)::numeric;
  if v<0 or v>100 or v<>trunc(v) then raise exception 'Distribuye 100 puntos de atención.'; end if;
  if abs((bets->>k)::numeric)>4 or (bets->>k)::numeric<>trunc((bets->>k)::numeric) then raise exception 'Predice entre -4 y 4 por dimensión.'; end if;
  if focus ? k then diagnosis:=diagnosis+v; end if;
  err:=err+abs((bets->>k)::numeric-((p_after->>k)::numeric-(p_before->>k)::numeric));
  impact:=impact+(p_after->>k)::numeric-(p_before->>k)::numeric;
 end loop;
 if (select sum(value::numeric) from jsonb_each_text(attention))<>100 or target is null or not(p_before ? target) then raise exception 'Distribuye exactamente 100 puntos y elige qué movilizar.'; end if;
 diagnosis:=least(1,diagnosis/65)*.75+case when focus ? target then .25 else 0 end;
 for nm in select value from jsonb_array_elements_text(p_selected) loop
  rel:=(rr->'relevance'->>nm)::integer;
  fit:=fit+case when rel>=3 then 1 when rel=2 then .65 when rel=1 then .25 when rel<0 then -.25 else 0 end;
  wrong:=wrong+case when rel<0 then 12 when rel=0 then 7 else 0 end;
  load:=load+case when nm in ('architecture','process') then 3 when nm in ('leadership','talent','change') then 2 else 1 end;
 end loop;
 fit:=greatest(0,least(1,fit/greatest(1,n)));
 capacity:=greatest(2,least(7,(p_before->>'Staff')::integer+1+case when (p_before->>'Skills')::integer>=4 then 1 else 0 end));
 excess:=greatest(0,load-capacity);
 pts:=jsonb_build_object('relevance',round(40*fit),'diagnosis',round(20*diagnosis),'forecast',round(10*greatest(0,1-err/14)),'impact',round(greatest(0,least(15,7.5+impact))),'focus',greatest(0,10-excess*2),'speed',case when fit>=.65 and diagnosis>=.45 then round(5*greatest(0,1-p_seconds/420)) else 0 end);
 penalties:=jsonb_build_object('overload',least(45,excess*4),'wrong',least(20,wrong),'delay',case when fit>=.65 and diagnosis>=.45 then least(3,floor(greatest(0,p_seconds-420)/120)) else 0 end);
 select greatest(0,least(100,(select sum(value::numeric) from jsonb_each_text(pts))-(select sum(value::numeric) from jsonb_each_text(penalties))))::integer into total;
 return jsonb_build_object('version',3,'points',pts,'penalties',penalties,'totalNoDebt',total,'elapsedSeconds',round(p_seconds),'load',load,'capacity',capacity,'critical',focus);
end; $$;

create or replace function tension_private.api(p_action text,p_code text,p_key text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 r tension_private.rooms; t tension_private.teams; model jsonb; rr jsonb; lever jsonb; synergy jsonb;
 chosen jsonb; v_scores jsonb; names jsonb:='[]'; notes jsonb:='[]'; before_m jsonb; after_m jsonb; h jsonb;
 reason text; level text; outcome text; hash text; nm text; expected integer;
 cost integer:=0; relevance integer:=0; strong integer:=0; counter integer:=0; n integer; rel integer; expired boolean; matches boolean; scoring jsonb; seconds numeric;
begin
 if p_action is null or p_action not in ('room','leaderboard','join','team','decide','next') then raise exception 'Acción desconocida.'; end if;
 if p_code is null or p_code !~ '^[A-Z0-9-]{4,20}$' then raise exception 'El código debe tener entre 4 y 20 letras, números o guiones.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then raise exception 'Solicitud inválida.'; end if;
 if p_action not in ('room','leaderboard') then
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Falta la clave privada de acceso.'; end if;
  hash:=encode(sha256(convert_to(p_key,'UTF8')),'hex');
 end if;
 select * into r from tension_private.rooms where code=p_code for share;
 if not found then raise exception 'Sala no encontrada. Comprueba el código con tu facilitador.'; end if;
 if p_action='room' then return to_jsonb(r)-'host_hash'-'owner_uid'; end if;
 if p_action='leaderboard' then
  return (select coalesce(jsonb_agg(x.payload order by x.total desc,x.debt,x.created_at),'[]') from
   (select tension_private.team_json(tt,false) payload,
     (tension_private.team_metrics(tt)->>'total')::integer total,
     greatest(0,-tt.credits) debt,tt.created_at
    from tension_private.teams tt where room_code=p_code and not tt.removed order by total desc,debt,created_at limit 200) x);
 end if;
 select rules.model into model from tension_private.rules where id=true;
 if p_action='join' then
  nm:=btrim(p_data->>'name');
  if nm is null or char_length(nm) not between 1 and 40 then raise exception 'Escribe un nombre de equipo (máximo 40 caracteres).'; end if;
  select * into t from tension_private.teams where room_code=p_code and lower(name)=lower(nm) and not removed;
  if found then
   if t.key_hash is distinct from hash then raise exception 'Ya existe un equipo con ese nombre. Usa otro o vuelve desde el navegador donde ingresaron.'; end if;
   return tension_private.team_json(t,true);
  end if;
  if r.status<>'open' then raise exception 'Esta sala está cerrada para nuevos equipos.'; end if;
  insert into tension_private.teams(room_code,name,key_hash,scores,decision_started) values(p_code,nm,hash,model->'initialScores',case when r.mode='guided' and r.phase<>'deciding' then null else now() end) returning * into t;
  return tension_private.team_json(t,true);
 end if;
 if p_action not in ('team','decide','next') then raise exception 'Acción desconocida.'; end if;
 select * into t from tension_private.teams where room_code=p_code and id=(p_data->>'id')::uuid for update;
 if not found or t.key_hash is distinct from hash then raise exception 'No se pudo verificar el acceso de este equipo.'; end if;
 if t.removed then raise exception 'Este equipo fue retirado o la sala se reinició. Vuelve a ingresar.'; end if;
 if p_action='team' then return tension_private.team_json(t,true); end if;
 if coalesce((p_data->>'epoch')::integer,0)<>r.epoch then raise exception 'La sala se reinició. Vuelve a ingresar.'; end if;
 expected:=(p_data->>'round')::integer;
 if expected is null or expected<>t.round then raise exception 'La ronda cambió. Actualiza para recuperar tu progreso.'; end if;
 if p_action='next' then
  if not t.resolved then raise exception 'Primero ejecuta la decisión de esta ronda.'; end if;
  if r.mode='guided' and t.round<4 and (r.phase<>'deciding' or r.current_round<=t.round) then raise exception 'Espera a que el facilitador abra la siguiente ronda.'; end if;
  if t.round=4 then update tension_private.teams set finished=true,updated_at=now() where id=t.id returning * into t;
  else update tension_private.teams set round=round+1,resolved=false,deadline=now()+interval '7 minutes',decision_started=now(),decision_elapsed=0,updated_at=now() where id=t.id returning * into t;
  end if;
  return tension_private.team_json(t,true);
 end if;
 if t.resolved or t.finished then return tension_private.team_json(t,true); end if;
 if r.mode='guided' and (r.phase<>'deciding' or t.round>r.current_round) then raise exception 'El facilitador no ha abierto esta ronda.'; end if;
 chosen:=p_data->'selected'; reason:=btrim(coalesce(p_data->>'reason','')); expired:=false;
 if chosen is null or jsonb_typeof(chosen)<>'array' then raise exception 'Selecciona palancas válidas.'; end if;
 n:=jsonb_array_length(chosen);
 if n>8 or n<>(select count(distinct value) from jsonb_array_elements_text(chosen)) then raise exception 'Selecciona palancas diferentes.'; end if;
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
 if (select sum(case when v in ('architecture','process') then 3 when v in ('leadership','talent','change') then 2 else 1 end) from jsonb_array_elements_text(chosen) v)>greatest(2,least(7,(t.scores->>'Staff')::integer+1+case when (t.scores->>'Skills')::integer>=4 then 1 else 0 end)) then
  v_scores:=tension_private.delta(v_scores,'{"Staff":-1}'); outcome:=outcome||' La sobreintervención genera fatiga y dispersión.';
 end if;
 for synergy in select value from jsonb_array_elements(rr->'synergies') loop
  select bool_and(chosen ? v) into matches from jsonb_array_elements_text(synergy->'needs') v;
  if matches then v_scores:=tension_private.delta(v_scores,synergy->'delta'); notes:=notes||jsonb_build_array(synergy->>'text'); end if;
 end loop;
 seconds:=t.decision_elapsed+case when t.decision_started is null then 0 else greatest(0,extract(epoch from (now()-t.decision_started))) end;
 if r.dynamics_version>=3 and not(p_data ? 'attention') then raise exception 'Actualiza la experiencia para completar el diagnóstico y la predicción.'; end if;
 -- Legacy clients remain compatible in autonomous rooms; the new interface sends the full decision.
 if p_data ? 'attention' then scoring:=tension_private.score_decision(t.round,chosen,t.scores,v_scores,p_data,seconds); end if;
 after_m:=tension_private.metrics(v_scores,t.credits-cost);
 h:=jsonb_build_object('round',t.round,'title',rr->>'title','leverIds',chosen,'levers',names,'reason',reason,
  'outcome',level,'consequence',outcome,'synergies',notes,'cost',cost,'creditsLeft',t.credits-cost,
  'debt',after_m->'debt','penalty',after_m->'penalty','total',after_m->'total',
  'agile',after_m->'agile','coherence',after_m->'coherence',
  'deltaAgile',(after_m->>'agile')::integer-(before_m->>'agile')::integer,
  'deltaCoherence',(after_m->>'coherence')::integer-(before_m->>'coherence')::integer,
  'scoresBefore',t.scores,'scoresAfter',v_scores,'timedOut',expired,'at',now());
 if scoring is not null then
 h:=h||jsonb_build_object('scoring',scoring,'roundScore',scoring->'totalNoDebt','attention',p_data->'attention','bets',p_data->'bets','target',p_data->'target');
 select round(avg((value->>'roundScore')::numeric)) into n from jsonb_array_elements(t.history||jsonb_build_array(h)) where value ? 'roundScore';
 h:=h||jsonb_build_object('total',greatest(0,n-(after_m->>'penalty')::integer));
 end if;
 update tension_private.teams set credits=credits-cost,scores=v_scores,history=history||jsonb_build_array(h),resolved=true,decision_elapsed=seconds,decision_started=null,updated_at=now() where id=t.id returning * into t;
 return tension_private.team_json(t,true);
end; $$;

create or replace function tension_private.facilitator(p_action text,p_uid text,p_code text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r tension_private.rooms; title text; key_hash text;
begin
 if p_uid is null or char_length(p_uid) not between 1 and 128 then raise exception using errcode='42501',message='Inicia sesión como facilitador.'; end if;
 if p_action is null or p_action not in ('list','create','host','status','claim','control','remove','reset') then raise exception 'Acción no permitida.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then raise exception 'Solicitud inválida.'; end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(rr)-'host_hash'-'owner_uid' order by rr.created_at desc),'[]') from tension_private.rooms rr where rr.owner_uid=p_uid);
 end if;
 if p_code is null or p_code !~ '^[A-Z0-9-]{4,20}$' then raise exception 'El código debe tener entre 4 y 20 letras, números o guiones.'; end if;
 if p_action='create' then
  title:=btrim(p_data->>'title');
  if title is null or char_length(title) not between 1 and 80 then raise exception 'Escribe el nombre de la sala (máximo 80 caracteres).'; end if;
  insert into tension_private.rooms(code,title,host_hash,owner_uid) values(p_code,title,encode(extensions.gen_random_bytes(32),'hex'),p_uid) on conflict do nothing returning * into r;
  if not found then raise exception 'Ese código ya está en uso.'; end if;
 end if;
 select * into r from tension_private.rooms where code=p_code for update;
 if not found then raise exception 'Sala no encontrada.'; end if;
 if p_action='claim' and r.owner_uid is null then
  if p_data->>'key' is null or p_data->>'key' !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501',message='Necesitas la clave privada de la sala anterior.'; end if;
  key_hash:=encode(sha256(convert_to(p_data->>'key','UTF8')),'hex');
  if key_hash is distinct from r.host_hash then raise exception using errcode='42501',message='La clave privada no corresponde a esta sala.'; end if;
  update tension_private.rooms set owner_uid=p_uid where code=p_code returning * into r;
 end if;
 if r.owner_uid is distinct from p_uid then raise exception using errcode='42501',message='Esta sala pertenece a otra cuenta de facilitador.'; end if;
 if p_action='create' then
 if coalesce(p_data->>'mode','autonomous') not in ('guided','autonomous') then raise exception 'Modalidad inválida.'; end if;
 update tension_private.rooms set dynamics_version=3,mode=coalesce(p_data->>'mode','autonomous'),phase=case when p_data->>'mode'='guided' then 'waiting' else 'deciding' end where code=p_code returning * into r;
 end if;
 if p_action='control' then
 if p_data->>'phase' is null or p_data->>'round' is null or p_data->>'phase' not in ('deciding','discussion') or (p_data->>'round')::integer not between 1 and 4 then raise exception 'Control de ronda inválido.'; end if;
 update tension_private.teams set decision_elapsed=decision_elapsed+case when decision_started is null then 0 else greatest(0,extract(epoch from(now()-decision_started))) end,decision_started=null where room_code=p_code and not removed and not resolved and round>(p_data->>'round')::integer;
 update tension_private.rooms set phase=p_data->>'phase',current_round=(p_data->>'round')::integer where code=p_code returning * into r;
 -- Conversation time is excluded; reopening retains earlier decision time.
 if r.phase='discussion' then
 update tension_private.teams set decision_elapsed=decision_elapsed+case when decision_started is null then 0 else greatest(0,extract(epoch from(now()-decision_started))) end,decision_started=null,updated_at=now() where room_code=p_code and not removed and not resolved;
 else
 update tension_private.teams set decision_started=coalesce(decision_started,now()),updated_at=now() where room_code=p_code and not removed and not resolved and round<=r.current_round;
 end if;
 end if;
 if p_action='remove' then update tension_private.teams set removed=true,updated_at=now() where room_code=p_code and id=(p_data->>'id')::uuid; end if;
 if p_action='reset' then
 update tension_private.teams set removed=true,updated_at=now() where room_code=p_code and not removed;
 update tension_private.rooms set epoch=epoch+1,current_round=1,phase=case when mode='guided' then 'waiting' else 'deciding' end where code=p_code returning * into r;
 end if;
 if p_action in ('create','claim') then return to_jsonb(r)-'host_hash'-'owner_uid'; end if;
 if p_action='status' then
  if p_data->>'status' is null or p_data->>'status' not in ('open','closed') then raise exception 'Estado inválido.'; end if;
  update tension_private.rooms set status=p_data->>'status' where code=p_code returning * into r;
 end if;
 return jsonb_build_object('room',to_jsonb(r)-'host_hash'-'owner_uid','teams',
  (select coalesce(jsonb_agg(tension_private.team_json(t,true) order by t.created_at),'[]') from tension_private.teams t where room_code=p_code and not t.removed));
end; $$;

revoke all on function tension_private.score_decision(integer,jsonb,jsonb,jsonb,jsonb,numeric) from public,anon,authenticated;
revoke all on function tension_private.team_metrics(tension_private.teams) from public,anon,authenticated;
notify pgrst,'reload schema';
