import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { json, readJson, HttpError, publicError } from "@/lib/supabase/http";
import { databaseError } from "@/lib/data/api-contract";
import { liveData } from "@/lib/data/mode";
const queue = z.enum(['reviews','companies','verifications','posts','comments','proofs','reports','claims','replies','audit']);
const action = z.object({action:z.enum(['review','company','verification','post','comment','proof','report','claim','reply','ban','merge','refresh_rates']),target_id:z.uuid().optional(),decision:z.string().max(30).optional(),reason:z.string().trim().min(5).max(1000),merge_into_id:z.uuid().optional()}).strict();
async function run(fn:string,args:Record<string,unknown>) {
  if(!liveData) throw new HttpError('Moderation is not connected in demo mode.',503);
  const client=await serverSupabase();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) throw new HttpError('Sign in with a moderator account.',401);
  // Authorization is repeated inside each database RPC, including direct API calls.
  const result=await client.rpc(fn,args);
  if(result.error){const e=databaseError(result.error.code);return json({error:e.error},e.status);}
  return json({data:result.data});
}
export async function GET(request:Request) {
  try {const parsed=queue.safeParse(new URL(request.url).searchParams.get('queue')||'reviews');if(!parsed.success) throw new HttpError('Unknown queue.');return await run('kollab_admin_queue',{queue:parsed.data});}
  catch(e){return publicError(e);}
}
export async function POST(request:Request) {
  try {const parsed=action.safeParse(await readJson(request));if(!parsed.success) throw new HttpError('Check the action, target and audit reason.');return await run('kollab_admin_action',{input:parsed.data});}
  catch(e){return publicError(e);}
}
