#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ARTIFACTS_DIR="${1:-$ROOT_DIR/build/artifacts}"
if [[ "$ARTIFACTS_DIR" != /* ]]; then
  ARTIFACTS_DIR="$ROOT_DIR/$ARTIFACTS_DIR"
fi
shopt -s nullglob
artifacts=("$ARTIFACTS_DIR"/*)
if (( ${#artifacts[@]} < 4 )); then
  echo "Expected XPI and three static bridge packages in $ARTIFACTS_DIR" >&2
  exit 1
fi
printf '%s\n' "${artifacts[@]}"
