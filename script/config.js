const TRACKERS_DIR = '../trackers';
const CLOAKED_TRACKERS_FILE = './src/cloaked-trackers.json';
const RETRY_TIMOUT_MS = 30 * 1000;
const MAX_RETRIES_COUNT = 40; // 20 minutes

module.exports = {
    TRACKERS_DIR,
    CLOAKED_TRACKERS_FILE,
    RETRY_TIMOUT_MS,
    MAX_RETRIES_COUNT,
};
