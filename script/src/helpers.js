const { promises: dns } = require('dns');
const fs = require('fs-extra');
const path = require('path');

const { COMBINED_RULES_FILE_NAME_BASE } = require('./constants');

const ROOT_DIR_PATH = '../../';

/**
 * Creates name for combined disguised files
 * @param {string} type
 * @param {string} fileExtension
 * @param {string} [suffix=''] 'justdomains' or 'rpz' or '' for adblock syntax
 * @returns {string}
 */
const createCombinedFileName = (type, fileExtension, suffix = '') => (
    `${COMBINED_RULES_FILE_NAME_BASE}_${type}${suffix}.${fileExtension}`
);

/**
 * Converts `domain` into adblocker-type basic blocking rule
 * @param {string} domain
 * @returns {string}
 */
const createBaseRule = (domain) => `||${domain}^`;

/**
 * Converts domain into hosts-type rule
 * @param {string} domain
 * @returns {string}
 */
const createHostsRule = (domain) => domain;

/**
 * Converts domain into RPZ rule
 * @param {string} domain
 * @returns {string}
 */
const createRpzRule = (domain) => `${domain} CNAME .`;

/**
 * Writes `fileContent` to `fileName` in library root directory
 * @param {string} fileName property of CONST_DATA object for required file
 * @param {object} fileContent writeable data
 */
const writeFile = async (fileName, fileContent) => fs.writeFile(
    path.resolve(__dirname, ROOT_DIR_PATH, fileName),
    fileContent,
);

/**
 * Returns its input value, uses as a predicate to filter nullable values
 * @param {*} el value
 * @returns {*} same value
 */
const identity = (el) => el;

const replace = (str, replaceable, replacement) => str
    .split(replaceable)
    .map((word) => word.trim())
    .filter(identity)
    .join(replacement);

/**
 * Changes the company name to the correct format for file naming
 * @param {string} companyName property of CONST_DATA object for required file
 * @returns {string}
 */
const formatFilename = (companyName) => {
    const lowerCased = companyName.toLowerCase();
    const dashed = replace(lowerCased, ' ', '-');
    const lowerDashed = replace(dashed, '.', '_');
    return lowerDashed;
};

const sleep = (timeout) => new Promise((resolve) => {
    setTimeout(resolve, timeout);
});

const sortAscending = (a, b) => {
    if (a > b) {
        return 1;
    }

    if (a < b) {
        return -1;
    }

    return 0;
};

/**
 * Checks if file exist
 * @param {string} filepath path to file
 * @returns {boolean}
 */
const isFileExisting = async (filepath) => {
    try {
        await fs.access(filepath);
        return true;
    } catch {
        return false;
    }
};

/**
 * @typedef {Object} Pair
 * @property {string} disguise
 * @property {string} tracker
 */

/**
 * @typedef Entry
 * @type {Array}
 * @property {string} 0 - disguise
 * @property {string} 1 - tracker
 */

/**
 * Converts array of pairs to entries
 * @param {Pair[]} pairs
 * @returns {Entry[]} entries
 */
const pairsToEntries = (pairs) => pairs.map(({ disguise, tracker }) => [disguise, tracker]);

/**
 * Gets pairs which are present in oldInfo but absent in newInfo
 * @param {Pair[]} oldInfo previously saved to json-files data
 * @param {Pair[]} newInfo fetched data
 * @returns {Pair[]}
 */
const getRemoved = (oldInfo, newInfo) => {
    const removed = Object.keys(oldInfo)
        .reduce((diff, key) => {
            if (oldInfo[key] === newInfo[key]) return diff;
            return {
                ...diff,
                [key]: oldInfo[key],
            };
        }, {});
    return removed;
};

/**
 * Resolve closest canonical name for given disguise
 * @param {string} disguise
 * @returns {string[]|null}
 */
const resolveCname = async (disguise) => {
    let res;
    try {
        res = await dns.resolveCname(disguise);
    } catch (e) {
        res = null;
    }
    return res;
};

/**
 * Resolves cname with one retry if something went wrong at first time
 * @param {string} disguise
 * @returns {string[]|null}
 */
const resolveCnameWithRetry = async (disguise) => {
    const RETRY_TIMOUT_MS = 3 * 1000;
    let res = await resolveCname(disguise);
    // if cname resolving failed, check it one more time
    if (res === null) {
        await sleep(RETRY_TIMOUT_MS);
        res = await resolveCname(disguise);
    }
    return res;
};

