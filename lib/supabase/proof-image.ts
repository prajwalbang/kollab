import sharp from 'sharp';
export async function safeProofImage(bytes:Buffer) {
  if(bytes.length===0||bytes.length>4*1024*1024) throw new Error('Choose an image under 4 MB.');
  const image=sharp(bytes,{limitInputPixels:20_000_000,failOn:'warning'});
  const meta=await image.metadata();
  if(!['jpeg','png','webp'].includes(meta.format||'')||(meta.pages||1)!==1) throw new Error('Choose a static JPEG, PNG or WebP image.');
  // Decode and re-encode: discard original metadata, filename and embedded payloads.
  const clean=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
  if(clean.length>4*1024*1024) throw new Error('Image is too large.');
  return clean;
}
