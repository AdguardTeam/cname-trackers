const { formatFilename, sortAscending } = require('./helpers');

/**
 * @typedef { import('./fetch-trackers').FetchedDomainInfo } FetchedDomainInfo
 */

// Stored disguises per work unit. A tracker heavier than this is split into
// `ceil(weight / TARGET_UNIT_WEIGHT)` hash buckets so no single unit can
// dominate the critical path.
const TARGET_UNIT_WEIGHT = 50000;

/**
 * Stable hash of a disguise into [0, bucketCount). The same disguise always
 * lands in the same bucket, so shards never process the same pair twice.
 * @param {string} disguise
 * @param {number} bucketCount
 * @returns {number}
 */
const bucketOf = (disguise, bucketCount) => {
    let hash = 0;
    for (let i = 0; i < disguise.length; i += 1) {
        // eslint-disable-next-line no-bitwise
        hash = ((hash * 31) + disguise.charCodeAt(i)) >>> 0;
    }
    return hash % bucketCount;
};

/**
 * Number of disguises already stored for a tracker. New trackers get weight 1
 * so they are still distributed across shards.
 * @param {object} oldRawData keyed by formatted company filename
 * @param {{company_name: string}} tracker
 * @returns {number}
 */
const getTrackerWeight = (oldRawData, tracker) => {
    const stored = oldRawData[formatFilename(tracker.company_name)];
    if (!stored) {
        return 1;
    }
    return Math.max(Object.keys(stored).length, 1);
};

/**
 * Builds the shardable work units: one per tracker, or one per hash bucket for
 * trackers heavier than TARGET_UNIT_WEIGHT.
 * @param {Array<object>} trackers entries from cloaked-trackers.json
 * @param {object} oldRawData keyed by formatted company filename
 * @returns {Array<{tracker: object, index: number, bucketIndex: number, bucketCount: number, weight: number}>}
 */
const buildWorkUnits = (trackers, oldRawData) => trackers.flatMap((tracker, index) => {
    const weight = getTrackerWeight(oldRawData, tracker);
    const bucketCount = Math.max(1, Math.ceil(weight / TARGET_UNIT_WEIGHT));
    return Array.from({ length: bucketCount }, (_, bucketIndex) => ({
        tracker,
        index,
        bucketIndex,
        bucketCount,
        weight: weight / bucketCount,
    }));
});

/**
 * Deterministically assigns work units to shards with greedy weighted
 * balancing. Every shard computes the same assignment from the same config
 * and data, so no central coordinator is needed.
 * @param {Array<object>} units result of buildWorkUnits
 * @param {number} shardCount
 * @returns {Array<Array<object>>} shards[shardIndex] = work units in config order
 */
const assignUnitsToShards = (units, shardCount) => {
    if (!Number.isInteger(shardCount) || shardCount < 1) {
        throw new Error(`Invalid shard count: ${shardCount}`);
    }

    const shards = Array.from({ length: shardCount }, () => ({ weight: 0, units: [] }));
    const sorted = units.slice().sort((a, b) => (
        b.weight - a.weight
        || sortAscending(a.tracker.company_name, b.tracker.company_name)
        || a.bucketIndex - b.bucketIndex
    ));

    sorted.forEach((unit) => {
        let target = 0;
        for (let i = 1; i < shards.length; i += 1) {
            if (shards[i].weight < shards[target].weight) {
                target = i;
            }
        }
        shards[target].weight += unit.weight;
        shards[target].units.push(unit);
    });

    return shards.map(({ units: shardUnits }) => shardUnits);
};

/**
 * Work units assigned to one shard.
 * @param {Array<object>} trackers entries from cloaked-trackers.json
 * @param {object} oldRawData keyed by formatted company filename
 * @param {number} shardIndex
 * @param {number} shardCount
 * @returns {Array<object>}
 */
const getShardUnits = (trackers, oldRawData, shardIndex, shardCount) => {
    const shards = assignUnitsToShards(buildWorkUnits(trackers, oldRawData), shardCount);
    return shards[shardIndex];
};

/**
 * Resolves the shard count from `SHARD_COUNT`. Only an unset or empty value
 * defaults to 1 (single-job runs); a malformed value must fail instead of
 * silently running every shard as a full unsharded build and uploading the
 * whole data set as its shard artifact.
 * @param {string|undefined} rawShardCount value of SHARD_COUNT
 * @returns {number}
 */
const resolveShardCount = (rawShardCount) => {
    if (rawShardCount === undefined || rawShardCount === '') {
        return 1;
    }
    const shardCount = Number(rawShardCount);
    if (!Number.isInteger(shardCount) || shardCount < 1) {
        throw new Error(`Invalid SHARD_COUNT "${rawShardCount}"`);
    }
    return shardCount;
};

/**
 * Resolves the shard index from `SHARD_INDEX`. With more than one shard an
 * explicit in-range value is required: silently defaulting a missing or
 * malformed index to 0 would make every shard process shard 0, discard the
 * incomplete part sets and still finish green.
 * @param {string|undefined} rawShardIndex value of SHARD_INDEX
 * @param {number} shardCount
 * @returns {number}
 */
const resolveShardIndex = (rawShardIndex, shardCount) => {
    if (shardCount === 1) {
        return 0;
    }
    const shardIndex = Number(rawShardIndex);
    if (!rawShardIndex || !Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
        throw new Error(`Invalid SHARD_INDEX "${rawShardIndex}" for SHARD_COUNT ${shardCount}`);
    }
    return shardIndex;
};

/**
 * Keeps only the stored pairs that belong to the given hash bucket.
 * @param {object} oldInfo `{disguise: finalCname}`
 * @param {number} bucketIndex
 * @param {number} bucketCount
 * @returns {object}
 */
const filterOldInfoByBucket = (oldInfo, bucketIndex, bucketCount) => Object.fromEntries(
    Object.entries(oldInfo).filter(([disguise]) => bucketOf(disguise, bucketCount) === bucketIndex),
);

/**
 * Keeps only the fetched cloaked-tracker pairs that belong to the given bucket.
 * @param {FetchedDomainInfo[]} domainsInfo fetched domain info
 * @param {number} bucketIndex
 * @param {number} bucketCount
 * @returns {FetchedDomainInfo[]}
 */
const filterDomainsInfoByBucket = (domainsInfo, bucketIndex, bucketCount) => domainsInfo.map((info) => ({
    ...info,
    cloaked_trackers: (info.cloaked_trackers ?? []).filter(
        (pair) => pair && bucketOf(pair.disguise.toLowerCase(), bucketCount) === bucketIndex,
    ),
}));

module.exports = {
    TARGET_UNIT_WEIGHT,
    bucketOf,
    buildWorkUnits,
    assignUnitsToShards,
    getShardUnits,
    resolveShardCount,
    resolveShardIndex,
    filterOldInfoByBucket,
    filterDomainsInfoByBucket,
};
