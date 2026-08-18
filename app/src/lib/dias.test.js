import { describe, it, expect } from 'vitest'
import {
  diasDe, resumenDeDia, diaQueEnsenaHoy, rotuloDelDia, titularDeCena, titularDeHoy,
  numeroYDia, diasEntre, platoQueManda, hoyISO, isoLocal, enLetras, filtraOpciones,
  titularDePlatos, enumerarConTope, LETRAS_DEL_TITULAR, LETRAS_DEL_RENGLON, titularDeFuera,
  fraseDeLaNoche,
} from './dias.js'
import { diaSiguiente, finPara } from './fechas.js'
import { ESTADO_SE_HACE } from './planes.js'

// Ballenita 2026, que es la semilla real de `db.js`: 8–15 de agosto.
const EVENTO = { startDate: '2026-08-08', endDate: '2026-08-15' }
const PAELLA = { id: 'd1', name: 'Paella mixta', categorias: ['principal'] }
const ACEITUNAS = { id: 'd2', name: 'Aceitunas y altramuces', categorias: ['aperitivo'] }
const SANDIA = { id: 'd3', name: 'Sandía', categorias: ['postre'] }

describe('diasDe', () => {
  it('da todos los días del evento, incluidos los vacíos', () => {
    const dias = diasDe(EVENTO)
    expect(dias).toHaveLength(8)
    expect(dias[0]).toBe('2026-08-08')
    expect(dias.at(-1)).toBe('2026-08-15')
  })

  it('un evento de un solo día es un día', () => {
    expect(diasDe({ startDate: '2026-08-08' })).toEqual(['2026-08-08'])
  })

  it('sin fechas, se cae a los días apuntados, ordenados y sin repetir', () => {
    expect(diasDe({}, ['2026-08-12', null, '2026-08-10', '2026-08-12']))
      .toEqual(['2026-08-10', '2026-08-12'])
  })

  it('no se va por las ramas con una fecha final disparatada', () => {
    expect(diasDe({ startDate: '2026-01-01', endDate: '2030-01-01' })).toHaveLength(60)
  })
})

describe('resumenDeDia', () => {
  it('la cena manda en el titular, y la nombra el plato principal', () => {
    const r = resumenDeDia({
      cena: { platoIds: ['d1', 'd2', 'd3'] },
      platos: [ACEITUNAS, PAELLA, SANDIA],
      bungaMayores: 'El del ruido',
      planes: [],
    })
    // La bunga **no** entra en el titular: «Paella mixta en El del ruido» son
    // 268 pt en una fila que tiene 237, y se recortaba en «El del…».
    expect(r.titulo).toBe('Paella mixta')
    // El renglón **nombra en vez de contar** (§14.69 · N1): «3 platos» se sabe
    // leyendo el titular, y que no haya nada que hacer ese día no.
    expect(r.detalle).toBe('sin planes')
  })

  it('sin plato que enseñar, la bunga rescata el titular de un «Cena» pelado', () => {
    expect(resumenDeDia({ cena: { platoIds: [] }, bungaMayores: 'El del ruido' }).titulo)
      .toBe('Cena en El del ruido')
    expect(resumenDeDia({ cena: { platoIds: [] } }).titulo).toBe('Cena')
  })

  it('sin cena, titula el primer plan y no lo repite debajo', () => {
    const r = resumenDeDia({ planes: [{ titulo: 'Playa de la Cala' }] })
    expect(r.titulo).toBe('Playa de la Cala')
    // «1 plan» sobra teniéndolo arriba, y repetirlo gastaría la única línea que
    // queda. Lo que sí es dato es que ese día no se cena en el camping.
    expect(r.detalle).toBe('sin cena')
  })

  it('un día sin nada lo dice, no se queda callado', () => {
    expect(resumenDeDia({})).toEqual({ titulo: 'Día libre', detalle: 'nada apuntado' })
  })

  it('el primero y el último día vacíos se llaman por lo que son', () => {
    expect(resumenDeDia({ esPrimero: true }).titulo).toBe('Llegada')
    expect(resumenDeDia({ esUltimo: true }).titulo).toBe('Vuelta a casa')
  })

  it('una cena montada sin platos no se confunde con no tener cena', () => {
    // Los planes van primero y el estado de la cena detrás, igual que en
    // «Kayak por la cala · sin cena»: primero lo que hay, luego lo que falta.
    expect(resumenDeDia({ cena: { platoIds: [] } }).detalle).toBe('sin planes · cena sin platos')
  })

  /**
   * Es el día 20 de Ballenita'26, el que motivó la vuelta: dos planes, y el
   * segundo no salía en ninguna pantalla sin abrir el día.
   */
  it('con dos planes y sin cena, el segundo baja al renglón por su nombre', () => {
    const r = resumenDeDia({
      planes: [{ titulo: 'Bici eléctrica a Cadaqués' }, { titulo: 'Kayak por la cala' }],
    })
    expect(r.titulo).toBe('Bici eléctrica a Cadaqués')
    expect(r.detalle).toBe('Kayak por la cala · sin cena')
  })

  it('con cena y planes, arriba se come y abajo se hace', () => {
    const r = resumenDeDia({
      cena: { platoIds: ['d1'] },
      platos: [PAELLA],
      planes: [{ titulo: 'Tardeo en el chiringuito' }],
    })
    expect(r.titulo).toBe('Paella mixta')
    expect(r.detalle).toBe('Tardeo en el chiringuito')
  })
})

