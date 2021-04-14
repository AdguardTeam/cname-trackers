/* eslint-disable no-await-in-loop */
const { promises: fs } = require('fs');
const path = require('path');
const ora = require('ora');
const {
    formatFilename,
    sortMergedInfo,
    stashInfoPairs,
} = require('./src/helpers');
const {
    INFO_FILE_EXTENSION,
    RULES_FILE_EXTENSION,
    HOSTS_RULES_FILE_NAME_ENDING,
} = require('./src/constants');
const { TRACKERS_DIR } = require('./config');
const { buildDesc } = require('./src/build-desc');
const { buildRules } = require('./src/build-rules');
const { updateCombined } = require('./src/update-combined');
const { mergeDomainsInfo } = require('./src/merge-info');
const { fetchTrackers } = require('./src/fetch-trackers');
const { CLOAKED_TRACKERS_FILE } = require('./config');

const main = async () => {
    const cloakingTrackersContent = await fs.readFile(
        path.resolve(__dirname, CLOAKED_TRACKERS_FILE),
    );

    const cloakingTrackers = JSON.parse(cloakingTrackersContent);

    const trackersLength = cloakingTrackers.length;
    for (let i = 0; i < trackersLength; i += 1) {
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

        try {
            const companyFileName = formatFilename(companyName);
            const spinner = ora({ indent: 2 }).start(`Merging ${companyName} info and stashing it with final cname to json file`);

            let mergedDomainInfoPairs;

            try {
                mergedDomainInfoPairs = await mergeDomainsInfo(companyFileName, domainsInfo);
                const stashedInfo = await stashInfoPairs(mergedDomainInfoPairs);
                spinner.succeed(`${companyName} data successfully merged and stashed`);
                await fs.writeFile(
                    path.resolve(__dirname, TRACKERS_DIR, `${companyFileName}.${INFO_FILE_EXTENSION}`),
                    JSON.stringify(stashedInfo, null, 2),
                );
            } catch (e) {
                spinner.fail(`Failed to merge and stash data for ${companyName}`);
            }

            const trackersInfoItems = sortMergedInfo(mergedDomainInfoPairs, domains);
            const trackersData = {
                companyName,
                trackersInfoItems,
            };

            const descString = await buildDesc(trackersData, domains);
            await fs.writeFile(path.resolve(__dirname, TRACKERS_DIR, `${companyFileName}.md`), descString);

            const {
                baseRulesString, hostsRulesString,
            } = await buildRules(trackersData);
            await fs.writeFile(
                path.resolve(
                    __dirname,
                    TRACKERS_DIR,
                    `${companyFileName}.${RULES_FILE_EXTENSION}`,
                ),
                baseRulesString,
            );
            await fs.writeFile(
                path.resolve(
                    __dirname,
                    TRACKERS_DIR,
                    `${companyFileName}${HOSTS_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`,
                ),
                hostsRulesString,
            );
            const doneNumStr = i === trackersLength - 1 ? '100%' : `~${Math.round(((i + 1) / trackersLength) * 100)}%`;
            console.log(`Successfully fetched for tracker: ${companyName}, ${doneNumStr} done`);
        } catch (e) {
            console.log(`Failed to fetch for tracker: ${companyName}`);
            console.log(e);
        }
    }

    const spinner = ora({ indent: 2 }).start('Updating combined files');
    try {
        await updateCombined();
        spinner.succeed('Successfully updated combined files');
    } catch (e) {
        spinner.fail('Failed to update combined files');
        console.log(e);
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
