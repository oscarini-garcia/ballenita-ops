/**
 * La marca: **el icono de la app**, el mismo que hay en la pantalla de inicio.
 *
 * Antes eran dos dibujos. Fuera, `assets/icon.png` —la ballena sobre la «B»—,
 * del que comen el binario de iOS (`assets:ios`) y los PNG de la web y la PWA
 * (`iconos:web`). Dentro, un trazo de `Icono` sobre la rejilla de 24, elegido
 * para que la marca heredara el color del tema. La coherencia con los iconos de
 * la interfaz salía cara: tocas un dibujo en el móvil y se abre una app con
 * otro, y el de la cabecera es justo el sitio donde se comprueba que has
 * abierto lo que querías abrir.
 *
 * Así que la marca de dentro pasa a ser la de fuera. Se sirve desde `public/`
 * —está en el build como cualquier estático, no viaja por el bundle— y va por
 * `BASE_URL` como la configuración, para que no dependa de dónde esté montada.
 * En pequeño (cabecera y lista de eventos) basta el de 192, que a 30 pt cubre
 * hasta 6×; el grande de la puerta mide 84 y pide el de 512, que a 3× son 252.
 *
 * Es un dibujo con su fondo, no un trazo: **ya no se recolorea con `--whale`**,
 * y por eso lleva su esquina redondeada — para que se lea como la loseta que es
 * y no como una foto pegada en la barra.
 */
export default function WhaleLogo({ className = '', grande = false }) {
  const base = import.meta.env?.BASE_URL ?? '/'
  return (
    <span className={`marca ${className}`}>
      <img src={`${base}icon-${grande ? 512 : 192}.png`} alt="Ballena Ops" />
    </span>
  )
}
