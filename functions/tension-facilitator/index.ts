import {handleRequest} from './handler.mjs';
Deno.serve((request: Request)=>handleRequest(request,{
  databaseUrl:Deno.env.get('SUPABASE_URL'),
  serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}));
