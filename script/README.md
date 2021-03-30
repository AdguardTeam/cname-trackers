### Usage

This is a script that we use to update this directory.

```
yarn install
yarn start
```

### How it works

1. Script takes config file `cloaked-trackers.json` and fetches data for each company.
2. Fetched data is merging to old one which is stashed for each company in json-files in `trackers` directory. If there are removed items, they are validating by [dnsPromises.resolveCname()](https://nodejs.org/api/dns.html#dns_dnspromises_resolvecname_hostname).
3. Merged data stashes to json-files with `disguise` as keys and it's final cname in cname chain as value.
4. Description and rules files for each company are built from merged data.
5. After all combined files updating.