/**
 * Recursively gets the chain of cnames for given disguise
 * @param {string} disguise
 * @param {Array} [acc=[]]
 * @returns {string[]} cname chain
 */
const getCnamesChain = async (disguise, acc = []) => {
    const res = await resolveCnameWithRetry(disguise);
    // collect cnames until there is no one left
    if (res !== null) {
        // domain can have only one canonical name
        acc.push(res[0].toLowerCase());
        await getCnamesChain(res[0], acc);
    }
    return acc;
};

/**
 * Checks is tracker still one of disguise's cnames
 * @param {string} disguise
 * @param {string} tracker
 * @returns {boolean}
 */
const validateCname = async (disguise, tracker) => {
    const cnameChain = await getCnamesChain(disguise);
    if (cnameChain.length === 0) {
        return false;
    }
    return cnameChain.includes(tracker);
};

/**
 * Validates stashed data pairs which are not present in fetched data
 * @param {Pair[]} removedInfo fetch data missed pairs
 * @returns {Pair[]} valid pairs
 */
const getValidPairsFromRemoved = async (removedInfo) => {
    const validInfo = await Promise.all(Object.entries(removedInfo)
        .map(async ([disguise, tracker]) => {
            const isValid = await validateCname(disguise, tracker);
            return isValid ? { disguise, tracker } : null;
        }));
    // filter nulls after cname validation
    return validInfo.filter(identity);
};

/**
 * @typedef {Object} SortedObjItem
 * @property {string} domain_name tracker domain name
 * @property {Pair[]} cloaked_trackers disguise-tracker pairs for particular tracker
 * @property {string[]} disguises list of disguises
 */

/**
 * Sorts merged data by trackers
 * @param {Pair[]} mergedPairs
 * @param {string[]} mainDomains original trackers domains
 * @returns {SortedObjItem[]} merged data sorted by trackers
 */
const sortMergedInfo = (mergedPairs, mainDomains) => {
    const preparedAcc = mainDomains
        .map((domain) => {
            const startSortedItem = {
                domain_name: domain,
                cloaked_trackers: [],
                disguises: [],
            };
            return startSortedItem;
        });
    const sorted = mergedPairs
        .reduce((acc, el) => {
            const { disguise, tracker } = el;
            const ind = acc.findIndex((res) => tracker === res.domain_name
                || tracker.endsWith(`.${res.domain_name}`));
            if (ind === -1) {
                const resItem = {
                    domain_name: tracker,
                    cloaked_trackers: [el],
                    disguises: [disguise],
                };
                acc.push(resItem);
            } else {
                acc[ind].cloaked_trackers.push(el);
                acc[ind].disguises.push(disguise);
            }
            return acc;
        }, preparedAcc);
    return sorted;
};

/**
 * Order entries by disguise alphabetically
 * @param {Entry[]} entries
 * @returns {Pair[]}
 */
const getOrderedByDisguisePairs = (entries) => {
    const orderedPairs = entries
        .sort()
        .map(([disguise, tracker]) => ({ disguise, tracker }));
    return orderedPairs;
};

/**
 * Replaces trackers in '[disguise, tracker]' entries with last cname in disguise cname chain
 * @param {Entry[]} entries
 * @returns {Entry[]} entries for unique disguises
 */
const replaceFinalCname = async (entries) => {
    // needed for recovering trackers for failed final cname checking
    const reservedData = Object.fromEntries(entries);
    const uniqDisguises = Object.keys(reservedData);
    const finalEntries = await Promise.all(uniqDisguises
        .map(async (disguise) => {
            const cnameChain = await getCnamesChain(disguise);
            let finalCname = cnameChain[cnameChain.length - 1];
            if (!finalCname) {
                finalCname = reservedData[disguise];
            }
            return [disguise, finalCname];
        }));
    return finalEntries;
};

/**
 * Prepares merged data for stashing
 * @param {Pair[]} pairs
 * @returns {Object} object with disguise as keys and their final cnames as values
 */
const stashInfoPairs = async (pairs) => {
    const finalEntries = await replaceFinalCname(pairsToEntries(pairs));
    return Object.fromEntries(finalEntries);
};

module.exports = {
    createCombinedFileName,
    writeFile,
    createBaseRule,
    createHostsRule,
    createRpzRule,
    identity,
    formatFilename,
    sleep,
    sortAscending,
    isFileExisting,
    getRemoved,
    getValidPairsFromRemoved,
    sortMergedInfo,
    pairsToEntries,
    stashInfoPairs,
    getOrderedByDisguisePairs,
};
