/**
 * Qué cambió cada versión publicada, en el idioma del grupo — la prosa de las
 * tarjetas de Ajustes → 🐳 La app (SPECS §14.34, figura de `meeting-ops-air`).
 *
 * Se escribe **a mano** al cerrar cada vuelta, porque no se puede derivar: el
 * código dice qué es verdad de un build, no qué notaría en la pantalla quien
 * sostiene el móvil. La entrada de arriba describe la versión que se está
 * construyendo, y `lib/notas.test.js` la ata al número de `app/package.json`:
 * subir la versión sin describirla —o describirla sin subirla— pone las
 * pruebas en rojo, así que «la nota viaja en cada merge» es una propiedad de
 * los checks y no de la memoria de nadie.
 *
 * Unas pocas líneas por versión, la más nueva primero, en la voz de la
 * interfaz: lo que cambió en pantalla, no qué módulo se tocó. La pantalla
 * enseña las cuatro primeras; el resto es historia que no cuesta nada guardar.
 */
export const NOTAS = [
  {
    version: '0.28.0',
    fecha: '2026-08-08',
    titulo: 'El balance dice de qué familia es cada bunga',
    lineas: [
      'En Números, cada bunga del balance se lee como en su selector: la familia con su pastilla de color, y el alias debajo.',
    ],
  },
  {
    version: '0.27.0',
    fecha: '2026-08-08',
    titulo: 'La app cuenta qué cambió',
    lineas: [
      'Ajustes → La app enseña estas tarjetas: la versión que llevas puesta y las tres de antes.',
      'La nota viaja con cada versión: subirla sin describirla pone las pruebas en rojo.',
    ],
  },
  {
    version: '0.26.0',
    fecha: '2026-08-08',
    titulo: 'Números crece y los días se tiñen',
    lineas: [
      'En Días, el número va en verde si el día está completo y en ámbar si falta algo; «hoy» lleva un aro.',
      'El selector del bunga enseña la pastilla de color de cada familia.',
      'En Números, el balance de anfitrión va primero, y entran el día más caro, «Así vais a acabar», los días con plan y la racha de cenas.',
      'El pique gana dos retratos: el entusiasta (👍) y el indeciso (🤷), con los empates dichos.',
    ],
  },
  {
    version: '0.25.0',
    fecha: '2026-08-08',
    titulo: 'El día lleva semáforo',
    lineas: [
      'En el día abierto, el icono de cada renglón va en verde con algo elegido y en ámbar cuando falta.',
      'El bunga, en masculino: «Ninguno», «el de los Pérez», «Los bungas».',
    ],
  },
  {
    version: '0.24.0',
    fecha: '2026-08-08',
    titulo: 'Las estadísticas se mudan a Agenda',
    lineas: [
      'Agenda queda Hoy · Días · Números; el acordeón «Estadísticas» de Ajustes se retira.',
    ],
  },
  {
    version: '0.23.0',
    fecha: '2026-08-08',
    titulo: 'Los elegidores del día, al centro',
    lineas: [
      'Platos, planes y bungas se eligen en una capa centrada con «Cancelar» y «Listo»: nada es definitivo hasta «Listo».',
      'El día son tres secciones —la cena, los bungas, el plan— y cada bunga se nombra por su familia.',
      'Platos y planes llevan buscador siempre visible.',
    ],
  },
  {
    version: '0.22.0',
    fecha: '2026-08-08',
    titulo: 'El día se abre como un plan',
    lineas: [
      'El día del viaje se abre en una capa centrada con tres renglones que se tocan, sin botón de guardar.',
      'En «Hoy», el titular dice lo que hay: sin cena manda el plan del día.',
    ],
  },
]
