# Playbook: convertir una webapp en app iOS nativa con OTA 🐋📱

Guía **reutilizable** para coger una webapp (React/Vite u otra que compile a estáticos) y
publicarla como **app iOS** con **cáscara nativa mínima** (Capacitor) y **actualizaciones OTA**
(sin pasar por Apple en cada cambio). Extraído de la conversión de Ballena Ops; los ficheros
están listos para copiar, con los sitios a personalizar marcados como `<ASÍ>`.

> Si buscas el caso concreto de este repo, mira [`IOS.md`](IOS.md). Este documento es el
> **método genérico** para replicarlo en otros proyectos.

---

## 1. El modelo (qué consigues)

- **Cáscara nativa** = un WKWebView dentro de una app iOS (Capacitor). Casi nunca cambia.
- La **web va empaquetada dentro** de la app (arranca offline, "parece una app de verdad" al
  revisor de Apple → pasa la guía 4.2).
- **OTA**: los cambios de web/JS se descargan por aire desde **GitHub Releases** (auto-alojado,
  gratis). Subes la versión y mergeas → la app se actualiza sola al reabrirla. **Apple solo
  interviene la primera vez** (y cuando toques algo nativo).
- La **PWA/web sigue viva** en paralelo (si la tenías desplegada, no desaparece).

**Regla mental:** binario nativo = raro que cambie (→ Apple). Web/JS = a diario (→ OTA).

| Cambias… | Cómo llega al móvil |
| --- | --- |
| Pantallas, lógica, estilos (web/JS) | **OTA** (subes versión + merge). Sin Apple. |
| Plugin nativo, icono, capacidad (push…) | Build nativo nuevo en Xcode → TestFlight/App Store |

---

## 2. Requisitos

**En tu Mac (para compilar/firmar):**
- **Xcode** (App Store) + abrirlo una vez para instalar componentes.
- **CocoaPods**: `brew install cocoapods`.
- **Node** ≥ 18.
- **Apple Developer Program** (de pago) si quieres App Store o push. Para probar en tu propio
  iPhone vale hasta la cuenta gratis.

**La webapp debe:**
- Compilar a una carpeta de **estáticos** (`dist/`, `build/`…), con `index.html` en la raíz.
- Poder buildear con **base `/`** (rutas relativas a la raíz), NO un subpath tipo `/mi-repo/`.
  Con Vite: el build sin `GITHUB_PAGES` ya suele ser base `/` (revisa tu `vite.config`).

---

## 3. Instalar Capacitor y plugins

Desde la carpeta de la app (donde está el `package.json`):

```bash
npm install @capacitor/core @capgo/capacitor-updater @capacitor/haptics @capacitor/share
npm install -D @capacitor/cli @capacitor/ios
# Opcionales (si vas a usarlos):
npm install onesignal-cordova-plugin         # push
```

---

## 4. Ficheros a añadir (copiar y personalizar)

### 4.1 `capacitor.config.json` (raíz de la app)

```json
{
  "appId": "com.<TUUSUARIO>.<TUAPP>",
  "appName": "<Tu App>",
  "webDir": "dist",
  "ios": { "scrollEnabled": true, "contentInset": "never" },
  "plugins": {
    "CapacitorHttp": { "enabled": true },
    "CapacitorUpdater": { "autoUpdate": false, "resetWhenUpdate": true }
  }
}
```

- `webDir`: la carpeta de build (`dist`, `build`…).
- `CapacitorHttp.enabled`: **importante** — hace que el `fetch` vaya por HTTP nativo, así el
  `fetch` del manifiesto OTA no choca con CORS al seguir el redirect de GitHub Releases.
- `CapacitorUpdater.autoUpdate: false`: gestionamos el OTA a mano (ver 4.2).

### 4.2 Puente nativo `src/lib/native.js`

Seguro en web (no-op / equivalente web), activo en la cáscara. Incluye OTA, compartir, háptica
y push. **Personaliza `OTA_MANIFEST_URL`** con tu `owner/repo`:

