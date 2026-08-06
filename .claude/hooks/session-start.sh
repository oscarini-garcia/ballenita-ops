#!/bin/bash
# Hook de arranque de sesión: deja el repositorio listo y cuenta dónde mirar.
#
# Lo que va a stdout se inyecta en el contexto de la sesión, así que aquí solo se
# escribe lo que merece la pena leer: el mapa del repositorio y el estado vivo de
# git. El ruido (un `npm install` de 500 paquetes) se manda a stderr.
#
# Dos reglas que este guion NO puede romper:
#
#   1. No escribe nada en el árbol de trabajo. El mapa se genera con `--contexto`,
#      que va a stdout; el fichero versionado se regenera a mano o lo pide la
#      integración continua, nunca una sesión al abrirse. Un hook que escribiera
#      dejaría cada sesión empezando con cambios sin commitear que no son tuyos.
#   2. No impide arrancar. Si el generador falla, la sesión entra igual con un
#      aviso: quedarse sin mapa es una molestia, no poder trabajar es otra cosa.
#
# El mapa se genera EN ESTE INSTANTE a partir del código que hay delante, y no se
# lee `docs/mapa.md`. Es justo lo que hace que se mantenga solo: un resumen
# guardado se desfasa en silencio, y este no puede.

set -uo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$RAIZ" || exit 0

# ── Dependencias de la PWA, solo en el entorno remoto (aquí el repo llega limpio) ──
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -d app ]; then
  (cd app && npm install --no-audit --no-fund >&2) || \
    echo "⚠️ npm install falló en app/; los tests pueden no correr." >&2
fi

# ── El mapa, generado ahora mismo leyendo el código ──
if mapa=$(node herramientas/mapa.mjs --contexto 2>/dev/null) && [ -n "$mapa" ]; then
  printf '%s\n' "$mapa"
else
  echo "⚠️ No se pudo generar el mapa del repositorio (herramientas/mapa.mjs)."
  echo "   La sesión arranca igual. Corre \`node herramientas/mapa.mjs --contexto\` para ver el error."
  echo "   Mientras tanto, empieza por CLAUDE.md y docs/SPECS.md."
fi

# ── Estado vivo: esto sí cambia entre sesiones y no sale del código ──
echo
echo "## Estado del repositorio ahora mismo"
echo
echo "Rama \`$(git branch --show-current 2>/dev/null || echo '?')\`, últimos commits:"
echo
git log --oneline -5 2>/dev/null | sed 's/^/- /'
echo

sin_commitear=$(git status --porcelain 2>/dev/null)
if [ -z "$sin_commitear" ]; then
  echo "Árbol de trabajo limpio."
else
  echo "**Sin commitear** ($(printf '%s\n' "$sin_commitear" | wc -l | tr -d ' ') ficheros):"
  echo
  printf '%s\n' "$sin_commitear" | head -20 | sed 's/^\(..\) /- `\1` `/;s/$/`/'
fi
