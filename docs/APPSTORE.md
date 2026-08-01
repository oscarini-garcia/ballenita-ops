# Subir Ballena Ops a la App Store 🐳🍎

Guía de una sola pasada: **qué hay que hacer, quién lo hace y cuándo**. Subir el
binario **no es publicarlo** —lo deja en App Store Connect esperando una ficha—,
y buena parte del trabajo no es técnica.

Da por hecho lo de [`DESPLIEGUE.md`](DESPLIEGUE.md): la D1 creada, el Worker
desplegado, Pages publicando y el App ID dado de alta en Apple. Si eso no está,
empieza por ahí.

---

## Antes de nada: hay un camino más corto, y conviene saberlo

La revisión de la App Store existe para que a una aplicación llegue **cualquiera**.
A Ballena Ops no va a llegar nadie de fuera del grupo: el acceso es por
invitación y una cuenta sin invitar no ve nada.

**TestFlight tiene un círculo interno que no pasa por revisión.** Se da de alta a
cada persona como usuaria de App Store Connect con el rol más acotado, y la build
está en sus teléfonos minutos después de subirla. No cuesta ficha ninguna: ni
descripción, ni capturas, ni cuestionario de privacidad. Lo único que se paga es
que **una build caduca a los noventa días** y hay que volver a archivar aunque no
haya cambiado nada —los cambios de esos tres meses ya están en los teléfonos por
OTA—. Es el camino que eligió `garciadoral-ops` para el mismo problema.

Dicho eso, esta guía es la de la App Store entera, que es lo que se pidió, y
tiene dos ventajas reales: se instala desde la tienda sin que nadie dé de alta a
nadie, y **no caduca**. Lo que sigue vale igual para las dos rutas hasta la
**fase 5**; a partir de ahí, TestFlight interno sería «invitar y ya está».

---

## 1. Lo que ya está resuelto en el repositorio

No hay que hacer nada de esto: está hecho y con sus pruebas.

| Requisito de Apple | Dónde está resuelto |
|---|---|
| **5.1.1(v)** · eliminar la cuenta desde dentro de la app | Ajustes → **Tu cuenta** → **Eliminar mi cuenta** (`EventSettingsScreen.jsx`) y `POST /api/cuenta/baja` en el Worker |
| **5.1.1(v)** · avisar a Apple de la baja | `api/src/revocacion.js`. Necesita la clave del §2; sin ella la baja funciona y la app avisa de que no se pudo revocar |
| **2.1** · que quien revisa pueda ver la app sin cuenta | **Modo de demostración** desde la pantalla de acceso (`app/src/lib/demo.js`) |
| Política de privacidad | `app/public/privacidad.html` → `/privacidad` |
| Página de soporte | `app/public/soporte.html` → `/soporte` |
| Cumplimiento de exportación | `patch-ios.mjs` lo declara en el `Info.plist` (`ITSAppUsesNonExemptEncryption`) |
| No pedir capturas de iPad | `patch-ios.mjs` fija `TARGETED_DEVICE_FAMILY = 1` |
| **2.3.8** · que el nombre del icono y el de la ficha se parezcan | `patch-ios.mjs` sincroniza `CFBundleDisplayName` con `appName` |
| Sin SDK de terceros en el binario | Se retiraron OneSignal y `@capacitor/push-notifications`, que estaban inertes (ver `lib/native.js`) |

> **Por qué se fue OneSignal.** Estaba en el `package.json` y no hacía nada: sin
> `VITE_ONESIGNAL_APP_ID` no se inicializaba, y no había servidor que enviara
> ningún aviso. Pero entraba en el binario, y es de los SDK que Apple obliga a
> declarar con su manifiesto de privacidad firmado; además habría que recoger en
> las etiquetas de la ficha lo que recopila. Todo eso por una función que nadie
> usaba. Volver a ponerlo es un binario nuevo con su revisión —los plugins
> nativos no viajan por OTA—, y el camino corto ese día es APNs directo desde el
> Worker, como en `garciadoral-ops`, sin intermediario.

---

## 2. La secuencia, fase a fase

Los tiempos son de reloj, no de trabajo: casi todo es esperar a Apple.

### Fase 0 · Decidir cuatro cosas — **tú**, 20 minutos

Antes de tocar nada. Cambiar esto después cuesta mucho más.