```js
import { Capacitor } from '@capacitor/core'

// `releases/latest/download/...` redirige siempre al último release publicado.
const OTA_MANIFEST_URL =
  'https://github.com/<OWNER>/<REPO>/releases/latest/download/latest.json'

// Push por OneSignal (opcional). La App ID es pública; la REST key NUNCA va aquí.
const ONESIGNAL_APP_ID = import.meta.env?.VITE_ONESIGNAL_APP_ID
const PUSH_ENDPOINT = import.meta.env?.VITE_PUSH_ENDPOINT

export function isNative() {
  try { return Capacitor?.isNativePlatform?.() === true } catch { return false }
}

export async function tap(style = 'light') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Light })
  } catch { /* sin háptica */ }
}

export async function share({ title, text, url, dialogTitle } = {}) {
  try {
    const { Share } = await import('@capacitor/share')
    const can = await Share.canShare()
    if (!can?.value) throw new Error('no share')
    await Share.share({ title, text, url, dialogTitle })
    return true
  } catch {
    try { if (navigator?.share) { await navigator.share({ title, text, url }); return true } } catch {}
    return false
  }
}

// OTA manual auto-alojado: lee latest.json y aplica si hay versión nueva.
export async function checkForOtaUpdate() {
  if (!isNative()) return { status: 'skip' }
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const current = await CapacitorUpdater.current()
    const res = await fetch(OTA_MANIFEST_URL, { cache: 'no-store' })
    if (!res.ok) return { status: 'no-manifest' }
    const manifest = await res.json() // { version, url, checksum }
    if (!manifest?.version || !manifest?.url || manifest.version === current?.bundle?.version) {
      return { status: 'up-to-date' }
    }
    const bundle = await CapacitorUpdater.download({
      url: manifest.url, version: manifest.version, checksum: manifest.checksum,
    })
    await CapacitorUpdater.set(bundle) // aplica en la próxima apertura
    return { status: 'updated', version: manifest.version }
  } catch (e) { return { status: 'error', error: String(e?.message ?? e) } }
}

// Push: solo pide permiso si OneSignal está configurado (evita el prompt prematuro).
export async function registerPush() {
  if (!isNative() || !ONESIGNAL_APP_ID) return null
  try {
    const OneSignal = (await import('onesignal-cordova-plugin')).default
    OneSignal.initialize(ONESIGNAL_APP_ID)
    await OneSignal.Notifications.requestPermission(true)
    return 'onesignal'
  } catch { return null }
}

// Envío automático de push: delega en TU endpoint serverless (que guarda la REST
// key). No-op si no hay VITE_PUSH_ENDPOINT. Nunca metas la REST key en el cliente.
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

// Llamar una vez al arrancar (en web no hace nada).
export async function initNative() {
  if (!isNative()) return
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.notifyAppReady() // ¡imprescindible! evita rollback del bundle
  } catch {}
  checkForOtaUpdate()
  registerPush()
}
```

En tu punto de entrada (`main.jsx`/`main.js`), tras montar la app:

```js
import { initNative } from './lib/native.js'
initNative()
```

> `notifyAppReady()` es **obligatorio** con `autoUpdate:false`: si no se llama, el plugin
> revierte el bundle OTA tras un timeout.

### 4.3 `scripts/patch-ios.mjs` — el fix del rebote (y el gotcha del `.pbxproj`)

Desactiva el rebote (rubber-band) del scroll **sin tocar Xcode a mano**. Crea el
`MainViewController.swift`, **lo registra en el proyecto** (si no, no compila → pantalla negra)
y reapunta el storyboard. Idempotente:

```js
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IOS_APP = 'ios/App/App'
if (!existsSync(IOS_APP)) {
  console.log('[patch-ios] ios/ no existe aún — corre "npx cap add ios" primero. Omitido.')
  process.exit(0)
}

// 1) MainViewController.swift (desactiva el bounce del WKWebView).
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
  writeFileSync(vcPath, vcSource)
}

// 2) Registrar el .swift en el proyecto Xcode (anclando en AppDelegate.swift).
const pbxPath = 'ios/App/App.xcodeproj/project.pbxproj'
if (existsSync(pbxPath)) {
  let pbx = readFileSync(pbxPath, 'utf8')
  if (!pbx.includes('MainViewController.swift')) {
    const B = 'BA11EA0000000000000000A1', F = 'BA11EA0000000000000000A2'
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift in Sources \*\/ = \{isa = PBXBuildFile;[^\n]*\};\n)/,
      `$1\t\t${B} /* MainViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${F} /* MainViewController.swift */; };\n`)
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift \*\/ = \{isa = PBXFileReference;[^\n]*\};\n)/,
      `$1\t\t${F} /* MainViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MainViewController.swift; sourceTree = "<group>"; };\n`)
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift \*\/,\n)/,
      `$1\t\t\t\t${F} /* MainViewController.swift */,\n`)
    pbx = pbx.replace(/(\w{24} \/\* AppDelegate\.swift in Sources \*\/,\n)/,
      `$1\t\t\t\t${B} /* MainViewController.swift in Sources */,\n`)
    // Solo escribe si TODAS las anclas entraron (no corromper el .pbxproj).
    if (pbx.split(B).length - 1 === 2 && pbx.split(F).length - 1 === 3) {
      writeFileSync(pbxPath, pbx)
      console.log('[patch-ios] MainViewController.swift registrado ✅')
    } else {
      console.warn('[patch-ios] ⚠ Añádelo a mano: Xcode → clic derecho carpeta App → Add Files → target App.')
    }
  }
}

// 3) Apuntar el storyboard al MainViewController.
const sbPath = join(IOS_APP, 'Base.lproj', 'Main.storyboard')
if (existsSync(sbPath)) {
  let sb = readFileSync(sbPath, 'utf8')
  if (!sb.includes('customClass="MainViewController"') &&
      sb.includes('customClass="CAPBridgeViewController" customModule="Capacitor"')) {
    sb = sb.replace('customClass="CAPBridgeViewController" customModule="Capacitor"',
      'customClass="MainViewController" customModuleProvider="target"')
    writeFileSync(sbPath, sb)
    console.log('[patch-ios] Rebote desactivado ✅')
  }
}
```

