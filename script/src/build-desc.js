const { identity, sortAscending } = require('./helpers');

/**
 * @typedef { import('./helpers').SortedObjItem } SortedObjItem
 */

/**
 * @typedef {Object} CloakingInfo
 * @property {string} company_name
 * @property {SortedObjItem[]} domains merged data sorted by trackers
 */

/**
 * Builds content of description file
 * @param {CloakingInfo} trackersData
 * @param {string} predefinedDomains original trackers domains names
 * @returns {string} description file content
 */
const buildDesc = async (trackersData, predefinedDomains) => {
    const {
        companyName,
        trackersInfoItems,
    } = trackersData;

    const flattedCloakedTrackers = trackersInfoItems
        .flatMap(({ cloaked_trackers: cloakedTrackers }) => cloakedTrackers)
        .filter(identity);

    const cloakedTrackersDomains = flattedCloakedTrackers.map(({ tracker }) => tracker);

    const passedInfoDomains = trackersInfoItems.map(({ domain_name: domainName }) => domainName);
    const knownDomains = passedInfoDomains.filter((el) => predefinedDomains.includes(el));

    const descChunks = [
        `# Tracker: ${companyName}`,
        '',
        '## Disguised trackers list',
        '',
    ];

    knownDomains.forEach((knownDomain) => {
        const subDomains = cloakedTrackersDomains.filter((domainToCheck) => {
            if (knownDomain === domainToCheck) {
                return false;
            }
            // do not consider 'aca.ca-eulerian.net' as a subdomain for 'eulerian.net'
            return domainToCheck.endsWith(`.${knownDomain}`);
        });
        const uniqSubdomains = [...new Set(subDomains)].sort();

        descChunks.push(`* ${knownDomain}`);
        if (subDomains.length > 0) {
            uniqSubdomains.forEach((subDomain) => {
                descChunks.push(`    * ${subDomain}`);
            });
        }
    });
    descChunks.push('');

    const rareDomains = passedInfoDomains.filter((el) => !predefinedDomains.includes(el));

    if (rareDomains.length > 0) {
        descChunks.push('### Rarely active trackers', '');
        rareDomains.forEach((domain) => {
            descChunks.push(`* ${domain}`);
        });
        descChunks.push('');
    }

    const sortedCloakedTrackers = flattedCloakedTrackers
        .sort((a, b) => {
            let res = sortAscending(a.tracker, b.tracker);
            if (res === 0) {
                res = sortAscending(a.disguise, b.disguise);
            }
            return res;
        });

    if (sortedCloakedTrackers.length > 0) {
        descChunks.push('## Cloaking domains', '');
        descChunks.push('| Disguise | Tracker |');
        descChunks.push('| ---- | ---- |');
        sortedCloakedTrackers.forEach(({ disguise, tracker }) => {
            descChunks.push(`| ${disguise} | ${tracker} |`);
        });
    } else {
        descChunks.push(`## No cloaking domains for ${companyName}`);
    }

    const mdString = descChunks.join('\n');

    return mdString;
};

module.exports = { buildDesc };
