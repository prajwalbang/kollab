// Directory metadata only. Never reads creator research files or review fixtures.
import fs from 'node:fs';
const companies=JSON.parse(fs.readFileSync(new URL('../data/brands.json',import.meta.url),'utf8')).filter(b=>!b.demo);
const quote=value=>value==null?'null':"'"+String(value).replaceAll("'","''")+"'";
console.log('-- Optional starter directory. Verify handles before applying. No creator identities or reviews.\nbegin;');
for(const b of companies) {
  const slug=b.slug.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  console.log(`insert into private.companies(name,slug,instagram_handle,category,entity_type,website,status) values(${[b.name,slug,b.instagram_handle,b.category,b.entity_type,b.website,'active'].map(quote).join(',')}) on conflict do nothing;`);
}
console.log('commit;');
