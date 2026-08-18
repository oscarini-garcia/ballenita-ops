/**
 * El ranking de cacharros: quién gana, quién puede votar y qué se dice de él
 * (SPECS §14.57, `docs/diseño/siete-encargos.html` · G2·G3·G4; **G1 se retiró**
 * en §14.77).
 *
 * Puro a propósito, como `lib/planes.js`: quién va ganando y si a alguien le
 * toca votar son cosas que se prueban contando, no abriendo la pantalla.
 *
 * **Un voto por cabeza y no un 👍 por cacharro** (G2). Con aprobación múltiple
 * los tres candidatos empatan a nueve y no hay ranking; con elección hay
 * ganador. Es distinto de un plan a propósito: allí se decide si algo se hace
 * —y a eso puede decir que sí todo el mundo—, aquí quién gana.
 *
 * **Nadie vota el suyo** (G3). Quita la trampa evidente, y con dos familias o
 * más el ganador sale siempre de fuera. El precio se dice al lado y no se
 * esconde: una familia grande arrastra más votos que una pequeña, así que esto
 * es un juego y no unas elecciones.
 *
 * **Y desde §14.77 una familia trae los que quiera** (G1 se retiró). Nada de
 * este módulo cambia por ello —el voto sigue siendo uno por cabeza y `puedeVotar`
 * sigue mirando la familia, no la fila—, pero sí cambia una cosa que conviene
 * decir: con tres entradas se tienen tres oportunidades de llevarse el voto único
 * de cada uno de los demás. Es otra ventaja de traer mucho, como la del tamaño
 * de la familia, y va en la misma cuenta de que esto es un juego.
 */

/** Cuántos han elegido este cacharro. */
export const votosDeCacharro = (cacharro) => Object.keys(cacharro?.votos ?? {}).length

/**
 * ¿Puede esta persona votar este cacharro?
 *
 * No, si es el de su propia familia. Quien no tiene familia puede votar todos:
 * no hay ninguno que sea «el suyo».
 */
export const puedeVotar = (cacharro, persona) =>
  Boolean(persona) && (!persona.familyId || persona.familyId !== cacharro?.familyId)

/** Qué ha votado esta persona, mirando todos los cacharros. O `null`. */
export function loQueVoto(cacharros = [], personId) {
  if (!personId) return null
  return cacharros.find((c) => Object.hasOwn(c?.votos ?? {}, personId))?.id ?? null
}

/**
 * El ranking: más votos primero, y a igualdad por texto.
 *
 * El desempate es por texto y no por id porque los ids son aleatorios: con dos
 * cacharros empatados, el orden cambiaría en cada pintado y la lista parecería
 * moverse sola.
 */
export const ranking = (cacharros = []) => [...cacharros].sort((a, b) =>
  votosDeCacharro(b) - votosDeCacharro(a)
  || String(a.texto || '').localeCompare(String(b.texto || ''), 'es'))

/**
 * Cuántos pueden votar en total, que es el denominador de «votan 6 de 9».
 *
 * No son todas las personas: quien es de una familia que **no** ha presentado
 * cacharro puede votar todos los que hay, y quien es de una que sí, todos menos
 * el suyo. Pero si solo hubiera un cacharro y fuera el de tu familia, tú no
 * puedes votar nada — y contarte en el denominador haría que el recuento no
 * llegara nunca al total.
 */
export const quienesPuedenVotar = (cacharros = [], personas = []) =>
  personas.filter((p) => cacharros.some((c) => puedeVotar(c, p)))

/** Cuántos han votado ya, de los que podían. */
export const cuantosHanVotado = (cacharros = [], personas = []) =>
  quienesPuedenVotar(cacharros, personas).filter((p) => loQueVoto(cacharros, p.id)).length

/**
 * Pone o quita el voto de alguien, **en todos los cacharros a la vez**.
 *
 * Es una elección: votar el segundo tiene que quitar el voto del primero, y eso
 * toca dos filas. Devuelve solo las que cambian —`[{ id, votos }]`— para que la
 * pantalla escriba lo justo: reescribir tres filas cuando cambian dos deja dos
 * renglones de más en el recap y dos entradas de más en la cola.
 */
export function votar(cacharros = [], personId, cacharroId) {
  if (!personId) return []
  const cambios = []
  for (const c of cacharros) {
    const tenia = Object.hasOwn(c?.votos ?? {}, personId)
    // Tocar el que ya tenías lo quita: es el mismo gesto que en los planes.
    const quiere = c.id === cacharroId && !tenia
    if (tenia === quiere) continue
    const votos = { ...(c.votos ?? {}) }
    if (quiere) votos[personId] = '🏆'
    else delete votos[personId]
    cambios.push({ id: c.id, votos })
  }
  return cambios
}
