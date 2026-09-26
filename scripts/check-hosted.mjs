// Read-only checks against the real public API. Never sends email or creates users.
import assert from 'node:assert/strict';
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_PUBLISHABLE_KEY;
assert.ok(origin&&key?.startsWith('sb_publishable_'),'Project URL and publishable key required.');
const headers={apikey:key,'Content-Type':'application/json'};
async function rpc(name,body={}){
  const response=await fetch(`${origin}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
const brands=await rpc('kollab_search_brands');
assert.equal(brands.status,200);assert.ok(brands.data.length>=40);
assert.ok(brands.data.every(b=>!('created_by' in b)&&!('claimed_by_user_id' in b)));
const search=await rpc('kollab_search_brands',{query:'Mama Earth'});
assert.equal(search.status,200);assert.ok(search.data.some(b=>b.name==='Mamaearth'));
assert.deepEqual(await rpc('kollab_session'),{status:200,data:null});
for(const name of ['kollab_list_reviews','kollab_list_posts','kollab_watchlist','kollab_notifications']){
  const result=await rpc(name);assert.equal(result.status,200);assert.ok(Array.isArray(result.data));
}
for(const [name,body] of [['kollab_admin_queue',{}],['kollab_expired_proofs',{}],['kollab_create_brand',{input:{}}],['kollab_proof_access',{proof:'00000000-0000-4000-8000-000000000001'}]]){
  const result=await rpc(name,body);assert.ok([401,403,404].includes(result.status),`${name} must reject guests`);
}
const privateTables=await fetch(`${origin}/rest/v1/profiles?select=user_id`,{headers:{...headers,'Accept-Profile':'private'}});
assert.ok([401,403,406].includes(privateTables.status),'Private schema must not be exposed');
const settings=await fetch(`${origin}/auth/v1/settings`,{headers});
assert.equal(settings.status,200);const auth=await settings.json();
console.log(JSON.stringify({checks:'passed',directoryCount:brands.data.length,privateSchemaBlocked:true,guestWritesBlocked:true,emailProvider:auth.external?.email,emailConfirmationRequired:auth.mailer_autoconfirm===false,anonymousAuth:auth.external?.anonymous_users,signupsDisabled:auth.disable_signup}));
