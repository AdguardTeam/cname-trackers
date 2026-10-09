const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { getCompanyTypes, combineData } = require('../src/combine');
const { writePartialOutputs } = require('../src/company-outputs');

test('getCompanyTypes pluralizes and deduplicates tracker types', () => {
    const trackers = [
        { company_name: 'A', type: 'tracker' },
        { company_name: 'B', type: 'tracker' },
        { company_name: 'C', type: 'ad' },
        { company_name: 'D', type: 'mail_tracker' },
    ];
    assert.deepStrictEqual(getCompanyTypes(trackers), ['trackers', 'ads', 'mail_trackers']);
});

test('combineData merges split company parts and rebuilds combined files', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cname-trackers-combine-'));
    const typeDir = path.join(dataDir, 'mail_trackers');
    await fs.mkdir(typeDir, { recursive: true });

    await writePartialOutputs({
        dataDirPath: dataDir,
        companyTypePlural: 'mail_trackers',
        companyFileName: 'mailgun',
        bucketIndex: 0,
        bucketCount: 2,
        mergedPairs: [{ disguise: 'a.example', tracker: 'mailgun.org' }],
        stashedInfo: { 'a.example': 'final-a.example' },
    });
    await writePartialOutputs({
        dataDirPath: dataDir,
        companyTypePlural: 'mail_trackers',
        companyFileName: 'mailgun',
        bucketIndex: 1,
        bucketCount: 2,
        mergedPairs: [{ disguise: 'b.example', tracker: 'mailgun.org' }],
        stashedInfo: { 'b.example': 'final-b.example' },
    });

    const trackers = [{ company_name: 'Mailgun', type: 'mail_tracker', domains: ['mailgun.org'] }];
    await combineData(trackers, dataDir);

    const canonical = JSON.parse(await fs.readFile(path.join(typeDir, 'mailgun.json'), 'utf8'));
    assert.deepStrictEqual(canonical, {
        'a.example': 'final-a.example',
        'b.example': 'final-b.example',
    });
    await assert.doesNotReject(fs.stat(path.join(typeDir, 'mailgun.md')));

    const combined = JSON.parse(
        await fs.readFile(path.join(dataDir, 'combined_disguised_mail_trackers.json'), 'utf8'),
    );
    assert.deepStrictEqual(combined, canonical);

    // updateCombinedOriginals must honor the passed data dir (no repo writes).
    await assert.doesNotReject(fs.stat(path.join(dataDir, 'combined_original_trackers.txt')));

    const remaining = await fs.readdir(typeDir);
    assert.ok(remaining.every((file) => !file.includes('__part-')));

    await fs.rm(dataDir, { recursive: true, force: true });
});

test('combineData prunes per-company files that are no longer in the config', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cname-trackers-combine-'));
    const adsDir = path.join(dataDir, 'ads');
    const trackersDir = path.join(dataDir, 'trackers');
    await fs.mkdir(adsDir, { recursive: true });
    await fs.mkdir(trackersDir, { recursive: true });

    // Stale company from master's data/: removed from cloaked-trackers.json.
    await fs.writeFile(
        path.join(adsDir, 'stale-company.json'),
        JSON.stringify({ 'stale.example': 'final.stale.example' }),
    );
    await fs.writeFile(path.join(adsDir, 'stale-company.md'), 'stale');
    await fs.writeFile(path.join(adsDir, 'stale-company.txt'), '||stale.example^');
    await fs.writeFile(path.join(adsDir, 'stale-company_justdomains.txt'), 'stale.example');
    await fs.writeFile(path.join(adsDir, 'stale-company_rpz.txt'), 'stale.example CNAME .');
    // Stale partial file of a company that no longer exists.
    await fs.writeFile(
        path.join(adsDir, 'stale-company__part-0-of-2.json'),
        JSON.stringify({
            stashedInfo: { 'part.example': 'final.part.example' },
            mergedPairs: [{ disguise: 'part.example', tracker: 'stale.example' }],
        }),
    );

    // Company A moved from `trackers` to `ads`: the ads file is current, the
    // stale trackers copy must be pruned or its rules land in two lists.
    await fs.writeFile(
        path.join(adsDir, 'company-a.json'),
        JSON.stringify({ 'a.example': 'final-a.example' }),
    );
    await fs.writeFile(
        path.join(trackersDir, 'company-a.json'),
        JSON.stringify({ 'a.example': 'final-a.example' }),
    );
    await fs.writeFile(
        path.join(trackersDir, 'company-b.json'),
        JSON.stringify({ 'b.example': 'final-b.example' }),
    );

    const trackers = [
        { company_name: 'Company A', type: 'ad', domains: ['a.example'] },
        { company_name: 'Company B', type: 'tracker', domains: ['b.example'] },
    ];
    await combineData(trackers, dataDir);

    assert.deepStrictEqual((await fs.readdir(adsDir)).sort(), ['company-a.json']);
    assert.deepStrictEqual((await fs.readdir(trackersDir)).sort(), ['company-b.json']);

    const combinedAds = JSON.parse(
        await fs.readFile(path.join(dataDir, 'combined_disguised_ads.json'), 'utf8'),
    );
    assert.deepStrictEqual(combinedAds, { 'a.example': 'final-a.example' });

    const combinedTrackers = JSON.parse(
        await fs.readFile(path.join(dataDir, 'combined_disguised_trackers.json'), 'utf8'),
    );
    assert.deepStrictEqual(combinedTrackers, { 'b.example': 'final-b.example' });

    await fs.rm(dataDir, { recursive: true, force: true });
});

test('combineData removes whole type directories that are no longer in the config', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cname-trackers-combine-'));
    const adsDir = path.join(dataDir, 'ads');
    const trackersDir = path.join(dataDir, 'trackers');
    await fs.mkdir(adsDir, { recursive: true });
    await fs.mkdir(trackersDir, { recursive: true });

    // The whole `ads` type left the config: its directory and combined files
    // come from master's checked-out data/ and must not be published.
    await fs.writeFile(
        path.join(adsDir, 'stale-company.json'),
        JSON.stringify({ 'stale.example': 'final.stale.example' }),
    );
    await fs.writeFile(
        path.join(dataDir, 'combined_disguised_ads.json'),
        JSON.stringify({ 'stale.example': 'final.stale.example' }),
    );
    await fs.writeFile(path.join(dataDir, 'combined_disguised_ads.txt'), '||stale.example^');
    await fs.writeFile(path.join(dataDir, 'combined_disguised_ads_justdomains.txt'), 'stale.example');
    await fs.writeFile(path.join(dataDir, 'combined_disguised_ads_rpz.txt'), 'stale.example CNAME .');

    await fs.writeFile(
        path.join(trackersDir, 'company-b.json'),
        JSON.stringify({ 'b.example': 'final-b.example' }),
    );

    const trackers = [{ company_name: 'Company B', type: 'tracker', domains: ['b.example'] }];
    await combineData(trackers, dataDir);

    await assert.rejects(fs.stat(adsDir));
    const files = await fs.readdir(dataDir);
    assert.ok(files.every((file) => !file.startsWith('combined_disguised_ads')));
    await assert.doesNotReject(fs.stat(path.join(dataDir, 'combined_disguised_trackers.json')));

    await fs.rm(dataDir, { recursive: true, force: true });
});
