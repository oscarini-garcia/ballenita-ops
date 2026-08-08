/**
 * La marca: **el icono de la app**, el mismo que se toca en la pantalla de
 * inicio.
 *
 * Antes eran dos dibujos. Dentro, un trazo de `Icono` sobre la rejilla de 24,
 * elegido para que la marca heredara el color del tema. La coherencia con los
 * iconos de la interfaz salía cara: tocas un dibujo en el móvil y se abre una
 * app con otro, y la cabecera es justo el sitio donde se comprueba que has
 * abierto lo que querías abrir.
 *
 * **Y no sale de `assets/icon.png`**, que es lo que parecía. Ese fichero —la
 * ballena sobre la «B»— es el único icono que hay en el repositorio, pero **no
 * es el que lleva el binario instalado**: quien montó la app usó otro dibujo que
 * nunca se subió aquí. Así que `assets/marca.png` es ese icono **sacado de una
 * captura de 202 px**, recortado del marco y con las esquinas devueltas a
 * cuadrado —el redondeo lo pone `.marca img`, al 22,37 % del lado, que es la
 * proporción de iOS—.
 *
 * De ahí el único tamaño: **192 px**, que es todo lo que da el original. Sobra
 * para la cabecera (30 pt, hasta 6×) y para la lista de eventos; en la puerta,
 * que mide 84, se queda a un pelo de los 252 que pediría un 3× y se nota un
 * punto blando. Se arregla solo el día que aparezca el dibujo de verdad: se pone
 * en `assets/icon.png`, se corre `npm run iconos:web` y esto pasa a comer de sus
 * PNG como todo lo demás.
 *
 * Es un dibujo con su fondo, no un trazo: **no se recolorea con `--whale`**, y
 * por eso lleva su esquina redondeada — para que se lea como la loseta que es y
 * no como una foto pegada en la barra.
 */
export default function WhaleLogo({ className = '' }) {
  const base = import.meta.env?.BASE_URL ?? '/'
  return (
    <span className={`marca ${className}`}>
      <img src={`${base}marca-192.png`} alt="Ballena Ops" />
    </span>
  )
}
