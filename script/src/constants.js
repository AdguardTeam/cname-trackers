const moment = require('moment');

const BASE_RULE_COMMENT_MARKER = '!';
const HOSTS_RULE_COMMENT_MARKER = '#';
const RPZ_RULE_COMMENT_MARKER = ';';

const COMBINED_ORIGINAL_TRACKERS_HEADER_TITLE = 'Title: AdGuard CNAME original trackers list';
// eslint-disable-next-line max-len
const COMBINED_ORIGINAL_TRACKERS_HEADER_DESC = 'Description: The list of trackers that are often disguised using CNAME. This list is supposed to be used only by Software capable of scanning CNAME records.';
const COMBINED_FILTER_LIST_HEADER_HOMEPAGE = 'Homepage: https://github.com/AdguardTeam/cname-trackers';

const JSON_FILE_EXTENSION = 'json';
const RULES_FILE_EXTENSION = 'txt';

const COMBINED_RULES_FILE_NAME_BASE = 'combined_disguised';
const HOSTS_RULES_FILE_NAME_ENDING = '_justdomains';
const RPZ_RULES_FILE_NAME_ENDING = '_rpz';
const COMBINED_ORIGINALS_FILE_NAME = 'combined_original_trackers';

const BASE_RULES_TYPE = 'BASE';
const HOSTS_RULES_TYPE = 'HOSTS';
const RPZ_RULES_TYPE = 'RPZ';

/**
 * Create the file name for the `combined_original_trackers` lists
 * based on the provided rule type.
 *
 * @param {string} ruleType - The type of rule, which determines the file name format.
 * Expected values are `BASE_RULES_TYPE` or `HOSTS_RULES_TYPE`.
 * @returns {string} The generated file name corresponding to the provided rule type.
 *
 * @throws {Error} Throws an error if an unknown rule type is provided.
 */
const getOriginalsFileName = (ruleType) => {
    switch (ruleType) {
        case BASE_RULES_TYPE:
            return `${COMBINED_ORIGINALS_FILE_NAME}.${RULES_FILE_EXTENSION}`;
        case HOSTS_RULES_TYPE:
            return `${COMBINED_ORIGINALS_FILE_NAME}${HOSTS_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`;
        default:
            throw new Error(`Unknown type: ${ruleType}`);
    }
};

// Length of the comment line in rpz files
const RPZ_LINE_COMMENT_LENGTH = 24;

/**
 * Maximum length of the RPZ rule.
 */
const MAX_RPZ_RULE_LENGTH = 255;
// Number of spaces before the comment in rpz files
const SPACES_BEFORE_COMMENT_LENGTH = 8;
// Space
const SPACE = ' ';
// Closing bracket after the data in rpz file
const RIGHT_PARENTHESIS = ')';
// Space + closing bracket;
const CLOSING_VALUE_MARKER = `${SPACE}${RIGHT_PARENTHESIS}`;

/**
 * Time-to-live for RPZ (Response Policy Zone) records in seconds.
 *
 * This constant determines how long RPZ records will remain active
 * before they expire and are removed.
 *
 * @see {@link https://doc.powerdns.com/recursor/lua-config/rpz.html#defttl}
 */
const RPZ_TTL_SEC = 5 * 60; // 5 minutes

/**
 * Serial number in the SOA record
 *
 * This constant holds the current time in Unix timestamp format,
 * which represents the number of milliseconds since January 1, 1970.
 *
 * @see {@link https://bind9.readthedocs.io/en/v9.18.13/reference.html#namedconf-statement-serial-update-method}
 */
const RPZ_SERIAL_NUMBER_MS = Date.now(); // current time in Unix

/**
 * RPZ update interval in seconds.
 *
 * This constant defines the interval between checks for updates.
 *
 * @see {@link https://www.cloudflare.com/en-gb/learning/dns/dns-records/dns-soa-record/}
 */
const RPZ_UPDATE_RATE_SEC = 7 * 24 * 60 * 60; // 7 days

