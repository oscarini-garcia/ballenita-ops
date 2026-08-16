import { useEffect, useState } from 'react'
import { estadoDePush } from '../lib/native.js'
import { asegurarPush } from '../lib/push.js'
import { ultimaSincronizacion } from '../sync/engine.js'
import { tap } from '../lib/native.js'
import {
  apuntarRecordatorio, queDecir, tocaRecordar, ultimoRecordatorio,
} from '../lib/recordatorioDeAvisos.js'

/**
 * El recordatorio de los avisos, en «Hoy» (SPECS §14.65).
 *
 * Va aquí y no en un modal al arrancar: «Hoy» es la pantalla que se abre sola y
 * la que se mira de paso, así que el recordatorio aparece **donde ya estabas**
 * en vez de ponerse delante de lo que ibas a hacer. Un modal al abrir la app se
 * cierra sin leerlo, y encima gasta el permiso —que en iOS solo se pide una vez
 * en la vida de la instalación—.
 *
 * Lo que decide qué se puede ofrecer está en `lib/recordatorioDeAvisos.js`, que
 * es puro: con el permiso sin contestar sale el botón que abre la hoja de iOS;
 * con el permiso denegado **no hay botón**, porque esa hoja ya no vuelve a
 * salir, y lo único cierto es dónde se enciende.
 */
export default function AvisoDeAvisos() {
  const [permiso, setPermiso] = useState(null)
  const [ultimo, setUltimo] = useState(ultimoRecordatorio)
  const [yendo, setYendo] = useState(false)
  const [fallo, setFallo] = useState(null)

  useEffect(() => { estadoDePush().then(setPermiso).catch(() => setPermiso('no-aplica')) }, [])

  const toca = permiso !== null && tocaRecordar({
    permiso,
    ultimo,
    estrenado: Boolean(ultimaSincronizacion()),
  })
  const dice = queDecir(permiso)
  // **Lo que falla se queda a la vista.** Encender apunta el recordatorio pase
  // lo que pase —para no dar la lata cada vez que se abre la app con algo que
  // no se arregla solo—, y eso retiraba el bloque en el mismo instante en que
  // acababa de escribir el motivo del fallo: el botón se leía como que no había
  // hecho nada. Mientras haya algo que contar, el bloque sigue ahí.
  if ((!toca && !fallo) || !dice) return null

  function posponer() {
    tap()
    const ahora = Date.now()
    apuntarRecordatorio(ahora)
    setUltimo(ahora)
  }

  /**
   * Encender. Es el camino entero —el permiso, el identificador de Apple y
   * apuntarlo en el servidor— porque los tres hacen falta para que llegue un
   * aviso, y hacer solo el primero deja «encendido» sin que llegue nada
   * (`lib/push.js`).
   */
  async function encender() {
    if (yendo) return
    tap()
    setYendo(true)
    setFallo(null)
    const { estado, motivo } = await asegurarPush()
    setPermiso(await estadoDePush().catch(() => estado))
    // Se apunta pase lo que pase: si ha ido bien el recordatorio desaparece
    // solo, y si no, no se vuelve a insistir hasta dentro de una semana.
    posponer()
    if (estado !== 'apuntado' && estado !== 'granted') {
      setFallo(motivo || 'No se ha podido encender. Mira Ajustes → Notificaciones, que lo cuenta paso a paso.')
    }
    setYendo(false)
  }

  return (
    <div className="recordar-avisos" role="status">
      <div className="ra-titulo">🔔 {dice.titulo}</div>
      <p className="ra-texto">{dice.texto}</p>
      {fallo && <pre className="traza mal">{fallo}</pre>}
      <div className="ra-verbos">
        {dice.verbo && (
          <button className="btn sm" disabled={yendo} onClick={encender}>
            {yendo ? 'Encendiendo…' : dice.verbo}
          </button>
        )}
        <button className="btn sm ghost" onClick={posponer}>Ahora no</button>
      </div>
    </div>
  )
}
