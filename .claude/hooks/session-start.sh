#!/bin/bash
set -euo pipefail

# Solo en Claude Code on the web (entorno remoto).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# La app vive en app/. Instala sus dependencias para que tests y build funcionen.
cd "$CLAUDE_PROJECT_DIR/app"
npm install --no-audit --no-fund
