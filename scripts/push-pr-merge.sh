#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "main" ]]; then
  echo "Check out a feature branch before running this." >&2
  exit 1
fi

git push -u origin HEAD

if ! gh pr view --json url >/dev/null 2>&1; then
  gh pr create --base main --fill
fi

gh pr merge --merge --delete-branch