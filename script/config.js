const DATA_DIR = '../data';
const BACKUP_DATA_DIR = './temp';
const CLOAKED_TRACKERS_FILE = './src/cloaked-trackers.json';
const RETRY_TIMOUT_MS = 30 * 1000;
const MAX_RETRIES_COUNT = 40; // 20 minutes

// Max number of domains fetched in parallel per company. findCloaked does
// heavy work, keep modest. 5 is a sequential->parallel jump NOT yet validated
// against API rate limits — if CI fails on fetches, lower via env first.
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY) || 5;

// DNS CNAME knobs (src/helpers.js). Env-overridable; tune via dns-stats CI
// output (qps / avg latency / timeouts).
const DNS_TIMEOUT_MS = Number(process.env.DNS_TIMEOUT_MS) || (5 * 1000); // per-lookup hard timeout; without it an unresponsive resolver hangs the build
const DNS_CONCURRENCY = Number(process.env.DNS_CONCURRENCY) || 500; // parallel lookups; ~500 is the throughput knee (~1000 qps), past it qps collapses

module.exports = {
    BACKUP_DATA_DIR,
    DATA_DIR,
    CLOAKED_TRACKERS_FILE,
    RETRY_TIMOUT_MS,
    MAX_RETRIES_COUNT,
    FETCH_CONCURRENCY,
    DNS_TIMEOUT_MS,
    DNS_CONCURRENCY,
};
