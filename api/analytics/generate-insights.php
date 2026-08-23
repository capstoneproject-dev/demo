<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/analytics_ai.php';

apiGuard();
requirePost();

try {
    $ctx = analyticsRequireOfficerOrgContext();
    $body = getRequestBody();

    $snapshot = isset($body['snapshot']) && is_array($body['snapshot']) ? $body['snapshot'] : [];
    $filters = isset($body['filters']) && is_array($body['filters']) ? $body['filters'] : [];
    $forceRefresh = !empty($body['forceRefresh']);

    if (!$snapshot) {
        jsonError('Analytics snapshot is required.', 422);
    }

    $membership = authRequireActiveOrgMembership(false);
    if ((int)($membership['can_manage_org_dashboard'] ?? 0) !== 1) {
        if ($forceRefresh) {
            jsonError('Organization advisers cannot generate analytics insights.', 403, ['error_code' => 'ORG_READ_ONLY']);
        }
        $cached = analyticsAiReadCache(analyticsAiBuildCacheKey($snapshot, $filters, (int)$ctx['org_id']));
        if (!$cached) {
            jsonError('No previously generated insights are available for these filters.', 404, [
                'error_code' => 'INSIGHTS_NOT_AVAILABLE',
            ]);
        }
        jsonOk($cached);
    }

    $result = analyticsAiGenerateInsights($snapshot, $filters, (int)$ctx['org_id'], $forceRefresh);
    jsonOk($result);
} catch (AnalyticsAiAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (AnalyticsAiException $e) {
    jsonError($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[api/analytics/generate-insights] ' . $e->getMessage());
    jsonError('Unable to generate analytics insights.', 500);
}
