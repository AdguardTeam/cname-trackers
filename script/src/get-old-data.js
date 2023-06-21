const { promises: fs } = require('fs');
const path = require('path');

const {
    JSON_FILE_EXTENSION,
} = require('./constants');

const DATA_DIR_PATH = './../data';

/**
 * Gets old information from JSON files from the 'data' directory folders
 * @param {Array<fs.Dirent>} dirNames
 * @returns {object}
 */
const getOldData = async (dirNames) => {
    // object where old trackers information will be written to.
    const oldRawDataObject = {};
    // get only directory names without combined files
    const onlyDirNames = dirNames.filter((dirName) => dirName.isDirectory()).map((dirName) => dirName.name);
    // collect old data from JSONs
    const getJsonData = onlyDirNames.map(async (dir) => {
        // folder path
        const dirPath = path.resolve(DATA_DIR_PATH, dir);

        // get all filenames from directory
        const dirFiles = await fs.readdir(dirPath);
        // leave json files only
        const jsonFiles = dirFiles.filter((file) => path.extname(file) === `.${JSON_FILE_EXTENSION}`);

        // write trackers from JSON files to the oldRawData object
        const writeJsonData = jsonFiles.map(async (file) => {
            // company name for the key
            const fileName = file.replace('.json', '');
            // trackers data
            const fileContent = await fs.readFile(path.resolve(dirPath, file));
            // record old data by company name key
            oldRawDataObject[fileName] = JSON.parse(fileContent);
        });

        await Promise.all(writeJsonData);
    });

    await Promise.all(getJsonData);

    return oldRawDataObject;
};

module.exports = {
    getOldData,
};
