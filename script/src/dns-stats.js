// DNS timing instrumentation for helpers.resolveCname.
//
// qps  = count / phaseWallMs  — true end-to-end throughput (use to tune DNS_CONCURRENCY).
// avgMs = mean per-lookup latency — resolver health; climbs past the throughput knee.
// cumulativeMs = SUM of per-lookup latencies (NOT wall-clock); do not derive throughput from it.
//
// Per-phase counters reset per company; grand totals span the whole build.
// reset() and summarize() are paired per phase; summarize() folds phase
// wall-clock into the grand total.

const makeCounter = () => ({
    count: 0,
    cumulativeMs: 0, // sum of per-lookup latencies (NOT wall-clock)
    maxMs: 0,
    timeouts: 0,
});

const phase = makeCounter();
let phaseStartedAt = Date.now();

// grand totals across the whole build (never reset)
const grand = makeCounter();
let grandWallMs = 0;

/**
 * Record one resolved (or timed-out) lookup.
 * @param {number} elapsedMs wall-clock duration of the lookup
 * @param {boolean} [timedOut=false] whether it hit the hard timeout
 */
const record = (elapsedMs, timedOut = false) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const c of [phase, grand]) {
        c.count += 1;
        c.cumulativeMs += elapsedMs;
        if (elapsedMs > c.maxMs) {
            c.maxMs = elapsedMs;
        }
        if (timedOut) {
            c.timeouts += 1;
        }
    }
};

/** Reset per-phase counters (e.g. at the start of each company). */
const reset = () => {
    phase.count = 0;
    phase.cumulativeMs = 0;
    phase.maxMs = 0;
    phase.timeouts = 0;
    phaseStartedAt = Date.now();
};

/**
 * @returns {{count:number,wallMs:number,cumulativeMs:number,maxMs:number,timeouts:number,qps:number,avgMs:number}}
 */
const summarize = () => {
    const wallMs = Date.now() - phaseStartedAt;
    grandWallMs += wallMs;
    return {
        count: phase.count,
        wallMs,
        cumulativeMs: Math.round(phase.cumulativeMs),
        maxMs: Math.round(phase.maxMs),
        timeouts: phase.timeouts,
        qps: wallMs > 0 ? Math.round((phase.count / wallMs) * 1000) : 0,
        avgMs: phase.count > 0 ? Math.round(phase.cumulativeMs / phase.count) : 0,
    };
};

/**
 * @returns {{count:number,wallMs:number,timeouts:number,qps:number}}
 */
const grandTotal = () => ({
    count: grand.count,
    wallMs: grandWallMs,
    timeouts: grand.timeouts,
    qps: grandWallMs > 0 ? Math.round((grand.count / grandWallMs) * 1000) : 0,
});

module.exports = {
    record,
    reset,
    summarize,
    grandTotal,
};
