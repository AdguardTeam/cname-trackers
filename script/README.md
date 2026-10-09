### Usage

This is a script that we use to update this directory.

```
yarn install
yarn start
```

### How it works

1. Script takes config file `cloaked-trackers.json` and fetches data for each company.
2. Fetched data is merged with the old data, which is stashed for each company in JSON files in the per-type directories (for example, `ads/` or `mail_trackers/`). If there are removed items, they are validated by [dnsPromises.resolveCname()](https://nodejs.org/api/dns.html#dns_dnspromises_resolvecname_hostname).
3. Merged data is stashed to JSON files with `disguise` as keys and its final cname in the cname chain as the value.
4. Description and rules files for each company are built from the merged data.
5. After the run, the combined files are rebuilt from the per-company JSON files.

### Sharded runs

The CI build runs in parallel shards. Each shard processes a deterministic
subset of trackers; trackers heavier than 50k stored disguises are split by a
stable disguise hash:

```sh
SHARD_INDEX=0 SHARD_COUNT=6 yarn start
```

Each shard runs on a fresh checkout and writes a partial `data/`: split
trackers write `__part-*` files instead of canonical files. CI overlays every
shard's `data/` onto the full `data/` from the repository, then the combine job
merges the parts and rebuilds the combined files:

```sh
yarn combine
```

Running these two commands in one checkout is not a valid local flow: the
shard run moves `data/` away, so `yarn combine` would rebuild from that shard's
subset only. Leftover `__part-*` files also confuse a later plain `yarn start`
— remove them first.