describe('diaQueEnsenaHoy', () => {
  const dias = diasDe(EVENTO)

  it('durante el viaje enseña hoy', () => {
    expect(diaQueEnsenaHoy(dias, '2026-08-09')).toEqual({ dia: '2026-08-09', estado: 'hoy', distancia: 0 })
  })

  it('antes del viaje enseña el primer día y cuánto falta', () => {
    expect(diaQueEnsenaHoy(dias, '2026-08-02')).toEqual({ dia: '2026-08-08', estado: 'antes', distancia: 6 })
  })

  it('después del viaje enseña el último y cuánto hace', () => {
    expect(diaQueEnsenaHoy(dias, '2026-08-20')).toEqual({ dia: '2026-08-15', estado: 'despues', distancia: 5 })
  })

  it('sin días no hay nada que enseñar', () => {
    expect(diaQueEnsenaHoy([], '2026-08-09')).toBeNull()
  })
})

describe('rotuloDelDia', () => {
  it('con cena, hoy es esta noche', () => {
    expect(rotuloDelDia({ dia: '2026-08-09', estado: 'hoy', distancia: 0 }, { hayCena: true }))
      .toMatch(/esta noche$/)
  })

  it('sin cena, hoy es hoy', () => {
    expect(rotuloDelDia({ dia: '2026-08-09', estado: 'hoy', distancia: 0 })).toMatch(/· hoy$/)
  })

  it('mañana se dice mañana, no «dentro de 1 días»', () => {
    expect(rotuloDelDia({ dia: '2026-08-08', estado: 'antes', distancia: 1 }))
      .toBe('sáb, 8 ago · el primer día, mañana')
  })

  it('a seis días, los cuenta', () => {
    expect(rotuloDelDia({ dia: '2026-08-08', estado: 'antes', distancia: 6 }))
      .toMatch(/dentro de 6 días$/)
  })

  it('ayer se dice ayer', () => {
    expect(rotuloDelDia({ dia: '2026-08-15', estado: 'despues', distancia: 1 }))
      .toMatch(/el último día, fue ayer$/)
  })
})

describe('titularDeCena', () => {
  /**
   * Nombra **los principales** y ya no cuenta el resto (§14.69 · P4): el
   * recuento lo lleva el renglón de debajo de esa misma fila —«tres platos»—,
   * así que arriba era decirlo dos veces.
   */
  it('nombra los principales y deja el recuento al renglón de abajo', () => {
    expect(titularDeCena({ platoIds: ['d1', 'd2', 'd3'] }, [PAELLA, ACEITUNAS, SANDIA]))
      .toBe('Paella mixta')
  })

  it('un plato solo es un plato solo', () => {
    expect(titularDeCena({ platoIds: ['d1'] }, [PAELLA])).toBe('Paella mixta')
  })

  it('con dos principales los nombra a los dos', () => {
    const otro = { id: 'd9', name: 'Fideuá', categorias: ['principal'] }
    expect(titularDeCena({ platoIds: ['d1', 'd9'] }, [PAELLA, otro]))
      .toBe('Paella mixta y Fideuá')
  })

  it('sin cena y con cena vacía dicen cosas distintas', () => {
    expect(titularDeCena(null)).toBe('Sin cena montada')
    expect(titularDeCena({ platoIds: [] }, [])).toBe('Cena sin platos apuntados')
  })
})

/**
 * P2 de `docs/diseño/dia-abierto.html`: el titular de «Hoy» titula lo que hay.
 * Es la regla que la fila de Días ya usaba (`resumenDeDia`): dos pantallas
 * hermanas no contestan distinto a la misma pregunta.
 */
