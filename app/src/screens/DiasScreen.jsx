import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, updateDinner, removeDinner,
  plansOf, updatePlan, bungasOf, familiesOf, personsOf, listDishes, addDish,
  shopItemsOf, anclaDe,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'
import Comentarios from '../components/Comentarios.jsx'
import Confirmar from '../components/Confirmar.jsx'
import ListaDePlatos from '../components/ListaDePlatos.jsx'
import { queSeLlevaUnaCena } from '../lib/borrados.js'
import { anfitrionPorBunga, vecesEnLetra } from '../lib/anfitrion.js'
import { porHora, horaValida, horaCorta, aEnPunto, SIN_HORA } from '../lib/horas.js'
import { agrupadosPorCategoria, categoriaDe, etiquetaCategoria } from '../lib/carta.js'
import { dentroDeFechas } from '../lib/evento.js'
import { votosDe, quienFaltaPorVotar, seHace } from '../lib/planes.js'
import { useIdentidad } from '../lib/identidad.js'
import { puedeOrganizar } from '../lib/personas.js'
import {
  diasDe, resumenDeDia, numeroYDia, fmtDiaLargo, fmtDiaCorto, hoyISO, titularDeCena,
  detalleDeLaCena,
  filtraOpciones,
} from '../lib/dias.js'

/**
 * «Días»: la lista de días del evento, con un resumen de cada uno.
 *
 * Opción **G1** de `docs/diseño/navegacion.html`: una fila por día, con el
 * número a la izquierda y el resumen en la línea de abajo. Es la misma `.row`
 * que ya usan Gastos y la Compra, y mide 70,7 pt: los ocho días de un viaje
 * entran de una vez en la pantalla y se ve de un vistazo cuál está libre. Una
 * tarjeta por día (G2) no cabía ni con los ocho vacíos.
 *
 * **La fila abre y no lo anuncia** (`docs/diseño/agenda-dia.html · A1`). Llevaba
 * un lápiz de 44 × 44 a la derecha —la opción H1— y se ha ido por dos razones: un
 * día **no se edita** —no es una fila de la base, existe porque el evento tiene
 * esas fechas—, así que el lápiz prometía algo que no pasa; y sus 52 pt (44 del
 * botón y 8 de margen) eran justo los que le faltaban al titular, que pasa de
 * 237 a 289 y deja de recortar «Cine de verano en la plaza». En Planes las filas
 * también son botones enteros sin galón y nadie se pierde.
 */
