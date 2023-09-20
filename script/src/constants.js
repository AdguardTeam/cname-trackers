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
const COMBINED_ORIGINALS_FILE_NAME_BASE = 'combined_original_trackers';

const COMBINED_ORIGINALS_FILE_NAME = `${COMBINED_ORIGINALS_FILE_NAME_BASE}.${RULES_FILE_EXTENSION}`;
const COMBINED_JSON_FILE_NAME = `${COMBINED_RULES_FILE_NAME_BASE}.${JSON_FILE_EXTENSION}`;

// Length of the comment line in rpz files
const LINE_LENGTH = 24;
// Number of spaces before the comment in rpz files
const SPACES_BEFORE_COMMENT_LENGTH = 8;
// Space
const SPACE = ' ';
// Closing bracket after the data in rpz file
const RIGHT_PARENTHESIS = ')';
// Space + closing bracket;
const CLOSING_VALUE_MARKER = `${SPACE}${RIGHT_PARENTHESIS}`;
// Separator (semicolon and space)
const COMMENT_START = `${RPZ_RULE_COMMENT_MARKER}${SPACE}`;

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
const createLineWithComment = (value, comment) => {
    let valueStr = value.toString();
    // Calculate the remaining number of spaces for the value
    const spacesBeforeValueLength = LINE_LENGTH - valueStr.length;
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
    `${createLineWithComment(RPZ_SERIAL_NUMBER_MS, 'Serial')}`,
    `${createLineWithComment(RPZ_UPDATE_RATE_SEC, 'Refresh')}`,
    `${createLineWithComment(RPZ_RETRY_TIME_SEC, 'Retry')}`,
    `${createLineWithComment(RPZ_EXPIRE_TIME_SEC, 'Expire')}`,
    `${createLineWithComment(RPZ_TTL_SEC, 'Negative Cache TTL')}`,
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

const originalsCombinedHeader = [
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_ORIGINAL_TRACKERS_HEADER_TITLE}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_ORIGINAL_TRACKERS_HEADER_DESC}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${BASE_RULE_COMMENT_MARKER}`,
].join('\n');

const BASE_RULES_TYPE = 'BASE';
const HOSTS_RULES_TYPE = 'HOSTS';
const RPZ_RULES_TYPE = 'RPZ';

const CONST_DATA = {
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
        commentMarker: BASE_RULE_COMMENT_MARKER,
        combinedHeader: originalsCombinedHeader,
        combinedFileName: COMBINED_ORIGINALS_FILE_NAME,
    },
};

module.exports = {
    COMBINED_RULES_FILE_NAME_BASE,
    BASE_RULE_COMMENT_MARKER,
    HOSTS_RULE_COMMENT_MARKER,
    RPZ_RULE_COMMENT_MARKER,
    RULES_FILE_EXTENSION,
    JSON_FILE_EXTENSION,
    COMBINED_JSON_FILE_NAME,
    HOSTS_RULES_FILE_NAME_ENDING,
    RPZ_RULES_FILE_NAME_ENDING,
    CONST_DATA,
    rpzHeaderChunks,
    getBaseRulesCombinedHeader,
    getHostsRulesCombinedHeader,
    getRpzRulesCombinedHeader,
};
