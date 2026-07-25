# Receta: cualquier webapp (Vite/PWA) → app iOS con OTA 📱

Guía **genérica y autocontenida** para convertir una webapp en una **app iOS nativa mínima**
(cáscara **Capacitor** con la web empaquetada dentro) y **actualizarla por OTA** —descargando
el JS/web nuevo— **sin pasar por Apple** cada vez.

> Destilada de un proyecto real que ya usa este montaje. Copia los ficheros, cambia los
> parámetros de la tabla del §7 y sigue el checklist del §10. Los rótulos `<ASÍ>` son los
> valores que debes sustituir por los de tu app.

---

## 1. El modelo en una frase

- El **binario nativo** (la cáscara) casi nunca cambia → lo subes a Apple **la primera vez** y
  solo cuando toques algo nativo (plugin nuevo, iconos, permisos).
- Los cambios de **web/JS** (pantallas, lógica, estilos) se reparten por **OTA**: subes la
  versión, un workflow publica un *bundle* y las apps se actualizan solas al abrir. **Apple no
  interviene.**
- Si además publicas la **PWA** (p. ej. GitHub Pages), sigue viva en paralelo con el mismo código.

Esto encaja con lo que Apple permite (guía **3.3.2**: ejecutar JS descargado sin cambiar el
propósito de la app). Para reforzar la guía **4.2** («que no sea solo una web»), usa alguna
capacidad nativa real: **háptica**, **compartir** (hoja nativa) y/o **push**.

---

## 2. Requisitos (una vez)

- **Mac con Xcode** — obligatorio para archivar y subir a Apple. `npx cap add ios` y `pod
  install` **no** funcionan en Linux/CI.
- Cuenta **Apple Developer** enrolada (99 $/año).
- **CocoaPods**: `sudo gem install cocoapods` (o `brew install cocoapods`).
- **Node 18+** y tu webapp construyendo a una carpeta estática (con Vite, `dist/`).

---

## 3. Instalar Capacitor y plugins

Desde la carpeta de tu webapp (donde vive `package.json`):

```bash
# Núcleo + CLI + plataforma iOS
npm i @capacitor/core @capacitor/ios
npm i -D @capacitor/cli

# Capacidades nativas (elige las que uses; recomendadas las dos primeras por la guía 4.2)
npm i @capacitor/haptics @capacitor/share
npm i @capgo/capacitor-updater      # OTA
npm i @capacitor/push-notifications onesignal-cordova-plugin   # push (opcional)

npx cap init "<App Name>" "<APP_ID>" --web-dir=dist
```

- `<App Name>`: nombre visible (p. ej. `Mi App`).
- `<APP_ID>`: bundle id **reverse-DNS**, p. ej. `com.tuorg.miapp`. Es la identidad ante Apple;
  elígelo bien porque cambiarlo luego es un lío.
- `--web-dir`: la carpeta de salida del build (`dist` en Vite).

---

## 4. Ficheros a añadir (copia y personaliza)

### 4.1 `capacitor.config.json` (junto al `package.json`)

```json
{
  "appId": "<APP_ID>",
  "appName": "<App Name>",
  "webDir": "dist",
  "ios": {
    "scrollEnabled": true,
    "contentInset": "never"
  },
  "plugins": {
    "CapacitorHttp": { "enabled": true },
    "CapacitorUpdater": { "autoUpdate": false, "resetWhenUpdate": true }
  }
}
```

- `CapacitorHttp.enabled` evita choques de **CORS** al hacer `fetch` del manifiesto OTA.
- `CapacitorUpdater.autoUpdate:false` → controlas tú cuándo comprobar/aplicar (más predecible en
  iOS, que congela la PWA en segundo plano).

### 4.2 Puente nativo `src/lib/native.js`

Puente **seguro**: en web hace *no-op* (o usa el equivalente web), así la PWA y los tests no se
rompen. Solo actúa dentro de la cáscara iOS.

