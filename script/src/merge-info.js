const { promises: fs } = require('fs');
const path = require('path');
const {
    identity,
    isFileExisting,
    pairsToEntries,
    getRemoved,
    getValidPairsFromRemoved,
    getOrderedByDisguisePairs,
} = require('./helpers');
const { JSON_FILE_EXTENSION } = require('./constants');

const TRACKERS_DIR_PATH = '../../trackers';

/**
 * @typedef { import('./fetch-trackers').FetchedDomainInfo } FetchedDomainInfo
 */
/**
 * @typedef { import('./helpers').Pair } Pair
 */

/**
 * Merges fetched data with previously saved
 * @param {string} companyFileName
 * @param {FetchedDomainInfo[]} fetchedDomainsInfo
 * @returns {Pair[]} merged '{ disguise, tracker }' pairs
 */
const mergeDomainsInfo = async (companyFileName, fetchedDomainsInfo) => {
    const oldInfoFileName = `${companyFileName}.${JSON_FILE_EXTENSION}`;
    const oldInfoFilePath = path.resolve(__dirname, TRACKERS_DIR_PATH, oldInfoFileName);

    const isOldFileExisting = await isFileExisting(oldInfoFilePath);

    let oldInfo = {};
    if (isOldFileExisting) {
        const oldInfoContent = await fs.readFile(oldInfoFilePath);
        oldInfo = JSON.parse(oldInfoContent);
    }

    const newInfoPairs = fetchedDomainsInfo
        .flatMap(({ cloaked_trackers: cloakedTrackers }) => cloakedTrackers)
        .filter(identity)
        // convert all domain names to lowercase
        .map(({ disguise: rawDisguise, tracker: rawTracker }) => {
            const disguise = rawDisguise.toLowerCase();
            const tracker = rawTracker.toLowerCase();
            return { disguise, tracker };
        });
    const newInfo = Object.fromEntries(pairsToEntries(newInfoPairs));

    const removedDiff = getRemoved(oldInfo, newInfo);
    const validRemovedPairs = await getValidPairsFromRemoved(removedDiff);

    const mergedPairs = [
        ...validRemovedPairs,
        ...newInfoPairs,
    ];

    const mergedEntries = pairsToEntries(mergedPairs);
    const orderedPairs = getOrderedByDisguisePairs(mergedEntries);

    return orderedPairs;
};

module.exports = { mergeDomainsInfo };
