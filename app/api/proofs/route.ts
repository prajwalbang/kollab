import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase/server';
import { requireSameOrigin, HttpError, json, publicError } from '@/lib/supabase/http';
import { safeProofImage } from '@/lib/supabase/proof-image';
import { liveData } from '@/lib/data/mode';
export const runtime='nodejs';
async function clientForUser() {
  if(!liveData) throw new HttpError('Evidence uploads are not open in the demo.',503);
  const client=await serverSupabase();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) throw new HttpError('Sign in to continue.',401);
  return client;
}
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);
    const client=await clientForUser();
    const reader=request.body?.getReader();
    if(!reader) throw new HttpError('Image required.');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4.25*1024*1024){await reader.cancel();throw new HttpError('Choose an image under 4 MB.',413);}chunks.push(value);}
    const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
    const review=z.uuid().safeParse(form.get('review_id'));
    const file=form.get('file');
    if(!review.success||!(file instanceof File)) throw new HttpError('Review and image required.');
    let image:Buffer;
    try{image=await safeProofImage(Buffer.from(await file.arrayBuffer()));}catch{throw new HttpError('Choose a static JPEG, PNG or WebP under 4 MB and 20 megapixels.');}
    const {data:proof,error}=await client.rpc('kollab_proof_reserve',{input:{review_id:review.data,proof_type:'dm_screenshot',mime_type:'image/jpeg',byte_size:image.length}});
    if(error||!proof) throw new HttpError('Proof could not be reserved. Check ownership and upload limits.',403);
    const upload=await client.storage.from(proof.bucket).upload(proof.path,image,{contentType:'image/jpeg',upsert:false});
    if(upload.error) throw new HttpError('Upload failed. Please retry later.',503);
    const finalized=await client.rpc('kollab_proof_finalize',{proof:proof.id});
    if(finalized.error) throw new HttpError('Image uploaded but confirmation failed. Contact support before retrying.',503);
    return json({ok:true});
  }catch(e){return publicError(e);}
}
export async function GET(request:Request) {
  try {
    const proof=z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
    if(!proof.success) throw new HttpError('Invalid evidence reference.');
    const client=await clientForUser();
    const {data,error}=await client.rpc('kollab_proof_access',{proof:proof.data});
    if(error||!data) throw new HttpError('Evidence unavailable or access denied.',403);
    const download=await client.storage.from(data.bucket).download(data.path);
    if(download.error||!download.data) throw new HttpError('Evidence unavailable.',404);
    // Re-sanitize even direct Storage API uploads before displaying to a moderator.
    const clean=await safeProofImage(Buffer.from(await download.data.arrayBuffer()));
    return new Response(new Uint8Array(clean),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline; filename="evidence.jpg"','Referrer-Policy':'no-referrer'}});
  }catch(e){return publicError(e);}
}
