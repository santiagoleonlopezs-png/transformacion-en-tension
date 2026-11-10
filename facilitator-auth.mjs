let auth=null,restored=null;
function init(){
  if(auth)return auth;
  if(!window.firebase||!window.FIREBASE_CONFIG)throw Error('No se pudo cargar el acceso del facilitador. Actualiza la página e inténtalo de nuevo.');
  const app=window.firebase.apps.find(x=>x.name==='tension-facilitator')||window.firebase.initializeApp(window.FIREBASE_CONFIG,'tension-facilitator');
  auth=window.firebase.auth(app);
  restored=new Promise((resolve,reject)=>{let unsubscribe;unsubscribe=auth.onAuthStateChanged(()=>{unsubscribe();resolve();},reject);});
  return auth;
}
export function authError(error){
  if(/invalid-credential|wrong-password|user-not-found|invalid-email/.test(error?.code||''))return 'Correo o contraseña incorrectos.';
  if(/too-many-requests/.test(error?.code||''))return 'Hubo varios intentos de ingreso. Espera un momento y vuelve a intentarlo.';
  if(/network-request-failed/.test(error?.code||''))return 'No fue posible conectar con el acceso del facilitador. Revisa tu conexión.';
  return error?.message||'No fue posible iniciar sesión.';
}
async function facilitator(user,refresh=false){
  if(!user||user.isAnonymous)return null;
  const token=await user.getIdTokenResult(refresh);
  if(token.claims.facilitator!==true)throw Error('Tu cuenta no tiene permiso de facilitador en el Laboratorio.');
  return {uid:user.uid,email:user.email||''};
}
export async function restore(){init();await restored;return facilitator(auth.currentUser,true);}
export async function signIn(email,password){
  init();await restored;await auth.setPersistence(window.firebase.auth.Auth.Persistence.SESSION);
  const credential=await auth.signInWithEmailAndPassword(email,password);
  try{return await facilitator(credential.user,true);}catch(error){await auth.signOut();throw error;}
}
export async function getToken(uid){
  init();await restored;const user=auth.currentUser;
  if(!user||user.uid!==uid||user.isAnonymous)throw Error('Inicia sesión como facilitador.');
  const token=await user.getIdTokenResult();
  if(token.claims.facilitator!==true)throw Error('Tu cuenta no tiene permiso de facilitador en el Laboratorio.');
  return token.token;
}
export async function signOut(){init();await auth.signOut();}
export function observe(callback){return init().onAuthStateChanged(callback);}
