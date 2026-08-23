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
        'version' => 6,
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
        . ':generateContent';

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
    ], [
        'x-goog-api-key: ' . ANALYTICS_AI_GEMINI_API_KEY,
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

function analyticsAiHttpJsonRequest(string $url, array $payload, array $headers = []): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        throw new AnalyticsAiException('Failed to initialize HTTP client.');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
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
        'patterns' => $snapshot['patterns'] ?? [],
        'events' => array_slice($snapshot['events'] ?? [], 0, 12),
    ];

    $instructions = <<<'PROMPT'
You are a descriptive analytics engine for a university student organization management dashboard.
Use only the supplied data. Do not invent, assume, or infer facts that are not supported by the data.

Your task is to produce concise, evidence-based descriptive analytics that identify meaningful patterns in the data rather than simply restating values.

All monetary values are in Philippine peso. Always write monetary amounts using PHP or the peso symbol ₱. Never use dollars or USD.

For every chart summary:

1. Identify the most important observable pattern, trend, comparison, concentration, anomaly, backlog, volatility, or operational condition.
2. Explain why the observed pattern is operationally relevant based only on the supplied data and the stated meaning of the metric.
3. State the operational implication or concern that the organization should be aware of.
4. When appropriate, quantify meaningful differences using percentages, absolute changes, rankings, averages, or proportions calculated only from the supplied data.
5. Do not merely repeat the values shown in the chart.
6. Do not claim causation unless causation is explicitly supported by the supplied data.
7. Do not make predictions, forecasts, or unsupported recommendations.
8. Do not describe a small difference as a major change.
9. If the data does not contain a meaningful pattern or sufficient evidence for an interpretation, explicitly state that rather than inventing an insight.

Pay particular attention to:

- increasing or decreasing trends
- peaks and lowest points
- concentration in a small number of categories or events
- unusually high or low values
- volatility or inconsistency
- pending or overdue transactions
- backlogs
- workflow bottlenecks
- resource or transaction concentration
- meaningful differences between categories
- changes over time

Chart summaries must contain 2 to 3 sentences each.

Export sections must contain 3 to 5 sentences each and must interpret the data in the table rather than simply describing its columns.

Within every chart summary and export-section string, place each finding on a separate line beginning with "- ". Do not combine all findings into one dense paragraph.

Use the supplied aggregate patterns to identify recurring document-rejection categories, most and least frequently rented observed items, outstanding-balance frequency, and useful event-participation distribution patterns. Do not expose or request student identities or raw reviewer comments. Treat rejection categories as associations in reviewer notes, not proven causes.

Use clear, professional language appropriate for a university organization management dashboard. Avoid vague filler such as 'this shows the importance of' unless the statement is followed by a specific data-supported explanation.

Return strict JSON only using the exact schema provided below. Do not include Markdown, code fences, explanations, or text outside the JSON.
PROMPT;

    return $instructions . "\n\nExact JSON schema:\n"
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
            'financial' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($chartSummaries['financial'] ?? $fallback['chartSummaries']['financial'])),
            'participation' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($chartSummaries['participation'] ?? $fallback['chartSummaries']['participation'])),
            'inventory' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($chartSummaries['inventory'] ?? $fallback['chartSummaries']['inventory'])),
            'documents' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($chartSummaries['documents'] ?? $fallback['chartSummaries']['documents'])),
        ],
        'exportSections' => [
            'revenueSeries' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($exportSections['revenueSeries'] ?? $fallback['exportSections']['revenueSeries'])),
            'eventParticipation' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($exportSections['eventParticipation'] ?? $fallback['exportSections']['eventParticipation'])),
            'financialTransactions' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($exportSections['financialTransactions'] ?? $fallback['exportSections']['financialTransactions'])),
            'rentalRecords' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($exportSections['rentalRecords'] ?? $fallback['exportSections']['rentalRecords'])),
            'documentWorkflow' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($exportSections['documentWorkflow'] ?? $fallback['exportSections']['documentWorkflow'])),
        ],
        'exportSummary' => analyticsAiStructureInsightLines(analyticsAiCleanInsightText($payload['exportSummary'] ?? $fallback['exportSummary'])),
    ] + array_intersect_key($payload, array_flip(['provider', 'fallbackUsed']));
}

