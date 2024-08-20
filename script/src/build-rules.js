const {
    composeRuleWithNewline,
    identity,
} = require('./helpers');

const {
    rpzHeaderChunks,
    FORMATS,
} = require('./constants');

/**
 * @typedef { import('./build-desc').TrackersData } TrackersData
 */

/**
 * Builds rules content by type
 * @param {TrackersData} trackersData
 * @param {'BASE'|'HOSTS'|'RPZ'} ruleType rules type
 * @returns {string}
 */
const buildRulesByType = (trackersData, ruleType) => {
    const {
        companyName,
        trackersInfoItems,
    } = trackersData;

    const commonChunks = [
        FORMATS[ruleType].commentMarker,
        `${FORMATS[ruleType].commentMarker} Company name: ${companyName}`,
    ];

    // add specific header for rpz file format
    const headerRulesChunks = ruleType === FORMATS.RPZ.type ? [...commonChunks, ...rpzHeaderChunks] : commonChunks;
    headerRulesChunks.push('');
    const rulesChunks = [];
    // get only disguised trackers items in array
    // flattering and filter nullable values
    const flattedDisguisedTrackers = trackersInfoItems
        .flatMap((trackersItem) => trackersItem.disguises)
        .filter(identity);

    const getRule = composeRuleWithNewline[ruleType];

    if (!getRule) {
        throw new Error(`Unknown type: ${ruleType}`);
    }

    // make rule chunks by type
    new Set(flattedDisguisedTrackers).forEach((disguise) => {
        rulesChunks.push(getRule(disguise));
    });

    /* Ensure there is a newline at the end of RPZ files. */
    if (ruleType === FORMATS.RPZ.type) {
        rulesChunks.length += 1;
    }

    const baseRulesString = headerRulesChunks.join('\n') + rulesChunks.join('');
    return baseRulesString;
};

/**
 * @typedef {Object} RulesContent
 * @property {string} baseRulesString
 * @property {string} hostsRulesString
 * @property {string} rpzRulesString
 */

/**
 * Builds rules files content
 * @param {TrackersData} trackersData
 * @returns {RulesContent} content for base and hosts rules files
 */
const buildRules = async (trackersData) => {
    const baseRulesString = buildRulesByType(trackersData, FORMATS.BASE.type);
    const hostsRulesString = buildRulesByType(trackersData, FORMATS.HOSTS.type);
    const rpzRulesString = buildRulesByType(trackersData, FORMATS.RPZ.type);

    return { baseRulesString, hostsRulesString, rpzRulesString };
};

module.exports = { buildRules };
