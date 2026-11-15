// Explicit opt-in: dedicated synthetic lab accounts only; never target the main site.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const base = process.env.POLYMATH_BROWSER_URL || 'http://127.0.0.1:8000';
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || base === 'https://polymathhub-lab.vercel.app', 'Only the isolated lab may be tested');
assert(process.env.POLYMATH_TEST_ACCOUNTS, 'Provide a private synthetic-account fixture file');
const [account] = JSON.parse(await fs.readFile(process.env.POLYMATH_TEST_ACCOUNTS, 'utf8'));
assert(account.email.includes('@example.invalid'), 'Use synthetic test accounts');
const bypass = process.env.POLYMATH_BYPASS_FILE ? (await fs.readFile(process.env.POLYMATH_BYPASS_FILE,'utf8')).trim() : '';
const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const page = await browser.newPage();
page.setDefaultTimeout(20000);
const checks = [];
async function ready(){await page.waitForFunction(()=>window.PolymathApp && document.querySelector('main h1') && !window.PolymathAccount?.loading);}
async function login(){
  await page.click('#account-control button');
  await page.type('#auth-form [name=email]',account.email);
  await page.type('#auth-form [name=password]',account.password);
  await page.click('#auth-form button[type=submit]');
  await page.waitForFunction(id=>window.PolymathAccount?.user?.id===id && !window.PolymathAccount.loading,{},account.userId);
}
async function saved(){await page.waitForFunction(()=>window.PolymathAccount.sync==='Progres salvat în cont.' && !window.PolymathAccount.saving && !window.PolymathAccount.dirty);}
async function solve(id,query){
  await page.evaluate(id=>{location.hash='#lectie?ex='+id+'&etapa=practica'},id);
  await page.waitForSelector('#sql-editor');
  await page.waitForFunction(id=>window.PolymathApp.snapshot().state.sqlPractice.activeExerciseId===id,{},id);
  await page.$eval('#sql-editor',(field,query)=>{field.value=query;field.dispatchEvent(new Event('input',{bubbles:true}));},query);
  await page.click('#run-sql');
  await page.waitForFunction(()=>document.querySelector('#sql-feedback')?.classList.contains('success'));
}
try {
  const navigation=await page.goto(base+(bypass?'/?_vercel_share='+encodeURIComponent(bypass):'/'),{waitUntil:'networkidle0'});
  await ready();
  await page.evaluate(()=>history.replaceState(null,'','/'));
  await login(); checks.push('UI login with a dedicated lab account');
  if(base.startsWith('https:')){
    const cookies=await page.browserContext().cookies();
    const session=cookies.filter(c=>c.name.startsWith('__Host-pm_'));
    assert(session.length>=2,'Session cookies missing');
    assert(session.every(c=>c.httpOnly&&c.secure&&c.sameSite==='Lax'&&c.path==='/'));
    assert(navigation.headers()['content-security-policy']?.includes("script-src 'self'"),'CSP missing');
    checks.push('Live CSP and HttpOnly Secure SameSite session cookies');
  }
  await solve('s1-all','SELECT * FROM customers;'); await saved();
  await page.evaluate(()=>{location.hash='#limba?etapa=practica'});
  await page.waitForSelector('#language-form');
  for(const [i,value] of ['acheter','combien','combien'].entries()) await page.$eval(`[name="answer-${i}"]`,(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.click('#language-form button[type=submit]');await saved();
  const expected=await page.evaluate(()=>window.PolymathApp.snapshot().state);
  assert(expected.sqlPractice.records['s1-all'].passed);assert(expected.languagePractice.completed);
  await page.reload({waitUntil:'networkidle0'});await ready();
  assert.equal(await page.evaluate(()=>window.PolymathApp.snapshot().state.xp),expected.xp);
  checks.push('SQL + French progress survives reload from Supabase');
  await page.click('#account-control button');await page.click('[data-logout-account]');
  await page.waitForFunction(()=>!window.PolymathAccount.user && !window.PolymathAccount.loading);
  await login();
  assert.equal(await page.evaluate(()=>window.PolymathApp.snapshot().state.xp),expected.xp);
  await solve('s1-all','SELECT * FROM customers;');await saved();
  assert.equal(await page.evaluate(()=>window.PolymathApp.snapshot().state.xp),expected.xp);
  checks.push('Logout/login restores progress; repeated SQL grants no extra XP');
  let block=true;
  await page.setRequestInterception(true);
  page.on('request',request=>{if(block&&request.method()==='PUT'&&new URL(request.url()).pathname==='/api/progress')request.abort('failed');else request.continue();});
  await solve('s1-columns','SELECT id, name FROM customers;');
  await page.waitForFunction(()=>window.PolymathAccount.dirty && !window.PolymathAccount.ready);
  block=false;await page.reload({waitUntil:'networkidle0'});await ready();await saved();
  assert(await page.evaluate(()=>window.PolymathApp.snapshot().state.sqlPractice.records['s1-columns'].passed));
  const cloud=await page.evaluate(async()=>{const r=await fetch('/api/progress');return {status:r.status,body:await r.json()};});
  assert.equal(cloud.status,200);
  assert(cloud.body.progress.course.sqlPractice.records['s1-columns'].passed);
  checks.push('Aborted progress save recovers after reload and is verified in cloud');
  const admin=await page.evaluate(async()=>{const r=await fetch('/api/admin-accounts');return {status:r.status,body:await r.json()};});
  assert(admin.status===403 || admin.body.allowed===false);
  checks.push('Ordinary account cannot retrieve admin directory');
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
} finally {await browser.close();}
