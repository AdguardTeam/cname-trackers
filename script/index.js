/* eslint-disable no-await-in-loop */
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const { logger } = require('./src/logger');

const {
    formatFilename,
    pluralizeCompanyType,
    stashInfoPairs,
    mapWithConcurrency,
} = require('./src/helpers');

const {
    DATA_DIR,
    BACKUP_DATA_DIR,
    CLOAKED_TRACKERS_FILE,
    FETCH_CONCURRENCY,
    SHARD_COUNT,
    SHARD_INDEX,
} = require('./config');

const { mergeDomainsInfo } = require('./src/merge-info');
const { fetchTrackers } = require('./src/fetch-trackers');
const { getOldData } = require('./src/get-old-data');
const {
    getShardUnits,
    resolveShardCount,
    resolveShardIndex,
    filterOldInfoByBucket,
    filterDomainsInfoByBucket,
} = require('./src/shard');
const { writeCompanyOutputs, writePartialOutputs } = require('./src/company-outputs');
const { combineData } = require('./src/combine');
const {
    reset: resetDnsStats,
    summarize: summarizeDnsStats,
    grandTotal: dnsGrandTotal,
} = require('./src/dns-stats');

const dataDir = path.resolve(__dirname, DATA_DIR);
const backupDir = path.resolve(__dirname, BACKUP_DATA_DIR);

// combine-only mode: the CI combine job has already assembled the shard
// outputs into data/; rebuild split-company and combined files only.
const COMBINE_ONLY = process.argv.includes('--combine-only');

