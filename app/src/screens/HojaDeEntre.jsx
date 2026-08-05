import { useState } from 'react'
import Hoja from '../components/Hoja.jsx'
import Icono from '../components/Icono.jsx'
import { tap } from '../lib/native.js'
import {
  ATAJOS, genteDeAtajo, atajoDe, porFamilias, estadoDeFamilia, quienDeFamilia, buscarGente,
} from '../lib/reparto-gente.js'

// ─────────────────────────────────────────────────────────────────────────────
// Entre quién se divide (SPECS §14.27 · `docs/diseño/gasto-entre.html`,
// combinación A3 · B2 · C2 con el renglón de C4 · D2 + D4 · E2).
//
// La de antes eran dos chips y **los nueve nombres del grupo puestos uno detrás
// de otro**: 711,3 pt en un teléfono de 844 —el 84 %—, de los que 434 eran
// nombres. Sin familias, sin buscar, sin forma de vaciar la lista y sin forma de
// arrepentirse: llamaba a `onCambio` en cada toque, así que tocar el fondo no
// cerraba, **guardaba**.
//
// Ahora son tres niveles y solo dos están desplegados: los cuatro atajos, las
// familias con su recuento —que se abren para ver quién es quién— y el buscador
// detrás de una lupa. 372,8 pt cerrada, y **no crece** aunque el grupo pase de
// nueve personas a quince, porque las familias siguen siendo tres.
// ─────────────────────────────────────────────────────────────────────────────