> **El gotcha que más cuesta:** crear el `.swift` en disco **no** lo mete en el target de Xcode.
> Si no lo registras en `project.pbxproj`, no compila, el storyboard no encuentra la clase
> (`Unknown class _TtC…MainViewController`) y la app **arranca en negro**. Por eso el paso 2.

### 4.4 `package.json` — scripts

```json
{
  "scripts": {
    "build:app": "vite build",
    "sync:ios": "npm run build:app && cap sync ios && npm run patch:ios",
    "patch:ios": "node scripts/patch-ios.mjs",
    "open:ios": "cap open ios"
  }
}
```

> `build:app` debe producir el build con **base `/`**. Si tu Pages usa subpath, mantenlos
> separados (p. ej. `build` con `GITHUB_PAGES=true` para Pages y `build:app` sin él).

### 4.5 UX táctil (viewport + CSS)

En el `<head>` del `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
```

En tu CSS global:

```css
* { -webkit-tap-highlight-color: transparent; }
body {
  overscroll-behavior: none;        /* sin rebote (se remata en nativo con bounces=false) */
  touch-action: manipulation;       /* sin doble-tap-zoom */
  -webkit-user-select: none; user-select: none;   /* sin selección accidental */
  -webkit-touch-callout: none;      /* sin menú del long-press */
}
/* Reactiva donde sí hace falta */
input, textarea, [contenteditable="true"], .selectable {
  -webkit-user-select: text; user-select: text; -webkit-touch-callout: default;
}
/* 16px mínimo en inputs: por debajo, iOS hace zoom al enfocar */
input, select, textarea { font-size: 16px; }
```

### 4.6 Workflow OTA `.github/workflows/ota.yml`

Publica el bundle en Releases **automáticamente al mergear si la versión es nueva**.
Personaliza la carpeta `working-directory` si tu app no está en `app/`:

```yaml
name: Publish OTA bundle

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths: ['app/**']            # <- carpeta de tu app

permissions:
  contents: write

jobs:
  bundle:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app   # <- carpeta de tu app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: app/package-lock.json }

      - name: ¿Versión nueva?
        id: check
        env: { GH_TOKEN: '${{ github.token }}' }
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
        # env: inyecta aquí tus secrets VITE_* si la app los necesita

      - name: Empaquetar bundle + manifiesto
        if: steps.check.outputs.publish == 'true'
        run: |
          VERSION="${{ steps.check.outputs.version }}"
          (cd dist && zip -qr ../bundle.zip .)   # index.html en la raíz del zip
          CHECKSUM=$(sha256sum bundle.zip | awk '{print $1}')
          URL="https://github.com/${GITHUB_REPOSITORY}/releases/download/ota-v${VERSION}/bundle.zip"
          echo "{ \"version\": \"${VERSION}\", \"url\": \"${URL}\", \"checksum\": \"${CHECKSUM}\" }" > latest.json

      - name: Crear release OTA
        if: steps.check.outputs.publish == 'true'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ota-v${{ steps.check.outputs.version }}
          name: OTA v${{ steps.check.outputs.version }}
          files: |
            app/bundle.zip
            app/latest.json
```

---

## 5. Parámetros a personalizar por proyecto

| Sitio | Qué cambiar |
| --- | --- |
| `capacitor.config.json` | `appId` (`com.tuusuario.tuapp`), `appName`, `webDir` |
| `src/lib/native.js` | `OTA_MANIFEST_URL` con tu `owner/repo` |
| `ota.yml` | `paths` y `working-directory` si la app no está en `app/`; `env` con tus secrets |
| Secrets del repo | `VITE_*` que use tu app; `VITE_ONESIGNAL_APP_ID` si añades push |

