// La hora de un plan: cuándo es, en qué orden va y cómo se dice.

/**
 * El momento exacto de un plan, en **segundos epoch** (SPECS §14.73).
 *
 * Lo calcula **el móvil** y no el servidor, y de eso depende que el
 * recordatorio funcione en octubre: `dia` es «2026-08-18» y `hora` es «20:00»,
 * las dos cosas en **tiempo local**, y el Worker corre en **UTC**. Madrid es +2
 * en agosto y +1 en enero, así que convertir allí obliga a deducir un desfase —
 * y ese es exactamente el fallo que no se ve al probarlo y se ve seis meses
 * después, como ya pasó con `toISOString()` y los días corridos (`lib/dias.js`).
 *
 * `new Date('2026-08-18T20:00')` **sin zona** lo interpreta el navegador en la
 * hora del aparato, que es la del camping. Es la única línea de todo esto que
 * sabe de husos horarios, y vive en el sitio que tiene la respuesta.
 */
export function instanteDe(dia, hora) {
  if (!dia || !horaValida(hora)) return null
  const t = new Date(`${dia}T${hora}:00`).getTime()
  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}

/** «20:00» sí; «7:5», «25:00» y lo vacío, no. */
export function horaValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora ?? ''))
}

/**
 * Los planes de un día **en orden** (`plan-con-hora.html` · S1).
 *
 * Los que tienen hora primero y de menor a mayor —son el esqueleto del día—, y
 * los sueltos al final, donde no estorban: «Día de playa» no empieza a ninguna
 * hora, y ponerlo entre las 10:30 y las 20:00 sería inventarse una.
 *
 * Dentro de cada grupo **no se reordena**: `sort` es estable, así que dos planes
 * a la misma hora se quedan como venían en vez de bailar en cada pintada.
 * Comparar «HH:MM» como texto ordena bien porque siempre lleva dos cifras.
 */
export function porHora(planes = []) {
  return [...planes].sort((a, b) => {
    const ha = horaValida(a?.hora) ? a.hora : null
    const hb = horaValida(b?.hora) ? b.hora : null
    if (ha && hb) return ha < hb ? -1 : ha > hb ? 1 : 0
    if (ha) return -1
    if (hb) return 1
    return 0
  })
}

/** Lo que se lee bajo un plan sin hora, en el renglón de los votos. */
export const SIN_HORA = 'a lo largo del día'
