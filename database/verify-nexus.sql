-- Run inside BEGIN / ROLLBACK. Uses only temporary test rooms owned by QA-FAC.
do $$
declare a jsonb; b jsonb; r jsonb; t text; key text:=repeat('b',64); rejected boolean; i integer; first_score integer; data jsonb;
begin
 r:=public.tension_facilitator('create','QA-FAC','QA-NEXUS','{"title":"Prueba Nexus", "mode":"guided"}');
 assert r->>'phase'='waiting';
 a:=public.tension_api('join','QA-NEXUS',key,'{"name":"Equipo QA"}');t:=a->>'id';
 data:=jsonb_build_object('id',t,'round',1,'epoch',0,'selected','["architecture","process","leadership","talent","culture","workspace","strategy","change"]'::jsonb,'reason','Si alineamos las palancas, esperamos reducir la tensión del caso.','target','Structure','attention','{"Strategy":0,"Structure":50,"Systems":50,"Shared Values":0,"Skills":0,"Style":0,"Staff":0}'::jsonb,'bets','{"Strategy":0,"Structure":2,"Systems":2,"Shared Values":0,"Skills":0,"Style":0,"Staff":-1}'::jsonb);
 rejected:=false;begin perform public.tension_api('decide','QA-NEXUS',key,data);exception when others then rejected:=true;end;assert rejected,'Waiting guided rooms must block decisions';
 for i in 1..4 loop
 perform public.tension_facilitator('control','QA-FAC','QA-NEXUS',jsonb_build_object('round',i,'phase','deciding'));
 data:=data||jsonb_build_object('round',i);
 a:=public.tension_api('decide','QA-NEXUS',key,data);
 assert jsonb_array_length(a->'history')=i;
 assert (a->>'credits')::integer=120-i*145,'All eight levers spend once, even in debt';
 assert (a->'history'->(i-1)->'scoring'->'penalties'->>'overload')::integer>0,'Excess effort reduces the score';
 assert (a->'metrics'->>'total')::integer between 0 and 100;
 b:=public.tension_api('decide','QA-NEXUS',key,data);assert b->>'credits'=a->>'credits','Idempotent retries';
 if i<4 then
 rejected:=false;begin perform public.tension_api('next','QA-NEXUS',key,data);exception when others then rejected:=true;end;assert rejected,'Host must release the next round';
 perform public.tension_facilitator('control','QA-FAC','QA-NEXUS',jsonb_build_object('round',i+1,'phase','deciding'));
 end if;
 a:=public.tension_api('next','QA-NEXUS',key,data);
 end loop;
 assert (a->>'finished')::boolean;
 assert (a->>'credits')::integer=-460;
 assert (a->'metrics'->>'penalty')::integer=50;
 b:=public.tension_api('leaderboard','QA-NEXUS');assert not(b->0 ? 'history') and not(b->0 ? 'room') and not(b->0 ? 'scores'),'Public ranking cannot reveal private decisions';
 rejected:=false;begin perform public.tension_facilitator('reset','OTHER-FAC','QA-NEXUS');exception when others then rejected:=true;end;assert rejected,'Only owner can reset';
 perform public.tension_facilitator('reset','QA-FAC','QA-NEXUS');
 assert jsonb_array_length(public.tension_api('leaderboard','QA-NEXUS'))=0;
 rejected:=false;begin perform public.tension_api('team','QA-NEXUS',key,jsonb_build_object('id',t));exception when others then rejected:=true;end;assert rejected,'Archived teams cannot resume after reset';
 assert (select count(*) from tension_private.teams where room_code='QA-NEXUS' and removed)=1,'Reset archives history';
 a:=public.tension_api('join','QA-NEXUS',key,'{"name":"Equipo QA"}');assert a->>'id'<>t;
 data:=data||jsonb_build_object('id',a->>'id','round',1);
 perform public.tension_facilitator('control','QA-FAC','QA-NEXUS','{"round":1,"phase":"deciding"}');
 rejected:=false;begin perform public.tension_api('decide','QA-NEXUS',key,data);exception when others then rejected:=true;end;assert rejected,'Stale epoch blocked';
 data:=data||'{"epoch":1}'::jsonb;
 rejected:=false;begin perform public.tension_api('decide','QA-NEXUS',key,data-'attention');exception when others then rejected:=true;end;assert rejected,'Diagnosis cannot be omitted';
 rejected:=false;begin perform public.tension_api('decide','QA-NEXUS',key,jsonb_set(data,'{attention,Structure}','49'));exception when others then rejected:=true;end;assert rejected,'Attention must sum to 100';
 rejected:=false;begin perform public.tension_api('decide','QA-NEXUS',key,jsonb_set(data,'{target}','null'));exception when others then rejected:=true;end;assert rejected,'Target required';
 -- Pausing accumulates time, opening retains it and excludes discussion.
 update tension_private.teams set decision_started=now()-interval '60 seconds',decision_elapsed=10 where id=(a->>'id')::uuid;
 perform public.tension_facilitator('control','QA-FAC','QA-NEXUS','{"round":1,"phase":"discussion"}');
 assert (select decision_started is null and decision_elapsed>=70 from tension_private.teams where id=(a->>'id')::uuid);
 perform public.tension_facilitator('control','QA-FAC','QA-NEXUS','{"round":1,"phase":"deciding"}');
 a:=public.tension_api('decide','QA-NEXUS',key,data);
 assert (a->'history'->0->'scoring'->>'elapsedSeconds')::integer>=70;
 assert not has_table_privilege('anon','tension_private.teams','select');
 assert not has_function_privilege('anon','public.tension_facilitator(text,text,text,jsonb)','execute');
 assert not has_function_privilege('anon','tension_private.score_decision(integer,jsonb,jsonb,jsonb,jsonb,numeric)','execute');
 raise notice 'PASS: eight levers, debt, scoring, guided control, time, reset and isolation';
end; $$;
