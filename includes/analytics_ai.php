<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/analytics_ai.php';

class AnalyticsAiException extends RuntimeException {}
class AnalyticsAiAuthorizationException extends RuntimeException {}

function analyticsRequireOfficerOrgContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new AnalyticsAiAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? null) !== 'org') {
        throw new AnalyticsAiAuthorizationException('Officer organization context required.');
    }
    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        throw new AnalyticsAiAuthorizationException('No active organization selected.');
    }

    return [
        'session' => $session,
        'org_id' => $orgId,
    ];
}

function analyticsAiGenerateInsights(array $snapshot, array $filters, int $orgId, bool $forceRefresh = false): array
{
    $cacheKey = analyticsAiBuildCacheKey($snapshot, $filters, $orgId);
    if (!$forceRefresh) {
        $cached = analyticsAiReadCache($cacheKey);
        if ($cached) {
            return $cached + ['cacheKey' => $cacheKey];
        }
    }

    $result = null;
    $errors = [];

    if (ANALYTICS_AI_ZERO_COST_ONLY && ANALYTICS_AI_GEMINI_ENABLED && ANALYTICS_AI_GEMINI_API_KEY !== '') {
        foreach (analyticsAiGetGeminiModels() as $geminiModel) {
            try {
                $result = analyticsAiGenerateWithGeminiModel($snapshot, $filters, $geminiModel);
                if ($result) {
                    break;
                }
            } catch (Throwable $error) {
                $errors[] = 'gemini (' . $geminiModel . '): ' . $error->getMessage();
            }
        }
    }

    if (!$result && ANALYTICS_AI_LLAMA_ENABLED && ANALYTICS_AI_LLAMA_BASE_URL !== '') {
        try {
            $result = analyticsAiGenerateWithLlama($snapshot, $filters);
        } catch (Throwable $error) {
            $errors[] = 'llama: ' . $error->getMessage();
        }
    }

    if (!$result) {
        $result = analyticsAiBuildRuleBasedInsights($snapshot, $filters);
        $result['provider'] = 'rule-based';
        $result['fallbackUsed'] = true;
        if ($errors) {
            $result['providerErrors'] = $errors;
        }
    }

    $result['generatedAt'] = gmdate(DateTimeInterface::ATOM);
    analyticsAiWriteCache($cacheKey, $result);
    return $result + ['cacheKey' => $cacheKey];
}

function analyticsAiBuildCacheKey(array $snapshot, array $filters, int $orgId): string
{
    $payload = [
        'version' => 3,
        'orgId' => $orgId,
        'filters' => $filters,
        'snapshotHash' => sha1(json_encode($snapshot)),
    ];
    return sha1(json_encode($payload));
}

function analyticsAiReadCache(string $cacheKey): ?array
{
    $filePath = analyticsAiGetCacheFilePath($cacheKey);
    if (!is_file($filePath)) {
        return null;
    }
    $raw = @file_get_contents($filePath);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function analyticsAiWriteCache(string $cacheKey, array $payload): void
{
    $dir = ANALYTICS_AI_CACHE_DIR;
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    if (!is_dir($dir)) {
        return;
    }
    @file_put_contents(analyticsAiGetCacheFilePath($cacheKey), json_encode($payload, JSON_PRETTY_PRINT));
}

function analyticsAiGetCacheFilePath(string $cacheKey): string
{
    return rtrim(ANALYTICS_AI_CACHE_DIR, '/\\') . DIRECTORY_SEPARATOR . $cacheKey . '.json';
}

function analyticsAiGenerateWithGemini(array $snapshot, array $filters): array
{
    return analyticsAiGenerateWithGeminiModel($snapshot, $filters, ANALYTICS_AI_GEMINI_MODEL);
}

function analyticsAiGenerateWithGeminiModel(array $snapshot, array $filters, string $model): array
{
    $prompt = analyticsAiBuildPrompt($snapshot, $filters);
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model)
        . ':generateContent?key=' . rawurlencode(ANALYTICS_AI_GEMINI_API_KEY);

    $response = analyticsAiHttpJsonRequest($url, [
        'contents' => [[
            'role' => 'user',
            'parts' => [[
                'text' => $prompt,
            ]],
        ]],
        'generationConfig' => [
            'temperature' => 0.4,
            'responseMimeType' => 'application/json',
        ],
    ]);

    $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (!is_string($text) || trim($text) === '') {
        throw new AnalyticsAiException('Gemini returned an empty response.');
    }

    $decoded = analyticsAiDecodeStructuredResponse($text);
    $decoded['provider'] = 'gemini:' . $model;
    $decoded['fallbackUsed'] = false;
    return analyticsAiNormalizeStructuredInsights($decoded, $snapshot, $filters);
}