describe('titularDeHoy', () => {
  it('la cena con platos manda, y las bungas van al renglón pequeño', () => {
    const t = titularDeHoy({
      cena: { platoIds: ['d1', 'd3'] },
      platos: [PAELLA, SANDIA],
      planes: [{ titulo: 'Playa de la Cala', estado: 'confirmado' }],
      bungaMayores: 'El del ruido',
      bungaNinos: 'El del fondo',
    })
    expect(t.grande).toBe('Paella mixta')
    expect(t.pequeno).toBe('Mayores en El del ruido · niños en El del fondo')
  })

  it('sin cena, manda el plan del día, y la cena baja al renglón pequeño', () => {
    const t = titularDeHoy({
      planes: [{ titulo: 'Playa de la Cala', estado: ESTADO_SE_HACE, ubicacion: 'Cala del sur' }],
    })
    expect(t.grande).toBe('Playa de la Cala')
    expect(t.pequeno).toBe('Se hace · en Cala del sur · sin cena montada todavía')
  })

  it('una cena vacía no le quita el titular a un plan de verdad', () => {
    const t = titularDeHoy({
      cena: { platoIds: [] },
      planes: [{ titulo: 'Torneo de petanca' }],
    })
    // **«A votación» no se dice** (§14.74): es el estado de origen de todo plan.
    expect(t.grande).toBe('Torneo de petanca')
    expect(t.pequeno).toBe('cena sin platos apuntados')
  })

  it('una cena vacía sin plan sí manda: es un hueco reservado', () => {
    const t = titularDeHoy({ cena: { platoIds: [] }, bungaMayores: 'El del ruido' })
    expect(t.grande).toBe('Cena sin platos apuntados')
    expect(t.pequeno).toBe('Mayores en El del ruido')
  })

  it('sin nada, el día es libre y lo dice sin quejarse', () => {
    expect(titularDeHoy({})).toEqual({
      grande: 'Día libre',
      pequeno: 'Sin cena montada y sin planes — también hace falta',
    })
  })

  it('enLetras cuenta hasta diez y luego cifra', () => {
    expect(enLetras(2)).toBe('dos')
    expect(enLetras(10)).toBe('diez')
    expect(enLetras(11)).toBe('11')
  })
})

/** L3 de `docs/diseño/elegidores.html`: el buscador de los elegidores. */
describe('filtraOpciones', () => {
  const OPCIONES = [
    { id: 'd1', etiqueta: 'Paella mixta', nota: 'Principal' },
    { id: 'd2', etiqueta: 'Sandía', nota: 'Postre' },
    { id: 'd3', etiqueta: 'Ensalada verde', nota: 'Acompañamiento' },
  ]

  it('con la caja vacía salen todas: filtra, no esconde', () => {
    expect(filtraOpciones(OPCIONES, '')).toHaveLength(3)
    expect(filtraOpciones(OPCIONES, '   ')).toHaveLength(3)
  })

  it('no le importan las tildes ni las mayúsculas', () => {
    expect(filtraOpciones(OPCIONES, 'sandia')).toEqual([OPCIONES[1]])
    expect(filtraOpciones(OPCIONES, 'PAELLA')).toEqual([OPCIONES[0]])
  })

  it('también mira la nota: buscar «postre» es legítimo', () => {
    expect(filtraOpciones(OPCIONES, 'postre')).toEqual([OPCIONES[1]])
  })

  it('sin nada que case, lista vacía y sin quejarse', () => {
    expect(filtraOpciones(OPCIONES, 'cocido')).toEqual([])
    expect(filtraOpciones([], 'lo que sea')).toEqual([])
  })
})

describe('los pedazos sueltos', () => {
  it('numeroYDia da el número y tres letras', () => {
    expect(numeroYDia('2026-08-09')).toEqual({ numero: '9', semana: 'dom' })
  })

  it('diasEntre cuenta días enteros', () => {
    expect(diasEntre('2026-08-08', '2026-08-15')).toBe(7)
    expect(diasEntre('2026-08-15', '2026-08-08')).toBe(-7)
  })

  it('platoQueManda prefiere el principal aunque no sea el primero', () => {
    expect(platoQueManda([ACEITUNAS, PAELLA, SANDIA])).toBe(PAELLA)
    expect(platoQueManda([ACEITUNAS, SANDIA])).toBe(ACEITUNAS)
    expect(platoQueManda([])).toBeNull()
  })
})

