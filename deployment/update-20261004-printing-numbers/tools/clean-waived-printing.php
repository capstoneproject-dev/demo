<?php
/** Optional one-time cleanup of the explicitly selected organization's waived printing requests and compact references. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/bootstrap.php';
$dir=$backupDir;
$code=trim((string)($options['org-code']??''));
if($code==='')throw new RuntimeException('Provide --org-code=AISERS or another explicitly selected organization.');
$lookup=$pdo->prepare('SELECT org_id FROM organizations WHERE org_code=?');$lookup->execute([$code]);$org=(int)$lookup->fetchColumn();
if(!$org)throw new RuntimeException('Organization code not found.');
$s=$pdo->prepare('SELECT print_job_id,request_number,status,payment_status,file_name FROM print_jobs WHERE org_id=? ORDER BY submitted_at,print_job_id');$s->execute([$org]);$rows=$s->fetchAll(PDO::FETCH_ASSOC);
$waived=array_values(array_filter($rows,fn($r)=>$r['payment_status']==='waived'));
if(!isset($options['apply'])){echo json_encode(['organization'=>$code,'remove'=>$waived,'remaining'=>count($rows)-count($waived)],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";exit;}
if(!$waived){echo "No waived printing requests remain for the selected organization; no further renumbering performed.\n";exit;}
stEnsureSchema($pdo);
foreach(['capstone_printing_numbers_maintenance',NOTIFICATION_EMAIL_LOCK_NAME]as$lock){$s=$pdo->prepare('SELECT GET_LOCK(?,10)');$s->execute([$lock]);if((int)$s->fetchColumn()!==1)throw new RuntimeException('Printing cleanup or email dispatch is busy.');}
try{
    stBeginPrintingTransaction($pdo);stLockPrintingQueues($pdo,[$org]);
    $s=$pdo->prepare('SELECT * FROM print_jobs WHERE org_id=? ORDER BY submitted_at,print_job_id FOR UPDATE');$s->execute([$org]);$before=$s->fetchAll(PDO::FETCH_ASSOC);
    $email=$pdo->prepare("SELECT * FROM notification_email_deliveries WHERE source_type='printing' AND source_id IN(SELECT print_job_id FROM print_jobs WHERE org_id=?) FOR UPDATE");$email->execute([$org]);$messages=$email->fetchAll(PDO::FETCH_ASSOC);
    $counter=$pdo->prepare('SELECT * FROM printing_number_counters WHERE org_id=? FOR UPDATE');$counter->execute([$org]);$counterBefore=$counter->fetch(PDO::FETCH_ASSOC);
    $backup=$dir.'/before-waived-printing-cleanup-'.date('Ymd-His').'.json';
    if(file_put_contents($backup,json_encode(['print_jobs'=>$before,'emails'=>$messages,'counter'=>$counterBefore],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR))===false)throw new RuntimeException('Backup failed.');
    $removed=[];$kept=[];foreach($before as$row){if($row['payment_status']==='waived')$removed[]=(int)$row['print_job_id'];else$kept[]=$row;}
    $delete=$pdo->prepare("DELETE FROM print_jobs WHERE print_job_id=? AND org_id=? AND payment_status='waived'");
    foreach($removed as$id)$delete->execute([$id,$org]);
    $stage=$pdo->prepare('UPDATE print_jobs SET request_number=NULL,updated_at=updated_at WHERE org_id=?');$stage->execute([$org]);
    $update=$pdo->prepare('UPDATE print_jobs SET request_number=?,updated_at=updated_at WHERE print_job_id=? AND org_id=?');
    $mapping=[];foreach($kept as$index=>$row){$number=$index+1;$update->execute([$number,$row['print_job_id'],$org]);$mapping[(int)$row['print_job_id']]=$number;}
    $pdo->prepare('INSERT INTO printing_number_counters(org_id,last_number) VALUES(?,?) ON DUPLICATE KEY UPDATE last_number=VALUES(last_number)')->execute([$org,count($kept)]);
    $emailUpdate=$pdo->prepare('UPDATE notification_email_deliveries SET message=? WHERE delivery_id=?');
    $emailRemove=$pdo->prepare('DELETE FROM notification_email_deliveries WHERE delivery_id=?');
    foreach($messages as$message){
        if(!in_array($message['delivery_status'],['pending','retrying'],true))continue;
        $id=(int)$message['source_id'];
        if(in_array($id,$removed,true)){$emailRemove->execute([$message['delivery_id']]);continue;}
        if(!isset($mapping[$id]))continue;
        $text=preg_replace('/request\s*#\d+/i','Request #'.$mapping[$id],$message['message']);
        if(!preg_match('/request\s*#\d+/i',$text))$text.=' Request #'.$mapping[$id].'.';
        $emailUpdate->execute([$text,$message['delivery_id']]);
    }
    $verify=$pdo->prepare('SELECT request_number FROM print_jobs WHERE org_id=? ORDER BY request_number');$verify->execute([$org]);
    $numbers=array_map('intval',$verify->fetchAll(PDO::FETCH_COLUMN));
    if($numbers!==($kept?range(1,count($kept)):[]))throw new RuntimeException('Numbering verification failed.');
    $verify=$pdo->prepare('SELECT * FROM print_jobs WHERE org_id=? ORDER BY submitted_at,print_job_id');$verify->execute([$org]);$after=$verify->fetchAll(PDO::FETCH_ASSOC);
    foreach($after as$index=>$row){$original=$kept[$index];unset($row['request_number'],$original['request_number']);if($row!==$original)throw new RuntimeException('Cleanup changed a retained request beyond its reference number.');}
    $pdo->commit();
    echo json_encode(['organization'=>$code,'removed_count'=>count($removed),'remaining_count'=>count($kept),'numbers'=>$numbers,'next_number'=>count($kept)+1,'backup'=>$backup],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";
}catch(Throwable$e){if($pdo->inTransaction())$pdo->rollBack();throw$e;}finally{foreach([NOTIFICATION_EMAIL_LOCK_NAME,'capstone_printing_numbers_maintenance']as$lock){$s=$pdo->prepare('SELECT RELEASE_LOCK(?)');$s->execute([$lock]);}}
