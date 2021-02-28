/* eslint-disable no-shadow */
const axios = require('axios');
const { sleep } = require('./helpers');
const { RETRY_TIMOUT_MS, MAX_RETRIES_COUNT } = require('../config');

const CLOAKED_API = 'https://urlfilter.adtidy.org/v1/findCloaked';
const IN_PROGRESS_STATUS = 'Operation in progress';

// First request to api returns url, with oid, we should use it in the retrying requests
const makeRequestToApi = async (domain, oid) => {
    const requestUrl = new URL(CLOAKED_API);
    requestUrl.searchParams.append('domain', domain);

    if (oid) {
        requestUrl.searchParams.append('oid', oid);
    }

    return axios.get(requestUrl.toString());
};

const getOid = (url) => {
    const responseUrl = new URL(url);
    return responseUrl.searchParams.get('oid');
};

const fetchWithRetry = async (domain) => {
    const retryFn = async (domain, oid, retryCount = 1) => {
        if (retryCount > MAX_RETRIES_COUNT) {
            throw new Error('Max retries count reached');
        }

        let response;

        try {
            response = await makeRequestToApi(domain, oid);
        } catch (e) {
            await sleep(RETRY_TIMOUT_MS);
            return retryFn(domain, oid, retryCount + 1);
        }

        if (!response || (response && !response.data)) {
            await sleep(RETRY_TIMOUT_MS);
            return retryFn(domain, oid, retryCount + 1);
        }

        if (response.data.status === IN_PROGRESS_STATUS) {
            const { responseUrl } = response.request.res;
            const oid = getOid(responseUrl);
            await sleep(RETRY_TIMOUT_MS);
            return retryFn(domain, oid, retryCount + 1);
        }

        return response.data;
    };

    return retryFn(domain, null);
};

const fetchTrackers = fetchWithRetry;

module.exports = {
    fetchTrackers,
};