/**
 * Estas pruebas corren en `Europe/Madrid` (ver `vite.config.js`), que es donde
 * vive el grupo. En UTC pasaban todas **y el error seguía ahí**: en verano
 * España va dos horas por delante, así que la medianoche del 8 de agosto es el
 * día 7 a las 22:00Z, `toISOString()` devolvía el día de antes, y el calendario
 * de un viaje que empieza el 8 salía empezando el 7 — con la cena del primer
 * día en la casilla del día anterior.
 */
describe('el día local, y no el de Greenwich', () => {
  it('la medianoche del 8 de agosto es el 8, no el 7', () => {
    expect(isoLocal(new Date('2026-08-08T00:00:00'))).toBe('2026-08-08')
  })

  it('los primeros minutos y los últimos del día son ese día', () => {
    expect(isoLocal(new Date('2026-08-08T00:30:00'))).toBe('2026-08-08')
    expect(isoLocal(new Date('2026-08-08T23:59:00'))).toBe('2026-08-08')
  })

  it('en invierno, con una hora de diferencia, tampoco se mueve', () => {
    expect(isoLocal(new Date('2026-01-15T00:00:00'))).toBe('2026-01-15')
  })

  it('hoy es hoy', () => {
    const ahora = new Date()
    expect(hoyISO()).toBe(
      `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`,
    )
  })

  it('y el fin que se propone es el día siguiente de verdad', () => {
    expect(diaSiguiente('2026-08-08')).toBe('2026-08-09')
    expect(diaSiguiente('2026-08-31')).toBe('2026-09-01')
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01')
    expect(finPara('2026-08-08', '')).toBe('2026-08-09')
    expect(finPara('2026-08-08', '2026-08-15')).toBe('2026-08-15')
  })
})

/**
 * El titular con los principales (§14.69 · P4, `docs/diseño/dia-titular.html`).
 *
 * Antes mandaba **uno solo**, así que una Noche Ibérica de jamón y tortilla se
 * anunciaba por el jamón. Lo que se prueba aquí no es enumerar —eso es de una
 * línea— sino **cuándo deja de enumerar**, que es lo que evita que la línea se
 * recorte: el titular mide 289 pt y no parte nunca.
 */
const JAMON = { id: 'j', name: 'Jamón', categorias: ['principal'] }
const TORTILLA = { id: 't', name: 'Tortilla', categorias: ['principal'] }
const PINCHOS = { id: 'p', name: 'Pinchos Arnall 🍖', categorias: ['principal'] }
const TORTILLA_LARGA = { id: 'tl', name: 'Tortilla de patata con cebolla', categorias: ['principal'] }
const PAN = { id: 'pt', name: 'Pan con tomate', categorias: ['acompanamiento'] }

describe('titularDePlatos', () => {
  it('nombra los principales, y solo los principales', () => {
    expect(titularDePlatos([ACEITUNAS, JAMON, TORTILLA, SANDIA])).toBe('Jamón y Tortilla')
  })

  it('con uno solo se lee igual que antes', () => {
    expect(titularDePlatos([ACEITUNAS, PAELLA, SANDIA])).toBe('Paella mixta')
  })

  it('del tercero en adelante, cuenta', () => {
    expect(titularDePlatos([JAMON, TORTILLA, PAELLA])).toBe('Jamón, Tortilla y 1 más')
    expect(titularDePlatos([JAMON, TORTILLA, PAELLA, PINCHOS])).toBe('Jamón, Tortilla y 2 más')
  })

  /**
   * El caso que obliga al tope: «Pinchos Arnall 🍖 y Tortilla de patata con
   * cebolla» mide mucho más de 289 pt y saldría partida por la mitad. Contar es
   * peor que nombrar, pero mucho mejor que enseñar media palabra.
   */
  it('si los dos juntos no caben, nombra uno y cuenta el resto', () => {
    const r = titularDePlatos([PINCHOS, TORTILLA_LARGA])
    expect(r).toBe('Pinchos Arnall 🍖 y 1 más')
    expect(r.length).toBeLessThanOrEqual(LETRAS_DEL_TITULAR)
  })

  it('pero con uno solo se rinde: algo hay que decir', () => {
    expect(titularDePlatos([TORTILLA_LARGA])).toBe('Tortilla de patata con cebolla')
  })

  it('sin ningún principal se queda la regla de antes: el primero', () => {
    expect(titularDePlatos([PAN, SANDIA])).toBe('Pan con tomate')
  })

  it('sin platos no hay titular que dar', () => {
    expect(titularDePlatos([])).toBeNull()
  })
})

