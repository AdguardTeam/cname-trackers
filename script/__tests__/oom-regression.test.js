/* eslint-disable no-await-in-loop */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { updateCombinedDisguises } = require('../src/update-combined');

// Scale roughly comparable to a real build: many companies, many disguises each.
const COMPANIES = 20;
const DISGUISES_PER_COMPANY = 3000;
const TOTAL_DISGUISES = COMPANIES * DISGUISES_PER_COMPANY;

const generateLargeDataset = async (dataDir) => {
    const typeDir = path.join(dataDir, 'ads');
    await fs.mkdir(typeDir, { recursive: true });
    for (let i = 0; i < COMPANIES; i += 1) {
        const entries = {};
        for (let j = 0; j < DISGUISES_PER_COMPANY; j += 1) {
            entries[`c${i}d${j}.example.com`] = `final-c${i}d${j}.cdn.example.com`;
        }
        await fs.writeFile(path.join(typeDir, `company-${i}.json`), JSON.stringify(entries));
    }
};

test('combined-file build on a large dataset completes without OOM and is correct', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cname-trackers-bench-'));
    await generateLargeDataset(dataDir);

    const startedAt = Date.now();
    await updateCombinedDisguises(['ads'], dataDir);
    const wallMs = Date.now() - startedAt;

    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMb = Math.round(mem.rss / 1024 / 1024);

    console.log(`BENCHMARK companies=${COMPANIES} disguises/company=${DISGUISES_PER_COMPANY} total=${TOTAL_DISGUISES}`);
    console.log(`BENCHMARK wall=${wallMs}ms heapUsed=${heapUsedMb}MB rss=${rssMb}MB`);

    // Correctness: the combined JSON must contain every disguise, sorted.
    const combined = JSON.parse(
        await fs.readFile(path.join(dataDir, 'combined_disguised_ads.json'), 'utf8'),
    );
    assert.strictEqual(Object.keys(combined).length, TOTAL_DISGUISES);

    const keys = Object.keys(combined);
    assert.deepStrictEqual(keys, [...keys].sort(), 'combined JSON keys must be sorted');

    await fs.rm(dataDir, { recursive: true, force: true });
});
