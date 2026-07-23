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

## Qué ya está en el repo (lado web/JS)

- `app/capacitor.config.json` — `appId: com.oscarini.ballenaops`, bundle empaquetado (`webDir: dist`),
  `CapacitorHttp` activado (para que el `fetch` del OTA no choque con CORS) y `CapacitorUpdater`
  en modo manual.
- `app/src/lib/native.js` — puente seguro: háptica (`tap`), compartir (`share`), OTA
  (`checkForOtaUpdate`), push (`registerPush`) y arranque (`initNative`). **En web hace no-op**,
  así la PWA y los tests no se rompen.
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

### Quitar el rebote del scroll (rubber-band) al 100 %

El CSS ya pone `overscroll-behavior: none` (cubre la mayoría). Para eliminarlo del todo en el
WKWebView, subclasea el controller. En `ios/App/App/` crea `MainViewController.swift`:

```swift
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        webView?.scrollView.bounces = false
    }
}
```

Y en `Main.storyboard` cambia la clase del *Bridge View Controller* a `MainViewController`.

## Fase B — Firma, iconos y capacidades (Xcode)

```bash
npm run open:ios     # abre Xcode
```

- **Signing & Capabilities** → selecciona tu *Team*; deja el bundle id `com.oscarini.ballenaops`.
- Añade la capacidad **Push Notifications** (para la fase de push).
- **Iconos / splash**: la forma fácil es `@capacitor/assets`:
  ```bash
  npx @capacitor/assets generate --ios   # a partir de un icon.png de 1024×1024 y un splash
  ```

## Fase C — Primer build y subida (Xcode, solo esta vez)

1. Selecciona *Any iOS Device* → **Product ▸ Archive**.
2. **Distribute App ▸ App Store Connect ▸ Upload**.
3. En App Store Connect: prueba en **TestFlight** (interno, casi sin review) y luego envía a
   **review** de la App Store.

A partir de aquí, los cambios de web/JS **no** necesitan repetir esto: van por OTA.

## Fase D — Publicar una actualización OTA (el día a día)

1. Sube la versión en `app/package.json` (p. ej. `0.1.0` → `0.1.1`).
2. Lanza el workflow **Publish OTA bundle** (pestaña *Actions* → *Run workflow*, o crea el tag
   `ota-v0.1.1`).
3. El workflow compila (`base '/'`), empaqueta `dist/` en `bundle.zip`, calcula el `sha256`,
   genera `latest.json` y crea el *release* `ota-vX.Y.Z`.
4. Las apps, al abrir, leen `releases/latest/download/latest.json`; si la versión es más nueva,
   descargan y aplican el bundle en la siguiente apertura.

> **Validar en dispositivo:** el ciclo OTA no se puede probar sin un build nativo. En la primera
> release comprueba en un iPhone real que la app coge la actualización. Si `@capgo/capacitor-updater`
> reclama firma del bundle, se activa el firmado (par de claves) — ver su documentación; el
> `checksum` sha256 ya va en el manifiesto.

## Pendiente — Envío de push

El registro (permiso + token APNs) ya está en `registerPush()`. Falta el **emisor**: algo que
mande la notificación cuando pasa algo (nuevo gasto, plan votado…). Como no hay backend propio,
las opciones son:

- **OneSignal** (capa gratuita): gestiona APNs por ti; se dispara desde su panel o API.
- **Notificaciones locales** (`@capacitor/local-notifications`): sin servidor, pero solo avisos
  programados en el propio dispositivo (no "otro añadió un gasto").
- Un **emisor propio** (Cloud Function) que, al detectar cambios en el doc de JSONBin, llame a APNs.

Decisión y montaje: fase aparte.
