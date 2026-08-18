// Los cacharros del año: los que traiga cada familia, y se vota el mejor
// (SPECS §14.57, y §14.77 para el tope que se quitó).
//
// Vive dentro de Grupo y no en una pestaña propia porque **es de las familias**:
// lo que se pregunta es cuál ha traído cada una, y eso se lee al lado de quién
// duerme dónde. Además ya no quedaba casilla — «Gadgets» mide 83,8 pt y la
// cuarta casilla de un mando da 73,5 (`docs/diseño/siete-encargos.html` · GD2).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  cacharrosOf, addCacharro, updateCacharro, removeCacharro, familiesOf, personsOf,
} from '../db.js'
import {
  cuantosHanVotado, loQueVoto, puedeVotar, quienesPuedenVotar, ranking, votar, votosDeCacharro,
} from '../lib/cacharros.js'
import { useIdentidad } from '../lib/identidad.js'
import { porNombre } from '../lib/asignacion.js'
import { enLetras } from '../lib/dias.js'
import { tap } from '../lib/native.js'
import Alias from '../components/Alias.jsx'
import Icono from '../components/Icono.jsx'

/** «sin cacharro este año», «trae uno», «trae tres». El cero no se cuenta. */
function cuantosDeEnLetra(n) {
  if (n === 0) return 'sin cacharro este año'
  if (n === 1) return 'trae uno'
  return `trae ${enLetras(n)}`
}

export default function CacharrosSection({ eventId, event }) {
  const cacharros = useLiveQuery(() => cacharrosOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { me, meId } = useIdentidad(eventId, persons)
  // Qué familia está apuntando el suyo, o null.
  const [apuntando, setApuntando] = useState(null)
  const [texto, setTexto] = useState('')
  const [quitando, setQuitando] = useState(null)

  const famById = Object.fromEntries(families.map((f) => [f.id, f]))
  const lista = ranking(cacharros)
  const miVoto = loQueVoto(cacharros, meId)
  const pueden = quienesPuedenVotar(cacharros, persons).length
  const yaVotaron = cuantosHanVotado(cacharros, persons)
  // **Todas, siempre** (§14.77): el tope de uno por familia se quitó, así que la
  // fila de apuntar no desaparece al traer el primero. Lo que decía «sin cacharro
  // este año» ahora dice cuántos lleva, que es lo que hace falta saber para
  // decidir si añadir otro.
  const porFamilia = [...families].sort(porNombre)
  const cuantosDe = (familyId) => cacharros.filter((c) => c.familyId === familyId).length

  async function elegir(cacharroId) {
    if (!meId) return
    tap()
    for (const cambio of votar(cacharros, meId, cacharroId)) {
      await updateCacharro(cambio.id, { votos: cambio.votos })
    }
  }

  async function guardar(familyId) {
    const t = texto.trim()
    if (!t) return
    tap()
    await addCacharro(eventId, { familyId, texto: t })
    setTexto('')
    setApuntando(null)
  }

  if (families.length === 0) return null

  return (
    <>
      <div className="sec-h">
        <span>El cacharro del año</span>
        {lista.length > 0 && <span>{yaVotaron} de {pueden} han votado</span>}
      </div>

      {lista.length === 0 ? (
        <div className="note">
          🏆 Cada familia trae los cacharros que quiera y el grupo vota cuál es el mejor. Apunta
          los vuestros abajo y a votar — <b>los de tu propia familia no cuentan</b>.
        </div>
      ) : (
        <div className="card tight">
          {lista.map((c) => {
            const fam = famById[c.familyId]
            const mio = miVoto === c.id
            const puedo = puedeVotar(c, me)
            const votos = votosDeCacharro(c)
            const quienes = persons
              .filter((p) => Object.hasOwn(c.votos ?? {}, p.id))
              .map((p) => p.apodo || p.name)
            return (
              <div className="row" key={c.id}>
                <button
                  type="button"
                  className={`ico${mio ? ' verde' : ''}`}
                  aria-label={mio ? `Quitar tu voto a ${c.texto}` : `Votar ${c.texto}`}
                  aria-pressed={mio}
                  disabled={!puedo}
                  onClick={() => elegir(c.id)}
                >
                  <Icono nombre={mio ? 'visto' : 'plan'} />
                </button>
                <div className="main">
                  {/* Envuelve: un cacharro se llama «la nevera de 12 V del
                      coche» y una fila recorta por defecto (§14.50). */}
                  <div className="n envuelve">{c.texto}</div>
                  <div className="sub">
                    {fam?.name ?? 'sin familia'}
                    {fam && <Alias familia={fam} />}
                    {quienes.length > 0 && ` · ${quienes.join(', ')}`}
                    {!puedo && me && ' · es el tuyo'}
                  </div>
                </div>
                <span className="amt tnum">{votos}</span>
                <button
                  type="button"
                  className={`btn sm ghost quitar${quitando === c.id ? ' seguro' : ''}`}
                  aria-label={quitando === c.id ? `Confirmar que se quita ${c.texto}` : `Quitar ${c.texto}`}
                  onClick={() => {
                    tap()
                    if (quitando === c.id) { removeCacharro(c.id); setQuitando(null) } else setQuitando(c.id)
                  }}
                >
                  {quitando === c.id ? '¿Seguro?' : <Icono nombre="papelera" className="g" />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!meId && persons.length > 0 && (
        <div className="note">Para votar hace falta saber quién eres: tócate el <b>emoji de arriba</b> y dilo.</div>
      )}

      {porFamilia.length > 0 && (
        <div className="card tight">
          {porFamilia.map((f) => (
            <div className="row" key={f.id}>
              {apuntando === f.id ? (
                <div className="main" style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardar(f.id) }}
                    placeholder={cuantosDe(f.id) > 0 ? `Qué más trae ${f.name}…` : `Qué trae ${f.name}…`}
                    aria-label={`Cacharro de ${f.name}`}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button className="btn sm" onClick={() => guardar(f.id)} disabled={!texto.trim()}>Añadir</button>
                </div>
              ) : (
                <>
                  <div className="main">
                    <div className="n">{f.name}<Alias familia={f} /></div>
                    {/* Lo que ya trae, para no apuntar dos veces la misma nevera. */}
                    <div className="sub">{cuantosDeEnLetra(cuantosDe(f.id))}</div>
                  </div>
                  <button
                    className="btn sm ghost"
                    onClick={() => { tap(); setTexto(''); setApuntando(f.id) }}
                  >
                    {cuantosDe(f.id) > 0 ? '+ Otro' : '+ Cacharro'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quitar es **segunda pulsación y nada más** (borrar-confirmaciones.html ·
          A1): un cacharro no arrastra nada —sus votos se van con él y no mueven
          ningún saldo—, así que no hay cascada que contar y el bloque en sitio
          costaría 96 pt para decir «¿seguro?». El palmarés vive en Números, con
          lo demás que se cuenta del viaje: aquí se vota, allí se mira. */}
    </>
  )
}
