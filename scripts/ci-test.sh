#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
npm --prefix "$ROOT_DIR/build/extension" run test
npm --prefix "$ROOT_DIR/build/extension" run bridge:test
npm --prefix "$ROOT_DIR/build/extension" run typecheck
DOC_VALIDATOR="$HOME/.config/opencode/skills/documentation-first-engineering/scripts/validate-docs.sh"
if [[ -x "$DOC_VALIDATOR" ]]; then
  bash "$DOC_VALIDATOR" validate "$ROOT_DIR"
else
  for required_doc in \
    docs/Vision.md docs/PRD.md docs/SRS.md docs/Architecture.md \
    docs/specs/Plugin-Spec.md docs/specs/MCP-Spec.md \
    docs/specs/Workflow-Spec.md docs/specs/Event-Spec.md \
    docs/Database-Design.md docs/Roadmap.md docs/Test-Plan.md \
    docs/Deployment.md docs/Operation.md docs/API/openapi.yaml; do
    test -f "$ROOT_DIR/$required_doc"
  done
fi
