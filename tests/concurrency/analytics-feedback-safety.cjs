const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const c = vm.createContext({ window: {}, document: { addEventListener() {}, getElementById() { return null; } },
    console, Map, Date, setTimeout });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/officerAnalytics.js'), 'utf8'), c);
const run = source => vm.runInContext(source, c);

(async () => {
    c.docs = [
        { submission_id: 1, rawStatus: 'approved', reviewerNotes: 'The objectives are clear.' },
        { submission_id: 2, rawStatus: 'rejected', reviewerNotes: 'Missing attachments.' },
        ...['adviser_approved', 'ssc_approved', 'approval_queued', 'pending', 'sent_to_osa', 'cancelled'].map((status, i) =>
            ({ submission_id: i + 3, rawStatus: status, reviewerNotes: 'The objectives are clear.' })),
    ];
    const feedback = run('buildOfficerDocumentAiFeedback(docs)');
    assert.deepEqual(Array.from(feedback.records, record => record.status), ['approved', 'rejected']);
    const praise = run('buildOfficerDocumentPositivePatterns(docs)');
    assert.equal(praise.approvedDocuments, 1);
    assert.equal(praise.documentsWithPositiveFeedback, 1);
    const fetched = [];
    let refreshes = 0;
    c.refreshAnalyticsCharts = () => { refreshes++; };
    c.fetch = async url => {
        fetched.push(Number(new URL(url, 'https://example.test/').searchParams.get('submission_id')));
        return { ok: true, json: async () => ({ ok: true, items: [] }) };
    };
    await run('loadAnalyticsReviewAnnotations(docs)');
    assert.deepEqual(fetched.sort(), [1, 2]);
    assert.equal(refreshes, 1);

    c.docs = [{ rawStatus: 'rejected', submittedByName: 'Demo Student', adviserReviewerName: 'Example Adviser',
        reviewAnnotations: [{ author_account_type: 'osa_staff', first_name: 'Alice', last_name: 'Reviewer',
            comment_text: 'Alice Reviewer requested attachments from Demo Student. Example Adviser checked the dates.' }] }];
    const original = c.docs[0].reviewAnnotations[0].comment_text;
    const roleFeedback = run('buildOfficerDocumentAiFeedback(docs)');
    const roleText = roleFeedback.records[0].comments[0].text;
    for (const name of ['Alice', 'Reviewer', 'Demo Student', 'Example Adviser']) assert(!roleText.includes(name));
    for (const role of ['the reviewer', 'the student', 'the adviser']) assert(roleText.includes(role));
    assert.equal(c.docs[0].reviewAnnotations[0].comment_text, original);
    c.recordSnapshot = { docs: c.docs, counts: { docs: { rejected: 1, approved: 0, pending: 0 } } };
    const originalSection = run('getOfficerDocumentReportSections(recordSnapshot).find(section => section.title === "Reviewer Comments and Annotations")');
    assert.equal(originalSection.body[0][2], original);

    for (const [name, surname, wording] of [
        ['Jo', 'Li', 'Jo reviewed this. Please ask Li about the missing attachments.'],
        ['May', 'Santos', 'Reviewed by May. Feedback from May: missing attachments. May has asked for clearer objectives.'],
        ['Jo', 'Li', 'Tell our Jo to attach the missing receipts.'],
        ['May', 'Santos', 'These notes are for May: complete the attachments.'],
        ['Kai', 'Ng', 'Ng: Please revise the objectives.'],
        ['Mark', 'Santos', 'Mark signed documents with a check. Mark reviewed sections before resubmitting.'],
        ['Bill', 'Santos', 'The bill does not match the quotation.'],
        ['Summer', 'Santos', 'The summer schedule does not match the proposed dates.'],
    ]) {
        c.docs = [{ rawStatus: 'rejected', reviewAnnotations: [{ author_account_type: 'osa_staff',
            first_name: name, last_name: surname, comment_text: wording }] }];
        const privateFeedback = run('buildOfficerDocumentAiFeedback(docs)');
        assert.equal(privateFeedback.records.length, 0, wording);
        assert.equal(privateFeedback.truncatedComments, 1);
        assert.equal(c.docs[0].reviewAnnotations[0].comment_text, wording);
    }
    for (const wording of ['John Doe requested revisions.', 'Ask Juan about the attachments.', 'Juan reviewed this.']) {
        c.docs = [{ rawStatus: 'rejected', reviewerNotes: wording }];
        assert.equal(run('buildOfficerDocumentAiFeedback(docs).records.length'), 0);
    }
    c.docs = [{ rawStatus: 'rejected', reviewerNotes: 'May kulang na attachments. Please explain the objectives. The budget may be incorrect.' }];
    assert.equal(run('buildOfficerDocumentAiFeedback(docs).records[0].comments[0].text'), c.docs[0].reviewerNotes);
    const accentedName = '\u00c1lvaro Santos';
    c.docs = [{ rawStatus: 'rejected', submittedByName: accentedName,
        reviewerNotes: accentedName.normalize('NFD') + ' must attach supporting files.' }];
    const unicodeText = run('buildOfficerDocumentAiFeedback(docs).records[0].comments[0].text');
    assert.equal(unicodeText, 'the student must attach supporting files.');

    for (const instruction of ['Ask for clarification about the missing requirements.', 'Contact your adviser before resubmitting.',
        'Consult with the reviewer about the unclear feedback.', 'The reviewed documents need clearer objectives.',
        'Students reviewed the checklist before submitting.']) {
        c.docs = [{status: 'rejected', reviewerNotes: instruction}];
        assert.equal(run('hasOfficerAnalyticsPersonReference(docs[0].reviewerNotes)'), false, instruction);
        assert.equal(run('buildOfficerDocumentAiFeedback(docs).records[0].comments[0].text'), instruction);
    }
    for (const formattedName of ['John <b>Doe</b> requested revisions.', 'Ask <b>Juan</b> about the attachments.',
        'John&nbsp;Doe requested revisions.', '\u00c1lvaro D\u00edaz requested revisions.']) {
        c.docs = [{status: 'rejected', reviewerNotes: formattedName}];
        assert.equal(run('buildOfficerDocumentAiFeedback(docs).records.length'), 0, formattedName);
    }
    const literalMarker = String.fromCharCode(0xe000) + '999' + String.fromCharCode(0xe001);
    c.docs = [{status: 'rejected', reviewerNotes: 'Missing attachments. ' + literalMarker}];
    assert.equal(run('buildOfficerDocumentAiFeedback(docs).records[0].comments[0].text'), c.docs[0].reviewerNotes);
    c.docs = [{status: 'rejected', submittedByName: 'Sue Ann', reviewerNotes: '\u017fue Ann must attach the receipts. ' + literalMarker}];
    assert.equal(run('buildOfficerDocumentAiFeedback(docs).records[0].comments[0].text'), 'the student must attach the receipts. ' + literalMarker);
    c.docs = [{status: 'rejected', submittedByName: 'Sue Ann', adviserReviewerName: 'SUE ANN', reviewerNotes: 'Sue Ann requested missing attachments.'}];
    assert.equal(run('buildOfficerDocumentAiFeedback(docs).records[0].comments[0].text'), 'the person requested missing attachments.');

    c.docs = [{ rawStatus: 'rejected', reviewerNotes: 'a'.repeat(999) + String.fromCodePoint(0x1f600) + ' end' }];
    const emojiFeedback = run('buildOfficerDocumentAiFeedback(docs)');
    const shortened = emojiFeedback.records[0].comments[0].text;
    assert.equal(Array.from(shortened).length, 1000);
    assert(shortened.endsWith(String.fromCodePoint(0x1f600)));
    assert.equal(emojiFeedback.truncatedComments, 1);
    c.docs[0].reviewerNotes = String.fromCodePoint(0x1f600).repeat(1000);
    assert.equal(run('buildOfficerDocumentAiFeedback(docs).truncatedComments'), 0);
    const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:\\xampp\\php\\php.exe' : 'php');
    const privacyCases = ['Ask for clarification.', 'Contact your adviser.', 'Consult with the reviewer.',
        'Ask the reviewer to clarify the attachments.', 'The reviewed documents need more detail.',
        'Students reviewed the checklist.', 'John <b>Doe</b> requested revisions.', 'Ask <b>Juan</b> about the dates.',
        'John&nbsp;Doe requested revisions.', 'John&#160;Doe requested revisions.', '\u00c1lvaro D\u00edaz requested revisions.',
        '\u00c1lvaro D\u00edaz'.normalize('NFD') + ' requested revisions.', 'Ask Juan about the dates.'];
    c.privacyCases = privacyCases;
    const browserChecks = Array.from(run('privacyCases.map(hasOfficerAnalyticsPersonReference)'));
    const serverChecks = spawnSync(php, ['-r',
        "ini_set('session.save_path', sys_get_temp_dir()); require 'includes/analytics_ai.php'; "
        + "$cases = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR); "
        + "echo json_encode(array_map('analyticsAiHasPersonReference', $cases), JSON_THROW_ON_ERROR);"],
        {cwd: root, input: JSON.stringify(privacyCases), encoding: 'utf8'});
    assert.equal(serverChecks.status, 0, serverChecks.stderr || serverChecks.error?.message);
    assert.deepEqual(JSON.parse(serverChecks.stdout), browserChecks, 'Browser and server privacy rules disagree.');
    const decoded = spawnSync(php, ['-r',
        "ini_set('session.save_path', sys_get_temp_dir()); require 'includes/analytics_ai.php'; "
        + "$feedback = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR); "
        + "echo json_encode(analyticsAiSanitizeDocumentFeedback($feedback), JSON_THROW_ON_ERROR);"],
        { cwd: root, input: JSON.stringify(emojiFeedback), encoding: 'utf8' });
    assert.equal(decoded.status, 0, decoded.stderr || decoded.error?.message);
    assert.equal(JSON.parse(decoded.stdout).records[0].comments[0].text, shortened);

    c.snapshot = { docs: [
        { status: 'approved', reviewerNotes: 'The objectives are clear.', reviewAnnotationsUnavailable: true },
        { status: 'rejected', reviewerNotes: 'Missing attachments.', reviewAnnotationsUnavailable: true },
    ], counts: { docs: { approved: 1, pending: 0, rejected: 1 } } };
    c.ai = { provider: 'gemini:test', fallbackUsed: false,
        documentAnalysis: { rejectionCategories: [], positivePractices: [], reviewedRejectedDocuments: 1,
            reviewedApprovedDocuments: 1, omittedDocuments: 0, truncatedComments: 0 },
        documentGuidance: { rejectionSummary: 'Missing attachments were recorded.', keepDoing: 'Clear objectives were praised.', reviewChecks: {} },
        exportSections: { documentWorkflow: 'One document is approved and one is rejected.' } };
    const coverage = run('getOfficerDocumentReportSections(snapshot, ai)[1].description');
    assert(coverage.includes('2 documents could not load annotations.'));
    c.snapshot.documentFeedback = run('buildOfficerDocumentAiFeedback(snapshot.docs)');
    assert(run('getOfficerDocumentReportSections(snapshot, ai)[1].description').includes('2 documents could not load annotations.'));

    console.log('Final approval status, annotation author privacy, Unicode names, emoji JSON compatibility, and combined annotation coverage passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
