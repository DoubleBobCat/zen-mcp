#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hook_path="$repo_root/.git/hooks/post-checkout"
install -m 0755 "$repo_root/scripts/post-checkout-master-clean.sh" "$hook_path"
echo "Installed master workspace cleanup hook at $hook_path"
