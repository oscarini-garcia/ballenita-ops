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
];
