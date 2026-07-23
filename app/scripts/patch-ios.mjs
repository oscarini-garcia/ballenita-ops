// Aplica automáticamente el fix del rebote (rubber-band) del scroll al proyecto iOS
// generado por Capacitor, para no tener que tocar Xcode a mano. Idempotente: se puede
// ejecutar todas las veces. Se engancha a `npm run sync:ios`. Si ios/ aún no existe
// (no has corrido `npx cap add ios`), no hace nada.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IOS_APP = 'ios/App/App'

if (!existsSync(IOS_APP)) {
  console.log('[patch-ios] ios/ no existe aún — ejecuta "npx cap add ios" primero. Omitido.')
  process.exit(0)
}

// 1) MainViewController.swift: subclasea el bridge y desactiva el bounce del scroll.
const vcPath = join(IOS_APP, 'MainViewController.swift')
const vcSource = `import Capacitor

// Cáscara con el rebote (rubber-band) del scroll desactivado, para un tacto de app.
// Generado por app/scripts/patch-ios.mjs — no editar a mano.
class MainViewController: CAPBridgeViewController {
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        webView?.scrollView.bounces = false
    }
}
`
if (!existsSync(vcPath) || readFileSync(vcPath, 'utf8') !== vcSource) {
  writeFileSync(vcPath, vcSource)
  console.log('[patch-ios] MainViewController.swift escrito.')
} else {
  console.log('[patch-ios] MainViewController.swift ya al día.')
}

// 2) Apuntar el storyboard al MainViewController (en vez del CAPBridgeViewController).
const sbPath = join(IOS_APP, 'Base.lproj', 'Main.storyboard')
if (!existsSync(sbPath)) {
  console.warn('[patch-ios] ⚠ No encuentro Main.storyboard. Pon la clase de la vista a "MainViewController" a mano en Xcode (ver docs/IOS.md).')
  process.exit(0)
}

let sb = readFileSync(sbPath, 'utf8')
if (sb.includes('customClass="MainViewController"')) {
  console.log('[patch-ios] Storyboard ya apunta a MainViewController.')
} else if (sb.includes('customClass="CAPBridgeViewController" customModule="Capacitor"')) {
  sb = sb.replace(
    'customClass="CAPBridgeViewController" customModule="Capacitor"',
    'customClass="MainViewController" customModuleProvider="target"',
  )
  writeFileSync(sbPath, sb)
  console.log('[patch-ios] Storyboard apuntado a MainViewController. Rebote desactivado ✅')
} else {
  console.warn('[patch-ios] ⚠ No reconozco el view controller del storyboard (¿versión de Capacitor distinta?).')
  console.warn('[patch-ios]   Ponlo a mano: en Main.storyboard, clase de la vista → "MainViewController". Ver docs/IOS.md.')
}
