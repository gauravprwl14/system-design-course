#!/usr/bin/env bash
# Run static link validator before committing
# Install: cp .claude/hooks/pre-commit-validate-links.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e
echo "🔍 Checking links..."
cd "$(git rev-parse --show-toplevel)"
node .claude/scripts/validate-links.mjs
echo "✅ Link check passed"
