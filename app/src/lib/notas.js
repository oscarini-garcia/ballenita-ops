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
    version: '0.37.0',
    fecha: '2026-08-09',
    titulo: 'Eliges de qué avisarte, y hay dos avisos nuevos',
    lineas: [
      'En Ajustes → Notificaciones, un interruptor por clase de aviso: los gastos que te tocan, en qué anda la gente y —si administras— quién quiere entrar.',
      'Nuevo: te avisa de un gasto que te mueve el saldo y de cuando alguien salda una deuda contigo. Y de cuando alguien cambia su estado.',
      'De lo tuyo no te avisa nadie: apuntar un gasto ya no te suena a ti mismo.',
      'En Mejoras, la hoja es más grande y se puede escribir una larga desde el renglón, con un botón para copiarla al portapapeles.',
    ],
  },
  {
    version: '0.36.1',
    fecha: '2026-08-09',
    titulo: 'Los avisos ya no se pierden al pasar a TestFlight',
    lineas: [
      'Un binario de TestFlight pide los avisos por un servidor de Apple distinto al de uno instalado desde Xcode. Con el servidor equivocado, Apple decía «token malo» y el móvil se quedaba desregistrado sin avisar.',
      'Ahora se prueba el otro servidor antes de dar el aviso por perdido, así que un desajuste ya no borra el registro de nadie — y la prueba te dice si ha pasado.',
    ],
  },
  {
    version: '0.36.0',
    fecha: '2026-08-09',
    titulo: 'Borrar pregunta, y dice qué se lleva por delante',
    lineas: [
      'Un gasto ya no se borra con el deslizamiento: pregunta antes, y cuenta a cuántas familias les mueve el saldo — que es lo que pasa en otra pantalla y no se veía.',
      'Una cena tampoco: su «borrar» baja al fondo de la tarjeta y dice cuántas líneas de la compra se caen con ella, y que lo ya comprado se queda.',
      'Y en la compra, el aspa de una línea escrita a mano pide una segunda pulsación. Antes era el mismo control que en las líneas de cena despliega el reparto.',
    ],
  },
  {
    version: '0.35.0',
    fecha: '2026-08-09',
    titulo: 'El aviso de prueba espera a que llegue',
    lineas: [
      'Antes decía «mandado» y se callaba, y eso solo quiere decir que Apple lo aceptó. Ahora espera doce segundos a que el aviso llegue de vuelta a este móvil y cuenta lo que pasó.',
      'Si llega, te dice por qué no lo ves: con la app abierta iOS no saca el globo. Ciérrala del todo y prueba otra vez.',
      'Si no llega, lo primero que nombra es el entorno de APNs, que es la causa que más veces es y la única que no da ningún error.',
    ],
  },
  {
    version: '0.34.3',
    fecha: '2026-08-09',
    titulo: 'El renglón de Apple dice qué ha pasado, no solo dónde',
    lineas: [
      '«Pidiéndole el identificador a Apple ×» era dónde falla, no qué falla, y ahí caben dos cosas que se arreglan en sitios distintos.',
      'Ahora pone «Apple ha rechazado el registro» —y sus palabras son la causa— o «Apple no ha contestado nada en ocho segundos», que es otra cosa y otro arreglo.',
    ],
  },
  {
    version: '0.34.2',
    fecha: '2026-08-09',
    titulo: 'Cuando Apple no contesta, se dice qué mirar',
    lineas: [
      'Si el permiso está dado y Apple no devuelve identificador, la app decía «suele ser que al binario le falta el permiso de avisos». Es falso: eso llega con mensaje, no con silencio.',
      'Ahora dice lo que de verdad calla a Apple: que el AppDelegate del binario instalado no reenvía la respuesta, que no hay red, o que es el simulador.',
      'Y lo decían dos pantallas con dos textos distintos; ahora está escrito una sola vez.',
    ],
  },
  {
    version: '0.34.1',
    fecha: '2026-08-08',
    titulo: 'Los avisos contestan en el acto cuando la app no puede avisar',
    lineas: [
      'La lista de pasos hizo su trabajo a la primera: se paraba en el primer renglón, buscando la parte nativa de los avisos.',
      'Ahí se esperaban seis segundos a una pregunta cuya respuesta ya se sabía. Ahora se contesta al momento, y el renglón se toca para copiar qué se ha visto: qué plataforma dice el puente y qué plugins trae.',
      'Si dice «esta instalación no puede avisar», hace falta instalar un binario nuevo desde Xcode: eso no lo arregla ningún paquete OTA.',
    ],
  },
  {
    version: '0.34.0',
    fecha: '2026-08-08',
    titulo: 'Encender los avisos ya no se queda girando',
    lineas: [
      'El botón «Encender» podía quedarse en «Pidiendo…» para siempre: el permiso estaba dado y lo que no volvía era la llamada al servidor, que no tenía plazo. Ahora ninguna llamada a la API espera más de 20 segundos, y si se agota lo dice.',
      'Y mientras dura se ve en qué va: la parte nativa, el permiso de iOS, el identificador de Apple y el servidor. Si se rompe uno, el renglón se toca para copiar lo que contestó.',
      'Con el permiso denegado ya no se vuelve a preguntar: iOS solo enseña su hoja una vez.',
    ],
  },
  {
    version: '0.33.0',
    fecha: '2026-08-08',
    titulo: 'La base de datos dice en qué estado está',
    lineas: [
      'En «La app», el bloque de migraciones ya no se queda en blanco: dice si está al día, si va por detrás, si no ha podido preguntar o si esto lo hace quien administra.',
      'Eran cuatro situaciones distintas que se veían igual —como un hueco— y se arreglan de forma distinta.',
    ],
  },
  {
    version: '0.32.0',
    fecha: '2026-08-08',
    titulo: 'La ballena de la barra es la de la pantalla de inicio',
    lineas: [
      'La marca de la cabecera, la puerta y la lista de eventos es ahora el icono de la app, el mismo que tocas para abrirla.',
      'En «La app», «Ya tienes el último paquete» deja de salir en rojo: de las cinco respuestas, tres son buenas noticias.',
      'Y si no se puede preguntar por las migraciones, lo dice en vez de no enseñar nada.',
    ],
  },
  {
    version: '0.31.0',
    fecha: '2026-08-08',
    titulo: 'El estado, con más sitio y mejor ordenado',
    lineas: [
      'La pastilla de la cabecera admite dos líneas: caben 65 letras en vez de 37, y solo crece si hacen falta.',
      'En «Quién anda en qué», cada nombre lleva el acrónimo de su familia en su pastilla de color.',
      'Y la tira va por novedad: lo último que alguien ha puesto sale primero.',
    ],
  },
  {
    version: '0.30.0',
    fecha: '2026-08-08',
    titulo: 'Tu estado, en la barra de arriba',
    lineas: [
      'La segunda línea de la cabecera es tu estado: tócala y lo cambias, con emoji y frase.',
      'Cinco para elegir de un toque, «Otras cinco» que las pide a la IA y «Más gracioso» para pulir el tuyo.',
      'Y en Hoy, la tira de quién anda en qué: hasta ahora el estado viajaba a todos los móviles y no se veía en ninguna pantalla.',
    ],
  },
  {
    version: '0.29.0',
    fecha: '2026-08-08',
    titulo: 'Saldos dice quién paga a quién',
    lineas: [
      'Cada familia sale con su pastilla de iniciales en color, como en el resto de la app.',
      'El renglón de saldar son dos líneas —«García → Solteros» y el importe— con «pagado» al lado: la fila baja un 24 % y los nombres dejan de recortarse.',
      'Quien no está en ninguna familia sale con su nombre, y no como «Sin familia».',
    ],
  },
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