export default function HojaDeEntre({ persons, families, participantIds, onCambio, onCerrar }) {
  // El borrador. Sin él no hay nada que cancelar: no es que faltara el botón, es
  // que la hoja escribía en la ficha en cada toque y al cerrarse ya estaba hecho.
  const [dentro, setDentro] = useState(() => new Set(participantIds))
  const [abiertas, setAbiertas] = useState(() => new Set())
  // `null` = la lupa está sin tocar; `''` = el campo está abierto y vacío.
  const [busqueda, setBusqueda] = useState(null)

  const grupos = porFamilias(persons, families)
  const atajo = atajoDe([...dentro], persons)
  const buscando = Boolean(busqueda?.trim())
  const encontrados = buscando ? buscarGente(persons, busqueda) : []

  function ponerAtajo(id) {
    tap()
    setDentro(new Set(genteDeAtajo(id, persons)))
  }
  function alternarPersona(id) {
    tap()
    const s = new Set(dentro)
    s.has(id) ? s.delete(id) : s.add(id)
    setDentro(s)
  }
  function alternarFamilia(gente) {
    tap()
    const s = new Set(dentro)
    // A medias cuenta como «no está entera», así que el toque la completa: es lo
    // que se quiere el 100 % de las veces que se toca una familia a medias.
    const entera = estadoDeFamilia(gente, s) === 'todo'
    for (const p of gente) entera ? s.delete(p.id) : s.add(p.id)
    setDentro(s)
  }
  function destapar(id) {
    tap()
    const s = new Set(abiertas)
    s.has(id) ? s.delete(id) : s.add(id)
    setAbiertas(s)
  }

  return (
    <Hoja
      titulo="Entre"
      onCerrar={onCerrar}
      acciones={{ onCancelar: onCerrar, onListo: () => { onCambio([...dentro]); onCerrar() } }}
    >
      {/* B2 · un segmentado y no cuatro pastillas: las cuatro palabras suman
          384,7 pt de los 356 que hay, así que como chips doblan a dos filas ya en
          la talla de fábrica. En columnas miden lo mismo en las tres tallas. */}
      <div className="mando-atajos" role="group" aria-label="Atajos">
        {ATAJOS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={atajo === a.id ? 'on' : ''}
            aria-pressed={atajo === a.id}
            onClick={() => ponerAtajo(a.id)}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>

      {/* D2 · la lupa comparte renglón con el rótulo, así que no cuesta ni un
          punto propio mientras no se usa, que es el 95 % del tiempo. */}
      <div className="reng-rotulo">
        <span className="sec-h">{buscando ? 'Quien coincide' : 'Familias'}</span>
        {busqueda === null ? (
          <button type="button" className="lupa" onClick={() => { tap(); setBusqueda('') }}>
            <Icono nombre="buscar" />Buscar
          </button>
        ) : (
          <button type="button" className="lupa" onClick={() => { tap(); setBusqueda(null) }}>
            Cerrar la búsqueda
          </button>
        )}
      </div>

      {busqueda !== null && (
        <input
          type="text"
          className="campo-busqueda"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar a alguien…"
          aria-label="Buscar a alguien"
          // El foco aquí sí se pide: has tocado la lupa para escribir. Es lo
          // contrario del `autoFocus` que se quitó de la ficha, que salía solo.
          autoFocus
        />
      )}

      {/* D4 · mientras hay letras, las familias se retiran y salen las personas.
          Al buscar ya has decidido que no vas a usar las familias. */}
      {buscando ? (
        <div className="eleccion">
          {encontrados.length === 0 && <div className="note">Nadie se llama así.</div>}
          {encontrados.map((p) => (
            <FilaPersona key={p.id} persona={p} dentro={dentro} onAlternar={alternarPersona} conFamilia={families} />
          ))}
        </div>
      ) : (
        <div className="eleccion">
          {grupos.map((g) => {
            const estado = estadoDeFamilia(g.gente, dentro)
            const abierta = abiertas.has(g.id)
            return (
              <div key={g.id ?? 'sueltos'} className="grupo-fam">
                {/* C2 · dos verbos en una fila de 48: la casilla marca —con sus
                    44 pt de toque alrededor de un dibujo de 24— y el cuerpo abre.
                    El objetivo pequeño es el que marca y el grande el que abre,
                    porque abrir sin querer no cambia nada y marcar sin querer sí. */}
                <div className="fila-fam">
                  <button
                    type="button"
                    className="marca"
                    aria-pressed={estado === 'todo'}
                    aria-label={`${estado === 'todo' ? 'Quitar' : 'Poner'} a los ${g.nombre}`}
                    onClick={() => alternarFamilia(g.gente)}
                  >
                    <Casilla estado={estado} />
                  </button>
                  <button
                    type="button"
                    className="destapa"
                    aria-expanded={abierta}
                    onClick={() => destapar(g.id)}
                  >
                    <span className="et">{g.nombre}</span>
                    {/* C4 · quién está dentro mientras quepa, y «n de m» cuando no. */}
                    <span className="no">{quienDeFamilia(g.gente, dentro)}</span>
                    <span className={`fle${abierta ? ' abierta' : ''}`} aria-hidden="true">›</span>
                  </button>
                </div>
                {abierta && g.gente.map((p) => (
                  <FilaPersona key={p.id} persona={p} dentro={dentro} onAlternar={alternarPersona} sangrada />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* La nota del peso ocupaba 69,5 pt permanentes para explicar una regla que
          no cambia nunca y que desde §14.26 ya no siempre se aplica. Un renglón. */}
      <div className="apunte" style={{ marginTop: 10 }}>
        Por el peso de cada uno: 1 el mayor, 0,6 el niño.
      </div>
    </Hoja>
  )
}

/** Una persona, dentro de su familia abierta o en los resultados de la búsqueda. */
function FilaPersona({ persona, dentro, onAlternar, sangrada = false, conFamilia = null }) {
  const puesta = dentro.has(persona.id)
  const familia = conFamilia?.find((f) => f.id === persona.familyId)
  return (
    <button
      type="button"
      className={`fila-persona${sangrada ? ' sangrada' : ''}`}
      aria-pressed={puesta}
      onClick={() => onAlternar(persona.id)}
    >
      <Casilla estado={puesta ? 'todo' : 'nada'} />
      <span className="et">{persona.name}</span>
      <span className="no">
        {familia ? `${familia.name} · ` : ''}×{persona.pesoReparto}
      </span>
    </button>
  )
}

/**
 * Los tres estados de una familia, dibujados y no solo escritos: lleno = están
 * los tres, **raya** = algunos, vacío = ninguno. Es lo que hace que «2 de 3» no
 * haya que leerlo para verlo.
 */
function Casilla({ estado }) {
  return (
    <span className={`aro-fam ${estado}`} aria-hidden="true">
      {estado === 'todo' && <Icono nombre="visto" />}
      {estado === 'parte' && <span className="raya" />}
    </span>
  )
}