/**
 * RPZ retry interval in seconds.
 *
 * The length of time a server should wait for asking an unresponsive primary nameserver for an update again.
 *
 * @see {@link https://www.cloudflare.com/en-gb/learning/dns/dns-records/dns-soa-record/}
 */
const RPZ_RETRY_TIME_SEC = 24 * 60 * 60; // 24 hours

/**
 * RPZ expiration time in seconds.
 *
 * This constant determines the period at which RPZ will be considered
 * as expired, and all its records will be removed.
 *
 * @see {@link https://www.cloudflare.com/en-gb/learning/dns/dns-records/dns-soa-record/}
 */
const RPZ_EXPIRE_TIME_SEC = 9 * 24 * 60 * 60; // 9 days

/**
 * Creates a string with a comment.
 *
 * @param {number} value - The value.
 * @param {string} comment - The comment.
 * @returns {string} - The string with the comment.
 */
const createRpzLineWithComment = (value, comment) => {
    let valueStr = value.toString();
    // Calculate the remaining number of spaces for the value
    const spacesBeforeValueLength = RPZ_LINE_COMMENT_LENGTH - valueStr.length;
    // Create a string with spaces on the left
    const spacesBeforeValue = SPACE.repeat(spacesBeforeValueLength);
    // Create a string with spaces before the comment
    let spacesBeforeComment = SPACE.repeat(SPACES_BEFORE_COMMENT_LENGTH);
    if (comment === 'Negative Cache TTL') {
        valueStr = `${valueStr}${CLOSING_VALUE_MARKER}`;
        spacesBeforeComment = SPACE.repeat(SPACES_BEFORE_COMMENT_LENGTH - CLOSING_VALUE_MARKER.length);
    }
    return [
        spacesBeforeValue,
        valueStr,
        spacesBeforeComment,
        RPZ_RULE_COMMENT_MARKER,
        SPACE,
        comment,
    ].join('');
};

/**
 * RPZ Record Header chunks.
 *
 * Contains zone information (TTL, SOA, NS).
 */
const rpzHeaderChunks = [
    '',
    `$TTL ${RPZ_TTL_SEC.toString()}`,
    '@    IN   SOA   localhost. root.localhost. (',
    `${createRpzLineWithComment(RPZ_SERIAL_NUMBER_MS, 'Serial')}`,
    `${createRpzLineWithComment(RPZ_UPDATE_RATE_SEC, 'Refresh')}`,
    `${createRpzLineWithComment(RPZ_RETRY_TIME_SEC, 'Retry')}`,
    `${createRpzLineWithComment(RPZ_EXPIRE_TIME_SEC, 'Expire')}`,
    `${createRpzLineWithComment(RPZ_TTL_SEC, 'Negative Cache TTL')}`,
    ';',
    '@    IN   NS    localhost.',
    '',
];

const getCombinedDisguisedHeaderTitle = (type) => `Title: AdGuard CNAME disguised ${type} list`;
// eslint-disable-next-line max-len
const getCombinedDisguisedHeaderDesc = (type) => `Description: The list of unique ${type} domains that disguise the real trackers by using CNAME records.`;

const HEADER_TIME_UPDATED_MARKER = 'TimeUpdated: ';
const timeUpdated = moment(Date.now()).format();
const COMBINED_FILTER_LIST_HEADER_TIME_UPDATED = `${HEADER_TIME_UPDATED_MARKER}${timeUpdated}`;

const getBaseRulesCombinedHeader = (type) => [
    `${BASE_RULE_COMMENT_MARKER} ${getCombinedDisguisedHeaderTitle(type)}`,
    `${BASE_RULE_COMMENT_MARKER} ${getCombinedDisguisedHeaderDesc(type)}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${BASE_RULE_COMMENT_MARKER}`,
].join('\n');

