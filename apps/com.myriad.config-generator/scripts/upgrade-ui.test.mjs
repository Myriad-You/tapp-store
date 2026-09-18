/** Real page DOM + production listeners; only host APIs and network responses are simulated.
 * Install jsdom outside the repository and set JSDOM_MODULE_PATH to its package directory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { generate } from './generator-harness.mjs';
const require = createRequire(new URL('../main.js', import.meta.url));
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_MODULE_PATH || 'jsdom');
const engine = require('./upgrade.js');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../page.html', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function openPage(t) {
  const errors = [], notifications = [];
  const vc = new VirtualConsole();vc.on('jsdomError', e => {if (!/Not implemented:.*(?:scroll|navigation)/.test(e.message)) errors.push(e);});
  const dom = new JSDOM(html, {runScripts:'outside-only',url:'https://generator.test/',pretendToBeVisual:true,virtualConsole:vc});
  t.after(()=>dom.window.close());
  const w=dom.window;w.require=require;w._TAPP_MODE='page';w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  let ready;
  w.Tapp={lifecycle:{onReady(cb){ready=cb;},onUnload(){}},ui:{showNotification:async note=>notifications.push(note)},api:async name=>name==='dockerHubTag'?{digest:'sha256:'+'b'.repeat(64)}:{results:[{name:'v1.2.4'}]}};
  w.eval(main);assert.equal(typeof ready,'function');ready();await tick();
  const el=id=>w.document.getElementById(id);
  const enter=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
  function inspect(old){el('btn-start-upgrade').click();enter('upgrade-compose',old.compose);enter('upgrade-env',old.env);el('btn-inspect-upgrade').click();}
  async function output(){el('btn-generate-all').click();await tick();return {compose:el('result-docker-compose').textContent,env:el('result-env').textContent};}
  return {w,el,enter,inspect,output,errors,notifications};
}
function legacy(overrides={}){return generate({composeHostRoot:'/srv/existing',...overrides});}
test('real page imports, locks original identities, then generates upgraded output',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);
 assert.ok(page.w.upgradeSession.legacy,page.el('upgrade-status').textContent);
 assert.equal(page.el('db-password').readOnly,true);assert.equal(page.el('compose-host-root').value,'/srv/existing');assert.equal(page.el('compose-host-root').readOnly,true);
 assert.equal(page.el('btn-continue-upgrade').hidden,false);page.el('btn-continue-upgrade').click();assert.equal(page.w.wizardStep,'panel');
 const output=await page.output();assert.ok(output.compose,page.notifications.map(n=>n.message).join('\n'));
 const checked=engine.inspectLegacy(output.compose,output.env);assert.equal(checked.statePatch.jwtSecret,old.state.jwtSecret);assert.equal(checked.root,'/srv/existing');assert.equal(checked.env.MYRIAD_TAG,'v1.2.4');
 assert.equal(page.el('setup-secret-reminder').hidden,true);assert.equal(page.errors.length,0,page.errors.map(e=>e.message).join('\n'));
});
test('editing imported source invalidates inspection and failed reimport cannot continue',async t=>{
 const page=await openPage(t);page.inspect(legacy());page.enter('upgrade-env','INVALID');
 assert.equal(page.w.upgradeSession.legacy,null);assert.equal(page.el('btn-continue-upgrade').hidden,true);assert.equal(page.el('db-password').readOnly,false);
 page.el('btn-inspect-upgrade').click();assert.equal(page.w.upgradeSession.legacy,null);assert.equal(page.el('btn-continue-upgrade').hidden,true);assert.ok(page.el('upgrade-status').textContent);
});
test('switching to fresh installation clears imported credentials even after invalidation',async t=>{
 for(const invalidate of [false,true]){
 const page=await openPage(t);const old=legacy();page.inspect(old);if(invalidate)page.enter('upgrade-env','INVALID');
 page.w.goWizard('welcome','back');page.el('btn-start-new').click();
 assert.equal(page.w.upgradeSession.legacy,null);assert.equal(page.el('upgrade-env').value,'');
 for(const [key,id] of [['jwtSecret','jwt-secret'],['dbPassword','db-password'],['updateToken','update-token'],['setupSecret','setup-secret']]){
 assert.notEqual(page.el(id).value,old.state[key],id+' must not retain imported secret');assert.notEqual(page.w.state[key],old.state[key],key+' state must not retain imported secret');}
 assert.equal(page.el('compose-host-root').readOnly,false);
 }
});
test('unknown original root remains empty until operator supplies original absolute path',async t=>{
 const page=await openPage(t);const old=legacy();old.env=old.env.replace(/MYRIAD_COMPOSE_HOST_ROOT=.*\n/,'MYRIAD_COMPOSE_HOST_ROOT=.\n');page.inspect(old);
 assert.ok(page.w.upgradeSession.legacy,page.el('upgrade-status').textContent);assert.equal(page.el('compose-host-root').value,'');assert.equal(page.el('compose-host-root').readOnly,false);
 const blocked=await page.output();assert.equal(blocked.compose,'');assert.ok(page.notifications.some(n=>/absolute|绝对|目录/.test(n.message)));
 page.enter('compose-host-root','/srv/existing');const output=await page.output();assert.ok(output.compose,page.notifications.map(n=>n.message).join('\n'));assert.equal(engine.parseEnv(output.env).MYRIAD_COMPOSE_HOST_ROOT,'/srv/existing');
});
test('edited import cannot silently generate a fresh deployment while digest resolution is pending',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);let resolveDigest;
 page.w.Tapp.api=async name=>name==='dockerHubTag'?new Promise(resolve=>{resolveDigest=resolve;}):{results:[{name:'v1.2.4'}]};
 page.el('btn-generate-all').click();await tick();assert.equal(typeof resolveDigest,'function');
 page.enter('upgrade-env',old.env+'# edited\n');resolveDigest({digest:'sha256:'+'b'.repeat(64)});await tick();
 assert.equal(page.el('result-docker-compose').textContent,'');assert.equal(page.el('btn-generate-all').disabled,true);
 page.el('btn-generate-all').click();await tick();assert.equal(page.el('result-env').textContent,'');
});
test('editing import while empty image tags resolve cancels the pending generation',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);const pending=[];
 for(const id of ['myriad-tag','proxy-tag','updater-tag'])page.enter(id,'');
 page.w.Tapp.api=async name=>name==='dockerHubTags'?new Promise(resolve=>pending.push(resolve)):{digest:'sha256:'+'b'.repeat(64)};
 page.el('btn-generate-all').click();await tick();assert.equal(pending.length,4);
 page.enter('upgrade-compose',old.compose+'\n# edited\n');pending.forEach(resolve=>resolve({results:[{name:'v1.2.4'}]}));await tick();
 assert.equal(page.el('result-docker-compose').textContent,'');assert.equal(page.el('btn-generate-all').disabled,true);
});
test('switching to new install cancels old pending generation and removes generated old secrets',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);const first=await page.output();assert.ok(first.compose);
 let resolveDigest;page.w.Tapp.api=async()=>new Promise(resolve=>{resolveDigest=resolve;});
 page.el('btn-generate-all').click();await tick();assert.equal(typeof resolveDigest,'function');
 page.w.goWizard('welcome','back');page.el('btn-start-new').click();resolveDigest({digest:'sha256:'+'b'.repeat(64)});await tick();
 assert.equal(page.el('result-env').textContent,'');assert.equal(page.el('upgrade-env').value,'');assert.equal(page.w.state.jwtSecret,'');assert.equal(page.el('btn-generate-all').disabled,false);
});
test('invalidating a previously generated import removes stale downloadable results and reports',async t=>{
 const page=await openPage(t);const old=legacy();page.inspect(old);assert.ok((await page.output()).env);
 page.enter('upgrade-env',old.env+'# changed\n');
 for(const id of ['result-env','result-docker-compose','result-guard-env','result-deploy-notes','upgrade-result-report'])assert.equal(page.el(id).textContent,'',id+' must not expose stale output');
});
test('real click generation preserves quoted legacy JWT and database credentials byte for byte',async t=>{
 const page=await openPage(t);const old=legacy();const password='database+/=$literal';const jwt='  jwt+/=$literal  ';
 old.env=old.env.replace('POSTGRES_PASSWORD='+old.state.dbPassword,"POSTGRES_PASSWORD='"+password+"'").replace('JWT_SECRET='+old.state.jwtSecret,"JWT_SECRET='"+jwt+"'").replace(encodeURIComponent(old.state.dbPassword)+'@postgres',encodeURIComponent(password)+'@postgres');
 page.inspect(old);assert.ok(page.w.upgradeSession.legacy,page.el('upgrade-status').textContent);
 const output=await page.output();assert.ok(output.compose,page.notifications.map(n=>n.message).join('\n'));
 const resolved=engine.inspectLegacy(output.compose,output.env);assert.equal(resolved.statePatch.jwtSecret,jwt);assert.equal(resolved.statePatch.dbPassword,password);
});
