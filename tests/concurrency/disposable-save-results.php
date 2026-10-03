<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
$controlPath = sys_get_temp_dir() . '/capstone-disposable-control.json';
$control = json_decode(file_get_contents($controlPath), true, 512, JSON_THROW_ON_ERROR);
$testDirectory = realpath($control['directory'] . '/app/tests/concurrency');
$manifestPath = sys_get_temp_dir() . '/capstone-feature-check-' . substr(hash('sha256', $testDirectory), 0, 12) . '.json';
$fixture = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
$browser = json_decode(file_get_contents(sys_get_temp_dir() . '/capstone-browser-results.json'), true, 512, JSON_THROW_ON_ERROR);
$base = array_slice($fixture['results'], 0, 92);
$extra = array_slice($fixture['results'], $fixture['extra_results_start'], $fixture['extra_summary']['checks']);
$admin = array_slice($fixture['results'], $fixture['extra_results_start'] + $fixture['extra_summary']['checks'], $fixture['admin_summary']['checks']);
$guards = array_slice($fixture['results'], -134);
foreach (['base' => $base, 'extra' => $extra, 'administration' => $admin, 'guards' => $guards, 'browser' => $browser] as $name => $results) {
    if (!$results || array_filter($results, fn($result) => empty($result['passed']))) throw new RuntimeException('Final result failure in ' . $name);
}
if (count($guards) !== 134 || count(array_filter($guards, fn($result) => str_starts_with($result['name'], 'Unauthenticated guard '))) !== 133) throw new RuntimeException('Guard result count mismatch.');
if (!empty($control['source_schema_differences']) || empty($control['source_fixture_counts_unchanged'])) throw new RuntimeException('Source isolation verification failed.');
$result = ['date' => '2026-10-03', 'database' => $control['database'], 'deleted' => false, 'workflow_counts' => ['baseline' => count($base), 'expanded' => count($extra), 'administration' => count($admin), 'authorization' => 133, 'browser' => count($browser)], 'base' => $base, 'expanded' => $extra, 'administration' => $admin, 'guards' => $guards, 'browser' => $browser, 'source_diff_details' => $control['source_diff_details'], 'manual_limits' => ['Live email delivery and real OTP flows', 'Physical camera/barcode hardware', 'Every UI modal/filter/export permutation', 'Production load and outages']];
$output = __DIR__ . '/../../md/Database Connection Disposable Test Results.json';
file_put_contents($output, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
$control['tests_passed'] = true;
$control['result_file'] = realpath($output);
$control['fixture_manifest'] = $manifestPath;
$control['fixture_token'] = $fixture['token'];
$control['fixture_uploads'] = [$fixture['pdf'], $fixture['png']];
file_put_contents($controlPath, json_encode($control, JSON_THROW_ON_ERROR));
echo "PASS: Final passing results saved without fixture passwords or cookie values.\n";
