// El grupo en una sola sección: una ficha por familia, con su bunga y su gente.
//
// «Sueltos» recoge lo que no está colocado, y se edita de verdad —se toca la
// fila y sube una hoja desde abajo— (SPECS §14.14).
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, addFamily, updateFamily, borrarFamilia,
  bungasOf, addBunga, updateBunga, removeBunga, asignarBungaAFamilia,
  personsOf, addPerson, updatePerson, removePerson, marcarAusenciaDeFamilia,
  expensesOf, dinnersOf,
  PEGATINAS, addAlojamiento, listAlojamientos, updateAlojamiento, todosLosBungas, listEvents,
  anclaDe, comentariosDelEvento,
} from '../db.js'
import Hoja, { HojaDeEleccion } from '../components/Hoja.jsx'
import Comentarios from '../components/Comentarios.jsx'
import Acordeon from '../components/Acordeon.jsx'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'
import Confirmar from '../components/Confirmar.jsx'
import { bungaDeFamilia, bungasLibres, familiasLibres, etiquetaBunga, etiquetaCorta, porNombre } from '../lib/asignacion.js'
import { aliasDe, aliasSugerido, aliasSigueAlNombre } from '../lib/alias.js'
import { tap } from '../lib/native.js'
import {
  EDADES, EMOJIS_PERSONA, comoEstaLaCasa, cuantosEnLaCasa, estaAqui, pesoDe, puedeOrganizar,
} from '../lib/personas.js'
import { useIdentidad } from '../lib/identidad.js'
import { TOPE_EMOJIS, contarEmojis, cortarEmojis } from '../lib/emojis.js'
import {
  conPegatina, hayQueResumir, historicoDe, huellaDelSitio, pegatinasPuestas,
  resumenDelHistorico, resumenDelSitio,
} from '../lib/alojamientos.js'
import {
  mandaEnTodo, porQueNoPuedes, puedeEditarBungas, puedeEditarFamilia, puedeMarcarAusencias,
} from '../lib/permisos.js'
import { leerSesion } from '../auth/sesion.js'
import { comentarioDeBunga, resumenDeBunga } from '../sync/api.js'
import { sinLeer } from '../lib/comentarios.js'

const COLORES = ['#E5544B', '#2E9E6B', '#1FA6D6', '#E7A33E', '#6E4C97', '#E5744B']

/**
 * El grupo: una ficha por familia, con su bunga arriba y su gente dentro.
 *
 * Es la opción **G2** de `docs/diseño/gente.html`, y se come los tres acordeones
 * que había —Familias, Bungalows y Gente—, que eran tres listas donde lo único
 * que de verdad se quería saber (quién duerme dónde, quién es de quién) no salía
 * en ninguna: había que leer la segunda línea de seis filas para saber quiénes
 * eran los García.
 *
 * Los verbos salen de `docs/diseño/gente-editar.html`:
 *
 *  · **E1** — se toca la fila y se edita. La diana es la fila entera (358 × 74
 *    la cabecera de una familia), no un lápiz de 34 que además habría que
 *    repetir nueve veces en la pantalla.
 *  · **F2** — lo que sube es una hoja desde abajo, no un modal que tape la
 *    ficha de la que acabas de salir.
 *  · **N2** — cada cosa se crea donde vive: la persona dentro de su ficha (y por
 *    eso su formulario ya no pregunta la familia: la dice el sitio donde has
 *    pulsado), el bunga desde la pastilla de la cabecera, y solo la familia en
 *    el botón del final.
 *  · **N4** — la hoja de elegir bunga lleva su propia salida, «+ Bunga nuevo…»,
 *    para que «no queda ninguno libre» sea un botón y no un callejón.
 *  · **D1** — borrar solo existe al fondo del editor y **dice qué se lleva**.
 *    Antes era un botón rojo en cada renglón, sin confirmación, justo donde cae
 *    el pulgar al rodar la lista.
 *
 * «Sueltos» es la otra mitad de G2: lo que no está colocado —un bunga sin
 * familia, alguien sin familia que por tanto no entra en ningún reparto— deja de
 * ser un dato que no está en ninguna parte y pasa a ser una fila que se ve.
 */
