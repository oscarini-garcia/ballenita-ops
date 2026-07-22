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
- ✅ **Motor de reparto** (`src/lib/reparto.js`) y **de merge LWW/tombstone**
  (`src/lib/merge.js`), ambos con tests (`npm test`).

Pendiente (siguientes fases): sincronización del documento compartido (JSONBin),
login por email mágico, cenas, planes, estadísticas y avatares con foto.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests del motor de reparto y de merge
npm run build    # build de producción (PWA)
```

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