```js
import { Capacitor } from '@capacitor/core'

// URL del manifiesto OTA (GitHub Releases: /latest/download apunta siempre al último release).
const OTA_MANIFEST_URL =
  'https://github.com/<owner/repo>/releases/latest/download/latest.json'

// Variables públicas (seguras en el cliente). La REST key de push NUNCA va aquí.
const ONESIGNAL_APP_ID = import.meta.env?.VITE_ONESIGNAL_APP_ID
const PUSH_ENDPOINT = import.meta.env?.VITE_PUSH_ENDPOINT

export function isNative() {
  try { return Capacitor?.isNativePlatform?.() === true } catch { return false }
}

// Háptica sutil al tocar. En web: no-op.
export async function tap(style = 'light') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Light })
  } catch { /* sin háptica: da igual */ }
}

// Hoja de compartir nativa; en web cae a navigator.share si existe.
export async function share({ title, text, url } = {}) {
  try {
    const { Share } = await import('@capacitor/share')
    if (!(await Share.canShare())?.value) throw new Error('no disponible')
    await Share.share({ title, text, url }); return true
  } catch {
    try { if (navigator?.share) { await navigator.share({ title, text, url }); return true } } catch {}
    return false
  }
}

// OTA: lee el manifiesto y, si hay versión nueva, descarga y la deja lista para la próxima apertura.
export async function checkForOtaUpdate() {
  if (!isNative()) return { status: 'skip' }
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const current = await CapacitorUpdater.current()
    const res = await fetch(OTA_MANIFEST_URL, { cache: 'no-store' })
    if (!res.ok) return { status: 'no-manifest' }
    const m = await res.json() // { version, url, checksum }
    if (!m?.version || !m?.url || m.version === current?.bundle?.version) {
      return { status: 'up-to-date', version: current?.bundle?.version }
    }
    const bundle = await CapacitorUpdater.download({ url: m.url, version: m.version, checksum: m.checksum })
    await CapacitorUpdater.set(bundle) // se aplica en la próxima carga; notifyAppReady() evita rollback
    return { status: 'updated', version: m.version }
  } catch (e) { return { status: 'error', error: String(e?.message ?? e) } }
}

// Push (opcional, OneSignal). Sin APP_ID no pide permiso (evita el prompt vacío).
export async function registerPush() {
  if (!isNative() || !ONESIGNAL_APP_ID) return null
  try {
    const OneSignal = (await import('onesignal-cordova-plugin')).default
    OneSignal.initialize(ONESIGNAL_APP_ID)
    await OneSignal.Notifications.requestPermission(true)
    return 'onesignal'
  } catch { return null }
}

// Envío automático de push desde TU función serverless (que guarda la REST key). No-op sin endpoint.
export async function notifyGroup({ title, message, url } = {}) {
  if (!PUSH_ENDPOINT) return false
  try {
    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, url }),
    })
    return res.ok
  } catch { return false }
}

// Llamar una vez al arrancar (en tu main.jsx/main.ts). En web no hace nada.
export async function initNative() {
  if (!isNative()) return
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.notifyAppReady() // confirma arranque OK → sin rollback del bundle OTA
  } catch {}
  checkForOtaUpdate() // en segundo plano
  registerPush()
}
```

En tu punto de entrada (`main.jsx`/`main.ts`):

```js
import { initNative } from './lib/native.js'
initNative()
```

### 4.3 `scripts/patch-ios.mjs` — quitar el rebote del scroll sin tocar Xcode

El «rubber-band» del WKWebView delata que es una web. Se quita subclaseando el controller y
poniendo `scrollView.bounces = false`. Este script lo hace **automático e idempotente** al
sincronizar. **Gotcha clave:** además de crear el `.swift` hay que **registrarlo en el
`.pbxproj`**; si no, no se compila y la app arranca en **pantalla negra**.

```js
// Aplica el fix del rebote al proyecto iOS generado por Capacitor. Idempotente.
// Si ios/ no existe todavía, no hace nada. Se engancha a "npm run sync:ios".
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IOS_APP = 'ios/App/App'
if (!existsSync(IOS_APP)) {
  console.log('[patch-ios] ios/ no existe aún — ejecuta "npx cap add ios" primero. Omitido.')
  process.exit(0)
}

// 1) MainViewController.swift: subclasea el bridge y desactiva el bounce.
const vcPath = join(IOS_APP, 'MainViewController.swift')
const vcSource = `import Capacitor

