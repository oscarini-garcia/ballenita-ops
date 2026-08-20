// Generado por `herramientas/generar-migraciones.mjs` — no editar a mano.
//
// Es la copia de `migraciones/*.sql` que viaja dentro del Worker, para que
// quien administra pueda poner la base al día desde Ajustes → Actualizar
// (SPECS §14.23) sin un portátil delante. `test/migraciones.test.js` comprueba
// que coincide con el directorio: si añades una migración, vuelve a lanzar
//
//   npm run generar:migraciones

export const MIGRACIONES = [
  {
    id: '0001_esquema',
    sql: `-- Esquema de Ballena Ops sobre D1.
--
-- Dos familias de tablas:
--
--   · \`cuenta\` y \`dispositivo\`, que son del servidor: quién entra y desde dónde.
--   · el resto, que son el registro del grupo y se sincronizan con los móviles.
--
-- Las columnas se llaman igual que los campos del cliente (\`eventId\`,
-- \`amountCents\`, \`updatedAt\`) para que no haga falta traducir nombres entre la
-- base y la PWA; la razón está en \`src/tablas.js\`.
--
-- Nada se borra físicamente: \`borrado = 1\` marca la fila y deja de transmitirse.
-- Un borrado físico volvería a aparecer en cuanto otro móvil subiera una cola
-- vieja que aún mencionara esa fila.

-- --------------------------------------------------------------------------
-- Identidad
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cuenta (
  id           TEXT PRIMARY KEY,
  appleSub     TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL DEFAULT '',
  email        TEXT,
  -- 'administrador' puede dar de alta a otras cuentas; 'miembro' solo usa la app.
  rol          TEXT NOT NULL DEFAULT 'miembro',
  activa       INTEGER NOT NULL DEFAULT 1,
  creadoEn     TEXT NOT NULL,
  ultimoAcceso TEXT
);

CREATE TABLE IF NOT EXISTS dispositivo (
  id                   TEXT PRIMARY KEY,
  cuentaId             TEXT NOT NULL REFERENCES cuenta(id),
  plataforma           TEXT,
  ultimaSincronizacion TEXT
);

-- --------------------------------------------------------------------------
-- Registro del grupo
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  lugar     TEXT,
  currency  TEXT,
  startDate TEXT,
  endDate   TEXT,
  status    TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS families (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  name      TEXT,
  color     TEXT,
  avatar    TEXT,
  estado    TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bungas (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  name      TEXT,
  alias     TEXT,
  familyId  TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS persons (
  id                      TEXT PRIMARY KEY,
  eventId                 TEXT,
  name                    TEXT,
  apodo                   TEXT,
  familyId                TEXT,
  edad                    TEXT,
  comeConMayores          INTEGER,
  cuentaComoAdultoReparto INTEGER,
  pesoReparto             REAL,
  avatar                  TEXT,
  estado                  TEXT,
  updatedAt               TEXT NOT NULL,
  creadoEn                TEXT NOT NULL,
  borrado                 INTEGER NOT NULL DEFAULT 0
);

-- \`payers\` y \`participantIds\` son JSON: pertenecen al gasto y no se consultan
-- por separado. Quien reparte es \`lib/reparto.js\` en el cliente, no SQL.
CREATE TABLE IF NOT EXISTS expenses (
  id             TEXT PRIMARY KEY,
  eventId        TEXT,
  description    TEXT,
  amountCents    INTEGER,
  currency       TEXT,
  amountOriginal REAL,
  rate           REAL,
  category       TEXT,
  dateISO        TEXT,
  payers         TEXT,
  participantIds TEXT,
  updatedAt      TEXT NOT NULL,
  creadoEn       TEXT NOT NULL,
  borrado        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settlements (
  id            TEXT PRIMARY KEY,
  eventId       TEXT,
  dateISO       TEXT,
  fromFamilyId  TEXT,
  toFamilyId    TEXT,
  amountCents   INTEGER,
  updatedAt     TEXT NOT NULL,
  creadoEn      TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0
);

-- Catálogo global de platos: la única tabla que no cuelga de un evento, para
-- poder reutilizar la paella del año pasado en el viaje de este.
CREATE TABLE IF NOT EXISTS dishes (
  id           TEXT PRIMARY KEY,
  name         TEXT,
  categorias   TEXT,
  esFavorito   INTEGER,
  ingredientes TEXT,
  updatedAt    TEXT NOT NULL,
  creadoEn     TEXT NOT NULL,
  borrado      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dinners (
  id              TEXT PRIMARY KEY,
  eventId         TEXT,
  dia             TEXT,
  platoIds        TEXT,
  bungaMayoresId  TEXT,
  bungaNinosId    TEXT,
  queSeHace       TEXT,
  cantidades      TEXT,
  updatedAt       TEXT NOT NULL,
  creadoEn        TEXT NOT NULL,
  borrado         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,
  eventId       TEXT,
  titulo        TEXT,
  descripcion   TEXT,
  dia           TEXT,
  costeEstimado INTEGER,
  ubicacion     TEXT,
  enlace        TEXT,
  estado        TEXT,
  votos         TEXT,
  updatedAt     TEXT NOT NULL,
  creadoEn      TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop (
  id          TEXT PRIMARY KEY,
  eventId     TEXT,
  texto       TEXT,
  categoria   TEXT,
  comprado    INTEGER,
  compradoPor TEXT,
  compradoEn  TEXT,
  updatedAt   TEXT NOT NULL,
  creadoEn    TEXT NOT NULL,
  borrado     INTEGER NOT NULL DEFAULT 0
);

-- Todas las lecturas de la sincronización son «lo vivo de este evento», así que
-- el índice útil es el mismo en todas partes.
CREATE INDEX IF NOT EXISTS idx_families_evento    ON families(eventId)    WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_bungas_evento      ON bungas(eventId)      WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_persons_evento     ON persons(eventId)     WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_expenses_evento    ON expenses(eventId)    WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_settlements_evento ON settlements(eventId) WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_dinners_evento     ON dinners(eventId)     WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_plans_evento       ON plans(eventId)       WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_shop_evento        ON shop(eventId)        WHERE borrado = 0;
`,
  },
  {
    id: '0002_cuenta_persona',
    sql: `-- Una cuenta de Apple queda enlazada con una persona del grupo.
--
-- Hasta aquí, «tener acceso» y «ser alguien del viaje» eran dos cosas sin
-- relación: la cuenta sabía el nombre que Apple entregó una única vez, y la
-- persona —la que paga, la que cena, la que cuenta en el reparto— vivía en la
-- instantánea sin saber nada de cuentas. Eso obligaba a que cada uno se
-- eligiera a sí mismo en «Quién eres» y a creerse la elección.
--
-- Con el enlace, quien administra decide **quién es quién** una sola vez, y de
-- paso el enlace es la llave: una cuenta sin persona no entra, y por eso el
-- alta deja de ser un código que alguien copia y pega para pasar a ser una
-- solicitud que aparece sola en Ajustes → Cuentas.
ALTER TABLE cuenta ADD COLUMN personId TEXT;
`,
  },
  {
    id: '0003_configuracion',
    sql: `-- Ajustes del servidor que no son del grupo ni de nadie en concreto.
--
-- El primero es la clave de la IA, y es la razón de que esta tabla exista en vez
-- de guardarla en el móvil de quien administra: es una credencial de pago, no
-- debe viajar a ningún dispositivo, y las llamadas al modelo salen del Worker
-- —donde el texto se compone con lo que ya está en la base— y no del teléfono.
-- Es el modelo de \`garciadoral-ops\` (\`api/src/redaccion.js\`).
CREATE TABLE IF NOT EXISTS configuracion (
  clave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL DEFAULT '',
  actualizadoEn TEXT NOT NULL
);
`,
  },
  {
    id: '0004_dispositivo_push',
    sql: `-- El token de APNs de cada dispositivo, para poder avisar cuando la app está
-- cerrada.
--
-- Vive en \`dispositivo\` y no en \`cuenta\` porque una persona tiene un teléfono y
-- un iPad y quiere el aviso en los dos, y porque el token es de la instalación:
-- se renueva al reinstalar y muere cuando se desinstala. \`avisos\` es el permiso
-- tal como está en ese aparato, que es donde se concede y se retira.
ALTER TABLE dispositivo ADD COLUMN tokenPush TEXT;
ALTER TABLE dispositivo ADD COLUMN avisos INTEGER NOT NULL DEFAULT 1;
`,
  },
  {
    id: '0005_demo_y_platos_por_evento',
    sql: `-- El evento de demostración deja de contaminar el catálogo compartido.
--
-- \`dishes\` era la única tabla que no colgaba de un evento: un catálogo global,
-- y a propósito —la paella no se reescribe cada verano—. El problema es que el
-- evento «Demo» escribía en ese mismo catálogo, así que sus seis platos de
-- mentira aparecían al preparar un viaje de verdad, y cualquier plato apuntado
-- mientras se trasteaba se quedaba allí para siempre.
--
-- Ahora un plato puede llevar \`eventId\`. Sin él es del catálogo de todos (el
-- comportamiento de siempre, y por eso la columna es NULL por defecto); con él
-- pertenece solo a ese evento, que hoy es únicamente el Demo. \`events.esDemo\`
-- es lo que distingue a ese evento de un viaje.
--
-- \`0001_esquema.sql\` es el esquema **original** y no se toca: cada columna
-- posterior la añade su migración, y así aplicarlas todas en orden reproduce lo
-- que hay en producción — que es justo lo que comprueba \`test/d1.js\`.
--
--   npm run migrar:remoto5

ALTER TABLE events ADD COLUMN esDemo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dishes ADD COLUMN eventId TEXT;
`,
  },
  {
    id: '0006_ideas_de_plan',
    sql: `-- El catálogo de ideas de plan.
--
-- Un plan era dos cosas en la misma fila: la **idea** que se repite cada verano
-- —«Playa de la Cala», su ubicación, su enlace— y la **propuesta de este año**,
-- con su día, su estado y sus votos. Reutilizar un plan de otro viaje habría
-- arrastrado el día del año pasado y votos de gente que este año no viene.
--
-- Se parte en dos, con la misma figura que \`dishes\` ↔ \`dinners\`: un catálogo, y
-- lo que se hace con él. \`planIdeas\` guarda lo que se repite; \`plans\` sigue
-- guardando la propuesta y añade \`ideaId\`, que es solo de dónde salió —al traer
-- se **copia**, no se enlaza, así que corregir el catálogo no reescribe un viaje
-- ya planeado—.
--
-- \`planIdeas.eventId\` es el mismo trato que el de los platos: nulo significa
-- «del catálogo de todos», con valor significa «solo de ese evento», que hoy es
-- únicamente el Demo. Decidido en \`docs/diseño/planes-catalogo.html\` · A3 · B3 · C1.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto6

CREATE TABLE IF NOT EXISTS planIdeas (
  id            TEXT PRIMARY KEY,
  titulo        TEXT,
  descripcion   TEXT,
  ubicacion     TEXT,
  enlace        TEXT,
  costeEstimado INTEGER,
  eventId       TEXT,
  updatedAt     TEXT NOT NULL,
  creadoEn      TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE plans ADD COLUMN ideaId TEXT;
`,
  },
  {
    id: '0007_idea_con_autor',
    sql: `-- La idea dice quién la apuntó, y pierde dos campos que no se usaban.
--
-- \`creadaPor\` es una **persona del grupo** y no una cuenta: en la lista de ideas
-- lo que se quiere leer es «la apuntó Curro», y las cuentas de Apple no tienen
-- nombre hasta que alguien las enlaza. Una idea traída de la IA o importada se
-- queda sin autor, que es cierto y se dice así.
--
-- \`ubicacion\` y \`costeEstimado\` se retiran: el sitio ya cabía en la descripción
-- y el coste no se usó nunca. SQLite no deja quitar una columna sin rehacer la
-- tabla, y rehacerla por dos campos vacíos no compensa: dejan de declararse en
-- \`tablas.js\`, así que ni se leen ni se escriben ni viajan.
--
--   npm run migrar:remoto7

ALTER TABLE planIdeas ADD COLUMN creadaPor TEXT;
`,
  },
  {
    id: '0008_alias_de_familia_y_fechas',
    sql: `-- El alias de dos letras de una familia, y las dos fechas de una idea.
--
-- **\`families.alias\`** — «GA», «PE», «SO». Los bungas ya tenían alias
-- (\`bungas.alias\`, «El de la piscina»); las familias no. Hace falta para la
-- lista de ideas, donde la firma de una fila es «Curro · GA · hace 3 días» y el
-- nombre entero de la familia no cabe en una línea de 15,7 pt junto al nombre de
-- la persona y la fecha. Decidido en \`docs/diseño/planes-ideas.html\` · D3, donde
-- además se propone solo desde el nombre: el único fallo que rompe esa fila es
-- que el alias esté vacío.
--
-- **\`planIdeas.apuntadaEl\`** y **\`plans.propuestoEl\`** — el «cuándo» de una
-- idea, que hasta ahora no existía en el móvil. \`creadoEn\` lo pone el Worker al
-- insertar y solo vuelve en la instantánea, así que una idea recién apuntada no
-- tenía fecha hasta sincronizar, y en la web —que no sincroniza a propósito— no
-- la tenía nunca. Estas dos las escribe **el cliente** al crear, así que están
-- desde el primer pintado y funcionan sin API.
--
-- Son dos fechas y no una porque son dos hechos distintos: cuándo se apuntó la
-- idea al catálogo (puede ser de hace tres agostos) y cuándo se propuso a *este*
-- viaje. La lista enseña la que corresponde a cada grupo
-- (\`docs/diseño/planes-ideas.html\` · F2).
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto8

ALTER TABLE families  ADD COLUMN alias       TEXT;
ALTER TABLE planIdeas ADD COLUMN apuntadaEl  TEXT;
ALTER TABLE plans     ADD COLUMN propuestoEl TEXT;
`,
  },
  {
    id: '0009_recetas_con_cantidades',
    sql: `-- Cantidades en las recetas, y la compra que sale de ellas (SPECS §14.20).
--
-- \`dishes.raciones\` es para cuántos es la receta, sin lo cual una cantidad no se
-- puede estirar: «2 kg» no se reparte entre dos mesas porque falta el
-- denominador. Los ingredientes pasan de nombres sueltos a objetos con cantidad,
-- unidad y lote de compra, y siguen viviendo en la misma columna JSON: lo que
-- había guardado se lee como líneas sin cantidad, que es lo que son.
ALTER TABLE dishes ADD COLUMN raciones REAL;

-- La mesa de niños puede comer otra cosa. En NULL hereda la lista de arriba, que
-- es la noche normal y la que no hay que escribir dos veces.
ALTER TABLE dinners ADD COLUMN platoIdsNinos TEXT;

-- De dónde sale cada línea de la compra. \`mano\` es lo de siempre y no se toca
-- nunca al recalcular; \`cena\` viene de una receta y es lo único que se rehace
-- solo. \`clave\` empareja la línea con su ingrediente entre recálculos.
ALTER TABLE shop ADD COLUMN origen TEXT NOT NULL DEFAULT 'mano';
ALTER TABLE shop ADD COLUMN clave TEXT;
ALTER TABLE shop ADD COLUMN cantidad REAL;
ALTER TABLE shop ADD COLUMN unidad TEXT NOT NULL DEFAULT '';
ALTER TABLE shop ADD COLUMN desglose TEXT;
ALTER TABLE shop ADD COLUMN cambio TEXT;
`,
  },
  {
    id: '0010_mejoras',
    sql: `-- Las mejoras: el roadmap de la app, apuntado desde el móvil.
--
-- La figura es el bloque «Mejoras» de \`garciadoral-ops\` y la decisión entera
-- está en \`docs/diseño/mejoras.html\` (A1 · B1 · C2 · D2 · E1 · F2): ideas sobre
-- la propia aplicación, que ven todos y cualquiera tacha. No se llaman «ideas»
-- porque una idea aquí es una idea de plan (\`planIdeas\`), y compartir nombre
-- obligaría a cada consulta a decir de cuál habla.
--
-- Es una tabla sincronizada y no una nota del móvil: sobre una mejora se actúa
-- en otra máquina, y una nota que esa máquina no lee se atiende cuando alguien
-- se acuerda de copiarla (\`meeting-ops-air\` lo hizo en localStorage y lo
-- deshizo). Viaja por la cola de siempre, sin ruta propia de escritura.
--
-- \`hecho\` va sin quién ni cuándo a propósito: eso sería un registro de trabajo
-- y esto es una lista de la compra. \`autorId\` es una persona del grupo, como
-- \`planIdeas.creadaPor\`. \`apuntadaEl\` la escribe el cliente al crear —\`creadoEn\`
-- es del servidor y no existe hasta sincronizar (§14.19-ter)—. \`eventId\` nulo
-- significa «de todos»; con valor, solo de ese evento, que hoy es únicamente el
-- Demo (§14.9-quater).
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto10

CREATE TABLE IF NOT EXISTS mejoras (
  id         TEXT PRIMARY KEY,
  texto      TEXT,
  hecho      INTEGER NOT NULL DEFAULT 0,
  autorId    TEXT,
  apuntadaEl TEXT,
  eventId    TEXT,
  updatedAt  TEXT NOT NULL,
  creadoEn   TEXT NOT NULL,
  borrado    INTEGER NOT NULL DEFAULT 0
);
`,
  },
  {
    id: '0011_cocina_del_evento',
    sql: `-- Con qué se cocina en este viaje, para que la IA lo tenga en cuenta.
--
-- Proponer platos «de camping» a ciegas sale mal en las dos direcciones: sugiere
-- cosas de horno, que no hay, y no sugiere las de barbacoa, que es donde se hace
-- casi todo. El dato es del **evento** y no de la app, porque cambia con el
-- sitio: otro año, otro camping y otros cacharros.
--
-- Es texto libre a propósito. Una lista de cacharros con casillas obligaría a
-- decidir de antemano cuáles existen, y lo que de verdad hace falta contarle al
-- modelo es la frase entera —«en el bungaló se puede hacer algo en sartén, pero
-- poco: da mucho calor»—, que ninguna casilla dice.
--
-- **Vacío no es vacío**: vale el texto de origen (\`api/src/cocina.js\`), igual
-- que con los encargos (§14.16-quater). Así funciona sin que nadie rellene nada
-- y se puede corregir sin publicar una versión.
--
-- Solo se lee al componer el material de la IA (§14.20-quater). No toca la
-- compra, ni las cenas, ni los saldos.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto11

ALTER TABLE events ADD COLUMN cocina TEXT;
`,
  },
  {
    id: '0012_reparto_del_gasto',
    sql: `-- Cómo se reparte un gasto, cuando no basta con «quién entra».
--
-- Hasta ahora un gasto guardaba \`participantIds\` —una lista de personas— y el
-- reparto salía de multiplicar por el **peso** de cada una (1 el mayor, 0,6 el
-- niño) en \`app/src/lib/reparto.js\`. Con eso se puede decir *quién* entra, pero
-- no *cuánto*: «la mitad los Pérez y la otra mitad entre los demás» no cabía en
-- ningún sitio, y es una conversación que pasa cada agosto.
--
-- \`reparto\` es JSON y tiene tres formas:
--
--   NULL                                                    ← por pesos, lo de siempre
--   {"modo":"partes",  "porFamilia":{"garcia":2,"perez":1}}
--   {"modo":"importes","porFamilia":{"garcia":1040,"perez":350}}
--
-- **NULL es un valor con sentido**, no un hueco: significa «por pesos». Por eso
-- la columna no lleva \`DEFAULT\` ni \`NOT NULL\`, y por eso los gastos ya apuntados
-- no hay que tocarlos — siguen valiendo exactamente lo que valían. Un cliente
-- viejo que no entienda la columna sigue leyendo el gasto y sacando la cuenta de
-- antes; uno nuevo con un gasto viejo, también.
--
-- Los importes van en **céntimos enteros**, como todo el dinero de la casa.
-- Guardar porcentajes habría sido más bonito de leer y habría costado el
-- céntimo: 42,8 % de 24,30 € son 10,4004 €, y redondear en cada lectura rompe la
-- regla de oro —los hechos se sincronizan, los saldos se calculan, y **tienen
-- que salir iguales en todos los móviles**—.
--
-- Los tres modos pasan por \`splitCents()\`, que es el mismo método del resto
-- mayor que ya repartía por pesos: no se pierde ni se inventa un céntimo, y no
-- hay código nuevo de aritmética.
--
-- Ver SPECS §14.26 y \`docs/diseño/gasto-nuevo.html\` · E2.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto12

ALTER TABLE expenses ADD COLUMN reparto TEXT;
`,
  },
  {
    id: '0013_cuando_se_puso_el_estado',
    sql: `-- Cuándo se puso el estado de una persona (SPECS §14.36).
--
-- **\`persons.estadoEl\`** — la hora a la que alguien escribió su estado. Hasta
-- ahora se guardaba el estado y no cuándo, y la tira de «Quién anda en qué» de
-- «Hoy» se ordenaba por nombre: leída dos veces al día, lo nuevo no se
-- distinguía de lo de anteayer.
--
-- No vale \`updatedAt\`, que es lo que ya había: esa se mueve con **cualquier**
-- cambio de la persona —el apodo, el emoji, la foto—, así que quien corrige su
-- apodo saltaría al principio de la tira con un estado de hace tres días. Son
-- dos hechos distintos y por eso son dos columnas.
--
-- La escribe **el cliente** al guardar, como \`planIdeas.apuntadaEl\` (0008): así
-- está desde el primer pintado y funciona sin API, que es como va la web.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto13

ALTER TABLE persons ADD COLUMN estadoEl TEXT;
`,
  },
  {
    id: '0014_avisos_por_clase',
    sql: `-- Qué avisos quiere recibir cada cuenta (SPECS §14.39).
--
-- **\`cuenta.avisosClases\`** — un JSON con las clases apagadas a mano, p. ej.
-- \`{"estado":false}\`. Lo que no está nombrado está encendido: así una clase
-- nueva llega encendida a todo el mundo sin tener que tocar ninguna fila, que es
-- lo contrario de guardar la lista de las que sí se quieren.
--
-- **No va en \`dispositivo\`**, donde ya vive \`avisos\`, porque son dos cosas
-- distintas y se retiran en sitios distintos: \`dispositivo.avisos\` es el permiso
-- del sistema en ese aparato —se da y se quita en iOS— y esto es qué te interesa
-- saber, que es de la persona y vale igual en el móvil y en el iPad. Mezclarlas
-- obligaría a apagar «los estados» dos veces a quien tiene dos aparatos.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto14

ALTER TABLE cuenta ADD COLUMN avisosClases TEXT;
`,
  },
  {
    id: '0015_registro',
    sql: `-- El registro: qué ha hecho cada uno, para el recap del final (SPECS §14.50).
--
-- Es una tabla sincronizada y no un log del móvil porque la gracia está en
-- **juntar**: un recap que solo cuenta lo que tecleaste tú no es un recap. Viaja
-- por la cola de siempre, sin ruta propia de escritura, como \`mejoras\`.
--
-- \`texto\` llega **ya compuesto** desde el móvil que hizo la cosa, y el Worker no
-- lo rehace. La frase depende de cómo estaba la fila en ese momento —«borró “Cena
-- del sábado”»— y una cena borrada en agosto no puede volver a decir de qué día
-- era. Rehacerlo aquí obligaría además a que el servidor supiera de cenas, de
-- planes y de la compra, que es justo lo que la regla de oro no quiere.
--
-- \`tabla\` y \`filaId\` no los mira el recap: están para que el cliente reconozca
-- «esto es lo mismo otra vez» y actualice el renglón en vez de añadir otro
-- (\`MISMA_COSA_MS\`). Sin eso, corregir un gasto cuatro veces son cuatro
-- renglones y el recap lo escribe quien más dudó al teclear.
--
-- \`personId\` es una persona del grupo, como \`planIdeas.creadaPor\`. Puede ser
-- NULL: en la libreta local y en la demostración no hay nadie elegido, y un
-- renglón sin dueño sigue contando qué pasó.
--
-- \`cuando\` la escribe el cliente, no el servidor: es cuándo se hizo la cosa, y
-- \`creadoEn\` es cuándo llegó aquí — con la app sin red pueden ser días distintos.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto15

CREATE TABLE IF NOT EXISTS registro (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  personId  TEXT,
  tabla     TEXT,
  filaId    TEXT,
  accion    TEXT,
  clase     TEXT,
  texto     TEXT,
  cuando    TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

-- El recap se lee siempre por evento y por fecha, y esta tabla es la única que
-- crece con cada toque: sin índice, un viaje de mil renglones recorre la tabla
-- entera cada vez que alguien abre Números.
CREATE INDEX IF NOT EXISTS idx_registro_evento ON registro (eventId, cuando);
`,
  },
  {
    id: '0016_grupo_en_su_pestana',
    sql: `-- La tanda del grupo: seis cosas nuevas en una sola migración (SPECS §14.52–§14.58).
--
-- Van juntas porque salen de la misma vuelta y porque **una migración se aplica
-- a mano** (§14.23): partirlas en seis obligaría a pulsar seis veces desde el
-- móvil, y a que quedar a medias fuera un estado posible. Aplicar esto entero es
-- todo o nada, que es lo que queremos.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto16

-- ── 1. La compra por familia (§14.54) ────────────────────────────────────────
--
-- NULL = línea común, que es como nacen todas las de siempre y todas las que
-- calculan las cenas. Por eso no lleva \`DEFAULT\` ni \`NOT NULL\`: los ítems ya
-- apuntados siguen valiendo lo que valían, sin tocarlos.
ALTER TABLE shop ADD COLUMN familyId TEXT;

-- ── 2. Quién lleva las cuentas (§14.58) ──────────────────────────────────────
--
-- No es un rasgo de la persona sino un **encargo**: lo pone quien administra y
-- no se deduce de la edad. Nace apagado para todo el mundo, que es lo correcto —
-- encenderlo a todos convertiría el primer gasto del viaje en nueve avisos.
ALTER TABLE persons ADD COLUMN llevaLasCuentas INTEGER NOT NULL DEFAULT 0;

-- ── 3. El bunga apunta a su sitio (§14.56) ───────────────────────────────────
--
-- Hasta hoy \`bungas\` colgaba de un evento y nada más, así que el «Bunga 12» de
-- 2025 y el de 2026 eran **dos filas sin nada que las una**: una nota escrita
-- este agosto se iba con el evento, y el histórico de qué familia durmió dónde
-- no existía. NULL = un bunga suelto de este viaje, que es lo que eran todos.
ALTER TABLE bungas ADD COLUMN alojamientoId TEXT;

-- ── 4. El catálogo de alojamientos (§14.56) ──────────────────────────────────
--
-- La misma figura que \`dishes\` ↔ \`dinners\` y \`planIdeas\` ↔ \`plans\`, por cuarta
-- vez: aquí vive lo que **no cambia de un año a otro** —cómo es el sitio, sus
-- notas, sus pegatinas— y en \`bungas\` lo que es de este agosto: qué familia lo
-- tiene. \`eventId\` nulo = de todos; con valor, solo del Demo (§14.9-quater).
--
-- \`pegatinas\` es JSON —una lista de ids— y no siete columnas: son etiquetas que
-- se tocan, y añadir la octava no puede costar una migración.
CREATE TABLE IF NOT EXISTS alojamientos (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  notas     TEXT,
  pegatinas TEXT,
  eventId   TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

-- ── 5. Los trucos (§14.53) ───────────────────────────────────────────────────
--
-- Lo que hay que acordarse de un viaje a otro. Catálogo compartido, como los
-- otros dos. **No lleva \`hecho\`** y no es un descuido: se pensó una lista de
-- embarque que se tildara cada viaje y se descartó — un truco no es una tarea,
-- es algo que sigue siendo verdad el año que viene, y tildarlo obligaría a una
-- segunda tabla de estado por evento para nada.
CREATE TABLE IF NOT EXISTS trucos (
  id         TEXT PRIMARY KEY,
  texto      TEXT,
  categoria  TEXT,
  autorId    TEXT,
  apuntadoEl TEXT,
  eventId    TEXT,
  updatedAt  TEXT NOT NULL,
  creadoEn   TEXT NOT NULL,
  borrado    INTEGER NOT NULL DEFAULT 0
);

-- ── 6. Los comentarios (§14.55) ──────────────────────────────────────────────
--
-- **Una tabla con ancla, y no una columna por tabla.** \`ancla\` es
-- \`'<tipo>:<id>'\` —\`plan:abc\`, \`gasto:def\`, \`dia:2026-08-15\`— y con ella el
-- mismo componente sirve en las ocho pantallas donde un comentario pide salir.
-- La alternativa era un JSON dentro de cada fila, y tenía dos defectos que no se
-- arreglan después: una migración por sitio, y **dos personas comentando a la
-- vez se pisan**, porque cada una sube la fila entera del plan.
CREATE TABLE IF NOT EXISTS comentarios (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  ancla     TEXT,
  texto     TEXT,
  autorId   TEXT,
  escritoEl TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

-- Un hilo se lee siempre por su ancla, y el globo de una fila cuenta por evento.
CREATE INDEX IF NOT EXISTS idx_comentarios_ancla ON comentarios (ancla, escritoEl);
CREATE INDEX IF NOT EXISTS idx_comentarios_evento ON comentarios (eventId);

-- ── 7. Los cacharros (§14.57) ────────────────────────────────────────────────
--
-- El que trae cada familia, y quién vota cuál. \`votos\` es el mismo mapa
-- persona → valor que en \`plans\`, así que no hay maquinaria nueva: \`votosDe\` ya
-- cuenta y \`Alias\` ya firma. Uno por familia y un voto por cabeza son reglas del
-- cliente, no del esquema — con dos filas de la misma familia la pantalla se
-- queda con la última y lo dice, que es mejor que una restricción que rompa una
-- sincronización a medias.
CREATE TABLE IF NOT EXISTS cacharros (
  id         TEXT PRIMARY KEY,
  eventId    TEXT,
  familyId   TEXT,
  texto      TEXT,
  votos      TEXT,
  apuntadoEl TEXT,
  updatedAt  TEXT NOT NULL,
  creadoEn   TEXT NOT NULL,
  borrado    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cacharros_evento ON cacharros (eventId);
`,
  },
  {
    id: '0017_enlace_de_acceso',
    sql: `-- Entrar sin iPhone: el papelito de un solo uso de cada cuenta (SPECS §14.61).
--
-- **\`cuenta.enlaceJti\`** — el identificador del último pase de enlace que se
-- generó para esta cuenta, o NULL si no hay ninguno vivo.
--
-- El pase va firmado, así que la columna no guarda ningún secreto: guarda
-- **cuál** de todos los pases que se han firmado para esta cuenta sigue
-- valiendo. Eso es lo único que un JWT no sabe de sí mismo —cuántas veces lo
-- han canjeado—, y es justo lo que aquí hace falta, porque un enlace es una
-- credencial al portador y se reenvía sin pensarlo.
--
-- De esa comparación salen las dos propiedades por el mismo precio: canjearlo
-- la borra (**un solo uso**) y generar otro la sobrescribe (**generar es
-- revocar**, que es lo que hay que poder hacer cuando un enlace acaba donde no
-- debía).
--
-- No es una tabla aparte porque no hay nada que apuntar más que esto: un pase
-- por cuenta, y el anterior no interesa a nadie en cuanto deja de valer.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto17

ALTER TABLE cuenta ADD COLUMN enlaceJti TEXT;
`,
  },
  {
    id: '0018_receta_del_plato',
    sql: `-- La receta de un plato: cómo se hace, en texto (SPECS §14.64).
--
-- Un plato ya sabía **qué lleva** —\`ingredientes\` con sus cantidades desde
-- §14.20, y \`raciones\` para poder estirarlas— y no sabía **cómo se hace**. Las
-- dos cosas hacen falta y son distintas: de los ingredientes sale la lista de la
-- compra, y de esto sale lo que se lee delante del fuego.
--
-- Texto libre y no una lista de pasos numerados, a propósito: una receta de este
-- grupo es «sofríes la cebolla, echas el arroz, y cuando empiece a hervir bajas
-- el fuego» — obligar a partirla en pasos numerados es pedir una estructura que
-- nadie va a rellenar, y es el mismo error que se descartó con las estrellas del
-- bunga (§14.56 · B3).
--
-- NULL y cadena vacía significan lo mismo: no hay receta escrita. Los platos ya
-- apuntados no se tocan, así que la columna no lleva \`DEFAULT\` ni \`NOT NULL\`.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto18

ALTER TABLE dishes ADD COLUMN receta TEXT;
`,
  },
  {
    id: '0019_resumen_del_bunga',
    sql: `-- El bunga, resumido en una línea con guasa (SPECS §14.66).
--
-- **\`alojamientos.resumen\`** — la frase que sale bajo el nombre de cada bunga en
-- la lista, escrita por el modelo a partir de sus pegatinas y de sus notas.
--
-- Va en el **alojamiento** y no en el bunga del evento porque es de lo que no
-- cambia de un año a otro: cómo es el sitio. El de 2026 y el de 2027 son la
-- misma nevera que congela.
--
-- **Y se guarda porque es de pago.** La alternativa —pedirlo al pintar la
-- lista— serían nueve teléfonos llamando cada vez que alguien abre Grupo, para
-- leer nueve bromas distintas sobre la misma nevera. Así lo pide uno, lo
-- guarda la cola de cambios de siempre, y lo leen los nueve.
--
-- **\`resumenDe\`** es la huella de las notas y las pegatinas con las que se
-- escribió. Sin ella, un resumen que ya no dice la verdad —porque alguien
-- apuntó después «se ha roto el aire»— es indistinguible de uno recién hecho, y
-- eso en una lista que se mira para decidir es peor que no tener ninguno. Con
-- ella, la app lo marca como viejo y ofrece rehacerlo.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto19

ALTER TABLE alojamientos ADD COLUMN resumen TEXT;
ALTER TABLE alojamientos ADD COLUMN resumenDe TEXT;
`,
  },
  {
    id: '0020_enlace_reutilizable',
    sql: `-- El enlace de acceso deja de ser de un solo uso (SPECS §14.61-bis).
--
-- **\`cuenta.enlaceExpira\`** — hasta cuándo vale el enlace que hay generado, en
-- segundos epoch, o NULL si no hay ninguno.
--
-- La columna nace **por un efecto secundario de quitar el solo uso**, y por eso
-- entra en la misma vuelta. Antes \`enlaceJti\` se borraba al canjear el enlace,
-- así que \`enlaceJti IS NOT NULL\` contestaba «tiene un enlace **sin usar**», que
-- es lo que la pantalla de Cuentas enseña para separar «se lo he mandado» de
-- «ya ha entrado». Si el enlace ya no se quema, esa columna **no vuelve a
-- vaciarse nunca** y la pastilla se quedaría puesta para siempre, también
-- cuando el enlace lleve meses caducado: peor que no tenerla, porque miente.
--
-- Con la fecha, la pregunta que contesta pasa a ser la que de verdad importa
-- ahora —«¿hay por ahí suelto un enlace que todavía abre esta cuenta?»—, que es
-- lo que hay que saber para decidir si conviene generar otro y revocarlo.
--
-- No la deduce el \`jti\`: el identificador es aleatorio y no lleva fecha dentro.
-- Y no se lee del propio pase porque el pase lo tiene quien lo recibió, no el
-- servidor.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto20

ALTER TABLE cuenta ADD COLUMN enlaceExpira INTEGER;
`,
  },
  {
    id: '0021_cena_fuera',
    sql: `-- Noches que se cena fuera, y dónde (SPECS §14.70).
--
-- **\`dinners.fuera\`** — 1 si esa noche se cena fuera del camping, 0 o NULL si se
-- cocina. **\`dinners.donde\`** — el sitio, texto libre: «el chiringuito de Paco»,
-- «Casa Marisa». Vacío es legítimo: se sabe que se sale y todavía no dónde.
--
-- Van dos columnas y no una porque la alternativa era guardar el sitio en un
-- solo campo y leer «hay sitio» como «se cena fuera». Eso deja \`''\` —salir sin
-- saber dónde— valiendo lo mismo que NULL en cualquier \`if\` de JavaScript, y ese
-- es el tipo de trampa que se paga meses después y en la pantalla de otro.
--
-- Antes esto se apuntaba como **plan** —«Tardeo cena de chiringo»— porque era el
-- único sitio donde cabía escribirlo, y el día se quedaba diciendo «sin cena»
-- teniendo la cena decidida. De ahí salían dos cosas mal: el semáforo del día no
-- se ponía verde nunca, y la noche no contaba como cena en ningún sitio.
--
-- Lo que **sí** cambia solo: una cena fuera no lleva platos, así que no manda
-- nada a la lista de la compra (\`platosDeLaCena\`, \`lib/compra.js\`).
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto21

ALTER TABLE dinners ADD COLUMN fuera INTEGER;
ALTER TABLE dinners ADD COLUMN donde TEXT;
`,
  },
  {
    id: '0022_plan_con_hora',
    sql: `-- La hora de un plan, y el recordatorio de una hora antes (SPECS §14.73).
--
-- **\`plans.hora\`** — «20:00», hora local, NULL si el plan no tiene hora. Es lo
-- que se enseña y lo que ordena el día.
--
-- **\`plans.cuando\`** — el mismo momento en **segundos epoch**, o NULL. Lo
-- calcula **el móvil** al guardar, no el servidor, y esa es la decisión de fondo
-- de la migración: \`dia\` + \`hora\` son tiempo **local** y el Worker corre en
-- **UTC**, así que alguien tiene que aplicar el desfase de Madrid —+2 en agosto,
-- +1 en enero—. El móvil ya sabe el suyo; el Worker tendría que deducirlo, y de
-- eso salen los fallos que solo se ven en octubre. Con el instante guardado, el
-- cron **solo compara números**. Es la misma figura que los IDs de cliente.
--
-- **\`plans.avisadoEl\`** — cuándo salió el recordatorio, en epoch, o NULL. Sin
-- esto el cron avisaría otra vez en cada pasada: manda cada cinco minutos, así
-- que un plan de las 20:00 dejaría **doce** avisos entre las 19:00 y las 20:00.
--
-- \`hora\` y \`cuando\` los escribe el móvil y van en \`tablas.js\`. **\`avisadoEl\` no**:
-- es del servidor, y dejarlo fuera de las columnas que acepta \`aplicarCambio\` es
-- lo que impide que un cliente lo borre y desate la tanda de doce.
--
-- Como las demás, no se toca \`0001_esquema.sql\`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (\`test/d1.js\`).
--
--   npm run migrar:remoto22

ALTER TABLE plans ADD COLUMN hora TEXT;
ALTER TABLE plans ADD COLUMN cuando INTEGER;
ALTER TABLE plans ADD COLUMN avisadoEl INTEGER;
`,
  },
  {
    id: '0023_persona_ausente',
    sql: `-- Quien se va unos días (SPECS §14.78).
--
-- Una columna y no dos fechas: se pidió **sin límite de tiempo**, y unas fechas
-- de ida y vuelta obligarían a decidir qué pasa con un gasto apuntado el martes
-- por alguien que se fue el miércoles. Aquí no hay nada que decidir: cuenta o no
-- cuenta, y se cambia con un interruptor.
--
-- Nulo = está. Así las filas de antes de esta migración quedan bien sin tocarlas
-- y nadie desaparece de un reparto sin que alguien lo haya pedido.
ALTER TABLE persons ADD COLUMN ausente INTEGER;
`,
  },
];
