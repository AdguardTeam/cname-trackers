const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const {
    writeCompanyOutputs,
    writePartialOutputs,
    mergePartialOutputs,
} = require('../src/company-outputs');

const newTempDataDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'cname-trackers-outputs-'));

const writeMailgunPart = (dataDirPath, bucketIndex, bucketCount, disguise, stashedCname) => (
    writePartialOutputs({
        dataDirPath,
        companyTypePlural: 'mail_trackers',
        companyFileName: 'mailgun',
        bucketIndex,
        bucketCount,
        mergedPairs: [{ disguise, tracker: 'mailgun.org' }],
        stashedInfo: { [disguise]: stashedCname },
    })
);

test('writeCompanyOutputs writes json, md and three rule files', async () => {
    const dataDirPath = await newTempDataDir();

    await writeCompanyOutputs({
        dataDirPath,
        companyTypePlural: 'ads',
        companyFileName: 'company-a',
        companyName: 'Company A',
        domains: ['a.example'],
        mergedPairs: [{ disguise: 'track.a.example', tracker: 'a.example' }],
        stashedInfo: { 'track.a.example': 'final.a.example' },
    });

    const typeDir = path.join(dataDirPath, 'ads');
    const json = JSON.parse(await fs.readFile(path.join(typeDir, 'company-a.json'), 'utf8'));
    assert.deepStrictEqual(json, { 'track.a.example': 'final.a.example' });
    await assert.doesNotReject(fs.stat(path.join(typeDir, 'company-a.md')));

    const rules = await fs.readFile(path.join(typeDir, 'company-a.txt'), 'utf8');
    assert.ok(rules.includes('||track.a.example^'));
    const hosts = await fs.readFile(path.join(typeDir, 'company-a_justdomains.txt'), 'utf8');
    assert.ok(hosts.includes('track.a.example'));
    const rpz = await fs.readFile(path.join(typeDir, 'company-a_rpz.txt'), 'utf8');
    assert.ok(rpz.includes('track.a.example CNAME .'));

    await fs.rm(dataDirPath, { recursive: true, force: true });
});

test('writePartialOutputs writes one self-contained part file, not canonical files', async () => {
    const dataDirPath = await newTempDataDir();

    await writeMailgunPart(dataDirPath, 1, 4, 'a.example', 'final.example');

    const typeDir = path.join(dataDirPath, 'mail_trackers');
    const part = JSON.parse(
        await fs.readFile(path.join(typeDir, 'mailgun__part-1-of-4.json'), 'utf8'),
    );
    assert.deepStrictEqual(part, {
        stashedInfo: { 'a.example': 'final.example' },
        mergedPairs: [{ disguise: 'a.example', tracker: 'mailgun.org' }],
    });
    await assert.rejects(fs.stat(path.join(typeDir, 'mailgun.json')));

    await fs.rm(dataDirPath, { recursive: true, force: true });
});

test('writePartialOutputs rejects when the merge results are missing', async () => {
    const dataDirPath = await newTempDataDir();

    // mergeDomainsInfo or stashInfoPairs threw: both values stay undefined.
    await assert.rejects(
        writePartialOutputs({
            dataDirPath,
            companyTypePlural: 'mail_trackers',
            companyFileName: 'mailgun',
            bucketIndex: 0,
            bucketCount: 2,
            mergedPairs: undefined,
            stashedInfo: undefined,
        }),
        /Missing merge results for mailgun__part-0-of-2/,
    );

    await fs.rm(dataDirPath, { recursive: true, force: true });
});

test('mergePartialOutputs merges a complete part set and removes the parts', async () => {
    const dataDirPath = await newTempDataDir();
    const typeDir = path.join(dataDirPath, 'mail_trackers');

    await writeMailgunPart(dataDirPath, 0, 2, 'a.example', 'final-a.example');
    await writeMailgunPart(dataDirPath, 1, 2, 'b.example', 'final-b.example');

    const result = await mergePartialOutputs(typeDir, 'mailgun');

    assert.deepStrictEqual(result.stashedInfo, {
        'a.example': 'final-a.example',
        'b.example': 'final-b.example',
    });
    assert.strictEqual(result.mergedPairs.length, 2);
    assert.deepStrictEqual(await fs.readdir(typeDir), []);

    await fs.rm(dataDirPath, { recursive: true, force: true });
});

test('mergePartialOutputs discards an incomplete part set', async () => {
    const dataDirPath = await newTempDataDir();
    const typeDir = path.join(dataDirPath, 'mail_trackers');

    // Bucket 1 of 2 was never written (its shard failed mid-company).
    await writeMailgunPart(dataDirPath, 0, 2, 'a.example', 'final-a.example');

    const result = await mergePartialOutputs(typeDir, 'mailgun');

    assert.strictEqual(result, null);
    assert.deepStrictEqual(await fs.readdir(typeDir), []);

    await fs.rm(dataDirPath, { recursive: true, force: true });
});

test('mergePartialOutputs returns sorted output regardless of part write order', async () => {
    const dataDirPath = await newTempDataDir();
    const typeDir = path.join(dataDirPath, 'mail_trackers');

    // Written out of bucket order: part 1 first, then part 0.
    await writeMailgunPart(dataDirPath, 1, 2, 'a.example', 'final-a.example');
    await writeMailgunPart(dataDirPath, 0, 2, 'z.example', 'final-z.example');

    const result = await mergePartialOutputs(typeDir, 'mailgun');

    assert.deepStrictEqual(Object.keys(result.stashedInfo), ['a.example', 'z.example']);
    assert.deepStrictEqual(
        result.mergedPairs.map(({ disguise }) => disguise),
        ['a.example', 'z.example'],
    );

    await fs.rm(dataDirPath, { recursive: true, force: true });
});

test('mergePartialOutputs skips a missing directory and rethrows other errors', async () => {
    const dataDirPath = await newTempDataDir();

    // Missing type directory (ENOENT) — nothing to merge, not an error.
    assert.strictEqual(await mergePartialOutputs(path.join(dataDirPath, 'ads'), 'mailgun'), null);

    // A file where the type directory is expected (ENOTDIR) must not be swallowed.
    const notADir = path.join(dataDirPath, 'mail_trackers');
    await fs.writeFile(notADir, '');

    await assert.rejects(mergePartialOutputs(notADir, 'mailgun'), { code: 'ENOTDIR' });

    await fs.rm(dataDirPath, { recursive: true, force: true });
});