1. **El correo público.** `privacidad.html` y `soporte.html` llevan puesto
   `oscarini@gmail.com`. Esa página la lee cualquiera, incluida la gente que
   descargue la app por error. Si prefieres otro, cámbialo en los dos ficheros
   ahora; hay un test que impide dejarlos con un marcador de mentira
   (`app/src/appstore.test.js`).
2. **El nombre de la ficha.** Va a ser `Ballena Ops`, que cabe entero bajo el
   icono; no hace falta uno distinto para el teléfono.
3. **El identificador del paquete**, que ya está decidido y no se puede renombrar
   en Apple: `com.garciadoral.ballenitaops`. Tiene que coincidir en tres sitios
   —`app/capacitor.config.json`, `APPLE_AUD_IOS` en `api/wrangler.toml` y el App
   ID del portal— y ya coincide.
4. **Territorios y precio**: gratis, todos los territorios. No hay compras dentro
   de la app ni suscripciones, lo que ahorra el acuerdo de pagos entero.

### Fase 1 · La clave de revocación — **tú**, 30 minutos, en el navegador

Es lo único de todo el proyecto que pide una clave privada, y sirve solo para la
baja de cuenta. Sáltatela y la baja funcionará igual, pero la app se quedará
figurando en «Apps que usan tu Apple ID» de quien se dio de baja, que es
justamente la mitad de la 5.1.1(v) que Apple no ve pero comprueba por su cuenta.