function analyticsAiBuildRuleBasedInsights(array $snapshot, array $filters): array
{
    $revenue = analyticsAiBuildSeriesFacts(
        $snapshot['charts']['revenue'] ?? [],
        ['No revenue data']
    );
    $participationFacts = analyticsAiBuildSeriesFacts(
        $snapshot['charts']['participation'] ?? [],
        ['No events']
    );
    $rentals = analyticsAiNormalizeCounts($snapshot['counts']['rentals'] ?? [], ['active', 'pending', 'overdue']);
    $docs = analyticsAiNormalizeCounts($snapshot['counts']['docs'] ?? [], ['approved', 'pending', 'rejected']);
    $transactions = analyticsAiNormalizeCounts(
        $snapshot['counts']['financial'] ?? [],
        ['total', 'paid', 'waived', 'outstanding']
    );
    $patterns = is_array($snapshot['patterns'] ?? null) ? $snapshot['patterns'] : [];
    $documentRejections = is_array($patterns['documentRejections'] ?? null) ? $patterns['documentRejections'] : [];
    $rentalFrequency = is_array($patterns['rentalFrequency'] ?? null) ? $patterns['rentalFrequency'] : [];
    $financialBalances = is_array($patterns['financialBalances'] ?? null) ? $patterns['financialBalances'] : [];
    $eventPatterns = is_array($patterns['eventParticipation'] ?? null) ? $patterns['eventParticipation'] : [];

    $financial = analyticsAiBuildRevenueChartSummary($revenue);
    $participation = analyticsAiBuildParticipationChartSummary(
        $participationFacts,
        (string)($snapshot['summaries']['participation'] ?? ''),
        $eventPatterns
    );
    $inventory = analyticsAiBuildRentalChartSummary($rentals, $rentalFrequency);
    $documents = analyticsAiBuildDocumentChartSummary($docs, $documentRejections);

    $revenueSection = analyticsAiBuildRevenueExportSection($revenue);
    $eventsSection = analyticsAiBuildParticipationExportSection(
        $participationFacts,
        (string)($snapshot['summaries']['participation'] ?? ''),
        $eventPatterns
    );
    $transactionsSection = analyticsAiBuildTransactionExportSection(
        $transactions,
        (float)($snapshot['totals']['revenue'] ?? 0),
        $financialBalances
    );
    $rentalsSection = analyticsAiBuildRentalExportSection($rentals, $rentalFrequency);
    $documentsSection = analyticsAiBuildDocumentExportSection($docs, $documentRejections);

    $exportSummary = implode(' ', [
        analyticsAiBuildFilterLead($filters),
        analyticsAiBuildRevenueOverviewSentence($revenue),
        analyticsAiBuildParticipationOverviewSentence($participationFacts),
        analyticsAiBuildRentalOverviewSentence($rentals),
        analyticsAiBuildDocumentOverviewSentence($docs),
    ]);

    return [
        'chartSummaries' => [
            'financial' => analyticsAiStructureInsightLines($financial),
            'participation' => analyticsAiStructureInsightLines($participation),
            'inventory' => analyticsAiStructureInsightLines($inventory),
            'documents' => analyticsAiStructureInsightLines($documents),
        ],
        'exportSections' => [
            'revenueSeries' => analyticsAiStructureInsightLines($revenueSection),
            'eventParticipation' => analyticsAiStructureInsightLines($eventsSection),
            'financialTransactions' => analyticsAiStructureInsightLines($transactionsSection),
            'rentalRecords' => analyticsAiStructureInsightLines($rentalsSection),
            'documentWorkflow' => analyticsAiStructureInsightLines($documentsSection),
        ],
        'exportSummary' => analyticsAiStructureInsightLines($exportSummary),
    ];
}

