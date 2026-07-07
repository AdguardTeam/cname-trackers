FROM adguard/node-ssh:22.17--0 AS base
SHELL ["/bin/bash", "-lc"]

WORKDIR /cname-trackers

# ============================================================================
# Stage: deps
# Cached until script/package.json or script/yarn.lock changes
# ============================================================================
FROM base AS deps

COPY script/package.json script/yarn.lock ./script/

RUN cd script && yarn install --frozen-lockfile

# ============================================================================
# Stage: test-output
# Lints and tests the script in CI (.github/workflows/ci.yml) via
# `docker build --target test-output .`. Does not need the data/ directory;
# node_modules come from the deps stage.
# ============================================================================
FROM deps AS test-output

# Copy script source files (node_modules already present from deps)
COPY script/ ./script/

RUN cd script && yarn lint && yarn test

# ============================================================================
# Stage: build
# Copies existing data/ (needed for merge logic) and runs the script.
# The script reads from ../data (= /cname-trackers/data/) and writes back
# updated tracker lists to the same directory.
# ============================================================================
FROM deps AS build

# Copy existing data/ so the script can merge old data with newly fetched data
COPY data/ ./data/

# Copy script source files
COPY script/ ./script/

# Safety net: the combined-file build now streams per-company JSON from disk
# instead of accumulating everything in memory, but keep a generous
# heap ceiling against future data growth. AG-54208.
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN cd script && yarn start

# ============================================================================
# Stage: build-output
# Exports updated data/ for extraction with --output
# ============================================================================
FROM scratch AS build-output
COPY --from=build /cname-trackers/data/ /data/
