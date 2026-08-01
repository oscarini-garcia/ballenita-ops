import Icono from './Icono.jsx'

/**
 * La marca, dibujada.
 *
 * Era un emoji de ballena sobre un cuadrado azul con una «B» de marca de agua
 * detrás: un apaño que cambiaba de dibujo según el sistema, no heredaba el color
 * del tema y tenía la «B» tan apagada que no llegaba a leerse. Ahora es el mismo
 * trazo que el resto de la app (`Icono`, rejilla de 24) y se recolorea con
 * `--whale` como todo lo demás.
 *
 * El icono de la app —el de la pantalla de inicio— es otra cosa y sigue siendo
 * el SVG de `public/favicon.svg`; ese se cambia cuando haya dibujo nuevo.
 */
export default function WhaleLogo({ className = '' }) {
  return (
    <span className={`marca ${className}`} role="img" aria-label="Ballena Ops">
      <Icono nombre="ballena" />
    </span>
  )
}
