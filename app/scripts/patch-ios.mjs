// Aplica al proyecto iOS generado por Capacitor lo que no cabe en la web: el fix
// del rebote (rubber-band) del scroll, la declaración de que esto es una app de
// iPhone, el cumplimiento de exportación y el nombre bajo el icono. Idempotente:
// se puede ejecutar todas las veces. Se engancha a `npm run sync:ios`. Si ios/
// aún no existe (no has corrido `npx cap add ios`), no hace nada.
//
// Todo esto va aquí y no a mano en Xcode porque **`ios/` no se versiona**: lo
// regenera `cap add ios`, y cualquier cosa puesta a mano se perdería en la
// siguiente regeneración sin que nadie recuerde por qué volvió el problema.
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

// 2 bis) Que el identificador del paquete siga siendo el que dice la configuración.
//
// `cap add ios` lee `appId` **al generar** el proyecto y `cap sync` no vuelve a
// tocarlo: si `ios/` se creó cuando el valor era otro, o alguien lo escribió a
// mano en Xcode, el binario se queda con un identificador distinto del que
// declara `capacitor.config.json` — y nada avisa.
//
// El fallo que produce llega tardísimo y no se parece a su causa: el Worker
// verifica el token de Apple contra `APPLE_AUD_IOS`, que es ese mismo
// identificador, así que **no entra nadie** y la app se queda en la pantalla de
// acceso diciendo «audiencia no admitida». Para entonces ya archivaste, subiste
// y creaste la ficha en App Store Connect, que va atada al identificador y no se
// puede renombrar.
//
// No se corrige solo a propósito: cambiar el identificador invalida los perfiles
// de aprovisionamiento y la firma, y hacerlo por detrás con Xcode abierto deja
// el proyecto en un estado que nadie pidió. Se avisa, fuerte, y se arregla en
// Xcode en diez segundos.
if (existsSync(pbxPath)) {
  const { appId } = JSON.parse(readFileSync('capacitor.config.json', 'utf8'))
  const puestos = [...readFileSync(pbxPath, 'utf8').matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)]
    .map((c) => c[1].trim().replace(/^"|"$/g, ''))
    .filter((v) => !v.includes('$('))

  const distintos = [...new Set(puestos)].filter((v) => v !== appId)

  if (!appId) {
    console.warn('[patch-ios] ⚠ capacitor.config.json no tiene appId; no puedo comprobar el identificador.')
  } else if (!distintos.length) {
    console.log(`[patch-ios] El identificador del paquete es «${appId}».`)
  } else {
    console.warn('')
    console.warn('[patch-ios] ═══════════════════════════════════════════════════════════')
    console.warn('[patch-ios] ⚠ EL IDENTIFICADOR DEL PAQUETE NO COINCIDE')
    console.warn(`[patch-ios]   Xcode dice:                 ${distintos.join(', ')}`)
    console.warn(`[patch-ios]   capacitor.config.json dice: ${appId}`)
    console.warn('[patch-ios]')
    console.warn('[patch-ios]   Con este desajuste NO ENTRA NADIE: el Worker rechaza el token')
    console.warn('[patch-ios]   de Apple por «audiencia no admitida» (APPLE_AUD_IOS).')
    console.warn('[patch-ios]')
    console.warn(`[patch-ios]   Arréglalo: Xcode → target App → Signing & Capabilities →`)
    console.warn(`[patch-ios]   Bundle Identifier → ${appId}`)
    console.warn('[patch-ios] ═══════════════════════════════════════════════════════════')
    console.warn('')
  }
}

