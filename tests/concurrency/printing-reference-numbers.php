<?php
/** Temporary fixtures: permanent references are independent of queue priority. */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__.'/../../includes/services_tracker.php';
function referenceCheck(bool $ok,string $message): void { if(!$ok) throw new RuntimeException($message); }
$pdo=getPdo(); stEnsureSchema($pdo); $orgs=[]; $user=0; $token='PN'.bin2hex(random_bytes(5));
try {
    foreach([0,1] as $n){$pdo->prepare('INSERT INTO organizations(org_name,org_code,can_offer_printing) VALUES(?,?,1)')->execute([$token.$n,$token.$n]);$orgs[]=(int)$pdo->lastInsertId();}
    $pdo->prepare("INSERT INTO users(first_name,last_name,email,password_hash,student_number) VALUES('Print','Reference',?,'unusable',?)")->execute([$token.'@example.invalid',$token]);$user=(int)$pdo->lastInsertId();
    $insert=function(int $org,bool $pending=false)use($pdo,$user):array {
        stBeginPrintingTransaction($pdo);
        try {$position=stGetNextQueueOrder($pdo,$org);$pdo->prepare("INSERT INTO print_jobs(org_id,user_id,file_name,file_url,queue_order,provider_auto_assigned) VALUES(?,?,'reference-test.pdf','test/no-upload.pdf',?,?)")->execute([$org,$user,$position,(int)$pending]);$id=(int)$pdo->lastInsertId();$pdo->commit();return stFetchPrintJob($pdo,$id);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    };
    $a=$insert($orgs[0]);$b=$insert($orgs[0]);$c=$insert($orgs[0]);$other=$insert($orgs[1],true);
    referenceCheck([$a['request_number'],$b['request_number'],$c['request_number'],$other['request_number']] === [1,2,3,1],'Numbers must start at 1 independently per organization.');
    stReorderPrintJob($pdo,$orgs[0],$c['print_job_id'],1);
    referenceCheck(stFetchPrintJob($pdo,$c['print_job_id'])['request_number']===3,'Reordering changed reference.');
    foreach(['processing','ready_to_claim','claimed'] as $status){
        $row=stUpdatePrintJobStatus($pdo,$orgs[0],$a['print_job_id'],$status,$user,$status==='claimed'?['total_cost'=>10,'payment_status'=>'unpaid']:[]);
        referenceCheck($row['request_number']===1,'Status transition changed reference.');
        $row['organization']='Test Provider';
        $notice=studentNotificationBuildPrinting($row,new DateTimeImmutable('-1 day'));
        referenceCheck($notice && str_contains($notice['message'],'request #1'),'Notification omitted permanent reference.');
        $bodies=notificationEmailRenderBodies(['title'=>$notice['title'],'message'=>$notice['message'],'recipient_name'=>'Test Student','notification_status'=>$notice['status'],'due_at'=>null], 'http://localhost/student/');
        referenceCheck(str_contains($bodies['html'],'request #1') && str_contains($bodies['text'],'request #1'),'Email omitted permanent reference.');
    }
    $fourth=$insert($orgs[0]);referenceCheck($fourth['request_number']===4,'Completed request number was reused.');
    $pdo->prepare('DELETE FROM print_jobs WHERE print_job_id=?')->execute([$a['print_job_id']]);
    $fifth=$insert($orgs[0]);referenceCheck($fifth['request_number']===5,'Deleted history caused number reuse.');
    $accepted=stAcceptPendingPrintJob($pdo,$orgs[0],$other['print_job_id'],$user);
    referenceCheck($accepted['request_number']===6,'Provider transfer did not allocate destination reference.');
    $cancelled=stCancelStudentPrintJob($pdo,$user,$fifth['print_job_id']);referenceCheck($cancelled['request_number']===5,'Cancellation changed reference.');
    try {$pdo->prepare('UPDATE print_jobs SET request_number=99 WHERE print_job_id=?')->execute([$b['print_job_id']]);throw new RuntimeException('Reference mutation allowed.');}catch(PDOException $e){referenceCheck($e->getCode()==='45000','Unexpected mutation error.');}
    echo "Independent organization sequences, reorder/status stability, pickup/history, deletion, provider transfer, cancellation and numbered email content passed.\n";
}finally{if($pdo->inTransaction())$pdo->rollBack();foreach($orgs as $org){$pdo->prepare('DELETE FROM print_jobs WHERE org_id=?')->execute([$org]);$pdo->prepare('DELETE FROM organizations WHERE org_id=?')->execute([$org]);}if($user)$pdo->prepare('DELETE FROM users WHERE user_id=?')->execute([$user]);}