export default function GrupoSection({ eventId, area = 'familias', abrir: abrirEsto = null, onAbierta }) {
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  // Solo para decir qué se lleva por delante un borrado (D1).
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const dinners = useLiveQuery(() => dinnersOf(eventId), [eventId], [])

  // { tipo: 'familia'|'bunga'|'persona', id?, familyId? } · sin id = nueva.
  const [editor, setEditor] = useState(null)
  // { que: 'bunga'|'familia', id } · qué emparejamiento se está eligiendo.
  const [eligiendo, setEligiendo] = useState(null)

  /**
   * **Tres niveles y no dos** (SPECS §14.61, `lib/permisos.js`).
   *
   * Hasta ahora era «administra o mira». Con el bunga guardando notas y cada
   * familia su gadget, eso convertía una pantalla que todos miran en una que
   * solo uno puede rellenar. Ahora un adulto corrige **lo suyo** y **los
   * bungas**; mover gente entre familias y crear o borrar una siguen siendo de
   * quien administra, porque redistribuyen el reparto de todos.
   */
  const sesion = leerSesion()
  const { me } = useIdentidad(eventId, persons)
  // El catálogo de sitios y los comentarios del evento, para la lista de bungas:
  // el resumen con guasa vive en el sitio (§14.66) y el globo se cuenta en
  // memoria, que es más barato que una consulta por bunga y no parpadea.
  const alojamientos = useLiveQuery(() => listAlojamientos(), [], [])
  const comentarios = useLiveQuery(() => comentariosDelEvento(eventId), [eventId], [])
  const puedoTodo = mandaEnTodo(sesion)
  const miFamilia = (familyId) => puedeEditarFamilia(sesion, me, familyId)
  const conBungas = puedeEditarBungas(sesion, me)
  // **Quién está lo dice cualquier adulto** (§14.79): es un hecho del viaje del
  // que cuelgan la compra y el reparto, no un dato privado de una casa.
  const conAusencias = puedeMarcarAusencias(sesion, me)
  const razon = porQueNoPuedes(sesion, me)

  const abrir = (e) => { tap(); setEditor(e) }

  // Llegar desde el aviso de un comentario abre **ese** bunga (§14.60 · R2). Se
  // espera a que los bungas estén: con la app recién arrancada el toque llega
  // antes que la instantánea, y abrir uno que aún no está sería no abrir nada.
  useEffect(() => {
    if (!abrirEsto || !bungas.length) return
    if (bungas.some((b) => b.id === abrirEsto)) { setEditor({ tipo: 'bunga', id: abrirEsto }); onAbierta?.() }
  }, [abrirEsto, bungas.length])
  const emparejar = (e) => { if (!conBungas) return; tap(); setEligiendo(e) }
  // Todo va ordenado por nombre: una lista de nueve nombres sin orden se recorre
  // entera cada vez, y el de la base es el de los ids, que son aleatorios.
  const genteDe = (familyId) => persons.filter((p) => p.familyId === familyId).sort(porNombre)
  const sueltosBungas = bungasLibres(bungas, families).sort(porNombre)
  const sueltosGente = persons.filter((p) => !families.some((f) => f.id === p.familyId)).sort(porNombre)

  return (
    <>
      {area === 'familias' && (
        <>
          {families.length === 0 && persons.length === 0 && (
            <div className="empty">Aún no hay nadie. Empieza por una familia.</div>
          )}

          {/* **Cada familia, plegable.** Con tres casas y nueve personas la
              lista cabía; con seis no, y lo que se viene a buscar es una. La
              solapa dice lo que la cerrada tiene que decir —quién es y cuántos
              son— y **la tuya nace abierta**, que es la que se abre siempre. */}
          {[...families].sort(porNombre).map((f) => {
            const gente = genteDe(f.id)
            const mia = me?.familyId === f.id
            return (
              <Acordeon
                key={f.id}
                clave={`grupo.familia.${f.id}`}
                abierta={mia}
                cabecera={(
                  <>
                    <span
                      className="av chica"
                      data-emojis={contarEmojis(f.avatar)}
                      style={{ background: f.color }}
                    >
                      {f.avatar}
                    </span>
                    <span className="acordeon-titulo">{f.name}</span>
                    {/* El estado de la familia se retira (§14.66): quien dice
                        en qué anda es cada persona, y dos estados encima del
                        mismo grupo se contradicen sin que nadie los actualice. */}
                    {/* Cuenta **los que están** (§14.78) y dice aparte los que
                        no: «5 personas» de una casa donde tres se han vuelto es
                        el número con el que nadie hace la compra. */}
                    <span className="acordeon-nota">{cuantosEnLaCasa(gente)}</span>
                  </>
                )}
              >
                {/* **Su bunga, dicho por su nombre y a un toque** (SPECS §14.65).
                    La ficha de una familia se quedó sin él al partir Grupo en
                    áreas (§14.63): dónde duerme cada casa es media pregunta de
                    esta pantalla, y contestarla obligaba a cambiar de área y
                    buscar la fila del bunga cuya familia se acababa de mirar.
                    Va **el nombre** y no el mote —en un camping un bungalow se
                    busca por su número, que es lo que lleva el nombre; el mote
                    es cómo se le llama entre nosotros y va debajo— y **lleva a
                    su pantalla**, que es donde están sus notas, sus pegatinas y
                    quién estuvo otros años (§14.56). Sin bunga, el renglón lo
                    dice y abre la hoja de elegir: no hay pantalla de un bunga
                    que todavía no existe. */}
                {(() => {
                  const suBunga = bungaDeFamilia(bungas, f.id)
                  return (
                    <button
                      type="button"
                      className="mini bunga-de-la-casa"
                      disabled={!conBungas}
                      onClick={() => (suBunga
                        ? abrir({ tipo: 'bunga', id: suBunga.id })
                        : emparejar({ que: 'bunga', id: f.id }))}
                    >
                      <span className="ico"><Icono nombre="casa" /></span>
                      <span className="quien">{suBunga ? suBunga.name : 'Sin bunga'}</span>
                      <span className="dato">{suBunga ? (suBunga.alias || 'ver el bunga') : 'elegir'}</span>
                    </button>
                  )
                })()}

                {/* **El cuerpo abre y la casilla marca** (§14.79, la figura de
                    `gasto-entre.html` · C2): son dos permisos distintos sobre la
                    misma fila —la ficha es de su casa, quién está es de todos—,
                    y un solo botón no puede tener dos. La casilla mide 44 × 44,
                    que es el mínimo de Apple. */}
                {/* **Toda la casa de una vez** (§14.79). El botón no dice cómo
                    está la casa —eso lo dice el recuento de la solapa— sino qué
                    va a pasar si lo tocas, que es lo que le da salida por los
                    dos lados al estado a medias que deja marcar uno a uno. */}
                {gente.length > 0 && (() => {
                  const casa = comoEstaLaCasa(gente)
                  return (
                    <button
                      type="button"
                      className="mini toda-la-casa"
                      disabled={!conAusencias}
                      onClick={() => { tap(); marcarAusenciaDeFamilia(eventId, f.id, casa.marcar) }}
                    >
                      <span className="ico"><Icono nombre="familia" /></span>
                      <span className="quien">{casa.verbo}</span>
                      <span className="dato">toda la casa</span>
                    </button>
                  )
                })()}

                {gente.map((p) => (
                  <div className={`mini-fila${estaAqui(p) ? '' : ' se-fue'}`} key={p.id}>
                    <button
                      type="button"
                      className="mini"
                      disabled={!miFamilia(f.id)}
                      onClick={() => abrir({ tipo: 'persona', id: p.id })}
                    >
                      <span className="av chica" data-emojis={contarEmojis(p.avatar)} style={{ background: f.color }}>{p.avatar}</span>
                      <span className="quien">{p.name}{p.apodo ? ` «${p.apodo}»` : ''}</span>
                      {/* Quien no está **se dice, no se esconde** (§14.78, la
                          regla de §14.10-quater): sigue en su casa y en su
                          sitio, con la seña delante de la edad porque es lo que
                          cambia cómo se lee todo lo demás de esta pantalla. */}
                      <span className="dato">
                        {estaAqui(p) ? '' : 'fuera · '}{p.edad}{p.llevaLasCuentas ? ' · cuentas' : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`aqui${estaAqui(p) ? ' si' : ''}`}
                      disabled={!conAusencias}
                      aria-pressed={estaAqui(p)}
                      aria-label={estaAqui(p)
                        ? `Marcar que ${p.name} se ha ido unos días`
                        : `Marcar que ${p.name} ha vuelto`}
                      onClick={() => { tap(); updatePerson(p.id, { ausente: estaAqui(p) ? 1 : 0 }) }}
                    >
                      {estaAqui(p) && <Icono nombre="visto" />}
                    </button>
                  </div>
                ))}
                {miFamilia(f.id) && (
                  <>
                    <button type="button" className="mini anadir" onClick={() => abrir({ tipo: 'persona', familyId: f.id })}>
                      + Persona
                    </button>
                    <button type="button" className="btn sm ghost block" onClick={() => abrir({ tipo: 'familia', id: f.id })}>
                      Editar «{f.name}»
                    </button>
                  </>
                )}
              </Acordeon>
            )
          })}

          {sueltosGente.length > 0 && (
            <>
              <div className="sec-h">Sin familia</div>
              <div className="card tight">
                {sueltosGente.map((p) => (
                  <div className="row" key={p.id}>
                    <button
                      type="button"
                      className="row-quien"
                      disabled={!puedoTodo}
                      onClick={() => abrir({ tipo: 'persona', id: p.id })}
                    >
                      <span className="av sin" data-emojis={contarEmojis(p.avatar)}>{p.avatar}</span>
                      <span className="main">
                        <span className="n">{p.name}</span>
                        <span className="sub">
                          sin familia · {estaAqui(p) ? '' : 'fuera · '}{p.edad}
                        </span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Crear y borrar familias mueve el reparto de todos: solo administra. */}
          {puedoTodo && (
            <button className="btn block" onClick={() => abrir({ tipo: 'familia' })}>+ Familia</button>
          )}
          <div className="note">
            {razon ?? (
              <>🐳 Quien se queda <b>sin familia</b> no entra en el reparto de ninguna. La gente de
                aquí es la que puede tener cuenta: las peticiones de acceso se enlazan con una persona.
              </>
            )}
          </div>
        </>
      )}

      {area === 'bungas' && (
        <>
          {/* **Los bungas, en su área y de todos** (§14.63). Colocar a las
              familias lo hace quien llega primero al camping, y las notas del
              sitio —«la nevera congela», «hay bichos»— las escribe quien ha
              dormido ahí, no quien administra. */}
          {bungas.length === 0 && (
            <div className="empty">
              <span className="e">🏠</span>Ningún bunga todavía.<br />
              Apunta los del camping y dile a cada uno de quién es.
            </div>
          )}

          {[...bungas].sort(porNombre).map((b) => {
            const suya = families.find((f) => f.id === b.familyId) ?? null
            const suSitio = alojamientos.find((a) => a.id === b.alojamientoId) ?? null
            const dice = resumenDelSitio(suSitio)
            const suyos = comentarios.filter((c) => c.ancla === anclaDe('bunga', b.id))
            const nuevos = sinLeer(suyos, { eventId, ancla: anclaDe('bunga', b.id), meId: me?.id })
            return (
              /* **La evaluación va debajo, en su renglón** (§14.66-ter). Estaba
                 en el subtítulo de la fila, o sea compitiendo por el ancho con el
                 nombre del bunga y con la pastilla de su familia: quedaban 150 pt
                 de los 390 para una frase que ahora está redactada. Abajo y a lo
                 ancho caben dos líneas sin recortar nada. */
              <div className="bunga-fila" key={b.id}>
                <div className="row">
                  <button type="button" className="row-quien" disabled={!conBungas} onClick={() => abrir({ tipo: 'bunga', id: b.id })}>
                    <span className="ico"><Icono nombre="casa" /></span>
                    <span className="main">
                      <span className="n">{b.name}</span>
                      <span className="sub">{b.alias || 'sin mote'}</span>
                    </span>
                  </button>
                  {suyos.length > 0 && (
                    <span className={`globo${nuevos > 0 ? ' nuevo' : ''}`} aria-label={`${suyos.length} comentarios${nuevos ? `, ${nuevos} sin leer` : ''}`}>
                      💬 {suyos.length}
                    </span>
                  )}
                  {/* **El nombre de la familia, no su alias** (§14.66-ter). Las
                      dos letras funcionan donde firman algo —una idea, un voto—
                      porque ahí lo que se pregunta es «¿de quién es esto?» sobre
                      una lista de cosas de gente distinta. Aquí la pregunta es
                      «¿quién duerme en el 12?», que se contesta con un nombre:
                      «GA» obliga a traducir, y traducir cada vez cuesta más que
                      los 30 pt que ahorra. El emoji se queda de seña. */}
                  <button
                    type="button"
                    className={`pastilla de-quien${suya ? '' : ' vacia'}`}
                    disabled={!conBungas}
                    aria-label={suya ? `Es de los ${suya.name}` : 'No es de nadie'}
                    onClick={() => emparejar({ que: 'familia', id: b.id })}
                  >
                    {suya
                      ? <><span className="cara" aria-hidden>{suya.avatar}</span>{suya.name}</>
                      : '— de nadie —'}
                  </button>
                </div>
                {dice && (
                  <p className={`bunga-eval${dice.vigente ? '' : ' viejo'}`}>
                    {dice.frase}
                    {!dice.vigente && <span className="be-viejo"> · escrita antes de lo último que se apuntó</span>}
                  </p>
                )}
              </div>
            )
          })}

          {families.some((f) => !bungaDeFamilia(bungas, f.id)) && (
            <>
              <div className="sec-h">Sin bunga</div>
              <div className="card tight">
                {families.filter((f) => !bungaDeFamilia(bungas, f.id)).sort(porNombre).map((f) => (
                  <div className="row" key={f.id}>
                    <div className="main">
                      <div className="n">{f.name}<Alias familia={f} /></div>
                      <div className="sub">todavía sin bunga</div>
                    </div>
                    {conBungas && (
                      <button type="button" className="btn sm ghost" onClick={() => emparejar({ que: 'bunga', id: f.id })}>
                        Darle uno
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {conBungas ? (
            <button className="btn block" onClick={() => abrir({ tipo: 'bunga' })}>+ Bunga</button>
          ) : (
            <div className="note">{razon}</div>
          )}
        </>
      )}

      {editor?.tipo === 'familia' && (
        <EditorFamilia
          eventId={eventId}
          familia={families.find((f) => f.id === editor.id) ?? null}
          families={families}
          bungas={bungas}
          personas={persons}
          puedeBorrar={puedoTodo}
          onCerrar={() => setEditor(null)}
        />
      )}
      {editor?.tipo === 'bunga' && (
        <EditorBunga
          eventId={eventId}
          bunga={bungas.find((b) => b.id === editor.id) ?? null}
          familyIdFijo={editor.familyId ?? null}
          families={families}
          bungas={bungas}
          cenas={dinners}
          onCerrar={() => setEditor(null)}
        />
      )}
      {editor?.tipo === 'persona' && (
        <EditorPersona
          eventId={eventId}
          persona={persons.find((p) => p.id === editor.id) ?? null}
          familyIdFijo={editor.familyId ?? null}
          families={families}
          gastos={expenses}
          puedeMover={puedoTodo}
          onCerrar={() => setEditor(null)}
        />
      )}

      {eligiendo?.que === 'bunga' && (
        <ElegirBunga
          eventId={eventId}
          familyId={eligiendo.id}
          families={families}
          bungas={bungas}
          onCerrar={() => setEligiendo(null)}
          onCrear={() => { setEligiendo(null); setEditor({ tipo: 'bunga', familyId: eligiendo.id }) }}
          onEditar={(id) => { setEligiendo(null); setEditor({ tipo: 'bunga', id }) }}
        />
      )}
      {eligiendo?.que === 'familia' && (
        <ElegirFamilia
          bungaId={eligiendo.id}
          families={families}
          bungas={bungas}
          onCerrar={() => setEligiendo(null)}
        />
      )}
    </>
  )
}

/**
 * La hoja de A3 vista desde una familia: qué bunga se le da.
 *
 * Y **corregir el que ya tiene** (§14.48). Un bunga con familia desaparece de
 * «Sueltos», que es el único sitio donde su renglón abría el editor: en cuanto
 * se asignaba, su nombre y su mote quedaban escritos para siempre. En el Demo,
 * donde los tres bungas tienen familia, eso son los tres. La salida vive aquí y
 * no en un lápiz de la pastilla porque la pastilla mide lo que mide y ya tiene
 * un verbo; y esto es lo que se busca justo después de tocarla.
 */
function ElegirBunga({ eventId, familyId, families, bungas, onCerrar, onCrear, onEditar }) {
  const puesto = bungaDeFamilia(bungas, familyId)
  const libres = new Set(bungasLibres(bungas, families, { paraFamilia: familyId }).map((b) => b.id))
  const familia = (id) => families.find((f) => f.id === id)?.name
  return (
    <HojaDeEleccion
      titulo="¿Qué bunga?"
      valor={puesto?.id ?? null}
      opciones={[
        { id: null, etiqueta: '— ninguno —' },
        ...[...bungas].sort(porNombre).map((b) => ({
          id: b.id,
          etiqueta: etiquetaBunga(b),
          nota: libres.has(b.id) ? null : `lo tienen los ${familia(b.familyId)}`,
          tomada: !libres.has(b.id),
        })),
      ]}
      onElegir={async (id) => { await asignarBungaAFamilia(eventId, familyId, id); onCerrar() }}
      onCerrar={onCerrar}
      extra={[
        // El nombre va en la etiqueta: «Editar» a secas, en una hoja que acaba
        // de listar cinco bungas, no dice cuál de los cinco.
        ...(puesto ? [{ etiqueta: `Editar «${etiquetaCorta(puesto)}»…`, onClick: () => onEditar(puesto.id) }] : []),
        { etiqueta: '+ Bunga nuevo…', onClick: onCrear },
      ]}
    />
  )
}

/** La misma hoja desde el otro lado: a qué familia va un bunga suelto. */
function ElegirFamilia({ bungaId, families, bungas, onCerrar }) {
  const bunga = bungas.find((b) => b.id === bungaId)
  const libres = new Set(familiasLibres(families, bungas, { paraBunga: bungaId }).map((f) => f.id))
  const suBunga = (familyId) => bungaDeFamilia(bungas, familyId)
  return (
    <HojaDeEleccion
      titulo={`¿De quién es ${bunga?.name ?? 'el bunga'}?`}
      valor={bunga?.familyId ?? null}
      opciones={[
        { id: null, etiqueta: '— ninguna —' },
        ...[...families].sort(porNombre).map((f) => ({
          id: f.id,
          etiqueta: f.name,
          nota: libres.has(f.id) ? null : `ya tienen ${suBunga(f.id)?.name}`,
          tomada: !libres.has(f.id),
        })),
      ]}
      onElegir={async (id) => { await updateBunga(bungaId, { familyId: id }); onCerrar() }}
      onCerrar={onCerrar}
    />
  )
}

/**
 * El pie de todo editor (D1): guardar, y debajo borrar en dos tiempos.
 *
 * El segundo tiempo no es un «¿seguro?» —eso no informa de nada—: dice **qué se
 * lleva por delante**, que es lo que hoy no decía nadie y por lo que borrar una
 * familia se comía en silencio el vínculo con su bunga y dejaba a su gente sin
 * ella.
 */
function PieDeEditor({ onGuardar, onCancelar, borrado }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <>
      {/* Los verbos van en una línea y separados: apilados y pegados, el rojo
          caía justo debajo del pulgar que acababa de dar a Guardar. Y salir sin
          guardar tiene que ser un botón —cerrar tocando el fondo lo sabe quien
          lo ha programado—, así que Cancelar está siempre al lado. */}
      <div className="editor-pie">
        {borrado && !confirmando && (
          <button className="btn ghost danger-txt" onClick={() => { tap(); setConfirmando(true) }}>
            {borrado.corta ?? 'Borrar'}
          </button>
        )}
        <button className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn" onClick={onGuardar}>Guardar</button>
      </div>
      {/* La misma pieza que Dinero y Comidas: era de aquí, y ahora es de todos
          (`components/Confirmar.jsx`, borrar-confirmaciones.html · A2). */}
      {borrado && confirmando && (
        <Confirmar
          queSeLleva={borrado.queSeLleva}
          onDejarlo={() => setConfirmando(false)}
          onBorrar={borrado.onBorrar}
        />
      )}
    </>
  )
}

function EditorFamilia({ eventId, familia, families, bungas, personas, onCerrar }) {
  const nueva = !familia
  const [name, setName] = useState(familia?.name ?? '')
  // El alias se propone del nombre y **sigue escribiéndose solo mientras nadie
  // lo toque a mano** (`docs/diseño/planes-ideas.html` · D3). Nace lleno porque
  // el único fallo que rompe la firma de una idea es que esté vacío; se puede
  // corregir porque «Solteros» sale SO y quizá se quiera SL.
  const [alias, setAlias] = useState(() => aliasDe(familia))
  const cambiarNombre = (valor) => {
    if (aliasSigueAlNombre(alias, name)) setAlias(aliasSugerido(valor))
    setName(valor)
  }
  const [avatar, setAvatar] = useState(familia?.avatar ?? '👨‍👩‍👧')
  const [color, setColor] = useState(familia?.color ?? COLORES[0])
  // Al crear no hay a quién asignárselo todavía, así que el bunga se elige aquí;
  // al editar se cambia desde la pastilla de la ficha, que está a un toque.
  const [bungaId, setBungaId] = useState('')
  const [eligiendo, setEligiendo] = useState(false)
  const libres = bungasLibres(bungas, families)
  const elegido = bungas.find((b) => b.id === bungaId) ?? bungaDeFamilia(bungas, familia?.id)

  const guardar = async () => {
    if (!name.trim()) return
    const datos = {
      name: name.trim(),
      alias: (alias.trim() || aliasSugerido(name)).toUpperCase(),
      avatar: avatar || '👨‍👩‍👧',
      color,
    }
    if (nueva) {
      const id = await addFamily(eventId, datos)
      if (bungaId) await asignarBungaAFamilia(eventId, id, bungaId)
    } else {
      await updateFamily(familia.id, datos)
    }
    onCerrar()
  }

  const suGente = nueva ? [] : personas.filter((p) => p.familyId === familia.id)
  const suBunga = nueva ? null : bungaDeFamilia(bungas, familia.id)

  return (
    <Hoja titulo={nueva ? 'Nueva familia' : 'Editar familia'} onCerrar={onCerrar}>
      <div className="grid-familia">
        <div>
          <label htmlFor="fam-nombre">Nombre</label>
          <input id="fam-nombre" type="text" value={name} onChange={(e) => cambiarNombre(e.target.value)} placeholder="García" autoFocus />
        </div>
        <div>
          <label htmlFor="fam-alias">Alias</label>
          <input
            id="fam-alias"
            className="campo-alias"
            type="text"
            value={alias}
            maxLength={2}
            onChange={(e) => setAlias(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label htmlFor="fam-emoji">Emoji</label>
          <input id="fam-emoji" type="text" value={avatar} onChange={(e) => setAvatar(cortarEmojis(e.target.value, TOPE_EMOJIS))} />
        </div>
      </div>
      <div className="pista">Dos letras. Firman las ideas. Se propone del nombre; cámbialo si quieres.</div>

      <label>Bunga</label>
      {nueva ? (
        <>
          <button type="button" className={`pastilla grande${elegido ? '' : ' vacia'}`} onClick={() => { tap(); setEligiendo(true) }}>
            {elegido ? etiquetaBunga(elegido) : '— ninguno —'}
          </button>
          {/* La lista de aquí no lleva la salida de N4 —una familia que aún no
              existe no puede quedarse con nada—, así que la nota manda al sitio
              donde sí se puede en vez de prometer un botón que no está. */}
          {bungas.length > 0 && libres.length === 0 && (
            <div className="note">🐳 Todos los bungas tienen ya familia. Guarda esta y créale el suyo desde su pastilla.</div>
          )}
        </>
      ) : (
        <div className="dato-fijo">{suBunga ? etiquetaBunga(suBunga) : 'sin bunga'} — se cambia y se corrige desde la pastilla de la ficha.</div>
      )}

      <label>Color</label>
      <div className="chips">
        {COLORES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            className={`chip color${color === c ? ' on' : ''}`}
            onClick={() => setColor(c)}
          >
            <span className="punto" style={{ background: c }} />
          </button>
        ))}
      </div>

      <PieDeEditor
        onGuardar={guardar}
        onCancelar={onCerrar}
        borrado={nueva ? null : {
          corta: 'Borrar',
          queSeLleva: `Se borran los ${familia.name}. ${suGente.length === 0
            ? 'No tienen gente'
            : suGente.length === 1
              ? 'Su única persona se queda sin familia'
              : `Sus ${suGente.length} personas se quedan sin familia`}${
            suBunga ? ` y ${suBunga.name} vuelve a quedar libre` : ''}.`,
          onBorrar: async () => { await borrarFamilia(eventId, familia.id); onCerrar() },
        }}
      />

      {eligiendo && (
        <HojaDeEleccion
          titulo="¿Qué bunga?"
          valor={bungaId || null}
          opciones={[
            { id: null, etiqueta: '— ninguno —' },
            ...[...bungas].sort(porNombre).map((b) => ({
              id: b.id,
              etiqueta: etiquetaBunga(b),
              nota: libres.some((l) => l.id === b.id) ? null : 'ya tiene familia',
              tomada: !libres.some((l) => l.id === b.id),
            })),
          ]}
          onElegir={(id) => { setBungaId(id ?? ''); setEligiendo(false) }}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </Hoja>
  )
}

/**
 * El editor de un bunga, y desde §14.56 también **el sitio**.
 *
 * Dos cosas en la misma hoja porque desde el móvil son una: se abre «Bunga 3» y
 * se quiere corregir su alias, apuntar que la nevera congela y ver quién estuvo
 * antes. Lo que las separa es dónde viven —el alias y la familia son de este
 * agosto, las notas y las pegatinas del sitio— y eso es fontanería, no una
 * pregunta que haya que hacerle a nadie.
 *
 * **El alojamiento se crea solo**, con el nombre del bunga, la primera vez que
 * se escribe algo que es del sitio. Preguntarlo antes sería pedir que se
 * entienda la partición para poder apuntar una nota.
 */
function EditorBunga({ eventId, bunga, familyIdFijo, families, bungas, cenas, onCerrar }) {
  const nuevo = !bunga
  const [name, setName] = useState(bunga?.name ?? '')
  const [alias, setAlias] = useState(bunga?.alias ?? '')
  const alojamientos = useLiveQuery(() => listAlojamientos(), [], [])
  const todosBungas = useLiveQuery(() => todosLosBungas(), [], [])
  const eventos = useLiveQuery(() => listEvents(), [], [])
  const sitio = alojamientos.find((a) => a.id === bunga?.alojamientoId) ?? null
  const historico = historicoDe(bunga?.alojamientoId, {
    eventos, bungas: todosBungas, familias: families,
  })
  // Viene relleno cuando se ha llegado por «+ Bunga nuevo…» desde la hoja de una
  // familia (N4): el bunga nace ya con dueño, que es para lo que se ha creado.
  const [familyId, setFamilyId] = useState(bunga?.familyId ?? familyIdFijo ?? '')
  const [eligiendo, setEligiendo] = useState(false)
  const libres = familiasLibres(families, bungas, { paraBunga: bunga?.id ?? null })
  const familia = families.find((f) => f.id === familyId)

  const guardar = async () => {
    if (!name.trim()) return
    const datos = { name: name.trim(), alias: alias.trim(), familyId: familyId || null }
    if (nuevo) await addBunga(eventId, datos)
    else await updateBunga(bunga.id, datos)
    onCerrar()
  }

  /**
   * Escribe algo que es **del sitio** y no de este agosto, creando el
   * alojamiento si aún no lo tenía. Devuelve el id, para encadenar.
   */
  async function enElSitio(campos) {
    if (!bunga) return null
    if (sitio) { await updateAlojamiento(sitio.id, campos); return sitio.id }
    const id = await addAlojamiento({ name: bunga.name, ...campos })
    await updateBunga(bunga.id, { alojamientoId: id })
    return id
  }

  const sede = nuevo ? 0 : cenas.filter((c) => c.bungaMayoresId === bunga.id || c.bungaNinosId === bunga.id).length

  return (
    <Hoja titulo={nuevo ? 'Nuevo bunga' : 'Editar bunga'} onCerrar={onCerrar}>
      <label htmlFor="bunga-nombre">Nombre</label>
      <input id="bunga-nombre" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bunga 1" autoFocus />
      <label htmlFor="bunga-alias">Alias (opcional)</label>
      <input id="bunga-alias" type="text" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="el de la piscina" />

      <label>Familia</label>
      <button type="button" className={`pastilla grande${familia ? '' : ' vacia'}`} onClick={() => { tap(); setEligiendo(true) }}>
        {familia ? familia.name : '— ninguna —'}
      </button>
      {families.length > 0 && libres.length === 0 && !familia && (
        <div className="note">🐳 Todas las familias tienen ya bunga.</div>
      )}

      {/* **Cómo es el sitio** (§14.56 · B4). Pegatinas de un toque y no cinco
          estrellas: se dibujó la versión con puntuaciones y son cinco preguntas
          que en agosto no contesta nadie. Un toque sí se paga. Y esto **no se
          va con el evento**: vive en el catálogo, así que sigue puesto el año
          que viene. */}
      {!nuevo && (
        <>
          <label>Cómo es</label>
          <div className="chips">
            {PEGATINAS.map((p) => {
              const puesta = (sitio?.pegatinas ?? []).includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${puesta ? ' on' : ''}`}
                  aria-pressed={puesta}
                  onClick={() => { tap(); enElSitio({ pegatinas: conPegatina(sitio?.pegatinas, p.id) }) }}
                >
                  {p.icon} {p.label}
                </button>
              )
            })}
          </div>

          <label htmlFor="bunga-notas">Notas del sitio</label>
          <textarea
            id="bunga-notas"
            rows={3}
            placeholder="La nevera congela mucho, el sofá cama chirría…"
            defaultValue={sitio?.notas ?? ''}
            onBlur={(e) => {
              const texto = e.target.value
              if (texto !== (sitio?.notas ?? '')) enElSitio({ notas: texto })
            }}
          />
          <div className="pista">
            Esto es del <b>sitio</b>, no de este viaje: sigue aquí el año que viene.
          </div>

          {/* **El resumen con guasa** (§14.66, §14.66-bis). Se rehace solo en
              cuanto cambia una nota o una pegatina —a petición expresa—, y lo
              que evita que eso sean nueve llamadas es que vive **aquí dentro**,
              en la pantalla que abre quien lo está tocando: la lista solo
              enseña lo guardado. Lo que vuelve se guarda con el sitio, así que
              lo escribe quien lo cambió y lo leen los nueve. */}
          <ResumenDelBunga bunga={bunga} sitio={sitio} onEscribir={enElSitio} />

          {/* El hilo, con la misma pieza que en un plan, un gasto y un día
              (§14.55). Un bunga es de las cosas que más se comentan —«¿os
              importa cambiarlo?», «se ha vuelto a ir la luz»— y era de las
              pocas que no tenía dónde.

              Y es el único de los cuatro que lleva `sugerir` (§14.66-quater):
              detrás tiene la evaluación del sitio, que es de lo que el
              comentario tiene que hablar. Un plan o un gasto no la tienen. */}
          <Comentarios
            eventId={bunga.eventId}
            ancla={anclaDe('bunga', bunga.id)}
            sugerir={({ hilo, yaPropuestas }) => comentarioDeBunga({
              nombre: bunga.name,
              alias: bunga.alias ?? '',
              notas: sitio?.notas ?? '',
              pegatinas: pegatinasPuestas(sitio?.pegatinas),
              resumen: sitio?.resumen ?? '',
              hilo,
              yaPropuestas,
            })}
          />

          {/* El histórico (B5). No se guarda: se recorre `events` y `bungas` y
              se cuenta. */}
          {historico.length > 1 && (
            <>
              <label>Quién ha estado</label>
              <div className="card tight">
                {historico.map((h) => (
                  <div className="row" key={h.bungaId}>
                    <div className="main">
                      <div className="n">
                        {h.anio ?? '—'}{' '}
                        {h.familia ? `los ${h.familia.name}` : 'sin familia'}
                        {h.familia && <Alias familia={h.familia} />}
                      </div>
                      <div className="sub">{h.evento?.name ?? 'otro viaje'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <PieDeEditor
        onGuardar={guardar}
        onCancelar={onCerrar}
        borrado={nuevo ? null : {
          corta: 'Borrar',
          queSeLleva: `Se borra ${bunga.name}.${familia ? ` Los ${familia.name} se quedan sin bunga.` : ''}${
            sede > 0 ? ` Es sede de ${sede} ${sede === 1 ? 'cena' : 'cenas'}, que se quedarán sin anfitrión.` : ''}`,
          onBorrar: async () => { await removeBunga(bunga.id); onCerrar() },
        }}
      />

      {eligiendo && (
        <HojaDeEleccion
          titulo="¿De quién es?"
          valor={familyId || null}
          opciones={[
            { id: null, etiqueta: '— ninguna —' },
            ...[...families].sort(porNombre).map((f) => ({
              id: f.id,
              etiqueta: f.name,
              nota: libres.some((l) => l.id === f.id) ? null : 'ya tienen bunga',
              tomada: !libres.some((l) => l.id === f.id),
            })),
          ]}
          onElegir={(id) => { setFamilyId(id ?? ''); setEligiendo(false) }}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </Hoja>
  )
}

function EditorPersona({ eventId, persona, familyIdFijo, families, gastos, onCerrar }) {
  const nueva = !persona
  const [name, setName] = useState(persona?.name ?? '')
  const [apodo, setApodo] = useState(persona?.apodo ?? '')
  const [avatar, setAvatar] = useState(persona?.avatar ?? '🧑')
  const [edad, setEdad] = useState(persona?.edad ?? 'adulto')
  const [familyId, setFamilyId] = useState(persona?.familyId ?? familyIdFijo ?? '')
  const [eligiendo, setEligiendo] = useState(false)
  // Quién se entera de **todos** los gastos (§14.58 · L1). Es un encargo, no un
  // rasgo: lo pone quien administra y no se deduce de la edad.
  const [lleva, setLleva] = useState(Boolean(persona?.llevaLasCuentas))
  // **Quien se va unos días** (§14.78). Es un interruptor y no dos fechas: se
  // pidió sin límite de tiempo, y unas fechas obligarían a decidir qué pasa con
  // el gasto apuntado el martes por quien se fue el miércoles.
  const [ausente, setAusente] = useState(Boolean(persona?.ausente))
  const familia = families.find((f) => f.id === familyId)
  // Creada desde su ficha (N2): la familia la dice el sitio donde se ha pulsado,
  // así que preguntarla otra vez es preguntar algo ya contestado.
  const familiaImplicita = nueva && Boolean(familyIdFijo)

  const guardar = async () => {
    if (!name.trim()) return
    const datos = {
      name: name.trim(), apodo: apodo.trim(), avatar: avatar || '🧑',
      familyId: familyId || null, edad, pesoReparto: pesoDe(edad),
      // Solo se guarda encendido si además puede: cambiar a niño a alguien que
      // llevaba las cuentas lo apaga en el mismo gesto, y así no queda una fila
      // marcada que la pantalla ya no enseña.
      llevaLasCuentas: lleva && puedeOrganizar({ edad }),
      // 1 o 0 y no `true`/`false`: en D1 la columna es `INTEGER` (migración
      // `0023`), y `tablas.js` transporta el número tal cual.
      ausente: ausente ? 1 : 0,
    }
    if (nueva) await addPerson(eventId, datos)
    else await updatePerson(persona.id, datos)
    onCerrar()
  }

  const enGastos = nueva ? 0 : gastos.filter((g) => (g.participantIds ?? []).includes(persona.id)).length

  return (
    <Hoja
      titulo={nueva ? (familia ? `Nueva persona · ${familia.name}` : 'Nueva persona') : 'Editar persona'}
      onCerrar={onCerrar}
    >
      <label htmlFor="per-nombre">Nombre</label>
      <input id="per-nombre" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Curro" autoFocus />
      <div className="grid2">
        <div>
          <label htmlFor="per-apodo">Apodo (opcional)</label>
          <input id="per-apodo" type="text" value={apodo} onChange={(e) => setApodo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="per-emoji">Emoji</label>
          <input id="per-emoji" type="text" value={avatar} onChange={(e) => setAvatar(cortarEmojis(e.target.value, TOPE_EMOJIS))} />
        </div>
      </div>
      {/* Además del campo, unos cuantos a un toque: teclear un emoji en el móvil
          es abrir el teclado de emoji y buscarlo, y por eso se quedaban todos
          con el de fábrica. */}
      <div className="emojis" role="group" aria-label="Emoji para elegir">
        {EMOJIS_PERSONA.map((e) => (
          <button
            key={e}
            type="button"
            className={`emoji-op${avatar === e ? ' on' : ''}`}
            aria-label={`Emoji ${e}`}
            aria-pressed={avatar === e}
            onClick={() => { tap(); setAvatar(e) }}
          >
            {e}
          </button>
        ))}
      </div>

      {!familiaImplicita && (
        <>
          <label>Familia</label>
          <button type="button" className={`pastilla grande${familia ? '' : ' vacia'}`} onClick={() => { tap(); setEligiendo(true) }}>
            {familia ? familia.name : '— sin familia —'}
          </button>
        </>
      )}

      {/* Botones y no un desplegable: son tres opciones, y el peso sale de la
          que elijas en vez de ser un número que hay que decidir cada vez. El
          adolescente pesa como un adulto: lo único que cambia es que no toca
          Dinero (§14.41). */}
      <label>Edad</label>
      <div className="segmentado" role="group" aria-label="Edad">
        {EDADES.map((e) => (
          <button
            key={e.id}
            type="button"
            className={edad === e.id ? 'on' : ''}
            aria-pressed={edad === e.id}
            onClick={() => { tap(); setEdad(e.id) }}
          >
            {e.etiqueta}
          </button>
        ))}
      </div>

      {/* **Quién lleva las cuentas** (§14.58 · L1·L5). Solo para quien
          administra —es lo mismo que decide el resto de esta pantalla— y solo
          para quien puede escribir en Gastos: marcar de contable a un niño sería
          una casilla que no puede hacer nada, así que no sale. */}
      {mandaEnTodo(leerSesion()) && puedeOrganizar({ edad }) && (
        <>
          <label>Avisos</label>
          <button
            type="button"
            className={`casilla-larga${lleva ? ' on' : ''}`}
            role="switch"
            aria-checked={lleva}
            onClick={() => { tap(); setLleva(!lleva) }}
          >
            <span className="tic" aria-hidden>{lleva ? '✓' : ''}</span>
            <span className="main">
              <span className="n">Lleva las cuentas</span>
              <span className="sub">
                Le llegan <b>todos</b> los gastos, le toquen o no — y también los que se borren.
              </span>
            </span>
          </button>
        </>
      )}

      {/* **Se ha ido unos días** (§14.78). Solo en alguien que ya existe: en
          «Nueva persona» un interruptor que dice «no está» pregunta por un
          estado que todavía no tiene sentido. Lo puede tocar quien puede abrir
          esta ficha, que son los adultos de su familia y quien administra
          (`puedeEditarFamilia`, §14.63) — la misma línea que decide todo lo
          demás de esta pantalla. */}
      {!nueva && (
        <>
          <label>Estos días</label>
          <button
            type="button"
            className={`casilla-larga${ausente ? ' on' : ''}`}
            role="switch"
            aria-checked={ausente}
            onClick={() => { tap(); setAusente(!ausente) }}
          >
            <span className="tic" aria-hidden>{ausente ? '✓' : ''}</span>
            <span className="main">
              <span className="n">Se ha ido unos días</span>
              <span className="sub">
                Deja de contar en <b>la compra</b>, en <b>«Todos»</b> al repartir un gasto y entre
                los que faltan por votar. Lo ya apuntado a su nombre <b>no se toca</b>.
              </span>
            </span>
          </button>
        </>
      )}

      <PieDeEditor
        onGuardar={guardar}
        onCancelar={onCerrar}
        borrado={nueva ? null : {
          corta: 'Borrar',
          queSeLleva: `Se borra a ${persona.name}.${enGastos > 0
            ? ` Participa en ${enGastos} ${enGastos === 1 ? 'gasto' : 'gastos'}: su parte dejará de contar para ${familia ? `los ${familia.name}` : 'nadie'}.`
            : ' No participa en ningún gasto.'}`,
          onBorrar: async () => { await removePerson(persona.id); onCerrar() },
        }}
      />

      {eligiendo && (
        <HojaDeEleccion
          titulo="¿De qué familia?"
          valor={familyId || null}
          opciones={[
            { id: null, etiqueta: '— sin familia —' },
            ...[...families].sort(porNombre).map((f) => ({ id: f.id, etiqueta: f.name })),
          ]}
          onElegir={(id) => { setFamilyId(id ?? ''); setEligiendo(false) }}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </Hoja>
  )
}

/**
 * El resumen del bunga: **se rehace solo** en cuanto cambia algo (§14.66-bis).
 *
 * Nació detrás de un botón, por la regla de que la IA entra cuando se le pide
 * (§14.19-bis). El botón se retira **a petición expresa**, y lo que hace que eso
 * no se convierta en nueve llamadas por bunga es dónde vive esto: **dentro de la
 * pantalla de un bunga**, que es la que abre quien lo está tocando. La lista no
 * pide nada — se limita a enseñar lo que hay guardado.
 *
 * Tres guardas, y las tres son la diferencia entre «se actualiza solo» y «se
 * llama sin parar»:
 *
 *  1. **La huella.** Solo se pide cuando `huellaDelSitio` deja de coincidir con
 *     `resumenDe`, o sea cuando de verdad ha cambiado una nota o una pegatina.
 *     Abrir el bunga cuarenta veces no pide nada.
 *  2. **Un respiro de un segundo y medio.** Marcar tres pegatinas seguidas son
 *     tres escrituras y **una** llamada: sin esto, cada toque pagaría la suya.
 *  3. **Una sola vez por huella.** Si el modelo falla —sin clave, sin red— no se
 *     reintenta en bucle contra la misma versión del texto: se dice lo que pasó
 *     y se ofrece volver a intentarlo, que es un botón de recuperar un fallo y
 *     no el de pedir la frase.
 *
 * Lo que vuelve **se guarda en el sitio** —no en este móvil ni en este agosto—,
 * con la huella de lo que se resumió, así que lo escribe quien lo cambió y lo
 * leen los nueve.
 *
 * Y **no se pide con el sitio en blanco**: sin pegatinas ni notas, lo único que
 * puede hacer el modelo es inventarse cómo es el bungalow, que es exactamente lo
 * que no queremos leer al repartirlos.
 */
export const RESPIRO_MS = 1500

function ResumenDelBunga({ bunga, sitio, onEscribir, respiro = RESPIRO_MS }) {
  const [yendo, setYendo] = useState(false)
  const [fallo, setFallo] = useState(null)
  const dice = resumenDelSitio(sitio)
  const hayMaterial = hayQueResumir(sitio)
  const huella = hayMaterial ? huellaDelSitio(sitio) : null
  // La última huella que se ha intentado, haya salido bien o mal. Sin esto, un
  // fallo del modelo deja el efecto pidiéndolo otra vez en cada pintado.
  const intentada = useRef(null)
  const vivo = useRef(true)
  useEffect(() => () => { vivo.current = false }, [])

  async function resumir() {
    intentada.current = huella
    setYendo(true)
    setFallo(null)
    try {
      const frase = await resumenDeBunga({
        nombre: bunga.name,
        alias: bunga.alias ?? '',
        notas: sitio?.notas ?? '',
        pegatinas: pegatinasPuestas(sitio?.pegatinas),
      })
      if (!vivo.current) return
      if (frase) await onEscribir({ resumen: frase, resumenDe: huella })
      else setFallo('El modelo no ha traído ninguna frase.')
    } catch (e) {
      if (vivo.current) setFallo(String(e.message ?? e))
    } finally {
      if (vivo.current) setYendo(false)
    }
  }

  // Cambió algo del bunga → se rehace la frase, tras el respiro. El reloj se
  // cancela al volver a cambiar, que es lo que junta tres pegatinas seguidas en
  // una sola llamada.
  useEffect(() => {
    if (!huella || yendo) return undefined
    if (sitio?.resumenDe === huella || intentada.current === huella) return undefined
    const reloj = setTimeout(resumir, respiro)
    return () => clearTimeout(reloj)
  }, [huella, yendo, sitio?.resumenDe])

  return (
    <>
      <label>En una frase</label>
      {dice ? (
        <div className={`resumen-bunga${dice.vigente || yendo ? '' : ' viejo'}`}>
          <span className="rb-frase">🐳 {dice.frase}</span>
          {!dice.vigente && (
            <span className="rb-viejo">
              {yendo ? 'Rehaciéndola con lo último…' : 'Escrita antes de lo último que se apuntó.'}
            </span>
          )}
        </div>
      ) : (
        <div className="pista">
          {!hayMaterial
            ? 'Pon alguna pegatina o apunta una nota, y se resume sola.'
            : (yendo ? 'Escribiéndola…' : 'Sale en la lista de bungas, para no tener que abrirlos uno a uno.')}
        </div>
      )}
      {/* El único botón que queda es el de **recuperarse de un fallo**, y solo
          aparece cuando lo ha habido: pedir la frase ya no se pide. */}
      {fallo && (
        <>
          <pre className="traza mal" role="status">{fallo}</pre>
          <button className="btn sm ghost" disabled={yendo} onClick={() => { tap(); resumir() }}>
            Volver a intentarlo
          </button>
        </>
      )}
    </>
  )
}
