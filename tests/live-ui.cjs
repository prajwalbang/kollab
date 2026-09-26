// Browser contracts with mocked responses; these are not hosted integration tests.
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const user={id:'00000000-0000-4000-8000-000000000001',alias:'Quiet Creator',follower_band:'10k_25k',category:'Beauty',city:null,handle:'',verified:false,contributions:0};
    const challenge={id:'00000000-0000-4000-8000-000000000002',handle:'test.creator',code:'KOLLAB-TEST123',status:'pending',expires_at:'2030-01-01T00:00:00Z'};
    const writes=[];
    await page.route('**/api/session/',r=>r.fulfill({json:{signedIn:true,available:true,instagramVerified:false}}));
    await page.route('**/api/data/**',r=>{
      const req=r.request();const action=req.method()==='POST'?req.postDataJSON().action:new URL(req.url()).searchParams.get('action');
      if(req.method()==='POST') writes.push(req.postDataJSON());
      const data=action==='getSession'||action==='updateProfile'?user:action==='verificationStart'?challenge:action==='verificationSubmit'?{...challenge,status:'submitted'}:null;
      return r.fulfill({json:{data}});
    });
    await page.goto('http://127.0.0.1:3000/account/');
    await page.getByRole('heading',{name:'Your account',exact:true}).waitFor();
    await page.getByLabel('Instagram username').fill('test.creator');
    await page.getByRole('button',{name:'Generate a new bio code'}).click();
    await page.getByText('KOLLAB-TEST123',{exact:true}).waitFor();
    await page.getByRole('button',{name:/I added the code/}).click();
    await page.getByText('submitted',{exact:true}).waitFor();
    assert.equal(writes[1].input.challenge_id,challenge.id);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'/private/tmp/kollab-account-mobile.png',fullPage:true});
    await page.route('**/api/admin/**',r=>r.request().method()==='POST'?r.fulfill({json:{data:{ok:true}}}):r.fulfill({json:{data:[{id:challenge.id,kind:'verification',title:'@test.creator',body:challenge.code,status:'submitted',handle:challenge.handle,expires_at:challenge.expires_at}]}}));
    await page.goto('http://127.0.0.1:3000/admin/');
    await page.getByRole('heading',{name:'@test.creator'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'approved',exact:true}).isDisabled(),true);
    await page.getByLabel('Decision reason').fill('Checked matching bio code manually');
    assert.equal(await page.getByRole('button',{name:'approved',exact:true}).isEnabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'/private/tmp/kollab-moderation-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS account bio verification and moderator UI contracts at 390px');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
