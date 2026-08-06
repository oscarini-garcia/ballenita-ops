// El grupo en una sola sección: una ficha por familia, con su bunga y su gente.
//
// «Sueltos» recoge lo que no está colocado, y se edita de verdad —se toca la
// fila y sube una hoja desde abajo— (SPECS §14.14).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, addFamily, updateFamily, borrarFamilia,
  bungasOf, addBunga, updateBunga, removeBunga, asignarBungaAFamilia,
  personsOf, addPerson, updatePerson, removePerson,
  expensesOf, dinnersOf,
} from '../db.js'
import Hoja, { HojaDeEleccion } from '../components/Hoja.jsx'
import Icono from '../components/Icono.jsx'
import { bungaDeFamilia, bungasLibres, familiasLibres, etiquetaBunga, etiquetaCorta, porNombre } from '../lib/asignacion.js'
import { aliasDe, aliasSugerido, aliasSigueAlNombre } from '../lib/alias.js'
import { tap } from '../lib/native.js'
import { EDADES, EMOJIS_PERSONA, pesoDe } from '../lib/personas.js'

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
export default function GrupoSection({ eventId }) {
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

  const abrir = (e) => { tap(); setEditor(e) }
  // Todo va ordenado por nombre: una lista de nueve nombres sin orden se recorre
  // entera cada vez, y el de la base es el de los ids, que son aleatorios.
  const genteDe = (familyId) => persons.filter((p) => p.familyId === familyId).sort(porNombre)
  const sueltosBungas = bungasLibres(bungas, families).sort(porNombre)
  const sueltosGente = persons.filter((p) => !families.some((f) => f.id === p.familyId)).sort(porNombre)

  return (
    <>
      {families.length === 0 && bungas.length === 0 && persons.length === 0 && (
        <div className="empty">Aún no hay nadie. Empieza por una familia.</div>
      )}

      {[...families].sort(porNombre).map((f) => {
        const b = bungaDeFamilia(bungas, f.id)
        return (
          <div className="ficha-fam" key={f.id}>
            <div className="ficha-cab">
              <button type="button" className="ficha-quien" onClick={() => abrir({ tipo: 'familia', id: f.id })}>
                <span className="av" style={{ background: f.color }}>{f.avatar}</span>
                <span className="main">
                  <span className="n">{f.name}</span>
                  {f.estado && <span className="sub">{f.estado}</span>}
                </span>
              </button>
              <button
                type="button"
                className={`pastilla${b ? '' : ' vacia'}`}
                onClick={() => { tap(); setEligiendo({ que: 'bunga', id: f.id }) }}
              >
                {b ? etiquetaCorta(b) : '+ Bunga'}
              </button>
            </div>
            <div className="ficha-cuerpo">
              {genteDe(f.id).map((p) => (
                <button type="button" className="mini" key={p.id} onClick={() => abrir({ tipo: 'persona', id: p.id })}>
                  <span className="av chica" style={{ background: f.color }}>{p.avatar}</span>
                  <span className="quien">{p.name}{p.apodo ? ` «${p.apodo}»` : ''}</span>
                  <span className="dato">{p.edad}</span>
                </button>
              ))}
              <button type="button" className="mini anadir" onClick={() => abrir({ tipo: 'persona', familyId: f.id })}>
                + Persona
              </button>
            </div>
          </div>
        )
      })}

      {(sueltosBungas.length > 0 || sueltosGente.length > 0) && (
        <>
          <div className="sec-h">Sueltos</div>
          <div className="card tight">
            {sueltosBungas.map((b) => (
              <div className="row" key={b.id}>
                <button type="button" className="row-quien" onClick={() => abrir({ tipo: 'bunga', id: b.id })}>
                  <span className="ico"><Icono nombre="casa" /></span>
                  <span className="main">
                    <span className="n">{b.name}</span>
                    <span className="sub">{[b.alias, 'sin familia'].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => { tap(); setEligiendo({ que: 'familia', id: b.id }) }}
                >
                  Asignar
                </button>
              </div>
            ))}
            {sueltosGente.map((p) => (
              <div className="row" key={p.id}>
                <button type="button" className="row-quien" onClick={() => abrir({ tipo: 'persona', id: p.id })}>
                  <span className="av sin"> {p.avatar}</span>
                  <span className="main">
                    <span className="n">{p.name}</span>
                    <span className="sub">sin familia · {p.edad}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn block" onClick={() => abrir({ tipo: 'familia' })}>+ Familia</button>
      <div className="note">
        🐳 Quien se queda <b>sin familia</b> no entra en el reparto de ninguna. La gente de aquí es
        la que puede tener cuenta: las peticiones de acceso se enlazan con una persona.
      </div>

      {editor?.tipo === 'familia' && (
        <EditorFamilia
          eventId={eventId}
          familia={families.find((f) => f.id === editor.id) ?? null}
          families={families}
          bungas={bungas}
          personas={persons}
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

/** La hoja de A3 vista desde una familia: qué bunga se le da. */
function ElegirBunga({ eventId, familyId, families, bungas, onCerrar, onCrear }) {
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
      extra={{ etiqueta: '+ Bunga nuevo…', onClick: onCrear }}
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
      {borrado && confirmando && (
        <div className="confirmar">
          <div className="que-se-lleva">{borrado.queSeLleva}</div>
          <div className="grid2">
            <button className="btn ghost" onClick={() => setConfirmando(false)}>Dejarlo</button>
            <button className="btn danger" onClick={borrado.onBorrar}>Sí, borrar</button>
          </div>
        </div>
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
  const [estado, setEstado] = useState(familia?.estado ?? '')
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
      estado: estado.trim(),
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
          <input id="fam-emoji" type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={4} />
        </div>
      </div>
      <div className="pista">Dos letras. Firman las ideas. Se propone del nombre; cámbialo si quieres.</div>

      {/* El estado va solo y a lo ancho: es lo que va a crecer. */}
      <label htmlFor="fam-estado">Estado</label>
      <input id="fam-estado" type="text" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="modo playa" />

      <label>Bunga</label>
      {nueva ? (
        <>
          <button type="button" className={`pastilla grande${elegido ? '' : ' vacia'}`} onClick={() => { tap(); setEligiendo(true) }}>
            {elegido ? etiquetaBunga(elegido) : '— ninguno —'}
          </button>
          {bungas.length > 0 && libres.length === 0 && (
            <div className="note">🐳 Todos los bungas tienen ya familia. Puedes crear uno nuevo desde la misma lista.</div>
          )}
        </>
      ) : (
        <div className="dato-fijo">{suBunga ? etiquetaBunga(suBunga) : 'sin bunga'} — se cambia desde la pastilla de la ficha.</div>
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

function EditorBunga({ eventId, bunga, familyIdFijo, families, bungas, cenas, onCerrar }) {
  const nuevo = !bunga
  const [name, setName] = useState(bunga?.name ?? '')
  const [alias, setAlias] = useState(bunga?.alias ?? '')
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
  const familia = families.find((f) => f.id === familyId)
  // Creada desde su ficha (N2): la familia la dice el sitio donde se ha pulsado,
  // así que preguntarla otra vez es preguntar algo ya contestado.
  const familiaImplicita = nueva && Boolean(familyIdFijo)

  const guardar = async () => {
    if (!name.trim()) return
    const datos = {
      name: name.trim(), apodo: apodo.trim(), avatar: avatar || '🧑',
      familyId: familyId || null, edad, pesoReparto: pesoDe(edad),
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
          <input id="per-emoji" type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={4} />
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

      {/* Dos botones y no un desplegable: son dos opciones, y el peso sale de
          la que elijas en vez de ser un número que hay que decidir cada vez. */}
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
