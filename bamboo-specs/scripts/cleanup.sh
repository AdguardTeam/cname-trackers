#!/bin/bash

# WARNING: this script intentionally wipes the entire Bamboo agent workspace.
# Do NOT run it outside a disposable Bamboo CI environment.

# Cleanup script that preserves specified artifacts
# Usage: ./bamboo-specs/scripts/cleanup.sh "artifact1,artifact2,artifact3"

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status.
#  -x: Print each command to the terminal as it is executed.
set -ex

# Fix mixed logs
exec 2>&1

# CI guard: prevent accidental local execution which would destroy the working tree.
if [[ -z "${bamboo_buildNumber:-}" ]]; then
    echo "ERROR: this script must only run in a Bamboo CI environment" >&2
    exit 1
fi

echo "Size before cleanup:" && du -h | tail -n 1
echo "Top 5 files:" && du -h | sort -hr | head -n 5

# Parse artifacts from command line argument
ARTIFACTS_ARG="${1:-}"
if [ -z "$ARTIFACTS_ARG" ]; then
    echo "No artifacts specified, cleaning entire workspace"
    ARTIFACTS=()
else
    IFS=',' read -ra ARTIFACTS <<< "$ARTIFACTS_ARG"
    echo "Preserving artifacts: ${ARTIFACTS[*]}"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Stash artifacts to /tmp
for f in "${ARTIFACTS[@]}"; do
    [ -e "$f" ] || continue
    echo "Stashing artifact: $f"
    mkdir -p "$TMP/$(dirname "$f")"
    mv "$f" "$TMP/$f"
done

# Intentionally wipe the entire workspace (including .git).
# This runs only in Bamboo disposable agent workspaces — the goal is to
# guarantee a clean state after the build so no artifacts bleed into the
# next build on the same agent.
find . -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +

# Restore artifacts
for f in "${ARTIFACTS[@]}"; do
    [ -e "$TMP/$f" ] || continue
    echo "Restoring artifact: $f"
    mkdir -p "$(dirname "$f")"
    mv "$TMP/$f" "$f"
done

echo "Size after cleanup:" && du -h | tail -n 1
echo "Top 5 files:" && du -h | sort -hr | head -n 5

echo "Cleanup completed successfully"
