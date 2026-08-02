/**
 * Un campo: su rótulo, el control, y **debajo la línea que lo explica**.
 *
 * Es la figura de `garciadoral-ops` (`campo()` en su `app.js`), y lo que la hace
 * más fina que lo que había aquí es dónde vive el estado. Antes, «qué clave hay
 * puesta» era una ficha con icono encima del formulario —tres renglones y un
 * dibujo para decir «····ab12»—; ahí el dato está **en el propio campo**: el
 * hueco dice qué hay guardado y la línea de abajo qué pasa si lo tocas o lo
 * dejas. Se lee en el sitio donde se va a escribir, que es donde se mira.
 *
 * La pista va debajo y no arriba a propósito: arriba se lee antes de saber qué
 * se está mirando, y debajo se lee justo cuando se duda.
 */
export default function Campo({ etiqueta, id, pista, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {pista && <div className="pista">{pista}</div>}
    </div>
  )
}
