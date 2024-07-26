/* eslint-disable guard-for-in */
const { promises: fs } = require('fs');
const path = require('path');

const {
    composeRuleWithNewline,
    writeCombinedFile,
    createCombinedFileName,
} = require('./helpers');

const {
    JSON_FILE_EXTENSION,
    RULES_FILE_EXTENSION,
    HOSTS_RULES_FILE_NAME_ENDING,
    RPZ_RULES_FILE_NAME_ENDING,
    CONST_DATA,
    getBaseRulesCombinedHeader,
    getHostsRulesCombinedHeader,
    getRpzRulesCombinedHeader,
} = require('./constants');

const ORIGINALS_FILE_NAME = './cloaked-trackers.json';

/**
 * Gets domains from cloaked-trackers.json, converts them to basic adblocker-type rules,
 * and saves to combined_original_trackers.txt in root of repository
 * @returns {Promise<void>}
*/
const updateCombinedOriginals = async () => {
    // write header into the file
    let originalTrackersCombinedChunks = `${CONST_DATA.ORIGINALS.combinedHeader}\n`;

    // read cloaked-trackers.json
    const originalTrackersContent = await fs.readFile(path.resolve(__dirname, ORIGINALS_FILE_NAME));

    // parse originalTrackersContent in object
    const originalTrackers = JSON.parse(originalTrackersContent);

    // add data in combined_original_trackers.txt
    originalTrackers
        .forEach(({ company_name: companyName, domains }) => {
            originalTrackersCombinedChunks += `${CONST_DATA.ORIGINALS.commentMarker}\n`;
            originalTrackersCombinedChunks += `${CONST_DATA.ORIGINALS.commentMarker} Company: ${companyName}\n`;

            domains.forEach((domain) => {
                originalTrackersCombinedChunks += composeRuleWithNewline.baseRule(domain);
            });
        });

    // write combined_original_trackers.txt
    await writeCombinedFile(CONST_DATA.ORIGINALS.combinedFileName, originalTrackersCombinedChunks);
};

/**
 * Generates combined disguises files by type
 * @returns {Promise<void>}
*/
const updateCombinedDisguises = async (rawCombinedData) => {
    // convert object into array with sorted by key key-value pairs
    const combinedData = Object.entries(rawCombinedData);

    await Promise.all(combinedData.map(async ([type, jsonDataObject]) => {
        // sort keys in jsonDataObject
        const sortedDisguiseTrackers = Object.keys(jsonDataObject).sort();
        // add values to sorted keys
        const sortedDisguiseJsonData = sortedDisguiseTrackers.reduce((acc, key) => {
            acc[key] = jsonDataObject[key];
            return acc;
        }, {});

        // write combined_disguised_companyType.json
        await writeCombinedFile(
            createCombinedFileName(type, JSON_FILE_EXTENSION),
            JSON.stringify(sortedDisguiseJsonData, null, 2),
        );

        // add headers to base, hosts, rpz files
        let baseCombinedContent = `${getBaseRulesCombinedHeader(type)}\n`;
        let hostsCombinedContent = `${getHostsRulesCombinedHeader(type)}\n`;
        let rpzCombinedContent = `${getRpzRulesCombinedHeader(type)}\n`;

        // add content to base, hosts, rpz files from sorted keys combined_disguised_companyType.json
        sortedDisguiseTrackers.forEach((disguise) => {
            baseCombinedContent += composeRuleWithNewline.baseRule(disguise);
            hostsCombinedContent += composeRuleWithNewline.hostsRule(disguise);
            rpzCombinedContent += composeRuleWithNewline.rpzRule(disguise);
        });

        // write content to base, hosts, rpz files
        await Promise.all([
            writeCombinedFile(
                createCombinedFileName(type, RULES_FILE_EXTENSION),
                baseCombinedContent,
            ),
            writeCombinedFile(
                createCombinedFileName(type, RULES_FILE_EXTENSION, HOSTS_RULES_FILE_NAME_ENDING),
                hostsCombinedContent,
            ),
            writeCombinedFile(
                createCombinedFileName(type, RULES_FILE_EXTENSION, RPZ_RULES_FILE_NAME_ENDING),
                rpzCombinedContent,
            ),
        ]);
    }));
};

/**
 * Updates `combined_`-files in repo root directory
 * @returns {Promise<void>}
 */
const updateCombined = async (rawCombinedData) => Promise.all([
    updateCombinedOriginals(),
    updateCombinedDisguises(rawCombinedData),
]);

module.exports = { updateCombined };
