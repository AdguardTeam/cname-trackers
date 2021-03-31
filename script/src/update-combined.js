const { promises: fs } = require('fs');
const path = require('path');
const {
    RULES_FILE_EXTENSION,
    INFO_FILE_EXTENSION,
    COMBINED_JSON_FILE_NAME,
    HOSTS_RULES_FILE_NAME_ENDING,
    CONST_DATA,
} = require('./constants');
const { formatFilename } = require('./helpers');

const ROOT_DIR_PATH = '../../';
const TRACKERS_DIR_PATH = '../../trackers';
const ORIGINALS_FILE_NAME = './cloaked-trackers.json';

const combineFiles = async (filesToCollect, header) => {
    const combinedChunks = [header];
    const filesChunks = await Promise.all(filesToCollect
        .map(async (rulesFileName) => {
            const rulesFileContent = await fs.readFile(
                path.resolve(__dirname, TRACKERS_DIR_PATH, rulesFileName),
            );
            return rulesFileContent;
        }));
    combinedChunks.push(...filesChunks);
    return combinedChunks.join('\n');
};

const updateCombined = async () => {
    // update combined_original_trackers.txt
    const originalTrackersCombinedChunks = [CONST_DATA.ORIGINALS.combinedHeader];
    const originalTrackersContent = await fs.readFile(
        path.resolve(__dirname, ORIGINALS_FILE_NAME),
    );
    const originalTrackers = JSON.parse(originalTrackersContent);
    originalTrackers
        .forEach(({ company_name: companyName, domains }) => {
            originalTrackersCombinedChunks.push(`${CONST_DATA.ORIGINALS.commentMarker}`);
            originalTrackersCombinedChunks.push(`${CONST_DATA.ORIGINALS.commentMarker} Company: ${companyName}`);
            domains.forEach((domain) => {
                originalTrackersCombinedChunks.push(`||${domain}^`);
            });
        });
    await fs.writeFile(
        path.resolve(__dirname, ROOT_DIR_PATH, CONST_DATA.ORIGINALS.combinedFileName),
        originalTrackersCombinedChunks.join('\n'),
    );

    // update base and hosts rules combined files
    const companyFileNames = originalTrackers
        .map(({ company_name: companyName }) => formatFilename(companyName));

    const baseRulesFileNames = companyFileNames.map((rawFileName) => {
        const baseFileName = `${rawFileName}.${RULES_FILE_EXTENSION}`;
        return baseFileName;
    });
    const hostsRulesFileNames = companyFileNames.map((rawFileName) => {
        const hostsFileName = `${rawFileName}${HOSTS_RULES_FILE_NAME_ENDING}.${RULES_FILE_EXTENSION}`;
        return hostsFileName;
    });

    const baseCombinedStr = await combineFiles(
        baseRulesFileNames, CONST_DATA.BASE.combinedHeader,
    );
    const hostsCombinedStr = await combineFiles(
        hostsRulesFileNames, CONST_DATA.HOSTS.combinedHeader,
    );

    await fs.writeFile(
        path.resolve(__dirname, ROOT_DIR_PATH, CONST_DATA.BASE.combinedFileName),
        baseCombinedStr,
    );
    await fs.writeFile(
        path.resolve(__dirname, ROOT_DIR_PATH, CONST_DATA.HOSTS.combinedFileName),
        hostsCombinedStr,
    );

    // update combined_disguise_trackers.json
    const jsonFileNames = companyFileNames.map((rawFileName) => {
        const baseFileName = `${rawFileName}.${INFO_FILE_EXTENSION}`;
        return baseFileName;
    });
    const jsons = await Promise.all(jsonFileNames
        .map(async (fileName) => {
            const jsonFileContent = await fs.readFile(
                path.resolve(__dirname, TRACKERS_DIR_PATH, fileName),
            );
            return JSON.parse(jsonFileContent);
        }));
    const combined = Object.assign(...jsons);
    await fs.writeFile(
        path.resolve(__dirname, ROOT_DIR_PATH, COMBINED_JSON_FILE_NAME),
        JSON.stringify(combined, null, 2),
    );
};

module.exports = { updateCombined };
