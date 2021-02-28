/* eslint-disable no-await-in-loop */
const { promises: fs } = require('fs');
const path = require('path');
const ora = require('ora');
const { formatFilename } = require('./src/helpers');
const { TRACKERS_DIR } = require('./config');
const { buildRules } = require('./src/build-rules');
const { buildDesc } = require('./src/build-desc');
const { fetchTrackers } = require('./src/fetch-trackers');
const { CLOAKED_TRACKERS_FILE } = require('./config');

const main = async () => {
    const cloakingTrackersContent = await fs.readFile(
        path.resolve(__dirname, CLOAKED_TRACKERS_FILE),
    );

    const cloakingTrackers = JSON.parse(cloakingTrackersContent);

    for (let i = 0; i < cloakingTrackers.length; i += 1) {
        const { company_name: companyName, domains } = cloakingTrackers[i];
        console.log(`Fetching for tracker: ${companyName}`);

        const domainsInfo = [];
        for (let j = 0; j < domains.length; j += 1) {
            const domain = domains[j];
            const spinner = ora({ indent: 2 }).start(`Fetching trackers for domain: ${domain}`);
            try {
                const domainInfo = await fetchTrackers(domain);
                spinner.succeed(`Successfully fetched trackers for domain: ${domain}`);
                domainsInfo.push(domainInfo);
            } catch (e) {
                spinner.fail(`Failed to fetch trackers for domain: ${domain}`);
            }
        }

        const cloakingInfo = {
            company_name: companyName,
            domains: domainsInfo,
        };

        try {
            const descString = await buildDesc(cloakingInfo);
            await fs.writeFile(path.resolve(__dirname, TRACKERS_DIR, `${formatFilename(companyName)}.md`), descString);
            const rulesString = await buildRules(cloakingInfo);
            await fs.writeFile(path.resolve(__dirname, TRACKERS_DIR, `${formatFilename(companyName)}.txt`), rulesString);
            console.log(`Successfully fetched for tracker: ${companyName}`);
        } catch (e) {
            console.log(`Failed to fetch for tracker: ${companyName}`);
            console.log(e);
        }
    }
};

main()
    .then(() => {
        console.log('Successfully finished building cloaked trackers');
        process.exit(0);
    })
    .catch((e) => {
        console.log('Building cloaked trackers finished with an error', e);
        process.exit(1);
    });
