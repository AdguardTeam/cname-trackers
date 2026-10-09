const fs = require('fs-extra');
const path = require('path');

const { sortMergedInfo, sortAscending } = require('./helpers');
const { buildDesc } = require('./build-desc');
const { buildRules } = require('./build-rules');
const { logger } = require('./logger');

const {
    JSON_FILE_EXTENSION,
    RULES_FILE_EXTENSION,
    HOSTS_RULES_FILE_NAME_ENDING,
    RPZ_RULES_FILE_NAME_ENDING,
} = require('./constants');

/**
 * @typedef { import('./helpers').Pair } Pair
 */

// Endings of the canonical per-company files, in match order: the longer rule
// endings must be checked before the plain rules extension. writeCompanyOutputs
// writes these files and combine.js's stale-file pruning matches them.
const COMPANY_FILE_ENDINGS = [
    `.${JSON_FILE_EXTENSION}`,
    '.md',
    `${HOSTS_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`,
    `${RPZ_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`,
    `.${RULES_FILE_EXTENSION}`,
];

// Matches `{companyFileName}__part-{bucketIndex}-of-{bucketCount}.json`.
const PART_FILE_RE = /^(.*)__part-(\d+)-of-(\d+)\.json$/;

/**
 * Writes the canonical per-company files: .json, .md, .txt, _justdomains.txt,
 * _rpz.txt.
 * @param {object} params
 * @param {string} params.dataDirPath data directory root
 * @param {string} params.companyTypePlural e.g. 'mail_trackers'
 * @param {string} params.companyFileName formatted company filename
 * @param {string} params.companyName original company name
 * @param {string[]} params.domains seed domains from the config
 * @param {Pair[]} params.mergedPairs
 * @param {object} params.stashedInfo `{disguise: finalCname}`
 * @returns {Promise<void>}
 */
const writeCompanyOutputs = async ({
    dataDirPath,
    companyTypePlural,
    companyFileName,
    companyName,
    domains,
    mergedPairs,
    stashedInfo,
}) => {
    const dirPath = path.resolve(dataDirPath, companyTypePlural);
    await fs.ensureDir(dirPath);

    const trackersData = {
        companyName,
        trackersInfoItems: sortMergedInfo(mergedPairs, domains),
    };

    const descString = await buildDesc(trackersData, domains);
    const { baseRulesString, hostsRulesString, rpzRulesString } = await buildRules(trackersData);

    const contentsByEnding = {
        [`.${JSON_FILE_EXTENSION}`]: JSON.stringify(stashedInfo, null, 2),
        '.md': descString,
        [`${HOSTS_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`]: hostsRulesString,
        [`${RPZ_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`]: rpzRulesString,
        [`.${RULES_FILE_EXTENSION}`]: baseRulesString,
    };

    await Promise.all(COMPANY_FILE_ENDINGS.map((ending) => fs.writeFile(
        path.resolve(dirPath, `${companyFileName}${ending}`),
        contentsByEnding[ending],
    )));
};

/**
 * Writes one hash bucket of a split tracker as one self-contained file. The
 * combine job merges sibling buckets and regenerates the canonical files.
 * @param {object} params
 * @param {string} params.dataDirPath data directory root
 * @param {string} params.companyTypePlural e.g. 'mail_trackers'
 * @param {string} params.companyFileName formatted company filename
 * @param {number} params.bucketIndex
 * @param {number} params.bucketCount
 * @param {Pair[]} params.mergedPairs
 * @param {object} params.stashedInfo `{disguise: finalCname}`
 * @returns {Promise<void>}
 */
const writePartialOutputs = async ({
    dataDirPath,
    companyTypePlural,
    companyFileName,
    bucketIndex,
    bucketCount,
    mergedPairs,
    stashedInfo,
}) => {
    const dirPath = path.resolve(dataDirPath, companyTypePlural);
    await fs.ensureDir(dirPath);
    const baseName = `${companyFileName}__part-${bucketIndex}-of-${bucketCount}`;

    // A failed merge or stash leaves these undefined: JSON.stringify would
    // silently write `{}` and the unit would pass. Fail the unit instead.
    if (!mergedPairs || !stashedInfo) {
        throw new Error(`Missing merge results for ${baseName}`);
    }

    await fs.writeFile(
        path.resolve(dirPath, `${baseName}.${JSON_FILE_EXTENSION}`),
        JSON.stringify({ stashedInfo, mergedPairs }),
    );
};

/**
 * Merges the `__part-*` files of one split tracker. Returns null when there is
 * no complete part set (e.g. one shard failed mid-company); in that case the
 * partial files are removed and the previous canonical files stay in place.
 * @param {string} dirPath company type directory
 * @param {string} companyFileName formatted company filename
 * @returns {Promise<{mergedPairs: Pair[], stashedInfo: object}|null>}
 */
const mergePartialOutputs = async (dirPath, companyFileName) => {
    let files;
    try {
        files = await fs.readdir(dirPath);
    } catch (e) {
        // A missing type directory means no companies of this type succeeded;
        // any other error (EACCES, EMFILE) must not silently skip the merge.
        if (e.code !== 'ENOENT') {
            throw e;
        }
        return null;
    }

    const partFiles = files
        .map((file) => ({ file, match: file.match(PART_FILE_RE) }))
        .filter(({ match }) => match && match[1] === companyFileName);

    if (partFiles.length === 0) {
        return null;
    }

    const bucketCount = Number(partFiles[0].match[3]);
    const partByIndex = new Map(partFiles.map(({ file, match }) => [Number(match[2]), file]));
    // Every bucket must have written its file; a missing one means a shard
    // failed mid-company and the set must be discarded, not half-merged.
    const isComplete = Array.from({ length: bucketCount }, (_, i) => i)
        .every((bucketIndex) => partByIndex.has(bucketIndex));

    if (!isComplete) {
        logger.warning(`Incomplete shard parts for ${companyFileName}; keeping existing files`);
        await Promise.all(partFiles.map(({ file }) => fs.remove(path.resolve(dirPath, file))));
        return null;
    }

    // Each part is one self-contained file, so read order does not matter; both
    // results are sorted below to keep committed data/ churn-free.
    const parts = await Promise.all(
        partFiles
            .filter(({ match }) => Number(match[2]) < bucketCount)
            .map(async ({ file }) => {
                const content = await fs.readFile(path.resolve(dirPath, file), 'utf8');
                return JSON.parse(content);
            }),
    );

    await Promise.all(partFiles.map(({ file }) => fs.remove(path.resolve(dirPath, file))));

    const mergedStashedInfo = Object.assign({}, ...parts.map((part) => part.stashedInfo));

    return {
        stashedInfo: Object.fromEntries(
            Object.entries(mergedStashedInfo).sort(([a], [b]) => sortAscending(a, b)),
        ),
        mergedPairs: parts
            .flatMap((part) => part.mergedPairs)
            .sort((a, b) => sortAscending(a.disguise, b.disguise)),
    };
};

module.exports = {
    COMPANY_FILE_ENDINGS,
    writeCompanyOutputs,
    writePartialOutputs,
    mergePartialOutputs,
};
