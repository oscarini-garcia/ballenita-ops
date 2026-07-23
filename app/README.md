# Ballena Ops 🐋 — app (PWA)

Implementación (Fase 0) de la app descrita en [`../docs/SPECS.md`](../docs/SPECS.md).
PWA offline-first para gestionar los eventos del grupo de amigos: gastos estilo
Splitwise **entre familias**, con el motor de reparto y de sincronización heredados
del enfoque de `counter-ops` (§14 del spec).

## Estado actual (Fase 0)

Funciona **en local** (IndexedDB), sin backend todavía:

- ✅ Crear/elegir **eventos** (o cargar el ejemplo «Ballenita 2026»).
- ✅ **Familias, bungas y personas** (con peso de reparto, avatar emoji y estado).
- ✅ **Gastos**: importe, multi-moneda con tipo congelado, categoría, pagador,
  y reparto por persona (con atajo «solo mayores»).
- ✅ **Saldos entre familias** + **liquidación simplificada** + «marcar pagado».
- ✅ **Cenas, Planes, Agenda y Estadísticas.**
- ✅ **Temas** (5 skins + Sistema + Aleatorio diario) en Ajustes.
- ✅ **Motor de reparto** (`src/lib/reparto.js`) y **de merge LWW/tombstone**
  (`src/lib/merge.js`), ambos con tests (`npm test`).
- ✅ **Sincronización** (`src/sync/`): snapshot completo + merge LWW/tombstones +
  transporte JSONBin. Se activa con las variables `VITE_JSONBIN_*`; sin ellas la app
  es solo local. PUT solo si hay cambios; sync al abrir, al volver online/foreground
  y cada 90 s (patrón counter-ops, §14.3).

Pendiente (siguientes fases): login por email mágico y avatares con foto.

### Sincronización — cómo se activa

1. Crea un bin en [JSONBin.io](https://jsonbin.io) y copia su **Bin ID** y **Master Key**.
2. Ponlos en `.env` (ver `.env.example`): `VITE_JSONBIN_ID` y `VITE_JSONBIN_KEY`.
   En GitHub Pages, como **secrets** del repo (inyectados en el build).
3. Listo: los móviles del grupo comparten el mismo documento y convergen (LWW + historial).

## Desarrollo

```bash
npm install
npm run dev         # servidor local
npm test            # toda la suite, una vez
npm run test:watch  # tests en marcha mientras editas (recomendado)
npm run build       # build de producción (PWA)
```

### Tests

Entorno: **Vitest** + **jsdom** + **Testing Library**, con **fake-indexeddb** para
que Dexie funcione sin navegador. Cada test arranca con la base de datos y el
`localStorage` limpios (`src/test/setup.js`).

- `src/lib/reparto.test.js` — motor de reparto (pesos, sobrante al céntimo, saldos, simplificación).
- `src/lib/merge.test.js` — merge LWW + tombstones (convergencia entre dispositivos).
- `src/db.test.js` — CRUD + **flujo real gasto → saldo** sobre IndexedDB, y coherencia del ejemplo.
- `src/App.test.jsx` — render de la app y navegación (pilló un bug de transición real).

**Al añadir una feature, añade su test:** lógica pura → un `.test.js` junto al módulo;
algo que toque datos → un test de `db`; algo de UI → un test de componente. Corre
`npm run test:watch` mientras trabajas.

## Arquitectura (resumen)

- **React + Vite + vite-plugin-pwa** (service worker + manifest instalable).
- **IndexedDB** vía Dexie (`src/db.js`) — un registro por entidad, con `updatedAt`.
- **Regla de oro:** se guardan los *hechos* (gastos + liquidaciones) y los *saldos*
  se **calculan en local** con `computeFamilyBalances` — nunca se sincroniza el saldo.
- **Dinero en céntimos enteros** (`src/lib/money.js`); el reparto del sobrante no
  pierde ni inventa céntimos.

## Despliegue

GitHub Pages vía Actions (`.github/workflows/deploy.yml`), servido bajo
`/ballenita-ops/`. En iOS: abrir en Safari → Compartir → **Añadir a pantalla de
inicio** (necesario para offline persistente y notificaciones, §14.4).
