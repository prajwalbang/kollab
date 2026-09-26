// Run in a trusted operator environment. Defaults to dry run. Never log paths or keys.
import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_MAINTENANCE_KEY;
if(!url||!key?.startsWith('sb_secret_')) throw new Error('Provide the project URL and a server secret in the operator environment.');
if(new URL(url).protocol!=='https:') throw new Error('HTTPS required.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const apply=process.argv.includes('--apply');
let count=0;
for(let batch=0;batch<100;batch++){
  const {data,error}=await client.rpc('kollab_expired_proofs');
  if(error)throw new Error('Unable to read retention queue.');
  if(!data.length)break;
  if(!apply){console.log(`Dry run: ${data.length} expired evidence objects in the next batch. Use --apply to delete.`);break;}
  const removed=await client.storage.from('review-proofs').remove(data.map(row=>row.path));
  if(removed.error)throw new Error('Storage deletion failed; metadata was not marked deleted.');
  const marked=await client.rpc('kollab_expired_proofs_deleted',{proof_ids:data.map(row=>row.id)});
  if(marked.error)throw new Error('Objects deleted but metadata update failed. Re-run to reconcile.');
  count+=data.length;
}
if(apply)console.log(`Deleted ${count} expired evidence objects.`);
