/**
 * Quién puede tocar qué del grupo (SPECS §14.63).
 *
 * Hasta ahora eran dos estados: **quien administra escribe y los demás miran**
 * (§14.41). Con el censo eso bastaba —cambiar a alguien de familia es de una
 * persona—, pero desde §14.56 y §14.57 la pantalla de Grupo tiene además el
 * estado del bunga, sus notas y el cacharro que trae cada casa. Eso es de cada
 * familia, y pedirle a quien administra que lo teclee por los demás convierte
 * una pantalla que todos miran en una que solo uno puede rellenar.
 *
 * Tres niveles, y ni uno más:
 *
 *  1. **Quien administra**, todo. Es el único que puede mover a alguien de
 *     familia, borrar una casa o cambiar el evento — decisiones que afectan al
 *     reparto de todos.
 *  2. **Un adulto**, lo de **su** familia (su ficha, su gente, su cacharro) y
 *     **los bungas de cualquiera**. Los bungas se comparten a propósito: quien
 *     llega el primero coloca a los demás, y el estado de un bunga —«la nevera
 *     congela», «hay bichos»— lo sabe quien ha dormido ahí, no quien administra.
 *  3. **El resto** —adolescentes y niños—, mirar. Es la misma línea que ya
 *     decide quién escribe en Gastos (`puedeOrganizar`), y por eso se apoya en
 *     ella en lugar de inventar una segunda.
 *
 * **Sin sesión no se capa nada**, como en toda la casa: la libreta local y la
 * demostración son de quien tiene el móvil en la mano, y una app muda no invita
 * a entrar.
 */
import { esAdministrador } from './admin.js'
import { puedeOrganizar } from './personas.js'

/** ¿Esta app está poniendo cerrojos? Solo con sesión de verdad. */
export const hayCerrojos = (sesion) => Boolean(sesion) && !esAdministrador(sesion)

/** Quien administra: todo, siempre. */
export const mandaEnTodo = (sesion) => !sesion || esAdministrador(sesion)

/**
 * Un adulto con identidad puesta. `puedeOrganizar` devuelve `true` sin persona
 * —el caso de la libreta local—, así que aquí se exige además saber quién eres:
 * «lo de tu familia» no significa nada si no hay familia tuya.
 */
export const esAdultoDelGrupo = (me) => Boolean(me) && puedeOrganizar(me)

/**
 * ¿Puede tocar la ficha de esta familia y la gente de dentro?
 *
 * Mover a alguien **de una familia a otra** no entra aquí: eso lo decide
 * `puedeMoverDeFamilia`, y es de quien administra. Un adulto puede corregir a
 * los suyos, no llevarse a los de otra casa.
 */
export function puedeEditarFamilia(sesion, me, familyId) {
  if (mandaEnTodo(sesion)) return true
  if (!esAdultoDelGrupo(me)) return false
  return Boolean(familyId) && me.familyId === familyId
}

/**
 * ¿Puede tocar los bungas? Cualquier adulto, y los de todos.
 *
 * Es la excepción que pediste y tiene su razón: colocar a las familias en los
 * bungas lo hace quien llega primero al camping, y las notas del sitio las
 * escribe quien ha dormido en él.
 */
export const puedeEditarBungas = (sesion, me) => mandaEnTodo(sesion) || esAdultoDelGrupo(me)

/** El cacharro de una familia lo apunta y lo quita esa familia. */
export const puedeEditarCacharro = (sesion, me, familyId) => puedeEditarFamilia(sesion, me, familyId)

/**
 * Crear y borrar familias, y mover gente entre ellas: solo quien administra.
 *
 * Son las dos cosas que cambian **el reparto de los demás** —una familia menos
 * redistribuye todos los gastos— y por eso no se delegan.
 */
export const puedeMoverDeFamilia = (sesion) => mandaEnTodo(sesion)

/**
 * Qué decirle a quien no puede, para que no parezca que la app está rota.
 *
 * Una pantalla que no reacciona y no dice por qué es peor que una que capa y lo
 * explica; ésta es la misma figura que la nota de «El grupo lo edita quien
 * administra» de §14.41, con las tres respuestas que ahora hacen falta.
 */
export function porQueNoPuedes(sesion, me) {
  if (mandaEnTodo(sesion)) return null
  if (!esAdultoDelGrupo(me)) {
    return 'Esto lo llevan los adultos del grupo. Puedes mirarlo todo, y lo tuyo se cambia arriba.'
  }
  return 'Puedes cambiar lo de tu familia y lo de los bungas. Lo demás lo lleva quien administra.'
}
