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

RUN cd script && yarn start

# ============================================================================
# Stage: build-output
# Exports updated data/ for extraction with --output
# ============================================================================
FROM scratch AS build-output
COPY --from=build /cname-trackers/data/ /data/