const getHostsRulesCombinedHeader = (type) => [
    `${HOSTS_RULE_COMMENT_MARKER} ${getCombinedDisguisedHeaderTitle(type)}`,
    `${HOSTS_RULE_COMMENT_MARKER} ${getCombinedDisguisedHeaderDesc(type)}`,
    `${HOSTS_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${HOSTS_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${HOSTS_RULE_COMMENT_MARKER}`,
].join('\n');

const getRpzRulesCombinedHeader = (type) => [
    `${RPZ_RULE_COMMENT_MARKER} ${getCombinedDisguisedHeaderTitle(type)}`,
    `${RPZ_RULE_COMMENT_MARKER} ${getCombinedDisguisedHeaderDesc(type)}`,
    `${RPZ_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${RPZ_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${RPZ_RULE_COMMENT_MARKER}`,
    ...rpzHeaderChunks,
].join('\n');

/**
 * Creates a combined header string for `combined_original_trackers` files
 * based on the provided rule type.
 *
 * @param {string} ruleType - The type of rule, which determines the comment marker used in the header.
 * Expected values are `BASE_RULES_TYPE` or `HOSTS_RULES_TYPE`.
 * @returns {string} The generated combined header as a multi-line string.
 *
 * @throws {Error} Throws an error if an unknown rule type is provided.
 */
const getOriginalsCombinedHeader = (ruleType) => {
    let COMMENT_MARKER;
    switch (ruleType) {
        case BASE_RULES_TYPE:
            COMMENT_MARKER = BASE_RULE_COMMENT_MARKER;
            break;
        case HOSTS_RULES_TYPE:
            COMMENT_MARKER = HOSTS_RULE_COMMENT_MARKER;
            break;
        default:
            throw new Error(`Unknown type: ${ruleType}`);
    }
    return [
        `${COMMENT_MARKER} ${COMBINED_ORIGINAL_TRACKERS_HEADER_TITLE}`,
        `${COMMENT_MARKER} ${COMBINED_ORIGINAL_TRACKERS_HEADER_DESC}`,
        `${COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
        `${COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
        `${COMMENT_MARKER}`,
    ].join('\n');
};

const FORMATS = {
    [BASE_RULES_TYPE]: {
        type: BASE_RULES_TYPE,
        commentMarker: BASE_RULE_COMMENT_MARKER,
    },
    [HOSTS_RULES_TYPE]: {
        type: HOSTS_RULES_TYPE,
        commentMarker: HOSTS_RULE_COMMENT_MARKER,
    },
    [RPZ_RULES_TYPE]: {
        type: RPZ_RULES_TYPE,
        commentMarker: RPZ_RULE_COMMENT_MARKER,
    },
    ORIGINALS: {
        [BASE_RULES_TYPE]: {
            commentMarker: BASE_RULE_COMMENT_MARKER,
            combinedHeader: getOriginalsCombinedHeader(BASE_RULES_TYPE),
            combinedFileName: getOriginalsFileName(BASE_RULES_TYPE),
        },
        [HOSTS_RULES_TYPE]: {
            commentMarker: HOSTS_RULE_COMMENT_MARKER,
            combinedHeader: getOriginalsCombinedHeader(HOSTS_RULES_TYPE),
            combinedFileName: getOriginalsFileName(HOSTS_RULES_TYPE),
        },
    },
};

module.exports = {
    COMBINED_RULES_FILE_NAME_BASE,
    BASE_RULE_COMMENT_MARKER,
    HOSTS_RULE_COMMENT_MARKER,
    RPZ_RULE_COMMENT_MARKER,
    MAX_RPZ_RULE_LENGTH,
    RULES_FILE_EXTENSION,
    JSON_FILE_EXTENSION,
    HOSTS_RULES_FILE_NAME_ENDING,
    RPZ_RULES_FILE_NAME_ENDING,
    FORMATS,
    rpzHeaderChunks,
    getBaseRulesCombinedHeader,
    getHostsRulesCombinedHeader,
    getRpzRulesCombinedHeader,
};
