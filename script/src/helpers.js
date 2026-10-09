const { promises: dns } = require('dns');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./logger');
const { record: recordDnsTiming } = require('./dns-stats');

const {
    FORMATS,
    COMBINED_RULES_FILE_NAME_BASE,
    MAX_RPZ_RULE_LENGTH,
} = require('./constants');

// DNS knobs live in config.js (env-overridable) so CI can retune them.
const {
    DNS_TIMEOUT_MS,
    DNS_CONCURRENCY,
} = require('../config');

const DATA_DIR_PATH = './../data';

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
 * Checks if the RPZ rule string is valid based on its length
 * @param {string} str - The RPZ rule string
 * @returns {boolean} - True if the string length is less than MAX_RPZ_RULE_LENGTH, otherwise false
 */
const isValidPrzString = (str) => {
    if (str.length <= MAX_RPZ_RULE_LENGTH) {
        return true;
    }
    logger.warning(`Invalid RPZ rule: ${str}`);
    return false;
};

/**
 * Object containing functions to compose rules for different types
 * - validate RPZ rule string by length
 * - new line is added at the end for each rule type
 */
const composeRuleWithNewline = {
    /**
     * Validates and composes an RPZ rule, new line is added at the end
     * @param {string} disguise - The disguise domain to validate and compose
     * @returns {string} - The composed RPZ rule if valid, otherwise an empty string
     */
    [FORMATS.RPZ.type]: (disguise) => {
        const ruleString = createRpzRule(disguise);
        if (!isValidPrzString(ruleString)) {
            return '';
        }
        return `${ruleString}\n`;
    },

    /**
     * Validates and composes a hosts rule, new line is added at the end
     * @param {string} disguise - The disguise domain to validate and compose
     * @returns {string} - The composed hosts rule if valid, otherwise an empty string
     */
    [FORMATS.HOSTS.type]: (disguise) => `${createHostsRule(disguise)}\n`,

    /**
     * Composes a base rule, new line is added at the end
     * @param {string} disguise - The disguise domain to validate and compose
     * @returns {string} - The composed base rule if valid, otherwise an empty string
     */
    [FORMATS.BASE.type]: (disguise) => `${createBaseRule(disguise)}\n`,
};

/**
 * Writes `fileContent` to `fileName` in the data directory.
 * @param {string} fileName property of FORMATS object for required file
 * @param {object} fileContent writeable data
 * @param {string} [dataDirPath=DATA_DIR_PATH] directory to write into
 *   (defaults to the build data dir; overridable for tests)
 * @returns {Promise<void>}
 */
const writeCombinedFile = async (fileName, fileContent, dataDirPath = DATA_DIR_PATH) => fs.writeFile(
    path.resolve(dataDirPath, fileName),
    fileContent,
);

/**
 * Returns its input value, uses as a predicate to filter nullable values
 * @param {*} el value
 * @returns {*} same value
 */
const identity = (el) => el;

/**
 * Maps over `items` with a limited concurrency, preserving order.
 * Avoids launching tens of thousands of promises (e.g. DNS lookups) at once.
 * @param {Array} items
 * @param {number} concurrency max number of `fn` calls running at once
 * @param {Function} fn async mapper `(item, index) => result`
 * @returns {Promise<Array>}
 */
const mapWithConcurrency = async (items, concurrency, fn) => {
    const results = new Array(items.length);
    let cursor = 0;
    const worker = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            // eslint-disable-next-line no-await-in-loop
            results[index] = await fn(items[index], index);
        }
    };
    const size = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: size }, worker));
    return results;
};

const replace = (str, replaceable, replacement) => str
    .split(replaceable)
    .map((word) => word.trim())
    .filter(identity)
    .join(replacement);

/**
 * Changes the company name to the correct format for file naming
 * @param {string} companyName property of FORMATS object for required file
 * @returns {string}
 */
const formatFilename = (companyName) => {
    const lowerCased = companyName.toLowerCase();
    const dashed = replace(lowerCased, ' ', '-');
    const lowerDashed = replace(dashed, '.', '_');
    return lowerDashed;
};

/**
 * Plural form of a company type, used for type directories and combined files.
 * @param {string} companyType singular type from cloaked-trackers.json
 * @returns {string}
 */
const pluralizeCompanyType = (companyType) => `${companyType}s`;

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
 * Resolve closest canonical name for given disguise.
 * Hard DNS_TIMEOUT_MS via Promise.race so an unresponsive resolver can't hang
 * the build; null on timeout/error.
 *
 * Notes:
 *   - Records timing into the dns-stats singleton (couples resolver to
 *     instrumentation, but counts every lookup incl. retries/chain hops).
 *   - The dns.resolveCname promise is NOT cancelled on timeout (no c-ares
 *     API); it lingers and is swallowed by .catch. If timeouts climb, lower
 *     DNS_CONCURRENCY.
 *
 * @param {string} disguise
 * @returns {Promise<string[]|null>}
 */
const resolveCname = async (disguise) => {
    const start = Date.now();
    let timedOut = false;
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
            timedOut = true;
            resolve(null);
        }, DNS_TIMEOUT_MS);
    });
    try {
        // dns.resolveCname rejects on error (e.g. ENOTFOUND); treat both
        // rejection and timeout as "no cname".
        return await Promise.race([
            dns.resolveCname(disguise).catch(() => null),
            timeout,
        ]);
    } finally {
        clearTimeout(timer);
        recordDnsTiming(Date.now() - start, timedOut);
    }
};

// Retry delay (distinct from config's fetch RETRY_TIMOUT_MS). resolveCname
// returns null on error OR timeout, so this retries timeouts too — worst case
// per unresponsive path: 2*DNS_TIMEOUT_MS + DNS_RETRY_DELAY_MS.
const DNS_RETRY_DELAY_MS = 3 * 1000;

/**
 * Resolves cname with one retry if something went wrong at first time.
 * @param {string} disguise
 * @returns {Promise<string[]|null>}
 */
const resolveCnameWithRetry = async (disguise) => {
    let res = await resolveCname(disguise);
    // if cname resolving failed (or timed out), check it one more time
    if (res === null) {
        await sleep(DNS_RETRY_DELAY_MS);
        res = await resolveCname(disguise);
    }
    return res;
};

/**
 * Recursively gets the chain of cnames for given disguise.
 * No cycle/depth guard (pre-existing): a CNAME cycle (A->B->A) would recurse
 * unbounded, and the per-lookup timeout doesn't stop a fast-cycling chain.
 * Add a visited-set if resolvers ever return cycles.
 *
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
    const validInfo = await mapWithConcurrency(
        Object.entries(removedInfo),
        DNS_CONCURRENCY,
        async ([disguise, tracker]) => {
            const isValid = await validateCname(disguise, tracker);
            return isValid ? { disguise, tracker } : null;
        },
    );
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
    const finalEntries = await mapWithConcurrency(
        uniqDisguises,
        DNS_CONCURRENCY,
        async (disguise) => {
            const cnameChain = await getCnamesChain(disguise);
            let finalCname = cnameChain[cnameChain.length - 1];
            if (!finalCname) {
                finalCname = reservedData[disguise];
            }
            return [disguise, finalCname];
        },
    );
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
    composeRuleWithNewline,
    createCombinedFileName,
    DATA_DIR_PATH,
    writeCombinedFile,
    identity,
    mapWithConcurrency,
    formatFilename,
    pluralizeCompanyType,
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
