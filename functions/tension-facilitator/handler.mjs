import {AccessError,verifyFacilitator} from './auth.mjs';
const actions=new Set(['list','create','host','status','claim']);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
export async function handleRequest(request,{databaseUrl,serviceKey,verify=verifyFacilitator,fetcher=fetch}={}){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return response({message:'Método no permitido.'},405);
  try{
    const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization')||'');
    if(!match)throw new AccessError('Inicia sesión como facilitador.');
    const user=await verify(match[1]);
    if(!databaseUrl||!serviceKey)throw new AccessError('El servicio de salas no está disponible.',503);
    const text=await request.text();
    if(new TextEncoder().encode(text).length>8192)throw new AccessError('Solicitud demasiado grande.',400);
    let body;try{body=JSON.parse(text);}catch{throw new AccessError('Solicitud inválida.',400);}
    if(!body||!actions.has(body.action))throw new AccessError('Acción no permitida.',400);
    const data=body.data??{};
    if(typeof data!=='object'||Array.isArray(data)||data===null)throw new AccessError('Solicitud inválida.',400);
    const result=await fetcher(`${databaseUrl}/rest/v1/rpc/tension_facilitator`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:body.action,p_code:body.code??null,p_uid:user.uid,p_data:data}),signal:AbortSignal.timeout(10000)});
    const payload=await result.json();
    if(!result.ok)throw new AccessError(payload.message||'No fue posible abrir la sala.',payload.code==='42501'?403:400);
    return response(payload);
  }catch(error){
    return response({message:error instanceof AccessError?error.message:'No fue posible conectar con las salas. Inténtalo de nuevo.'},error instanceof AccessError?error.status:503);
  }
}
