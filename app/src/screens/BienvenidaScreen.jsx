import { useEffect, useRef, useState } from 'react'
import WhaleLogo from '../components/WhaleLogo.jsx'
import { ListaDePasos } from '../components/ProgresoModal.jsx'
import { tap } from '../lib/native.js'

/**
 * Lo que se ve la primera vez que entras, mientras baja lo del grupo.
 *
 * Antes aquí no había nada: al ser aceptado y entrar, la app enseñaba la lista
 * de eventos **vacía**, con «Aún no hay ningún evento. Crea uno o carga el de
 * ejemplo» y un «+ Nuevo evento» a mano. Los datos estaban en el servidor y no
 * habían bajado todavía, pero eso la pantalla no lo decía.
 *
 * El susto era lo de menos. El peligro es lo que invita a hacer: crear ahí un
 * evento **que sube al grupo** y que ya no quita nadie desde un móvil. La única
 * ventana en la que se puede ensuciar el grupo por error es exactamente esta, y
 * duraba lo que tardase la primera instantánea.
 *
 * Así que la primera vez se cuenta, con la misma **lista de pasos** que ya usan
 * Sincronización y Actualizar (SPECS §14.9-bis): si algo falla, sale el motivo
 * con su estado HTTP y un «Reintentar», que es mucho mejor que una app vacía sin
 * explicación. Se ve una vez en la vida por persona — y es justo el momento en
 * el que la app se está ganando la confianza, porque es el único en el que
 * alguien la ve vacía sin saber todavía que eso es raro.
 *
 * Ver `docs/diseño/acceso.html` · C2.
 */
export default function BienvenidaScreen({ nombre, sincronizar, onListo }) {
  const [pasos, setPasos] = useState([])
  const [fallo, setFallo] = useState(false)
  const [vuelta, setVuelta] = useState(0)

  // `sincronizar` llega desde App y cambia de identidad en cada render suyo;
  // sin esta referencia, el efecto se relanzaría solo y la primera bajada se
  // dispararía dos veces.
  const traer = useRef(sincronizar)
  traer.current = sincronizar

  useEffect(() => {
    let vivo = true
    setFallo(false)
    ;(async () => {
      const resultado = await traer.current({
        alAvanzar: (p) => { if (vivo) setPasos(p) },
      })
      if (!vivo) return
      if (resultado?.bien) onListo?.()
      else setFallo(true)
    })()
    return () => { vivo = false }
  }, [vuelta])

  return (
    <div className="acceso bienvenida">
      <WhaleLogo className="acceso-logo chico" />
      <h1 className="acceso-titulo-corto">
        {nombre ? `Ya estás dentro, ${nombre}` : 'Ya estás dentro'}
      </h1>
      <p className="acceso-texto">
        {fallo
          ? 'No hemos podido traer lo del grupo. Tus datos están a salvo en el servidor: es esta bajada la que ha fallado.'
          : 'Trayendo lo del grupo. Es solo la primera vez.'}
      </p>

      <ListaDePasos pasos={pasos} />

      {fallo && (
        <>
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => { tap(); setVuelta((v) => v + 1) }}>
            Reintentar
          </button>
          {/* La salida a mano existe porque un fallo que se repite no puede
              dejar a nadie encerrado en esta pantalla: la app funciona sin haber
              bajado nada, y lo que se apunte subirá cuando la bajada vaya. */}
          <button className="btn block ghost" onClick={() => { tap(); onListo?.() }}>
            Seguir sin esperar
          </button>
        </>
      )}
    </div>
  )
}
