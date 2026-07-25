# Puesta en marcha: Cloudflare, Apple y GitHub 🐳

Guía para dejar en pie el backend propio de Ballena Ops. Sustituye al montaje
anterior (documento compartido en JSONBin + GitHub Pages), que se retiró porque
la clave maestra de JSONBin viajaba dentro del JavaScript de una web pública:
cualquiera con la URL podía leer y sobrescribir los gastos del grupo.

Las piezas nuevas son tres:

| Pieza | Dónde | Qué es |
|---|---|---|
| **API** | `api/` | Worker de Cloudflare sobre D1. Guarda el registro del grupo |
| **Aplicación** | `app/` | La PWA de siempre, ahora en Cloudflare Pages, y la app de iOS |
| **Acceso** | Sign in with Apple | Identidad; la incorporación es por invitación |

Lo que **no** cambia: los saldos se siguen calculando en cada móvil
(`app/src/lib/reparto.js`). El servidor guarda hechos, nunca saldos.

---

## 0. Lo que hace falta antes de empezar

- Una cuenta de Cloudflare (el plan gratuito sobra de largo).
- `wrangler` — viene con `npm install` dentro de `api/`.
- Una cuenta del **Apple Developer Program** (99 €/año). Es imprescindible:
  sin ella no hay Sign in with Apple ni app de iOS.
- Acceso al DNS de **`galoopa.store`** (panel de Squarespace Domains). La app
  vive en `ballena-ops.galoopa.store`.

> **Aviso que ya se dio y conviene tener presente:** el acceso es solo con Apple.
> Quien no tenga un Apple ID no puede entrar, ni desde Android ni desde la web.

---

## 1. Cloudflare: la base de datos

```bash
cd api
npm install
npx wrangler login
npx wrangler d1 create ballena-ops
```

El comando devuelve un `database_id`. Cópialo a `api/wrangler.toml`, en el
hueco que dice `PENDIENTE`. **No** copies el `binding` que sugiere wrangler: el
Worker busca la base como `env.DB` y tiene que seguir llamándose `DB`.

Aplica el esquema:

```bash
npm run migrar:remoto
```

---

## 2. Cloudflare: los secretos y el Worker

Dos secretos, que **no** van en `wrangler.toml`:

```bash
# Con lo que el Worker firma las sesiones. Genérala al azar y no la cambies
# después: cambiarla obliga a todo el grupo a volver a entrar.
npx wrangler secret put SESION_SECRETO

# Credencial de la siembra desde JSONBin (§7). Puedes borrarla al terminar.
npx wrangler secret put TOKEN_SERVICIO
```

Despliega y comprueba:

```bash
npm run desplegar
curl https://ballena-ops-api.TU-SUBDOMINIO.workers.dev/api/salud
# {"estado":"ok","ahora":"..."}
```

Apunta esa dirección: va en `app/public/config.json`.

---

## 3. Apple: Sign in with Apple

### 3.1 Identificador de la aplicación (App ID)

