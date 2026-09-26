"use client";
import { useEffect,useState } from 'react';
type Item={id:string;kind:string;title:string;body:string|null;status:string;handle?:string;target_id?:string;target_type?:string;content?:string;review?:Record<string,unknown>;expires_at?:string};
const queues=['reviews','companies','verifications','posts','comments','proofs','reports','claims','replies','audit'];
const decisions:Record<string,string[]>={review:['published','removed'],company:['active','hidden'],verification:['approved','rejected'],post:['published','removed'],comment:['published','removed'],proof:['verified','rejected'],report:['resolved','dismissed'],claim:['approved','rejected','revoked'],reply:['published','removed']};
async function admin(queue:string, input?:unknown) {
  const r=await fetch(`/api/admin/?queue=${queue}`,{cache:'no-store',...(input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})});
  const result=await r.json();if(!r.ok)throw new Error(result.error);return result.data;
}
export function Moderation() {
  const [queue,setQueue]=useState('reviews'),[items,setItems]=useState<Item[]>([]),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
  useEffect(()=>{let active=true;setItems([]);setLoading(true);setMessage('');admin(queue).then(v=>active&&setItems(v)).catch(e=>active&&setMessage(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[queue,version]);
  return <div className="account-forms"><h1>Moderation</h1><p>Access requires an assigned moderator role. Decisions are audited. Verify claims and context before publishing; authors cannot approve their own submissions.</p>
    <a href="/account/">Account / sign in</a>
    <label>Queue<select value={queue} onChange={e=>setQueue(e.target.value)}>{queues.map(q=><option key={q}>{q}</option>)}</select></label>
    <button className="outline-button" onClick={()=>setVersion(v=>v+1)}>Refresh queue</button>
    {message&&<p role="alert">{message}</p>}{loading?<p role="status">Loading…</p>:!message&&!items.length?<p>No items in this queue.</p>:null}
    {items.map(item=><ModerationItem key={item.id} item={item} onDone={()=>setVersion(v=>v+1)}/>)}
    <details><summary>Administration</summary><p>Use exact IDs when removing reported content, merging companies or managing an account. Merges and bans require an admin role.</p><AdminAction onDone={()=>setVersion(v=>v+1)}/></details>
  </div>;
}
function ModerationItem({item,onDone}:{item:Item;onDone:()=>void}) {
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false);
  return <article className="review-card moderation-item"><h2>{item.title}</h2><p>{item.body}</p><small>{item.id} · {item.status}</small>
    {item.kind==='verification'&&item.handle&&<><p>Open the profile and confirm the exact code is present in the bio.</p><a href={`https://www.instagram.com/${encodeURIComponent(item.handle)}/`} target="_blank" rel="noreferrer">Check Instagram profile ↗</a><p>Expires: {item.expires_at}</p></>}
    {item.content&&<blockquote>{item.content}</blockquote>}
    {item.target_id&&<p>Target {item.target_type}: <code>{item.target_id}</code></p>}
    {item.review&&<details><summary>Collaboration details</summary><pre>{JSON.stringify(item.review,null,2)}</pre></details>}
    {item.kind==='proof'&&<><button className="outline-button" onClick={()=>setPreview(v=>!v)}>{preview?'Close evidence':'Open audited evidence preview'}</button>{preview&&<img src={`/api/proofs/?id=${item.id}`} alt="Private evidence; if unavailable, refresh the queue." style={{maxWidth:'100%'}}/>}</>}
    {decisions[item.kind]&&<><label>Decision reason<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={1000}/></label><div className="operation-actions">{decisions[item.kind].map(decision=><button className="outline-button" key={decision} disabled={busy||reason.trim().length<5} onClick={async()=>{setBusy(true);setError('');try{await admin('',{action:item.kind,target_id:item.id,decision,reason});onDone();}catch(e){setError(e instanceof Error?e.message:'Try again.');}finally{setBusy(false);}}}>{decision}</button>)}</div></>}
    {error&&<p role="alert">{error}</p>}
  </article>;
}
function AdminAction({onDone}:{onDone:()=>void}) {
  const [action,setAction]=useState('refresh_rates'),[target,setTarget]=useState(''),[destination,setDestination]=useState(''),[decision,setDecision]=useState('removed'),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  return <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await admin('',{action,target_id:target||undefined,merge_into_id:action==='merge'?destination:undefined,decision,reason});setMessage('Action recorded.');onDone();}catch(e){setMessage(e instanceof Error?e.message:'Try again.');}finally{setBusy(false);}}}>
    <label>Action<select value={action} onChange={e=>setAction(e.target.value)}>{['refresh_rates','review','post','comment','reply','company','claim','merge','ban'].map(a=><option key={a}>{a}</option>)}</select></label>
    {action!=='refresh_rates'&&<label>Target ID<input required value={target} onChange={e=>setTarget(e.target.value)}/></label>}
    {action==='merge'?<label>Destination company ID<input required value={destination} onChange={e=>setDestination(e.target.value)}/></label>:action!=='refresh_rates'&&<label>Decision<select value={decision} onChange={e=>setDecision(e.target.value)}>{['removed','published','active','hidden','revoked','banned'].map(d=><option key={d}>{d}</option>)}</select></label>}
    <label>Audit reason<textarea required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="primary-button" disabled={busy}>Apply audited action</button>{message&&<p role="status">{message}</p>}
  </form>;
}