function analyticsAiBuildSeriesFacts(array $chart, array $emptyLabels = []): array
{
    $labels = is_array($chart['labels'] ?? null) ? array_values($chart['labels']) : [];
    $values = is_array($chart['values'] ?? null) ? array_values($chart['values']) : [];
    $normalizedLabels = array_map(static fn ($label) => strtolower(trim((string)$label)), $emptyLabels);
    $points = [];

    foreach ($values as $index => $value) {
        if (!is_numeric($value)) {
            continue;
        }
        $label = trim((string)($labels[$index] ?? ('Observation ' . ($index + 1))));
        if ($label === '') {
            $label = 'Observation ' . ($index + 1);
        }
        if (in_array(strtolower($label), $normalizedLabels, true)) {
            continue;
        }
        $points[] = ['label' => $label, 'value' => (float)$value];
    }

    if (!$points) {
        return ['count' => 0, 'points' => []];
    }

    $numericValues = array_column($points, 'value');
    $maxIndex = analyticsAiFindExtremeIndex($numericValues, 'max');
    $minIndex = analyticsAiFindExtremeIndex($numericValues, 'min');
    $total = array_sum($numericValues);
    $average = $total / count($numericValues);
    $first = $points[0];
    $last = $points[count($points) - 1];
    $delta = $last['value'] - $first['value'];
    $changeThreshold = max(abs($first['value']), abs($last['value']), 1.0) * 0.05;

    return [
        'count' => count($points),
        'points' => $points,
        'total' => $total,
        'average' => $average,
        'max' => $points[$maxIndex],
        'min' => $points[$minIndex],
        'first' => $first,
        'last' => $last,
        'delta' => $delta,
        'percentChange' => abs($first['value']) > 0.00001 ? ($delta / abs($first['value'])) * 100 : null,
        'meaningfulChange' => abs($delta) > $changeThreshold,
        'maxShare' => $total > 0 ? ($points[$maxIndex]['value'] / $total) * 100 : null,
        'range' => $points[$maxIndex]['value'] - $points[$minIndex]['value'],
    ];
}

function analyticsAiNormalizeCounts(array $source, array $keys): array
{
    $counts = [];
    foreach ($keys as $key) {
        $counts[$key] = max(0, (int)($source[$key] ?? 0));
    }
    return $counts;
}

function analyticsAiFormatPercent(float $value): string
{
    return number_format($value, 1) . '%';
}

function analyticsAiCountShare(int $count, int $total): string
{
    return $total > 0 ? analyticsAiFormatPercent(($count / $total) * 100) : '0.0%';
}

function analyticsAiBuildSeriesChangeSentence(array $facts, string $metric, callable $formatter): string
{
    if (($facts['count'] ?? 0) < 2) {
        return 'Only one observation is available, so the supplied data does not support a directional ' . $metric . ' trend.';
    }

    $first = $facts['first'];
    $last = $facts['last'];
    $delta = (float)$facts['delta'];
    $absoluteChange = $formatter(abs($delta));

    if (!$facts['meaningfulChange']) {
        return sprintf(
            '%s and %s differ by only %s, so the first-to-last change is not large enough to describe as a meaningful directional shift.',
            $first['label'],
            $last['label'],
            $absoluteChange
        );
    }

    $direction = $delta > 0 ? 'increased' : 'decreased';
    $percentage = $facts['percentChange'];
    $percentageText = $percentage === null
        ? 'a percentage change is undefined because the first value is zero'
        : 'a ' . analyticsAiFormatPercent(abs((float)$percentage)) . ' change';

    return sprintf(
        '%s %s from %s in %s to %s in %s, an absolute difference of %s and %s.',
        ucfirst($metric),
        $direction,
        $formatter($first['value']),
        $first['label'],
        $formatter($last['value']),
        $last['label'],
        $absoluteChange,
        $percentageText
    );
}

function analyticsAiBuildConcentrationSentence(array $facts, string $subject): string
{
    if (($facts['count'] ?? 0) < 2 || $facts['maxShare'] === null) {
        return 'The supplied observations are insufficient to assess how concentrated ' . $subject . ' is across categories.';
    }

    $share = (float)$facts['maxShare'];
    $label = $facts['max']['label'];
    if ($share >= 50) {
        return sprintf(
            '%s accounts for %s of the recorded total, showing that %s is concentrated in one observation and is therefore sensitive to that observation’s result.',
            $label,
            analyticsAiFormatPercent($share),
            $subject
        );
    }

    return sprintf(
        'The largest observation, %s, represents %s of the recorded total; no single observation holds a majority, so the supplied data does not show majority concentration.',
        $label,
        analyticsAiFormatPercent($share)
    );
}