function analyticsAiGetGeminiModels(): array
{
    $rawModels = trim((string)(defined('ANALYTICS_AI_GEMINI_MODELS') ? ANALYTICS_AI_GEMINI_MODELS : ''));
    if ($rawModels === '') {
        return [ANALYTICS_AI_GEMINI_MODEL];
    }

    $models = array_values(array_filter(array_map(
        static fn ($value) => trim((string)$value),
        explode(',', $rawModels)
    )));

    if (!$models) {
        return [ANALYTICS_AI_GEMINI_MODEL];
    }

    return array_values(array_unique($models));
}

function analyticsAiGenerateWithLlama(array $snapshot, array $filters): array
{
    $prompt = analyticsAiBuildPrompt($snapshot, $filters);
    $baseUrl = rtrim(ANALYTICS_AI_LLAMA_BASE_URL, '/');
    $url = str_ends_with($baseUrl, '/api/generate') ? $baseUrl : $baseUrl . '/api/generate';

    $response = analyticsAiHttpJsonRequest($url, [
        'model' => ANALYTICS_AI_LLAMA_MODEL,
        'prompt' => $prompt,
        'stream' => false,
        'format' => 'json',
    ]);

    $text = $response['response'] ?? '';
    if (!is_string($text) || trim($text) === '') {
        throw new AnalyticsAiException('Llama returned an empty response.');
    }

    $decoded = analyticsAiDecodeStructuredResponse($text);
    $decoded['provider'] = 'llama-local';
    $decoded['fallbackUsed'] = false;
    return analyticsAiNormalizeStructuredInsights($decoded, $snapshot, $filters);
}

function analyticsAiHttpJsonRequest(string $url, array $payload): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        throw new AnalyticsAiException('Failed to initialize HTTP client.');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 25,
    ]);

    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new AnalyticsAiException($error !== '' ? $error : 'HTTP request failed.');
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new AnalyticsAiException('Provider returned invalid JSON.');
    }
    if ($status >= 400) {
        $message = $decoded['error']['message'] ?? $decoded['error'] ?? ('HTTP ' . $status);
        throw new AnalyticsAiException(is_string($message) ? $message : 'Provider request failed.');
    }

    return $decoded;
}

function analyticsAiBuildPrompt(array $snapshot, array $filters): string
{
    $compactSnapshot = [
        'filters' => $filters,
        'totals' => $snapshot['totals'] ?? [],
        'counts' => $snapshot['counts'] ?? [],
        'summaries' => $snapshot['summaries'] ?? [],
        'charts' => $snapshot['charts'] ?? [],
        'events' => array_slice($snapshot['events'] ?? [], 0, 12),
    ];

    return "You are writing descriptive analytics for a university organization dashboard.\n"
        . "Use only the supplied data. Do not invent facts. Keep chart summaries concise and specific.\n"
        . "All monetary values are in Philippine peso. Always write amounts in PHP or with the peso symbol ₱. Never use dollars or USD.\n"
        . "Do not simply restate the numbers. Act like a real data analyst.\n"
        . "For every summary, explain:\n"
        . "1. what pattern or trend is happening,\n"
        . "2. why that pattern matters for the organization,\n"
        . "3. what operational implication or concern the organization should take from it.\n"
        . "Avoid vague filler. Use the actual relationships in the data such as peaks, declines, concentration, backlog, volatility, dependence on a few events, overdue risk, and workflow bottlenecks.\n"
        . "Chart summaries should be 2 to 3 sentences each. Export sections should be 3 to 5 sentences each and should interpret the table, not just describe its columns.\n"
        . "Return strict JSON with this shape only:\n"
        . "{\n"
        . '  "chartSummaries": {"financial":"","participation":"","inventory":"","documents":""},' . "\n"
        . '  "exportSections": {"revenueSeries":"","eventParticipation":"","financialTransactions":"","rentalRecords":"","documentWorkflow":""},' . "\n"
        . '  "exportSummary": ""' . "\n"
        . "}\n\n"
        . "Data:\n"
        . json_encode($compactSnapshot, JSON_PRETTY_PRINT);
}

