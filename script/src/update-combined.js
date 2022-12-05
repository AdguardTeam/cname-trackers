const { promises: fs } = require('fs');
const path = require('path');

const {
    createBaseRule,
    createHostsRule,
    createRpzRule,
    writeFile,
} = require('./helpers');

const {
    JSON_FILE_EXTENSION,
    COMBINED_JSON_FILE_NAME,
    CONST_DATA,
} = require('./constants');

const TRACKERS_DIR_PATH = '../../trackers';
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
                originalTrackersCombinedChunks += `${createBaseRule(domain)}\n`;
            });
        });

    // write combined_original_trackers.txt
    await writeFile(CONST_DATA.ORIGINALS.combinedFileName, originalTrackersCombinedChunks);
};

/**
 * Сollects data from jsons and writes the sorted information to files by rule type.
 * @returns {Promise<void>}
*/
const updateCombinedDisguises = async () => {
    const allTrackersFileNames = await fs.readdir(path.resolve(__dirname, TRACKERS_DIR_PATH));

    // get file names of json files from trackers directory
    const jsonFileNames = allTrackersFileNames
        .filter((filename) => path.extname(filename) === `.${JSON_FILE_EXTENSION}`);

    // get trackers jsons data
    const jsonDataObjects = await Promise.all(jsonFileNames
        .map(async (fileName) => {
            const jsonFileContent = await fs.readFile(path.resolve(__dirname, TRACKERS_DIR_PATH, fileName));
            return JSON.parse(jsonFileContent);
        }));

    // remove all duplicates
    const uniqueDisguiseCombinedData = Object.assign(...jsonDataObjects);

    // sort all unique trackers by key
    const sortedDisguiseTrackers = Object.keys(uniqueDisguiseCombinedData).sort();

    // add values to sorted keys
    const sortedDisguiseJsonData = sortedDisguiseTrackers
        .reduce((acc, key) => {
            acc[key] = uniqueDisguiseCombinedData[key];
            return acc;
        }, {});

    // write combined_disguised_trackers.json
    await writeFile(COMBINED_JSON_FILE_NAME, JSON.stringify(sortedDisguiseJsonData, null, 2));

    // add headers to base, hosts, rpz files
    let baseCombinedContent = `${CONST_DATA.BASE.combinedHeader}\n`;
    let hostsCombinedContent = `${CONST_DATA.HOSTS.combinedHeader}\n`;
    let rpzCombinedContent = `${CONST_DATA.RPZ.combinedHeader}\n`;

    // add content to base, hosts, rpz files from sorted keys combined_disguised_trackers.json
    sortedDisguiseTrackers.forEach((disguise) => {
        baseCombinedContent += `${createBaseRule(disguise)}\n`;
        hostsCombinedContent += `${createHostsRule(disguise)}\n`;
        rpzCombinedContent += `${createRpzRule(disguise)}\n`;
    });

    // write content to base, hosts, rpz files
    await Promise.all([
        writeFile(CONST_DATA.BASE.combinedFileName, baseCombinedContent),
        writeFile(CONST_DATA.HOSTS.combinedFileName, hostsCombinedContent),
        writeFile(CONST_DATA.RPZ.combinedFileName, rpzCombinedContent),
    ]);
};

/**
 * Updates `combined_`-files in repo root directory
 * @returns {Promise<void>}
 */
const updateCombined = async () => Promise.all([updateCombinedOriginals(), updateCombinedDisguises()]);

module.exports = { updateCombined };
