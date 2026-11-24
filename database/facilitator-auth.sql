-- Existing rooms and decisions are preserved. Old keys can only link an unowned
-- room after a facilitator has authenticated at the server.
alter table tension_private.rooms add column owner_uid text check(owner_uid is null or char_length(owner_uid) between 1 and 128);
create index tension_rooms_owner on tension_private.rooms(owner_uid,created_at desc);

create function tension_private.facilitator(p_action text,p_uid text,p_code text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r tension_private.rooms; title text; key_hash text;
begin
 if p_uid is null or char_length(p_uid) not between 1 and 128 then raise exception using errcode='42501',message='Inicia sesión como facilitador.'; end if;
 if p_action is null or p_action not in ('list','create','host','status','claim') then raise exception 'Acción no permitida.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then raise exception 'Solicitud inválida.'; end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(rr)-'host_hash'-'owner_uid' order by rr.created_at desc),'[]') from tension_private.rooms rr where rr.owner_uid=p_uid);
 end if;
 if p_code is null or p_code !~ '^[A-Z0-9-]{4,20}$' then raise exception 'El código debe tener entre 4 y 20 letras, números o guiones.'; end if;
 if p_action='create' then
  title:=btrim(p_data->>'title');
  if title is null or char_length(title) not between 1 and 80 then raise exception 'Escribe el nombre de la sala (máximo 80 caracteres).'; end if;
  insert into tension_private.rooms(code,title,host_hash,owner_uid) values(p_code,title,encode(extensions.gen_random_bytes(32),'hex'),p_uid) on conflict do nothing;
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
 if p_action in ('create','claim') then return to_jsonb(r)-'host_hash'-'owner_uid'; end if;
 if p_action='status' then
  if p_data->>'status' is null or p_data->>'status' not in ('open','closed') then raise exception 'Estado inválido.'; end if;
  update tension_private.rooms set status=p_data->>'status' where code=p_code returning * into r;
 end if;
 return jsonb_build_object('room',to_jsonb(r)-'host_hash'-'owner_uid','teams',
  (select coalesce(jsonb_agg(tension_private.team_json(t,true) order by t.created_at),'[]') from tension_private.teams t where room_code=p_code));
end; $$;
revoke all on function tension_private.facilitator(text,text,text,jsonb) from public,anon,authenticated;
grant usage on schema tension_private to service_role;
grant execute on function tension_private.facilitator(text,text,text,jsonb) to service_role;
create function public.tension_facilitator(p_action text,p_uid text,p_code text default null,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select tension_private.facilitator(p_action,p_uid,p_code,p_data); $$;
revoke all on function public.tension_facilitator(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.tension_facilitator(text,text,text,jsonb) to service_role;
notify pgrst,'reload schema';

create or replace function tension_private.api(p_action text,p_code text,p_key text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 r tension_private.rooms; t tension_private.teams; model jsonb; rr jsonb; lever jsonb; synergy jsonb;
 chosen jsonb; v_scores jsonb; names jsonb:='[]'; notes jsonb:='[]'; before_m jsonb; after_m jsonb; h jsonb;
 reason text; level text; outcome text; hash text; nm text; expected integer;
 cost integer:=0; relevance integer:=0; strong integer:=0; counter integer:=0; n integer; rel integer; expired boolean; matches boolean;
begin
 if p_action is null or p_action not in ('room','leaderboard','join','team','decide','next') then raise exception 'Acción desconocida.'; end if;
 if p_code is null or p_code !~ '^[A-Z0-9-]{4,20}$' then raise exception 'El código debe tener entre 4 y 20 letras, números o guiones.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then raise exception 'Solicitud inválida.'; end if;
 if p_action not in ('room','leaderboard') then
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Falta la clave privada de acceso.'; end if;
  hash:=encode(sha256(convert_to(p_key,'UTF8')),'hex');
 end if;
 select * into r from tension_private.rooms where code=p_code;
 if not found then raise exception 'Sala no encontrada. Comprueba el código con tu facilitador.'; end if;
 if p_action='room' then return to_jsonb(r)-'host_hash'-'owner_uid'; end if;
 if p_action='leaderboard' then
  return (select coalesce(jsonb_agg(x.payload order by x.total desc,x.debt,x.created_at),'[]') from
   (select tension_private.team_json(tt,false) payload,
     (tension_private.metrics(tt.scores,tt.credits)->>'total')::integer total,
     greatest(0,-tt.credits) debt,tt.created_at
    from tension_private.teams tt where room_code=p_code order by total desc,debt,created_at limit 200) x);
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
