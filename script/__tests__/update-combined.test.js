const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { updateCombinedDisguises } = require('../src/update-combined');

const newTempDataDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'cname-trackers-test-'));

test('updateCombinedDisguises reads per-company JSON from disk and writes combined files', async () => {
    const dataDir = await newTempDataDir();
    const typeDir = path.join(dataDir, 'ads');
    await fs.mkdir(typeDir, { recursive: true });

    // Two per-company JSON files, exactly as index.js writes them during the run.
    await fs.writeFile(
        path.join(typeDir, 'company-a.json'),
        JSON.stringify({
            'track.a.example': 'final.a.example',
            'shared.example': 'from-a',
        }, null, 2),
    );
    await fs.writeFile(
        path.join(typeDir, 'company-b.json'),
        JSON.stringify({
            'track.b.example': 'final.b.example',
            'shared.example': 'from-b',
        }, null, 2),
    );

    // IMPORTANT: no in-memory data object is passed — the data must come from disk.
    await updateCombinedDisguises(['ads'], dataDir);

    // Combined JSON: merged + alphabetically sorted disguise keys.
    const combinedJson = JSON.parse(
        await fs.readFile(path.join(dataDir, 'combined_disguised_ads.json'), 'utf8'),
    );
    assert.deepStrictEqual(
        Object.keys(combinedJson),
        ['shared.example', 'track.a.example', 'track.b.example'],
    );
    assert.strictEqual(combinedJson['track.a.example'], 'final.a.example');
    assert.strictEqual(combinedJson['track.b.example'], 'final.b.example');

    // Adblock (base) rules: ||domain^
    const baseRules = await fs.readFile(path.join(dataDir, 'combined_disguised_ads.txt'), 'utf8');
    assert.ok(baseRules.includes('||track.a.example^'), 'base rules must include track.a.example');
    assert.ok(baseRules.includes('||track.b.example^'), 'base rules must include track.b.example');

    // Hosts (justdomains) rules: bare domain
    const hostsRules = await fs.readFile(path.join(dataDir, 'combined_disguised_ads_justdomains.txt'), 'utf8');
    assert.ok(hostsRules.includes('track.a.example'), 'hosts rules must include track.a.example');

    // RPZ rules: domain CNAME .
    const rpzRules = await fs.readFile(path.join(dataDir, 'combined_disguised_ads_rpz.txt'), 'utf8');
    assert.ok(rpzRules.includes('track.a.example CNAME .'), 'rpz rules must include track.a.example');

    await fs.rm(dataDir, { recursive: true, force: true });
});

test('updateCombinedDisguises skips a missing type directory without throwing', async () => {
    const dataDir = await newTempDataDir();
    // 'trackers' directory intentionally absent — must not reject.
    await assert.doesNotReject(() => updateCombinedDisguises(['trackers'], dataDir));
    await fs.rm(dataDir, { recursive: true, force: true });
});
