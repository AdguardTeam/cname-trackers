const { test } = require('node:test');
const assert = require('node:assert');

const {
    TARGET_UNIT_WEIGHT,
    bucketOf,
    buildWorkUnits,
    assignUnitsToShards,
    getShardUnits,
    resolveShardCount,
    resolveShardIndex,
    filterOldInfoByBucket,
    filterDomainsInfoByBucket,
} = require('../src/shard');

const makeTracker = (companyName, type = 'tracker') => ({
    company_name: companyName,
    type,
    domains: [`${companyName.toLowerCase()}.example`],
});

const storedEntries = (count) => Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`d${i}.example`, 'final.example']),
);

test('bucketOf is deterministic and stays within range', () => {
    const disguises = ['a.example', 'b.example', 'long-disguise.example'];
    disguises.forEach((disguise) => {
        const bucket = bucketOf(disguise, 4);
        assert.ok(bucket >= 0 && bucket < 4);
        assert.strictEqual(bucket, bucketOf(disguise, 4));
    });
});

test('buildWorkUnits keeps light trackers whole and splits heavy ones', () => {
    const trackers = [makeTracker('Light'), makeTracker('Heavy')];
    const oldRawData = {
        light: storedEntries(10),
        heavy: storedEntries(TARGET_UNIT_WEIGHT * 2),
    };

    const units = buildWorkUnits(trackers, oldRawData);

    const lightUnits = units.filter((unit) => unit.tracker.company_name === 'Light');
    const heavyUnits = units.filter((unit) => unit.tracker.company_name === 'Heavy');
    assert.strictEqual(lightUnits.length, 1);
    assert.strictEqual(lightUnits[0].bucketCount, 1);
    assert.strictEqual(heavyUnits.length, 2);
    assert.deepStrictEqual(heavyUnits.map((unit) => unit.bucketIndex), [0, 1]);
    assert.ok(heavyUnits.every((unit) => unit.bucketCount === 2));
});

test('buildWorkUnits gives new trackers a positive weight', () => {
    const units = buildWorkUnits([makeTracker('Brand New')], {});
    assert.strictEqual(units.length, 1);
    assert.strictEqual(units[0].bucketCount, 1);
    assert.ok(units[0].weight > 0);
});

test('assignUnitsToShards partitions every unit exactly once and is deterministic', () => {
    const trackers = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((name) => makeTracker(name));
    const oldRawData = {
        alpha: storedEntries(100),
        beta: storedEntries(60),
        gamma: storedEntries(30),
        delta: storedEntries(5),
    };
    const units = buildWorkUnits(trackers, oldRawData);

    const first = assignUnitsToShards(units, 3);
    const second = assignUnitsToShards(units, 3);

    const assigned = first.flat().map((unit) => `${unit.tracker.company_name}:${unit.bucketIndex}`);
    assert.strictEqual(assigned.length, units.length);
    assert.strictEqual(new Set(assigned).size, units.length);
    assert.deepStrictEqual(
        first.map((shard) => shard.map((unit) => `${unit.tracker.company_name}:${unit.bucketIndex}`)),
        second.map((shard) => shard.map((unit) => `${unit.tracker.company_name}:${unit.bucketIndex}`)),
    );
});

test('assignUnitsToShards balances equal-weight units evenly', () => {
    const trackers = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => makeTracker(name));
    const oldRawData = Object.fromEntries(
        trackers.map((tracker) => [tracker.company_name.toLowerCase(), storedEntries(10)]),
    );
    const units = buildWorkUnits(trackers, oldRawData);

    const shards = assignUnitsToShards(units, 3);
    const weights = shards.map((shard) => shard.reduce((sum, unit) => sum + unit.weight, 0));

    assert.deepStrictEqual(weights, [20, 20, 20]);
});

test('getShardUnits returns every unit for a single shard and assignUnitsToShards rejects bad counts', () => {
    const trackers = ['Alpha', 'Beta'].map((name) => makeTracker(name));
    assert.strictEqual(getShardUnits(trackers, {}, 0, 1).length, 2);
    assert.throws(() => assignUnitsToShards([], 0), /Invalid shard count/);
});

test('resolveShardCount defaults only unset/empty values and rejects malformed ones', () => {
    assert.strictEqual(resolveShardCount(undefined), 1);
    assert.strictEqual(resolveShardCount(''), 1);
    assert.strictEqual(resolveShardCount('1'), 1);
    assert.strictEqual(resolveShardCount('6'), 6);

    assert.throws(() => resolveShardCount('0'), /Invalid SHARD_COUNT/);
    assert.throws(() => resolveShardCount('abc'), /Invalid SHARD_COUNT/);
    assert.throws(() => resolveShardCount('-2'), /Invalid SHARD_COUNT/);
    assert.throws(() => resolveShardCount('1.5'), /Invalid SHARD_COUNT/);
});

test('resolveShardIndex requires an explicit in-range index when sharding', () => {
    // Single-job runs do not shard and may omit SHARD_INDEX.
    assert.strictEqual(resolveShardIndex(undefined, 1), 0);

    assert.strictEqual(resolveShardIndex('0', 6), 0);
    assert.strictEqual(resolveShardIndex('5', 6), 5);

    assert.throws(() => resolveShardIndex(undefined, 6), /Invalid SHARD_INDEX/);
    assert.throws(() => resolveShardIndex('', 6), /Invalid SHARD_INDEX/);
    assert.throws(() => resolveShardIndex('abc', 6), /Invalid SHARD_INDEX/);
    assert.throws(() => resolveShardIndex('-1', 6), /Invalid SHARD_INDEX/);
    assert.throws(() => resolveShardIndex('1.5', 6), /Invalid SHARD_INDEX/);
    assert.throws(() => resolveShardIndex('6', 6), /Invalid SHARD_INDEX/);
});

test('bucket filters partition old and fetched data without overlap', () => {
    const bucketCount = 4;
    const oldInfo = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`old${i}.example`, 'final.example']),
    );
    const domainsInfo = [{
        domain_name: 'mailgun.org',
        cloaked_trackers: Array.from({ length: 50 }, (_, i) => ({
            disguise: `new${i}.example`,
            tracker: 'mailgun.org',
        })),
    }];

    const oldKeys = [];
    const newKeys = [];
    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
        oldKeys.push(...Object.keys(filterOldInfoByBucket(oldInfo, bucketIndex, bucketCount)));
        newKeys.push(...filterDomainsInfoByBucket(domainsInfo, bucketIndex, bucketCount)
            .flatMap((info) => info.cloaked_trackers)
            .map((pair) => pair.disguise));
    }

    // Each key must land in exactly one bucket: total per-bucket counts are 50
    // and a key seen twice would make the unique set smaller than the total.
    assert.strictEqual(oldKeys.length, 50);
    assert.strictEqual(new Set(oldKeys).size, 50);
    assert.strictEqual(newKeys.length, 50);
    assert.strictEqual(new Set(newKeys).size, 50);
});
