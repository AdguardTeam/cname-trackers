// Lightweight DNS timing instrumentation for the build.
//
// Wraps the lowest-level CNAME resolver (helpers.resolveCname) to count
// lookups, accumulate wall-clock time, track the slowest lookup, and count
// timeouts. That's enough to derive effective qps in CI and decide whether
// DNS_CONCURRENCY / DNS_TIMEOUT_MS need tuning for the CI resolver.
//
// Per-phase counters are resettable (per company); grand totals accumulate
// across the whole build.

let count = 0;
let totalMs = 0;
let maxMs = 0;
let timeouts = 0;

// grand totals across the whole build (never reset)
let totalCount = 0;
let totalTotalMs = 0;
let totalTimeouts = 0;

/**
 * Record one resolved (or timed-out) lookup.
 * @param {number} elapsedMs wall-clock duration of the lookup
 * @param {boolean} [timedOut=false] whether it hit the hard timeout
 */
const record = (elapsedMs, timedOut = false) => {
    count += 1;
    totalMs += elapsedMs;
    if (elapsedMs > maxMs) {
        maxMs = elapsedMs;
    }
    if (timedOut) {
        timeouts += 1;
    }

    totalCount += 1;
    totalTotalMs += elapsedMs;
    if (timedOut) {
        totalTimeouts += 1;
    }
};

/** Reset per-phase counters (e.g. at the start of each company). */
const reset = () => {
    count = 0;
    totalMs = 0;
    maxMs = 0;
    timeouts = 0;
};

/** @returns {{count:number,totalMs:number,maxMs:number,timeouts:number,qps:number}} */
const summarize = () => ({
    count,
    totalMs: Math.round(totalMs),
    maxMs: Math.round(maxMs),
    timeouts,
    qps: totalMs > 0 ? Math.round((count / totalMs) * 1000) : 0,
});

/** @returns {{count:number,totalMs:number,timeouts:number}} */
const grandTotal = () => ({
    count: totalCount,
    totalMs: Math.round(totalTotalMs),
    timeouts: totalTimeouts,
});

module.exports = {
    record,
    reset,
    summarize,
    grandTotal,
};