describe('enumerarConTope', () => {
  it('con lo que cabe, los nombra todos', () => {
    expect(enumerarConTope(['Playa', 'Kayak'])).toBe('Playa y Kayak')
  })

  it('con lo que no cabe, nombra lo que entra y cuenta el resto', () => {
    const r = enumerarConTope(['Bici eléctrica a Cadaqués', 'Kayak por la cala', 'Feria del pueblo'])
    expect(r).toBe('Bici eléctrica a Cadaqués y 2 más')
    expect(r.length).toBeLessThanOrEqual(LETRAS_DEL_RENGLON)
  })

  it('con uno solo se rinde aunque se pase — recortar es cosa del CSS', () => {
    const largo = 'Un plan con un nombre larguísimo que no cabe de ninguna manera'
    expect(enumerarConTope([largo])).toBe(largo)
  })

  it('sin nada, no dice nada', () => {
    expect(enumerarConTope([])).toBe('')
    expect(enumerarConTope([null, undefined])).toBe('')
  })
})

/**
 * Noches que se cena fuera (§14.70).
 *
 * Antes esto se apuntaba como **plan** —«Tardeo cena de chiringo»— porque era el
 * único sitio donde cabía escribirlo, y el día se quedaba diciendo «sin cena»
 * teniendo la cena decidida.
 */
const FUERA = { platoIds: [], fuera: 1, donde: 'El chiringuito de Paco' }
const FUERA_SIN_SITIO = { platoIds: [], fuera: 1, donde: '' }

describe('se cena fuera', () => {
  it('con sitio, el sitio es el titular', () => {
    expect(titularDeFuera(FUERA)).toBe('Fuera · El chiringuito de Paco')
  })

  it('sin sitio no se inventa nada: que se sale ya es la noticia', () => {
    expect(titularDeFuera(FUERA_SIN_SITIO)).toBe('Se cena fuera')
    expect(titularDeFuera({ fuera: 1 })).toBe('Se cena fuera')
  })

  it('en la fila del día manda sobre los platos que hubiera marcados', () => {
    // Los `platoIds` no se borran al salir: se quedan por si se vuelve atrás,
    // y aun así el titular dice dónde se cena.
    const r = resumenDeDia({ cena: { ...FUERA, platoIds: ['d1'] }, platos: [PAELLA], planes: [] })
    expect(r.titulo).toBe('Fuera · El chiringuito de Paco')
    // Y no reclama platos, que esa noche no cocina nadie.
    expect(r.detalle).toBe('sin planes')
  })

  it('una cena fuera sin platos no se lee como una cena a medio montar', () => {
    expect(resumenDeDia({ cena: FUERA_SIN_SITIO, planes: [] }).detalle).toBe('sin planes')
    // …que es lo que sí dice una cena montada y vacía.
    expect(resumenDeDia({ cena: { platoIds: [] }, planes: [] }).detalle)
      .toBe('sin planes · cena sin platos')
  })

  it('el renglón de la cena del día lo dice igual', () => {
    expect(titularDeCena(FUERA, [PAELLA])).toBe('Fuera · El chiringuito de Paco')
    expect(titularDeCena(FUERA_SIN_SITIO, [])).toBe('Se cena fuera')
  })

  it('«Hoy» lo redacta, sin platos ni bungas', () => {
    const t = titularDeHoy({
      cena: FUERA,
      platos: [PAELLA],
      planes: [{ titulo: 'Playa de la Cala' }],
      bungaMayores: 'El del ruido',
      bungaNinos: 'El del fondo',
    })
    expect(t.grande).toBe('Fuera · El chiringuito de Paco')
    // Manda sobre el plan, porque es lo que se hace esa noche.
    expect(t.pequeno).toBe('Playa de la Cala')
    const frase = t.frase.map((x) => x.t).join('')
    expect(frase).toBe('Esta noche se cena fuera, en El chiringuito de Paco.')
    // Ni bungas ni platos: esa noche no acoge nadie.
    expect(frase).not.toMatch(/El del ruido|Paella/)
  })

  it('y sin sitio, «Hoy» dice que falta por saberse', () => {
    const frase = fraseDeLaNoche({ cena: FUERA_SIN_SITIO }).map((x) => x.t).join('')
    expect(frase).toBe('Esta noche se cena fuera, y todavía no se sabe dónde.')
  })
})