// 3) Solo iPhone.
//
// La plantilla de Capacitor deja el proyecto como universal
// (`TARGETED_DEVICE_FAMILY = "1,2"`), y eso tiene una consecuencia que no aparece
// hasta el final del todo: App Store Connect exige capturas de iPad de 13
// pulgadas y no deja enviar sin ellas. Se puede sortear haciéndolas en el
// simulador, pero entonces se publica para iPad una interfaz pensada para el
// pulgar —pestañas abajo, una sola columna—: capturas honradas de algo que nadie
// ha mirado en esa pantalla.
//
// Así que se declara lo que es: una aplicación de iPhone. Añadir iPad más
// adelante es quitar estas líneas y diseñarlo en serio.
if (existsSync(pbxPath)) {
  const proyecto = readFileSync(pbxPath, 'utf8')
  if (!proyecto.includes('TARGETED_DEVICE_FAMILY = "1,2"')) {
    console.log('[patch-ios] Ya estaba declarada como aplicación de iPhone.')
  } else {
    writeFileSync(pbxPath, proyecto.replaceAll('TARGETED_DEVICE_FAMILY = "1,2"', 'TARGETED_DEVICE_FAMILY = 1'))
    console.log('[patch-ios] Solo iPhone: no se pedirán capturas de iPad ✅')
  }
}

const plistPath = join(IOS_APP, 'Info.plist')

// 4) Declarar el cumplimiento de exportación en el Info.plist.
//
// Ballena Ops solo usa HTTPS, que es criptografía exenta; pero si no se declara,
// App Store Connect lo pregunta en **cada** subida y deja la build retenida
// hasta que alguien conteste. Contestarlo aquí, una vez, ahorra ese paso en
// todas las siguientes.
if (existsSync(plistPath)) {
  const plist = readFileSync(plistPath, 'utf8')
  if (plist.includes('ITSAppUsesNonExemptEncryption')) {
    console.log('[patch-ios] El cumplimiento de exportación ya estaba declarado.')
  } else {
    const cierre = plist.lastIndexOf('</dict>')
    if (cierre === -1) {
      console.warn('[patch-ios] ⚠ Info.plist no tiene la forma esperada; declara la exportación en Xcode.')
    } else {
      const declaracion = '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n'
      writeFileSync(plistPath, plist.slice(0, cierre) + declaracion + plist.slice(cierre))
      console.log('[patch-ios] Cumplimiento de exportación declarado ✅')
    }
  }
}

// 5) El nombre que se ve bajo el icono.
//
// Capacitor escribe `appName` en el Info.plist **al generar** el proyecto, y
// `cap sync` no lo renombra después: cambiar `capacitor.config.json` en un
// proyecto ya creado no tiene ningún efecto y el teléfono sigue enseñando el
// nombre viejo. En garciadoral-ops eso costó un rechazo por la directriz 2.3.8,
// que exige que el nombre de la ficha y el del dispositivo se parezcan.
//
// Se sincroniza aquí, en cada `sync:ios`, para que la única fuente sea
// `capacitor.config.json`.
if (existsSync(plistPath)) {
  const { appName } = JSON.parse(readFileSync('capacitor.config.json', 'utf8'))
  const plist = readFileSync(plistPath, 'utf8')
  const clave = /(<key>CFBundleDisplayName<\/key>\s*<string>)([^<]*)(<\/string>)/
  const puesto = plist.match(clave)?.[2]

  if (!appName) {
    console.warn('[patch-ios] ⚠ capacitor.config.json no tiene appName; el nombre se queda como está.')
  } else if (puesto === appName) {
    console.log(`[patch-ios] El nombre ya era «${appName}».`)
  } else if (puesto !== undefined) {
    writeFileSync(plistPath, plist.replace(clave, `$1${appName}$3`))
    console.log(`[patch-ios] Nombre en pantalla: «${puesto}» → «${appName}» ✅`)
  } else {
    const cierre = plist.lastIndexOf('</dict>')
    if (cierre === -1) {
      console.warn('[patch-ios] ⚠ Info.plist no tiene la forma esperada; pon el nombre en Xcode.')
    } else {
      const declaracion = `\t<key>CFBundleDisplayName</key>\n\t<string>${appName}</string>\n`
      writeFileSync(plistPath, plist.slice(0, cierre) + declaracion + plist.slice(cierre))
      console.log(`[patch-ios] Nombre en pantalla declarado: «${appName}» ✅`)
    }
  }
}

// 6) Apuntar el storyboard al MainViewController (en vez del CAPBridgeViewController).
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
