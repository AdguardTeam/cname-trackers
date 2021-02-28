const replace = (str, replaceable, replacement) => str
    .split(replaceable)
    .map((word) => word.trim())
    .filter((i) => i)
    .join(replacement);

const formatFilename = (companyName) => {
    const lowerCased = companyName.toLowerCase();
    const dashed = replace(lowerCased, ' ', '-');
    const lowerDashed = replace(dashed, '.', '_');
    return lowerDashed;
};

const sleep = (timeout) => new Promise((resolve) => {
    setTimeout(resolve, timeout);
});

const sortAscending = (a, b) => {
    if (a > b) {
        return 1;
    }

    if (a < b) {
        return -1;
    }

    return 0;
};

module.exports = {
    formatFilename,
    sleep,
    sortAscending,
};
