const buildRules = async (trackersInfo) => {
    const {
        company_name: companyName,
        domains,
    } = trackersInfo;

    const rulesStringWithDomains = domains
        .map(({ domain_name: domainName, cloaked_trackers: cloakedTrackers }) => {
            const domainsString = `!
! ${domainName} disguised trackers
!`;
            let rulesString = `! no domains found for ${domainName}`;
            if (cloakedTrackers) {
                const disguises = cloakedTrackers.map(({ disguise }) => disguise);
                // remove duplicates
                const uniqDisguises = [...new Set(disguises)];
                rulesString = uniqDisguises
                    .sort()
                    .map((disguise) => `||${disguise}^`)
                    .join('\n');
            }

            return `${domainsString}\n${rulesString}`;
        }).join('\n');

    const rulesContentString = `!
! Company name: ${companyName}
${rulesStringWithDomains}`;

    return rulesContentString;
};

module.exports = { buildRules };
