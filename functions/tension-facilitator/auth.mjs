import {createRemoteJWKSet,jwtVerify} from 'jose';

export const FIREBASE_PROJECT='simuladores-juegos';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),{cacheMaxAge:600000,cooldownDuration:30000,timeoutDuration:5000});
export class AccessError extends Error{constructor(message,status=401){super(message);this.status=status;}}
export async function verifyFacilitator(token,resolver=keys){
  if(typeof token!=='string'||token.length>8192)throw new AccessError('Inicia sesión como facilitador.');
  let payload;
  try{({payload}=await jwtVerify(token,resolver,{issuer:`https://securetoken.google.com/${FIREBASE_PROJECT}`,audience:FIREBASE_PROJECT,algorithms:['RS256'],requiredClaims:['exp','iat','sub','auth_time'],clockTolerance:0}));}
  catch(error){
    if(error?.code==='ERR_JWKS_TIMEOUT'||error instanceof TypeError)throw new AccessError('No fue posible validar la sesión. Inténtalo de nuevo.',503);
    throw new AccessError('Tu sesión no es válida o ha vencido. Vuelve a iniciar sesión.');
  }
  const now=Math.floor(Date.now()/1000);
  if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128||!Number.isInteger(payload.iat)||payload.iat>now+30||!Number.isInteger(payload.auth_time)||payload.auth_time>now+30)throw new AccessError('La sesión no es válida.');
  if(payload.facilitator!==true||payload.firebase?.sign_in_provider==='anonymous')throw new AccessError('Tu cuenta no tiene permiso de facilitador en el Laboratorio.',403);
  return {uid:payload.sub,email:typeof payload.email==='string'?payload.email:''};
}
