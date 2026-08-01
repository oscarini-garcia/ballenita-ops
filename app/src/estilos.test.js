import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Un `style={{ fontSize: 13 }}` en el JSX no pasa por `--escala`.
 *
 * Es la razón por la que «Enorme» se quedaba a medias: el ajuste de tamaño
 * crecía la app entera **menos** las cabeceras de día de Cenas, los subtítulos
 * de Planes, el total de Gastos y las cifras de Estadísticas. Y un `fontWeight`
 * a pelo se saltaba la bajada de pesos de SPECS §14.13 y seguía gritando.
 *
 * Los inline de fontanería —`marginTop`, `display`, `textAlign`— no molestan a
 * nadie y se quedan donde están: lo que este test persigue es solo lo que se
 * salta el tema o la escala. Por eso mira tres cosas y no «hay estilos inline».
 */
// Se busca a sí mismo subiendo desde donde se ejecute. `import.meta.url` no
// vale —Vite lo reescribe y apunta a `/src`— y `process.cwd()` depende de desde
// dónde se lance el comando, que no es lo mismo con `npm test` que a mano.
function raiz() {
  let d = resolve(process.cwd())
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(d, 'src', 'App.jsx'))) return join(d, 'src')
    d = dirname(d)
  }
  throw new Error('no encuentro src/App.jsx desde ' + process.cwd())
}
const RAIZ = raiz()

function jsx(dir = RAIZ, salida = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) jsx(p, salida)
    else if (e.name.endsWith('.jsx') && !e.name.includes('.test.')) salida.push(p)
  }
  return salida
}

const INLINE = /style=\{\{([^}]*)\}\}/g

// Qué se persigue, y por qué. El mensaje sale en el fallo, así que dice qué usar.
const PROHIBIDO = [
  [/fontSize:\s*['"]?\d/, 'un tamaño en píxeles no pasa por --escala: usa var(--t-*) desde una clase'],
  [/fontWeight:\s*\d/, 'un peso a pelo se salta la escala de pesos: ponlo en theme.css'],
  [/#[0-9a-fA-F]{3,8}\b/, 'un color a pelo no se recolorea con el tema: usa var(--…)'],
]

describe('estilos inline', () => {
  it('ninguno se salta el tema ni la escala tipográfica', () => {
    const pecados = []
    for (const f of jsx()) {
      const texto = readFileSync(f, 'utf8')
      const lineas = texto.split('\n')
      for (const [i, linea] of lineas.entries()) {
        for (const m of linea.matchAll(INLINE)) {
          for (const [patron, motivo] of PROHIBIDO) {
            if (patron.test(m[1])) {
              pecados.push(`${f.slice(RAIZ.length + 1)}:${i + 1} — ${motivo}\n    ${m[0].slice(0, 90)}`)
            }
          }
        }
      }
    }
    expect(pecados.join('\n')).toBe('')
  })
})
