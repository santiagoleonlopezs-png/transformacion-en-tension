import test from 'node:test';
import assert from 'node:assert/strict';
import {initialScores,metrics,roomLink,decisionsCsv,levers,rounds,episodes,creditPlan,roundDebrief} from '../game.mjs';

test('debt permits negative balances and subtracts a bounded penalty',()=>{
 const noBudget=metrics(initialScores,0),debt=metrics(initialScores,-30);
 assert.equal(debt.debt,30);assert.equal(debt.penalty,12);assert.equal(debt.total,Math.max(0,noBudget.total-12));
 assert.equal(metrics(initialScores,-200).penalty,50);
 assert.ok(metrics(initialScores,-200).total>=0);
 assert.equal(metrics(initialScores,120).penalty,0);
});
test('a full experience still has the original four rounds and eight levers',()=>{
 assert.equal(rounds.length,4);assert.equal(levers.length,8);
 assert.equal(levers.reduce((m,l)=>Math.max(m,l.cost),0),25);
 for(const r of rounds)for(const l of levers)assert.equal(typeof r.relevance[l.id],'number');
});
test('public invitations contain only a room code and preserve deployment paths',()=>{
 assert.equal(roomLink('CAMBIO01','https://example.com/transformacion-en-tension/?private=secret#host=key'),'https://example.com/transformacion-en-tension/?sala=CAMBIO01');
 assert.equal(new URL(roomLink('CAMBIO01','https://example.com/experiencia/')).pathname,'/experiencia/');
});
test('decision exports retain all rounds, no-decision teams, timestamps, and Excel-safe text',()=>{
 const h={round:3,title:'Fatiga',levers:['Liderazgo'],reason:'=HYPERLINK("unsafe")\nUn motivo',outcome:'parcial',cost:20,creditsLeft:-25,debt:25,penalty:10,agile:60,coherence:64,total:46,timedOut:false,at:'2026-11-10T00:00:00Z'};
 const csv=decisionsCsv({title:'Sala; uno'},[{name:'Equipo "A"',history:[h,{...h,round:4}]},{name:'Sin decisiones',history:[]}]);
 assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/'=HYPERLINK/);assert.match(csv,/"Equipo ""A"""/);
 assert.match(csv,/"3";"Fatiga"/);assert.match(csv,/"4";"Fatiga"/);assert.match(csv,/"25";"10"/);
 assert.match(csv,/2026-11-10T00:00:00Z/);assert.match(csv,/Sin decisiones registradas/);
});

test('financing only adds the shortfall and grows accumulated debt',()=>{
 assert.deepEqual(creditPlan(50,['architecture','process','leadership']),{cost:70,after:-20,debt:20,loan:20,penalty:8,extraPenalty:8});
 assert.equal(creditPlan(-20,['leadership']).loan,20);
 assert.equal(creditPlan(-20,[]).loan,0);
 assert.equal(creditPlan(-120,['leadership']).penalty,50);
 assert.equal(creditPlan(120,['leadership']).loan,0);
});
test('four distinct narrative episodes and feedback tied to actual levers',()=>{
 assert.equal(episodes.length,rounds.length);
 assert.equal(new Set(episodes.map(e=>e.headline)).size,4);
 const d=roundDebrief({round:1,outcome:'alineada',leverIds:['architecture','workspace'],scoresBefore:{Structure:2},scoresAfter:{Structure:4}});
 assert.match(d.actions[0].text,/directamente/);assert.match(d.actions[1].text,/fricción/);assert.equal(d.changes[0].delta,2);assert.equal(d.talk.length,2);
});
