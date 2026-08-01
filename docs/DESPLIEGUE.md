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

> ⚠️ **Quién sincroniza y quién no.** El acceso con Apple vive **solo en la app
> de iOS**. En el navegador y en la PWA instalada, Ballena Ops es una libreta
> local de ese dispositivo: funciona entera, pero no comparte nada con el grupo.
> Eso evita todo el montaje web de Apple —Services ID, verificación de dominio,
> el fichero `.txt`—, que es la parte que más se atasca, y a cambio exige tener
> la app instalada para participar.

---

## 0. Lo que hace falta antes de empezar

- Una cuenta de Cloudflare (el plan gratuito sobra de largo).
- `wrangler` — viene con `npm install` dentro de `api/`.
- Una cuenta del **Apple Developer Program** (99 €/año). Es imprescindible:
  sin ella no hay Sign in with Apple ni app de iOS.
- Acceso al DNS de **`galoopa.store`** (panel de Squarespace Domains). La app
  vive en `ballenita-ops.galoopa.store`.

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
curl https://ballena-ops-api.oscarini.workers.dev/api/salud
# {"estado":"ok","ahora":"..."}
```

Esa dirección va en `app/public/config.json`, campo `api`. **Ya está puesta.**

> El Worker se llama `ballena-ops-api` y la base `ballena-ops`, sin el «ita»,
> porque se crearon antes de fijar el nombre. Son nombres internos que no ve
> nadie: solo salen en esa URL y en la consola de Cloudflare. Renombrarlos
> obligaría a recrear la base y a cambiar la URL de la API, y no arregla nada.

---

## 3. Apple: Sign in with Apple

### 3.1 Identificador de la aplicación (App ID)

En [developer.apple.com](https://developer.apple.com) → *Certificates,
Identifiers & Profiles* → *Identifiers* → **App IDs**. El identificador de
paquete es `com.garciadoral.ballenitaops` —el mismo que declara
`app/capacitor.config.json`— y hay que marcarle la capacidad **Sign in with
Apple**.

> Los tres tienen que coincidir: el App ID del portal, el `appId` de
> `capacitor.config.json` y `APPLE_AUD_IOS` en `wrangler.toml`. Si uno se
> desvía, el Worker rechaza el token con «audiencia no admitida» y la app se
> queda en la pantalla de acceso sin más explicación.

### 3.2 Y ya está: no hay nada más que dar de alta

Esto es todo lo que hay que hacer en Apple. **No hace falta Services ID, ni
declarar dominios, ni verificar nada con un fichero `.txt`**, que es la parte
que más se atasca de este montaje.

El motivo es la decisión de fondo: **el acceso con Apple vive solo dentro de la
app de iOS**. En el navegador y en la PWA instalada, Ballena Ops funciona como
una libreta local de ese dispositivo, sin entrar y sin hablar con la API. Un
Services ID solo hace falta para el flujo web, y aquí no hay flujo web.

El identificador va a `api/wrangler.toml`, y ya está puesto:

```toml
APPLE_AUD_IOS = "com.garciadoral.ballenitaops"
```

> **Si algún día se recupera el acceso web**, hay que crear entonces el Services
> ID, declarar el dominio, verificarlo y añadir `APPLE_AUD_WEB` a la
> configuración. El Worker ya admite esa audiencia si aparece declarada, así que
> sería un cambio de configuración y no de código. Cuidado en ese momento con el
> **Primary App ID** del Services ID: Apple solo devuelve el mismo identificador
> de usuario para los identificadores agrupados bajo un mismo App ID principal,
> y ese identificador es la clave con la que reconocemos a cada persona. Mal
> puesto, la misma persona tendría una cuenta distinta en el móvil y en la web.

### 3.3 Entrar no necesita ninguna clave privada

Para **el acceso**, este montaje no usa el flujo de servidor de Apple: el cliente
obtiene un token de identidad y el Worker verifica su firma contra las claves
públicas de Apple. Un secreto menos que rotar, y ningún fallo de firma posible en
el camino por el que entra todo el mundo todos los días.

Hay exactamente **una** cosa que sí pide una clave `.p8`, y es la baja de cuenta:
Apple no se conforma con que la app olvide a quien se va, exige que se le avise
para que Ballena Ops desaparezca de «Apps que usan tu Apple ID». Es la mitad
invisible de la directriz 5.1.1(v), hace falta solo para enviar a la App Store, y
está en [`APPSTORE.md`](APPSTORE.md), fase 1. Sin esa clave la baja funciona igual —la
cuenta se elimina— pero no se avisa a Apple, y la app lo dice al terminar en vez
de callárselo.

### 3.4 El nombre solo llega una vez

Apple entrega el nombre de la persona **únicamente en la primera autorización**.
A partir de ahí, nunca más: los inicios de sesión siguientes traen el `sub` y
poco más.

No es un problema aquí porque el nombre lo pone quien invita (§6), y esa es la
etiqueta que se ve en la lista de cuentas. Pero explica por qué la primera
cuenta —la que entra sola, sin invitación— puede quedarse sin nombre si Apple
decidió no darlo: se arregla desde la propia lista, no volviendo a entrar.

---

## 4. Cloudflare Pages: la aplicación web

### 4.1 Crear el proyecto

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

### 4.2 Apuntar `ballenita-ops.galoopa.store` a Pages

`galoopa.store` **no está alojado en Cloudflare**: sus servidores de nombres son
los de Google Cloud DNS, heredados de Google Domains, y el panel donde se editan
los registros es hoy el de Squarespace Domains. Eso no impide usar el dominio —
Pages admite dominios cuyo DNS vive fuera— y basta con un registro.

> ⚠️ **El apex está ocupado.** `galoopa.store` resuelve a Shopify. No lo toques:
> todo esto cuelga de un subdominio y la tienda sigue exactamente igual. Si
> alguna vez se rompe la tienda después de tocar aquí, lo primero que hay que
> mirar es si al añadir el CNAME se modificó por error el registro `A` del apex.

1. En el proyecto de Pages: **Custom domains → Set up a custom domain** →
   `ballenita-ops.galoopa.store`. Como el dominio no está en Cloudflare, la
   interfaz te dirá que crees tú el registro y te enseñará el destino.
2. En el panel de DNS del dominio, **un único registro nuevo**:

   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | CNAME | `ballenita-ops` | `ballenita-ops.pages.dev` | 300 mientras pruebas |

3. Cloudflare detecta el CNAME, valida y emite el certificado solo. De unos
   minutos a una hora. **No sigas** hasta que el dominio figure como **Active**
   en *Custom domains*.

Comprobación:

```bash
dig ballenita-ops.galoopa.store CNAME +short    # debe devolver tu *.pages.dev
curl -I https://ballenita-ops.galoopa.store     # debe dar 200 con certificado válido
```

Solo cuando esto esté **Active** tiene sentido volver a Apple (§3.2).

### 4.3 Qué sirve esta web

Conviene tenerlo claro, porque cambia lo que se espera de ella: **la web es una
libreta local**. Quien la abra puede apuntar gastos, cenas y planes, y todo se
guarda en su navegador, pero **no se sincroniza con el grupo**. Los datos
compartidos viven en la app de iOS.

Sigue mereciendo la pena publicarla: es donde se prueba la interfaz sin compilar
nada, y es el mismo código que va dentro de la app.

Y hay dos páginas que **no** son la app y que se sirven desde aquí:

```
https://ballenita-ops.galoopa.store/privacidad
https://ballenita-ops.galoopa.store/soporte
```

Son las dos URL que exige la ficha de la App Store, y Apple las comprueba antes
de que nadie mire la aplicación: un 404 ahí es un rechazo administrativo. Son
HTML suelto (`app/public/`) para que sigan en pie aunque la app no arranque, que
es justo cuando alguien viene a buscarlas. Compruébalas con `curl` en cuanto
Pages esté publicando ([`APPSTORE.md`](APPSTORE.md), fase 4).

`app/public/config.json` ya está relleno y sin marcadores:

```json
{
  "api": "https://ballena-ops-api.oscarini.workers.dev",
  "otaManifiesto": "https://github.com/oscarini-garcia/ballenita-ops/releases/latest/download/latest.json"
}
```

Se lee **en caliente** al arrancar, así que cambiarlo no obliga a reconstruir
nada ni a publicar un OTA. No hay secretos: las dos direcciones son públicas.

El workflow de OTA se niega a publicar si aparece el marcador `EJEMPLO`.

### 4.4 Los orígenes permitidos

Quien habla con la API es la app de iOS, y **no pasa por el navegador**: con
`CapacitorHttp` activado la petición la hace el sistema, así que no hay CORS de
por medio. La lista se queda corta a propósito:

```toml
ORIGENES_PERMITIDOS = "http://localhost:5173"
```

Está ahí para `wrangler dev` durante el desarrollo, y para no dejar la puerta
abierta si algún día se recupera el acceso web.

---

## 5. La primera cuenta

La primera persona que entra en una instalación vacía **entra sola y nace
administradora**. Es la única excepción; a partir de ahí todo es por invitación.

> ⚠️ **Esto exige la app de iOS ya instalada.** El acceso con Apple vive en la
> cáscara nativa, así que no hay forma de crear la primera cuenta desde la web.
> En la práctica, el orden es: compilar y subir la app (§8) → instalarla →
> entrar tú → sembrar los datos (§7) → dar de alta al resto (§6).
>
> No hay atajo por la base de datos: para dar de alta a alguien hace falta su
> identificador de Apple, y ese identificador solo aparece cuando esa persona
> intenta entrar.

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
| En la web no aparece el botón de entrar | Es lo correcto: la web es una libreta local y no sincroniza. El acceso vive en la app de iOS (§4.3) |
| El dominio no sale de «pending» en Pages | El CNAME no ha propagado o apunta a otro proyecto. Debe resolver a tu `pages.dev` |
| Se rompió la tienda de `galoopa.store` | Nada de este despliegue toca el apex. Mira si al añadir el CNAME se modificó por error el registro `A` que apunta a Shopify |
| La app entra pero no ve datos | `api` en `config.json` apunta a otro sitio, o el Worker no está desplegado |
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