class MainViewController: CAPBridgeViewController {
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        webView?.scrollView.bounces = false
    }
}
`
if (!existsSync(vcPath) || readFileSync(vcPath, 'utf8') !== vcSource) {
  writeFileSync(vcPath, vcSource); console.log('[patch-ios] MainViewController.swift escrito.')
}

// 2) Registrarlo en el proyecto Xcode (si no, no compila → pantalla negra).
const pbxPath = 'ios/App/App.xcodeproj/project.pbxproj'
if (existsSync(pbxPath)) {
  let pbx = readFileSync(pbxPath, 'utf8')
  if (!pbx.includes('MainViewController.swift')) {
    const BUILDID = 'BA11EA0000000000000000A1'
    const FILEID = 'BA11EA0000000000000000A2'
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift in Sources \*\/ = \{isa = PBXBuildFile;[^\n]*\};\n)/,
      `$1\t\t${BUILDID} /* MainViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${FILEID} /* MainViewController.swift */; };\n`)
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift \*\/ = \{isa = PBXFileReference;[^\n]*\};\n)/,
      `$1\t\t${FILEID} /* MainViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MainViewController.swift; sourceTree = "<group>"; };\n`)
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift \*\/,\n)/, `$1\t\t\t\t${FILEID} /* MainViewController.swift */,\n`)
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift in Sources \*\/,\n)/, `$1\t\t\t\t${BUILDID} /* MainViewController.swift in Sources */,\n`)
    const ok = (pbx.split(BUILDID).length - 1 === 2) && (pbx.split(FILEID).length - 1 === 3)
    if (ok) { writeFileSync(pbxPath, pbx); console.log('[patch-ios] Registrado en Xcode ✅') }
    else console.warn('[patch-ios] ⚠ Añádelo a mano: Xcode → clic derecho en App → Add Files to "App" → target App.')
  }
}

// 3) Apuntar el storyboard al MainViewController.
const sbPath = join(IOS_APP, 'Base.lproj', 'Main.storyboard')
if (existsSync(sbPath)) {
  let sb = readFileSync(sbPath, 'utf8')
  if (sb.includes('customClass="CAPBridgeViewController" customModule="Capacitor"')) {
    sb = sb.replace('customClass="CAPBridgeViewController" customModule="Capacitor"',
      'customClass="MainViewController" customModuleProvider="target"')
    writeFileSync(sbPath, sb); console.log('[patch-ios] Storyboard apuntado. Rebote desactivado ✅')
  }
}
```

> Si tu versión de Capacitor trae otro template y el script no reconoce el view controller,
> ponlo a mano en Xcode: `Main.storyboard` → clase de la vista → `MainViewController`.

### 4.4 `package.json` — scripts

```json
{
  "scripts": {
    "build": "vite build",
    "build:app": "vite build",
    "sync:ios": "npm run build:app && cap sync ios && npm run patch:ios",
    "patch:ios": "node scripts/patch-ios.mjs",
    "open:ios": "cap open ios"
  }
}
```

> `build:app` construye con **base `/`** (raíz), no con el subpath de GitHub Pages. Si publicas
> también la PWA en un subpath, usa una variable de entorno para cambiar `base` en `vite.config`
> (p. ej. `base: process.env.GITHUB_PAGES ? '/<repo>/' : '/'`).

### 4.5 UX táctil (que se sienta app, no web)

En el `<head>` del `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

En el CSS global:

```css
* { -webkit-tap-highlight-color: transparent; }
body {
  overscroll-behavior: none;          /* menos rebote (el resto lo remata patch-ios) */
  touch-action: manipulation;         /* sin doble-tap-zoom */
  -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none;        /* sin menú del long-press */
}
input, textarea, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
/* Respeta el notch/safe-areas: usa env(safe-area-inset-*) en cabeceras y barras fijas. */
```

### 4.6 Workflow OTA `.github/workflows/ota.yml`

Publica el bundle automáticamente cuando **subes la versión** en `package.json` y mergeas a
`main`. Si la versión ya tiene release, no republica.

```yaml
name: Publish OTA bundle

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths: ['app/**']          # ajusta a la ruta de tu webapp (o quítalo si está en la raíz)

