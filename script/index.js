/* eslint-disable no-await-in-loop */
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');

const {
    formatFilename,
    sortMergedInfo,
    stashInfoPairs,
} = require('./src/helpers');

const {
    JSON_FILE_EXTENSION,
    RULES_FILE_EXTENSION,
    HOSTS_RULES_FILE_NAME_ENDING,
    RPZ_RULES_FILE_NAME_ENDING,
} = require('./src/constants');

const {
    DATA_DIR,
    BACKUP_DATA_DIR,
    CLOAKED_TRACKERS_FILE,
} = require('./config');

const { buildDesc } = require('./src/build-desc');
const { buildRules } = require('./src/build-rules');
const { updateCombined } = require('./src/update-combined');
const { mergeDomainsInfo } = require('./src/merge-info');
const { fetchTrackers } = require('./src/fetch-trackers');
const { getOldData } = require('./src/get-old-data');

const dataDir = path.resolve(__dirname, DATA_DIR);
const backupDir = path.resolve(__dirname, BACKUP_DATA_DIR);

const main = async () => {
    // get all directory names from the data folder
    const allDataDirNames = await fs.readdir(dataDir);

    // object where old trackers information will be written to.
    // it is needed to merge old data with new one
    // if some config type in cloaked-trackers.json was changes
    const oldRawData = await getOldData(allDataDirNames);

    // move the data directory to the temp directory
    await fs.move(dataDir, backupDir);

    // read the config JSON file with trackers description
    const cloakingTrackersContent = await fs.readFile(
        path.resolve(__dirname, CLOAKED_TRACKERS_FILE),
    );

    // parse to js object
    const cloakingTrackers = JSON.parse(cloakingTrackersContent);

    // length of an object with trackers
    const trackersLength = cloakingTrackers.length;

    // variable for store combined data objects
    const rawCombinedData = {};

    // recording of combined tracker data in directories according to the relevant type
    for (let i = 0; i < trackersLength; i += 1) {
        // deconstruct the object into company name, domains, type and assign
        const { company_name: companyName, domains, type: companyType } = cloakingTrackers[i];

        // path for directory with companyType name
        const dirPath = path.resolve(__dirname, DATA_DIR, companyType);

        console.log(`Fetching for tracker: ${companyName}`);

        // a variable to record fetched trackers
        const domainsInfo = [];

        // fetching tracker domains and record in domainsInfo array
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
            // formats the company name
            const companyFileName = formatFilename(companyName);
            const spinner = ora({ indent: 2 })
                .start(`Merging ${companyName} info and stashing it with final cname to json file`);

            // writes data about the tracker from the oldRawData object
            // to the variable oldInfo, if there is such information
            const oldInfo = oldRawData[companyFileName] ?? {};

            // a variable that stores the combined old and fetched tracker data
            let mergedDomainInfoPairs;

            try {
                // merge and stash old domains info with fetched domains info
                mergedDomainInfoPairs = await mergeDomainsInfo(oldInfo, domainsInfo);
                const stashedInfo = await stashInfoPairs(mergedDomainInfoPairs);

                spinner.succeed(`${companyName} data successfully merged and stashed`);

                // create directory
                await fs.ensureDir(dirPath);

                // create json file
                await fs.writeFile(
                    path.resolve(__dirname, DATA_DIR, companyType, `${companyFileName}.${JSON_FILE_EXTENSION}`),
                    JSON.stringify(stashedInfo, null, 2),
                );

                // save stashed data to combined data object to save it later.
                // note: `companyType` here is an actual type from the config
                rawCombinedData[companyType] = {
                    ...rawCombinedData[companyType],
                    ...stashedInfo,
                };
            } catch (e) {
                spinner.fail(`Failed to merge and stash data for ${companyName}`);
            }

            const trackersInfoItems = sortMergedInfo(mergedDomainInfoPairs, domains);
            const trackersData = {
                companyName,
                trackersInfoItems,
            };

            // create string for md file
            const descString = await buildDesc(trackersData, domains);

            // create md file
            await fs.writeFile(path.resolve(__dirname, DATA_DIR, companyType, `${companyFileName}.md`), descString);

            // create strings in other formats
            const {
                baseRulesString, hostsRulesString, rpzRulesString,
            } = await buildRules(trackersData);

            // write files to directories
            await fs.writeFile(
                path.resolve(
                    __dirname,
                    DATA_DIR,
                    companyType,
                    `${companyFileName}.${RULES_FILE_EXTENSION}`,
                ),
                baseRulesString,
            );
            await fs.writeFile(
                path.resolve(
                    __dirname,
                    DATA_DIR,
                    companyType,
                    `${companyFileName}${HOSTS_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`,
                ),
                hostsRulesString,
            );
            await fs.writeFile(
                path.resolve(
                    __dirname,
                    DATA_DIR,
                    companyType,
                    `${companyFileName}${RPZ_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`,
                ),
                rpzRulesString,
            );

            const doneNumStr = i === trackersLength - 1 ? '100%' : `~${Math.round(((i + 1) / trackersLength) * 100)}%`;
            console.log(`Successfully fetched for tracker: ${companyName}, ${doneNumStr} done`);
        } catch (e) {
            // restore data directory from temp directory
            await fs.move(backupDir, dataDir);
            console.log(`Failed to fetch for tracker: ${companyName}`);
            console.log(e);
        }
    }

    const spinner = ora({ indent: 2 }).start('Updating combined files');
    try {
        await updateCombined(rawCombinedData);
        spinner.succeed('Successfully updated combined files');
    } catch (e) {
        spinner.fail('Failed to update combined files');
        console.log(e);
    }
};

main()
    .then(async () => {
        await fs.remove(backupDir);
        console.log('Successfully finished building cloaked trackers');
        process.exit(0);
    })
    .catch((e) => {
        console.log('Building cloaked trackers finished with an error', e);
        process.exit(1);
    });
