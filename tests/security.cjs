const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const sharp=require('sharp');
function load(file){
  const mod={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',source)(id=>id==='server-only'?{}:id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),mod,mod.exports);
  return mod.exports;
}
const {parseDataRequest,databaseError}=load(path.resolve('lib/data/api-contract.ts'));
const {readJson,requireSameOrigin}=load(path.resolve('lib/supabase/http.ts'));
test('API allowlists reject role escalation, malformed IDs and unexpected actions',()=>{
  for(const action of ['constructor','__proto__','admin','kollab_admin_action']) assert.throws(()=>parseDataRequest(action,{},true));
  assert.throws(()=>parseDataRequest('toggleWatchlist',{brandId:"x');drop table users;--"},true));
  assert.throws(()=>parseDataRequest('updateProfile',{alias:'Test',follower_band:'10k_25k',category:'Beauty',city:null,verified:true},true));
  assert.throws(()=>parseDataRequest('listReviews',{filters:{user_id:'someone'}},false));
  assert.throws(()=>parseDataRequest('createBrand',{name:'Brand',instagram_handle:'brand',category:'Beauty',website:'javascript:alert(1)',entity_type:'brand'},true));
  assert.equal(parseDataRequest('createPost',{category:'Beauty',body:'A useful community question'},true).identity_mode,'anonymous');
  assert.equal(databaseError('42501').status,403);
});
test('CSRF checks canonical origin and streaming body limits',async()=>{
  process.env.APP_ORIGIN='https://kollab.example';
  const req=(body='{}',headers={})=>new Request('https://kollab.example/api/data/',{method:'POST',headers:{origin:'https://kollab.example','content-type':'application/json',...headers},body});
  assert.throws(()=>requireSameOrigin(req('{}',{origin:'https://evil.example'})));
  assert.throws(()=>requireSameOrigin(req('{}',{'sec-fetch-site':'cross-site'})));
  assert.deepEqual(await readJson(req()),{});
  await assert.rejects(()=>readJson(req('x'.repeat(33)),32),e=>e.status===413);
  await assert.rejects(()=>readJson(req('{}',{'content-type':'text/plain'})),e=>e.status===415);
  await assert.rejects(()=>readJson(req('{')),e=>e.status===400);
});
test('proof processing rejects active content and removes metadata',async()=>{
  const {safeProofImage}=load(path.resolve('lib/supabase/proof-image.ts'));
  await assert.rejects(()=>safeProofImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')));
  await assert.rejects(()=>safeProofImage(Buffer.from('<html>not an image</html>')));
  await assert.rejects(()=>safeProofImage(Buffer.alloc(4*1024*1024+1)));
  const source=await sharp({create:{width:32,height:32,channels:3,background:'#fff'}}).withMetadata({orientation:6}).png().toBuffer();
  const result=await safeProofImage(source);const meta=await sharp(result).metadata();
  assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.equal(meta.orientation,undefined);
});