En [developer.apple.com](https://developer.apple.com) → *Certificates,
Identifiers & Profiles* → *Identifiers* → **App IDs**. Crea uno con el
identificador de paquete que use la app de iOS (por omisión
`com.oscarini.ballenaops`) y marca la capacidad **Sign in with Apple**.

### 3.2 Identificador de servicio (Services ID), para la web

Otro identificador, esta vez de tipo **Services IDs**, con un valor distinto del
anterior: `com.oscarini.ballenaops.web`. Actívale Sign in with Apple y, en
*Configure*:

- **Domains**: `ballena-ops.galoopa.store`. Sin `https://` ni barras.
- **Return URLs**: `https://ballena-ops.galoopa.store`, con `https://` y **sin**
  barra final. Tiene que ser **idéntica carácter a carácter** al campo
  `redireccion` de `config.json`; si no, Apple responde `invalid_client`.

> **No hagas esto todavía** si aún no has montado el dominio (§4.2). Apple
> intenta verificarlo en cuanto lo declaras, y si no hay certificado aún, falla
> y hay que reintentarlo.

Apple te dará un fichero `.txt` para verificar el dominio. Dónde va y cómo
comprobar que se sirve de verdad: **§4.4**, que tiene truco.

Los dos identificadores van a `api/wrangler.toml`:

```toml
APPLE_AUD_WEB = "com.oscarini.ballenaops.web"
APPLE_AUD_IOS = "com.oscarini.ballenaops"
```

Vuelve a desplegar el Worker después de tocarlos (`npm run desplegar`).

### 3.3 Nada de claves privadas

Este montaje **no** usa el flujo de servidor de Apple, así que no hace falta
generar ni custodiar ninguna clave `.p8`. El cliente obtiene un token de
identidad y el Worker verifica su firma contra las claves públicas de Apple.

---

## 4. Cloudflare Pages: la aplicación web

En el panel de Cloudflare → *Workers & Pages* → **Create**. Cuidado: el
asistente ofrece **Workers** por defecto y Pages está en otra pestaña. Cambia a
**Pages** y entonces *Connect to Git*.

| Campo | Valor |
|---|---|
| Repositorio | `oscarini-garcia/ballenita-ops` |
| Rama de producción | `main` |
| Framework preset | *Vite* |
| Build command | `cd app && npm ci && npm run build` |
| Build output directory | `app/dist` |

Cada empujón a `main` reconstruye y republica. Las pruebas siguen corriendo en
GitHub Actions (`.github/workflows/pruebas.yml`), que es lo que te avisa si algo
se rompe antes de que llegue a producción.

### 4.2 Apuntar `ballena-ops.galoopa.store` a Pages

`galoopa.store` **no está alojado en Cloudflare**: sus servidores de nombres son
los de Google Cloud DNS, heredados de Google Domains, y el panel donde se editan
los registros es hoy el de Squarespace Domains. Eso no impide usar el dominio —
Pages admite dominios cuyo DNS vive fuera— y basta con un registro.

> ⚠️ **El apex está ocupado.** `galoopa.store` resuelve a Shopify. No lo toques:
> todo esto cuelga de un subdominio y la tienda sigue exactamente igual. Si
> alguna vez se rompe la tienda después de tocar aquí, lo primero que hay que
> mirar es si al añadir el CNAME se modificó por error el registro `A` del apex.

1. En el proyecto de Pages: **Custom domains → Set up a custom domain** →
   `ballena-ops.galoopa.store`. Como el dominio no está en Cloudflare, la
   interfaz te dirá que crees tú el registro y te enseñará el destino.
2. En el panel de DNS del dominio, **un único registro nuevo**:

   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | CNAME | `ballena-ops` | `<tu-proyecto>.pages.dev` | 300 mientras pruebas |

3. Cloudflare detecta el CNAME, valida y emite el certificado solo. De unos
   minutos a una hora. **No sigas** hasta que el dominio figure como **Active**
   en *Custom domains*.

Comprobación:

```bash
dig ballena-ops.galoopa.store CNAME +short    # debe devolver tu *.pages.dev
curl -I https://ballena-ops.galoopa.store     # debe dar 200 con certificado válido
```

Solo cuando esto esté **Active** tiene sentido volver a Apple (§3.2).

### 4.3 Rellena `config.json`

`app/public/config.json` viene con un marcador `EJEMPLO`. Sustitúyelo:

```json
{
  "api": "https://ballena-ops-api.TU-SUBDOMINIO.workers.dev",
  "appleClienteWeb": "com.oscarini.ballenaops.web",
  "redireccion": "https://ballena-ops.galoopa.store",
  "otaManifiesto": "https://github.com/oscarini-garcia/ballenita-ops/releases/latest/download/latest.json"
}
```

Lo único que queda por sustituir es `TU-SUBDOMINIO` en la dirección de la API;
el resto ya está puesto.

Este fichero se lee **en caliente** al arrancar la app, así que cambiarlo no
obliga a reconstruir nada ni a publicar un OTA nuevo. Ahí no hay secretos: la
dirección de la API y el cliente de Apple son públicos por diseño.

El workflow de OTA se niega a publicar si el marcador `EJEMPLO` sigue puesto.

### 4.4 El fichero de verificación de Apple

El `.txt` que te da Apple (§3.2) **sustituye** a `app/public/apple-dominio.txt`,
que ahora mismo es un marcador. Se sirve en la ruta que Apple espera mediante la
reescritura ya declarada en `app/public/_redirects`.

> **¿Por qué no un directorio `.well-known/` normal?** Porque los despliegues de
> Pages no siempre suben los directorios cuyo nombre empieza por punto. El
> síntoma sería una verificación que falla sin decir por qué. La reescritura con
> código 200 es una redirección **interna**: Apple ve el fichero donde lo
> espera, con su content-type, y sin saltos por el camino (que también
> rechazaría). Por eso se hace así desde el principio.

Tras el empujón que lo publique:

```bash
curl -i https://ballena-ops.galoopa.store/.well-known/apple-developer-domain-association.txt
```

> ⚠️ **Mira el `content-type`, no solo el `200`.**
>
> - `text/plain` → el fichero se sirve de verdad. Adelante.
> - `text/html` → el fichero **no** está; te están devolviendo una página. Apple
>   fallará con un error que no explica nada.
>
> El cuerpo debe ser la cadena que entregó Apple, no `<!DOCTYPE html>`.

El repositorio incluye un `app/public/404.html` justamente para que esta
comprobación no dé un falso positivo: sin él, Pages responde `200` con el
`index.html` de la aplicación para **cualquier** ruta inexistente, y parecería
que el fichero está publicado cuando no lo está.

### 4.5 Los orígenes permitidos

En `api/wrangler.toml`, `ORIGENES_PERMITIDOS` tiene que incluir el dominio de la
PWA. Sin coincidencia el Worker no emite cabeceras CORS y la app entra pero no
ve datos. Ya viene puesto:

```toml
ORIGENES_PERMITIDOS = "https://ballena-ops.galoopa.store,https://ballenita-ops.pages.dev,http://localhost:5173"
```

Vuelve a desplegar el Worker si lo cambias (`npm run desplegar`).

---

## 5. La primera cuenta

La primera persona que entra en una instalación vacía **entra sola y nace
administradora**. Es la única excepción; a partir de ahí todo es por invitación.

Entra tú el primero, antes de pasarle la URL a nadie.

---

## 6. Dar acceso al resto del grupo

1. La persona abre la app y pulsa *Entrar con Apple*.
2. Le sale un aviso de que todavía no tiene acceso, con **un código**. Que te lo
   pase por el chat.
3. Tú, en **Ajustes → Quién tiene acceso**, pegas el código, le pones nombre y
   pulsas *Dar acceso*.
4. La persona vuelve a pulsar *Entrar con Apple* y ya está dentro.

Desde esa misma pantalla se le puede quitar el acceso («Quitar»), que desactiva
la cuenta sin borrar nada de lo que haya apuntado.

---

## 7. Traer lo que ya había en JSONBin

El grupo tiene eventos y gastos vivos en el documento antiguo. Para no empezar
de cero:

```bash
cd api
JSONBIN_ID=...  JSONBIN_KEY=...  \
API=https://ballena-ops-api.TU-SUBDOMINIO.workers.dev  TOKEN_SERVICIO=...  \
  node herramientas/sembrar-desde-jsonbin.mjs --simulacro   # primero en seco
```

Quita `--simulacro` cuando el recuento cuadre.

La siembra es **idempotente** y respeta la regla de última escritura: puedes
lanzarla hoy, dejar que el grupo siga unos días en la versión vieja y volver a
lanzarla el día del corte para arrastrar lo que haya cambiado. Nunca pisa algo
más reciente que ya esté en el servidor.

Cuando esté hecho, borra los secretos `VITE_JSONBIN_ID` y `VITE_JSONBIN_KEY` del
repositorio: ya no los usa nadie, y una clave que sigue viva es una clave que
puede filtrarse.

---

## 8. La app de iOS

El montaje de la cáscara y el OTA no cambia; sigue en
[`IOS.md`](IOS.md) y [`RECETA-IOS-REUTILIZABLE.md`](RECETA-IOS-REUTILIZABLE.md).
Dos cosas sí cambian con esta migración:

- **Hay un plugin nativo nuevo** (`@capacitor-community/apple-sign-in`). Eso
  significa **compilación nueva y subida a Apple**: un OTA no basta, porque el
  OTA solo reparte la parte web. La propia app lo dice si se intenta entrar sin
  el plugin.
- El *bundle identifier* de la app tiene que coincidir con `APPLE_AUD_IOS`.

Después de esa subida, el día a día vuelve a ser el de siempre: sube la versión
en `app/package.json`, mergea a `main`, y el workflow publica el OTA.

---

## 9. Lo que esto cuesta

| Pieza | Coste |
|---|---|
| Cloudflare Workers + D1 + Pages | 0 € en el plan gratuito, con margen enorme |
| GitHub Actions | 0 € — unos minutos al mes de una cuota de 2.000 |
| Dominio propio | 10–15 € al año, y es opcional |
| Apple Developer Program | **99 € al año**, obligatorio en este montaje |

---

## 10. Cuando algo no va

| Síntoma | Causa habitual |
|---|---|
| La web carga pero el botón de Apple no hace nada | El dominio no está verificado en el Services ID, o `appleClienteWeb` no coincide con él |
| Apple responde `invalid_client` | La *Return URL* del Services ID y el campo `redireccion` de `config.json` no son idénticos. Compara carácter a carácter, incluida la barra final |
| Apple no consigue verificar el dominio | El `.txt` no se está sirviendo. Lanza el `curl` de §4.4: si el `content-type` es `text/html`, el fichero no está donde crees |
| El dominio no sale de «pending» en Pages | El CNAME no ha propagado o apunta a otro proyecto. `dig ballena-ops.galoopa.store CNAME +short` debe devolver tu `pages.dev` |
| Se rompió la tienda de `galoopa.store` | Nada de este despliegue toca el apex. Mira si al añadir el CNAME se modificó por error el registro `A` que apunta a Shopify |
| Entra pero no ve datos | `ORIGENES_PERMITIDOS` no incluye el dominio de la PWA, o `api` en `config.json` apunta a otro sitio |
| «Todavía no tienes acceso» la primera vez | Es el comportamiento correcto: hay que darle de alta (§6) |
| Todo da 401 de repente | Cambió `SESION_SECRETO`; hay que volver a entrar |
| El punto de la cabecera se queda ámbar | Hay cambios en la cola que el servidor no acepta. La consola del navegador lista cuáles y por qué |
| En iOS, «esta versión no trae el acceso con Apple» | La cáscara instalada es anterior al plugin. Hace falta binario nuevo, no un OTA |
| El OTA no baja | Comprueba `otaManifiesto` en `config.json`, que el release exista y que subiste la versión en `app/package.json` |

Trazas en vivo del Worker:

```bash
cd api && npx wrangler tail
```

---

## 11. Copias de seguridad

D1 admite exportación bajo demanda:

```bash
cd api && npx wrangler d1 export ballena-ops --remote --output=copia.sql
```

Guárdala fuera del repositorio. Con el montaje anterior no había copias de
ninguna clase: lo que hubiera en el bin era todo lo que había.
