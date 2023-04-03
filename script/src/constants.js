const moment = require('moment');

const BASE_RULE_COMMENT_MARKER = '!';
const HOSTS_RULE_COMMENT_MARKER = '#';
const RPZ_RULE_COMMENT_MARKER = ';';

const COMBINED_DISGUISES_HEADER_TITLE = 'Title: AdGuard CNAME disguised trackers list';
// eslint-disable-next-line max-len
const COMBINED_DISGUISES_HEADER_DESC = 'Description: The list of unique tracker domains that disguise the real trackers by using CNAME records.';
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

const HEADER_TIME_UPDATED_MARKER = 'TimeUpdated: ';
const timeUpdated = moment(Date.now()).format();
const COMBINED_FILTER_LIST_HEADER_TIME_UPDATED = `${HEADER_TIME_UPDATED_MARKER}${timeUpdated}`;

const baseRulesCombinedHeader = [
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_DISGUISES_HEADER_TITLE}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_DISGUISES_HEADER_DESC}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${BASE_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${BASE_RULE_COMMENT_MARKER}`,
].join('\n');

const hostsRulesCombinedHeader = [
    `${HOSTS_RULE_COMMENT_MARKER} ${COMBINED_DISGUISES_HEADER_TITLE}`,
    `${HOSTS_RULE_COMMENT_MARKER} ${COMBINED_DISGUISES_HEADER_DESC}`,
    `${HOSTS_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${HOSTS_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${HOSTS_RULE_COMMENT_MARKER}`,
].join('\n');

const rpzRulesCombinedHeader = [
    `${RPZ_RULE_COMMENT_MARKER} ${COMBINED_DISGUISES_HEADER_TITLE}`,
    `${RPZ_RULE_COMMENT_MARKER} ${COMBINED_DISGUISES_HEADER_DESC}`,
    `${RPZ_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_TIME_UPDATED}`,
    `${RPZ_RULE_COMMENT_MARKER} ${COMBINED_FILTER_LIST_HEADER_HOMEPAGE}`,
    `${RPZ_RULE_COMMENT_MARKER}`,
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
        combinedHeader: baseRulesCombinedHeader,
    },
    [HOSTS_RULES_TYPE]: {
        type: HOSTS_RULES_TYPE,
        commentMarker: HOSTS_RULE_COMMENT_MARKER,
        combinedHeader: hostsRulesCombinedHeader,
    },
    [RPZ_RULES_TYPE]: {
        type: RPZ_RULES_TYPE,
        commentMarker: RPZ_RULE_COMMENT_MARKER,
        combinedHeader: rpzRulesCombinedHeader,
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
};
