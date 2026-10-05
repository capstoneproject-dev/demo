const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../assets/js/officerAnalytics.js'),'utf8');
function setup(){
 const elements=new Map(['analyticsInsightOverall','analyticsInsightFinancial','analyticsInsightParticipation','analyticsInsightInventory','analyticsInsightDocuments','analyticsInsightsProviderBadge','analyticsInsightsRefreshBtn'].map(id=>[id,{textContent:'',style:{},disabled:false}]));
 const context=vm.createContext({window:{},console:{error(){}},document:{getElementById:id=>elements.get(id)||null,addEventListener(){}},formatOfficerPeso:n=>'PHP '+n,Map,Date,JSON,Number,String,Math,Array,Promise,setTimeout});
 vm.runInContext(source,context);vm.runInContext('isOfficerServiceAnalyticsApplicable=()=>true',context);
 return {c:context,el:elements,run:s=>vm.runInContext(s,context)};
}
const fixture=name=>({filters:{academicYear:name},charts:{},counts:{},totals:{},events:[]});
const payload=text=>({ok:true,provider:'gemini:test',fallbackUsed:false,exportSummary:text,chartSummaries:{},exportSections:{}});
const response=value=>({ok:true,status:200,json:async()=>value});
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject};}
(async()=>{
 const s=setup();s.c.a=fixture('A');s.c.b=fixture('B');
 const html='<img src=x onerror=alert(1)>';s.c.sample=payload(html);s.run('renderOfficerAnalyticsInsights(sample)');assert(s.el.get('analyticsInsightOverall').textContent.includes(html));assert.equal(s.el.get('analyticsInsightsProviderBadge').textContent,'Gemini');
 s.run('setOfficerAnalyticsInsightsLoading()');assert.match(s.el.get('analyticsInsightOverall').textContent,/Generating/);
 s.run('setOfficerAnalyticsInsightsIdle()');assert.match(s.el.get('analyticsInsightOverall').textContent,/Click Generate/);
 s.c.sample={provider:'rule-based',fallbackUsed:true,exportSummary:'Original fallback wording.',chartSummaries:{}};s.run('renderOfficerAnalyticsInsights(sample)');assert.match(s.el.get('analyticsInsightOverall').textContent,/Original fallback wording/);assert.equal(s.el.get('analyticsInsightsProviderBadge').textContent,'Rule-based fallback');
 s.c.sample={};s.run('renderOfficerAnalyticsInsights(sample)');assert.match(s.el.get('analyticsInsightOverall').textContent,/No overall summary/);
 s.c.sample={provider:'rule-based',fallbackUsed:true,providerErrors:['Quota exceeded: private diagnostic details','This model is experiencing high demand.','Incomplete AI response: review check']};s.run('renderOfficerAnalyticsInsights(sample)');
 assert.match(s.el.get('analyticsInsightsProviderBadge').title,/usage limit/);assert.match(s.el.get('analyticsInsightsProviderBadge').title,/temporarily busy/);assert.match(s.el.get('analyticsInsightsProviderBadge').title,/completeness/);
 assert(!s.el.get('analyticsInsightsProviderBadge').title.includes('private diagnostic details'));
 s.run('setOfficerAnalyticsInsightsLoading()');assert.equal(s.el.get('analyticsInsightsProviderBadge').title,'');
 s.c.sample=payload('AI explanation');s.run('renderOfficerAnalyticsInsights(sample)');assert.equal(s.el.get('analyticsInsightsProviderBadge').title,'');
 assert.equal(JSON.parse(s.run('buildOfficerAnalyticsInsightsCacheKey(a)')).version,18);
 let calls=0;s.c.fetch=async()=>{calls++;return response(payload('Cached explanation.'));};await s.run('getOfficerAnalyticsInsightsData({snapshot:a})');await s.run('getOfficerAnalyticsInsightsData({snapshot:a})');await s.run('getOfficerAnalyticsInsightsData({snapshot:a,render:false})');assert.equal(calls,1);
 const r=setup();r.c.a=fixture('A');r.c.b=fixture('B');const first=deferred(),second=deferred();let n=0;r.c.fetch=()=>++n===1?first.promise:second.promise;
 const old=r.run('getOfficerAnalyticsInsightsData({snapshot:a})');const newer=r.run('getOfficerAnalyticsInsightsData({snapshot:b})');second.resolve(response(payload('Current filter B.')));await newer;first.resolve(response(payload('Old filter A.')));await old;assert.match(r.el.get('analyticsInsightOverall').textContent,/Current filter B/);
 const f=setup();f.c.a=fixture('A');f.c.b=fixture('B');const failure=deferred();let hits=0;f.c.fetch=()=>++hits===1?failure.promise:Promise.resolve(response(payload('Keep current B.')));
 const stale=f.run('getOfficerAnalyticsInsightsData({snapshot:a})');const joined=f.run('getOfficerAnalyticsInsightsData({snapshot:a})');await f.run('getOfficerAnalyticsInsightsData({snapshot:b})');failure.reject(Error('offline'));await Promise.all([stale,joined]);assert.equal(hits,2);assert.match(f.el.get('analyticsInsightOverall').textContent,/Keep current B/);
 const e=setup();e.c.a=fixture('A');e.c.b=fixture('B');const dashboard=deferred(),exportRequest=deferred();let count=0;e.c.fetch=()=>++count===1?dashboard.promise:exportRequest.promise;
 const ui=e.run('getOfficerAnalyticsInsightsData({snapshot:a})');const report=e.run('getOfficerAnalyticsInsightsData({snapshot:b,render:false})');dashboard.resolve(response(payload('Dashboard A.')));await ui;exportRequest.resolve(response(payload('Export B.')));await report;assert.match(e.el.get('analyticsInsightOverall').textContent,/Dashboard A/);
 const offline=setup();offline.c.a=fixture('A');offline.c.fetch=async()=>{throw Error('offline')};await offline.run('getOfficerAnalyticsInsightsData({snapshot:a})');assert.equal(offline.el.get('analyticsInsightsProviderBadge').textContent,'Rule-based fallback');assert(offline.el.get('analyticsInsightOverall').textContent.length>0);
 console.log('Overview text safety, empty/loading states, provider labels, caching, stale responses, pending failures, export isolation, and offline fallback passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