function analyticsAiBuildRevenueChartSummary(array $facts): string
{
    if (($facts['count'] ?? 0) === 0) {
        return 'No paid revenue observations are available for the selected filters. The supplied data is therefore insufficient to identify a revenue trend, concentration, or operational condition.';
    }
    if ($facts['count'] === 1) {
        return sprintf(
            'The only revenue observation is %s in %s. A single observation cannot establish a trend, comparison, concentration, or volatility pattern.',
            analyticsAiFormatPhpAmount($facts['first']['value']),
            $facts['first']['label']
        );
    }

    return sprintf(
        'Across %d observations, revenue totals %s and ranges from %s in %s to %s in %s. %s %s',
        $facts['count'],
        analyticsAiFormatPhpAmount($facts['total']),
        analyticsAiFormatPhpAmount($facts['min']['value']),
        $facts['min']['label'],
        analyticsAiFormatPhpAmount($facts['max']['value']),
        $facts['max']['label'],
        analyticsAiBuildSeriesChangeSentence($facts, 'revenue', 'analyticsAiFormatPhpAmount'),
        analyticsAiBuildConcentrationSentence($facts, 'revenue')
    );
}

function analyticsAiBuildEventDistributionSentence(array $patterns, float $average): string
{
    $eventCount = max(0, (int)($patterns['eventCount'] ?? 0));
    if ($eventCount === 0) {
        return 'No event-distribution aggregates are available for additional participation analysis.';
    }

    $median = (float)($patterns['medianAttendance'] ?? 0);
    $zeroEvents = max(0, (int)($patterns['zeroAttendanceEvents'] ?? 0));
    $aboveAverage = max(0, (int)($patterns['aboveAverageEvents'] ?? 0));
    $variation = max(0, (float)($patterns['coefficientOfVariation'] ?? 0));
    $comparison = abs($average - $median) <= max($average, 1) * 0.1
        ? 'the mean and median are similar'
        : ($average > $median
            ? 'higher-turnout events raise the mean above the typical event'
            : 'lower-turnout events pull the mean below the median event');

    return sprintf(
        'Median attendance is %.1f compared with a %.1f average, so %s; relative dispersion is %s, %d of %d events are above average, and %d recorded zero attendance.',
        $median,
        $average,
        $comparison,
        analyticsAiFormatPercent($variation),
        $aboveAverage,
        $eventCount,
        $zeroEvents
    );
}

function analyticsAiBuildRentalFrequencySentence(array $patterns): string
{
    $recordCount = max(0, (int)($patterns['rentalRecords'] ?? 0));
    $observedItems = max(0, (int)($patterns['observedItems'] ?? 0));
    $most = is_array($patterns['mostRented'] ?? null) ? $patterns['mostRented'] : [];
    $least = is_array($patterns['leastRented'] ?? null) ? $patterns['leastRented'] : [];

    if ($recordCount === 0 || $observedItems === 0 || !$most) {
        return 'No item-frequency observations are available, so most- and least-rented items cannot be identified.';
    }

    $formatRows = static function (array $rows): string {
        $labels = [];
        foreach ($rows as $row) {
            $name = mb_substr(analyticsAiCleanInsightText((string)($row['name'] ?? 'Item')), 0, 100);
            $labels[] = sprintf('%s (%d rental record%s)', $name, max(0, (int)($row['count'] ?? 0)), (int)($row['count'] ?? 0) === 1 ? '' : 's');
        }
        return implode(', ', $labels);
    };

    if ($observedItems === 1) {
        return sprintf(
            '%s is the only item appearing across %d selected rental record%s, so a most-versus-least comparison is not possible.',
            $formatRows($most),
            $recordCount,
            $recordCount === 1 ? '' : 's'
        );
    }

    $mostTieCount = max(count($most), (int)($patterns['mostRentedTieCount'] ?? 0));
    $leastTieCount = max(count($least), (int)($patterns['leastRentedTieCount'] ?? 0));
    $mostText = $formatRows($most) . ($mostTieCount > count($most) ? sprintf(' and %d other tied item(s)', $mostTieCount - count($most)) : '');
    $leastText = $formatRows($least) . ($leastTieCount > count($least) ? sprintf(' and %d other tied item(s)', $leastTieCount - count($least)) : '');

    return sprintf(
        'Among %d observed items across %d rental records, the most rented is %s, while the least rented among items with at least one rental is %s.',
        $observedItems,
        $recordCount,
        $mostText,
        $leastText
    );
}

