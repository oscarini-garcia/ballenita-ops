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
    version: '0.75.1',
    fecha: '2026-08-21',
    titulo: 'En Trucos ya se ve el truco',
    lineas: [
      'El título de cada truco no se veía con el móvil en oscuro: salía claro sobre un recuadro claro. Ahora se lee.',
      'Era el botón de la fila sin vestir, así que el navegador lo pintaba a su manera.',
    ],
  },
  {
    version: '0.75.0',
    fecha: '2026-08-21',
    titulo: 'Los planes que ya pasaron salen marcados',
    lineas: [
      'En Planes, lo que ya se hizo baja a su grupo del final —«Ya se hicieron»— con el visto verde y la pastilla «hecho».',
      'Deja de pedir votos: un plan del martes ya no dice «faltan 4 por votar» el jueves. Dice el día que fue.',
      'El de hoy sigue arriba hasta mañana, y un plan sin día no baja nunca: ese no se hizo, se quedó sin hacer.',
    ],
  },
  {
    version: '0.74.0',
    fecha: '2026-08-20',
    titulo: 'La casa entera se va de una vez',
    lineas: [
      'En Grupo → Familias, cada casa tiene su «Se han ido unos días»: una pulsación y se van todos. La siguiente los trae.',
      'Y cada persona lleva su casilla al lado, para marcar uno a uno sin abrir su ficha.',
      'Esto lo puede hacer cualquier adulto, también con la gente de otra casa: quién está hoy es de lo que dependen la compra y el reparto. Editar su ficha sigue siendo de los suyos.',
    ],
  },
  {
    version: '0.73.0',
    fecha: '2026-08-18',
    titulo: 'Quien se va unos días deja de contar',
    lineas: [
      'En Grupo → Familias, al abrir a alguien hay un interruptor: «Se ha ido unos días». Lo ponen los adultos de su casa.',
      'Deja de contar en la compra, en «Todos» al repartir un gasto y entre los que faltan por votar. No hay que poner fechas.',
      'Lo ya apuntado a su nombre no se toca: ningún saldo se mueve, y el voto que dejara puesto sigue contando.',
      'Sigue en su familia con un «fuera» delante — se aparta, no se esconde—, y se le puede marcar a mano en un gasto que sí le toque.',
      'Lleva un cambio en la base: quien administra lo verá en Ajustes → Actualizar.',
    ],
  },
  {
    version: '0.72.0',
    fecha: '2026-08-18',
    titulo: 'Cada familia trae los cacharros que quiera',
    lineas: [
      'En Grupo → Gadgets ya no hay tope de uno por familia: la fila de apuntar se queda puesta y el botón pasa a «+ Otro».',
      'Cada familia dice cuántos lleva —«trae uno», «trae dos»— para no apuntar dos veces la misma nevera.',
      'Se vota igual: un voto por cabeza, y los de tu propia familia siguen sin contar.',
    ],
  },
  {
    version: '0.71.0',
    fecha: '2026-08-18',
    titulo: 'El día dice qué se cena, y qué cenan los niños',
    lineas: [
      'Al abrir un día, la cena ya no dice «dos platos»: los nombra todos, ordenados de aperitivo a postre.',
      'Y si los niños comen otra cosa, sale en su propio renglón con sus platos — antes solo decía «los niños, otra cosa», que avisa y no cuenta.',
      'Con un solo plato no se repite debajo, y mientras los niños coman lo mismo no se dice nada.',
    ],
  },
  {
    version: '0.70.0',
    fecha: '2026-08-18',
    titulo: 'La hora cabe, y se pone a pulsos',
    lineas: [
      'La hora de un plan ya no se sale de su casilla: dentro pone «20h», y ahora crece con el tamaño de letra como todo lo demás.',
      'Para ponerla ya no sale el disco del sistema con sus minutos: hay un menos y un más, y solo horas exactas. Da la vuelta, así que de las 23h se sube a las 0h.',
      'Sin hora puesta, «Poner hora» la deja en 12h y de ahí se mueve.',
      'Las horas con minutos que hubiera puestas se redondean solas hacia abajo — 23:46 pasa a 23h — y su aviso se mueve con ellas.',
    ],
  },
  {
    version: '0.69.0',
    fecha: '2026-08-18',
    titulo: 'En «Hoy», un plan se toca y se abre',
    lineas: [
      'Los planes de hoy ya no dicen «A votación» debajo. Lo decían todos, que es como no decir nada: ahora solo sale lo que hay — «Se hace», y el sitio si lo tiene.',
      'Y tocar un plan lo abre, en vez de dejarte en la lista de Planes buscándolo.',
      'De paso, «Planes confirmados» en Números vuelve a contar: decía 0 en todos los eventos.',
    ],
  },
  {
    version: '0.68.0',
    fecha: '2026-08-18',
    titulo: 'Los planes tienen hora, y avisan una hora antes',
    lineas: [
      'Al colocar un plan en un día se le puede poner hora. Los que la tienen salen ordenados de la mañana a la noche, y los que no, al final — diciendo «a lo largo del día».',
      'La hora se ve en el sitio del icono, en columna, para poder leer el día de un vistazo.',
      'Y una hora antes de cada plan con hora, el grupo recibe un aviso. Es lo primero de la app que se dispara solo, sin que nadie toque nada.',
      'Se apaga en Ajustes → Notificaciones, en «Una hora antes».',
      'Ojo: cambiar la hora de un plan que ya avisó no vuelve a avisar.',
      'Lleva un cambio en la base: quien administra lo verá en Ajustes → Actualizar.',
    ],
  },
  {
    version: '0.67.0',
    fecha: '2026-08-18',
    titulo: 'Al elegir bunga se ve a quién le toca',
    lineas: [
      'En el elegidor de bunga de una cena, cada casa dice cuántas veces ha acogido ya: «El del ruido · 3 veces», «El de la piscina · aún ninguna».',
      'Es el mismo balance de anfitrión que sale en Números, pero puesto donde se decide, sin salir del día a medio montar.',
      'No cuenta la noche que estás decidiendo: la cuenta contesta a quién le toca aparte de esa. Y una noche que se cena fuera no la acoge nadie, así que tampoco suma.',
    ],
  },
  {
    version: '0.66.0',
    fecha: '2026-08-18',
    titulo: 'El día enseña todos sus planes',
    lineas: [
      'Un día con cuatro planes enseñaba uno: «Torneo de pingpong comunitario y tres más». Ahora salen los cuatro, cada uno en su renglón.',
      'Y cada uno con sus votos —«Confirmado», o «1 👍 · faltan 4 por votar»—, que antes solo se veían cuando el día tenía un único plan.',
      'Tocar cualquiera abre el mismo elegidor de siempre para cambiarlos.',
    ],
  },
  {
    version: '0.65.0',
    fecha: '2026-08-18',
    titulo: 'O se cena fuera, o se reparten bungas',
    lineas: [
      'Al marcar que esa noche se cena fuera, los dos renglones de los bungas desaparecen del día: no acoge nadie, así que pedirlos era pedir lo imposible. Lo que tuvieras elegido no se borra — vuelve al volver al camping.',
      'Y en Números, una noche fuera ya no le cuenta de anfitrión a nadie. Antes, si habías puesto los bungas y luego decías que se cenaba fuera, seguía contando.',
      'Los avisos de un comentario en un día dicen «ha comentado en el sábado 15 de agosto» en vez de «en «2026-08-15»».',
    ],
  },
  {
    version: '0.64.0',
    fecha: '2026-08-17',
    titulo: 'Noches que se cena fuera, y dónde',
    lineas: [
      'En el día, al elegir los platos, hay un verbo nuevo: «Esta noche se cena fuera…». Se pone el sitio —«el chiringuito de Paco»— o se deja en blanco hasta que se sepa.',
      'Hasta ahora eso se apuntaba como un plan, y el día se quedaba diciendo «sin cena» teniendo la cena decidida.',
      'Esa noche no entra en la lista de la compra: no hay que comprar arroz para una paella que no va a cocinar nadie.',
      'Y cuenta como cena montada: el renglón se pone verde sin pedir platos ni bungas, que esa noche no acoge nadie.',
      'Los platos que tuvieras marcados no se borran — si volvéis a cenar en el camping, siguen ahí.',
      'Lleva un cambio en la base: quien administra lo verá en Ajustes → Actualizar.',
    ],
  },
  {
    version: '0.63.0',
    fecha: '2026-08-17',
    titulo: 'El enlace de acceso ya no se gasta al abrirlo',
    lineas: [
      'Un enlace de «Entrar sin iPhone» valía una sola vez, y con eso se caían usos de lo más normales: abrirlo dos veces, verlo en el móvil y luego en el portátil, o que la vista previa de WhatsApp lo estrenara antes que su dueño.',
      'Ahora se abre las veces que haga falta. Sigue caducando a los tres días, y generar otro deja el anterior sin valor — que ahora vale también para anular el de alguien que ya había entrado.',
      'En Ajustes → Cuentas, la pastilla pasa de «enlace sin usar» a «con enlace activo»: dice si hay uno por ahí que todavía abre esa cuenta, que es lo que hay que saber para decidir si conviene revocarlo.',
      'Lleva un cambio en la base: quien administra lo verá en Ajustes → Actualizar.',
    ],
  },
  {
    version: '0.62.0',
    fecha: '2026-08-17',
    titulo: 'Cada día dice lo que hay, en vez de contarlo',
    lineas: [
      'En Días, el renglón de debajo ya no pone «sin cena · 2 planes»: pone el nombre del plan que no cabía arriba. El segundo plan de un día no salía en ninguna pantalla sin abrir el día.',
      'Y el titular de una cena nombra los platos principales, no solo el primero: una Noche Ibérica de jamón y tortilla se anuncia por los dos.',
      'Con más de dos principales, o con dos nombres largos, nombra los que caben y cuenta el resto — la línea no parte, así que lo que sobra se recortaba.',
      'El renglón de la cena dentro del día dice ahora lo mismo que la lista, que antes contaban cosas distintas.',
      'Nada de esto ocupa más sitio: los ocho días siguen cabiendo igual en la pantalla.',
    ],
  },
  {
    version: '0.61.0',
    fecha: '2026-08-17',
    titulo: 'Las cenas se montan en el día, y el gasto dice cómo se reparte',
    lineas: [
      'Comidas se queda en dos: la Carta y la Compra. «Cenas» se retira, porque una cena es de un día y se monta mejor en Agenda → el día, donde además están sus bungas y su plan.',
      'Lo que solo existía allí se muda al elegidor de platos del día: si buscas un plato que no está, sale «Crear “…” y marcarlo» con el nombre ya escrito; y «Los niños comen otra cosa» abre su propia lista, con un mando para pasar de una mesa a la otra.',
      'Al apuntar un gasto, una línea nueva dice cómo va a quedar antes de guardarlo: «3 familias · 16,20 € cada una», o de cuánto a cuánto si no es a partes iguales.',
      'Y dentro de Detalles, bajo «Cómo se reparte», sale lo que le toca a cada familia en euros — que hasta ahora, con el reparto por coeficiente, no se veía en ningún sitio.',
      'Una cena que se quedó fuera de las fechas del viaje ya no desaparece: baja al final de Días, marcada, para poder vaciarla.',
    ],
  },
  {
    version: '0.60.0',
    fecha: '2026-08-17',
    titulo: 'En claro, tu estado ya se lee',
    lineas: [
      'Lo que escribías en «Tu estado» salía casi blanco sobre un campo casi blanco: en la cara clara no se veía. En la oscura estaba bien, y por eso había pasado desapercibido.',
      'Arreglado para todos los campos de la app, no solo ese: un cuadro de texto ya no coge el color de donde esté colgado.',
    ],
  },
  {
    version: '0.59.0',
    fecha: '2026-08-17',
    titulo: '«Hoy» cuenta qué se cena y dónde',
    lineas: [
      'El titular de Hoy ya no dice «Paella mixta y dos cosas más»: lo cuenta redactado —qué se cena, con qué, y quién cena en cada bunga— en una frase.',
      'Y se toca: abre el día entero en modo lectura, con la carta de la cena en el orden en que se come, los dos bungas y el plan. Quien organiza tiene ahí mismo «Montar este día».',
      'Al elegir los platos de una cena, la lista va agrupada por entrante, principal, postre… y los que ya llevas puestos salen arriba del todo.',
      'En Dinero, el total del evento pasa al final de la lista, que es donde se busca al acabar de repasar.',
      'Y se retira el aviso de que los niños comen otra cosa: comen lo mismo salvo que digas lo contrario, y decirlo en todas las cenas sobraba.',
    ],
  },
  {
    version: '0.58.0',
    fecha: '2026-08-16',
    titulo: 'La ballena te escribe el comentario del bunga',
    lineas: [
      'En el hilo de un bunga hay un botón nuevo, «Que lo escriba la ballena»: trae un comentario hecho a partir de cómo es el sitio —su evaluación, sus pegatinas y sus notas—, así que habla de la nevera o de los bichos y no de las ganas que hay de llegar.',
      'Se pone en la casilla de escribir, no se manda: lo corriges, lo borras o lo envías tú, y va firmado con tu nombre como cualquier otro.',
      'Si no te convence, vuelve a pulsarlo y trae otro distinto — sabe cuáles ya te ha propuesto y también lo que ya se ha dicho en el hilo, así que no se repite.',
      'Solo está en los bungas: un plan o un gasto no tienen evaluación detrás de la que hablar.',
    ],
  },
  {
    version: '0.57.0',
    fecha: '2026-08-16',
    titulo: 'Tocar la pestaña donde ya estás te devuelve al principio',
    lineas: [
      'Estés en el área que estés, tocar la pestaña encendida vuelve a la primera: Agenda a «Hoy», Dinero a «Gastos», Comidas a «Cenas», Planes a «Planes» y Grupo a «Familias».',
      'En Agenda, entrar desde otra sección sigue abriendo el calendario, así que dos toques seguidos son «llévame al día de hoy». Y al abrir la app se sigue viendo «Hoy».',
    ],
  },
  {
    version: '0.56.0',
    fecha: '2026-08-16',
    titulo: '«Ver todos los comentarios» ya se ve entero',
    lineas: [
      'La hoja con el hilo completo salía metida dentro de la ventana del plan, con el título cortado por la izquierda y el último comentario partido por abajo. Ahora sube desde el borde de la pantalla, como todas las demás.',
      'Pasaba solo en el iPhone: el navegador del ordenador la dibujaba bien, y por eso no se había visto. Queda arreglado para todas las hojas de la app, no solo la de comentarios.',
    ],
  },
  {
    version: '0.55.0',
    fecha: '2026-08-16',
    titulo: 'Los comentarios dejan de gritar',
    lineas: [
      'El hilo de comentarios era cuatro cajas apiladas —la del hilo, la de «ver los que faltan», la de escribir y el botón— y ocupaba dos tercios de la ventana de un plan. Ahora son dos fondos sin borde y un enlace.',
      'Y un comentario se lee como lo que es: texto normal. Estaba pintado con la negrita del nombre de una fila, así que era lo más oscuro de la pantalla.',
      'Para escribir hay una pastilla redonda con su botón dentro, y «Ver los N comentarios» es un enlace en vez de otro recuadro pegado al hilo.',
      'Vale en los cuatro sitios donde hay comentarios: el plan, el gasto, el día y el bunga.',
    ],
  },
  {
    version: '0.54.0',
    fecha: '2026-08-16',
    titulo: 'Los bungas, mejor explicados',
    lineas: [
      'En Grupo → Bungas, cada uno dice de qué familia es con su nombre entero en vez de las dos letras: «¿quién duerme en el 12?» se contesta con un nombre.',
      'Y la evaluación del sitio baja a su propio renglón, debajo de la fila y a lo ancho, así que caben dos líneas enteras en vez de media.',
      'Está redactada y ya no va de coña: la gracia la ponen las notas que escribís vosotros, y encima de ellas sobraba. Dice lo bueno primero y lo malo después, para decidir con qué bungalow te quedas.',
    ],
  },
  {
    version: '0.53.0',
    fecha: '2026-08-16',
    titulo: 'Los bungas se cuentan solos',
    lineas: [
      'En Grupo → Bungas, cada uno lleva debajo una frase con guasa que resume sus pegatinas y sus notas: cuál es el bueno se ve sin abrir los seis.',
      'La escribe la IA sola, en cuanto cambias una nota o una pegatina dentro del bunga, y se guarda con el sitio: la rehace quien lo toca y la leemos todos. No hay que acordarse de pulsar nada.',
      'Los bungas admiten comentarios, como los planes y los gastos. Avisan a la familia que duerme ahí y a quien ya escribió en el hilo, y tocar el aviso abre ese bunga.',
      'Y en la lista, de quién es cada uno se ve por el emoji y las dos letras de su familia, que es como se firman las ideas y los votos.',
      'El estado de la familia se retira: quien dice en qué anda es cada persona, y el de la casa lo ponía uno en junio y ahí se quedaba.',
    ],
  },
  {
    version: '0.52.0',
    fecha: '2026-08-16',
    titulo: '«La app», de seis párrafos a cuatro renglones',
    lineas: [
      'Ajustes → 🐳 La app es ahora una ficha de cuatro datos —la versión del binario, la del paquete OTA, cuándo fue la última sincronización y si la base de datos está al día— y dos botones: poner la app al día y poner la base al día.',
      'Los dos números de versión salen siempre, coincidan o no: esa diferencia es la que distingue «no ha actualizado» de «el binario se ha quedado atrás», y antes solo se decía dentro de una frase.',
      'El botón de la base ya no aparece y desaparece: está siempre y se apaga cuando no hay nada que aplicar. Y el renglón dice en qué estado está en vez de dejar el hueco en blanco mientras pregunta.',
      'Se retira «Sincronizar todo», que hacía lo mismo que el punto verde de la cabecera —y ese está en todas las pantallas—. Aquí se queda el dato: cuándo fue la última.',
    ],
  },
  {
    version: '0.51.0',
    fecha: '2026-08-16',
    titulo: 'La app se acuerda de los avisos',
    lineas: [
      'Si tienes los avisos apagados, «Hoy» te lo recuerda una vez por semana con el botón para encenderlos. «Ahora no» lo aparta otros siete días.',
      'Si ya dijiste que no en su día, te dice dónde se encienden: iOS no vuelve a preguntar por su cuenta, así que hay que ir a los Ajustes del iPhone.',
      'En Grupo, la ficha de cada familia vuelve a decir su bunga —por su nombre— y tocarlo lleva a su pantalla: sus notas, sus pegatinas y quién ha estado otros años.',
      'Y en Ajustes se retira el renglón que decía que «El grupo» se había mudado a su pestaña: lleva tiempo ahí abajo, en la barra.',
    ],
  },
  {
    version: '0.50.0',
    fecha: '2026-08-16',
    titulo: 'Grupo en tres áreas, y los avisos que no llegaban',
    lineas: [
      'Grupo se parte en tres: Familias, Bungas y Gadgets. Cada familia es un desplegable que dice su estado y cuántos son, así que la lista entera cabe de un vistazo y se abre solo la que buscas.',
      'Y ya no hace falta esperar a que lo haga uno: cada adulto edita lo de su familia y lo de los bungas —colocarlos, ponerles alias, apuntar sus notas— y el gadget de su casa. Crear o borrar familias y mover gente entre ellas siguen siendo de quien administra, porque cambian el reparto de todos.',
      'Los avisos de gastos y de comentarios ya llegan de verdad: el servidor los componía sin la lista de personas y no mandaba ninguno, sin fallar ni decirlo. «Gastos que te tocan» no había avisado nunca desde que existe.',
      'Y una tabla nueva sin migrar ya no deja al grupo entero sin sincronizar: llega vacía en vez de tumbar la instantánea.',
      'Un plato guarda ahora cómo se hace: un campo de texto libre debajo de los ingredientes, para lo que se lee delante del fuego. En el catálogo, los que tienen receta escrita lo dicen en su fila.',
      'Y «Qué ha cambiado» —esto que estás leyendo— es su propio apartado de Ajustes, el último, en vez del final de «La app»: se lee después de actualizar, no hay que abrir la solapa de los botones para llegar.',
    ],
  },
  {
    version: '0.49.0',
    fecha: '2026-08-16',
    titulo: 'Quien no tiene iPhone ya puede entrar',
    lineas: [
      'En Ajustes → Cuentas hay «Entrar sin iPhone»: eliges a quién, sale un enlace y se lo mandas. Lo abre en el navegador de cualquier móvil u ordenador y entra con todo lo del grupo.',
      'El enlace vale una sola vez y caduca a los tres días. Si se pierde o acaba donde no debía, genera otro: el anterior deja de valer en el acto.',
      'En el navegador no hay avisos, y la app se ve como un móvil grande en un portátil. Sin enlace, la web sigue siendo la libreta local de siempre.',
      'Y en Planes, «Devolver a ideas» lo puede hacer cualquier adulto, no solo quien lleva el grupo: si tú puedes proponer un plan, puedes retirarlo.',
      'Ajustes → 🐳 La app queda ordenada en tres bloques con su rótulo —los datos, la versión y la base de datos—, con «Qué ha cambiado» al final en vez de en medio del botón de actualizar.',
      'Tu perfil está ahora detrás de tu emoji, arriba a la derecha: el emoji, la foto y el estado, a un toque desde cualquier pantalla. El apartado «Quién eres» de Ajustes se retira — quién eres lo dice tu cuenta desde hace tiempo.',
    ],
  },
  {
    version: '0.48.0',
    fecha: '2026-08-16',
    titulo: 'La pestaña «Grupo», y seis cosas nuevas',
    lineas: [
      'La quinta pestaña ya no es Ajustes: es «Grupo», con las familias, su bunga, su gente y el cacharro que trae cada una, que se vota. Ajustes se ha ido a la rueda pequeña de arriba a la derecha, y el mismo botón lo cierra.',
      'Hay planes que no se votan: dentro de un plan hay «Se vota / Se hace y punto», y lo decidido sale en su grupo sin votos ni «faltan N por votar». Al proponer una idea se pregunta cuál de las dos.',
      'Comentarios en los planes, en los gastos y en cada día. La fila dice cuántos hay y enciende un punto si alguno no lo has visto, y avisa a quien votó, a quien le toca el gasto y a quien ya escribió en el hilo.',
      'La compra se apunta «para todos» o para una familia, y la lista sale en secciones. Se sigue viendo entera: quien va al súper se la lleva de un vistazo.',
      'Trucos (Planes → Trucos): lo que hay que acordarse de un viaje a otro, y que no cuelga de este viaje. Y el bunga guarda notas y pegatinas que tampoco se van con el evento, más quién ha estado en él cada año.',
      'Quien administra puede marcar a alguien como que «lleva las cuentas»: le llegan todos los gastos, le toquen o no, y los que se borren. Y tocar una notificación abre lo que la ha generado, cambiando de viaje si hace falta.',
    ],
  },
  {
    version: '0.47.0',
    fecha: '2026-08-15',
    titulo: 'Un «pagado» sin querer ya se deshace',
    lineas: [
      'En Saldos, desliza una fila de «Pagos apuntados» y sale «Deshacer». Antes, un toque sin querer en «pagado» dejaba un pago que no había forma de quitar y descuadraba el saldo de dos familias.',
      'La pregunta dice qué vuelve a deberse y a quién, y ahora se enseña sola: antes podía abrirse fuera de la pantalla y parecía que el botón no hacía nada. Vale para todos los borrados de la app.',
    ],
  },
  {
    version: '0.46.0',
    fecha: '2026-08-15',
    titulo: 'El recap del viaje, y «Mayores» son los mayores',
    lineas: [
      'Se va apuntando lo que hace el grupo —gastos, cenas, votos, la compra, los estados— y al final de Números está «El recap»: cuántas cosas, quién ha andado más y el diario por días.',
      'En un gasto, «Mayores» ya son todos los que no son niños según su edad, y no una casilla escondida en cada ficha que podía decir lo contrario.',
      'Y el atajo «Peques» se retira: un gasto solo de los niños no lo apunta nadie, y quien lo necesite lo tiene con «Nadie» y dos toques.',
    ],
  },
  {
    version: '0.45.0',
    fecha: '2026-08-15',
    titulo: 'Un bunga se puede corregir aunque tenga familia',
    lineas: [
      'Toca la pastilla del bunga en la ficha de una familia y ahora, además de cambiárselo, puedes editar el que tiene: su nombre y su mote.',
      'Hasta ahora solo se podían corregir los bungas que no eran de nadie, así que en cuanto se repartían quedaban escritos para siempre.',
    ],
  },
  {
    version: '0.44.0',
    fecha: '2026-08-15',
    titulo: 'Agenda abre el calendario, y caben tres emojis',
    lineas: [
      'Pulsar «Agenda» lleva a los días del viaje. «Hoy» sigue siendo lo primero al abrir la app, y está a un toque.',
      'En el emoji de una persona o una familia caben ahora tres, y por fin cabe uno de familia (👨‍👩‍👧), que antes no entraba de ninguna manera.',
    ],
  },
  {
    version: '0.43.0',
    fecha: '2026-08-14',
    titulo: 'Lo nuevo aparece al minuto',
    lineas: [
      'Con la app abierta se trae lo del grupo cada minuto, en vez de cada minuto y medio.',
      'Y la app se mira sola si hay versión nueva: la pone al volver a ella desde otra app, para no recargarte encima de un gasto a medio escribir.',
    ],
  },
  {
    version: '0.42.0',
    fecha: '2026-08-14',
    titulo: 'Hoy te pregunta en qué andas',
    lineas: [
      'Si aún no has dicho nada, «Quién anda en qué» abre con tu invitación: un toque y lo cuentas.',
      'Cambiar de persona vuelve, pero solo para quien lleva el grupo: es como puede mirar la app tal como la ve otro.',
    ],
  },
  {
    version: '0.41.0',
    fecha: '2026-08-14',
    titulo: 'Organizar el viaje es de los adultos',
    lineas: [
      'Montar cenas, pasar una idea a propuesta y colocar el día pasan a ser cosa de los adultos, como ya lo era el dinero.',
      'Votar planes, apuntar ideas, marcar la compra y mirarlo todo siguen siendo de todos: el día se abre igual, solo que sus renglones no se tocan.',
      'El viaje —su nombre, el sitio y las fechas— lo lleva quien administra el grupo: cambiar las fechas aparta cenas y planes de todos.',
      '«Quién anda en qué» va ahora uno debajo de otro: antes se desplazaba de lado, así que ni se veía quién más había ni cabía el estado entero.',
      'Y el recadillo de la ballena sube al principio de la pantalla, bajo el selector: al final de la lista no lo leía nadie.',
    ],
  },
  {
    version: '0.40.0',
    fecha: '2026-08-14',
    titulo: 'Quién eres ya no se elige: lo dice tu cuenta',
    lineas: [
      'Eres la persona con la que te enlazó quien lleva el grupo, y ya no se puede cambiar desde el móvil — así nadie apunta gastos en el sitio de otro.',
      'Si te habías elegido mal, se corrige solo al abrir la app.',
      'En la libreta local y en la demostración se sigue eligiendo a mano, que es donde no hay cuenta que lo diga.',
    ],
  },
  {
    version: '0.39.0',
    fecha: '2026-08-14',
    titulo: 'La app ya sabe quién eres, y el dinero lo tocan los adultos',
    lineas: [
      'Cuando te dan acceso, tu móvil se pone solo con tu persona: ya no hay que elegirse en Ajustes.',
      'Gastos y Saldos son cosa de los adultos. Los peques y los adolescentes lo ven todo, pero no lo tocan.',
      'Hay una edad nueva, Adolescente: cuenta como un adulto en el reparto y en la mesa; lo único que cambia es el dinero.',
      'El grupo —familias, bungas y gente— lo edita quien lleva el grupo; los demás lo ven.',
      'Sincronización y Actualizar eran lo mismo contado dos veces: ahora son un solo apartado, «La app».',
    ],
  },
  {
    version: '0.38.0',
    fecha: '2026-08-09',
    titulo: 'En Comidas, «Platos» pasa a llamarse «Carta»',
    lineas: [
      'Es el catálogo de lo que sabéis cocinar, y «Platos» se confundía con los platos de esa cena, que son los que se marcan en Cenas y en el día.',
    ],
  },
  {
    version: '0.37.1',
    fecha: '2026-08-09',
    titulo: 'Los avisos no esperan a la migración para volver a sonar',
    lineas: [
      'Con la base todavía sin poner al día, los avisos nuevos tumbaban también a los que ya funcionaban, y sin decir nada.',
      'Ahora, mientras falte la migración, todo se considera encendido y los avisos salen igual. Elegir cuáles recibir sí necesita aplicarla, en Ajustes → Actualizar.',
    ],
  },
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
