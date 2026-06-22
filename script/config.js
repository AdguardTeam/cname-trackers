const DATA_DIR = '../data';
const BACKUP_DATA_DIR = './temp';
const CLOAKED_TRACKERS_FILE = './src/cloaked-trackers.json';
const RETRY_TIMOUT_MS = 30 * 1000;
const MAX_RETRIES_COUNT = 40; // 20 minutes
// Max number of domains fetched in parallel per company.
// The findCloaked API does heavy work, so keep this modest.
const FETCH_CONCURRENCY = 5;

module.exports = {
    BACKUP_DATA_DIR,
    DATA_DIR,
    CLOAKED_TRACKERS_FILE,
    RETRY_TIMOUT_MS,
    MAX_RETRIES_COUNT,
    FETCH_CONCURRENCY,
};