function analyticsAiBuildRejectionReasonSentence(array $patterns): string
{
    $rejected = max(0, (int)($patterns['rejectedDocuments'] ?? 0));
    $withNotes = max(0, (int)($patterns['rejectedWithNotes'] ?? 0));
    $categories = is_array($patterns['categories'] ?? null) ? $patterns['categories'] : [];

    if ($rejected === 0) {
        return 'No rejected documents are recorded, so no rejection-reason pattern can be identified.';
    }
    if ($withNotes === 0 || !$categories) {
        return sprintf(
            '%d rejected %s recorded, but no usable reviewer notes are available to identify a common rejection reason.',
            $rejected,
            $rejected === 1 ? 'document is' : 'documents are'
        );
    }
    if ($withNotes < 2) {
        return 'Only one rejected document has a usable reviewer note, which is insufficient to call any reason common.';
    }

    $topCount = max(0, (int)($categories[0]['count'] ?? 0));
    $topCategories = array_values(array_filter($categories, static fn ($category) => (int)($category['count'] ?? 0) === $topCount));
    $labels = array_map(
        static fn ($category) => mb_substr(analyticsAiCleanInsightText((string)($category['label'] ?? 'Uncategorized reason')), 0, 100),
        $topCategories
    );
    $labelText = implode(' and ', $labels);
    $tieText = count($labels) > 1 ? ' are tied as the most frequent categories' : ' is the most frequent category';

    return sprintf(
        '%s%s, appearing in %d of %d rejected documents with usable notes (%s); categories may overlap when one note contains multiple issues.',
        $labelText,
        $tieText,
        $topCount,
        $withNotes,
        analyticsAiFormatPercent(($topCount / $withNotes) * 100)
    );
}

function analyticsAiBuildBalanceFrequencySentence(array $patterns): string
{
    $transactions = max(0, (int)($patterns['transactions'] ?? 0));
    $outstanding = max(0, (int)($patterns['outstandingTransactions'] ?? 0));
    $amount = max(0, (float)($patterns['outstandingAmount'] ?? 0));
    $customers = max(0, (int)($patterns['identifiedCustomers'] ?? 0));
    $customersWithBalance = max(0, (int)($patterns['customersWithOutstanding'] ?? 0));
    $repeatCustomers = max(0, (int)($patterns['repeatOutstandingCustomers'] ?? 0));

    if ($transactions === 0) {
        return 'No transactions are available to measure remaining-balance frequency.';
    }
    if ($outstanding === 0) {
        return sprintf('No positive outstanding balances appear across %d selected transactions.', $transactions);
    }
    if ($customers === 0) {
        return sprintf(
            '%d of %d transactions have a remaining balance (%s), totaling %s, but customer identifiers are unavailable for a student-level frequency calculation.',
            $outstanding,
            $transactions,
            analyticsAiFormatPercent(($outstanding / $transactions) * 100),
            analyticsAiFormatPhpAmount($amount)
        );
    }

    return sprintf(
        '%d of %d transactions have a remaining balance (%s), totaling %s; %d of %d identified students/customers are affected (%s), including %d with balances on at least two transactions.',
        $outstanding,
        $transactions,
        analyticsAiFormatPercent(($outstanding / $transactions) * 100),
        analyticsAiFormatPhpAmount($amount),
        $customersWithBalance,
        $customers,
        analyticsAiFormatPercent(($customersWithBalance / $customers) * 100),
        $repeatCustomers
    );
}

function analyticsAiBuildParticipationChartSummary(array $facts, string $retention, array $eventPatterns = []): string
{
    if (($facts['count'] ?? 0) === 0) {
        return 'No event participation observations are available for the selected filters. The supplied data cannot support a turnout comparison, concentration finding, or retention interpretation.';
    }

    $retentionText = trim($retention) !== ''
        ? 'The supplied retention classification is ' . strtolower(trim($retention)) . '.'
        : 'No retention classification is available in the supplied data.';
    if ($facts['count'] === 1) {
        return sprintf(
            'The only recorded event is %s with %d participants. A single event does not support a turnout trend or cross-event concentration assessment; %s',
            $facts['first']['label'],
            (int)$facts['first']['value'],
            lcfirst($retentionText)
        );
    }

    return sprintf(
        'Across %d events, attendance totals %d and averages %.1f, ranging from %d at %s to %d at %s. %s %s',
        $facts['count'],
        (int)$facts['total'],
        $facts['average'],
        (int)$facts['min']['value'],
        $facts['min']['label'],
        (int)$facts['max']['value'],
        $facts['max']['label'],
        analyticsAiBuildEventDistributionSentence($eventPatterns, (float)$facts['average']),
        rtrim($retentionText, '.') . '; ' . lcfirst(analyticsAiBuildConcentrationSentence($facts, 'attendance'))
    );
}