---

## 6. Generar y subir (en el Mac)

```bash
cd <carpeta-app>
npm install
npx cap add ios            # genera ios/ + pod install (solo en macOS)
npm run sync:ios           # build + copia + fix del rebote (patch-ios)
npx @capacitor/assets generate --ios   # iconos/splash desde assets/icon.png (1024²) y splash.png (2732²)
npm run open:ios           # abre Xcode
```

En Xcode: **Signing & Capabilities** → tu Team; selector de dispositivo → **Any iOS Device
(arm64)** → **Product ▸ Archive** → **Distribute App ▸ App Store Connect**. (Antes crea la app
en App Store Connect con ese bundle id.)

Para **probar en tu iPhone** sin App Store: conéctalo, elígelo en Xcode, pulsa **▶**; la 1ª vez
confía el perfil en *Ajustes ▸ General ▸ VPN y gestión de dispositivos*.

---

## 7. Cómo funciona el OTA

1. Subes la versión en `package.json` y mergeas a `main`.
2. El workflow compila, comprime `dist/` en `bundle.zip`, calcula `sha256`, crea `latest.json` y
   publica el release `ota-v<version>`.
3. La app, al abrir, hace `fetch` de `releases/latest/download/latest.json` (por HTTP nativo,
   sin CORS gracias a `CapacitorHttp`), compara versión y, si es nueva, descarga el zip y lo
   aplica con `@capgo/capacitor-updater`. Se ve en la siguiente apertura.

**Regla de oro:** para que un cambio llegue a la app, **sube la versión**. Sin cambio de
versión, no se publica OTA.

---

## 8. Troubleshooting (baches reales y su causa)

| Síntoma | Causa / fix |
| --- | --- |
| `npx cap add ios` → *Missing appId* | El clon no tiene el `capacitor.config.json` (o estás en otra carpeta). `git pull` / comprueba `cat capacitor.config.json`. **No** hagas `cap init` (sobrescribe la config). |
| **Arranca en negro** + consola `Unknown class _TtC…MainViewController` | El `.swift` no está en el target de Xcode. Lo arregla el paso 2 de `patch-ios.mjs`; o a mano: *Add Files to "App"* con target App. |
| *sync could not run — missing dist directory* | No has buildeado la web. Corre `npm run sync:ios` (buildea antes de copiar). |
| La app pide **permiso de notificaciones** sin haber montado push | `registerPush()` pedía permiso sin proveedor. En este playbook ya solo pide si `VITE_ONESIGNAL_APP_ID` está puesto. |
| El bundle OTA no se aplica | Mira la consola con **Safari ▸ Develop ▸ [iPhone]**. Suele ser el `checksum` o que `@capgo/capacitor-updater` pide firma; el `sha256` ya va en `latest.json`. |
| App Store Connect: *cuenta no habilitada* | Enrolamiento **pending** (Apple tarda hasta 24-48h) o faltan acuerdos por firmar. Mira `developer.apple.com/account`. |
| Al subir: *export compliance* | Si solo usas HTTPS estándar, marca **exenta** (o añade `ITSAppUsesNonExemptEncryption = NO` al Info). |

---

## 9. Checklist para un proyecto nuevo

- [ ] La app buildea a `dist/` con base `/`.
- [ ] Instalados Capacitor + plugins.
- [ ] `capacitor.config.json` con tu `appId`/`appName`/`webDir`.
- [ ] `src/lib/native.js` con tu `OTA_MANIFEST_URL`; `initNative()` llamado al arrancar.
- [ ] `scripts/patch-ios.mjs` + scripts npm (`sync:ios`, `patch:ios`, `open:ios`).
- [ ] Viewport + CSS táctil.
- [ ] `.github/workflows/ota.yml` con tu carpeta/secrets.
- [ ] `assets/icon.png` (1024², cuadrado y opaco) y `assets/splash.png` (2732²).
- [ ] En el Mac: `cap add ios` → `sync:ios` → assets → firmar → Archive.
- [ ] Validar el OTA **una vez** en un iPhone real (sube versión, merge, reabre la app).

---

## 10. Día a día (una vez montado)

```
edito código  →  subo "version" en package.json  →  merge a main
      →  el OTA se publica solo  →  la app se actualiza al reabrirla
```

Cable + Xcode + Archive **solo** para cambios nativos (plugin nuevo, icono, activar push). Todo
lo demás, OTA. 🐋
