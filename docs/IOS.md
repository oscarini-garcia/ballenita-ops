# App iOS híbrida 🐋📱

Cómo Ballena Ops se publica como **app iOS** con **cáscara nativa mínima** (Capacitor) y
la web **empaquetada dentro**, actualizable **por OTA sin pasar por Apple** cada vez.

## Idea en una frase

- El **binario nativo** (la cáscara) casi nunca cambia → solo lo subes a Apple **la primera vez**
  y cuando toques algo nativo (un plugin nuevo, iconos…).
- Todos los cambios de **web/JS** (pantallas, lógica, estilos) se reparten por **OTA**: subes la
  versión, se publica un bundle y las apps se actualizan solas. **Apple no interviene.**
- La **PWA** en GitHub Pages sigue viva en paralelo (el "Añadir a inicio" no desaparece).

Esto es lo que Apple permite (guía 3.3.2: ejecutar JS descargado mientras no cambie el propósito
de la app). Para reforzar la guía 4.2 ("que no sea solo una web"), la app usa capacidades
nativas reales: **háptica**, **compartir** (hoja nativa) y **push** (registro; envío pendiente).

> ⚠️ **La migración al backend propio añadió un plugin nativo**
> (`@capacitor-community/apple-sign-in`, para el acceso con Apple). Los plugins son código
> nativo, así que **no** se reparten por OTA: hace falta **compilar y subir un binario nuevo**
> a Apple una vez. Hasta entonces, la app instalada dirá que esa versión no trae el acceso con
> Apple. Después, el día a día vuelve a ser el de siempre. Ver [`DESPLIEGUE.md`](DESPLIEGUE.md) §8.

## Qué ya está en el repo (lado web/JS)

- `app/capacitor.config.json` — `appId: com.garciadoral.ballenitaops`, bundle empaquetado (`webDir: dist`),
  `CapacitorHttp` activado (para que el `fetch` del OTA no choque con CORS) y `CapacitorUpdater`
  en modo manual.
- `app/src/lib/native.js` — puente seguro: háptica (`tap`), compartir (`share`), OTA
  (`checkForOtaUpdate`) y arranque (`initNative`). **En web hace no-op**, así la PWA y los tests
  no se rompen. `registerPush()` sigue ahí y devuelve `null`: hoy no hay avisos, y el porqué
  está más abajo.
- `app/src/main.jsx` — llama a `initNative()` al arrancar.
- `app/src/App.jsx` — háptica al cambiar de tab y botón 📤 de compartir en la cabecera.
- `.github/workflows/ota.yml` — publica el bundle OTA en GitHub Releases.
- Scripts: `npm run build:app`, `npm run sync:ios`, `npm run open:ios`.

## Requisitos (una vez)

- **Mac con Xcode** instalado (obligatorio para archivar y subir).
- **Apple Developer** enrolado (ya lo tienes).
- **CocoaPods** (`sudo gem install cocoapods` o vía Homebrew).

## Fase A — Generar el proyecto iOS (en tu Mac)

```bash
cd app
npm install
npx cap add ios      # genera ios/ y hace pod install (esto NO se puede hacer en Linux/CI)
npm run sync:ios     # build web + copia a ios/
```

> El proyecto `ios/` lo generas aquí, en el Mac. No está en el repo a propósito: `pod install`
> necesita macOS y no se puede verificar desde el entorno de desarrollo en la nube.

### Quitar el rebote del scroll (rubber-band) al 100 % — automático

El CSS ya pone `overscroll-behavior: none` (cubre la mayoría). Para eliminarlo del todo en el
WKWebView hay que subclasear el controller y desactivar `scrollView.bounces` — pero **no hace
falta tocar Xcode a mano**: `npm run sync:ios` ejecuta `scripts/patch-ios.mjs`, que crea
`ios/App/App/MainViewController.swift`, lo **registra en el proyecto Xcode** (si no, el `.swift`
no se compila y el arranque sale en negro) y reapunta el storyboard. Es idempotente, así que se
aplica cada vez que sincronizas.

El mismo script deja puestas otras tres cosas que hacen falta para la App Store y
que se perderían en el siguiente `cap add ios` si se pusieran a mano en Xcode
—`ios/` no se versiona—: el **cumplimiento de exportación**
(`ITSAppUsesNonExemptEncryption`, que si no se pregunta en cada subida y retiene
la build), que esto es **solo iPhone** (`TARGETED_DEVICE_FAMILY = 1`, o App Store
Connect exigirá capturas de iPad de 13″) y el **nombre bajo el icono**
(`CFBundleDisplayName` = `appName`, que es lo que pide la directriz 2.3.8).

> Si el script avisa de que no reconoce el view controller (una versión de Capacitor con otro
> template), ponlo a mano: en `Main.storyboard`, clase de la vista → `MainViewController`. El
> `.swift` ya te lo habrá dejado creado.

## Fase B — Firma, iconos y capacidades (Xcode)

```bash
npm run open:ios     # abre Xcode
```

- **Signing & Capabilities** → selecciona tu *Team*; el bundle id es `com.garciadoral.ballenitaops`.

  > ⚠️ **El `appId` de `capacitor.config.json` solo se aplica al generar el proyecto.** Es decir,
  > la primera vez que corres `npx cap add ios`. A partir de ahí, `npm run sync:ios` copia la web
  > y actualiza los plugins, pero **no** toca el `PRODUCT_BUNDLE_IDENTIFIER` del proyecto Xcode.
  > Si cambias el `appId` con `ios/` ya generado, hay que cambiarlo **también a mano** aquí, en
  > *Signing & Capabilities → Bundle Identifier* (o borrar `ios/` y regenerarlo). Mantén los dos
  > iguales de todas formas: si algún día se regenera el proyecto, mandará el del fichero.
  >
  > Y recuerda que este identificador tiene que coincidir con el App ID del portal de Apple y
  > con `APPLE_AUD_IOS` de `api/wrangler.toml`. Si se desvía, el Worker rechaza el token por
  > «audiencia no admitida» y la app se queda en la pantalla de acceso sin explicar por qué.