function analyticsAiBuildRentalChartSummary(array $counts, array $frequencyPatterns = []): string
{
    $total = array_sum($counts);
    if ($total === 0) {
        return 'No active, pending, or overdue rentals are recorded for the selected filters. '
            . analyticsAiBuildRentalFrequencySentence($frequencyPatterns) . ' '
            . 'The status data therefore shows no current open-rental workload or backlog.';
    }

    $active = $counts['active'];
    $pending = $counts['pending'];
    $overdue = $counts['overdue'];
    $riskSentence = $overdue > 0
        ? sprintf('%d overdue rentals represent %s of records, indicating items that remain beyond their recorded due status.', $overdue, analyticsAiCountShare($overdue, $total))
        : 'No overdue rentals are recorded, so the supplied statuses show no overdue-item backlog.';
    $queueSentence = $pending > 0
        ? sprintf('%d pending requests account for %s of records, representing work that has not yet moved into active rental status.', $pending, analyticsAiCountShare($pending, $total))
        : 'No pending requests are recorded, so the supplied statuses show no request queue.';

    return sprintf(
        'Of %d open rental records, %d are active (%s), %d are pending (%s), and %d are overdue (%s). %s %s',
        $total,
        $active,
        analyticsAiCountShare($active, $total),
        $pending,
        analyticsAiCountShare($pending, $total),
        $overdue,
        analyticsAiCountShare($overdue, $total),
        analyticsAiBuildRentalFrequencySentence($frequencyPatterns),
        rtrim($riskSentence, '.') . '; ' . lcfirst($queueSentence)
    );
}

function analyticsAiBuildDocumentChartSummary(array $counts, array $rejectionPatterns = []): string
{
    $total = array_sum($counts);
    if ($total === 0) {
        return 'No approved, pending, or rejected documents are recorded for the selected filters. The supplied data therefore cannot establish workflow throughput, backlog, or rejection conditions.';
    }

    $approved = $counts['approved'];
    $pending = $counts['pending'];
    $rejected = $counts['rejected'];
    $rejectionPatterns += ['rejectedDocuments' => $rejected];
    $pendingSentence = $pending > 0
        ? sprintf('%d pending documents form %s of the workflow and remain awaiting a final status.', $pending, analyticsAiCountShare($pending, $total))
        : 'No pending documents are recorded, so the supplied statuses show no review backlog.';
    $rejectedSentence = $rejected > 0
        ? sprintf('%d rejected documents represent %s of submissions, showing the share that did not reach approval.', $rejected, analyticsAiCountShare($rejected, $total))
        : 'No rejected documents are recorded in the selected workflow.';

    return sprintf(
        'Of %d documents, %d are approved (%s), %d are pending (%s), and %d are rejected (%s). %s %s',
        $total,
        $approved,
        analyticsAiCountShare($approved, $total),
        $pending,
        analyticsAiCountShare($pending, $total),
        $rejected,
        analyticsAiCountShare($rejected, $total),
        analyticsAiBuildRejectionReasonSentence($rejectionPatterns),
        rtrim($pendingSentence, '.') . '; ' . lcfirst($rejectedSentence)
    );
}