function analyticsAiDecodeStructuredResponse(string $rawText): array
{
    $decoded = json_decode($rawText, true);
    if (is_array($decoded)) {
        return $decoded;
    }

    if (preg_match('/\{.*\}/s', $rawText, $match)) {
        $decoded = json_decode($match[0], true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    throw new AnalyticsAiException('Provider response was not valid structured JSON.');
}

function analyticsAiNormalizeStructuredInsights(array $payload, array $snapshot, array $filters): array
{
    $fallback = analyticsAiBuildRuleBasedInsights($snapshot, $filters);
    $chartSummaries = $payload['chartSummaries'] ?? [];
    $exportSections = $payload['exportSections'] ?? [];

    return [
        'chartSummaries' => [
            'financial' => analyticsAiCleanInsightText($chartSummaries['financial'] ?? $fallback['chartSummaries']['financial']),
            'participation' => analyticsAiCleanInsightText($chartSummaries['participation'] ?? $fallback['chartSummaries']['participation']),
            'inventory' => analyticsAiCleanInsightText($chartSummaries['inventory'] ?? $fallback['chartSummaries']['inventory']),
            'documents' => analyticsAiCleanInsightText($chartSummaries['documents'] ?? $fallback['chartSummaries']['documents']),
        ],
        'exportSections' => [
            'revenueSeries' => analyticsAiCleanInsightText($exportSections['revenueSeries'] ?? $fallback['exportSections']['revenueSeries']),
            'eventParticipation' => analyticsAiCleanInsightText($exportSections['eventParticipation'] ?? $fallback['exportSections']['eventParticipation']),
            'financialTransactions' => analyticsAiCleanInsightText($exportSections['financialTransactions'] ?? $fallback['exportSections']['financialTransactions']),
            'rentalRecords' => analyticsAiCleanInsightText($exportSections['rentalRecords'] ?? $fallback['exportSections']['rentalRecords']),
            'documentWorkflow' => analyticsAiCleanInsightText($exportSections['documentWorkflow'] ?? $fallback['exportSections']['documentWorkflow']),
        ],
        'exportSummary' => analyticsAiCleanInsightText($payload['exportSummary'] ?? $fallback['exportSummary']),
    ] + array_intersect_key($payload, array_flip(['provider', 'fallbackUsed']));
}

function analyticsAiBuildRuleBasedInsights(array $snapshot, array $filters): array
{
    $revenueValues = $snapshot['charts']['revenue']['values'] ?? [];
    $revenueLabels = $snapshot['charts']['revenue']['labels'] ?? [];
    $highestRevenueIndex = analyticsAiFindExtremeIndex($revenueValues, 'max');
    $lowestRevenueIndex = analyticsAiFindExtremeIndex($revenueValues, 'min');

    $eventValues = $snapshot['charts']['participation']['values'] ?? [];
    $eventLabels = $snapshot['charts']['participation']['labels'] ?? [];
    $highestAttendanceIndex = analyticsAiFindExtremeIndex($eventValues, 'max');
    $lowestAttendanceIndex = analyticsAiFindExtremeIndex($eventValues, 'min');

    $financial = sprintf(
        'Revenue stands at %s. %s Highest recorded revenue was %s in %s, while the lowest was %s in %s.',
        analyticsAiFormatPhpAmount($snapshot['totals']['revenue'] ?? 0),
        analyticsAiCleanInsightText($snapshot['summaries']['revenueTrend'] ?? ''),
        analyticsAiFormatPhpAmount($revenueValues[$highestRevenueIndex] ?? 0),
        $revenueLabels[$highestRevenueIndex] ?? 'the selected period',
        analyticsAiFormatPhpAmount($revenueValues[$lowestRevenueIndex] ?? 0),
        $revenueLabels[$lowestRevenueIndex] ?? 'the selected period'
    );

    $participation = sprintf(
        'Average attendance is %d across %d event(s), with %d total participants. Retention is currently marked %s. The strongest turnout was %d for %s, while the lowest turnout was %d for %s.',
        (int)($snapshot['totals']['participationAverage'] ?? 0),
        count($snapshot['events'] ?? []),
        (int)($snapshot['totals']['participationTotal'] ?? 0),
        strtolower((string)($snapshot['summaries']['participation'] ?? 'low')),
        (int)($eventValues[$highestAttendanceIndex] ?? 0),
        $eventLabels[$highestAttendanceIndex] ?? 'the selected event',
        (int)($eventValues[$lowestAttendanceIndex] ?? 0),
        $eventLabels[$lowestAttendanceIndex] ?? 'the selected event'
    );

    $inventory = sprintf(
        'Inventory utilization shows %d active rentals, %d pending requests, and %d overdue items. Active rentals remain the largest share of tracked inventory usage.',
        (int)($snapshot['counts']['rentals']['active'] ?? 0),
        (int)($snapshot['counts']['rentals']['pending'] ?? 0),
        (int)($snapshot['counts']['rentals']['overdue'] ?? 0)
    );

    $documents = sprintf(
        'Document workflow currently includes %d approved, %d pending, and %d rejected submissions. %s',
        (int)($snapshot['counts']['docs']['approved'] ?? 0),
        (int)($snapshot['counts']['docs']['pending'] ?? 0),
        (int)($snapshot['counts']['docs']['rejected'] ?? 0),
        analyticsAiBuildDocumentDominanceSentence($snapshot['counts']['docs'] ?? [])
    );

    $peakRevenue = analyticsAiFormatPhpAmount($revenueValues[$highestRevenueIndex] ?? 0);
    $lowRevenue = analyticsAiFormatPhpAmount($revenueValues[$lowestRevenueIndex] ?? 0);
    $peakRevenueLabel = $revenueLabels[$highestRevenueIndex] ?? 'the strongest period';
    $lowRevenueLabel = $revenueLabels[$lowestRevenueIndex] ?? 'the weakest period';
    $peakAttendance = (int)($eventValues[$highestAttendanceIndex] ?? 0);
    $lowAttendance = (int)($eventValues[$lowestAttendanceIndex] ?? 0);
    $peakAttendanceLabel = $eventLabels[$highestAttendanceIndex] ?? 'the strongest event';
    $lowAttendanceLabel = $eventLabels[$lowestAttendanceIndex] ?? 'the weakest event';
    $paidTransactions = count(array_filter($snapshot['financial'] ?? [], static function ($item) {
        return strtolower((string)($item['payment_status'] ?? '')) === 'paid';
    }));
    $unpaidTransactions = count(array_filter($snapshot['financial'] ?? [], static function ($item) {
        return strtolower((string)($item['payment_status'] ?? '')) !== 'paid';
    }));
    $activeRentals = (int)($snapshot['counts']['rentals']['active'] ?? 0);
    $pendingRentals = (int)($snapshot['counts']['rentals']['pending'] ?? 0);
    $overdueRentals = (int)($snapshot['counts']['rentals']['overdue'] ?? 0);
    $approvedDocs = (int)($snapshot['counts']['docs']['approved'] ?? 0);
    $pendingDocs = (int)($snapshot['counts']['docs']['pending'] ?? 0);
    $rejectedDocs = (int)($snapshot['counts']['docs']['rejected'] ?? 0);

    $revenueSection = sprintf(
        'The revenue table shows that income is not evenly distributed across the selected periods. Revenue peaks at %s in %s but drops to %s in %s, which suggests that earnings depend heavily on a few stronger periods rather than a steady stream of activity. For the organization, this means budgeting is more exposed to timing risk because one weak period can quickly reduce total collections. It also indicates that the group should study what happened during the strongest months and replicate those service or event conditions more consistently.',
        $peakRevenue,
        $peakRevenueLabel,
        $lowRevenue,
        $lowRevenueLabel
    );
    $eventsSection = sprintf(
        'The event participation table shows uneven turnout across activities, with the strongest attendance reaching %d for %s and the weakest dropping to %d for %s. This means student interest is concentrated in specific event types, while other activities are not generating the same pull. For the organization, that pattern matters because high turnout events are proving the formats that resonate most, while low turnout events may be consuming effort without equivalent engagement. The table should be used to refine programming strategy, promotion timing, and event design around what consistently attracts participants.',
        $peakAttendance,
        $peakAttendanceLabel,
        $lowAttendance,
        $lowAttendanceLabel
    );
    $transactionsSection = sprintf(
        'The financial transactions table shows how revenue is being converted from service activity into actual collections. With %d paid transactions and %d unpaid or pending transactions, the organization can see whether revenue generation is being matched by payment completion. If unpaid items remain visible in the table, that means demand may be present but cash realization is lagging behind operations. For the organization, this is important because strong transaction volume alone does not guarantee usable funds unless collections are completed on time.',
        $paidTransactions,
        $unpaidTransactions
    );
    $rentalsSection = sprintf(
        'The rental records table indicates that current operations are anchored by %d active rentals, but it also shows %d pending requests and %d overdue items that can affect service continuity. Pending requests may signal demand that the organization has not yet converted into active usage, while overdue cases point to control and follow-up risk. This matters because overdue inventory reduces item availability and can create scheduling friction for future borrowers. Operationally, the table helps identify whether the rental service is running smoothly or whether turnaround and enforcement need attention.',
        $activeRentals,
        $pendingRentals,
        $overdueRentals
    );
    $documentsSection = sprintf(
        'The document workflow table shows whether compliance and administrative processing are moving efficiently. With %d approved, %d pending, and %d rejected documents, the organization can quickly see if work is flowing through review or getting stuck before completion. A larger pending count suggests review backlog, while rejections may indicate recurring quality or completeness issues in submissions. For the organization, this matters because slow or weak document flow can delay approvals, activities, and formal coordination with oversight offices.',
        $approvedDocs,
        $pendingDocs,
        $rejectedDocs
    );

    $exportSummary = implode(' ', [
        analyticsAiBuildFilterLead($filters),
        $financial,
        $participation,
        $inventory,
        $documents,
    ]);

    return [
        'chartSummaries' => [
            'financial' => $financial,
            'participation' => $participation,
            'inventory' => $inventory,
            'documents' => $documents,
        ],
        'exportSections' => [
            'revenueSeries' => $revenueSection,
            'eventParticipation' => $eventsSection,
            'financialTransactions' => $transactionsSection,
            'rentalRecords' => $rentalsSection,
            'documentWorkflow' => $documentsSection,
        ],
        'exportSummary' => $exportSummary,
    ];
}

function analyticsAiFindExtremeIndex(array $values, string $mode): int
{
    if (!$values) {
        return 0;
    }
    $bestIndex = 0;
    $bestValue = (float)($values[0] ?? 0);
    foreach ($values as $index => $value) {
        $numeric = (float)$value;
        if (($mode === 'max' && $numeric > $bestValue) || ($mode === 'min' && $numeric < $bestValue)) {
            $bestValue = $numeric;
            $bestIndex = (int)$index;
        }
    }
    return $bestIndex;
}

function analyticsAiBuildDocumentDominanceSentence(array $docCounts): string
{
    $normalized = [
        'approved' => (int)($docCounts['approved'] ?? 0),
        'pending' => (int)($docCounts['pending'] ?? 0),
        'rejected' => (int)($docCounts['rejected'] ?? 0),
    ];
    arsort($normalized);
    $dominantStatus = array_key_first($normalized) ?: 'pending';
    return ucfirst($dominantStatus) . ' submissions currently represent the largest share of document activity.';
}

function analyticsAiBuildFilterLead(array $filters): string
{
    $academicYear = trim((string)($filters['academicYear'] ?? ''));
    $startDate = trim((string)($filters['dateRange']['startDate'] ?? ''));
    $endDate = trim((string)($filters['dateRange']['endDate'] ?? ''));

    if ($startDate || $endDate) {
        return sprintf(
            'This summary covers %s to %s%s',
            $startDate !== '' ? analyticsAiFormatDate($startDate) : 'the start of the selected range',
            $endDate !== '' ? analyticsAiFormatDate($endDate) : 'the current endpoint',
            $academicYear !== '' ? ' within academic year ' . $academicYear . '.' : '.'
        );
    }

    return $academicYear !== ''
        ? 'This summary covers academic year ' . $academicYear . '.'
        : 'This summary covers the current analytics selection.';
}

function analyticsAiFormatPhpAmount($amount): string
{
    return 'PHP ' . number_format((float)$amount, 2);
}

function analyticsAiFormatPeso($amount): string
{
    return '₱' . number_format((float)$amount, 2);
}

function analyticsAiFormatDate(string $value): string
{
    $timestamp = strtotime($value);
    return $timestamp ? date('M j, Y', $timestamp) : $value;
}

function analyticsAiCleanInsightText(string $text): string
{
    $cleaned = strip_tags($text);
    $cleaned = str_replace(["\r\n", "\r"], "\n", $cleaned);
    $cleaned = preg_replace('/[\x{00A0}\x{1680}\x{2000}-\x{200D}\x{2028}\x{2029}\x{202F}\x{205F}\x{2060}\x{3000}\x{FEFF}]/u', ' ', $cleaned);
    $cleaned = preg_replace('/[^\P{C}\n\t]/u', '', $cleaned);
    $cleaned = preg_replace("/[ \t]+/u", ' ', $cleaned);
    $cleaned = preg_replace("/ *\n */u", "\n", $cleaned);
    $cleaned = trim($cleaned);
    $cleaned = preg_replace('/\bUSD\b/i', 'PHP', $cleaned);
    $cleaned = preg_replace('/US dollars?/i', 'Philippine pesos', $cleaned);
    $cleaned = preg_replace('/\$\s*([0-9][0-9,]*(?:\.\d+)?)/', '₱$1', $cleaned);
    $cleaned = preg_replace('/\bPHP\s*([0-9][0-9,]*(?:\.\d+)?)/i', '₱$1', $cleaned);
    return $cleaned;
}
