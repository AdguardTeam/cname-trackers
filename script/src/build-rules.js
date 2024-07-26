const {
    composeRuleWithNewline,
    identity,
} = require('./helpers');

const {
    rpzHeaderChunks,
    CONST_DATA,
} = require('./constants');

/**
 * @typedef { import('./build-desc').TrackersData } TrackersData
 */

/**
 * Builds rules content by type
 * @param {TrackersData} trackersData
 * @param {'BASE'|'HOSTS'|'RPZ'} type rules type
 * @returns {string}
 */
const buildRulesByType = (trackersData, type) => {
    const {
        companyName,
        trackersInfoItems,
    } = trackersData;

    const commonChunks = [
        CONST_DATA[type].commentMarker,
        `${CONST_DATA[type].commentMarker} Company name: ${companyName}`,
    ];

    // add specific header for rpz file format
    const headerRulesChunks = type === CONST_DATA.RPZ.type ? [...commonChunks, ...rpzHeaderChunks] : commonChunks;
    headerRulesChunks.push('');
    const rulesChunks = [];
    // get only disguised trackers items in array
    // flattering and filter nullable values
    const flattedDisguisedTrackers = trackersInfoItems
        .flatMap((trackersItem) => trackersItem.disguises)
        .filter(identity);

    let getRule;

    if (type === CONST_DATA.BASE.type) {
        getRule = composeRuleWithNewline.baseRule;
    } else if (type === CONST_DATA.HOSTS.type) {
        getRule = composeRuleWithNewline.hostsRule;
    } else if (type === CONST_DATA.RPZ.type) {
        getRule = composeRuleWithNewline.rpzRule;
    }

    if (!getRule) {
        throw new Error(`Unknown type: ${type}`);
    }

    // make rule chunks by type
    new Set(flattedDisguisedTrackers).forEach((disguise) => {
        rulesChunks.push(getRule(disguise));
    });

    /* Ensure there is a newline at the end of RPZ files. */
    if (type === CONST_DATA.RPZ.type) {
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
    const baseRulesString = buildRulesByType(trackersData, CONST_DATA.BASE.type);
    const hostsRulesString = buildRulesByType(trackersData, CONST_DATA.HOSTS.type);
    const rpzRulesString = buildRulesByType(trackersData, CONST_DATA.RPZ.type);

    return { baseRulesString, hostsRulesString, rpzRulesString };
};

module.exports = { buildRules };
