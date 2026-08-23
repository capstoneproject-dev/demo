<?php

$testSessionPath = __DIR__ . '/../storage/cache/analytics_ai';
if (!is_dir($testSessionPath)) {
    mkdir($testSessionPath, 0777, true);
}
ini_set('session.save_path', $testSessionPath);

require_once __DIR__ . '/../includes/analytics_ai.php';

function analyticsRuleAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function analyticsRuleSentenceCount(string $text): int
{
    $sentences = preg_split('/(?<=[.!?])\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY);
    return is_array($sentences) ? count($sentences) : 0;
}

$snapshot = [
    'totals' => [
        'revenue' => 1000,
        'participationAverage' => 40,
        'participationTotal' => 120,
    ],
    'summaries' => ['participation' => 'Medium'],
    'counts' => [
        'financial' => ['total' => 10, 'paid' => 7, 'outstanding' => 3],
        'rentals' => ['active' => 6, 'pending' => 3, 'overdue' => 1],
        'docs' => ['approved' => 12, 'pending' => 6, 'rejected' => 2],
    ],
    'charts' => [
        'revenue' => ['labels' => ['January', 'February', 'March'], 'values' => [100, 300, 600]],
        'participation' => ['labels' => ['Assembly', 'Workshop', 'Outreach'], 'values' => [20, 40, 60]],
    ],
    'patterns' => [
        'documentRejections' => [
            'rejectedDocuments' => 2,
            'rejectedWithNotes' => 2,
            'rejectedWithoutNotes' => 0,
            'categories' => [
                ['key' => 'missing_requirements', 'label' => 'Missing requirements or attachments', 'count' => 2],
            ],
        ],
        'rentalFrequency' => [
            'rentalRecords' => 10,
            'observedItems' => 3,
            'mostRented' => [['name' => 'Camera', 'count' => 6]],
            'leastRented' => [['name' => 'Projector', 'count' => 1]],
            'mostRentedTieCount' => 1,
            'leastRentedTieCount' => 1,
        ],
        'financialBalances' => [
            'transactions' => 10,
            'outstandingTransactions' => 3,
            'outstandingAmount' => 450,
            'identifiedCustomers' => 8,
            'customersWithOutstanding' => 2,
            'repeatOutstandingCustomers' => 1,
        ],
        'eventParticipation' => [
            'eventCount' => 3,
            'medianAttendance' => 40,
            'zeroAttendanceEvents' => 0,
            'aboveAverageEvents' => 1,
            'coefficientOfVariation' => 40.8,
        ],
    ],
];

$result = analyticsAiBuildRuleBasedInsights($snapshot, ['academicYear' => '2026-2027']);

analyticsRuleAssert(array_keys($result['chartSummaries']) === ['financial', 'participation', 'inventory', 'documents'], 'Chart-summary schema changed.');
analyticsRuleAssert(array_keys($result['exportSections']) === ['revenueSeries', 'eventParticipation', 'financialTransactions', 'rentalRecords', 'documentWorkflow'], 'Export-section schema changed.');

foreach ($result['chartSummaries'] as $name => $text) {
    $count = analyticsRuleSentenceCount($text);
    analyticsRuleAssert($count >= 2 && $count <= 3, $name . ' chart summary must contain 2 to 3 sentences; got ' . $count . '.');
}

foreach ($result['exportSections'] as $name => $text) {
    $count = analyticsRuleSentenceCount($text);
    analyticsRuleAssert($count >= 3 && $count <= 5, $name . ' export section must contain 3 to 5 sentences; got ' . $count . '.');
}

$serialized = json_encode($result, JSON_UNESCAPED_UNICODE);
analyticsRuleAssert(stripos($serialized, 'USD') === false, 'Rule-based output must not use USD.');
analyticsRuleAssert(strpos($serialized, '$') === false, 'Rule-based output must not use a dollar symbol.');
analyticsRuleAssert(strpos($result['chartSummaries']['financial'], '60.0%') !== false, 'Revenue concentration percentage was not calculated.');
analyticsRuleAssert(strpos($result['exportSections']['financialTransactions'], '7 paid, 0 waived, and 3') !== false, 'Transaction aggregates were not used.');
analyticsRuleAssert(strpos($result['exportSections']['financialTransactions'], '2 of 8 identified students/customers') !== false, 'Remaining-balance student frequency was not included.');
analyticsRuleAssert(strpos($result['exportSections']['rentalRecords'], 'Camera') !== false, 'Most-rented item was not included.');
analyticsRuleAssert(strpos($result['exportSections']['rentalRecords'], 'Projector') !== false, 'Least-rented observed item was not included.');
analyticsRuleAssert(strpos($result['exportSections']['documentWorkflow'], 'Missing requirements or attachments') !== false, 'Common rejection category was not included.');
analyticsRuleAssert(strpos($result['exportSections']['eventParticipation'], 'Median attendance is 40.0') !== false, 'Event-distribution analysis was not included.');
foreach (array_merge($result['chartSummaries'], $result['exportSections']) as $text) {
    analyticsRuleAssert(str_starts_with($text, '- '), 'Insight output must start with a readable list marker.');
    analyticsRuleAssert(strpos($text, "\n- ") !== false, 'Insight output must place findings on separate lines.');
}

$empty = analyticsAiBuildRuleBasedInsights([
    'totals' => ['revenue' => 0],
    'counts' => ['financial' => [], 'rentals' => [], 'docs' => []],
    'charts' => [
        'revenue' => ['labels' => ['No revenue data'], 'values' => [0]],
        'participation' => ['labels' => ['No events'], 'values' => [0]],
    ],
], []);
analyticsRuleAssert(stripos($empty['chartSummaries']['financial'], 'insufficient') !== false, 'Empty revenue data must state that evidence is insufficient.');
analyticsRuleAssert(stripos($empty['chartSummaries']['participation'], 'cannot support') !== false, 'Empty participation data must avoid inventing a pattern.');
foreach ($empty['chartSummaries'] as $name => $text) {
    $count = analyticsRuleSentenceCount($text);
    analyticsRuleAssert($count >= 2 && $count <= 3, 'Empty ' . $name . ' chart summary has ' . $count . ' sentences.');
}
foreach ($empty['exportSections'] as $name => $text) {
    $count = analyticsRuleSentenceCount($text);
    analyticsRuleAssert($count >= 3 && $count <= 5, 'Empty ' . $name . ' export section has ' . $count . ' sentences.');
}

$single = analyticsAiBuildRuleBasedInsights([
    'totals' => ['revenue' => 250, 'participationTotal' => 15],
    'summaries' => ['participation' => 'Low'],
    'counts' => ['financial' => ['total' => 1, 'paid' => 1, 'outstanding' => 0], 'rentals' => [], 'docs' => []],
    'charts' => [
        'revenue' => ['labels' => ['April'], 'values' => [250]],
        'participation' => ['labels' => ['Orientation'], 'values' => [15]],
    ],
], []);
analyticsRuleAssert(stripos($single['chartSummaries']['financial'], 'cannot establish a trend') !== false, 'Single revenue observation must not claim a trend.');
analyticsRuleAssert(stripos($single['chartSummaries']['participation'], 'does not support a turnout trend') !== false, 'Single event must not claim a trend.');
foreach ($single['chartSummaries'] as $name => $text) {
    $count = analyticsRuleSentenceCount($text);
    analyticsRuleAssert($count >= 2 && $count <= 3, 'Single-observation ' . $name . ' chart summary has ' . $count . ' sentences.');
}
foreach ($single['exportSections'] as $name => $text) {
    $count = analyticsRuleSentenceCount($text);
    analyticsRuleAssert($count >= 3 && $count <= 5, 'Single-observation ' . $name . ' export section has ' . $count . ' sentences.');
}

echo "Analytics AI rule-based tests passed.\n";
