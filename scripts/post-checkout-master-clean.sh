#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel)"
current_branch="$(git -C "$repo_root" symbolic-ref --quiet --short HEAD || true)"

if [[ "$current_branch" == "master" ]]; then
  git -C "$repo_root" clean -fdx
fi
