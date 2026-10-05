<?php
/** Offline tests: no provider requests, database writes, or generated files. */
ini_set('session.save_path',sys_get_temp_dir());
require_once __DIR__.'/../../includes/analytics_ai.php';
function insightCheck(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$normal=['charts'=>['revenue'=>['labels'=>['Printing','Rentals'],'values'=>[800,200]],'participation'=>['labels'=>['A','B','C','D'],'values'=>[10,10,10,70]]],'totals'=>['revenue'=>1000,'participationTotal'=>100],'counts'=>['rentals'=>['active'=>2,'pending'=>1,'overdue'=>0],'docs'=>['approved'=>3,'pending'=>2,'rejected'=>1]]];
$single=$normal;$single['charts']['participation']=['labels'=>['One event'],'values'=>[10]];
$zero=$normal;$zero['charts']['revenue']['values']=[0,0];$zero['totals']['revenue']=0;
$ties=$normal;$ties['patterns']['rentalFrequency']=['rentalRecords'=>4,'observedItems'=>2,'mostRented'=>[['name'=>'A','count'=>2],['name'=>'B','count'=>2]],'leastRented'=>[['name'=>'A','count'=>2],['name'=>'B','count'=>2]]];
$disabled=$normal;$disabled['availability']['servicesApplicable']=false;
$fixtures=['normal'=>$normal,'empty'=>[],'single event'=>$single,'zero revenue'=>$zero,'tied items'=>$ties,'service disabled'=>$disabled];
foreach($fixtures as$name=>$snapshot){
 $prompt=analyticsAiBuildPrompt($snapshot,[]);
 foreach(['no statistics background','simple English','unpaid payments','paid revenue profit','unique students','Missing data does not mean zero','Pending requests mean work is waiting','denominator','four short bullets','Never omit an area','Do not make predictions','Do not expose or request student identities']as$rule)insightCheck(str_contains($prompt,$rule),"Missing prompt guard: $rule");
 $decoded=analyticsAiDecodeStructuredResponse(json_encode(['chartSummaries'=>array_fill_keys(['financial','participation','inventory','documents'],'- AI chart explanation.'),'exportSections'=>array_fill_keys(['revenueSeries','eventParticipation','financialTransactions','rentalRecords','documentWorkflow'],'- AI report explanation.'),'exportSummary'=>'- The recorded data describes this period.','documentGuidance'=>['rejectionSummary'=>'No usable feedback.','keepDoing'=>'Not enough positive feedback.','reviewChecks'=>[]],'provider'=>'gemini:test','fallbackUsed'=>false]));
 $result=analyticsAiNormalizeStructuredInsights($decoded,$snapshot,[]);
 insightCheck(array_keys($result['chartSummaries'])===['financial','participation','inventory','documents'],'Chart response shape changed.');
 insightCheck(array_keys($result['exportSections'])===['revenueSeries','eventParticipation','financialTransactions','rentalRecords','documentWorkflow'],'Export response shape changed.');
 insightCheck(is_string($result['exportSummary']),'Overall summary must remain a string.');
 insightCheck(count(explode("\n",$result['exportSummary']))===4,'Overview area omitted.');
 foreach(['Finances','Event attendance','Rentals','Documents'] as $area)insightCheck(str_contains($result['exportSummary'],'- '.$area.': '),'Overview label missing.');
 if($name==='service disabled')insightCheck(str_contains($result['chartSummaries']['financial'],'disabled by OSA'),'Service availability guard removed.');
 $oldKey=sha1(json_encode(['version'=>22,'orgId'=>2,'filters'=>[],'availability'=>$snapshot['availability']??[],'snapshotHash'=>sha1(json_encode($snapshot))]));
 $newKey=analyticsAiBuildCacheKey($snapshot,[],2);
 insightCheck($oldKey!==$newKey,'Previous cache content is reused.');
 insightCheck($newKey===analyticsAiBuildCacheKey($snapshot,[],2),'Same data cache key is unstable.');
 insightCheck($newKey!==analyticsAiBuildCacheKey($snapshot,['academicYear'=>'2026-2027'],2),'Filters missing from cache key.');
 $fallback=analyticsAiBuildRuleBasedInsights($snapshot,[]);insightCheck(isset($fallback['exportSummary']),'Fallback overview missing.');
 echo "$name: prompt, response compatibility, cache separation, and fallback passed.\n";
}

$complete=['chartSummaries'=>array_fill_keys(['financial','participation','inventory','documents'],'AI chart'),'exportSections'=>array_fill_keys(['revenueSeries','eventParticipation','financialTransactions','rentalRecords','documentWorkflow'],'AI report'),'exportSummary'=>'AI overview','documentGuidance'=>['rejectionSummary'=>'No usable feedback.','keepDoing'=>'Not enough positive feedback.','reviewChecks'=>[]],'provider'=>'gemini:test','fallbackUsed'=>false];
foreach(['missing','empty','wrong type'] as $case){
 $partial=$complete;if($case==='missing')unset($partial['exportSections']['documentWorkflow']);else $partial['exportSections']['documentWorkflow']=$case==='empty'?'':[];
 try{analyticsAiNormalizeStructuredInsights($partial,[],[]);throw new RuntimeException('Partial AI response was accepted.');}catch(AnalyticsAiException $expected){}
}
insightCheck(str_contains(analyticsAiNormalizeStructuredInsights($complete,$disabled,[])['exportSummary'],'- Event attendance: AI chart'),'Attendance overview was replaced with fixed wording.');
echo "Incomplete AI reports rejected; AI overview preserved for disabled services.\n";

$feedbackSnapshot=['patterns'=>['documentRejections'=>['categories'=>[['key'=>'missing_requirements','count'=>2,'share'=>50,'revisionCheck'=>'Include missing files.']]],'documentPositiveFeedback'=>['categories'=>[['key'=>'clear_objectives','count'=>1]]]]];
$guided=$complete;$guided['documentGuidance']['reviewChecks']=['missing_requirements'=>'Compare the attachments list with the actual files before sending.'];
$normalized=analyticsAiNormalizeStructuredInsights($guided,$feedbackSnapshot,[]);
insightCheck($normalized['documentGuidance']['reviewChecks']->missing_requirements===$guided['documentGuidance']['reviewChecks']['missing_requirements'],'AI revision entry was replaced.');
foreach([[],['other'=>'Invented check.'],['missing_requirements'=>''],['missing_requirements'=>'A check.','other'=>'Extra check.']] as $badChecks){
 $invalid=$guided;$invalid['documentGuidance']['reviewChecks']=$badChecks;
 try{analyticsAiNormalizeStructuredInsights($invalid,$feedbackSnapshot,[]);throw new RuntimeException('Invalid review checks accepted.');}catch(AnalyticsAiException $expected){}
}
$prompt=analyticsAiBuildPrompt($feedbackSnapshot,[]);
foreach(['Approval counts alone cannot establish what worked','Do not invent university requirements','documentGuidance.keepDoing','exact category key'] as $guard)insightCheck(str_contains($prompt,$guard),'Missing document guidance instruction.');
echo "AI revision entries retained; missing, extra, and ungrounded category keys rejected; positive feedback instructions verified.\n";

$passages="One event recorded 70 of the 100 attendance entries. Three other events recorded 10 each.\n\nThe average is 25, but most events recorded 10. The larger event raises the average above attendance at most events.";
foreach(array_keys($complete['exportSections']) as $key)$complete['exportSections'][$key]=$passages;
$readable=analyticsAiNormalizeStructuredInsights($complete,[],[]);
foreach($readable['exportSections'] as $text)insightCheck($text===$passages,'Report passages were collapsed or forced into bullets.');
foreach(['2 or 3 short passages','matching evidence','For revenueSeries','For eventParticipation','For financialTransactions','For rentalRecords','For documentWorkflow'] as $guard)insightCheck(str_contains($prompt,$guard),'Missing evidence-based interpretation instruction.');
echo "Short passages preserved in all five report sections; interpretation and evidence instructions verified.\n";

$charts=['financial'=>'- Revenue recorded PHP 1,000.','participation'=>'- Four events recorded 100 attendance entries.','inventory'=>'- One rental request is waiting.','documents'=>'- Two documents await review.'];
$summary="- Finances: Paid revenue reached PHP 1,000.\n- Rentals: One request is waiting.\n- Documents: Two documents await review.";
$covered=analyticsAiEnsureOverallCoverage($summary,$charts);
insightCheck(str_contains($covered,'- Event attendance: Four events recorded 100 attendance entries.'),'Omitted attendance was not filled from the AI chart finding.');
insightCheck(str_contains($covered,'- Finances: Paid revenue reached PHP 1,000.'),'Existing overview finding was lost.');
insightCheck(analyticsAiEnsureOverallCoverage($covered,$charts)===$covered,'Coverage normalization is unstable.');
$charts['financial']=$charts['inventory']='- Service analytics are not applicable.';
$disabledSummary=analyticsAiEnsureOverallCoverage($covered,$charts,false);
insightCheck(str_contains($disabledSummary,'- Finances: Service analytics are not applicable.'),'Disabled service summary leaked revenue.');
insightCheck(str_contains($disabledSummary,'- Event attendance: Four events recorded 100 attendance entries.'),'Disabled services hid attendance.');
echo "Four overview areas guaranteed; omitted attendance reuses AI text; disabled services stay explicit.\n";

foreach(['consider holding again','full filtered dataset','A single event gives no comparison','equal attendance across all events','consider stocking more of','not units rented or necessarily completed rentals','checking current stock and unfulfilled requests','Do not invent a purchase quantity'] as $guard)insightCheck(str_contains($prompt,$guard),'Missing evidence-based suggestion instruction: '.$guard);
insightCheck(!str_contains($prompt,'only permitted actionable suggestions'),'Conflicting action prohibition remains.');
echo "Event-repeat and rental-stock suggestions require evidence and respect ties and sparse data.\n";
