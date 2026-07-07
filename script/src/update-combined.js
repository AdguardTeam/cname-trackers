const { promises: fs } = require('fs');
const path = require('path');

const {
    composeRuleWithNewline,
    writeCombinedFile,
    createCombinedFileName,
    DATA_DIR_PATH,
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
 * Reads a JSON file containing original tracker data, processes it
 * for each specified rule type, and writes the combined results to a file.
 *
 * @param {string[]} ruleTypes The rule types for which the combined trackers
 * should be updated. Each should correspond to a key in FORMATS.ORIGINALS.
 *
 * @throws {Error} If an unknown rule type is provided.
 */
const updateCombinedOriginals = async (...ruleTypes) => {
    const originalTrackersContent = await fs.readFile(path.resolve(__dirname, ORIGINALS_FILE_NAME));
    const originalTrackers = JSON.parse(originalTrackersContent);

    ruleTypes.forEach(async (ruleType) => {
        const originalData = FORMATS.ORIGINALS[ruleType];
        if (!originalData) {
            throw new Error(`Unknown type: ${ruleType}`);
        }
        let originalTrackersCombinedChunks = `${originalData.combinedHeader}\n`;
        originalTrackers
            .forEach(({ company_name: companyName, domains }) => {
                originalTrackersCombinedChunks += `${originalData.commentMarker}\n`;
                originalTrackersCombinedChunks += `${originalData.commentMarker} Company: ${companyName}\n`;
                domains.forEach((domain) => {
                    originalTrackersCombinedChunks += composeRuleWithNewline[ruleType](domain);
                });
            });
        await writeCombinedFile(originalData.combinedFileName, originalTrackersCombinedChunks);
    });
};

/**
 * Builds the combined disguised files for each company type by reading the
 * per-company JSON files that index.js already wrote to disk during the run.
 *
 * Reading from disk (instead of holding one giant in-memory object across the
 * whole fetch loop) keeps peak heap at O(one type) instead of O(all types) and
 * removes the O(n^2) spread-copy that caused the build to OOM (AG-54208).
 *
 * @param {string[]} companyTypes plural type directory names, e.g. ['ads', 'trackers']
 * @param {string} [dataDirPath=DATA_DIR_PATH] data directory to read from / write to
 */
const updateCombinedDisguises = async (companyTypes, dataDirPath = DATA_DIR_PATH) => {
    await Promise.all(companyTypes.map(async (companyType) => {
        const typeDir = path.resolve(dataDirPath, companyType);

        // Per-company JSON files are written to disk during the run (index.js).
        // Read them back here instead of keeping the whole dataset in memory.
        let jsonFiles = [];
        try {
            jsonFiles = (await fs.readdir(typeDir))
                .filter((file) => file.endsWith(`.${JSON_FILE_EXTENSION}`))
                .sort(); // deterministic merge order for reproducible output
        } catch (e) {
            // No companies of this type succeeded (dir missing) — nothing to combine.
            return;
        }

        const companyDataList = await Promise.all(
            jsonFiles.map(async (jsonFile) => {
                const fileContent = await fs.readFile(path.resolve(typeDir, jsonFile), 'utf8');
                return JSON.parse(fileContent);
            }),
        );

        const mergedJsonData = companyDataList.reduce(
            (acc, companyData) => Object.assign(acc, companyData),
            {},
        );

        const sortedDisguiseTrackers = Object.keys(mergedJsonData).sort();
        const sortedDisguiseJsonData = sortedDisguiseTrackers.reduce((acc, key) => {
            acc[key] = mergedJsonData[key];
            return acc;
        }, {});

        await writeCombinedFile(
            createCombinedFileName(companyType, JSON_FILE_EXTENSION),
            JSON.stringify(sortedDisguiseJsonData, null, 2),
            dataDirPath,
        );

        let baseCombinedContent = `${getBaseRulesCombinedHeader(companyType)}\n`;
        let hostsCombinedContent = `${getHostsRulesCombinedHeader(companyType)}\n`;
        let rpzCombinedContent = `${getRpzRulesCombinedHeader(companyType)}\n`;

        sortedDisguiseTrackers.forEach((disguise) => {
            baseCombinedContent += composeRuleWithNewline[FORMATS.BASE.type](disguise);
            hostsCombinedContent += composeRuleWithNewline[FORMATS.HOSTS.type](disguise);
            rpzCombinedContent += composeRuleWithNewline[FORMATS.RPZ.type](disguise);
        });

        await Promise.all([
            writeCombinedFile(
                createCombinedFileName(companyType, RULES_FILE_EXTENSION),
                baseCombinedContent,
                dataDirPath,
            ),
            writeCombinedFile(
                createCombinedFileName(companyType, RULES_FILE_EXTENSION, HOSTS_RULES_FILE_NAME_ENDING),
                hostsCombinedContent,
                dataDirPath,
            ),
            writeCombinedFile(
                createCombinedFileName(companyType, RULES_FILE_EXTENSION, RPZ_RULES_FILE_NAME_ENDING),
                rpzCombinedContent,
                dataDirPath,
            ),
        ]);
    }));
};

/**
 * Update the combined files for all company types, including originals and disguised.
 *
 * @param {string[]} companyTypes Plural type directory names, e.g. ['ads', 'trackers'].
 * @param {string} dataDirPath Data directory to read from / write to.
 */
const updateCombined = async (companyTypes, dataDirPath = DATA_DIR_PATH) => Promise.all([
    updateCombinedOriginals(FORMATS.BASE.type, FORMATS.HOSTS.type),
    updateCombinedDisguises(companyTypes, dataDirPath),
]);

module.exports = { updateCombined, updateCombinedDisguises };
