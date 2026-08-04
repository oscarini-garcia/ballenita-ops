/**
 * Un botón que le pregunta algo al modelo, y **dice que está pensando**.
 *
 * Decidido en [`docs/diseño/receta-fina.html`](../../../docs/diseño/receta-fina.html)
 * · **P1**.
 *
 * Una llamada tarda entre dos y seis segundos. Antes lo único que pasaba era que
 * los dos botones del pie se apagaban y **el de «Arreglar»** escribía «Un
 * momento…» —lo hubiera pedido él o no, porque el texto colgaba de una sola
 * variable de estado—: pulsabas «Parecidos» y contestaba su vecino. Un botón
 * gris además se lee igual que uno que todavía no se puede usar.
 *
 * Ahora lo dice el que has tocado, en su sitio y con tres puntos que laten, y el
 * otro se apaga —dos llamadas a la vez no se pueden pagar dos veces—. Cero
 * altura: la respuesta está donde acabas de tocar, que es donde miras.
 */
export default function BotonIA({ pensando = false, disabled = false, onClick, children, ...resto }) {
  return (
    <button
      type="button"
      className="btn ghost"
      // `aria-busy` y no solo el texto: quien lo oye tiene que enterarse de que
      // el botón que ha pulsado está trabajando, no de que se ha apagado.
      aria-busy={pensando || undefined}
      disabled={pensando || disabled}
      onClick={onClick}
      {...resto}
    >
      {pensando
        ? (<><span className="latido" aria-hidden="true"><i /><i /><i /></span>Pensando…</>)
        : children}
    </button>
  )
}
