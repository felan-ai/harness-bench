#!/usr/bin/env bash
# Rebuild evals/fixtures/felan-multirepo/v1/source from pinned upstream commits.
#
# The fixture is ~35 MB of verbatim `git archive` export, so it is not committed.
# Regenerate it before running the codebase-memory-queries-multirepo benchmark.
#
#   scripts/build-multirepo-fixture.sh [<felan-repo> <felan-platform-repo>]
#
# Defaults to sibling checkouts next to harness-bench. Pass explicit paths, or
# set FELAN_REPO / FELAN_PLATFORM_REPO, if yours live elsewhere.
set -euo pipefail

FELAN_COMMIT=7ae8f94e72095a8bc38bf62b902164d2717f3294
PLATFORM_COMMIT=b0cec02ab0f48b38287aeec1e50b798acbaf2e17

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FELAN_REPO="${1:-${FELAN_REPO:-$ROOT/../felan}}"
PLATFORM_REPO="${2:-${FELAN_PLATFORM_REPO:-$ROOT/../felan-platform}}"
DEST="$ROOT/evals/fixtures/felan-multirepo/v1/source"

export_at() {  # $1=repo $2=commit $3=target
  if [ ! -d "$1/.git" ]; then
    echo "error: $1 is not a git repository" >&2; exit 1
  fi
  if ! git -C "$1" cat-file -e "$2^{commit}" 2>/dev/null; then
    echo "error: commit $2 not found in $1 — fetch it first" >&2; exit 1
  fi
  mkdir -p "$3"
  git -C "$1" archive "$2" | tar -x -C "$3"
}

rm -rf "$DEST"
export_at "$FELAN_REPO"    "$FELAN_COMMIT"    "$DEST/felan"
export_at "$PLATFORM_REPO" "$PLATFORM_COMMIT" "$DEST/felan-platform"

echo "felan          $(find "$DEST/felan" -type f | wc -l | tr -d ' ') files @ ${FELAN_COMMIT:0:7}"
echo "felan-platform $(find "$DEST/felan-platform" -type f | wc -l | tr -d ' ') files @ ${PLATFORM_COMMIT:0:7}"
echo "total          $(du -sh "$DEST" | cut -f1) at $DEST"
echo
echo "Expect 555 and 2426 files. A mismatch means the commit moved or the export was filtered."
