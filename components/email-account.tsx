"use client";
import { useEffect, useState, type FormEvent } from "react";
import { dataRequest } from "@/lib/data/http-repo";
import { followerBands, type Session } from "@/lib/data/types";
import { Captcha } from "./captcha";
type Challenge = { id: string; handle: string; code: string; status: string; expires_at: string };
export function EmailAccount() {
  const [email,setEmail] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [available,setAvailable] = useState(false);
  const [profile,setProfile] = useState<Session|null>(null);
  const [challenge,setChallenge] = useState<Challenge|null>(null);
  const [handle,setHandle] = useState("");
  const [captchaToken,setCaptchaToken] = useState("");
  const [captchaVersion,setCaptchaVersion] = useState(0);
  useEffect(() => {
    let active=true;
    if (new URLSearchParams(location.search).has("error")) setMessage("That link expired or was opened in another browser. Request a new link here.");
    (async()=>{
      const response=await fetch('/api/session/',{cache:'no-store'});
      if(!response.ok) throw new Error('Account service is not configured yet.');
      const session=await response.json();
      if(!active) return;
      setAvailable(session.available);
      if(!session.available) setMessage('Sign-in is not open yet. You can still explore the demo.');
      if(session.signedIn) {
        const [p,c]=await Promise.all([dataRequest<Session>('getSession'),dataRequest<Challenge|null>('verificationStatus')]);
        if(active){setProfile(p);setHandle(p.handle||'');setChallenge(c);}
      }
    })().catch(e=>active&&setMessage(e.message));
    return ()=>{active=false;};
  },[]);
  async function task(work:()=>Promise<void>) {
    setBusy(true);setMessage('');
    try { await work(); } catch(e) {setMessage(e instanceof Error?e.message:'Please try again.');} finally {setBusy(false);}
  }
  async function auth(event:FormEvent) {
    event.preventDefault();
    await task(async()=>{
      const response=await fetch('/api/auth/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile?{action:'signout'}:{action:'signin',email,captchaToken:captchaToken||undefined})});
      const result=await response.json();
      setCaptchaToken('');setCaptchaVersion(v=>v+1);
      if(!response.ok) throw new Error(result.error);
      if(profile){setProfile(null);setChallenge(null);setMessage('Signed out.');window.dispatchEvent(new Event('kollab-change'));}
      else setMessage('Check your inbox. Open the sign-in link in this same browser.');
    });
  }
  return <div className="account-forms">
    <h1>{profile?'Your account':'Sign in to Kollab'}</h1>
    <p>{profile?'Your email and verification records stay private. You choose whether each post shows your Instagram username.':'We’ll email you a sign-in link. No password needed.'}</p>
    {!profile && <form onSubmit={auth}>
      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /></label>
      {available && <Captcha key={captchaVersion} onToken={setCaptchaToken} />}
      <button className="primary-button full" disabled={busy||!available|| (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&!captchaToken)}>Send sign-in link</button>
    </form>}
    {profile && <>
      <form onSubmit={e=>{e.preventDefault();void task(async()=>{setProfile(await dataRequest<Session>('updateProfile',{alias:profile.alias,follower_band:profile.follower_band,category:profile.category,city:profile.city},true));setMessage('Profile saved.');});}}>
        <h2>Creator profile</h2>
        <label>Private display name<input required minLength={2} maxLength={40} value={profile.alias} onChange={e=>setProfile({...profile,alias:e.target.value})}/></label>
        <label>Follower range<select value={profile.follower_band} onChange={e=>setProfile({...profile,follower_band:e.target.value as Session['follower_band']})}>{followerBands.map(b=><option key={b} value={b}>{b.replaceAll('_','–')}</option>)}</select></label>
        <label>Category<select value={profile.category} onChange={e=>setProfile({...profile,category:e.target.value})}>{['Beauty','Fashion','Tech','Food & drink','Lifestyle','Fitness','Agency','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
        <label>City (private, optional)<input maxLength={80} value={profile.city||''} onChange={e=>setProfile({...profile,city:e.target.value||null})}/></label>
        <button className="primary-button" disabled={busy}>Save profile</button>
      </form>
      <section><h2>Instagram verification</h2>
        <p>{profile.verified?`Verified as @${profile.handle}.`:'Verify ownership before submitting reviews or room posts. A moderator checks a temporary code in your Instagram bio.'}</p>
        <form onSubmit={e=>{e.preventDefault();void task(async()=>{setChallenge(await dataRequest<Challenge>('verificationStart',{handle},true));setMessage('Add the code to your Instagram bio, then submit for review.');});}}>
          <label>Instagram username<input required pattern="@?[A-Za-z0-9._]{1,30}" maxLength={31} value={handle} onChange={e=>setHandle(e.target.value)} /></label>
          <button className="outline-button" disabled={busy}>Generate a new bio code</button>
        </form>
        {challenge&&<div className="verification-code"><p>Status: <strong>{challenge.status}</strong> · @{challenge.handle}</p>
          {['pending','submitted'].includes(challenge.status)&&<><code>{challenge.code}</code><p>Keep this code in your bio until reviewed. Expires {new Date(challenge.expires_at).toLocaleString()}.</p></>}
          {challenge.status==='pending'&&<button className="primary-button" disabled={busy} onClick={()=>void task(async()=>{setChallenge(await dataRequest<Challenge>('verificationSubmit',{challenge_id:challenge.id},true));setMessage('Submitted. A moderator will check your bio.');})}>I added the code — request verification</button>}
        </div>}
      </section>
      <p>Anonymous posts hide your handle from other visitors. Details in your story may still identify you; remove identifying information before posting.</p>
      <a href="/represent/">Represent a company</a>
      {['admin','moderator'].includes(profile.role||'')&&<a href="/admin/">Open moderation</a>}
      <form onSubmit={auth}><button className="outline-button" disabled={busy}>Sign out</button></form>
    </>}
    {message&&<p role="status" aria-live="polite">{message}</p>}
  </div>;
}