- Añade la capacidad **Sign in with Apple**. ⚠️ **Sin esto no se entra**, y por tanto no se
  sincroniza nada: desde la migración al backend propio, el acceso vive únicamente aquí
  (`docs/DESPLIEGUE.md` §3). Tiene que estar también marcada en el App ID del portal de Apple;
  si falta en un sitio de los dos, Xcode firma sin protestar y el fallo aparece al pulsar
  «Entrar con Apple».
- **No** añadas *Push Notifications*: hoy no hay avisos y no hay plugin que los
  pida (ver más abajo). Una capacidad marcada sin nada detrás solo sirve para
  que iOS pida un permiso que no se va a usar.
- **Iconos / splash**: las imágenes fuente ya están en `app/assets/` (`icon.png` 1024×1024
  cuadrado y opaco, y `splash.png` 2732×2732). Genera todos los tamaños con:
  ```bash
  npx @capacitor/assets generate --ios   # usa app/assets/icon.png y splash.png
  ```
  > El icono usa la ballena del emoji (variante Noto, la que se ve en el render), no la de
  > Apple: el dibujo propietario de Apple no se puede empaquetar en un asset. Si algún día
  > quieres otro dibujo, sustituye `app/assets/icon.png` y vuelve a generar.

## Fase C — Primer build y subida (Xcode, solo esta vez)

1. Selecciona *Any iOS Device* → **Product ▸ Archive**.
2. **Distribute App ▸ App Store Connect ▸ Upload**.
3. En App Store Connect: prueba en **TestFlight** (interno, casi sin review) y luego envía a
   **review** de la App Store.

Todo lo que la tienda pide además del binario —la ficha, las capturas, el
cuestionario de privacidad, las notas de revisión y los dos rechazos probables—
está en [`APPSTORE.md`](APPSTORE.md), con la secuencia entera y quién hace qué.

A partir de aquí, los cambios de web/JS **no** necesitan repetir esto: van por OTA.

## Fase D — Publicar una actualización OTA (el día a día) — automático

**Basta con subir la versión y mergear:**

1. Sube la versión en `app/package.json` (p. ej. `0.1.1` → `0.1.2`).
2. Merge a `main`. El workflow **Publish OTA bundle** salta solo: si esa versión aún no tiene
   release, compila (`base '/'`), empaqueta `dist/` en `bundle.zip`, calcula el `sha256`, genera
   `latest.json` y crea el *release* `ota-vX.Y.Z`. **Si no cambias la versión, no publica nada.**
3. Las apps, al abrir, leen `releases/latest/download/latest.json`; si la versión es más nueva,
   descargan y aplican el bundle en la siguiente apertura.

> También puedes lanzarlo a mano: *Actions → Publish OTA bundle → Run workflow*.

> **Validar en dispositivo:** el ciclo OTA no se puede probar sin un build nativo. En la primera
> release comprueba en un iPhone real que la app coge la actualización. Si `@capgo/capacitor-updater`
> reclama firma del bundle, se activa el firmado (par de claves) — ver su documentación; el
> `checksum` sha256 ya va en el manifiesto.

## Push: hoy no hay, y es una decisión

Aquí estaban OneSignal y `@capacitor/push-notifications`, cableados en
`registerPush()` y **inertes**: sin `VITE_ONESIGNAL_APP_ID` no se inicializaba
nada, y no había ningún servidor que enviara un aviso. Se retiraron antes del
primer envío a la App Store, por tres motivos en orden de peso:

1. OneSignal es de los SDK de terceros que Apple obliga a declarar con su
   manifiesto de privacidad firmado, y las etiquetas de privacidad de la ficha
   tendrían que recoger lo que recopila. Todo eso por una función que nadie
   estaba usando.
2. Sin él, la ficha puede decir la verdad más limpia posible: sin analítica, sin
   rastreo y sin SDK de nadie dentro del binario.
3. Un plugin de avisos en el binario invita a iOS a pedir el permiso de
   notificaciones sin nada detrás, que es la peor manera de gastarlo: un «no»
   dado de sopetón solo se recupera yendo a los Ajustes de iOS.

`notifyGroup()` sigue en `native.js` y sigue siendo no-op sin
`VITE_PUSH_ENDPOINT`. `registerPush()` devuelve `null` siempre.

### El día que se quiera push

Es `npm install`, reponer `registerPush()`, `npm run sync:ios` y **un binario
nuevo con su revisión**: los plugins nativos no viajan por OTA. Y conviene no
repetir el camino de antes. `garciadoral-ops` acabó hablando **APNs directamente
desde el Worker** —clave `.p8` de APNs en un secreto de Cloudflare, sin
intermediario—, lo que evita el SDK de terceros entero y una capa de privacidad
que declarar. Su `api/src/apns.js` y su `docs/despliegue-cloudflare.md` §4.6 y
§8.3 son el mapa; el bache conocido es que **el entorno de APNs tiene que
coincidir con cómo se instaló la app** (`development` desde Xcode, `production`
desde TestFlight o la App Store), y equivocarse da `BadDeviceToken` sin más
explicación.
