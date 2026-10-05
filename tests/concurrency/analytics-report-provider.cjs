const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const analytics = fs.readFileSync(path.join(root, 'assets/js/officerAnalytics.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'assets/js/officerDashboard.js'), 'utf8');
const rendered = [];
const c = vm.createContext({window: {}, document: {addEventListener(){}, getElementById(){return null;}}, console, Map, Date, setTimeout,
 formatOfficerPeso: value => `PHP ${value}`, normalizeAnalyticsPdfText: String,
 getReportMetadata: () => ({organization:'Example', year:'2026-2027', dateLabel:'All dates'}),
 getAnalyticsExportFileStem: () => 'example', runAnalyticsExportWithLoading: async (format, fn) => fn(),
 setAnalyticsExportLoadingMessage(){}, waitForAnalyticsExportUiPaint: async () => {},
 addAnalyticsPdfSectionDescription(doc, title, description, y){rendered.push([title, description]); return y;}
});
vm.runInContext(analytics, c);
// Include leaders beyond the prompt's 12-event preview, with ties and no-data cases.
c.sampleEvents = Array.from({length: 13}, (_, i) => ({title: `Event ${i + 1}`, participants: i === 12 ? 70 : 10}));
let participation = vm.runInContext('buildOfficerEventParticipationPatterns(sampleEvents)', c);
assert.equal(participation.mostAttended[0].title, 'Event 13');
assert.equal(participation.mostAttended[0].participants, 70);
assert.equal(participation.mostAttendedTieCount, 1);
c.sampleEvents = Array.from({length: 7}, (_, i) => ({title: `Tied ${i}`, participants: 10}));
participation = vm.runInContext('buildOfficerEventParticipationPatterns(sampleEvents)', c);
assert.equal(participation.mostAttended.length, 5);
assert.equal(participation.mostAttendedTieCount, 7);
for (const input of [[], [{title:'Zero',participants:0}]]) {
 c.sampleEvents = input;
 participation = vm.runInContext('buildOfficerEventParticipationPatterns(sampleEvents)', c);
 assert.equal(participation.mostAttended.length, 0);
 assert.equal(participation.mostAttendedTieCount, 0);
}
c.sampleEvents = [{title:'Only event',participants:10}];
assert.equal(vm.runInContext('buildOfficerEventParticipationPatterns(sampleEvents).eventCount', c), 1);
c.sampleRentals = [{item:'Calculator',status:'completed'}, {item:'Calculator',status:'pending'}, {item:'Shoe Rag',status:'cancelled'}];
let frequency = vm.runInContext('buildOfficerRentalFrequencyPatterns(sampleRentals)', c);
assert.equal(frequency.mostRented[0].name, 'Calculator');
assert.equal(frequency.mostRented[0].count, 2);
assert.equal(frequency.rentalRecords, 3); // Recorded appearances are not completed rentals.
c.sampleRentals = [{item:'Calculator'}, {item:'Shoe Rag'}];
frequency = vm.runInContext('buildOfficerRentalFrequencyPatterns(sampleRentals)', c);
assert.equal(frequency.mostRentedTieCount, 2);
assert.equal(frequency.observedItems, 2);
assert.equal(vm.runInContext('buildOfficerRentalFrequencyPatterns([]).mostRented.length', c), 0);
vm.runInContext(dashboard.slice(dashboard.indexOf('function formatAnalyticsReportPeso('), dashboard.indexOf('function addAnalyticsPdfSectionDescription(')), c);
vm.runInContext(dashboard.slice(dashboard.indexOf('function buildAnalyticsCsvRows('), dashboard.indexOf('async function exportCSV(options')), c);
vm.runInContext(dashboard.slice(dashboard.indexOf('async function exportPDF(options'), dashboard.indexOf('// --- WORKFLOW ACTIONS:')), c);
c.report = {availability:{servicesApplicable:true}, totals:{revenue:0,participationAverage:0,participationTotal:0},
 counts:{financial:{total:0,paid:0,outstanding:0}, rentals:{active:0,pending:0,overdue:0},docs:{approved:0,pending:0,rejected:1}},
 summaries:{revenueTrend:'OLD RULE REVENUE',participation:'OLD RULE ATTENDANCE'},
 charts:{revenue:{labels:[],values:[]}},patterns:{eventParticipation:{medianAttendance:0}}, docs:[{title:'Example proposal',status:'rejected',reviewerNotes:'Missing attachments.'}],events:[],financial:[],rentals:[]};
c.ai = {provider:'gemini:test',fallbackUsed:false,exportSummary:'AI OVERVIEW',
 chartSummaries:Object.fromEntries(['financial','participation','inventory','documents'].map(key=>[key,`AI CHART ${key}`])),
 exportSections:Object.fromEntries(['revenueSeries','eventParticipation','financialTransactions','rentalRecords','documentWorkflow'].map(key=>[key,`AI SECTION ${key}`])),
 documentGuidance:{rejectionSummary:'AI REJECTION SUMMARY',keepDoing:'AI KEEP DOING',reviewChecks:{missing_requirements:'AI CHECK: Match each attachment to the checklist before resubmitting.'}}};
c.getOfficerAnalyticsReportData = () => c.report;
c.getOfficerAnalyticsInsightsData = async () => c.ai;
class FakePdf {
 constructor(){this.lastAutoTable={finalY:50};}
 setFontSize(){} setTextColor(){} setFont(){} setCharSpace(){} addPage(){}
 text(value){rendered.push(['text',value]);} splitTextToSize(value){return [value];}
 autoTable(options){rendered.push(['table',options.body]); if(options.startY===46)rendered.push(['summaryOptions',options]);} save(){rendered.push(['saved']);}
}
c.window.jspdf = {jsPDF:FakePdf};
(async()=>{
 const csv = JSON.stringify(vm.runInContext('buildAnalyticsCsvRows(getReportMetadata(),report,ai)', c));
 const summaryNotes = vm.runInContext('getOfficerAnalyticsSummaryNotes(report,ai)', c);
 for (const note of Object.values(summaryNotes)) assert(csv.includes(note));
 assert(!csv.includes('Inventory utilization')); assert(!csv.includes('Document workflow'));
 assert(summaryNotes.rejectedDocs.includes('AI REJECTION SUMMARY'));
 for(const key of Object.keys(c.ai.exportSections)) assert(csv.includes(`AI SECTION ${key}`));
 assert(!csv.includes('OLD RULE')); assert(!csv.includes('Workflow improvements:'));
 assert(csv.includes('AI REJECTION SUMMARY')); assert(csv.includes('AI KEEP DOING')); assert(csv.includes('AI CHECK:'));
 assert(!csv.includes('not AI-generated'));
 await vm.runInContext('exportPDF()',c);
 const pdf = JSON.stringify(rendered);
 const summary=rendered.find(row=>row[0]==='summaryOptions')[1];
 for (const note of Object.values(summaryNotes)) assert(summary.body.some(row=>row[2]===note));
 assert.equal(summary.styles.overflow,'linebreak');assert.equal(summary.columnStyles[2].cellWidth,115);
 assert.equal(summary.styles.halign,'left');assert.equal(summary.body[0][1],'PHP 0.00');
 assert.equal(vm.runInContext('formatAnalyticsReportPeso(10455)',c),'PHP 10,455.00');
 assert.equal(vm.runInContext('normalizeAnalyticsPdfText("Revenue reached ₱2,730.00.\\n\\nEvents A B C D E F were recorded.")',c),'Revenue reached PHP 2,730.00.\n\nEvents A B C D E F were recorded.');
 for(const key of Object.keys(c.ai.exportSections)) assert(pdf.includes(`AI SECTION ${key}`));
 assert(!pdf.includes('OLD RULE')); assert(!pdf.includes('Workflow improvements:'));
 assert(pdf.includes('AI REJECTION SUMMARY')); assert(pdf.includes('AI KEEP DOING')); assert(pdf.includes('AI CHECK:'));
 assert(pdf.includes('AI CHART financial')); assert(pdf.includes('AI CHART participation'));
 assert(rendered.some(row=>row[0]==='saved'));
 c.praiseDocs=[{status:'approved',reviewerNotes:'Objectives are clear. The budget is consistent.'},
 {status:'approved',reviewerNotes:'Objectives are not clear. If objectives are clear, resubmit.'},
 {status:'approved',reviewerNotes:'Are the objectives clear?'},{status:'approved',reviewerNotes:'Approved.'},
 {status:'rejected',reviewerNotes:'Objectives are clear.'}];
 const praise=vm.runInContext('buildOfficerDocumentPositivePatterns(praiseDocs)',c);
 assert.equal(praise.documentsWithPositiveFeedback,1);assert.equal(praise.categories.length,2);
 assert.equal(praise.categories.find(item=>item.key==='clear_objectives').count,1);
 assert(!JSON.stringify(praise).includes('Objectives are clear.'));
 c.tagalogDocs = [{status:'rejected', submittedByName:'Demo Person', adviserReviewerName:'Example Reviewer', adviserReviewerUserId:1,
  adviserReviewerNotes:'Hindi malinaw ang layunin ni Demo Person. Email demo@example.com; 12324MN-000080; 09171234567.',
  reviewAnnotations:[{created_by_user_id:1,comment_text:'Pakilinaw kung sino ang makikinabang.',selected_text:'Private highlighted name'}]},
  {status:'rejected',reviewerNotes:'Kumpleto ang attachments pero mali ang petsa.'},
  {status:'approved',reviewerNotes:'Malinaw ang layunin at kumpleto ang mga kalakip.'}];
 const anonymized = vm.runInContext('buildOfficerDocumentAiFeedback(tagalogDocs)',c);
 const anonymousText = JSON.stringify(anonymized);
 for(const privateValue of ['Demo Person','Example Reviewer','demo@example.com','12324MN-000080','09171234567','Private highlighted name']) assert(!anonymousText.includes(privateValue));
 assert(anonymousText.includes('Hindi malinaw ang layunin')); assert(anonymousText.includes('Pakilinaw kung sino'));
 assert.equal(anonymized.records.length,3); assert.equal(anonymized.records[0].comments.length,2);
 c.directReport = {...c.report,docs:c.tagalogDocs,documentFeedback:anonymized};
 c.directAI = {...c.ai,documentAnalysis:{rejectionCategories:[
  {key:'content_details',label:'Insufficient content or details',count:1,share:50,documentRefs:['D1']},
  {key:'schedule_venue',label:'Schedule, date, time, or venue issue',count:1,share:50,documentRefs:['D2']}],
  positivePractices:[{key:'clear_objectives',label:'Clear objectives',count:1,documentRefs:['D3']}],reviewedRejectedDocuments:2,reviewedApprovedDocuments:1,omittedDocuments:0,truncatedComments:0},
  documentGuidance:{...c.ai.documentGuidance,reviewChecks:{content_details:'AI CHECK: Clarify the objectives.',schedule_venue:'AI CHECK: Correct the date.'}}};
 assert.equal(vm.runInContext('resolveOfficerAnalyticsReportInsights(directReport,directAI).provider',c),'gemini:test');
 const directCsv=JSON.stringify(vm.runInContext('buildAnalyticsCsvRows(getReportMetadata(),directReport,directAI)',c));
 assert(directCsv.includes('AI-interpreted feedback')); assert(directCsv.includes('Correct the date.'));
 assert(!directCsv.includes('Categories above are keyword matches'));
 assert(!directCsv.includes('Missing requirements or attachments')); // Keywords mention attachments but AI interpreted complete attachments.
 c.badDirectAI={...c.directAI,documentAnalysis:{...c.directAI.documentAnalysis,rejectionCategories:[{...c.directAI.documentAnalysis.rejectionCategories[0],documentRefs:['D99']} ]}};
 assert.equal(vm.runInContext('resolveOfficerAnalyticsReportInsights(directReport,badDirectAI).provider',c),'rule-based');
 const firstKey=vm.runInContext('buildOfficerAnalyticsInsightsCacheKey(directReport)',c);
 c.directReport.documentFeedback.records[0].comments[0].text='Pakikumpleto ang mga kalakip.';
 assert.notEqual(firstKey,vm.runInContext('buildOfficerAnalyticsInsightsCacheKey(directReport)',c));
 assert(!JSON.stringify(vm.runInContext('buildOfficerAnalyticsInsightsRequest(directReport)',c)).includes('Demo Person'));
 c.noChecks={...c.ai,documentGuidance:{...c.ai.documentGuidance,reviewChecks:{}}};
 assert.equal(vm.runInContext('resolveOfficerAnalyticsReportInsights(report,noChecks).provider',c),'rule-based');
 c.partial = {...c.ai, exportSections:{...c.ai.exportSections,documentWorkflow:''}};
 assert.equal(vm.runInContext('resolveOfficerAnalyticsReportInsights(report,partial).provider',c),'rule-based');
 const partialCsv=JSON.stringify(vm.runInContext('buildAnalyticsCsvRows(getReportMetadata(),report,partial)',c));
 assert(!partialCsv.includes('AI SECTION')); assert(!partialCsv.includes('gemini:test'));
 assert(partialCsv.includes('Workflow improvements:'));
 rendered.length=0;c.getOfficerAnalyticsInsightsData=async()=>c.partial;
 await vm.runInContext('exportPDF()',c);
 assert(!JSON.stringify(rendered).includes('AI SECTION')); assert(JSON.stringify(rendered).includes('rule-based fallback'));
 c.report.availability.servicesApplicable=false;
 assert.equal(vm.runInContext('getOfficerAnalyticsReportEvidenceRows(report,ai).length',c),1);
 console.log('CSV and PDF use all AI narrative fields; incomplete reports fall back as a whole; reference tables and disabled services verified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