const main = async () => {
    // read the config JSON file with trackers description
    const cloakingTrackersContent = await fs.readFile(
        path.resolve(__dirname, CLOAKED_TRACKERS_FILE),
    );

    // parse to js object
    const cloakingTrackers = JSON.parse(cloakingTrackersContent);

    if (COMBINE_ONLY) {
        await combineData(cloakingTrackers, dataDir);
        logger.success('Successfully updated combined files');
        return;
    }

    // get all directory names from the data folder
    const allDataDirNames = await fs.readdir(dataDir, { withFileTypes: true });

    // object where old trackers information will be written to.
    // it is needed to merge old data with new one
    // if some config type in cloaked-trackers.json was changes
    const oldRawData = await getOldData(allDataDirNames);

    // move the data directory to the temp directory
    // but first check if the temp directory exists
    const doesBackupDirExist = await fs.pathExists(backupDir);
    if (doesBackupDirExist) {
        await fs.remove(backupDir);
    }
    await fs.move(dataDir, backupDir);

    const shardCount = resolveShardCount(SHARD_COUNT);
    const shardIndex = resolveShardIndex(SHARD_INDEX, shardCount);

    // Work units are whole trackers, or hash buckets of oversized trackers.
    // Every shard computes the same assignment from the same config and data;
    // a single-job run is shard 0 of 1.
    const units = getShardUnits(cloakingTrackers, oldRawData, shardIndex, shardCount);

    // number of work units assigned to this shard
    const trackersLength = units.length;

    if (shardCount > 1) {
        logger.info(`Shard ${shardIndex}/${shardCount}: processing ${trackersLength} work units`);
    }

    // Failed work units. A failed unit's files are missing from the shard
    // artifact, so combine would keep the previous copies from the checkout and
    // publish them in a green run. The build must fail instead.
    let failedUnits = 0;

    // recording of combined tracker data in directories according to the relevant type
    for (let i = 0; i < trackersLength; i += 1) {
        const {
            tracker: { company_name: companyName, domains, type: companyType },
            bucketIndex,
            bucketCount,
        } = units[i];

        // plural form of company type for folder name and combined tracker file names
        // in cloaked-trackers.json - "type: ad"
        // in the data directory - folder "ads"
        // combined tracker file name - "combined_disguised_ads.txt"
        const companyTypePlural = pluralizeCompanyType(companyType);
        const partLabel = bucketCount > 1 ? ` (part ${bucketIndex + 1}/${bucketCount})` : '';

        logger.info(`Fetching for tracker: ${companyName}${partLabel}`);

        // fetching tracker domains in parallel (concurrency-limited); order
        // preserved, failed fetches become null and are dropped. Plain log
        // lines instead of ora spinners — they don't render in CI and would
        // garble across parallel fetches.
        const fetchedResults = await mapWithConcurrency(
            domains,
            FETCH_CONCURRENCY,
            async (domain) => {
                logger.info(`  - Fetching trackers for domain: ${domain}`);
                try {
                    const domainInfo = await fetchTrackers(domain);
                    logger.success(`  - Successfully fetched trackers for domain: ${domain}`);
                    return domainInfo;
                } catch (e) {
                    logger.error(`  - Failed to fetch trackers for domain: ${domain}`, e?.message);
                    return null;
                }
            },
        );

        // keep only successful fetches, drop failed ones
        const successfulFetches = fetchedResults.filter((d) => d);

        // for split trackers only this bucket's disguises are processed
        const domainsInfo = bucketCount > 1
            ? filterDomainsInfoByBucket(successfulFetches, bucketIndex, bucketCount)
            : successfulFetches;

        try {
            // formats the company name
            const companyFileName = formatFilename(companyName);
            const spinner = ora({ indent: 2 })
                .start(`Merging ${companyName} info and stashing it with final cname to json file`);

            // writes data about the tracker from the oldRawData object
            // to the variable oldInfo, if there is such information
            const oldInfoRaw = oldRawData[companyFileName] ?? {};
            const oldInfo = bucketCount > 1
                ? filterOldInfoByBucket(oldInfoRaw, bucketIndex, bucketCount)
                : oldInfoRaw;

            // a variable that stores the combined old and fetched tracker data
            let mergedDomainInfoPairs;
            let stashedInfo;

            try {
                // merge and stash old domains info with fetched domains info
                resetDnsStats();
                mergedDomainInfoPairs = await mergeDomainsInfo(oldInfo, domainsInfo);
                stashedInfo = await stashInfoPairs(mergedDomainInfoPairs);

                spinner.succeed(`${companyName} data successfully merged and stashed`);

                // DNS timing for this company (tune DNS_CONCURRENCY / DNS_TIMEOUT_MS in CI).
                // qps = true wall-clock throughput; avg = per-lookup latency (climbs past the knee);
                // max ≈ DNS_TIMEOUT_MS signals timeouts.
                const dnsStats = summarizeDnsStats();
                // eslint-disable-next-line max-len
                logger.info(`  DNS: ${dnsStats.count} lookups in ${dnsStats.wallMs}ms wall (~${dnsStats.qps} qps, avg ${dnsStats.avgMs}ms, max ${dnsStats.maxMs}ms, ${dnsStats.timeouts} timeouts)`);
            } catch (e) {
                spinner.fail(`Failed to merge and stash data for ${companyName}`);
            }

            if (bucketCount > 1) {
                // partial output; sibling buckets are merged by the combine job
                await writePartialOutputs({
                    dataDirPath: dataDir,
                    companyTypePlural,
                    companyFileName,
                    bucketIndex,
                    bucketCount,
                    mergedPairs: mergedDomainInfoPairs,
                    stashedInfo,
                });
            } else {
                await writeCompanyOutputs({
                    dataDirPath: dataDir,
                    companyTypePlural,
                    companyFileName,
                    companyName,
                    domains,
                    mergedPairs: mergedDomainInfoPairs,
                    stashedInfo,
                });
            }

            const doneNumStr = i === trackersLength - 1 ? '100%' : `~${Math.round(((i + 1) / trackersLength) * 100)}%`;
            logger.success(`Successfully fetched for tracker: ${companyName}${partLabel}, ${doneNumStr} done`);
        } catch (e) {
            failedUnits += 1;
            logger.error(`Failed to fetch for tracker: ${companyName}`);
            logger.error(e);
        }
    }

    // Fail the shard when any unit failed: its files are absent from the
    // artifact, and a green combine would publish the previous copies.
    if (failedUnits > 0) {
        throw new Error(`${failedUnits} of ${trackersLength} work units failed`);
    }

    // Shard builds skip combined files: the combine job rebuilds them once all
    // shard outputs are assembled. A single-job run is shard 0 of 1 and uses
    // the same output path as the combine job.
    if (shardCount === 1) {
        const spinner = ora({ indent: 2 }).start('Combining outputs');
        await combineData(cloakingTrackers, dataDir);
        spinner.succeed('Successfully combined outputs');
    }

    const dnsGrand = dnsGrandTotal();
    // eslint-disable-next-line max-len
    logger.info(`Total DNS: ${dnsGrand.count} lookups in ${dnsGrand.wallMs}ms wall (~${dnsGrand.qps} qps, ${dnsGrand.timeouts} timeouts)`);
};

main()
    .then(async () => {
        // fs.remove on a missing path is a no-op: combine-only mode never
        // creates the backup directory.
        await fs.remove(backupDir);
        logger.success('Successfully finished building cloaked trackers');
        process.exit(0);
    })
    .catch((e) => {
        logger.error('Building cloaked trackers finished with an error', e);
        process.exit(1);
    });
