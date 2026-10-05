<?php
/** Local fixtures only: no network calls, real reviewer data, or database writes. */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/analytics_ai.php';
function feedbackCheck(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$snapshot = ['availability' => ['servicesApplicable' => false], 'counts' => ['docs' => ['rejected' => 3, 'approved' => 2, 'pending' => 1]],
    'patterns' => ['documentRejections' => ['categories' => [['key' => 'missing_requirements', 'count' => 99]]]],
    'documentFeedback' => ['records' => [
        ['ref' => 'D1', 'status' => 'rejected', 'comments' => [['text' => 'Hindi malinaw ang layunin. Pakilinaw kung sino ang makikinabang.']]],
        ['ref' => 'D2', 'status' => 'rejected', 'comments' => [['text' => 'Kumpleto ang attachments pero mali ang petsa.'], ['text' => 'Pakiayos ang petsa.']]],
        ['ref' => 'D3', 'status' => 'rejected', 'comments' => [['text' => 'Pakikumpleto ang mga kalakip bago muling ipasa.']]],
        ['ref' => 'D4', 'status' => 'approved', 'comments' => [['text' => 'Malinaw ang layunin at kumpleto ang mga kalakip.']]],
        ['ref' => 'D5', 'status' => 'approved', 'comments' => [['text' => 'Kung malinaw ang layunin, puwede nang ipasa. Approved.']]],
    ], 'omittedDocuments' => 0, 'truncatedComments' => 0, 'annotationsUnavailable' => 0]];
$analysis = ['rejectionCategories' => [
    ['key' => 'content_details', 'documentRefs' => ['D1']],
    ['key' => 'schedule_venue', 'documentRefs' => ['D2']],
    ['key' => 'missing_requirements', 'documentRefs' => ['D3']],
], 'positivePractices' => [
    ['key' => 'clear_objectives', 'documentRefs' => ['D4']],
    ['key' => 'complete_attachments', 'documentRefs' => ['D4']],
]];
$payload = ['chartSummaries' => array_fill_keys(['financial', 'participation', 'inventory', 'documents'], 'AI finding.'),
    'exportSections' => array_fill_keys(['revenueSeries', 'eventParticipation', 'financialTransactions', 'rentalRecords', 'documentWorkflow'], 'AI explanation.'),
    'exportSummary' => 'AI overview.', 'documentAnalysis' => $analysis,
    'documentGuidance' => ['rejectionSummary' => 'Three rejected documents each contain a different issue.',
        'keepDoing' => 'One approved document explicitly praises clear objectives and complete attachments.',
        'reviewChecks' => ['content_details' => 'Clarify the objectives and intended beneficiaries.', 'schedule_venue' => 'Correct the date and check it throughout the document.',
            'missing_requirements' => 'Complete the attachments requested by the reviewer.']]];
$prompt = analyticsAiBuildPrompt($snapshot, []);
foreach (['Tagalog', 'mixed Taglish', 'negation', 'conditional', 'untrusted data', 'distinct documentRefs', 'AI-interpreted feedback', 'Hindi malinaw ang layunin', 'Pakikumpleto ang mga kalakip'] as $term)
    feedbackCheck(str_contains($prompt, $term), 'Missing interpretation instruction or Tagalog input: ' . $term);
feedbackCheck(!str_contains($prompt, '"count": 99'), 'Keyword categories contaminate direct-feedback prompt.');
$result = analyticsAiNormalizeStructuredInsights($payload, $snapshot, []);
$inlinePayload = $payload;
foreach ($inlinePayload['documentAnalysis']['rejectionCategories'] as &$category) $category['reviewCheck'] = $payload['documentGuidance']['reviewChecks'][$category['key']];
unset($category, $inlinePayload['documentGuidance']['reviewChecks']);
$inlineResult = analyticsAiNormalizeStructuredInsights($inlinePayload, $snapshot, []);
feedbackCheck($inlineResult == $result, 'Inline AI checks must preserve the public API response and all AI text.');
foreach (['missing', 'empty', 'wrong type', 'invented evidence'] as $case) {
    $badInline = $inlinePayload;
    if ($case === 'missing') unset($badInline['documentAnalysis']['rejectionCategories'][0]['reviewCheck']);
    if ($case === 'empty') $badInline['documentAnalysis']['rejectionCategories'][0]['reviewCheck'] = '';
    if ($case === 'wrong type') $badInline['documentAnalysis']['rejectionCategories'][0]['reviewCheck'] = [];
    if ($case === 'invented evidence') $badInline['documentAnalysis']['rejectionCategories'][0]['documentRefs'] = ['D99'];
    try { analyticsAiNormalizeStructuredInsights($badInline, $snapshot, []); throw new RuntimeException('Accepted invalid inline check: ' . $case); }
    catch (AnalyticsAiException $expected) {}
}
feedbackCheck(str_contains($prompt, 'Keep each rejection category and its reviewCheck together'), 'Prompt must bind revision checks to feedback categories.');
$schema = json_decode(json_encode(analyticsAiBuildResponseSchema($snapshot)), true);
feedbackCheck($schema['required'] === ['chartSummaries', 'exportSections', 'exportSummary', 'documentGuidance', 'documentAnalysis'], 'Provider schema must require the entire report.');
$rejectionEntry = $schema['properties']['documentAnalysis']['properties']['rejectionCategories']['items'];
feedbackCheck($rejectionEntry['required'] === ['key', 'documentRefs', 'reviewCheck'], 'Provider schema must require inline checks.');
feedbackCheck($rejectionEntry['properties']['documentRefs']['items']['enum'] === ['D1','D2','D3'], 'Provider schema must limit rejection evidence to supplied rejected documents.');
feedbackCheck(!isset($schema['properties']['documentGuidance']['properties']['reviewChecks']), 'Direct feedback must not generate an independent check map.');
$wire = json_encode($inlinePayload);
$split = intdiv(strlen($wire), 2);
$decoded = analyticsAiDecodeGeminiResponse(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [
    ['thought' => true, 'text' => 'Reasoning must not enter the JSON parser.'],
    ['text' => substr($wire, 0, $split)], ['text' => substr($wire, $split)],
]]]]]);
feedbackCheck(analyticsAiNormalizeStructuredInsights($decoded, $snapshot, []) == $result, 'Multipart provider output must preserve the full report.');
foreach (['MAX_TOKENS', 'SAFETY'] as $finish) {
    try { analyticsAiDecodeGeminiResponse(['candidates'=>[['finishReason'=>$finish,'content'=>['parts'=>[['text'=>$wire]]]]]]); throw new RuntimeException('Accepted unfinished provider response.'); }
    catch (AnalyticsAiException $expected) {}
}
foreach ($result['documentAnalysis']['rejectionCategories'] as $category) {
    feedbackCheck($category['count'] === 1 && $category['share'] === 33.3, 'Counts must derive from distinct evidence, not model totals.');
}
feedbackCheck($result['documentAnalysis']['reviewedRejectedDocuments'] === 3, 'Wrong evidence denominator.');
feedbackCheck($result['documentAnalysis']['positivePractices'][0]['count'] === 1, 'Repeated praise must not inflate counts.');
foreach (['duplicate ref', 'invented ref', 'wrong status', 'missing rejection', 'missing analysis', 'extra check', 'empty arrays'] as $case) {
    $bad = $payload;
    if ($case === 'duplicate ref') $bad['documentAnalysis']['rejectionCategories'][0]['documentRefs'] = ['D1', 'D1'];
    if ($case === 'invented ref') $bad['documentAnalysis']['rejectionCategories'][0]['documentRefs'] = ['D99'];
    if ($case === 'wrong status') $bad['documentAnalysis']['positivePractices'][0]['documentRefs'] = ['D1'];
    if ($case === 'missing rejection') array_pop($bad['documentAnalysis']['rejectionCategories']);
    if ($case === 'missing analysis') unset($bad['documentAnalysis']);
    if ($case === 'extra check') $bad['documentGuidance']['reviewChecks']['other'] = 'Unsupported check.';
    if ($case === 'empty arrays') $bad['documentAnalysis'] = ['rejectionCategories' => [], 'positivePractices' => []];
    try { analyticsAiNormalizeStructuredInsights($bad, $snapshot, []); throw new RuntimeException('Accepted invalid evidence: ' . $case); }
    catch (AnalyticsAiException $expected) {}
}
$empty = $snapshot; $empty['documentFeedback']['records'] = [];
$emptySchema = json_decode(json_encode(analyticsAiBuildResponseSchema($empty)), true);
feedbackCheck($emptySchema['properties']['documentAnalysis']['properties']['rejectionCategories']['maxItems'] === 0, 'Empty evidence must require empty classifications.');
$legacySchema = analyticsAiBuildResponseSchema([]);
feedbackCheck(str_contains(json_encode($legacySchema), '"properties":{}'), 'Empty legacy review checks must serialize as an object.');
$emptyPayload = $payload; $emptyPayload['documentAnalysis'] = ['rejectionCategories' => [], 'positivePractices' => []];
$emptyPayload['documentGuidance']['reviewChecks'] = [];
feedbackCheck(analyticsAiNormalizeStructuredInsights($emptyPayload, $empty, [])['documentAnalysis']['reviewedRejectedDocuments'] === 0, 'Empty evidence must be supported.');
$sensitive = ['records' => [['ref' => 'D1', 'status' => 'rejected', 'comments' => [['text' => 'Email example@example.com, student 12324MN-000080, phone 09171234567. Kulang ang kalakip.']]]]];
$clean = json_encode(analyticsAiSanitizeDocumentFeedback($sensitive));
foreach (['example@example.com', '12324MN-000080', '09171234567'] as $identity) feedbackCheck(!str_contains($clean, $identity), 'Server redaction failed.');
feedbackCheck(str_contains($clean, 'Kulang ang kalakip'), 'Redaction removed the feedback meaning.');
if (!ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED) {
    $guarded = analyticsAiGenerateInsights($snapshot, [], 1, true);
    feedbackCheck(($guarded['provider'] ?? '') === 'rule-based' && $guarded['fallbackUsed'], 'Unapproved feedback must stay local and use a clearly labeled fallback.');
    feedbackCheck(!isset($guarded['cacheKey']), 'Temporary consent fallback must not be cached.');
}
echo "Tagalog/Taglish prompt, evidence-derived counts, invalid evidence rejection, empty data, and server redaction passed (simulated AI response; no provider call).\n";
echo "Inline AI revision checks preserve the API; missing checks and unsupported evidence still reject the entire response.\n";
echo "Provider-enforced schema, status-scoped references, multipart JSON extraction, and unfinished-response rejection passed.\n";