export default function DiasScreen({ eventId, event, abrir, onAbierta }) {
  const cenas = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const planes = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const familias = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const personas = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const platos = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])
  const [abierto, setAbierto] = useState(null)
  // Colocar el día —los platos, los bungas, qué plan— es de los adultos (SPECS
  // §14.43). El día se **abre igual**: saber qué se cena y qué se hace es la
  // mitad de la app, y esconderlo sería castigar a quien solo viene a mirar.
  const { me } = useIdentidad(eventId, personas)
  const organiza = puedeOrganizar(me)


  const dias = diasDe(event, [...cenas.map((c) => c.dia), ...planes.map((p) => p.dia)])
  // Llegar desde un aviso abre ese día (§14.60 · R2). El «id» de un día es su
  // fecha, así que no hace falta esperar a ninguna consulta: o está entre los
  // días del viaje o no está.
  useEffect(() => {
    if (!abrir) return
    if (dias.includes(abrir)) { setAbierto(abrir); onAbierta?.() }
  }, [abrir, dias.join('|')])
  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const nombreBunga = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : null }
  const hoy = hoyISO()
  /**
   * Un día que ya no cae dentro de las fechas **se aparta, no se esconde**
   * (§14.10-quater): una cena del 14 en un viaje que empieza el 15, de cuando
   * las fechas eran otras.
   *
   * Esto lo decía Comidas → Cenas, y al retirarse el área (§14.68 · N1) el
   * aviso se habría venido abajo con ella. `diasDe` solo mira `apuntados`
   * cuando el evento **no tiene fechas**, así que con fechas puestas esos días
   * no salen: la cena quedaría invisible y a la vez contando en Números y
   * ocupando bunga en el balance de anfitrión, que es justo lo que aquella
   * sección se puso para evitar.
   *
   * **Solo las cenas**, y no los planes: un plan que se cayó fuera ya tiene dos
   * sitios donde aparece —Planes lo aparta al final marcado, y `libres` lo
   * recoge en la capa de cualquier día para volver a colocarlo—, así que
   * abrirle además un día suelto sería decir lo mismo por tercera vez.
   */
  const diasFuera = [...new Set(cenas.map((c) => c.dia).filter(Boolean))]
    .filter((d) => !dias.includes(d)).sort()

  if (dias.length === 0) {
    return (
      <div className="body">
        <div className="empty">
          <span className="e">🗓️</span>
          Este evento todavía no tiene fechas.<br />
          Ponlas en Ajustes → Evento y aquí saldrá un día por cada uno.
        </div>
      </div>
    )
  }

  function filaDeDia(dia, i, total, fuera = false) {
    const cena = cenas.find((c) => c.dia === dia)
    const susPlanes = planes.filter((p) => p.dia === dia)
    const { titulo, detalle } = resumenDeDia({
      cena,
      planes: susPlanes,
      platos: (cena?.platoIds ?? []).map((id) => porId[id]).filter(Boolean),
      bungaMayores: nombreBunga(cena?.bungaMayoresId),
      esPrimero: !fuera && i === 0,
      esUltimo: !fuera && i === total - 1,
    })
    const { numero, semana } = numeroYDia(dia)
    const esHoy = dia === hoy
    /**
     * El semáforo llega a la lista (`numeros.html`, que revisa la D1 de
     * `dia-estado.html` a encargo): verde el día **completo** —cena con
     * platos, los dos bungas y algo de plan, los cuatro estados de G1—,
     * ámbar al que le falta algo.
     */
    // Se cena fuera: la cena está resuelta y **no hacen falta bungas**, que esa
    // noche no acoge nadie. Sin esto, una noche de chiringuito no se ponía
    // verde nunca por faltarle justo lo que no puede tener.
    const completo = Boolean(
      cena && susPlanes.length > 0 && (
        cena.fuera
          ? true
          : (cena.platoIds?.length ?? 0) > 0 && cena.bungaMayoresId && cena.bungaNinosId
      ),
    )
    return (
      <div className={`row fila-dia${esHoy ? ' es-hoy' : ''}`} key={dia}>
        {/* En pantalla el día es un número y tres letras; a quien no ve se
            le dice la fecha entera, y de una sola manera: el rótulo lo
            lleva el botón, no un `span` escondido al lado. */}
        <button
          className="dia-abre"
          aria-label={`${fmtDiaLargo(dia)}: ${titulo}, ${detalle}`}
          onClick={() => { tap(); setAbierto(dia) }}
        >
          <span className={`dia-num ${fuera ? 'ambar' : completo ? 'verde' : 'ambar'}`} aria-hidden>
            <b>{numero}</b><span>{semana}</span>
          </span>
          <span className="main">
            <span className="n">{titulo}</span>
            <span className="sub">{detalle}</span>
          </span>
        </button>
        {fuera && <span className="pill owe">fuera del viaje</span>}
      </div>
    )
  }

  return (
    <div className="body">
      <div className="card tight">
        {dias.map((dia, i) => filaDeDia(dia, i, dias.length))}
      </div>

      {diasFuera.length > 0 && (
        <>
          <div className="sec-h">Fuera de las fechas del viaje</div>
          <div className="note">
            {diasFuera.length === 1 ? 'Este día cae' : 'Estos días caen'} donde el evento ya no
            llega. {diasFuera.length === 1 ? 'Sigue' : 'Siguen'} contando en Números y ocupando
            bunga, así que {diasFuera.length === 1 ? 'ábrelo' : 'ábrelos'} para vaciar
            {diasFuera.length === 1 ? 'lo' : 'los'} o corrige las fechas en <b>Ajustes → Evento</b>.
          </div>
          <div className="card tight">
            {diasFuera.map((dia, i) => filaDeDia(dia, i, diasFuera.length, true))}
          </div>
        </>
      )}

      {abierto && (
        <CapaDeDia
          eventId={eventId}
          event={event}
          dia={abierto}
          cena={cenas.find((c) => c.dia === abierto)}
          planes={planes}
          bungas={bungas}
          familias={familias}
          personas={personas}
          organiza={organiza}
          platos={platos}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}


/**
 * El día, abierto en el mueble de un plan: la capa centrada de
 * `plan-voto.html` · P1, en **tres secciones** —la cena, los bungas, el plan—
 * con un renglón por pregunta (`docs/diseño/elegidores.html` · S2, que revisa
 * el R2 de `dia-abierto.html`: los bungas salen de «La cena» y llevan dos
 * filas, para que cada selector sea una sola lista).
 *
 * **Cada renglón abre su elegidor en la misma capa** (V2): el día se aparta y
 * el elegidor ocupa el centro, solo — capa sobre capa se leía como un marco
 * doble, y la app no tiene esa figura—. Como el día ya no se ve detrás, el
 * elegidor lo lleva en su cabecera.
 *
 * **Y el elegidor trabaja sobre un borrador** (C2, la figura de la hoja de
 * «Entre», §14.27): tocar marca el borrador, «Listo» escribe todo junto y
 * «Cancelar» y el fondo descartan. Esto **revisa el H1 de §14.30** —cada toque
 * escribía— porque un «Cancelar» sin borrador es un verbo que miente: la regla
 * ahora cabe en una frase, dentro de un elegidor nada es definitivo hasta
 * «Listo». La capa del día sigue sin botón global: enseña lo guardado y punto.
 * La cena sigue naciendo sola con el primer «Listo» que la necesita, con la
 * guarda de `cenaRef` para que dos seguidos no críen dos cenas.
 */
export function CapaDeDia({
  eventId, event, dia, cena, planes, bungas, familias, personas, platos,
  organiza = true, lectura: lecturaInicial = false, onClose,
}) {
  useBloqueoDeScroll()
  // Las otras cenas y la lista de la compra, para poder decir qué se lleva
  // quitar esta (§14.38): las líneas de la compra **no apuntan a su cena**
  // —salen de sumar todas—, así que la cuenta es la lista con y sin ella. Se
  // consultan aquí y no se reciben por prop porque esta capa la abren dos
  // pantallas, y «Hoy» no tiene ninguna de las dos a mano.
  const cenas = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const compra = useLiveQuery(() => shopItemsOf(eventId), [eventId], [])
  const [eligiendo, setEligiendo] = useState(null)
  // **El modo lectura** (`docs/diseño/hoy-el-dia.html` · P1): la misma capa, sin
  // elegidores y con la carta entera en vez del titular de la cena. Se abre así
  // desde «Hoy» —donde se viene a mirar— y se pasa a montar con un botón. Es una
  // sola capa y no dos pantallas parecidas que mantener a la par.
  const [lectura, setLectura] = useState(lecturaInicial)
  const tocable = organiza && !lectura
  // La cena recién nacida, antes de que la consulta viva la traiga: sin esto,
  // dos «Listo» seguidos crearían dos cenas el mismo día.
  const cenaRef = useRef(null)

  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const elegidos = (cena?.platoIds ?? []).map((id) => porId[id]).filter(Boolean)
  const nPlatos = cena?.platoIds?.length ?? 0
  // **En orden** (§14.73 · S1): los que tienen hora primero, los sueltos al final.
  const delDia = porHora(planes.filter((p) => p.dia === dia))
  /**
   * Libres son los que no tienen día **y los que se quedaron fuera de las
   * fechas** (§14.10-quater · opción D2): lo que cae fuera se aparta, no se
   * esconde.
   */
  const libres = planes.filter((p) => !p.dia || !dentroDeFechas(p.dia, event))

  async function escribeCena(campos) {
    const id = cena?.id ?? cenaRef.current
    if (id) await updateDinner(id, campos)
    else cenaRef.current = await addDinner(eventId, { dia, ...campos })
  }

  async function quitarCena() {
    const id = cena?.id ?? cenaRef.current
    if (id) await removeDinner(id)
    cenaRef.current = null
    setEligiendo(null)
  }

  const notaDePlan = (p) => {
    if (p.dia === dia) {
      // Sin hora se dice, porque es lo que explica por qué está al final.
      if (!horaValida(p.hora)) {
        const votos = seHace(p) ? 'Se hace' : `${votosDe(p)} 👍 · ${quienFaltaPorVotar(p, personas)}`
        return `${SIN_HORA} · ${votos}`
      }
      return seHace(p) ? 'Se hace'
        : `${votosDe(p)} 👍 · ${quienFaltaPorVotar(p, personas)}`
    }
    if (p.dia) return `era el ${fmtDiaCorto(p.dia)}, fuera del viaje`
    return `${votosDe(p)} 👍 · ${quienFaltaPorVotar(p, personas)}`
  }

  // El renglón de un bunga dice la casa y de quién es (elegidores.html · S2).
  // En masculino, que es como habla el grupo: «El del ruido», «+ Bunga nuevo…».
  // Sin permiso para colocar, la pista no puede decir «toca»: sería un renglón
  // que promete un gesto que no ocurre.
  const filaBunga = (id, quien) => {
    const b = bungas.find((x) => x.id === id)
    const f = b && familias.find((x) => x.id === b.familyId)
    return {
      elegido: Boolean(b),
      n: b ? `${quien} · ${b.alias || b.name}` : quien,
      s: b
        ? (f ? `el de los ${f.name}` : (tocable ? 'toca para cambiarlo' : 'sin familia'))
        : (tocable ? 'toca para elegir el bunga' : 'sin elegir'),
    }
  }
  const may = filaBunga(cena?.bungaMayoresId, 'Mayores')
  const nin = filaBunga(cena?.bungaNinosId, 'Niños')

  // La mesa de niños con lista propia **se dice en el día** (§14.68 · K1):
  // vive dentro del elegidor, así que sin esto habría que abrirlo para saber si
  // esa noche cenan otra cosa. Mientras hereden no se dice nada: es lo que pasa
  // siete noches de ocho, y repetirlo en todas es un renglón que nadie lee.
  const ninosAparte = (cena?.platoIdsNinos ?? null) !== null
  const platosNinos = (cena?.platoIdsNinos ?? []).map((id) => porId[id]).filter(Boolean)
  // Se cena fuera: no faltan platos, así que el renglón no los reclama — y con
  // el sitio en blanco dice lo único que queda por decidir.
  const seCenaFuera = Boolean(cena?.fuera)
  // **Se nombra en vez de contar** (§14.76): decía «dos platos · los niños, otra
  // cosa» en la pantalla a la que se entra a saber qué se cena. La composición
  // es pura y vive en `lib/dias.js`, con los dos renglones separados: juntos se
  // van a tres líneas en Enorme.
  const { resto: subCena, ninos: subNinos } = detalleDeLaCena({
    cena, platos: elegidos, platosNinos, ninosAparte, tocable,
  })
  // Mirando, el renglón del plan no cuenta lo que se podría traer: eso es una
  // tarea de montar el día, no un dato de lo que se hace hoy.
  const subPlanes = !tocable ? 'sin plan todavía'
    : libres.length
      ? `${libres.length} ${libres.length === 1 ? 'plan libre' : 'planes libres'} por traer`
      : 'ningún plan libre — nacen en Planes'
  const sinNadaQueTraer = delDia.length === 0 && libres.length === 0

  // El fondo, con un elegidor abierto, es su «Cancelar»: descarta y vuelve al
  // día. Sin elegidor, cierra el día — que no tiene nada que perder (C2).
  const fondo = () => { if (eligiendo) setEligiendo(null); else onClose() }

  /**
   * Un renglón del día. Con permiso es el botón que abre su elegidor; sin él,
   * la misma fila **sin gesto detrás** — la figura de Gastos con un niño
   * (§14.41): lo que se dice se queda, el verbo se va. No es un `disabled`
   * porque una fila apagada se lee como una avería, y aquí no falta nada:
   * simplemente no te toca a ti colocar el día.
   */
  const renglon = ({ icono, verde, n, s, s2 = null, abre, apagado = false, clave, hora = null }) => {
    const cuerpo = (
      <>
        {/* **La hora ocupa el sitio del icono** (`plan-con-hora.html` · V3): en
            columna y siempre en la misma x, que es lo único que deja leer cuatro
            horas seguidas sin pararse en cada una. Es la figura de la casilla del
            número en la lista de Días, y el icono que sustituye es una chincheta
            igual en los cuatro. Sin hora se queda el icono. */}
        {hora
          ? <div className="ico-hora" aria-hidden><b>{horaCorta(hora)}</b></div>
          : <div className={`ico ${verde ? 'verde' : 'ambar'}`}><Icono nombre={icono} /></div>}
        <div className="main">
          <div className="n">{n}</div>
          {/* Sin nada que decir el renglón no se pinta: un `div` vacío ocupa su
              línea igual (§14.74). `s2` es el segundo, que hoy solo usa la cena
              para la mesa de los niños. */}
          {s && <div className="sub">{s}</div>}
          {s2 && <div className="sub">{s2}</div>}
        </div>
      </>
    )
    if (!tocable) return <div className="row fila-capa" key={clave}>{cuerpo}</div>
    return (
      <button
        key={clave}
        className="row fila-boton fila-capa"
        disabled={apagado}
        onClick={() => { tap(); setEligiendo(abre) }}
      >
        {cuerpo}
      </button>
    )
  }

  return (
    <div className="modal-bg center" onClick={fondo}>
      <div className="modal center formulario" onClick={(e) => e.stopPropagation()}>
        {!eligiendo && (
          <>
            <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
            <h2 className="modal-dia-t">{fmtDiaLargo(dia)}</h2>

            {/* El semáforo (dia-estado.html · E1 · K4 · G1): cada icono dice si
                su renglón ya tiene algo elegido. Verde de Planes; el vacío en
                ámbar —pendiente—, no en rojo, que aquí significa deuda. */}
            <div className="sec-h" style={{ marginTop: 10 }}>La cena</div>
            <div className="card tight" style={{ marginTop: 6 }}>
              {/* Mirando, la carta entera (L2); montando, el titular y su
                  flecha — que es el botón que abre el elegidor. */}
              {lectura && nPlatos > 0 && !seCenaFuera
                ? <ListaDePlatos platos={elegidos} />
                : renglon({
                  icono: 'restaurante',
                  // Una cena fuera está **decidida**: verde aunque no haya
                  // sitio, que el sitio es un detalle y no la decisión.
                  verde: nPlatos > 0 || seCenaFuera,
                  n: titularDeCena(cena ?? null, elegidos),
                  s: subCena,
                  s2: subNinos,
                  abre: 'platos',
                  clave: 'cena',
                })}
              {/* Mirando, la carta de los niños entera: es la pantalla a la que
                  se viene a saber qué se cena, y «otra cosa» no lo contesta. */}
              {lectura && ninosAparte && !seCenaFuera && (
                <>
                  <div className="grupo-cat">Los niños</div>
                  {platosNinos.length > 0
                    ? <ListaDePlatos platos={platosNinos} />
                    : <div className="apunte">Comen otra cosa, sin apuntar todavía.</div>}
                </>
              )}
            </div>

            {/* **O se cena fuera, o se reparten bungas** (§14.70-bis): son
                alternativas, no dos preguntas del mismo día. Esa noche no acoge
                nadie, así que los dos renglones se retiran enteros en vez de
                quedarse pidiendo algo que no se puede contestar — que es como
                estaban desde §14.70, ámbar y perpetuamente a medias.
                Lo elegido **no se borra**: vuelve entero al volver al camping,
                igual que los platos. Lo que se retira es la pregunta. */}
            {!seCenaFuera && (
              <>
                <div className="sec-h" style={{ marginTop: 6 }}>Los bungas</div>
                <div className="card tight" style={{ marginTop: 6 }}>
                  {renglon({ icono: 'casa', verde: may.elegido, n: may.n, s: may.s, abre: 'mayores', clave: 'mayores' })}
                  {renglon({ icono: 'casa', verde: nin.elegido, n: nin.n, s: nin.s, abre: 'ninos', clave: 'ninos' })}
                </div>
              </>
            )}

            {/* **Un renglón por plan** (§14.71). Era uno solo que decía «Torneo
                de pingpong comunitario y tres más», así que de cuatro planes se
                veía **uno**: para saber los otros tres había que abrir el
                elegidor, que es la herramienta de cambiarlos y no la de mirar.
                Es la misma corrección que §14.69 hizo en la lista de Días
                —nombrar en vez de contar—, que allí no cabía en la fila y aquí
                sí: la capa rueda y un plan más son 56,4 pt.
                Cada uno abre el mismo elegidor, así que «cada renglón abre su
                elegidor» se sigue cumpliendo, y cada uno lleva **su** nota: con
                el renglón único, los votos solo salían cuando había un plan. */}
            <div className="sec-h" style={{ marginTop: 6 }}>
              {delDia.length > 1 ? 'Los planes' : 'El plan'}
            </div>
            <div className="card tight" style={{ marginTop: 6 }}>
              {delDia.length === 0
                ? renglon({
                  icono: 'plan',
                  verde: false,
                  n: 'Nada apuntado',
                  s: subPlanes,
                  abre: 'planes',
                  apagado: sinNadaQueTraer,
                  clave: 'sin-plan',
                })
                : delDia.map((p) => renglon({
                  clave: p.id,
                  icono: 'plan',
                  verde: true,
                  hora: horaValida(p.hora) ? p.hora : null,
                  n: p.titulo,
                  s: notaDePlan(p),
                  abre: 'planes',
                }))}
            </div>

            {/* **El tercer sitio del hilo** (§14.55): el día es donde se
                coordina —«¿a qué hora salimos?», «yo llego tarde»— y la capa ya
                existía. Se ancla a la fecha y no a la cena ni al plan: lo que se
                habla de un día sigue valiendo aunque se cambie la cena. */}
            <Comentarios eventId={eventId} ancla={anclaDe('dia', dia)} titulo="Comentarios del día" />

            {/* La salida del modo lectura: la misma capa se pone a montar sin
                cerrarse ni cambiar de sitio. Quien no organiza no la ve. */}
            {lectura && organiza && (
              <button
                type="button"
                className="ver-todos"
                onClick={() => { tap(); setLectura(false) }}
              >
                Montar este día
              </button>
            )}

            {!lectura && (
            <div className="note" style={{ marginTop: 12 }}>
              {organiza ? (
                <>
                  Cada renglón abre su elegidor, y nada cambia hasta su <b>«Listo»</b>. Los planes se
                  <b> votan</b> en Planes; aquí se colocan.
                </>
              ) : (
                <>
                  🐳 El día lo colocan los adultos: los platos, los bungas y el plan. <b>Votar</b> los
                  planes sí es de todos, en Planes.
                </>
              )}
            </div>
            )}
          </>
        )}

        {eligiendo === 'platos' && (
          <ElegidorDePlatos
            dia={dia}
            platos={platos}
            evento={event}
            inicial={cena?.platoIds ?? []}
            inicialNinos={cena?.platoIdsNinos ?? null}
            inicialFuera={Boolean(cena?.fuera)}
            inicialDonde={cena?.donde ?? ''}
            hayCena={Boolean(cena || cenaRef.current)}
            queSeLleva={queSeLlevaUnaCena(cena ?? { id: cenaRef.current }, {
              dia: fmtDiaLargo(dia), platos, cenas, personas, lineas: compra,
            })}
            onQuitarCena={quitarCena}
            onCancelar={() => setEligiendo(null)}
            onListo={async (ids, idsNinos, sitio) => {
              // Sin cena y sin nada marcado no hay nada que escribir: un
              // «Listo» vacío no cría una cena vacía. Y un «Listo» sin cambios
              // no encola un cambio que no cambia nada.
              const antes = cena?.platoIds ?? []
              const antesNinos = cena?.platoIdsNinos ?? null
              const mismaLista = (a, b) => (
                a === null || b === null
                  ? a === b
                  : a.length === b.length && a.every((x) => b.includes(x))
              )
              const fuera = sitio?.fuera ? 1 : 0
              const donde = (sitio?.donde ?? '').trim()
              const igualFuera = fuera === (cena?.fuera ? 1 : 0) && donde === (cena?.donde ?? '').trim()
              const igual = mismaLista(ids, antes) && mismaLista(idsNinos, antesNinos) && igualFuera
              // Decir «se cena fuera» **cría la cena** aunque no haya ni un
              // plato: es una decisión tomada, no un hueco vacío.
              const hayAlgo = ids.length > 0 || idsNinos !== null || fuera || cena || cenaRef.current
              if (!igual && hayAlgo) {
                await escribeCena({ platoIds: ids, platoIdsNinos: idsNinos, fuera, donde })
              }
              setEligiendo(null)
            }}
          />
        )}

        {(eligiendo === 'mayores' || eligiendo === 'ninos') && (
          <ElegidorDeBunga
            titulo={eligiendo === 'mayores' ? 'Bunga mayores' : 'Bunga niños'}
            dia={dia}
            bungas={bungas}
            familias={familias}
            inicial={(eligiendo === 'mayores' ? cena?.bungaMayoresId : cena?.bungaNinosId) ?? null}
            veces={anfitrionPorBunga(cenas, { excepto: dia })}
            onCancelar={() => setEligiendo(null)}
            onListo={async (id) => {
              const campo = eligiendo === 'mayores' ? 'bungaMayoresId' : 'bungaNinosId'
              const antes = (eligiendo === 'mayores' ? cena?.bungaMayoresId : cena?.bungaNinosId) ?? null
              // «Ninguna» en un día sin cena no cría una cena vacía, y repetir
              // lo puesto no encola nada.
              if (id !== antes && (id !== null || cena || cenaRef.current)) await escribeCena({ [campo]: id })
              setEligiendo(null)
            }}
          />
        )}

        {eligiendo === 'planes' && (
          <ElegidorDePlanes
            dia={dia}
            delDia={delDia}
            libres={libres}
            notaDePlan={notaDePlan}
            onCancelar={() => setEligiendo(null)}
            onListo={async (ids, horas = {}) => {
              // El diff contra lo guardado: lo desmarcado vuelve a libres y lo
              // marcado nuevo se coloca. Lo que no cambió no se toca — no se
              // encolan cambios que no cambian nada.
              //
              // El instante (`cuando`) ya no se calcula aquí: desde §14.75 lo
              // pone `updatePlan` con la hora ya redondeada, que es el único
              // sitio donde no se puede olvidar. Cambiar la hora **no borra
              // `avisadoEl`** —no se puede tocar desde el cliente—, así que
              // mover una hora ya avisada no vuelve a avisar. Queda en el spec.
              const horaDe = (p) => (horaValida(horas[p.id]) ? aEnPunto(horas[p.id]) : null)
              for (const p of delDia) {
                if (!ids.has(p.id)) { await updatePlan(p.id, { dia: null, hora: null }); continue }
                const hora = horaDe(p)
                if ((p.hora ?? null) !== hora) await updatePlan(p.id, { hora })
              }
              for (const p of libres) {
                if (!ids.has(p.id)) continue
                await updatePlan(p.id, { dia, hora: horaDe(p) })
              }
              setEligiendo(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * El armazón de un elegidor (`elegidores.html` · C2 · V2): sustituye al día en
 * la misma capa, lleva el día en su cabecera —ya no se ve detrás— y sale por
 * los dos verbos de siempre, abajo y en azul (§14.27-bis): «Cancelar» descarta
 * y «Listo» confirma. El borrador vive en el elegidor concreto; desmontarlo es
 * descartarlo, así que el fondo cancela gratis.
 */
function Elegidor({ titulo, dia, buscador = null, onCancelar, onListo, children }) {
  return (
    <>
      <h2>{titulo}</h2>
      <div className="pista">{fmtDiaLargo(dia)}</div>
      {buscador}
      {children}
      <div className="salida">
        <button type="button" className="btn ghost" onClick={() => { tap(); onCancelar() }}>Cancelar</button>
        <button type="button" className="btn" onClick={() => { tap(); onListo() }}>Listo</button>
      </div>
    </>
  )
}

/**
 * El campo de buscar, siempre a la vista (`elegidores.html` · L3) y **sin robar
 * el foco** (§14.24): el teclado no sale hasta tocarlo. Lo llevan los
 * elegidores de platos y de planes; el de bungas no (L1) — tres casas no se
 * buscan.
 */
function Buscador({ valor, onCambio, etiqueta }) {
  return (
    <input
      type="search"
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      placeholder="Buscar…"
      aria-label={etiqueta}
      style={{ marginTop: 10 }}
    />
  )
}

/**
 * Los platos de la cena, con **dos mesas y un alta al vuelo**
 * (`docs/diseño/cenas-fuera-y-reparto.html` · H3 · K1).
 *
 * Las dos cosas llegan aquí porque Comidas → Cenas se retiró y era el único
 * sitio que las tenía (N1). Ninguna es una mudanza literal:
 *
 * **H3 · el buscador ofrece crear.** Cero controles en reposo: el verbo sale
 * solo cuando lo que se busca no existe, con el nombre ya escrito. Se descartó
 * el formulario de alta permanente que tenía «Cenas» —nombre más las cinco
 * categorías, siempre desplegado— porque aquí no cabe y porque hace falta una
 * vez de cada veinte. **El plato nace sin categoría** y sin receta: se completa
 * en Comidas → Carta, y por eso la lista lo coloca en «Sin tipo».
 *
 * **El alta escribe en el catálogo aunque luego se cancele**, y es a propósito:
 * un plato es del grupo y de todos los viajes, no de esta cena. Lo que el
 * borrador de §14.31 protege es *qué se cena hoy* —eso sí se descarta con
 * «Cancelar»—, no el catálogo. Si se aplazara hasta «Listo» habría que guardar
 * un plato a medio nacer dentro del borrador y perderlo al cancelar, que es
 * justo lo que se siente como que la app pierde cosas.
 *
 * **K1 · la mesa de niños, con un segmentado y no dos listas seguidas.** La
 * hoja aceptaba «dos listas», y dibujadas una debajo de otra son dos catálogos
 * enteros en una capa cuyo tope son 658,3 pt: para llegar a la segunda hay que
 * pasar por toda la primera. Las dos listas siguen estando —es lo que se
 * eligió— pero se enseña una cada vez, y el buscador y el orden sirven a las
 * dos. Mientras los niños hereden no hay segmentado ni nada que leer: `null` es
 * «comen lo mismo», que es la noche normal, y solo está el verbo de una línea.
 */
function ElegidorDePlatos({
  dia, platos, evento, inicial, inicialNinos, inicialFuera, inicialDonde,
  hayCena, queSeLleva, onQuitarCena, onCancelar, onListo,
}) {
  const [marcados, setMarcados] = useState(() => new Set(inicial))
  // `null` = los niños comen lo mismo. Es lo de fábrica porque separar las dos
  // listas cuesta un toque y no separarlas, ninguno.
  const [ninos, setNinos] = useState(() => (inicialNinos ? new Set(inicialNinos) : null))
  const [mesa, setMesa] = useState('mayores')
  // **Se cena fuera, y dónde** (§14.70). Va en el borrador como todo lo demás:
  // marcarlo no escribe nada hasta «Listo» (§14.31).
  const [fuera, setFuera] = useState(Boolean(inicialFuera))
  const [donde, setDonde] = useState(inicialDonde ?? '')
  const [busca, setBusca] = useState('')
  const [quitando, setQuitando] = useState(false)
  const [creando, setCreando] = useState(false)

  const enNinos = mesa === 'ninos' && ninos
  const activos = enNinos ? ninos : marcados
  const ponActivos = enNinos ? setNinos : setMarcados

  const opciones = platos.map((p) => ({
    id: p.id,
    etiqueta: `${p.name}${p.esFavorito ? ' ⭐' : ''}`,
    nota: etiquetaCategoria(categoriaDe(p)),
    plato: p,
  }))
  const visibles = filtraOpciones(opciones, busca)
  // **Lo puesto arriba, y el resto por categorías** (`hoy-el-dia.html` · E3).
  // Con nueve platos y tres marcados, los tres estaban repartidos por la lista y
  // quitar uno pedía buscarlo; y montar un menú es elegir un principal y un
  // postre, no recorrer un catálogo. Los marcados **no se sacan del grupo al
  // marcarlos**: la lista se recompone al abrirla, no bajo el dedo — un plato
  // que salta de sitio al tocarlo es la peor sorpresa de una lista. Cada mesa
  // congela la suya: al pasar a la de niños, «esta cena» es lo suyo.
  const [puestos] = useState(() => ({
    mayores: new Set(inicial),
    ninos: new Set(inicialNinos ?? inicial),
  }))
  const susPuestos = puestos[enNinos ? 'ninos' : 'mayores']
  const arriba = visibles.filter((o) => susPuestos.has(o.id))
  const grupos = agrupadosPorCategoria(visibles.filter((o) => !susPuestos.has(o.id)).map((o) => o.plato))
    .map((g) => ({ ...g, opciones: g.platos.map((p) => visibles.find((o) => o.id === p.id)) }))

  // El nombre tecleado no existe **exactamente** en el catálogo. Se mira sobre
  // `visibles` y no sobre el texto: escribir «tortilla» con «Tortilla de patata»
  // puesta no es querer crear nada, es estar buscándola.
  const aCrear = busca.trim()
  const puedeCrear = aCrear.length > 0 && visibles.length === 0

  const fila = (o, conNota) => (
    <button
      key={o.id}
      type="button"
      className="eleccion-op"
      aria-pressed={activos.has(o.id)}
      onClick={() => { tap(); alternar(o.id) }}
    >
      <span className="et">{o.etiqueta}</span>
      {conNota && o.nota && <span className="no">{o.nota}</span>}
      {activos.has(o.id) && <span className="tic"><Icono nombre="visto" /></span>}
    </button>
  )

  function alternar(id) {
    const s = new Set(activos)
    s.has(id) ? s.delete(id) : s.add(id)
    ponActivos(s)
  }

  async function crearYMarcar() {
    if (!puedeCrear || creando) return
    setCreando(true)
    try {
      const id = await addDish({ name: aCrear, categorias: [] }, evento)
      ponActivos(new Set([...activos, id]))
      setBusca('')
    } finally {
      setCreando(false)
    }
  }

  return (
    <Elegidor
      titulo={fuera ? 'Esta noche se cena fuera' : enNinos ? 'Los platos de los niños' : 'Los platos de esta cena'}
      dia={dia}
      buscador={fuera ? null : <Buscador valor={busca} onCambio={setBusca} etiqueta="Buscar un plato" />}
      onCancelar={onCancelar}
      onListo={() => onListo([...marcados], ninos ? [...ninos] : null, { fuera, donde })}
    >
      {/* **Se cena fuera** (§14.70): sustituye a la lista en vez de convivir con
          ella. Elegir platos y decir que se sale son la misma decisión con dos
          respuestas, y enseñadas a la vez el elegidor pediría leer para saber
          cuál manda. Lo marcado **no se borra**: se queda por si se vuelve. */}
      {fuera ? (
        <>
          <label htmlFor="donde-se-cena" style={{ marginTop: 10 }}>¿Dónde?</label>
          <input
            id="donde-se-cena"
            type="text"
            value={donde}
            onChange={(e) => setDonde(e.target.value)}
            placeholder="El chiringuito de Paco"
          />
          <div className="apunte" style={{ marginTop: 8 }}>
            Se puede dejar en blanco: que se sale ya es la noticia, y el sitio se
            pone cuando se sepa. Esta noche no entra en la lista de la compra.
          </div>
          <button
            type="button"
            className="btn sm ghost block"
            style={{ marginTop: 12 }}
            onClick={() => { tap(); setFuera(false) }}
          >
            Cenamos en el camping
          </button>
        </>
      ) : (
      <>
      {ninos && (
        <div className="segmentado" role="group" aria-label="Qué mesa" style={{ marginTop: 10 }}>
          <button
            type="button"
            className={mesa === 'mayores' ? 'on' : ''}
            onClick={() => { tap(); setMesa('mayores') }}
          >
            Mayores<span className="peso">{marcados.size}</span>
          </button>
          <button
            type="button"
            className={mesa === 'ninos' ? 'on' : ''}
            onClick={() => { tap(); setMesa('ninos') }}
          >
            Niños<span className="peso">{ninos.size}</span>
          </button>
        </div>
      )}
      {platos.length === 0 && !puedeCrear && (
        <div className="note" style={{ marginTop: 10 }}>
          El catálogo está vacío. Escribe arriba el nombre de un plato y sale el botón de crearlo.
        </div>
      )}
      {/* H3: el verbo con el nombre ya escrito, donde estaba el «no hay nada». */}
      {puedeCrear && (
        <button
          type="button"
          className="renglon-mas"
          style={{ marginTop: 10 }}
          disabled={creando}
          onClick={() => { tap(); crearYMarcar() }}
        >
          {creando ? 'Creando…' : `Crear «${aCrear}» y marcarlo`}
        </button>
      )}
      {platos.length > 0 && visibles.length === 0 && (
        <div className="apunte" style={{ marginTop: 10 }}>
          Ningún plato se llama así. Nacerá sin tipo: se le pone en Comidas → Carta.
        </div>
      )}
      {arriba.length > 0 && (
        <>
          <div className="grupo-cat puesto">Esta cena · {arriba.length}</div>
          <div className="eleccion">{arriba.map((o) => fila(o, true))}</div>
        </>
      )}
      {grupos.map((g) => (
        <div key={g.id ?? 'sueltos'}>
          <div className="grupo-cat">{g.label}</div>
          <div className="eleccion">{g.opciones.map((o) => fila(o, false))}</div>
        </div>
      ))}
      {/* K1: mientras hereden, una línea; con lista propia, cómo deshacerlo.
          El verbo arranca de lo que comen los mayores, que es de donde se parte
          para decir «los niños, esto no». */}
      {!ninos ? (
        <button
          type="button"
          className="renglon-mas"
          style={{ marginTop: 10 }}
          onClick={() => { tap(); setNinos(new Set(marcados)); setMesa('ninos') }}
        >
          Los niños comen otra cosa…
        </button>
      ) : (
        <button
          type="button"
          className="btn sm ghost block"
          style={{ marginTop: 10 }}
          onClick={() => { tap(); setNinos(null); setMesa('mayores') }}
        >
          Que los niños coman lo mismo
        </button>
      )}
      <div className="apunte" style={{ marginTop: 10 }}>
        Los platos se corrigen —tipo, receta e ingredientes— en Comidas → Carta.
      </div>
      <button
        type="button"
        className="renglon-mas"
        style={{ marginTop: 10 }}
        onClick={() => { tap(); setFuera(true) }}
      >
        Esta noche se cena fuera…
      </button>
      </>
      )}
      {/* Quitar la cena vive aquí, con segunda pulsación (dia-abierto.html ·
          H1). Es la única salida del elegidor que escribe sin «Listo»: es un
          verbo con su propia confirmación, no parte del borrador.
          **Y dice qué se lleva** (§14.38): la frase la compone
          `queSeLlevaUnaCena`, que cuenta las líneas de la compra que se caen
          —hay que calcularlo, porque una línea no apunta a su cena—. Esto lo
          decía Comidas → Cenas con el mismo `Confirmar`; al retirarse el área
          (§14.68 · N1) el renglón de aquí se habría quedado con su frase a
          mano, que nombra los platos y las bungas y **calla la compra**. */}
      {hayCena && (quitando ? (
        <div style={{ marginTop: 10 }}>
          <Confirmar
            queSeLleva={queSeLleva}
            dejarlo="Dejarla"
            borrar="Sí, quitarla"
            onDejarlo={() => { tap(); setQuitando(false) }}
            onBorrar={() => { tap(); onQuitarCena() }}
          />
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn sm ghost danger-texto block"
            onClick={() => { tap(); setQuitando(true) }}
          >
            Quitar la cena de este día
          </button>
        </div>
      ))}
    </Elegidor>
  )
}

/**
 * Un bunga, una lista (`elegidores.html` · S2 · B1): la familia manda y el
 * alias queda de seña — «¿cuál era el de los Pérez?» se contesta sin saberse
 * los motes—. Un bunga sin familia dueña se queda con su alias. Sin buscador
 * (L1): tres casas no se buscan.
 */
function ElegidorDeBunga({ titulo, dia, bungas, familias, inicial, veces, onCancelar, onListo }) {
  const [valor, setValor] = useState(inicial)

  /**
   * **Cuántas veces ha acogido cada uno** (§14.72). La pregunta que se hace al
   * abrir esto no es «¿cuál es cuál?» sino **«¿a quién le toca?»**, y hasta hoy
   * se contestaba de memoria o yéndose a Números —a otra sección, perdiendo el
   * día a medio montar—.
   *
   * Va en el renglón de abajo junto al alias, que es donde había sitio, y **sin
   * la noche que se está decidiendo** (`excepto`): contarla inflaría a quien ya
   * está puesto y la cuenta dejaría de contestar lo que se le pregunta.
   */
  const cuenta = (id) => vecesEnLetra(veces?.get(id)?.total ?? 0)

  const opciones = [
    { id: null, etiqueta: 'Ninguno', familia: null, nota: null },
    ...bungas.map((b) => {
      const f = familias.find((x) => x.id === b.familyId)
      // Con familia el alias es la seña y la cuenta va detrás; sin ella el alias
      // ya titula, así que el renglón de abajo es la cuenta y nada más.
      return f
        ? { id: b.id, etiqueta: f.name, familia: f, nota: `${b.alias || b.name} · ${cuenta(b.id)}` }
        : { id: b.id, etiqueta: b.alias || b.name, familia: null, nota: cuenta(b.id) }
    }),
  ]

  return (
    <Elegidor titulo={titulo} dia={dia} onCancelar={onCancelar} onListo={() => onListo(valor)}>
      <div className="eleccion" style={{ marginTop: 12 }}>
        {opciones.map((o) => (
          <button
            key={o.id ?? 'ninguno'}
            type="button"
            className="eleccion-op"
            onClick={() => { tap(); setValor(o.id) }}
          >
            {/* La pastilla de dos letras con el color de la familia
                (numeros.html · decidido 2): la firma de Ideas, aquí de seña. */}
            <span className="et">{o.etiqueta} {o.familia && <Alias familia={o.familia} />}</span>
            {o.nota && <span className="no">{o.nota}</span>}
            {(o.id ?? null) === (valor ?? null) && <span className="tic"><Icono nombre="visto" /></span>}
          </button>
        ))}
      </div>
    </Elegidor>
  )
}

/**
 * La hora de un plan: **menos, la cifra y más** (`hora-que-quepa.html` · S4).
 *
 * Sustituye al `<input type="time">`, que sacaba el disco del sistema: dos
 * rodillos y 1.440 posiciones para una decisión de 24, con las 20:45 tan fáciles
 * de poner sin querer como las 20:00 porque el segundo rodillo arranca donde
 * esté el reloj del móvil. Esto **no sabe escribir un minuto**.
 *
 * **Da la vuelta en los dos extremos** (23h → 0h y 0h → 23h): sin eso, un plan
 * de medianoche desde las 20h no se puede poner subiendo, y el camino más corto
 * entre dos horas cualesquiera nunca pasa de doce toques. Es lo que le quita
 * hierro al coste conocido de S4 — que llegar es a pulsos.
 *
 * Sin hora puesta no hay cifra que mover, así que sale un botón que la pone en
 * **12h**: es el punto del día desde el que ninguna hora queda a más de doce
 * toques, y desde el que las de un camping —la playa por la mañana, la cena por
 * la noche— quedan a cuatro y a ocho.
 */
function RenglonDeHora({ etiqueta, hora, onCambio }) {
  const n = horaValida(hora) ? Number(hora.slice(0, 2)) : null
  const mover = (d) => { tap(); onCambio(`${String((n + d + 24) % 24).padStart(2, '0')}:00`) }
  // El rótulo es un `span` y no un `label`: un `label` con `htmlFor` le pone su
  // texto de nombre accesible al control, y «Poner hora» pasaba a llamarse «A
  // las». El grupo lleva el nombre, que es lo que hay que leer aquí.
  const rotulo = <span className="rotulo">A las</span>

  if (n === null) {
    return (
      <div className="reng-hora" role="group" aria-label={`Hora de ${etiqueta}`}>
        {rotulo}
        <button type="button" className="btn sm ghost" onClick={() => { tap(); onCambio('12:00') }}>
          Poner hora
        </button>
      </div>
    )
  }
  return (
    <div className="reng-hora" role="group" aria-label={`Hora de ${etiqueta}`}>
      {rotulo}
      <button type="button" className="paso" aria-label="Una hora antes" onClick={() => mover(-1)}>−</button>
      <span className="cifra-hora" aria-live="polite">{horaCorta(hora)}</span>
      <button type="button" className="paso" aria-label="Una hora después" onClick={() => mover(1)}>+</button>
      <button type="button" className="btn sm ghost" onClick={() => { tap(); onCambio(null) }}>Quitar</button>
    </div>
  )
}

function ElegidorDePlanes({ dia, delDia, libres, notaDePlan, onCancelar, onListo }) {
  const [marcados, setMarcados] = useState(() => new Set(delDia.map((p) => p.id)))
  /**
   * **La hora, y solo la de los que están puestos en este día** (§14.73).
   *
   * Va aquí y no en la ficha del plan porque una hora es del **día**, no de la
   * idea: «Kayak» no es a las diez, es a las diez *el martes*. Y por eso el
   * campo sale al marcarlo y desaparece al desmarcarlo — un plan que vuelve a
   * libres no tiene hora que guardar.
   *
   * Es borrador como todo lo del elegidor (§14.31): se escribe en «Listo».
   */
  // El borrador arranca **ya redondeado** (§14.75): un «23:46» guardado entra
  // como «23:00», así que abrir el día y dar a «Listo» lo deja en punto sin que
  // haya que tocar nada. Es la mitad de la normalización que se ve; la otra la
  // hace `redondearHorasDePlanes` al arrancar, para los días que nadie abra.
  const [horas, setHoras] = useState(() => (
    Object.fromEntries(delDia.filter((p) => horaValida(p.hora)).map((p) => [p.id, aEnPunto(p.hora)]))
  ))
  const [busca, setBusca] = useState('')

  const todos = [...delDia, ...libres]
  const opciones = todos.map((p) => ({ id: p.id, etiqueta: p.titulo, nota: notaDePlan(p) }))
  const visibles = filtraOpciones(opciones, busca)

  function alternar(id) {
    const s = new Set(marcados)
    s.has(id) ? s.delete(id) : s.add(id)
    setMarcados(s)
  }

  return (
    <Elegidor
      titulo="Los planes de este día"
      dia={dia}
      buscador={<Buscador valor={busca} onCambio={setBusca} etiqueta="Buscar un plan" />}
      onCancelar={onCancelar}
      onListo={() => onListo(marcados, horas)}
    >
      {todos.length > 0 && visibles.length === 0 && (
        <div className="apunte" style={{ marginTop: 10 }}>Ningún plan se llama así.</div>
      )}
      {visibles.length > 0 && (
        <div className="eleccion nota-debajo">
          {visibles.map((o) => (
            <div key={o.id}>
              <button
                type="button"
                className="eleccion-op"
                aria-pressed={marcados.has(o.id)}
                onClick={() => { tap(); alternar(o.id) }}
              >
                <span className="et">{o.etiqueta}</span>
                {o.nota && <span className="no">{o.nota}</span>}
                {marcados.has(o.id) && <span className="tic"><Icono nombre="visto" /></span>}
              </button>
              {/* El campo sale **solo en los puestos**: en los libres no hay día
                  al que atar una hora. Va fuera del botón porque un `input`
                  dentro de un `button` no se puede tocar sin disparar el botón. */}
              {marcados.has(o.id) && (
                <RenglonDeHora
                  etiqueta={o.etiqueta}
                  hora={horas[o.id] ?? null}
                  onCambio={(h) => {
                    if (h === null) { const { [o.id]: _, ...resto } = horas; setHoras(resto) }
                    else setHoras({ ...horas, [o.id]: h })
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="apunte" style={{ marginTop: 10 }}>
        Marcar lo pone en este día; desmarcar lo devuelve a libres. La hora es
        opcional: sin ella el plan va al final, «{SIN_HORA}». Con ella, el grupo
        recibe un aviso una hora antes.
      </div>
    </Elegidor>
  )
}
