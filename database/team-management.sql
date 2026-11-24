CREATE OR REPLACE FUNCTION tension_private.facilitator(p_action text, p_uid text, p_code text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r tension_private.rooms; title text; key_hash text; team_id uuid; new_name text;
begin
 if p_uid is null or char_length(p_uid) not between 1 and 128 then raise exception using errcode='42501',message='Inicia sesión como facilitador.'; end if;
 if p_action is null or p_action not in ('list','create','host','status','claim','delete_team','rename_team','reset_team') then raise exception 'Acción no permitida.'; end if;
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
 if p_action in ('delete_team','rename_team','reset_team') then
  begin
   team_id := (p_data->>'id')::uuid;
  exception when invalid_text_representation then raise exception 'Equipo inválido.';
  end;
  if team_id is null then raise exception 'Equipo inválido.'; end if;
  perform 1 from tension_private.teams where id=team_id and room_code=p_code for update;
  if not found then raise exception 'El equipo ya no está en esta sala.'; end if;
  if p_action='delete_team' then
   delete from tension_private.teams where id=team_id and room_code=p_code;
  elsif p_action='rename_team' then
   new_name:=btrim(p_data->>'name');
   if new_name is null or char_length(new_name) not between 1 and 40 then raise exception 'Escribe un nombre de 1 a 40 caracteres.'; end if;
   if exists(select 1 from tension_private.teams where room_code=p_code and lower(name)=lower(new_name) and id<>team_id) then raise exception 'Ya existe un equipo con ese nombre.'; end if;
   update tension_private.teams set name=new_name,updated_at=now() where id=team_id and room_code=p_code;
  else
   update tension_private.teams set round=1,credits=120,scores=(select model->'initialScores' from tension_private.rules where id=true),history='[]',deadline=now()+interval '7 minutes',resolved=false,finished=false,updated_at=now() where id=team_id and room_code=p_code;
  end if;
 end if;
 return jsonb_build_object('room',to_jsonb(r)-'host_hash'-'owner_uid','teams',
  (select coalesce(jsonb_agg(tension_private.team_json(t,true) order by t.created_at),'[]') from tension_private.teams t where room_code=p_code));
end; $function$;
revoke all on function tension_private.facilitator(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function tension_private.facilitator(text,text,text,jsonb) to service_role;
