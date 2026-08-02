/**
 * Los iconos de la web y de la PWA, sacados de `assets/icon.png`.
 *
 * El icono de la app **nativa** ya salía de ahí (`npm run assets:ios`, que es
 * @capacitor/assets leyendo ese mismo fichero). Lo que faltaba era el otro lado:
 * en el navegador y en «Añadir a pantalla de inicio» la app enseñaba
 * `favicon.svg`, un emoji sobre un cuadrado que no era el icono de verdad. Dos
 * dibujos distintos para la misma app, según por dónde entraras.
 *
 * Se corre a mano y **el resultado se versiona**: los PNG viven en `public/` y
 * entran en el build como cualquier otro fichero estático. Esto solo hace falta
 * el día que cambie el dibujo.
 *
 *     npm i --no-save sharp
 *     npm run iconos:web
 *
 * `sharp` no es dependencia del proyecto a propósito: es un binario nativo
 * pesado, se usa una vez cada muchos meses y no pinta nada en el CI.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ORIGEN = join(AQUI, '..', 'assets', 'icon.png')
const DESTINO = join(AQUI, '..', 'public')

// El fondo del dibujo, medido en sus cuatro esquinas. Es prácticamente el
// `--abyss` de la cara oscura (#081821), así que el relleno del maskable no se
// nota: el icono no tiene borde, se funde.
const FONDO = { r: 8, g: 32, b: 44, alpha: 1 }

// El recorte de un icono «maskable» puede llegar al 10% por cada lado, así que
// el dibujo se encoge al 80% y el resto es fondo. Sin esto, Android le corta la
// cola a la ballena al meterla en su círculo.
const SEGURO = 0.8

let sharp
try {
  ({ default: sharp } = await import('sharp'))
} catch {
  console.error('Falta sharp. Instálalo sin guardarlo:\n\n  npm i --no-save sharp\n')
  process.exit(1)
}

mkdirSync(DESTINO, { recursive: true })

async function normal(lado, nombre) {
  await sharp(ORIGEN).resize(lado, lado, { fit: 'cover' }).png().toFile(join(DESTINO, nombre))
  console.log(`${nombre} — ${lado}×${lado}`)
}

async function maskable(lado, nombre) {
  const dentro = Math.round(lado * SEGURO)
  const margen = Math.round((lado - dentro) / 2)
  const dibujo = await sharp(ORIGEN).resize(dentro, dentro, { fit: 'cover' }).png().toBuffer()
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([{ input: dibujo, top: margen, left: margen }])
    .png()
    .toFile(join(DESTINO, nombre))
  console.log(`${nombre} — ${lado}×${lado} (dibujo al ${SEGURO * 100}%)`)
}

await normal(32, 'favicon-32.png')
await normal(180, 'apple-touch-icon.png')
await normal(192, 'icon-192.png')
await normal(512, 'icon-512.png')
await maskable(512, 'icon-maskable-512.png')