1. [developer.apple.com/account](https://developer.apple.com/account) →
   *Certificates, Identifiers & Profiles* → **Keys** → **+**.
2. Nombre: `Ballena Ops — revocación`. Marca **Sign in with Apple** y en
   *Configure* elige como *Primary App ID* el `com.garciadoral.ballenitaops`.
3. Descarga el `.p8`. **Apple solo lo deja descargar una vez.** Guárdalo en tu
   gestor de contraseñas, no en el repositorio.
4. Apunta el **Key ID** (10 caracteres, sale junto a la clave) y el **Team ID**
   (10 caracteres, arriba a la derecha en *Membership*).

### Fase 2 · Registrar los secretos y desplegar el Worker — **tú**, 15 minutos

```bash
cd api
wrangler secret put APPLE_CLAVE_P8    # pega el contenido del .p8 entero, con sus -----BEGIN-----
wrangler secret put APPLE_CLAVE_ID    # el Key ID
wrangler secret put APPLE_EQUIPO      # el Team ID
npm run desplegar
```

Comprobación de que el Worker está vivo y con la ruta nueva:

```bash
curl -s https://ballena-ops-api.oscarini.workers.dev/api/salud
# {"estado":"ok","ahora":"..."}
curl -si -X POST https://ballena-ops-api.oscarini.workers.dev/api/cuenta/baja | head -1
# HTTP/2 401  ← existe y pide sesión. Un 404 aquí significa que no desplegaste.
```

### Fase 3 · Publicar la web con las dos páginas — **el repositorio**, automático

Cada empujón a `main` republica Pages. No hay nada que hacer salvo mergear esta
rama.

### Fase 4 · Comprobar las dos URL — **tú**, 5 minutos

No te lo saltes: es el fallo que más caro sale, porque llega **antes** de la
revisión y en forma de rechazo administrativo.

```bash
curl -sI https://ballenita-ops.galoopa.store/privacidad | head -1   # 200
curl -sI https://ballenita-ops.galoopa.store/soporte    | head -1   # 200
```

Ábrelas además en el móvil y lee el correo de contacto en voz alta. Si lo que ves
es la aplicación en vez de la página, el service worker se ha comido la
navegación: la lista que lo impide está en `vite.config.js`
(`navigateFallbackDenylist`).

### Fase 5 · Generar el proyecto iOS y archivar — **tú, en el Mac**, 2 horas la primera vez

```bash
cd app
npm install
npx cap add ios          # solo en macOS: hace pod install
npm run sync:ios         # copia la web, sincroniza y aplica patch-ios.mjs
npm run assets:ios       # iconos y splash desde app/assets/icon.png (1024×1024, opaca)
npm run open:ios
```

`npm run sync:ios` deja puesto todo lo de la tabla del §1 que vive en el binario.
Léele la salida: dice qué ha tocado y qué no ha sabido tocar.

**El icono sale de `app/assets/icon.png`**, y `assets:ios` genera desde ahí todos
los tamaños. Apple es estricta con esa imagen y el rechazo llega al subir, no al
compilar:

| Requisito | Por qué |
|---|---|
| **1024 × 1024** exactos | Es el que va a la ficha; los demás se derivan de él |
| **PNG sin canal alfa** | `ITMS-90717`: un icono con transparencia se rechaza al subir |
| **Sin esquinas redondeadas** | La máscara la pone iOS; si vienen dibujadas, se redondea dos veces |
| **Sin márgenes propios** | El dibujo llega al borde, iOS ya recorta |
| **sRGB** | Otro perfil se ve de otro color en el teléfono |

En el Mac, con `sips`, que viene de serie. Primero mira lo que tienes:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha -g space TU-IMAGEN.png
```

Si es cuadrada y `hasAlpha: no`, basta con ajustarla de tamaño:

```bash
sips -z 1024 1024 TU-IMAGEN.png --out app/assets/icon.png
```

Si dice `hasAlpha: yes`, hay que aplanarla antes; el rodeo por JPEG la compone
sobre blanco, así que si el fondo tiene que ser otro color, píntalo tú primero:

```bash
sips -s format jpeg -s formatOptions best TU-IMAGEN.png --out /tmp/icono.jpg
sips -z 1024 1024 -s format png /tmp/icono.jpg --out app/assets/icon.png
```

> **El icono es nativo: no viaja por OTA.** Cambiarlo obliga a `npm run
> sync:ios`, archivar y subir binario, igual que un plugin. El de la web
> (`app/public/favicon.svg`) es otro fichero y sí se republica solo con Pages.

En Xcode:

1. **Signing & Capabilities** → tu *Team*, y confirma el bundle id.
2. Añade la capacidad **Sign in with Apple**. No es opcional: sin ella la hoja
   nativa falla al abrirse y no entra nadie, aunque en el navegador todo vaya.
3. **Version** (`MARKETING_VERSION`) `1.0` y **Build** (`CURRENT_PROJECT_VERSION`)
   `1`. Ver §7.
4. *Any iOS Device* → **Product ▸ Archive** → **Distribute App ▸ App Store
   Connect ▸ Upload**.

Prueba en un **iPhone de verdad** antes de archivar: Sign in with Apple no se
comporta igual en el simulador sin cuenta de iCloud. Al pulsar «Entrar con Apple»
tiene que salir la hoja del sistema —Face ID o contraseña de Apple—, no una
ventana de navegador. Si sale «esta versión de la app no trae el acceso con
Apple», el plugin no entró en el binario: repite `npm install`, `npm run
sync:ios` y vuelve a archivar.

> `app/ios/` **no se versiona**: lo regenera `cap add ios` y `pod install`
> necesita macOS. Todo lo que hay que dejar puesto ahí lo escribe
> `patch-ios.mjs`, por eso mismo.

### Fase 6 · TestFlight interno — **tú y el grupo**, 1–2 días

La build tarda un rato en procesarse; hasta entonces no aparece en ningún
desplegable, y no es que haya fallado la subida.

Recorrido mínimo, desde el teléfono y en este orden:

1. Entrar con Apple. La primera cuenta de una instalación vacía nace
   administradora (DESPLIEGUE §5).
2. Sembrar los datos desde JSONBin (DESPLIEGUE §7) y dar de alta al resto
   (DESPLIEGUE §6).
3. Apuntar un gasto sin cobertura, recuperarla y ver que sube.
4. Abrir la **demostración** desde la pantalla de acceso y salir de ella con la
   pastilla de la cabecera. Comprueba que al salir no queda ningún camping
   inventado. Prueba también «Usar solo en este móvil», que es la otra salida y
   resuelve otra cosa: esa arranca vacía y lo apuntado sube al entrar.
5. **Eliminar la cuenta** en Ajustes → Tu cuenta, con un móvil que no sea el
   tuyo si puedes. Después vuelve a entrar: tiene que salir el código de siempre, porque
   ya no estás dado de alta. Es también el ensayo de la recuperación.

Ese punto 5 es el que conviene ensayar de verdad: es lo que Apple va a mirar y
lo único de este proyecto que borra datos.

### Fase 7 · Crear la app en App Store Connect y rellenar la ficha — **tú**, 2 horas

[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → ＋ →
Nueva app**. Bundle ID `com.garciadoral.ballenitaops`, idioma principal español,
SKU `ballenita-ops-001` (te lo inventas y no lo ve nadie).

Los metadatos están repartidos en cuatro pantallas, y la división no es
caprichosa: marca **qué se puede cambiar sin volver a revisión**.

| Dónde | Qué se rellena ahí |
|---|---|
| **General → App Information** | Nombre, subtítulo, URL de privacidad, categorías, derechos de contenido y clasificación por edades. Valen para todas las versiones |
| **iOS App → 1.0 Preparar para enviar** | Descripción, texto promocional, palabras clave, URL de soporte y de marketing, capturas, la *build* y, al final, las **notas de revisión**. Es por versión |
| **General → App Privacy** | Las etiquetas de privacidad, por cuestionario. Sin completarla no se puede enviar |
| **Pricing and Availability** | Gratis y territorios |

Tres cosas que ahorran un disgusto:

- **La build solo aparece cuando Apple termina de procesarla**, un rato después
  de subirla. Hasta entonces el desplegable está vacío.
- **Con la app publicada, solo el texto promocional se cambia en caliente.**
  Descripción, capturas y palabras clave exigen enviar una versión nueva a
  revisión. Conviene no dejarlos a medias.
- **El interruptor «Sign-in required»** de las notas de revisión exige usuario y
  contraseña si se marca, y aquí no existen: solo hay Sign in with Apple y por
  invitación. Déjalo **sin marcar** y explícalo en las notas. Marcarlo sin poder
  rellenar las credenciales es precisamente lo que provoca el rechazo por la 2.1.

El texto está en el §3, las respuestas del cuestionario en el §4 y las notas de
revisión en el §5.

### Fase 8 · Las capturas — **tú**, 1 hora

Obligatorias las de **6,9″** (iPhone 16 Pro Max o equivalente). No hace falta
teléfono: el simulador de Xcode da cualquier tamaño.

**Sácalas del modo de demostración, nunca del evento real del grupo.** Las
capturas son públicas: con los gastos de verdad dentro dejarían de serlo, y
además saldrían nombres de gente que no ha pedido salir en una tienda.

Cinco, en este orden, que es el del recorrido de la app:

1. **Hoy** — la agenda del día, que es por donde se abre.
2. **Dinero** — la lista de gastos con el reparto por familias.
3. **Dinero → Saldos** — quién debe a quién. Es lo que distingue a esta app.
4. **Cenas** — los platos y la rotación de bungas.
5. **Planes** — la votación.

### Fase 9 · Enviar — **tú**, 15 minutos · después **Apple**, 1–3 días

Adjunta las notas de revisión del §5 y envía. La primera revisión suele tardar
entre uno y tres días. Si llega un rechazo, casi siempre es de los dos del §6, y
los dos se contestan en el mismo hilo del *Resolution Center* sin subir binario
nuevo.

### Fase 10 · Después — el día a día vuelve a ser el de siempre

Publicada la app, el trámite desaparece: los cambios de la parte web siguen yendo
por **OTA** sin pasar por revisión —sube la versión en `app/package.json` y
mergea a `main`—, y solo un cambio **nativo** obliga a volver por aquí: un plugin
nuevo, los iconos, los permisos o la versión de Capacitor. La revisión de una
actualización es bastante más rápida que la primera.

---

## 3. El texto de la ficha, listo para pegar

**Nombre** (máx. 30):

```
Ballena Ops
```

**Subtítulo** (máx. 30):

```
Los gastos del viaje, en paz
```

**Texto promocional** (máx. 170). Es el único campo editable sin pasar por
revisión, así que sirve para avisar de algo puntual sin tocar la descripción:

```
Los gastos, las cenas y los planes de un viaje de amigos. Se reparte por familias, cuadra al céntimo y funciona sin cobertura en mitad del camping.
```

**Palabras clave** (máx. 100 en total, separadas por comas y **sin espacio detrás
de la coma**, que si no cuenta como carácter). No repitas las que ya están en el
nombre y el subtítulo —«gastos», «viaje»—: Apple ya indexa esos campos y
repetirlas es desperdiciar sitio:

```
camping,amigos,cuentas,dividir,compartidos,deudas,grupo,vacaciones,menus,offline
```

**Descripción** (máx. 4.000). El último apartado no es humildad ni un descargo
legal: es lo que evita que alguien la descargue creyendo que puede usarla y deje
una reseña de una estrella, y lo que le enseña a quien revisa que el acceso por
invitación es el diseño y no un fallo:

```
Ballena Ops organiza los viajes de un grupo de amigos: los gastos que se comparten, las cenas que se cocinan y los planes que se votan.

Está construida alrededor de una idea sencilla: en un viaje de varias familias, quien paga casi nunca es quien consume. Aquí el reparto se hace por familias y no por cabezas sueltas —los niños cuentan distinto que los adultos, y quien quiera puede afinarlo—, y al final se dice quién le tiene que pagar a quién con el menor número de transferencias posible. No pierde ni inventa un céntimo: las cuentas están en enteros y el reparto se cuadra a mano cuando la división no es exacta.

QUÉ HAY DENTRO

• Hoy — lo que toca hoy: la cena, el plan y lo que se ha apuntado.
• Dinero — los gastos con su reparto, y los saldos de todo el grupo. Liquidar es un botón.
• Cenas — quién cocina cada noche, qué platos, y la rotación de bungalows entre mayores y niños. Con la lista de la compra.
• Planes — las ideas del viaje, votadas, y las que ya tienen día.

CÓMO FUNCIONA

• Sin conexión. Todo vive en el móvil y se sincroniza cuando hay red; lo que se apunta sin cobertura sube después, solo. Un camping es exactamente el sitio donde esto hace falta.
• Los saldos se calculan en tu móvil a partir de los gastos, y no se sincronizan nunca: no hay un número guardado en ningún sitio que pueda quedarse viejo.
• Claro y oscuro, diseñados por separado y no uno invertido, y tres tamaños de letra: se lee al sol y con cuarenta y tantos años.

PRIVACIDAD

Sin anuncios, sin analítica, sin rastreo y sin nada que vender. No hay SDK de terceros dentro. La cuenta se elimina desde los ajustes de la propia aplicación.

ANTES DE DESCARGARLA

Es la libreta privada de un grupo de amigos concreto, no un servicio abierto: para entrar hace falta que alguien del grupo haya dado de alta antes tu identificador de Apple. Sin esa invitación no se puede usar con datos propios.

Verla entera sí se puede, y sin cuenta: en la pantalla de acceso hay una demostración con un camping inventado, con los gastos, las cenas y los planes funcionando de verdad.
```

**Otros campos**:

- **Categoría**: Viajes; secundaria, Finanzas.
- **URL de política de privacidad**: `https://ballenita-ops.galoopa.store/privacidad`
- **URL de soporte**: `https://ballenita-ops.galoopa.store/soporte`
- **URL de marketing**: `https://ballenita-ops.galoopa.store` (opcional)
- **Clasificación por edades**: sin contenido sensible → 4+.
- **Derechos de contenido**: no contiene contenido de terceros.

---

## 4. El cuestionario de privacidad (*App Privacy*)

Se declara lo que realmente se recoge, que es poco. La respuesta a la primera
pregunta —«¿recopila datos esta app?»— es **sí**, aunque tiente decir que no: el
identificador de Apple y lo que se apunta en la app viajan a un servidor.

| Dato | Categoría de Apple | Uso | ¿Vinculado a la identidad? | ¿Rastreo? |
|---|---|---|---|---|
| El `sub` de Apple | *Identifiers → User ID* | Funcionalidad de la app | Sí | No |
| El nombre corto | *Contact Info → Name* | Funcionalidad de la app | Sí | No |
| La dirección de correo, **si Apple la entrega** | *Contact Info → Email Address* | Funcionalidad de la app | Sí | No |
| Gastos, cenas, planes, eventos | *User Content → Other User Content* | Funcionalidad de la app | Sí | No |

Y lo que **no** hay que declarar, con su porqué:

- **No hay analítica ni diagnósticos**: no se recoge ni un contador.
- **No hay identificador de dispositivo de Apple**: el `X-Dispositivo` que viaja
  en las peticiones lo genera la propia app y no identifica el aparato fuera de
  aquí.
- **No hay ubicación**, ni fotos que salgan del móvil: el avatar con foto se
  guarda solo en el aparato (`lib/avatares.js`) y no se sincroniza.
- **No hay rastreo**, de modo que no hace falta *App Tracking Transparency* ni el
  permiso correspondiente.

Si algún día se declara analítica o vuelve un SDK de terceros, esta pantalla hay
que revisarla: una ficha que dice menos de lo que hace es un motivo de retirada.

---

## 5. Las notas de revisión, en inglés y listas para pegar

Es el campo que decide si esto sale a la primera. Quien revisa puede no saber
español, y el campo no es público.

```
Ballena Ops is a private trip organiser for one specific group of friends and
their families: shared expenses, dinners and plans.

Signing in with Apple is open to anyone, but it does not grant access: the
account has to be added in advance by someone already in the group. We cannot
provide an approved account, because being approved is precisely what makes
someone part of this group's private records.

To review the full app without an account, tap "Ver una demostración con datos
de ejemplo" on the sign-in screen. It opens the entire app with an invented
campsite: expenses split between families, running balances, dinners and plans.
Everything is real and functional; nothing leaves the device and no server is
involved. A permanent "demostración · salir" pill in the header marks the demo
and exits it.

(The other button on that screen, "Usar solo en este móvil", is for group
members who cannot sign in — it opens an empty notebook that syncs later. The
demo is the one to use for review, because it comes with data.)

Account deletion (guideline 5.1.1(v)): Settings (rightmost tab, bottom bar) →
"Tu cuenta" → "Eliminar mi cuenta". It deletes the account and its devices, and
calls the Sign in with Apple REST API to revoke the token. Note that signing in
*without* an invitation stores nothing at all — no account is created and no
record of the attempt is kept — so there is nothing to delete in that state.

Native capabilities in use: Sign in with Apple (native sheet), haptics and the
system share sheet. The app is offline-first: all data lives in the device and
syncs when there is a connection, which is the point — this is used at
campsites.

There are no third-party SDKs in the binary, no analytics, no advertising and no
tracking.
```

El último párrafo no es relleno: la **4.2** (funcionalidad mínima) es el otro
riesgo real de una aplicación que por dentro es una web, y conviene ponerle
delante la lista de lo que sí es nativo antes de que la busquen.

---

## 6. Los dos rechazos probables, y cómo se contestan

**Directriz 2.1 — «no pudimos acceder a la funcionalidad de la aplicación».**
Es el más probable, y el motivo es el diseño: quien revisa pulsa «Entrar con
Apple», recibe el aviso de que no tiene acceso y se queda ahí. Contesta en el
*Resolution Center* señalando el botón de la demostración, con su rótulo exacto
en español y una captura de la pantalla de acceso. No hace falta subir binario.

**Directriz 4.2 — «parece una web envuelta».** Contesta con la lista de
capacidades nativas del §5 y con lo que la app hace y una web no puede: funcionar
entera sin conexión y sincronizar sola al recuperarla. No discutas que dentro hay
un WKWebView; el argumento que vale es lo que aporta.

**Directriz 2.3.8 — nombres que no se parecen.** No debería pasar, porque
`patch-ios.mjs` sincroniza el nombre del icono con `appName`. Si pasa, es que
archivaste antes de correr `npm run sync:ios`.

---

## 7. Los números de versión, que son tres y se confunden

| Número | Dónde vive | Para qué |
|---|---|---|
| `version` de `app/package.json` | el repositorio | **Solo el OTA.** No toca el binario ni lo ve Apple |
| `MARKETING_VERSION` (*Version*) | Xcode | Lo que ve el público en la ficha. `1.0` la primera vez |
| `CURRENT_PROJECT_VERSION` (*Build*) | Xcode | **Tiene que subir en cada subida**, aunque no cambie nada más: App Store Connect rechaza una build repetida |

Cuando subas binario, que la versión de marketing acompañe a la del `package.json`.
Así un informe de fallos se puede situar en el tiempo sin adivinar.

---

## 8. Resumen: quién hace qué y cuándo

| Cuándo | Quién | Qué | Rato |
|---|---|---|---|
| Día 1 | tú | Fase 0: correo público, nombre, territorios | 20 min |
| Día 1 | tú | Fase 1: la clave `.p8` de revocación | 30 min |
| Día 1 | tú | Fase 2: tres secretos y `npm run desplegar` | 15 min |
| Día 1 | el repositorio | Fase 3: Pages republica al mergear | automático |
| Día 1 | tú | Fase 4: `curl` a `/privacidad` y `/soporte` | 5 min |
| Día 2 | tú, en el Mac | Fase 5: `cap add ios`, Xcode, Archive, Upload | 2 h |
| Día 2 | Apple | procesar la build | 15–60 min |
| Días 2–4 | tú y el grupo | Fase 6: TestFlight interno y el recorrido de la baja | 1–2 días |
| Día 4 | tú | Fase 7: la ficha, con los textos del §3 | 2 h |
| Día 4 | tú | Fase 8: cinco capturas, desde la demostración | 1 h |
| Día 4 | tú | Fase 9: adjuntar las notas del §5 y enviar | 15 min |
| Días 5–7 | Apple | la revisión | 1–3 días |
| Después | el repositorio | OTA en cada merge que suba la versión | automático |

Trabajo tuyo de verdad: unas **seis horas**, repartidas. El resto es esperar.
