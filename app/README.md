# Ballena Ops 🐳 — app (PWA)

Implementación de la app descrita en [`../docs/SPECS.md`](../docs/SPECS.md).
PWA offline-first para gestionar los eventos del grupo de amigos: gastos estilo
Splitwise **entre familias**, con backend propio en [`../api/`](../api/)
(Cloudflare Worker + D1, §14.9 del spec).

## Qué hace

- ✅ Crear/elegir **eventos** (o cargar el ejemplo «Ballenita 2026»).
- ✅ **Familias, bungas y personas** (con peso de reparto, avatar emoji y estado).
- ✅ **Gastos**: importe, multi-moneda con tipo congelado, categoría, pagador,
  y reparto por persona (con atajo «solo mayores»).
- ✅ **Saldos entre familias** + **liquidación simplificada** + «marcar pagado».
- ✅ **Cenas, Planes, Agenda y Estadísticas.**
- ✅ **Temas** (5 skins + Sistema + Aleatorio diario) en Ajustes.
- ✅ **Motor de reparto** (`src/lib/reparto.js`), puro y con tests.
- ✅ **Acceso con Apple** (`src/auth/`) y alta por invitación desde Ajustes.
- ✅ **Sincronización** (`src/sync/`): cola de cambios → el servidor la aplica y
  devuelve la instantánea, que sustituye la copia local. Al abrir, al volver
  online/foreground y cada 90 s.

Pendiente: editar gastos y personas desde la UI, avatares con foto.

### Cómo funciona la sincronización

Toda escritura pasa por `escribir()` o `removeRow()` en `src/db.js`, que guardan
el dato **y su entrada en la cola** (`outbox`) en la misma transacción. Si se
hicieran por separado, cerrar la app entre una y otra dejaría un gasto visible
en el móvil que el servidor no llegaría a conocer nunca.

Después, `sync/engine.js` sube la cola, recibe la instantánea y la aplica. El
servidor es la autoridad: lo que no manda, deja de existir en local. Lo que se
haya encolado mientras la petición viajaba se vuelve a aplicar encima, para que
nada de lo que acabas de tocar desaparezca de la pantalla.

No hay merge en el cliente ni lápidas: eso era del montaje anterior con JSONBin.

### Configuración

`public/config.json` — la dirección de la API, el cliente de Apple y el
manifiesto OTA. Se lee **en caliente** al arrancar, así que cambiarlo no exige
reconstruir ni publicar un OTA. No contiene secretos. Si no apunta a ninguna
API, la app funciona **solo en local** y lo indica en la cabecera.

Pasos de despliegue: [`../docs/DESPLIEGUE.md`](../docs/DESPLIEGUE.md).

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
