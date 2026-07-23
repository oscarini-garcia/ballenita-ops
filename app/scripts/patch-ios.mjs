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

// 2) Registrar MainViewController.swift en el proyecto Xcode. Si no, el .swift existe
//    en disco pero no se compila → el storyboard no encuentra la clase en runtime →
//    pantalla negra. Anclamos en las entradas de AppDelegate.swift, que siempre existen.
const pbxPath = 'ios/App/App.xcodeproj/project.pbxproj'
if (existsSync(pbxPath)) {
  let pbx = readFileSync(pbxPath, 'utf8')
  if (pbx.includes('MainViewController.swift')) {
    console.log('[patch-ios] MainViewController.swift ya está en el proyecto Xcode.')
  } else {
    const BUILDID = 'BA11EA0000000000000000A1'
    const FILEID = 'BA11EA0000000000000000A2'
    pbx = pbx.replace(
      /(\w{24} \/\* AppDelegate\.swift in Sources \*\/ = \{isa = PBXBuildFile;[^\n]*\};\n)/,
      `$1\t\t${BUILDID} /* MainViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${FILEID} /* MainViewController.swift */; };\n`,
    )
    pbx = pbx.replace(
      /(\w{24} \/\* AppDelegate\.swift \*\/ = \{isa = PBXFileReference;[^\n]*\};\n)/,
      `$1\t\t${FILEID} /* MainViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MainViewController.swift; sourceTree = "<group>"; };\n`,
    )
    pbx = pbx.replace(
      /(\w{24} \/\* AppDelegate\.swift \*\/,\n)/,
      `$1\t\t\t\t${FILEID} /* MainViewController.swift */,\n`,
    )
    pbx = pbx.replace(
      /(\w{24} \/\* AppDelegate\.swift in Sources \*\/,\n)/,
      `$1\t\t\t\t${BUILDID} /* MainViewController.swift in Sources */,\n`,
    )
    // Solo escribimos si TODAS las anclas entraron (BUILDID x2, FILEID x3): un
    // .pbxproj a medias corrompería el proyecto.
    const okBuild = pbx.split(BUILDID).length - 1 === 2
    const okFile = pbx.split(FILEID).length - 1 === 3
    if (okBuild && okFile) {
      writeFileSync(pbxPath, pbx)
      console.log('[patch-ios] MainViewController.swift añadido al proyecto Xcode ✅')
    } else {
      console.warn('[patch-ios] ⚠ No pude registrarlo en el .pbxproj automáticamente.')
      console.warn('[patch-ios]   Añádelo a mano: en Xcode, clic derecho en la carpeta App → Add Files to "App" → target App.')
    }
  }
} else {
  console.warn('[patch-ios] ⚠ No encuentro project.pbxproj; revisa docs/IOS.md.')
}

// 3) Apuntar el storyboard al MainViewController (en vez del CAPBridgeViewController).
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
