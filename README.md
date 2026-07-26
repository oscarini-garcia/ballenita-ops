# Ballena Ops 🐳

PWA para gestionar los eventos del grupo de amigos —viajes, campings, findes—: gastos
estilo Splitwise **entre familias**, cenas, planes, agenda y estadísticas. Solo para el
grupo, en español y con ballena.

- **PWA:** [`app/`](app/) — React + Vite. Ver [`app/README.md`](app/README.md).
- **API:** [`api/`](api/) — Cloudflare Worker + D1.
- **Specs de producto:** [`docs/SPECS.md`](docs/SPECS.md) — la fuente de la verdad.
- **Mapa del repositorio:** [`docs/mapa.md`](docs/mapa.md) — dónde mirar. **Generado**
  por `herramientas/mapa.mjs`; no se edita a mano.
- **Despliegue:** [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).
- **Contexto para Claude Code:** [`CLAUDE.md`](CLAUDE.md), con la sección «En curso».

```bash
cd app && npm install && npm run dev     # la PWA en local
cd app && npm test                       # suite de la PWA
cd api && npm test                       # suite del Worker
node herramientas/mapa.mjs               # regenerar docs/mapa.md
```

## Backlog de ideas

Cosas que estarían bien y que nadie está haciendo ahora mismo. Lo que **sí** está en
marcha vive en la sección «En curso» de [`CLAUDE.md`](CLAUDE.md).

- Editar gastos y personas desde la UI (hoy se crean y se borran, no se corrigen).
- **Compartir** los avatares con foto con el grupo: hoy son locales del móvil
  (`lib/avatares.js`), y hacerlos comunes pide almacenamiento aparte, fuera de la sync.
- Lista de la compra agregada a partir de `Dish.ingredientes`, sumando la de las cenas
  del evento a lo que se apunte a mano.
- Pulir los contrastes de algún tema.
- Sacar a CSS los ~96 estilos inline de las pantallas, que rompen los temas.
