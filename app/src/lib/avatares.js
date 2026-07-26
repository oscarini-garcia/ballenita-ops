// Foto de avatar de una persona.
//
// Va **fuera de la sincronización** a propósito (SPECS §14.9): la instantánea
// del servidor lleva hechos (gastos, cenas, planes), no binarios. La foto se
// comprime a un cuadrado pequeño y se guarda en el propio dispositivo, así que
// es cosa de este móvil: el emoji sigue siendo el avatar que ve el grupo.
const LADO = 96 // px del cuadrado final
const CALIDAD = 0.72 // JPEG: a este tamaño no se nota y pesa ~4 KB
const MAX_CARACTERES = 48 * 1024 // tope de cortesía para no reventar localStorage

function clave(eventId, personId) { return `ballena.foto:${eventId}:${personId}` }

export function leerFoto(eventId, personId) {
  if (!eventId || !personId) return null
  try { return localStorage.getItem(clave(eventId, personId)) } catch { return null }
}

export function guardarFoto(eventId, personId, dataUrl) {
  if (!eventId || !personId) return
  try {
    if (dataUrl) localStorage.setItem(clave(eventId, personId), dataUrl)
    else localStorage.removeItem(clave(eventId, personId))
  } catch { /* almacenamiento lleno o no disponible: la foto es prescindible */ }
}

export function borrarFoto(eventId, personId) { guardarFoto(eventId, personId, null) }

/**
 * Recorta la imagen a un cuadrado centrado de LADO px y la devuelve como
 * `data:` URL. Lanza un Error con mensaje en español si no se puede.
 */
export async function comprimirFoto(file) {
  if (!file) throw new Error('No hay ninguna imagen')
  if (typeof document === 'undefined') throw new Error('Aquí no se pueden recortar fotos')

  const imagen = await cargarImagen(file)
  const lienzo = document.createElement('canvas')
  lienzo.width = LADO
  lienzo.height = LADO
  const ctx = lienzo.getContext?.('2d')
  if (!ctx) throw new Error('Este navegador no sabe recortar la foto')

  const ancho = imagen.width || imagen.naturalWidth
  const alto = imagen.height || imagen.naturalHeight
  const lado = Math.min(ancho, alto)
  ctx.drawImage(imagen, (ancho - lado) / 2, (alto - lado) / 2, lado, lado, 0, 0, LADO, LADO)

  const url = lienzo.toDataURL('image/jpeg', CALIDAD)
  if (!url || !url.startsWith('data:image')) throw new Error('No se pudo convertir la foto')
  if (url.length > MAX_CARACTERES) throw new Error('La foto pesa demasiado, prueba con otra')
  return url
}

function cargarImagen(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)
  return new Promise((resolver, rechazar) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolver(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}
