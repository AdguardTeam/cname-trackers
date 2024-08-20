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
    FORMATS,
    getBaseRulesCombinedHeader,
    getHostsRulesCombinedHeader,
    getRpzRulesCombinedHeader,
} = require('./constants');

const ORIGINALS_FILE_NAME = './cloaked-trackers.json';

/**
 * Updates the combined original trackers file for the specified rule types.
 *
 * This function reads a JSON file containing original tracker data, processes it
 * for each specified rule type, and writes the combined results to a file.
 *
 * @param {string[]} ruleTypes - The rule types for which the combined trackers should be updated.
 * Each rule type should correspond to a key in FORMATS.ORIGINALS.
 * @throws {Error} If an unknown rule type is provided.
 */
const updateCombinedOriginals = async (...ruleTypes) => {
    // read cloaked-trackers.json
    const originalTrackersContent = await fs.readFile(path.resolve(__dirname, ORIGINALS_FILE_NAME));

    // parse originalTrackersContent in object
    const originalTrackers = JSON.parse(originalTrackersContent);

    ruleTypes.forEach(async (ruleType) => {
        // Retrieve the corresponding data for the rule type from FORMATS.ORIGINALS
        const originalData = FORMATS.ORIGINALS[ruleType];
        if (!originalData) {
            throw new Error(`Unknown type: ${ruleType}`);
        }
        let originalTrackersCombinedChunks = `${originalData.combinedHeader}\n`;
        // add data in combined_original_trackers file
        originalTrackers
            .forEach(({ company_name: companyName, domains }) => {
                originalTrackersCombinedChunks += `${originalData.commentMarker}\n`;
                originalTrackersCombinedChunks += `${originalData.commentMarker} Company: ${companyName}\n`;
                domains.forEach((domain) => {
                    originalTrackersCombinedChunks += composeRuleWithNewline[ruleType](domain);
                });
            });
        // write combined_original_trackers.txt
        await writeCombinedFile(originalData.combinedFileName, originalTrackersCombinedChunks);
    });
};

/**
 * Generates combined disguises files by type
 * @returns {Promise<void>}
*/
const updateCombinedDisguises = async (rawCombinedData) => {
    // convert object into array with sorted by key key-value pairs
    const combinedData = Object.entries(rawCombinedData);

    await Promise.all(combinedData.map(async ([companyType, jsonDataObject]) => {
        // sort keys in jsonDataObject
        const sortedDisguiseTrackers = Object.keys(jsonDataObject).sort();
        // add values to sorted keys
        const sortedDisguiseJsonData = sortedDisguiseTrackers.reduce((acc, key) => {
            acc[key] = jsonDataObject[key];
            return acc;
        }, {});

        // write combined_disguised_companyType.json
        await writeCombinedFile(
            createCombinedFileName(companyType, JSON_FILE_EXTENSION),
            JSON.stringify(sortedDisguiseJsonData, null, 2),
        );

        // add headers to base, hosts, rpz files
        let baseCombinedContent = `${getBaseRulesCombinedHeader(companyType)}\n`;
        let hostsCombinedContent = `${getHostsRulesCombinedHeader(companyType)}\n`;
        let rpzCombinedContent = `${getRpzRulesCombinedHeader(companyType)}\n`;

        // add content to base, hosts, rpz files from sorted keys combined_disguised_companyType.json
        sortedDisguiseTrackers.forEach((disguise) => {
            baseCombinedContent += composeRuleWithNewline[FORMATS.BASE.type](disguise);
            hostsCombinedContent += composeRuleWithNewline[FORMATS.HOSTS.type](disguise);
            rpzCombinedContent += composeRuleWithNewline[FORMATS.RPZ.type](disguise);
        });

        // write content to base, hosts, rpz files
        await Promise.all([
            writeCombinedFile(
                createCombinedFileName(companyType, RULES_FILE_EXTENSION),
                baseCombinedContent,
            ),
            writeCombinedFile(
                createCombinedFileName(companyType, RULES_FILE_EXTENSION, HOSTS_RULES_FILE_NAME_ENDING),
                hostsCombinedContent,
            ),
            writeCombinedFile(
                createCombinedFileName(companyType, RULES_FILE_EXTENSION, RPZ_RULES_FILE_NAME_ENDING),
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
    updateCombinedOriginals(FORMATS.BASE.type, FORMATS.HOSTS.type),
    updateCombinedDisguises(rawCombinedData),
]);

module.exports = { updateCombined };
