const {
    createBaseRule,
    createHostsRule,
    createRpzRule,
} = require('./helpers');
const { CONST_DATA } = require('./constants');

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

    const rulesChunks = [
        CONST_DATA[type].commentMarker,
        `${CONST_DATA[type].commentMarker} Company name: ${companyName}`,
    ];

    trackersInfoItems.forEach(({ domain_name: domainName, disguises }) => {
        rulesChunks.push(CONST_DATA[type].commentMarker);
        rulesChunks.push(`${CONST_DATA[type].commentMarker} ${domainName} disguised trackers`);
        rulesChunks.push(CONST_DATA[type].commentMarker);

        if (disguises && disguises.length > 0) {
            // remove duplicates and order alphabetically
            const uniqDisguises = [...new Set(disguises)].sort();
            uniqDisguises.forEach((disguise) => {
                let rule;
                if (type === CONST_DATA.BASE.type) {
                    rule = createBaseRule(disguise);
                } else if (type === CONST_DATA.HOSTS.type) {
                    rule = createHostsRule(disguise);
                } else if (type === CONST_DATA.RPZ.type) {
                    rule = createRpzRule(disguise);
                }
                rulesChunks.push(rule);
            });
        } else {
            rulesChunks.push(`${CONST_DATA[type].commentMarker} no domains found for ${domainName}`);
        }
    });

    /* Ensure there is a newline at the end of RPZ files. */
    if (type === CONST_DATA.RPZ.type) {
        rulesChunks.length += 1;
    }

    const baseRulesString = rulesChunks.join('\n');
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
