const {
    identity,
    pairsToEntries,
    getRemoved,
    getValidPairsFromRemoved,
    getOrderedByDisguisePairs,
} = require('./helpers');

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

const mergeDomainsInfo = async (oldInfo, fetchedDomainsInfo) => {
    // create an array with new pairs
    const newInfoPairs = fetchedDomainsInfo
        // flattening the cloakedTrackers by one level
        .flatMap(({ cloaked_trackers: cloakedTrackers }) => cloakedTrackers)
        // filter nulls
        .filter(identity)
        // convert all domain names to lowercase
        .map(({ disguise: rawDisguise, tracker: rawTracker }) => {
            const disguise = rawDisguise.toLowerCase();
            const tracker = rawTracker.toLowerCase();
            return { disguise, tracker };
        });

    // transforms a list of key-value pairs form array into an object with pairs
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
