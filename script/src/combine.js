const fs = require('fs-extra');
const path = require('path');

const { formatFilename, pluralizeCompanyType } = require('./helpers');
const { updateCombined } = require('./update-combined');
const {
    COMPANY_FILE_ENDINGS,
    writeCompanyOutputs,
    mergePartialOutputs,
} = require('./company-outputs');

/**
 * Unique plural type directory names for the given trackers.
 * @param {Array<{type: string}>} trackers
 * @returns {string[]}
 */
const getCompanyTypes = (trackers) => [
    ...new Set(trackers.map(({ type }) => pluralizeCompanyType(type))),
];

/**
 * For every tracker that was hash-split across shards, merges its partial
 * files back into the canonical per-company files. Whole-tracker outputs are
 * left untouched.
 * @param {Array<object>} trackers entries from cloaked-trackers.json
 * @param {string} dataDirPath data directory assembled from shard artifacts
 * @returns {Promise<void>}
 */
const mergeSplitCompanyOutputs = async (trackers, dataDirPath) => {
    await Promise.all(trackers.map(async (tracker) => {
        const companyTypePlural = pluralizeCompanyType(tracker.type);
        const companyFileName = formatFilename(tracker.company_name);
        const dirPath = path.resolve(dataDirPath, companyTypePlural);

        const partials = await mergePartialOutputs(dirPath, companyFileName);
        if (!partials) {
            return;
        }

        await writeCompanyOutputs({
            dataDirPath,
            companyTypePlural,
            companyFileName,
            companyName: tracker.company_name,
            domains: tracker.domains,
            mergedPairs: partials.mergedPairs,
            stashedInfo: partials.stashedInfo,
        });
    }));
};

/**
 * Removes outputs that the current config no longer describes: whole type
 * directories that left `cloaked-trackers.json` (with their combined files),
 * and per-company files of types that are still configured. The combine job
 * works on the checked-out `data/` overlaid with shard outputs, so anything
 * removed from the config would otherwise keep its stale files from master
 * and leak into the rebuilt combined lists.
 * @param {Array<object>} trackers entries from cloaked-trackers.json
 * @param {string} dataDirPath data directory assembled from shard artifacts
 * @returns {Promise<void>}
 */
const pruneStaleCompanyOutputs = async (trackers, dataDirPath) => {
    const configuredTypes = new Set(getCompanyTypes(trackers));

    // A type that left the config keeps its directory and its
    // `combined_disguised_<type>.*` files; the per-company pass below only
    // walks the configured types, so prune them here.
    const staleTypes = (await fs.readdir(dataDirPath, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && !configuredTypes.has(entry.name))
        .map((entry) => entry.name);

    if (staleTypes.length > 0) {
        const dataDirFiles = await fs.readdir(dataDirPath);
        await Promise.all(staleTypes.map(async (staleType) => {
            await fs.remove(path.resolve(dataDirPath, staleType));
            await Promise.all(dataDirFiles
                .filter((file) => file.startsWith(`combined_disguised_${staleType}`))
                .map((file) => fs.remove(path.resolve(dataDirPath, file))));
        }));
    }

    await Promise.all([...configuredTypes].map(async (companyType) => {
        const expected = new Set(
            trackers
                .filter((tracker) => pluralizeCompanyType(tracker.type) === companyType)
                .map((tracker) => formatFilename(tracker.company_name)),
        );
        const dirPath = path.resolve(dataDirPath, companyType);

        let files;
        try {
            files = await fs.readdir(dirPath);
        } catch (e) {
            // A missing type directory means no companies of this type succeeded;
            // any other error (EACCES, EMFILE) must not silently skip pruning.
            if (e.code !== 'ENOENT') {
                throw e;
            }
            return;
        }

        await Promise.all(files.map(async (file) => {
            const ending = COMPANY_FILE_ENDINGS.find((suffix) => file.endsWith(suffix));
            if (!ending || expected.has(file.slice(0, -ending.length))) {
                return;
            }
            await fs.remove(path.resolve(dirPath, file));
        }));
    }));
};

/**
 * Rebuilds split per-company files and all combined files from the data
 * directory assembled out of shard artifacts.
 * @param {Array<object>} trackers entries from cloaked-trackers.json
 * @param {string} dataDirPath
 * @returns {Promise<void>}
 */
const combineData = async (trackers, dataDirPath) => {
    await mergeSplitCompanyOutputs(trackers, dataDirPath);
    // Must run after the merge: part files of current companies are consumed
    // there, and their `__part-*` names are not part of the expected set.
    await pruneStaleCompanyOutputs(trackers, dataDirPath);
    await updateCombined(getCompanyTypes(trackers), dataDirPath);
};

module.exports = {
    getCompanyTypes,
    combineData,
};