function analyticsAiBuildRevenueExportSection(array $facts): string
{
    if (($facts['count'] ?? 0) === 0) {
        return 'The revenue series contains no paid revenue observations for the selected filters. No peak, low point, direction, or concentration can be calculated. The absence of observations is insufficient evidence of either financial improvement or decline.';
    }
    if ($facts['count'] === 1) {
        return sprintf(
            'The revenue series contains one observation: %s in %s. This value establishes the recorded amount for that observation but provides no comparison point. A trend, volatility level, and concentration pattern cannot be determined from one value.',
            analyticsAiFormatPhpAmount($facts['first']['value']),
            $facts['first']['label']
        );
    }

    return sprintf(
        'The revenue series contains %d observations totaling %s, with an average of %s per observation. The highest amount is %s in %s, while the lowest is %s in %s, a spread of %s. %s %s',
        $facts['count'],
        analyticsAiFormatPhpAmount($facts['total']),
        analyticsAiFormatPhpAmount($facts['average']),
        analyticsAiFormatPhpAmount($facts['max']['value']),
        $facts['max']['label'],
        analyticsAiFormatPhpAmount($facts['min']['value']),
        $facts['min']['label'],
        analyticsAiFormatPhpAmount($facts['range']),
        analyticsAiBuildSeriesChangeSentence($facts, 'revenue', 'analyticsAiFormatPhpAmount'),
        analyticsAiBuildConcentrationSentence($facts, 'revenue')
    );
}

function analyticsAiBuildParticipationExportSection(array $facts, string $retention, array $eventPatterns = []): string
{
    if (($facts['count'] ?? 0) === 0) {
        return 'The event participation table contains no event observations for the selected filters. No peak, low point, average, change, or concentration can be calculated. The supplied data is insufficient to characterize participation performance.';
    }
    if ($facts['count'] === 1) {
        return sprintf(
            'The participation table contains one event, %s, with %d participants. That observation establishes turnout for the event but provides no basis for comparison across activities. A trend or concentration pattern cannot be determined from one event.',
            $facts['first']['label'],
            (int)$facts['first']['value']
        );
    }

    $retentionSentence = trim($retention) !== ''
        ? 'The supplied retention classification is ' . strtolower(trim($retention)) . '; it is reported as a separate participation condition and does not establish a cause for the turnout differences.'
        : 'No retention classification is supplied, so the section does not infer one from event totals alone.';

    return sprintf(
        'The participation table contains %d events with %d total participants and an average turnout of %.1f. Attendance peaks at %d for %s and reaches its lowest point at %d for %s, a difference of %d participants. %s %s %s',
        $facts['count'],
        (int)$facts['total'],
        $facts['average'],
        (int)$facts['max']['value'],
        $facts['max']['label'],
        (int)$facts['min']['value'],
        $facts['min']['label'],
        (int)$facts['range'],
        analyticsAiBuildConcentrationSentence($facts, 'attendance'),
        analyticsAiBuildEventDistributionSentence($eventPatterns, (float)$facts['average']),
        $retentionSentence
    );
}

function analyticsAiBuildTransactionExportSection(array $counts, float $paidRevenue, array $balancePatterns = []): string
{
    $total = max($counts['total'], $counts['paid'] + $counts['waived'] + $counts['outstanding']);
    if ($total === 0) {
        return 'The financial transaction aggregates contain no records for the selected filters. No payment-completion rate or outstanding-record share can be calculated. The supplied data is insufficient to evaluate the transaction pipeline.';
    }

    $paid = min($counts['paid'], $total);
    $waived = min($counts['waived'], max($total - $paid, 0));
    $outstanding = min($counts['outstanding'], max($total - $paid - $waived, 0));
    $completionRate = analyticsAiCountShare($paid, $total);
    $outstandingRate = analyticsAiCountShare($outstanding, $total);
    $balancePatterns += [
        'transactions' => $total,
        'outstandingTransactions' => $outstanding,
        'outstandingAmount' => 0,
        'identifiedCustomers' => 0,
        'customersWithOutstanding' => 0,
        'repeatOutstandingCustomers' => 0,
    ];
    $condition = $outstanding > 0
        ? sprintf('%d outstanding records (%s) have not reached paid status, forming the observable collection backlog.', $outstanding, $outstandingRate)
        : 'All supplied transaction records have paid status, so no outstanding collection backlog is visible.';

    return sprintf(
        'The transaction aggregates contain %d records: %d paid, %d waived, and %d with a positive outstanding balance. Paid records represent %s of transactions and account for %s in recorded paid revenue. %s %s The analysis uses payment status and full unpaid transaction cost as the remaining balance because partial-payment amounts are not recorded in the supplied data.',
        $total,
        $paid,
        $waived,
        $outstanding,
        $completionRate,
        analyticsAiFormatPhpAmount($paidRevenue),
        $condition,
        analyticsAiBuildBalanceFrequencySentence($balancePatterns)
    );
}