permissions:
  contents: write

jobs:
  bundle:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app  # ajusta o elimina si tu webapp está en la raíz
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: app/package-lock.json

      - name: ¿Versión nueva?
        id: check
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          if gh release view "ota-v$VERSION" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
            echo "publish=false" >> "$GITHUB_OUTPUT"
          else
            echo "publish=true" >> "$GITHUB_OUTPUT"
          fi

      - if: steps.check.outputs.publish == 'true'
        run: npm ci
      - if: steps.check.outputs.publish == 'true'
        run: npm test
      - if: steps.check.outputs.publish == 'true'
        run: npm run build:app
        env:                                   # inyecta aquí tus VITE_* si los usas
          VITE_ONESIGNAL_APP_ID: ${{ secrets.VITE_ONESIGNAL_APP_ID }}
          VITE_PUSH_ENDPOINT: ${{ secrets.VITE_PUSH_ENDPOINT }}

      - name: Empaquetar bundle + manifiesto
        if: steps.check.outputs.publish == 'true'
        run: |
          VERSION="${{ steps.check.outputs.version }}"
          (cd dist && zip -qr ../bundle.zip .)   # index.html debe quedar en la RAÍZ del zip
          CHECKSUM=$(sha256sum bundle.zip | awk '{print $1}')
          URL="https://github.com/${GITHUB_REPOSITORY}/releases/download/ota-v${VERSION}/bundle.zip"
          printf '{ "version": "%s", "url": "%s", "checksum": "%s" }\n' "$VERSION" "$URL" "$CHECKSUM" > latest.json
          cat latest.json

      - name: Crear release OTA
        if: steps.check.outputs.publish == 'true'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ota-v${{ steps.check.outputs.version }}
          name: OTA v${{ steps.check.outputs.version }}
          body: Actualización OTA (JS/web) para la app iOS. No requiere review de Apple.
          files: |
            app/bundle.zip
            app/latest.json
```

---

## 5. Generar y subir (en el Mac)

```bash
# 1) Generar el proyecto nativo (SOLO en Mac: hace pod install)
npx cap add ios
npm run sync:ios        # build web + copiar a ios/ + aplicar patch-ios

# 2) Iconos y splash desde una fuente 1024×1024 (opaca, cuadrada) y 2732×2732
npx @capacitor/assets generate --ios

