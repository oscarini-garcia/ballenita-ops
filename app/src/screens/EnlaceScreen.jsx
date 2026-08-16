import WhaleLogo from '../components/WhaleLogo.jsx'

/**
 * Lo que se ve mientras un enlace de acceso se canjea, y cuando no puede
 * (SPECS §14.61).
 *
 * Es la pantalla entera y no un aviso encima de la app, por lo mismo que la sala
 * de espera **es** la pantalla (§14.29 · B2): quien abre este enlace no viene a
 * usar la libreta local, viene a entrar. Enseñarle la app por detrás con un
 * cartelito delante invita a cerrarlo y a apuntar los gastos donde no van a
 * subir nunca.
 *
 * Los tres finales que no son entrar se dicen con las palabras del servidor y no
 * con un «no se pudo entrar», porque se arreglan en tres sitios distintos: uno
 * esperando a que vuelva la cobertura, otro pidiéndole otro enlace a quien lleva
 * el grupo, y el tercero hablando con quien te lo cerró. Y en los tres queda la
 * salida de abajo, que es la de siempre: la libreta local, con lo que se apunte
 * subiendo entero el día que se entre.
 */
export default function EnlaceScreen({ estado, mensaje, onReintentar, onSeguirSinEntrar }) {
  if (estado === 'yendo') {
    return (
      <div className="acceso">
        <WhaleLogo className="acceso-logo" />
        <h1 className="acceso-titulo-corto">Entrando…</h1>
        <p className="acceso-texto">Estamos comprobando tu enlace.</p>
      </div>
    )
  }

  const sinRed = estado === 'sin-respuesta'

  return (
    <div className="acceso">
      <WhaleLogo className="acceso-logo chico" />
      <h1 className="acceso-titulo-corto">
        {sinRed ? 'No hemos podido preguntar' : 'Este enlace no abre'}
      </h1>
      <p className="acceso-texto">
        {sinRed
          ? 'Parece que no hay conexión. El enlace sigue valiendo: vuelve a intentarlo cuando tengas cobertura.'
          : mensaje || 'Pídele otro a quien lleva el grupo.'}
      </p>

      {sinRed && (
        <button className="btn block" onClick={onReintentar}>Volver a intentarlo</button>
      )}

      <div className="acceso-pie">
        <button type="button" className="acceso-salida" onClick={onSeguirSinEntrar}>
          Usar solo en este navegador
        </button>
      </div>
      <p className="note">
        Sin entrar, Ballena Ops es tu libreta: todo funciona igual pero se queda aquí.
      </p>
    </div>
  )
}
