import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import {verifyFacilitator,AccessError,FIREBASE_PROJECT} from '../functions/tension-facilitator/auth.mjs';
import {handleRequest} from '../functions/tension-facilitator/handler.mjs';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk={...await exportJWK(publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const resolver=createLocalJWKSet({keys:[jwk]});
const now=Math.floor(Date.now()/1000);
const claims={sub:'facilitator-A',email:'test@example.test',facilitator:true,auth_time:now-30,iat:now-20,exp:now+3600,iss:`https://securetoken.google.com/${FIREBASE_PROJECT}`,aud:FIREBASE_PROJECT,firebase:{sign_in_provider:'password'}};
const sign=payload=>new SignJWT(payload).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(privateKey);

test('signed Firebase facilitator tokens grant only their verified identity',async()=>{
 assert.deepEqual(await verifyFacilitator(await sign(claims),resolver),{uid:'facilitator-A',email:'test@example.test'});
});
test('verification rejects forgery, foreign projects, expired sessions and missing permissions',async()=>{
 for(const overrides of [{aud:'another-project'},{iss:'https://securetoken.google.com/other'},{exp:now-1},{iat:now+300},{auth_time:now+300},{sub:''},{facilitator:false},{facilitator:'true'},{firebase:{sign_in_provider:'anonymous'}}]){
  await assert.rejects(()=>sign({...claims,...overrides}).then(token=>verifyFacilitator(token,resolver)),AccessError);
 }
 const token=await sign({...claims,facilitator:false}),parts=token.split('.');
 parts[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');
 await assert.rejects(()=>verifyFacilitator(parts.join('.'),resolver),{status:401});
 await assert.rejects(()=>verifyFacilitator('malformed',resolver),{status:401});
 const missing={...claims};delete missing.auth_time;
 await assert.rejects(()=>sign(missing).then(token=>verifyFacilitator(token,resolver)),{status:401});
});
test('endpoint rejects unauthenticated clients before accessing the database',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('Must never query the database');};
 const request=new Request('https://example.test',{method:'POST',body:'{"action":"create"}'});
 assert.equal((await handleRequest(request,{fetcher})).status,401);assert.equal(calls,0);
 const invalid=new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer malformed'},body:'{"action":"host"}'});
 assert.equal((await handleRequest(invalid,{fetcher})).status,401);assert.equal(calls,0);
});
test('endpoint ignores client-supplied owner identity and never exposes the server credential',async()=>{
 const token=await sign(claims);let rpc;
 const response=await handleRequest(new Request('https://example.test',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({action:'create',code:'QA-AUTH',uid:'victim',p_uid:'victim',data:{title:'Sala'}})}),{
  databaseUrl:'https://database.test',serviceKey:'test-server-only',verify:t=>verifyFacilitator(t,resolver),
  fetcher:async(url,options)=>{rpc=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer test-server-only');return Response.json({code:'QA-AUTH'});}
 });
 assert.equal(response.status,200);assert.equal(rpc.p_uid,'facilitator-A');assert.equal(rpc.p_action,'create');
 assert.ok(!(await response.text()).includes('test-server-only'));
});