# 3) Abrir Xcode
npm run open:ios
```

En Xcode:

1. **Signing & Capabilities** → elige tu *Team*; confirma el bundle id `<APP_ID>`.
2. Si usas push: añade la capacidad **Push Notifications**.
3. *Any iOS Device* → **Product ▸ Archive** → **Distribute App ▸ App Store Connect ▸ Upload**.
4. Prueba en **TestFlight** (interno, casi sin review) y luego envía a **review** de la App Store.

> El proyecto `ios/` normalmente **no se versiona** (se regenera con `cap add ios`), porque
> `pod install` necesita macOS. Si prefieres commitearlo, añádelo tras el primer `cap add ios`.

---

## 6. El día a día: publicar un OTA

1. Cambia algo de **web/JS**.
2. **Sube la versión** en `package.json` (p. ej. `1.0.0 → 1.0.1`).
3. **Merge a `main`.** El workflow compila, empaqueta `dist/` en `bundle.zip`, calcula el
   `sha256`, genera `latest.json` y crea el release `ota-v<version>`. Si no cambias la versión,
   **no publica nada**.
4. Las apps, al abrir, leen `…/releases/latest/download/latest.json`; si la versión es más nueva,
   descargan el bundle y lo aplican en la **siguiente apertura**.

> Nada de esto toca Apple. Solo repites el §5 (Xcode) cuando cambies algo **nativo** (plugin,
> iconos, permisos, versión de Capacitor).

---

## 7. Parámetros a personalizar por proyecto

| Parámetro | Dónde | Ejemplo |
| --- | --- | --- |
| Nombre de la app | `capacitor.config.json` · `cap init` | `Mi App` |
| Bundle id (`appId`) | `capacitor.config.json` · Xcode Signing | `com.tuorg.miapp` |
| Repo GitHub | `native.js` (`OTA_MANIFEST_URL`) · workflow | `tuorg/miapp` |
| Carpeta de la webapp | workflow (`working-directory`, `paths`, `cache-dependency-path`) | `app/` o raíz |
| `webDir` | `capacitor.config.json` | `dist` |
| `base` del build | `vite.config` | `/` (app) vs `/<repo>/` (Pages) |
| Push App ID | secret `VITE_ONESIGNAL_APP_ID` | público, seguro |
| Endpoint de envío | secret `VITE_PUSH_ENDPOINT` | tu función serverless |

---

## 8. Push (opcional, resumen)

- **OneSignal** (capa gratis) gestiona APNs por ti. Sube tu **APNs Auth Key (.p8)** a su panel;
  pon la **App ID** en `VITE_ONESIGNAL_APP_ID`.
- Cada dispositivo queda **suscrito** → ya puedes enviar avisos a mano desde el panel.
- Para envío **automático** («pasó X → avisa»), la **REST key** vive en una **función
  serverless** (Cloudflare Workers / Vercel / Netlify), nunca en el cliente. Su URL va en
  `VITE_PUSH_ENDPOINT`; llamas a `notifyGroup({title, message})` desde tu código.
- ⚠️ **Nunca** metas la REST key en el build: el bundle OTA y (si aplica) Pages son públicos.

---

## 9. Troubleshooting (baches reales)

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| **Pantalla negra** al arrancar | El `.swift` existe pero no está en el `.pbxproj` → no compila | `patch-ios.mjs` lo registra; si falla, añádelo a mano en Xcode (target App) |
| El OTA **no baja** | Manifiesto inaccesible o versión igual | Revisa `OTA_MANIFEST_URL`, que el release exista y que subiste la versión |
| `fetch` del OTA falla por **CORS** | `CapacitorHttp` desactivado | `"CapacitorHttp": { "enabled": true }` |
| El bundle OTA carga en blanco | `index.html` no está en la **raíz** del zip | Empaqueta el **contenido** de `dist/`, no la carpeta (`cd dist && zip -r ../bundle.zip .`) |
| Rutas rotas en la app nativa | Build con `base` de Pages (subpath) | Compila la app con `base: '/'` (`build:app`) |
| Rollback del bundle tras actualizar | No se llamó a `notifyAppReady()` | Asegúrate de `initNative()` al arrancar |
| `cap add ios` falla en CI/Linux | Necesita macOS + CocoaPods | Hazlo en el Mac |

---

## 10. Checklist para un proyecto nuevo

- [ ] `npm i` Capacitor + plugins · `npx cap init "<App Name>" "<APP_ID>" --web-dir=dist`
- [ ] `capacitor.config.json` (CapacitorHttp on, CapacitorUpdater manual)
- [ ] `src/lib/native.js` con tu `OTA_MANIFEST_URL` (repo correcto) · `initNative()` en el arranque
- [ ] `scripts/patch-ios.mjs` + scripts `sync:ios` / `patch:ios` / `open:ios` en `package.json`
- [ ] viewport `viewport-fit=cover` + CSS táctil + safe-areas
- [ ] `.github/workflows/ota.yml` (ajusta `working-directory`/`paths` y los `VITE_*`)
- [ ] En el Mac: `npx cap add ios` → `npm run sync:ios` → assets → Xcode (Team, capacidades)
- [ ] **Archive → TestFlight → App Store** (solo la 1ª vez y cuando cambie lo nativo)
- [ ] Validar en un iPhone real que el **OTA** entra al abrir
- [ ] (Opcional) Push: OneSignal + `.p8` + secrets + función serverless para envío automático

---

> **Regla de oro:** *sube la versión y mergea* para un OTA; *abre Xcode* solo cuando cambie algo
> nativo. Todo lo demás (web/JS) llega a los iPhones sin pasar por Apple.