function analyticsAiBuildRentalExportSection(array $counts, array $frequencyPatterns = []): string
{
    $total = array_sum($counts);
    if ($total === 0) {
        return 'The selected rental history contains no currently active, pending, or overdue entries. '
            . analyticsAiBuildRentalFrequencySentence($frequencyPatterns) . ' '
            . 'No open-rental utilization mix, request queue, or overdue backlog can be calculated from the status counts.';
    }

    return sprintf(
        'The open-rental status counts contain %d entries: %d active, %d pending, and %d overdue. Active rentals represent %s of open records and describe the current in-use share. Pending requests account for %s and remain outside active status. Overdue rentals account for %s and represent the portion still recorded beyond the expected return status. %s',
        $total,
        $counts['active'],
        $counts['pending'],
        $counts['overdue'],
        analyticsAiCountShare($counts['active'], $total),
        analyticsAiCountShare($counts['pending'], $total),
        analyticsAiCountShare($counts['overdue'], $total),
        analyticsAiBuildRentalFrequencySentence($frequencyPatterns)
    );
}

function analyticsAiBuildDocumentExportSection(array $counts, array $rejectionPatterns = []): string
{
    $total = array_sum($counts);
    if ($total === 0) {
        return 'The document workflow contains no approved, pending, or rejected entries for the selected filters. No approval share, review backlog, or rejection share can be calculated. The supplied data is insufficient to characterize workflow performance.';
    }

    $rejectionPatterns += ['rejectedDocuments' => $counts['rejected']];

    return sprintf(
        'The document workflow contains %d submissions: %d approved, %d pending, and %d rejected. Approved documents represent %s of the workflow and are the completed positive outcomes recorded in the supplied statuses. Pending documents account for %s and form the observable review backlog. Rejected documents account for %s and show the portion that did not reach approval. %s',
        $total,
        $counts['approved'],
        $counts['pending'],
        $counts['rejected'],
        analyticsAiCountShare($counts['approved'], $total),
        analyticsAiCountShare($counts['pending'], $total),
        analyticsAiCountShare($counts['rejected'], $total),
        analyticsAiBuildRejectionReasonSentence($rejectionPatterns)
    );
}

function analyticsAiBuildRevenueOverviewSentence(array $facts): string
{
    if (($facts['count'] ?? 0) === 0) {
        return 'No paid revenue observations are available.';
    }
    return sprintf(
        'Recorded revenue totals %s across %d observation%s.',
        analyticsAiFormatPhpAmount($facts['total']),
        $facts['count'],
        $facts['count'] === 1 ? '' : 's'
    );
}

function analyticsAiBuildParticipationOverviewSentence(array $facts): string
{
    if (($facts['count'] ?? 0) === 0) {
        return 'No event participation observations are available.';
    }
    return sprintf('Participation totals %d across %d event%s.', (int)$facts['total'], $facts['count'], $facts['count'] === 1 ? '' : 's');
}

function analyticsAiBuildRentalOverviewSentence(array $counts): string
{
    return sprintf('Rental status totals are %d active, %d pending, and %d overdue.', $counts['active'], $counts['pending'], $counts['overdue']);
}

function analyticsAiBuildDocumentOverviewSentence(array $counts): string
{
    return sprintf('Document status totals are %d approved, %d pending, and %d rejected.', $counts['approved'], $counts['pending'], $counts['rejected']);
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

function analyticsAiStructureInsightLines(string $text): string
{
    $cleaned = analyticsAiCleanInsightText($text);
    if ($cleaned === '') {
        return '';
    }

    $existingLines = array_values(array_filter(array_map('trim', explode("\n", $cleaned))));
    if (count($existingLines) > 1) {
        return implode("\n", array_map(
            static fn ($line) => '- ' . preg_replace('/^(?:[-*•]\s*)+/u', '', $line),
            $existingLines
        ));
    }

    $sentences = preg_split('/(?<=[.!?])\s+(?=[A-Z0-9])/u', $cleaned, -1, PREG_SPLIT_NO_EMPTY);
    if (!is_array($sentences) || !$sentences) {
        return '- ' . preg_replace('/^(?:[-*•]\s*)+/u', '', $cleaned);
    }

    return implode("\n", array_map(
        static fn ($sentence) => '- ' . preg_replace('/^(?:[-*•]\s*)+/u', '', trim($sentence)),
        $sentences
    ));
}
