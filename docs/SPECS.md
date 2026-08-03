# Ballena Ops 🐋 — Specs de producto

> Nombre de la app: **Ballena Ops** (el evento como operación militar de precisión… o eso pretendemos). La mascota es *la ballenita*.

> App para gestionar la logística (y el caos) de los eventos con el grupo de amigos.
> Todo pasa dentro de un evento. La ballena vigila.

**Estado:** borrador para discutir. Nada implementado.
**Autor:** tú + Claude.
**Última actualización:** 2026-07-21

---

## 0. Filosofía y tono

- **Todo vive dentro de un evento.** No hay entidades globales "sueltas" desde el punto de vista del usuario: entras, eliges/creas un evento, y ahí dentro pasa todo (gastos, comidas, planes, bungalows, gente). El evento es el contenedor raíz.
  - **Un evento suele ser un viaje** (un finde, unas vacaciones en el camping), pero no tiene por qué: puede ser cualquier plan del grupo con **fecha de inicio y fin**. Por eso la entidad raíz se llama **Evento**, no "viaje".
- **Tono con humor.** Microcopy gamberro, estados vacíos con gracia, la ballena como mascota. **✅ La ballenita comenta en momentos clave** (estados vacíos, avisos, estadísticas) con gracia, pero **no molesta** — personalidad sin cansar, no está en todas las pantallas soltando frases. Su **resumen diario llega por la mañana** ("buenos días: el plan de hoy, a quién le toca cenar dónde, y cómo van las cuentas").
- **✅ Todo gasto vive dentro de un evento.** No hay "botes" ni cajas comunes que crucen eventos: cada gasto pertenece a un evento y se salda al cerrarlo. Coherente con el principio raíz.
- **Mobile-first.** Esto se usa con el móvil en la mano, en chanclas, con mala cobertura. Debe funcionar rápido y, a poder ser, offline-tolerante.
- **Idioma: solo español** (✅ decidido). El grupo es español; una sola lengua, con los textos con gracia bien cuidados. El humor se escribe, no se traduce. Sin i18n en v1 (no es tanto trabajo dejarlo medianamente ordenado por si acaso, pero no es objetivo).

**Logo:** una ballena. Ver §11.

---

## 1. Glosario (para no pelearnos con las palabras)

| Término | Qué es |
|---|---|
| **Evento** | Contenedor raíz. Tiene fecha de inicio y fin, un grupo de gente, bungalows, gastos, comidas y planes. |
| **Persona / Participante** | Alguien que va al evento. Pertenece a una familia; tiene edad (`adulto`/`niño`) + flags + `peso_reparto` (§5). |
| **Familia** | Unidad de agrupación de personas (p. ej. "Los García", "Los solteros"). Es la **unidad de cartera** del reparto de gastos y tiene su bunga. |
| **Bunga (bungalow)** | Alojamiento de una familia (1 familia = 1 bunga). Además hace de **sede rotatoria** de las cenas. |
| **Gasto** | Un pago hecho por una o varias familias, repartido entre personas y agregado a nivel familia. Estilo Splitwise. |
| **Plan** | Actividad candidata o programada para un día (playa, kayak, ir a por hielo…). Se vota y se confirma. |
| **Cena** | El evento de cenar de un día (una por día en v1). Tiene platos, bunga(s) de mayores/niños y notas. |
| **Plato** | Un ítem de una cena (p. ej. "paella"), con una o varias clasificaciones (entrante/principal/…). |

---

## 2. Áreas comunes (transversales al evento)

Estas áreas existen "de siempre" y se reutilizan, aunque su contenido normalmente se instancia dentro de un evento.

### 2.1 Autenticación

- **✅ Decidido (Q1, revisado): login con email (enlace mágico). Sin Apple, y de momento sin Google.** El grupo no quiere depender de Apple ni de su cuenta de desarrollador de pago, y esto es una **PWA** (no hay app iOS nativa). El **email mágico** basta para el MVP y funciona en iPhone y Android; **Google se puede añadir más adelante** si hace falta.
- El login es **identidad/comodidad**, no control de acceso (opción A, §14.6): sirve para saber quién es quién y alimentar el historial, no para proteger los datos.
- Perfil mínimo: nombre visible, avatar (opcional), método de login.
- **Cuentas por familia:** cada familia tiene **mínimo un login**. Desde ese login se pueden crear **perfiles-nombre gestionados** (niños, el cuñado que no se instala nada) o pueden entrar más **usuarios completos** asignados a esa familia. Modelo detallado en §5.1.

### 2.2 Familias

- Una familia es una etiqueta/grupo de personas **dentro de un evento**.
- Casos de uso:
  1. **Reparto de gastos por familia** (el pool con 5 personas paga más que el soltero).
  2. **Logística de comidas** (esta familia cocina hoy, los niños de estas familias comen en el bunga X).
- **✅ Decidido (Q2): globales, congeladas por evento.** Hay un catálogo **global** de personas y familias reutilizable cada año, pero la **composición de cada evento se congela** al añadir gente (este año no vino el hijo mayor, hay novia nueva, etc.). Cambiar la familia global no reescribe eventos pasados.
- Cada familia tiene **color**, y además **avatar/logo y estado** personalizables (emoji, imagen o foto — ver §5.2).

### 2.3 Bungas (bungalows)

- Se **definen al principio del evento**: nombre/identificador ("Bunga 1", "El de la piscina"), capacidad opcional.
- **✅ Modelo: cada familia tiene su bunga (1 a 1 en v1).** El bunga es el alojamiento de una familia — no se asigna persona a persona, sino **familia ↔ bunga**. La persona "hereda" el bunga de su familia.
- **✅ Decidido:** en v1, **1 familia = 1 bunga** exactamente. Los casos raros (familia grande con 2 bungas, dos familias pequeñas compartiendo uno) **se apañan a mano** por ahora; se revisará si aparece la necesidad real. Menos modelo, cubre lo normal.
- Los bungas se usan además como **sede rotatoria de las comidas** (§6): cada día se decide qué bunga acoge la comida de los mayores y cuál la de los niños, repartiendo la carga.
- **✅ El emparejamiento se pide por los dos lados, y solo ofrece lo libre.** El vínculo se guarda en un sitio único (`bunga.familyId`), pero se pregunta tanto al crear una familia (campo **Bunga**) como al crear un bunga (campo **Familia**), porque quien monta el grupo no siempre empieza por el mismo sitio. Las dos listas enseñan **únicamente lo que no tiene pareja**, y ninguna de las dos preselecciona: van con **«— ninguno —»** de fábrica, ya que una familia recién creada no tiene bunga y elegirlo por ella se lo quitaría a otra en silencio. Cuando no queda nada libre, el formulario lo dice en vez de enseñar una lista vacía. Asignar desde la familia **libera** el bunga que tuviera antes (`asignarBungaAFamilia` en `db.js`), que es lo que mantiene el 1 a 1.
- **✅ Un bunga huérfano vuelve a estar libre.** Si se borra la familia, su `familyId` apunta a algo que ya no existe: la fila dice «sin familia» —no un guion— y el bunga vuelve a salir como disponible. Sin esto quedaba atado a un fantasma y no había manera de reasignarlo. La lógica es pura y está en `app/src/lib/asignacion.js`.
- **✅ Dónde vive todo esto: una ficha por familia** (`G2`) y una **hoja de elección** para el bunga (`A3`), elegidas sobre las cinco colocaciones dibujadas y medidas en [`docs/diseño/gente.html`](diseño/gente.html). Ver §14.14.

### 2.4 Gente / participantes (común pero se instancia por evento)

Ver §5 (es tan central que tiene sección propia).

### 2.5 Ciclo de vida del evento (crear, duplicar, cerrar)

- **✅ Varios eventos a la vez, con uno "activo":** el grupo puede tener el de verano en curso y **ya ir planeando el de invierno**. La app **resalta el evento activo** (el que está pasando ahora) y deja el resto en una lista. Al abrir la app entras directo al activo.
- **✅ Unirse por enlace / QR:** quien crea el evento comparte un **enlace o QR**; los demás entran y **eligen su familia** (§5). Sin gestionar emails ni invitaciones una a una. Ideal para pasarlo por el grupo de WhatsApp.
- **Crear:** nombre, fecha de inicio y fin. **La moneda es siempre el euro** y no se pregunta: el grupo es de aquí y el desplegable solo servía para poder equivocarse. El **fin se propone solo** —el día siguiente al inicio— y el campo no deja elegir uno anterior. A partir de ahí se añaden familias, bungas y gente.
- **✅ Duplicar el evento anterior:** al crear un evento se puede **clonar el del año pasado** (misma gente, familias, bungas, platos favoritos) y solo ajustar fechas y quién viene este año. Nadie quiere remontar el camping entero cada verano.
  - *(Recordatorio §2.2: la composición se **congela** por evento; duplicar copia el estado, no crea un vínculo vivo con el evento anterior.)*
- **✅ Cerrar (reabrible):** al terminar, **cualquiera** puede marcar el evento como cerrado → se genera el **resumen de cuentas y la liquidación final** (§3.4). No hay candado (no hay roles, §9): se puede **reabrir** para meter ese gasto que faltaba y volver a cerrar.
  - La ballenita puede empujar el cierre ("Lleváis 3 días en casa y quedan 47,50 € sin saldar 🐋").

---

## 3. Gastos — "Modo Splitwise" 💸

El corazón económico. Inspirado en Splitwise pero con el giro de **reparto por familias**.

### 3.1 Crear un gasto
Campos:
- **Descripción** ("Compra grande Mercadona", "Gasolina").
- **Importe** + **moneda** del gasto (**multi-moneda**, ver §3.6).
- **Quién paga** — **✅ uno o varios pagadores** (normalmente uno; permite "la reserva la pagaron dos familias a medias", indicando cuánto puso cada quien).
- **Cómo se divide** (ver §3.2).
- **Fecha** (por defecto hoy, dentro del rango del evento).
- **Categoría** — **✅ lista fija con iconos:** 🛒 compra general · 🍔 comida · 🍷 bebida · 🍽️ restaurante · 📦 varios. Alimenta las estadísticas (§9); fija para que las stats salgan consistentes.
- **Nota** (texto libre, opcional). **Sin fotos en v1** (ver §3.5).

### 3.2 Cómo se divide el gasto
Modos de reparto:
1. **A partes iguales** entre las personas seleccionadas.
2. **Por importes exactos** (cada uno pone X).
3. **Por porcentajes.**
4. **Por partes/shares** (ponderado: la familia grande cuenta como N).

**✅ Redondeo (decidido): reparto automático del sobrante.** Cuando no cuadra al céntimo (10 € entre 3 → 3,34 / 3,33 / 3,33), la app **asigna los céntimos sueltos sola** y **avisa a quién le tocó el de más**. Nada de descuadres ni de pelearse por un céntimo. Aplica igual tras convertir divisa (§3.6).

### 3.3 Splits predefinidos por familia (el requisito clave) ⭐
- Como hay familias de distinto tamaño, se puede definir un **split por defecto del evento** que tenga en cuenta a las familias.
- Idea: cada gasto, por defecto, se reparte **por la suma del `peso_reparto` de las personas de cada familia participante** (§5). Así un niño con peso 0,6 cuenta menos automáticamente, sin reglas globales.
- Se pueden guardar **plantillas de reparto** ("split predefinido"):
  - *"Todos por persona"* (default): cada persona = 1 parte, las familias grandes pagan proporcionalmente más.
  - *"Solo adultos"*: los niños no cuentan (útil para el gasto de vino 🍷).
  - *"Por familia a partes iguales"*: cada familia paga lo mismo sin importar el tamaño.
  - *"Personalizado guardado"*: el que definas.
- Al crear un gasto, eliges una plantilla y puedes ajustar puntualmente.
- **✅ Decidido (Q3): la deuda se salda ENTRE FAMILIAS.** "Los García deben 60€ a Los Pérez", y dentro de cada familia ya se apañan. Implicaciones:
  - La **familia es la unidad de cartera**: pagador y deudores son familias, no personas sueltas.
  - Aun así, un gasto puede **repartirse contando personas** (para ponderar el tamaño), pero el saldo resultante se **agrega a nivel familia**.
  - Una persona sin familia asignada se trata como **familia de uno**.
  - Las estadísticas y la liquidación (§3.4) trabajan en unidad **familia**.
- **✅ Decidido: reparto fino a nivel PERSONA (dentro de la familia).** Al crear un gasto puedes **incluir/excluir personas sueltas**, aunque el saldo se sume a su familia. Casos que esto habilita:
  - "Solo mayores" (el vino) → excluye niños automáticamente vía el flag `cuenta_como_adulto_reparto`.
  - "Los que fueron al kayak" → selección manual de personas, salten las familias que salten.
  - El gasto guarda la **lista de personas afectadas** y sus partes; el saldo mostrado es el rollup por familia.

### 3.4 Saldos y liquidación
- **✅ Decidido: liquidación simplificada** — minimizar el nº de transferencias, como Splitwise (aunque A acabe pagando a C sin haberle comprado nada).
- Vista de **"quién debe a quién"** entre familias con ese plan simplificado.
- **✅ Saldar = apuntar "pagado" a mano.** El dinero real se mueve **fuera de la app** (Bizum, efectivo): alguien hace el pago y luego **marca en la app** "Los García han pagado 62,50 € a Los Pérez". La app **lleva la cuenta, no mueve dinero** (sin integraciones de pago en v1). Un botón que abra Bizum con el importe queda para v2.
- Estado por evento: saldo total, tu saldo personal/familiar.
- **✅ Saldo actual + registro de cambios:** se muestra el "quién debe a quién" de ahora, con el **log de movimientos y pagos** (§9) para entender cómo se llegó ahí. Sin gráficas de evolución en v1 (eso a v2).
- **✅ Gastos editables:** un gasto mal metido **se puede editar** (importe, pagador, reparto…); el saldo se **recalcula** y el cambio queda en el historial. Editar tras liquidar deja aviso de que las cuentas se movieron.
- **Cierre de evento:** al terminar, un resumen de "cuentas del evento" y liquidación final. Reabrible (ver §2.5).

### 3.5 Fotos y adjuntos
- **✅ Decidido: sin fotos en v1** (de ticket ni de comida). Motivo: las imágenes pesan y complican el **offline-first** (§12.2). Se pospone a v2. En v1 el justificante es la **nota de texto**.
- **Nota:** los **avatares y estados** de perfil (§5.2) admiten **emoji e imágenes predefinidas ya en v1** (son baratos); solo la **foto subida** comparte esta restricción y viaja a v2 junto con las fotos de gasto.

### 3.6 Multi-moneda (decidido, con letra pequeña)
- **✅ Decidido:** se admiten **gastos en distintas monedas** con conversión.
- Cada evento tiene una **moneda base** (donde se calculan saldos y liquidación). Cada gasto guarda su moneda original + el **tipo de cambio aplicado** en ese momento.
- **⚠️ Aviso de complejidad (fui recomendación de "una sola moneda"):** multi-moneda mete decisiones que hay que cerrar antes de implementar:
  - **✅ Decidido: tipo automático vía API + editable.** Al meter un gasto en otra divisa, la app trae el **tipo del día de una API** y lo **congela en el gasto**; se puede corregir a mano si hiciera falta. (Implica: hay que elegir proveedor de tipos y tener un fallback si la API no responde estando offline — ver §12/offline.)
  - Los tipos fluctúan: el tipo **congelado al crear el gasto** no se re-toca, así los saldos no bailan a posteriori.
  - Redondeos y descuadres de céntimos al convertir → resueltos por el **reparto automático del sobrante** (§3.2).
  - Esto encarece el MVP; si aprieta el tiempo, se puede lanzar con una moneda y activar multi-moneda justo después sin romper el modelo (por eso guardamos moneda+tipo desde el día 1).

### 3.7 Preguntas abiertas de gastos
- ¿Gastos que ocurren fuera del rango de fechas (adelantos, reservas previas)? Propuesta: permitir fecha fuera de rango con aviso.
- **Proveedor de la API de tipos de cambio** y su fallback offline (ver §3.6 y §12) — pendiente.

---

## 4. Planes 🗺️

Actividades candidatas para los días del evento.

- **Crear plan:** título, descripción, día/franja propuesta (o "sin fecha, a decidir"), coste estimado opcional, ubicación opcional.
- **Estados:** propuesto → votando → confirmado → hecho/cancelado.
- **Votación / interés:** la gente marca si le apunta (👍 / 🤷 / 👎) o se apunta a la lista. Útil para decidir sin discutir en el grupo de WhatsApp.
- **✅ Confirmación: la decide quien propone (o cualquiera).** La votación **solo orienta**; no hay umbrales ni plazos automáticos. Alguien marca el plan como confirmado cuando ve que hay consenso. Simple y humano (coherente con "todos editan todo", §9).
- **✅ Día opcional desde el principio:** un plan puede proponerse **con día** ("cuevas el miércoles") o **sin día** ("a decidir"). Al confirmarse **aparece en la Agenda** (§4.1) del día que tenga.
- **✅ Poner / cambiar / quitar el día:** en cualquier momento se puede **asignar el día** en que se hace el plan (selector de fecha dentro del rango del evento), **cambiarlo** o **quitarlo** (vuelve a "sin día / a decidir"). Con día + confirmado → sale en la Agenda; al **quitar el día**, desaparece de la Agenda pero el plan sigue vivo.
- **✅ Quitar el plan:** cualquiera puede **borrar** un plan (o marcarlo `cancelado` si se prefiere conservar el registro). Coherente con "todos editan todo" (§9); queda en el historial.
- **✅ Decidido: lista + votación ligera.** Ideas para los días + 👍/🤷/👎 + asignar a un día. **Nada de agenda por franjas ni recordatorios** (eso es reinventar Google Calendar y dispara el scope).
- **Vínculo con gastos:** ¿un plan confirmado puede generar un gasto? (p. ej. "alquiler kayaks 40€"). Propuesta: enlace opcional, no obligatorio.
- **Vínculo con comidas:** una comida es un tipo de plan, pero la gestionamos aparte por su complejidad (§6).

### 4.1 Agenda por días (vista que une todo) ⭐
- **✅ Decidido:** además de las secciones sueltas (Gastos, Comidas, Planes), hay una **vista de agenda por días** que **une comidas y planes** de cada día: "Día 3 — playa por la mañana, paella de cena en Bunga 2".
- Da **sensación de itinerario** sin ser un calendario con franjas horarias (§4): es una lista por día, ordenada, con las comidas y los planes de ese día juntos.
- Las secciones sueltas siguen existiendo para "ver todos los gastos" o "toda la carta de comidas" de golpe; la agenda es la vista transversal del día a día.
- Es una buena **home del evento activo**: al entrar, ves el día de hoy.

---

## 5. Personas dentro del evento 👥

En la parte de evento, por cada persona se define:

- **Familia** a la que pertenece (§2.2) — **cada uno elige su familia** (auto-asignación).
- **Rol:** edad (`adulto`/`niño`) + flags (ver abajo).
- **Bunga:** el de su familia (§2.3), no se asigna persona a persona.
- **Tipo de participante:** cuenta completa (con login) o perfil-nombre gestionado (§5.1).

### 5.1 Modelo de cuentas y pertenencia (aclarado) ⭐
- **Cada familia tiene como mínimo un login.** Ese login es quien puede saldar cuentas y gestionar la familia (encaja con "la deuda se salda entre familias", §3).
- Una persona puede ser:
  1. **Usuario completo:** se autentica (email mágico), **elige a qué familia pertenece** y participa por sí mismo.
  2. **Perfil-nombre gestionado ("fantasma"):** no tiene login; lo crea el login de una familia (típico para niños o para el cuñado que no se instala nada). Cuenta para comidas, bungas y reparto, pero no entra solo.
- Un perfil gestionado puede **"ascender" a usuario completo** más adelante si esa persona acaba instalando la app.
- **⚠️ Ojo (auto-asignación de familia):** si cada uno elige su familia libremente, alguien podría meterse en la familia equivocada y descuadrar el reparto. Propuesta: la elección es libre pero **visible para todos** en el evento; sin aprobación formal (grupo de confianza), pero con el historial (§9) para detectar líos.

### ✅ Rol de persona: dos ejes en vez de "ambos" (decidido, Q4)
Se abandona el enum `niño/mayor/ambos` (ambiguo). En su lugar, cada persona tiene:
- **Categoría de edad:** `adulto` / `niño` (binario, claro).
- **Flags de comportamiento** independientes:
  - `come_con_mayores` (por defecto según edad; sobrescribible) → afecta a §6.4.
  - `cuenta_como_adulto_reparto` (por defecto según edad; sobrescribible) → afecta a §3.
- **`peso_reparto`** (✅ decidido): **cuánto cuenta esta persona en el reparto por cabezas**. Sale de la edad y no se teclea: **adulto = 1, niño = 0,6** (`lib/personas.js`). El campo libre existió y se retiró: pedía una decisión («¿un chaval de quince cuánto pesa?») cada vez que se apuntaba a alguien, y la respuesta era siempre una de las dos. Si algún día hace falta el bebé a 0, se añade a esa tabla y sale en los dos sitios a la vez.
- **✅ Una persona es quien potencialmente tiene cuenta.** El alta sigue siendo por invitación (§14.9) y quien administra **enlaza la petición de acceso con la persona** que ya está apuntada. Por eso la lista de gente no es una lista de nombres para el reparto: es el censo del grupo, y de ahí que se edite en serio (§14.14).
- Ejemplo: un **adolescente** = `niño` + `come_con_mayores: true` + `cuenta_como_adulto_reparto: true` + `peso_reparto: 1`. El antiguo "ambos" queda expresado de forma explícita y sin magia.
- Los defaults hacen que el 90% de la gente se configure sola: adulto = flags true + peso 1; niño = flags false + peso a elegir en su perfil.

### 5.2 Personalización de perfil — avatar + estado ⭐
- **✅ Cada persona/usuario Y cada familia** pueden personalizar dos cosas:
  - **Avatar / logo:** un **emoji** (🐋), una **imagen** de un set predefinido, o una **foto** subida. La familia tiene además su color (§2.2); el avatar se suma.
  - **Estado:** una línea corta tipo "mood" (texto opcional + emoji, p. ej. "🏖️ en modo playa", "💸 sin blanca hasta el finiquito"). El estado también puede llevar una **imagen o foto**.
- Da personalidad al grupo y ayuda a identificar de un vistazo quién es quién en gastos, cenas y planes.
- **⚠️ Reconciliación con "sin fotos en v1" (§3.5):** aquello era por las **fotos de ticket/comida** (pesan y complican el offline). Aquí pasa lo mismo con la **foto subida**:
  - **Emoji** e **imágenes predefinidas** son baratísimos y **offline-friendly** → entran en **v1** sin problema.
  - La **foto subida** por el usuario arrastra el **mismo coste de almacenamiento + sync** que descartamos en gastos. **Recomendación:** v1 = emoji + imágenes predefinidas; **foto a v2**, junto con las fotos de gasto (misma pieza de ingeniería). Si el grupo la quiere ya, se asume ese coste explícitamente.

---

## 6. Cenas 🍳

La sección más peculiar y donde hay más miga logística.

- **✅ Decidido: en v1 solo se gestionan CENAS.** Una cena por día. Los desayunos, comidas y picoteos van por libre (no se modelan). El modelo se deja **preparado** para añadir más tipos de comida en el futuro, pero el foco y la UI de v1 son las cenas.

### 6.1 Modelo
- Una **Cena** = el evento de cenar de un día concreto del evento (una por día).
- Cada cena tiene:
  - **Día** (dentro del rango del evento).
  - **Platos** seleccionados (§6.2).
  - **Bunga(s)** donde se come (§6.4).
  - ~~**Campo "qué se hace / cómo"**~~ y ~~**Campo "cantidades"**~~ — **retirados en §14.20.**
    Dos textos libres que se escribían en dos pantallas y se leían en una tercera,
    y que nadie rellenaba. Las columnas siguen en D1 (ver §14.20).

### 6.2 Platos predefinidos
- Catálogo de **platos** reutilizables ("tortilla", "paella", "sangría", "aceitunas").
- Cada plato tiene una o varias **clasificaciones** (ver §6.3) — un plato **puede ser varias cosas a la vez** (p. ej. algo que es aperitivo y acompañamiento).
- Al montar una comida, **seleccionas platos** del catálogo (y puedes crear uno nuevo al vuelo).
- **✅ Decidido (Q6): catálogo global + favoritos del grupo.** Los platos viven en un **catálogo global** reutilizable entre eventos ("la paella de siempre"), y además el grupo puede **marcar sus clásicos como favoritos** para tenerlos a mano al montar comidas. Se pueden crear platos nuevos al vuelo.

### 6.3 Clasificación de platos
Categorías (multi-selección, un plato puede tener varias):
- **Aperitivos**
- **Entrantes**
- **Principales**
- **Acompañamientos**
- **Postres** ✅ (añadida — la sandía también cuenta)

*(«Bebidas» se decide NO añadirla como categoría: va en el campo de cantidades o como acompañamiento.)*

- **✅ Varios platos por tipo:** una cena puede llevar **más de un plato de la misma categoría** — p. ej. **dos o tres guarniciones/acompañamientos**, varios entrantes o dos principales. `platos[]` es una lista sin límite de uno por tipo; la clasificación solo sirve para agrupar/mostrar.

### 6.4 Bungas en las comidas — rotación diaria mayores / niños ⭐
Aclarado el modelo real (corrige la versión anterior):

- Cada familia tiene su bunga (§2.3). Las comidas **rotan de sede**: no se come siempre en el mismo sitio.
- **La asignación se hace POR DÍA** (Q5 resuelta → **por día**): cada día del evento se decide:
  - **qué bunga acoge la comida de los mayores**, y
  - **qué bunga acoge la de los niños**.
- **Objetivo de balanceo:** repartir la carga de "hacer de anfitrión" a lo largo del evento, para que no le toque siempre al mismo bunga/familia cargar con la comilona.
  - **✅ Decidido:** la app **muestra el marcador** (cuántas veces ha acogido cada bunga a mayores y a niños) **y sugiere** a quién le toca ("hoy le toca al Bunga 3"), pero **decide un humano** — no auto-asigna.
- **✅ Anfitrión = solo prestar el bunga (el espacio).** Lo que se balancea es el **uso del sitio/mesa**, no el cocinar. Quién cocina puede ser una familia distinta y va aparte (§6.5). Así "acoger" no implica "currar".
- **Quién es "mayor" aquí** sale del flag `come_con_mayores` de cada persona (§5), no de la edad directamente. Así un adolescente marcado como niño pero que come con los adultos cae en la mesa correcta sin excepciones a mano.
- **Granularidad:** por defecto la asignación del día vale para todas las comidas de ese día; se puede afinar por comida si un día hace falta (p. ej. la cena especial donde comen todos juntos en un solo bunga).

### 6.5 Notas de cenas
- **✅ Quién cocina NO se registra** como campo estructurado ni se balancea. Va en el **texto libre "qué se hace"** de la cena, si acaso. Lo único que se balancea es el **bunga anfitrión** (el espacio, §6.4).
- ¿Las comidas generan gasto automáticamente (la compra) o el gasto va por libre en §3? Propuesta: desacoplado en v1, con enlace manual opcional.
- **✅ Lista de la compra: manual en v1, agregada en v2.** En v1 las cantidades son **texto libre por comida**; agregar todo en una lista de la compra global del evento se deja para **v2**, apoyándose en los **`ingredientes[]` del plato** (§8.1) para sumar automáticamente.

### 6.6 Lista de la compra compartida (manual) 🛒 ⭐
- **✅ Sección propia por evento**, súper simple: cualquiera **apunta** lo que hace falta ("Hielos", "Vino", "Fruta") y **el que va a comprar lo marca como hecho**. Es una lista viva del grupo, no ligada a una cena concreta.
- **Categorías simples y fijas:** 🍺 Bebida · 🍎 Fruta y verdura · 🥖 Comida · 🧊 Hielo y frío · 🧺 Otros. Por defecto **Otros** si no se elige.
- **Interacción:** barra de alta rápida arriba (texto + chip de categoría), pendientes **agrupados por categoría**, y lo comprado tachado abajo (más reciente primero). **Tocar la fila** alterna comprado/pendiente; botón **"limpiar comprados"** para vaciar lo hecho.
- **Quién y cuándo:** al marcar comprado se registra **quién** (la identidad del dispositivo, ya ligada globalmente y elegida en Planes §14 — aquí no hay selector propio) y **cuándo** (`compradoEn`), y se muestra en la fila ("Curro · hoy 18:30"). Sin identidad queda anónimo. Al desmarcar, se limpian ambos.
- **Sincronización:** cada ítem es un **hecho** más (tabla `shop`, §14) con merge LWW + tombstones. Nada de saldos aquí; es puramente logística.
- **Relación con §6.5:** es la versión **manual y transversal**. La lista **agregada automática desde `ingredientes[]`** sigue siendo v2 y podría, en el futuro, volcar sugerencias aquí.

---

## 7. Estadísticas 📊

Sección de vanidad y de piques sanos. Todo por evento (y quizá histórico entre eventos).

Ideas de métricas (con la ballena troleando):
- **Gastos:** total del evento, gasto por persona/familia, quién ha pagado más, categoría más cara, "el más rácano" / "el manirroto".
- **Comidas:** nº de platos por tipo, plato más repetido, familia que más ha cocinado, **balance de anfitrión** (veces que cada bunga ha acogido comidas de mayores/niños — el mismo marcador que usa §6.4).
- **Planes:** planes propuestos vs realizados, el que más propone, el que más vota que no.
- **Curiosidades:** día más caro, ratio vino/persona, etc.
- **✅ Decidido: gamberras pero opt-in.** Por defecto las stats son suaves; las que **señalan a alguien** ("el rácano", "el manirroto") se **activan por evento** si el grupo quiere. Humor sí, dramas reales no.

---

## 8. Modelo de datos (borrador de alto nivel)

```
User (login: email mágico; Google futuro) 1─* Membership *─1 Event
Event 1─1 lugar, monedaBase, fechaInicio, fechaFin, estado(planificando|activo|cerrado)
Event 1─* Family        (Family 1─1 Bunga)
Event 1─* Bunga         (Bunga 1─1 Family)
Event 1─* Person        (Person → Family; edad, come_con_mayores, cuenta_como_adulto_reparto, peso_reparto;
                        Person = usuario completo (→User) | perfil-nombre gestionado)
Event 1─* Expense       (Expense → payers[Family], → shares[Person]→rollup Family,
                        moneda_original, tipo_cambio_congelado, categoría, editable)
Event 1─* Settlement    (pago apuntado a mano: FamiliaA → FamiliaB, importe)
Event 1─* SplitTemplate (por persona | solo mayores | por familia | personalizado)
Event 1─* Plan          (estado, día opcional, votos[Person: 👍/🤷/👎])
Event 1─* Cena          (1 por día: → Dish[], bungaMayores→Bunga, bungaNiños→Bunga)
Dish  *─* Category     (aperitivo|entrante|principal|acompañamiento|postre)   [catálogo GLOBAL + favoritos + ingredientes[]]
Event 1─* AuditLog      (historial: quién tocó qué y cuándo — obligatorio, §9)
```

Cerrado: unidad de deuda = **familia**; Family/Person/Dish = **globales, congeladas por evento**; rol = **edad + flags + peso**; **multi-moneda** (moneda base + tipo por gasto); **sin roles de app** (→ historial obligatorio); bunga↔familia **1:1**; bunga de cena **por día**. Pendiente (implementación): proveedor de la API de tipos de cambio.

### 8.1 Campos por objeto

> Borrador de esquema. `id` y timestamps (`creadoEn`, `actualizadoEn`) se dan por supuestos en todos. `→` = referencia.

**Event** (el contenedor raíz; antes "viaje")
- `nombre` · `lugar` (ubicación, p. ej. "Camping La Ballena Alegre") · `fechaInicio` (date) · `fechaFin` (date)
- `monedaBase` (ISO 4217, p. ej. EUR)
- `estado` (`planificando` | `activo` | `cerrado`)
- `creadoPor` (→User) · `statsPicanteHabilitado` (bool, §7)
- `duplicadoDe` (→Event, opcional — al clonar el anterior)

**User** (login)
- `nombre`
- `metodoLogin` (`email`; `google` futuro)
- `avatar` ({ `tipo`: `emoji`|`imagen`|`foto`, `valor` }) · `estado` ({ `texto`?, `emoji`?, `media`? }) — ver §5.2

**Media** (tipo reutilizable para avatar/estado)
- `tipo` (`emoji` | `imagen` | `foto`)
- `valor` (el emoji, o id de imagen predefinida, o referencia de la foto subida)

**Membership** (User participa en un Event)
- `userId` (→User) · `eventId` (→Event)

**Family** (unidad de cartera)
- `eventId` (→Event) · `nombre` · `color`
- `avatar` (Media) · `estado` ({ `texto`?, `emoji`?, `media`? })
- `bungaId` (→Bunga, 1:1)

**Bunga**
- `eventId` (→Event) · `nombre` · `alias` (mote: "el de la piscina", opcional) · `parcela` (número/identificador, opcional) · `capacidad` (int, opcional)
- `familiaId` (→Family, 1:1)

**Person**
- `eventId` (→Event) · `nombre` · `apodo` (mote del grupo, opcional)
- `avatar` (Media) · `estado` ({ `texto`?, `emoji`?, `media`? }) — ver §5.2
- `familiaId` (→Family)
- `edad` (`adulto` | `niño`)
- `comeConMayores` (bool) · `cuentaComoAdultoReparto` (bool) · `pesoReparto` (number, default 1)
- `tipo` (`usuarioCompleto` | `perfilGestionado`)
- `userId` (→User, solo si `usuarioCompleto`)

**Expense** (gasto)
- `eventId` (→Event) · `descripcion` · `fecha` (date) · `nota` (texto, opcional)
- `importe` (decimal) · `monedaOriginal` · `tipoCambioCongelado` (decimal) · `importeBase` (decimal, calculado)
- `categoria` (`compra_general` | `comida` | `bebida` | `restaurante` | `varios`)
- `pagadores[]` ({ `familiaId`, `importe` }) — uno o varios
- `shares[]` ({ `personaId`, `parte` }) — reparto por persona, se agrega a familia
- `splitTemplateId` (→SplitTemplate, opcional) · `creadoPor` / `editadoPor` (→User)

**SplitTemplate** (plantilla de reparto)
- `eventId` (→Event) · `nombre`
- `tipo` (`por_persona` | `solo_mayores` | `por_familia` | `personalizado`)
- `config` (pesos/porcentajes según tipo)

**Settlement** (liquidación apuntada a mano)
- `eventId` (→Event) · `deFamiliaId` (→Family) · `aFamiliaId` (→Family)
- `importe` (en moneda base) · `fecha` · `apuntadoPor` (→User)

**Plan**
- `eventId` (→Event) · `titulo` · `descripcion` (opcional)
- `dia` (date, **opcional**) · `costeEstimado` (opcional) · `ubicacion` (opcional) · `enlace` (URL, opcional)
- `estado` (`propuesto` | `votando` | `confirmado` | `hecho` | `cancelado`)
- `votos[]` ({ `personaId`, `voto`: `👍` | `🤷` | `👎` }) · `propuestoPor` (→User)

**Cena**
- `eventId` (→Event) · `dia` (date, 1 por día)
- `platos[]` (→Dish)
- `bungaMayoresId` (→Bunga) · `bungaNiñosId` (→Bunga)
- ~~`queSeHace`~~ · ~~`cantidades`~~ — retirados de la app en §14.20; las columnas
  se quedan en D1 y en `tablas.js` para no romper a un móvil sin actualizar

**Dish** (plato — catálogo **global**)
- `nombre` · `categorias[]` (`aperitivo` | `entrante` | `principal` | `acompañamiento` | `postre`)
- `esFavorito` (bool)
- `ingredientes[]` (lista base, opcional) — **habilita la lista de la compra agregada de v2** (§6.5)

**AuditLog** (historial — obligatorio, §9)
- `eventId` (→Event) · `entidad` · `entidadId` · `accion` (`crear` | `editar` | `borrar`)
- `autor` (→User) · `timestamp` · `antes` / `despues` (snapshot del cambio)

---

## 9. Permisos y roles de la app

- **✅ Decidido (Q7): todos editan todo, sin roles.** Cualquier miembro del evento puede crear/editar/borrar gastos, comidas y planes. Confianza alta de grupo de amigos.
- **⚠️ Consecuencias que hay que asumir (yo recomendaba un "creador con extras"):**
  - **No hay quién "cierre" el evento ni la liquidación** de forma autoritativa. Solución mínima: cualquiera puede marcar el evento como cerrado, pero cualquiera puede reabrirlo (sin candado).
  - **Nadie puede expulsar** a un miembro problemático ni proteger un gasto de un borrado accidental o troll.
  - **Imprescindible un historial de cambios** (quién tocó qué y cuándo) para poder deshacer líos y evitar el "yo no fui". Esto pasa de nice-to-have a **requisito** precisamente porque no hay roles.
  - Recomiendo dejar el **modelo de datos preparado para roles** aunque la v1 no los use, por si el grupo pide un organizador más adelante.

---

## 10. Alcance por versiones (propuesta)

**✅ Decidido (Q8): priorizar gastos + gente.** El MVP no intenta cubrir las cinco áreas a la vez.

- **v1 (MVP, foco):** Auth (email mágico), eventos con fechas, **personas/familias/bungas**, **gastos estilo Splitwise con reparto por familia + liquidación entre familias**. Es el núcleo de valor y lo más difícil de acertar.
- **v1.5:** comidas (platos, clasificación, bungas mayores/niños) y planes básicos.
- **v2:** estadísticas ricas, lista de la compra agregada, multi-moneda, notificaciones, histórico entre eventos, votaciones ricas en planes.
- Las áreas de comidas/planes/estadísticas se **especifican** en este doc pero **no se implementan** hasta cerrar el núcleo económico.

---

## 11. Marca y logo 🐋

- **Logo: una ballena** (ballenita — encaja con el repo `ballenita-ops`).
- **Inspiración:** el evento del grupo es a **Camping La Ballena Alegre** (Sant Pere Pescador, Costa Brava). La mascota es una **ballena azul, sonriente y alegre**, en homenaje a ese sitio.
- **Referencia real:** la ballena del camping es azul, **saltando en diagonal**, con una **sonrisa dentona muy marcada** y un **chorro de gotas** sobre la cabeza, sobre fondo azul marino, acompañada del rótulo manuscrito "la ballena alegre / Costa Brava".
- **⚠️ Ojo legal:** ese logo (silueta + rótulo "la ballena alegre / Costa Brava") es **marca registrada de una empresa real**. La app usa una **ballena propia y original** que evoca el espíritu (azul, sonrisa dentona, chorro de gotas) **sin** copiar la silueta exacta y **sin** el rótulo del camping. Nada de dar a entender afiliación oficial.
- Dirección visual: ballena redondeada, azul, con **gran sonrisa con dientes** y **chorro de gotas**; el chorro puede ser de monedas/iconos según la sección.
- Mascota con voz en el microcopy (comenta en momentos clave, §0).

---

## 12. Notificaciones y sincronización

### 12.1 Notificaciones push
- **✅ Decidido: push a tope + resumen diario (por la mañana).** Se notifica bastante (te añaden a un gasto, te toca de anfitrión, alguien propone/vota un plan, se cierra el evento…) y además un **resumen diario que llega por la mañana** ("buenos días: el plan de hoy, quién cena en qué bunga, cómo van las cuentas"), con la ballenita de narradora.
- **⚠️ Riesgo (yo recomendaba "mínimas"):** notificar mucho cansa y la gente silencia la app. Mitigación imprescindible: **preferencias por categoría** (que cada uno apague lo que no quiera) y el resumen diario como digest agrupado en vez de 20 pings sueltos. Sin esos controles, "push a tope" se vuelve en contra.
- Requiere permiso de notificaciones del sistema y un backend que sepa a quién avisar de qué.

### 12.2 Offline-first ⭐
- **✅ Decidido: la app funciona sin cobertura.** Se pueden apuntar gastos, comidas y planes **sin conexión** y todo se **sincroniza al recuperar red**. Es clave: los campings tienen poca o ninguna cobertura, que es justo donde se usa.
- **⚠️ Esto es la decisión más cara de todas técnicamente.** Implica:
  - **✅ Resolución de conflictos: último en sincronizar gana** (last-write-wins), apoyado en el **historial (§9)** para recuperar lo que se haya pisado. Simple y suficiente para un grupo pequeño; el historial es lo que lo hace tolerable sin roles.
  - **IDs generados en cliente** para no chocar al subir.
  - **La API de tipos de cambio no está disponible offline** (§3.6): si metes un gasto en divisa sin red, hay que permitir tipo manual o dejarlo pendiente de completar al reconectar.
  - Encaja bien con "todos editan todo", pero sube el listón de ingeniería del MVP. Merece una nota de riesgo en la planificación.
- **✅ Decidido: offline COMPLETO desde el día 1.** No se recorta el offline: apuntar todo sin red y sincronizar al reconectar. Es lo ideal para el camping. Se resuelve con el **enfoque de counter-ops** (§14: IndexedDB + doc compartido + merge tombstone/LWW), que **rebaja mucho el coste** que temíamos — no hace falta un motor de sync pesado.

---

## 13. Tecnología y ambición

- **✅ Ambición: solo para el grupo de amigos.** No aspira a escalar ni a monetizar. Esto **simplifica muchísimo**: nada de onboarding pulido para desconocidos, ni políticas de privacidad complejas, ni soporte, ni panel de admin. Se optimiza para *nosotros*, con nombres y bromas internas.
- **✅ Plataforma: PWA únicamente. No hay app iOS nativa.** Una web instalable que corre en cualquier móvil (iPhone y Android) desde el navegador y se reparte por enlace/QR. No se pasa por la App Store, no hay Xcode ni SwiftUI, no hay cuenta de desarrollador de Apple.
  - Encaja con "unirse por QR/enlace" (§2.5) y con el hosting en GitHub Pages (§14).
  - El offline-first (§12.2) se resuelve con el enfoque de counter-ops (§14), no con un motor pesado. Ya no es "lo más caro": counter-ops demuestra que un merge de ~150 líneas basta.
  - Si algún día el modelo simple se queda corto, la vía de mejora es subir la parte de sync (sigue siendo PWA), no hacer una app nativa (§14.8).

---

## 14. Arquitectura técnica (PWA)

> ⚠️ **Lee antes [§14.9](#149--migración-a-backend-propio-worker--d1--sustituye-a-142-145-bis-y-145-ter).** La capa de sincronización, el hosting y la identidad **ya no son** lo que describen §14.2, §14.5-bis y §14.5-ter: se migró a Worker + D1. Lo que sigue es el registro de por qué se empezó con el modelo de `counter-ops`, que sigue siendo útil para entender las decisiones que **sí** se conservaron.

> **Contrastado con `counter-ops`** — la PWA de "contar consumiciones" que el grupo **ya usa en el iPhone** y le funciona. Conclusión: su enfoque (mucho más simple que un motor de sync) es la mejor **base de partida** para Ballena Ops. PowerSync + Supabase pasa a ser **vía de mejora**, no el punto de partida.

### 14.1 Qué es `counter-ops` (lo que ya funciona en sus iPhones)
- **React 18 + Vite + `vite-plugin-pwa`** (Workbox) + Tailwind. PWA **standalone instalada en la pantalla de inicio** del iPhone.
- **Sin login:** la identidad es un **enlace personal** (`?member=oscar`) que se reparte por WhatsApp/QR y "reclama" el dispositivo. Admin protegido por contraseña.
- **Almacenamiento:** todo el estado es un **JSON en `localStorage`**. Funciona 100% offline desde el primer guardado.
- **Sync:** empuja/lee un **único documento JSON compartido** (JSONBin.io) al arrancar, tras cada cambio, al volver a foreground, al recuperar red y **cada 60s con la app visible**. **Merge aditivo con tombstones + `updatedAt` (last-write-wins)** — ~150 líneas, sin backend propio.
- Ya resuelve **fotos comprimidas** (`browser-image-compression`), GPS, gráficas, confeti.

### 14.2 Stack recomendado para Ballena Ops (heredado de counter-ops)
| Capa | Elección | Nota |
|---|---|---|
| **Frontend** | **React + Vite + `vite-plugin-pwa`** (+ TypeScript) | Igual que counter-ops. PWA instalable. |
| **Datos** | **IndexedDB desde el principio** (Dexie / `idb-keyval`) | ✅ Sin límite práctico; listo para varios eventos y fotos futuras. Merge tombstone/LWW por encima. |
| **Sync** | **Un documento compartido por evento** + **merge tombstone/LWW** | Reutiliza el merge de counter-ops — **es exactamente nuestro LWW + historial**. Un doc por evento acota tamaño y compartición. |
| **Identidad / Auth** | **Login email mágico** (§2.1) + **unirse por enlace/QR** (§2.5) | ✅ Sin Apple, sin Google por ahora. Login = identidad, no control de acceso (§14.6). |
| **Push** | Web Push (VAPID) | Con las salvedades iOS de §14.3. |
| **Hosting** | **GitHub Pages** (estático, vía GitHub Actions) | ✅ Igual que counter-ops. HTTPS de serie (obligatorio para PWA/service worker). El "backend" es el servicio del doc JSON. Cero servidores propios. |

### 14.3 ⚠️ Safari iOS — confirmado por counter-ops
- **Service Workers** ✅ · **localStorage/IndexedDB** ✅ · **instalable** ✅.
- **⚠️ iOS congela la PWA en segundo plano y no la re-monta al volver.** Counter-ops lo resuelve sincronizando en **`visibilitychange` (foreground)**, en **`online`**, **tras cada cambio** y con un **intervalo de 60s mientras está visible**. → **Adoptamos ese mismo patrón.** No hay background sync real, pero para el uso (abrir la app en el camping) sobra.
- **⚠️ Web Push solo con la PWA "en pantalla de inicio"** (iOS 16.4+). Sin instalar → no hay push en iPhone.
- **⚠️ Desalojo de almacenamiento** tras ~7 días de inactividad si NO está instalada. Mitigación: instalar en pantalla de inicio + el **doc compartido es la fuente de verdad** (se re-sincroniza).

### 14.4 Onboarding: "Añadir a pantalla de inicio" (iOS)
- No es un marcador: iOS trata la PWA como **app instalada** → pantalla completa, **almacenamiento persistente** y **push habilitado**. (Counter-ops lo documenta igual: Safari → Compartir → "Añadir a pantalla de inicio".)
- La primera vez en iOS, **aviso guiado** de dos toques explicando el porqué (offline persistente + notificaciones + pantalla completa).
- **Detección:** `navigator.standalone` / `display-mode: standalone` para no repetir el aviso.

### 14.5 Cómo encaja con lo decidido
- **Offline completo (§12.2)** → JSON local; **no hace falta motor de sync**. Esto **rebaja el "es la decisión más cara"**: counter-ops demuestra que un merge de ~150 líneas basta.
- **LWW + historial (§9)** → merge tombstone + `updatedAt` (ya escrito en counter-ops) + tabla `AuditLog`.
- **IDs en cliente** → ya es el patrón.
- **Reparto por familias, multi-moneda** → todo cálculo en cliente sobre el JSON local; el doc compartido solo almacena y sincroniza.

### 14.5-bis Deploy en GitHub Pages (heredado de counter-ops)
- **Subpath:** se sirve en `https://oscarini-garcia.github.io/ballenita-ops/` → hay que fijar `base: '/ballenita-ops/'` en `vite.config` y el `start_url`/`scope` del manifest a ese path (counter-ops lo hace igual con `/counter-ops/`).
- **Deploy:** un **workflow de GitHub Actions** compila (`vite build`) y publica en Pages en cada push a `main`.
- **Secrets:** el Bin ID / Master Key del doc de sync van como **secrets del repo**, inyectados en build como `VITE_...`. (Recordatorio: en el modelo simple —opción A— acaban en el bundle; se asume.)
- **Rutas SPA:** GitHub Pages no hace fallback de rutas → usar **hash routing** o un `404.html` que redirija a `index.html`.
- **⚠️ Setup a tener en cuenta:** GitHub Pages en un **repo privado** requiere plan **Pro/Team**. Si el repo es privado y estás en plan free, hay que **hacerlo público** o subir de plan para que Pages publique.

### 14.5-ter Coste de sincronización — ¿se mueven muchos datos? (medido)

**No.** Medido sobre un documento de evento **grande y realista** (12 personas, 4 familias/bungas, **60 gastos**, 7 cenas, 20 planes, 8 pagos):

| | Tamaño |
|---|---|
| Documento del evento (JSON crudo) | **~83 KB** |
| Documento **gzip** | **~5 KB** |
| Un ciclo de sync (GET + PUT), crudo | ~166 KB |
| Un ciclo de sync, gzip | **~10 KB** |

- Un evento pesa como **una imagen pequeña**. El JSON comprime muchísimo (≈16×) por claves e IDs repetidos.
- **Lo que infla** (y escala con gente × ítems): los `participantIds` de cada gasto (lista todos los UUID) y los `votos` de cada plan. Aun así, marginal.
- **El modelo de counter-ops sincroniza el documento entero** (no deltas): cada sync mueve todo el evento. A este tamaño da igual; importaría solo con miles de registros.

**La preocupación real no es el tamaño, es la frecuencia y la cuota de peticiones.** Mitigaciones (a aplicar al enchufar la sync):
1. **PUT solo si hay cambios locales** (dirty flag). counter-ops sube en cada ciclo; nosotros nos lo saltamos si no hay nada nuevo → recorta el grueso de la escritura.
2. **Polling más suave** (3–5 min, o solo tras un cambio / al volver a foreground) en vez de cada 60 s.
3. **Un doc por evento** (ya decidido): no se sincronizan eventos cerrados/inactivos.
4. **Cuota, no ancho de banda:** el plan gratis de JSONBin limita **peticiones/mes**; con varios dispositivos polleando puede ser el primer techo. Si aprieta: subir el intervalo, o mover el doc a un KV propio (Cloudflare Workers KV) — sigue siendo el mismo patrón.
5. gzip apenas hace falta a estos tamaños; no merece ingeniería.

**Veredicto:** para un grupo de amigos, el tráfico es trivial. El diseño aguanta de sobra; solo hay que **no hacer PUT en vano** y **no pollear demasiado**.

### 14.6 Forks resueltos (dónde Ballena Ops difiere de counter-ops)
1. ~~**✅ Auth: SÍ hay login (email mágico; sin Apple, sin Google por ahora).**~~ **Revocado en §14.9:** el login es **Sign in with Apple**, con alta por invitación. El email mágico nunca llegó a implementarse.
2. ~~**✅ Privacidad del backend: se acepta el modelo simple** (clave del doc en el cliente, como counter-ops).~~ **Revocado en §14.9:** ese modelo era justamente el problema —la clave acababa en el bundle de una web pública—. Ahora autoriza una sesión firmada por el Worker.
3. **✅ Almacenamiento: IndexedDB desde el principio** (Dexie / `idb-keyval`). Sin límite práctico, listo para varios eventos y para fotos más adelante. Mismo patrón de merge tombstone/LWW por encima.
4. **✅ Fotos: emoji/preset en v1, fotos a v2** (avatar y ticket). Mantiene el doc de sync ligero.

> **⚠️ Tensión a resolver (la señalo, no la escondo):** elegiste **login real** (#1) **y** a la vez **el doc con clave en cliente** (#2). Ojo: con ese modelo, cualquiera que tenga la clave del doc **lee/escribe los datos aunque no haya iniciado sesión** — es decir, **el login identifica pero NO protege el dinero** (no es control de acceso, solo "quién eres" para mostrar y para el historial). Dos caminos coherentes:
> - **(A) Login como identidad/comodidad** + aceptar el modelo simple → válido si confías en el grupo y te vale que el login sea "cosmético" para seguridad. Es barato y encaja con counter-ops.
> - **(B) Login como control de acceso real** → entonces el dato debe vivir tras ese login (Supabase con RLS o un proxy que valide el token), no en un doc de clave compartida. Más seguro, más cerca del stack "grande".
> **✅ Decidido: opción (A).** El login (email mágico) es **identidad y comodidad** (saber quién es quién, alimentar el historial), **no control de acceso**. Se acepta que quien tenga la clave del doc puede tocar los datos — grupo de confianza. Si algún día preocupa de verdad, la vía de subida es (B) → Supabase con RLS (§14.8).

### 14.7 ✅ Veredicto de viabilidad — ¿aguanta el modelo de counter-ops?

**Sí, con una condición de diseño clave:** *sincronizar los hechos en bruto y calcular lo derivado en local.*

**Por qué funciona (el paralelismo exacto):**
- counter-ops nunca sincroniza el marcador; sincroniza las **entradas** y **recalcula** el leaderboard en cada dispositivo. En Ballena Ops, **los saldos son a los gastos lo que el leaderboard es a las entradas**: una **función pura** sobre un registro que crece (gastos + liquidaciones). No se sincroniza el saldo; se sincronizan gastos/pagos y **el motor de reparto recalcula** igual en todos los dispositivos.
- Con `id` de cliente + merge (unión por id, `updatedAt` LWW, tombstones para borrados), **todos los dispositivos convergen al mismo conjunto de gastos → mismo saldo.** Eventualmente consistente y correcto.
- Gastos = **append + editar + borrar**, y counter-ops ya hace las tres (edita miembros/contadores con `updatedAt`, borra con tombstones). El patrón traslada 1:1.

**Dónde aprieta (y cómo se mitiga):**
1. **Edición concurrente del MISMO gasto sin red** → LWW: gana el último, el otro cambio se pierde pero **se recupera del historial** (§9). Raro en un grupo pequeño; aceptable por la decisión LWW.
2. **Integridad referencial en borrados** (borrar una familia que tiene gastos, o un plato usado en una cena) → reglas de merge/UI: bloquear el borrado si está referenciado, o mostrar "familia eliminada". Solvable, no bloqueante.
3. **Fotos en el doc de sync** → base64 en el JSON compartido lo infla rápido. Regla: **las fotos NO van en el doc de sync** (avatares emoji/preset en v1; fotos comprimidas o almacenamiento aparte si se activan).
4. **Tamaño** → un doc **por evento** (no todo en uno) mantiene cada JSON pequeño; IndexedDB como plan B si crece.

**Dónde NO serviría (para tener el límite claro):** si esto creciera a muchos grupos, datos grandes, o hiciera falta **consistencia fuerte** (que un saldo no pueda estar nunca desactualizado ni un segundo) — ahí sí tocaría PowerSync/Supabase. **No es el caso** de un grupo de amigos.

**Conclusión:** el modelo de counter-ops es **viable y recomendado** para Ballena Ops. La única regla de oro añadida es *"sincroniza hechos, calcula saldos en local"*, que además es como ya está pensado el motor de reparto (§3, «Lógica»).

### 14.8 Vía de mejora (sigue siendo PWA, no app nativa)
- Solo **si el modelo simple se queda corto** (muchos eventos, datos grandes, sync más robusto o control de acceso real): subir la capa de sync/backend a **PowerSync + Supabase** (con RLS) — **sin dejar de ser una PWA**.
- Antes sería **sobre-ingeniería** para lo que el grupo necesita hoy. El enfoque de counter-ops es el punto de partida sensato. **No se contempla app iOS nativa.**

### 14.9 ⚠️ Migración a backend propio (Worker + D1) — **sustituye a 14.2, 14.5-bis y 14.5-ter**

> Lo anterior de §14 queda como **registro de por qué se empezó así**, no como
> descripción de lo que hay. El montaje de counter-ops (JSONBin + merge en el
> cliente) se retiró y se adoptó el stack de `garciadoral-ops`.

**Por qué se cambió.** El motivo decisivo no fue la cuota de peticiones que
anticipaba §14.5-ter, sino la **credencial**: `VITE_JSONBIN_KEY` se inyectaba en
el build, de modo que la clave maestra del documento viajaba dentro del
JavaScript de una web pública. Cualquiera con la URL podía leer y sobrescribir
los gastos del grupo. Los demás beneficios (copias, migraciones, conflictos
campo a campo) llegaron de propina.

**Qué hay ahora.**

| Capa | Antes | Ahora |
|---|---|---|
| Backend | ninguno · JSONBin | **Cloudflare Worker + D1** (`api/`) |
| Sync | documento entero ↔ merge LWW + tombstones **en cada móvil** | **cola de cambios** → el servidor aplica → devuelve la instantánea, que **sustituye** la copia local |
| Conflictos | por registro entero | **por campo** (solo se envía lo que cambia) |
| Borrados | tombstone en cada cliente | `borrado = 1` en el servidor; deja de transmitirse |
| Identidad | ninguna (email mágico, pendiente) | **Sign in with Apple** (solo app iOS), alta por invitación |
| Hosting | GitHub Pages, subpath `/ballenita-ops/` | **Cloudflare Pages**, base `/` |
| Configuración | variables `VITE_*` horneadas en el build | `public/config.json`, **leído en caliente** |

**Lo que NO cambió, y es lo importante:** se siguen sincronizando **hechos**, y
los **saldos se calculan en local** (`lib/reparto.js`). El servidor no guarda ni
transmite un saldo jamás.

**Lo que se descartó a propósito** de `garciadoral-ops`: su **filtrado por
lector antes de transmitir**. Allí es la regla que gobierna el sistema porque su
modo de fallo grave es arruinar una sorpresa de regalos; aquí todo el grupo ve
lo mismo y esa maquinaria sería complejidad sin requisito que la justifique.

**Consecuencia asumida:** el acceso solo con Apple deja fuera a quien no tenga
un Apple ID, y añade los 99 €/año del programa de Apple. Se aceptó a sabiendas
(§15). El Worker está escrito de forma que añadir otro proveedor de identidad
más adelante no toca ni la sincronización ni el modelo de datos.

**Y una segunda, mayor: el acceso vive solo en la app de iOS.** En navegador y
en la PWA instalada, Ballena Ops es una libreta local que no sincroniza. Se
eligió así para evitar la mitad web del montaje de Apple —Services ID,
verificación de dominio, fichero `.txt`, SDK en ventana emergente—, que es la
parte que más se atasca y la que más piezas frágiles añade.

Lo que cuesta:

- **Para participar en el grupo hace falta la app instalada.** Un portátil o un
  Android sirven para apuntar cosas propias, no para compartirlas.
- **La primera cuenta no se puede crear sin la app**, así que el arranque de una
  instalación nueva depende de haber compilado y subido el binario.

Recuperarlo sería declarar el Services ID y añadir `APPLE_AUD_WEB`: el Worker ya
admite esa audiencia si aparece, y `auth/apple.js` volvería a necesitar su rama
web. Cambio de configuración más una función, no de arquitectura.

**La puerta no es un muro (modo local en iOS).** Todo lo anterior deja un modo
de fallo feo: si Apple no deja entrar por algo que no se arregla desde el móvil
—al binario le falta la capacidad, el App ID está a medias—, la app instalada se
queda en la pantalla de acceso y no sirve ni para apuntar. Y eso solo se
descubre cuando ya no hay un Mac cerca. Por eso la pantalla de acceso ofrece
**usar solo en este móvil**: la app entra como libreta local, sin sesión y sin
sincronizar.

- La decisión se recuerda por dispositivo (`ballena.soloLocal` en
  `localStorage`), como la sesión: no es un hecho del grupo.
- **No se pierde nada.** Toda escritura sigue pasando por `escribir()`, que deja
  su entrada en la cola; el día que se entra, la cola sube entera en el primer
  ciclo de sincronización.
- El punto de estado lo dice (`sin-sesion` → «Modo local (sin entrar)») y
  Ajustes ofrece volver a intentarlo, que es olvidar la marca y recargar.

**Y los errores de Apple se traducen por código, no por texto** (`auth/apple.js`,
`explicarFalloDeApple`). El matiz importa: `ASAuthorizationError` **1001 es
«cancelado»**, e iOS devuelve ese mismo 1001 tanto si se cierra la hoja como si
la petición ni siquiera llega a presentarse —sin sesión de iCloud, sin
verificación en dos pasos, con Tiempo de uso restringiendo, o con el binario sin
la capacidad—. Antes se culpaba a Xcode en todos los casos, que es la única
causa que **no** se puede arreglar desde el iPhone; ahora el mensaje separa las
dos ramas con la pregunta que las distingue: ¿llegó a salir la hoja de Apple?

Pasos de despliegue: [`DESPLIEGUE.md`](DESPLIEGUE.md).

### 14.9-bis Sincronizar como en `garciadoral-ops`: que se pueda saber qué ha pasado

La mecánica no cambia —cola de cambios, el servidor manda, la instantánea
sustituye la copia local—. Lo que cambia es **lo que se le cuenta a quien mira**,
que es donde `garciadoral-ops` estaba resuelto y aquí no. El problema que
resuelve es siempre el mismo: desde un iPhone no hay consola que abrir, así que
lo que no salga en la pantalla no existe.

**El estado HTTP viaja con el error** (`sync/api.js`). Antes cualquier fallo
llegaba a la pantalla como «no se han podido sincronizar los datos: error», que
es la misma palabra dos veces. Ahora el error lleva `estado` y, cuando el Worker
explica algo en el cuerpo, también su texto. La distinción que interesa es
«contestó que no» frente a «no contestó»: un **500** es un fallo del servidor, un
**404** una dirección equivocada en `config.json`, y **no tener número** es que
la petición no llegó a salir —red, DNS o certificado—. Son tres arreglos
distintos y antes se veían iguales.

**Lo que el servidor rechaza se dice** (`sync/engine.js` → `lib/sincronizarTodo.js`).
Los cambios que vuelven con `aplicado: false` se contaban solo por `console.warn`.
Y la interfaz es **optimista**: un cambio rechazado se vio guardado un momento y
desaparece con la instantánea siguiente, así que callarlo no se lee como un
rechazo sino como que la app pierde cosas. Ahora la lista de pasos añade un
renglón en rojo con cuántos fueron.

**Última actualización, en palabras** (`lib/hace.js`, copiado de `semana.js` de
`garciadoral-ops`). El momento de la última sincronización **correcta** se apunta
en `localStorage` (`ballena.sync.ultima`) y Ajustes lo enseña como «hoy a las
14:03» o «hace 12 min». Es un dato que se lee para tranquilizarse, y «al día» sin
fecha no dice nada: puede llevar cinco minutos o tres días. Los tramos no son
arbitrarios —por debajo de cinco minutos el número exacto no añade nada, y a
partir de una semana la hora ya no importa y sí la fecha—.

**El fallo se toca para llevárselo.** Un renglón con estado `fallo` lleva un
`informe` —versión de la app, motivo, estado HTTP y cuándo fue la última
correcta— que se copia al portapapeles al tocarlo, subrayado con puntos para que
se vea que hace algo. Nadie transcribe a mano un mensaje de TLS desde un
teléfono, y es justo lo que hay que enseñarle a quien pueda arreglarlo. El token
no entra en el informe: no hace falta para nada de esto.

**En Ajustes el progreso se pinta en su sitio, sin ventana encima**
(`ListaDePasos`, exportada de `ProgresoModal.jsx`). Es la figura de
`garciadoral-ops`: la lista aparece debajo del botón y **se queda**, porque lo
que ha ido pasando se relee después —para saber si aquello llegó a subir— y un
modal que se cierra no deja nada. El punto de la cabecera **sigue abriendo el
suyo**, porque allí un toque sin respuesta a la vista no diría nada; la
diferencia la elige quien lo dispara, pasando `alAvanzar` a `sincronizarTodo()`.

Lo que **no** se ha copiado: el porcentaje de descarga de la actualización.
`lib/native.js` no expone ningún avance —`checkForOtaUpdate` no tiene callback de
progreso—, así que la fase de la app sigue contándose por rótulos
(«Descargando…») y no por cifra. Ponerlo exige tocar el puente nativo.

### 14.9-ter Salir de la cuenta sin llevarse la cola por delante

**El fallo.** «Salir» (Ajustes → Tu cuenta) hacía `borrarSesion()` y
`olvidarTodo()` de un tirón. Borrar la copia local está bien —los datos del grupo
no se quedan en un móvil que ya no va a poder actualizarlos—, pero `olvidarTodo()`
vacía también el **`outbox`**, que es lo apuntado que todavía no ha llegado al
servidor. Al volver a entrar, la instantánea es la única fuente: lo que no había
subido no vuelve. Visto desde fuera, **«he salido, he vuelto a entrar y el evento
ha desaparecido»**.

No hacía falta nada raro para caer en ello. Basta con haber apuntado sin
cobertura, venir de «usar solo en este móvil» —donde por definición nada ha
subido—, o que la última sincronización fallara. Y la promesa escrita en §14.9 es
justo la contraria: *«los datos que se apunten aquí no se pierden: cada escritura
deja su entrada en la cola»*.

**El arreglo** (`lib/salida.js`, `comprobarAntesDeSalir`): antes de borrar nada se
**intenta subir la cola**.

- Cola vacía → se sale directo, sin preguntar. Salir no es el momento de esperar
  a la red si no hay nada que esperar.
- Sube entera → se sale igual: ya está todo en el servidor.
- No sube (o sube a medias) → **no se borra nada**. Se dice **cuántos** cambios se
  perderían y **por qué** no han subido —con los mismos motivos que la lista de
  pasos, `MOTIVOS` se exporta de `sincronizarTodo.js`— y salir pasa a ser una
  segunda pulsación («Quedarme» · «Salir igualmente»), con la figura de
  `.confirmar` que ya usa el editor del grupo.

El número va delante porque es lo que se decide: «3 cambios sin subir» permite
elegir y «tienes cambios sin subir» no. Mismo criterio que §14.9-bis: lo que falla
se cuenta, no se calla. Probado en `lib/salida.test.js` (la decisión) y en
`screens/CuentaSalir.test.jsx` (que con cola pendiente **no se llama a
`olvidarTodo`** hasta confirmar).

### 14.9-quinquies Sin red, el punto dice **cuántos** cambios esperan

El motor ya contaba la cola (`db.outbox.count()`) y **tiraba el número**:
guardaba solo `dirty`, un sí/no. Sin cobertura la cola crece —una comida, tres
gastos, un plan, la compra— y «cambios sin subir» dice exactamente lo mismo con
uno que con veinte. La pregunta que se hace uno en el camping no es «¿hay algo
pendiente?» sino **«¿está lo que acabo de apuntar?»**, y a eso solo contesta un
número.

Es el mismo criterio que en §14.9-ter, donde salir de la cuenta dice cuántos
cambios se perderían: el número va delante porque es lo que se decide. Saber que
hay quince es lo que hace subir a buscar cobertura, o al menos esperar; sin él,
lo apuntado se da por perdido y se vuelve a teclear.

- El motor expone **`pendientes`** (el número) y `dirty` pasa a derivarse de él.
- El número sale **en el punto** —lo único de la sincronización que se ve sin
  entrar en Ajustes—, **en su rótulo** («Sin conexión · 14 cambios») y **en su
  renglón** («14 cambios esperando a que vuelva la red. No se pierde ninguno»).
- También en **sesión caducada**, que es donde más importa: ahí lo apuntado no
  sube hasta que alguien vuelva a entrar con Apple, y eso puede tardar días.
- **Tope en 99**, porque el punto vive en una cabecera de 390 pt y cuatro cifras
  la empujarían; el rótulo sí dice la cantidad exacta. Y **dentro de una tarjeta
  el número no se pinta**: se sale de la pastilla —que mide lo que un icono— y el
  renglón de al lado ya lo dice con todas las letras.
- Si nadie ha contado todavía —la ficha de Ajustes se pinta antes de que haya
  motor— **no se enseña un 0**: sería afirmar algo que no se sabe.

### 14.9-quater El evento de ejemplo se llama «Demo», y es un cajón de arena

**El nombre.** Se llamaba **«Ballenita 2026»**, que es exactamente como se
llamaría un viaje de verdad. En la lista de eventos, al lado de los reales, no
había forma de distinguirlo, y lo que se apuntara dentro parecía apuntado en el
sitio bueno. El lugar y las fechas se quedan —sin ellos la app abre vacía y no
enseña lo que hace—, pero el rótulo dice lo que es: `NOMBRE_DEMO` en `db.js`,
usado por los dos caminos que siembran, la demostración de la pantalla de acceso
(`lib/demo.js`, directriz 2.1) y el «Cargar el evento «Demo»» de la lista cuando
no hay ninguno.

**Y lo de dentro se queda dentro.** Cenas, planes, gastos y compra ya colgaban de
su evento y nunca se mezclaron. **`dishes` era la única tabla suelta**: un
catálogo global y a propósito —la paella no se reescribe cada verano—, pero el
Demo escribía en ese mismo catálogo. Resultado: sus seis platos de mentira
aparecían al preparar el viaje de verdad, y cualquier plato apuntado mientras se
trasteaba se quedaba allí para siempre. Peor aún, se sembraban **solo si el
catálogo estaba vacío**, así que en una instalación con platos de verdad la cena
de ejemplo salía sin nada.

Ahora un plato puede llevar `eventId`:

- **Sin `eventId`** → catálogo compartido entre eventos. Es el caso normal y el
  comportamiento de siempre.
- **Con `eventId`** → el plato es solo de ese evento. Hoy eso solo le pasa al
  Demo, que se reconoce por `events.esDemo`.

`listDishes(evento)` y `addDish(campos, evento)` reciben el evento y deciden con
eso; los cinco sitios que leen el catálogo se lo pasan. No hace falta índice: el
catálogo se lee entero y son decenas de filas. En la API son dos columnas nuevas
(`0005_demo_y_platos_por_evento.sql`); una base recién creada ya las trae en el
esquema y una que ya existiera necesita `npm run migrar:remoto5` una sola vez.

### 14.10 Cromo de la app: cabecera, barra inferior y modales

Lo que rodea al contenido, que es donde se notan los roces del uso diario. Este
apartado se rehízo tomando como referencia lo aprendido en `meeting-ops-air` y
`garciadoral-ops`, que resolvieron antes los mismos problemas.

**El esqueleto es una columna, no un apilado de cosas fijas.** `.app` mide
`100dvh` y es `flex-direction: column`: cabecera (`flex: none`) · contenido
(`flex: 1; min-height: 0; overflow-y: auto`) · barra (`flex: none`). Nada se
solapa porque nada se superpone — una lista de cualquier largo termina encima de
la barra y empieza debajo de la cabecera. Sustituye al parche anterior, que era
reservar `86px + env(safe-area-inset-bottom)` de relleno al final del contenido
para esquivar una barra `position: fixed`; ese número había que mantenerlo a
mano y fallaba en cuanto la barra cambiaba de alto (p. ej. al subir el tamaño
del texto). El `min-height: 0` es lo que hace verdad todo lo demás: sin él una
lista larga estira la columna en vez de desplazarse dentro.

**Ajustes es la quinta pestaña, abajo a la derecha.** Estuvo como ⚙️ en la
esquina de la cabecera y se ha bajado a la barra: arriba a la derecha es lo que
peor alcanza el pulgar de una mano sola, y es justo el sitio al que hay que
estirarse cuando algo no va. Es la resolución de `garciadoral-ops`. De paso se
comió lo que era «Más»: las estadísticas eran media pestaña de primer nivel para
algo que se mira al volver del viaje, y ahora son un apartado de Ajustes.

Barra: **Agenda · Dinero · Comidas · Planes · Ajustes** (ver §14.10-ter, que es
donde se cuenta por qué esos cinco nombres y qué hay dentro de cada uno).

**Cabecera: la ballena, dónde estás y el punto.** Tres cosas, y el badge de
«quién eres» **se retiró**. Decía tu nombre en todas las pantallas y todo el
rato, en un móvil que es tuyo —una respuesta a una pregunta que ya sabes—, y
costaba 112 px de una fila que solo tiene 390: con él, el logotipo y el punto, al
nombre del evento le quedaban 87 px y «Ballenita 2026» se leía «Ballenita 2…».
Sin él, el título dispone de 258 px y cabe entero.

Lo que el badge hacía —tu emoji, tu estado, tu foto y cambiar de persona— vive
ahora en **Ajustes → Quién eres**, que es donde se va cuando de verdad hay algo
que cambiar. Y deja de ser un modal: dentro de un apartado que ya está abierto,
una ventana encima era una ventana de más.

**El punto de sincronización vuelve a la cabecera, y ahora sincroniza todo.** Un
toque hace las dos capas en el orden que importa —primero los datos, que es lo
que se suele querer decir y es de lo que se pinta el punto; después la versión de
la app, que es lo único que no se aplica hasta recargar— y lo cuenta en **una
sola lista** que se lee de arriba abajo como lo que ha ido pasando
(`lib/sincronizarTodo.js`, figura tomada de `garciadoral-ops`). Tener dos botones
que hacían media cosa cada uno obligaba a acertar cuál era tu problema antes de
dejarte mirar: nadie llega aquí sabiendo eso, se llega porque algo no está como
se esperaba, y «¿han subido mis gastos?» y «¿tengo la versión buena?» son la
misma pregunta hecha a capas distintas.

El punto es de 12 px dentro de un objetivo de 44: el punto es lo que se lee y el
botón es lo que se apunta, y no son la misma medida. Sus colores salen de las
variables del tema, así que se recolorea con la skin. Sus rótulos son cortos
(«Solo local», «Al día», «Cambios sin subir») porque el mismo texto se pinta como
nombre de fila en Ajustes; lo largo va en el `detalle`, que tiene dos renglones.

Para que el punto pueda tocarse a menudo hizo falta partir `lib/pwa.js` en dos:
`comprobarActualizacion()` mira si hay versión nueva y **solo recarga si la
hay**, mientras que `forzarActualizacion()` —la de Ajustes → «La app»— termina
siempre en recarga, porque su último recurso es borrar cachés y recargar. Eso
está bien detrás de un botón que se llama «Comprobar» y está fatal detrás de uno
que se llama «Sincronizar».

**Ajustes, en apartados plegables.** `<details>`/`<summary>` del navegador, sin
JavaScript por debajo (`components/Acordeon.jsx`): el elemento ya se abre al
tocarlo y con Enter, ya se anuncia como plegado o desplegado a quien no ve, y el
buscador del navegador abre por su cuenta el apartado donde encuentra algo.

**Todos plegados.** Ajustes es una lista de cosas que casi nunca se tocan, y
dejar una abierta obliga a pasarle por encima para llegar a las demás; con las
diez plegadas la pantalla entera se lee de un vistazo y se toca la que se venía a
buscar, que es un gesto en vez de un desplazamiento. Cada rótulo lleva su moneda
(la figura de los Ajustes de iOS) y una **nota** que dice algo con la solapa
bajada —«Abisal Fiesta», «v0.2.0», «6»—, así que plegado no quiere decir mudo.

Los apartados, en orden: Sincronización · Aspecto · Quién eres · Evento ·
Estadísticas · Familias · Bungalows · Gente · Tu cuenta · La app.

**Quién eres.** La identidad vive en `lib/identidad.js` (localStorage por evento,
**no se sincroniza**: cada móvil elige la suya). El apartado de Ajustes es ahora
el único sitio donde se toca, y lleva las dos cosas: **tu perfil** —emoji, estado
y foto— y **cambiar de persona**, para el móvil que se pasa de mano en mano en el
bunga. El emoji y el estado son hechos del grupo y sincronizan; la foto no.

**Escoger evento desde Ajustes.** El apartado «Evento» enseña el que está en
curso, lista los demás para saltar sin pasar por la portada, y deja volver a la
lista completa.

**Foto de avatar** (`lib/avatares.js`): se recorta a un cuadrado de 96 px y se
guarda **en el dispositivo** (localStorage), **fuera de la sincronización**. La
instantánea del servidor lleva hechos, no binarios (§14.6, decisión «fotos a
v2»), así que la foto es cosa de tu móvil y el **emoji sigue siendo el avatar
que ve el grupo**. Compartirlas con el grupo es la v2 de §5.2 y necesita
almacenamiento aparte.

**Modal de progreso** (`components/ProgresoModal.jsx`). Lo pintan los dos
procesos largos —sincronizar todo, y comprobar la versión desde Ajustes— porque
son el mismo gesto a capas distintas y merecen la misma figura. Recibe
`[{ texto, estado }]` con estado `curso | hecho | fallo | aviso`; «aviso» existe
porque «aquí no hay sincronización» es una respuesta, no una avería. Mientras
quede un paso en curso **no hay salida dibujada**: el proceso o termina o
recarga, y un «Cancelar» ahí sería mentira.

**Modales: el fondo no se mueve** (`lib/scrollLock.js`), y hay **dos scrollers**
que tapar:

- El del documento: `overflow: hidden` en el body no basta en Safari iOS —el
  gesto se lo queda el documento igualmente—, así que el body se fija
  (`position: fixed`) desplazado lo que estuviera scrolleado y se devuelve al
  cerrar.
- El de la aplicación: desde que el esqueleto es una columna de `100dvh`, el
  documento ya no se desplaza nunca y quien lo hace es `.body`, un `div`. Fijar
  el body de la página no le hace nada. Ahí sí basta `overflow: hidden` —el
  problema de Safari es del scroller del documento, no de un div normal—, puesto
  por clase (`body.modal-abierto .body`) para no pelearse con otros estilos.

Los dos siguen puestos. Un contador permite modales anidados (y el doble montaje
de StrictMode). Todos los modales lo usan.

### 14.10-bis Corregir y crear: el gesto de la fila y el botón con la palabra

**Deslizar una fila descubre sus verbos** (`components/Deslizable.jsx`). Cada
gasto llevaba un botón «borrar» puesto, siempre visible, que ocupaba justo el
hueco del importe —lo que se viene a mirar en Dinero— y no dejaba sitio para
«Editar». Ahora la fila enseña cuánto costó y se desliza a la izquierda para las
dos cosas. Es el gesto de `garciadoral-ops` y de cualquier lista de iOS.

Tres cosas que no salen gratis y que están resueltas:

- **El desplazamiento vertical manda.** Se escucha con eventos de puntero, y
  hasta que el gesto no se aparta 10 px no se decide de quién es: si baja más de
  lo que se mueve a los lados, es de la página. `touch-action: pan-y` se lo dice
  también al navegador, que así no espera nuestro veredicto para scrollar.
- **El `click` que remata el arrastre se consume.** El navegador lo dispara al
  soltar, y sin consumirlo entraba por el mismo sitio que un toque y cerraba la
  fila en el gesto que acababa de abrirla. jsdom no lo emite, así que esto solo
  se ve en un navegador de verdad.
- **Con el teclado no hay nada que arrastrar**: los verbos son botones y
  enfocarlos abre la fila. Cerrada, se ocultan con `visibility` para que no
  queden en la ruta del tabulador.

Dos detalles de color. La cara de la fila necesita un fondo **opaco**
(`--fila-solida`), porque con el `rgba` translúcido de las tarjetas de los temas
de cristal el rojo de «Borrar» se transparentaba a través de toda la fila; los
tres temas afectados lo pisan en `skins.css`. Y los verbos llevan **color propio
y no el del tema**: `--spout-deep` es cian claro en Abisal y `--owe` es salmón, y
con blanco encima no se leen. Es lo correcto además de lo práctico — como el
ámbar de `meeting-ops-air`, un verbo destructivo es un hecho sobre la fila y no
un acento, así que «Borrar» es el mismo rojo en los nueve temas.

**Corregir un gasto existe.** La misma ficha sirve para apuntarlo y para
arreglarlo (`ExpenseModal`): con un gasto puesto, los campos arrancan con lo que
había y al guardar se actualiza. Antes había que borrarlo y volver a teclearlo
entero, con su reparto, por un 24,60 € que eran 26,40. Al corregir **se conserva
`dateISO`**: es cuándo se gastó, no cuándo se cayó en la cuenta del error.

El gesto va en la lista de gastos y solo ahí. Cenas y Planes no son filas sino
tarjetas llenas de mandos —votos, fechas, confirmar—, no tienen presión de ancho,
y una superficie que se arrastra por encima de todo eso pelearía con ellos.

**El botón de crear lleva la palabra puesta** (`components/Fab.jsx`): «+ Gasto»,
«+ Cena», «+ Plan». Un «+» a secas no dice qué va a crear y obligaba a acordarse
de en qué pestaña estabas. Mismo sitio y mismo gesto; cambia la forma —pastilla
en vez de cuadrado, porque ahora crece con el rótulo—, no el sistema.

### 14.10-ter Cinco secciones y sus áreas

Las opciones, dibujadas a 390 pt y con los números medidos contra `theme.css`,
están en [`docs/diseño/navegacion.html`](diseño/navegacion.html). Lo elegido:
**A1 · B2 · C1 · D1 · E1 · F3 · G1**, más **H1** para el botón de editar un día.

| Sección | Áreas | Por qué |
|---|---|---|
| **Agenda** | Hoy · Días | El rótulo nombra la sección, no su primera área |
| **Dinero** | Gastos · Saldos | Sin tocar: ya estaba bien |
| **Comidas** | Cenas · Platos · Compra | Cabe la comida de mediodía sin retocar la barra |
| **Planes** | — | |
| **Ajustes** | acordeón | |

**El rótulo nombra la sección, no su primera área.** La primera pestaña se
llamaba «Hoy» y ahora es «Agenda»: una pestaña «Hoy» que contiene un área «Hoy»
deja de decir dónde estás para decir dónde estabas al entrar. Cuesta que el
destino más visitado pierda la palabra más corta —«Hoy» son 28 pt y «Agenda»
55—, y se paga una sola vez. Por lo mismo la segunda área es «Días» y no
«Evento»: el nombre del evento ya está en la cabecera y en Ajustes hay **otro**
apartado llamado «Evento», que es donde se cambian sus fechas.

**«Hoy» contesta la pregunta con la que se abre la app y se calla lo demás**
(opción E1). El titular de la cena y los planes del día; ni el dinero, ni la
compra, ni una lista de deberes. Y para los otros trescientos cincuenta y siete
días del año, **enseña el día más próximo diciendo lo que es** (F3): «el primer
día, dentro de 6 días», «el último día, hace 5». Antes decía «la agenda está
vacía, añade cenas y planes», que era mentira —había ocho días apuntados— y hacía
que alguien volviera a apuntar lo que ya estaba.

**«Días» es una fila por día, todos, también los vacíos** (G1). La agenda hacía
`if (!cena && !planes) return null` y un viaje de ocho días con cosas en tres
enseñaba tres filas; el día vacío es justo el que hay que tocar para llenarlo.
Una fila mide 70,7 pt, así que los ocho caben en los 633,6 del cuerpo y se ve de
un vistazo cuál está libre — una tarjeta por día no cabía ni con los ocho vacíos
(874 pt). El lápiz es de 44 × 44 y la fila entera abre el mismo modal (H1): el
botón está para decir que el día se edita, no para tener que acertarle.

En el modal de un día se monta o se corrige **su cena** y se dice **qué planes
caen en él**, que es todo lo que un día tiene. Un día no se crea ni se borra:
existe porque el evento tiene esas fechas.

**La compra se queda en Comidas, como tercera área** (D1). Al pasar la segunda a
ser Platos se habría quedado sin sitio en la navegación entera. Es lo que se abre
en el súper, de pie y con el carro, y ahí un toque de más se nota; con tres áreas
el mando da 115,3 pt por hueco, dos veces y media el mínimo de Apple.

**Platos es el catálogo, que no tenía pantalla.** `updateDish` y `removeDish`
llevaban desde el primer día en `db.js` sin que los llamara nadie: la única alta
era el «plato nuevo al vuelo» de dentro del modal de una cena, y un plato mal
escrito se quedaba mal escrito para siempre. Como la tabla `dishes` es **global,
sin `eventId`**, la errata viajaba a todos los viajes; eso lo dice ahora la
propia pantalla, y borrar avisa de en cuántas cenas está metido el plato.

**El área elegida se recuerda por sección** (`lib/areas.js`), en memoria y no en
`localStorage`: es dónde estabas hace un minuto, no una preferencia. Cada mando
era un `useState` de su pantalla y la pantalla se desmonta al cambiar de
pestaña, así que volver a Agenda te devolvía a «Hoy» aunque estuvieras en «Días».

**Quién eres es una sola cosa en toda la app.** Planes guardaba lo suyo en
`ballena.person.<evento>` con su propio desplegable «Eres:» y `lib/identidad.js`
—la de la cabecera y la de Ajustes → Quién eres— en `ballena.me:<evento>`. Dos
llaves distintas: identificarse en Ajustes no servía para votar, y la Compra
firmaba en blanco quién había comprado porque leía la llave que ya no escribe
nadie. El desplegable de Planes se retiró y las dos pantallas pasan por
`useIdentidad`.

Un detalle que solo se ve midiendo: la hoja dibujaba la fila de un día como
«Paella mixta en El del ruido», y puesto en la app son 268 pt en una fila que
tiene 237 con el lápiz — se recortaba en «El del…». La bunga bajó al titular de
«Hoy» y al modal, que es donde hay sitio; en la fila sale solo cuando no hay
plato que enseñar y el titular se quedaría en un «Cena» pelado.

### 14.10-quater Lo que se cayó fuera de las fechas no abre la lista

Un viaje que empieza el **15** y una cena del **14** saliendo como primera cosa de
Comidas. Dos fallos a la vez, y el segundo tapaba al primero:

1. **Las cenas no se ordenaban.** `dinnersOf()` devuelve lo que IndexedDB tenga a
   bien devolver, que no es ningún orden. Los planes sí se ordenaban por día
   desde el principio; las cenas, no.
2. **Nadie miraba el calendario.** Una cena cuyo día ya no pertenece al evento
   —porque las fechas se movieron después, o porque el dedo tecleó un 14 por un
   16— se pintaba igual que las de verdad. Y como además abría la lista, lo
   primero que se veía del viaje era un día que el viaje no tiene.

`porDia(filas, evento)` en `lib/evento.js` devuelve `{ dentro, fuera }`: ordenado
por día, y lo que cae fuera de `startDate`–`endDate` apartado. Lo usan **Comidas ·
Cenas** y **Planes**, que son las dos listas que viven en un día. Lo que no tiene
día va al final de lo de dentro: un plan sin fecha todavía no está en el
calendario, así que tampoco se ha caído de él.

**No se esconde, se aparta**, y ese es el punto. Esconderlo lo dejaría invisible
en Agenda y en Comidas mientras **sigue contando en Estadísticas y ocupando bunga
en el balance de anfitrión** — exactamente el huérfano contra el que avisa este
módulo cuando se acortan las fechas. Va al final, bajo «Fuera de las fechas del
viaje», con la pastilla `fuera del viaje` y un renglón que dice qué hacer: en
Planes se le puede cambiar el día ahí mismo, y en Cenas se borra o se corrigen las
fechas en Ajustes → Evento.

### 14.11 Tipografía: un número y toda la escala

El cuerpo pasa de 14 px a **17 px**, que es lo que iOS llama *body* y lo que de
verdad se está leyendo. Una lista de gastos a 12 px se lee bien sentado en el
sofá y no se lee en la puerta de un supermercado, que es donde se usa.

Las proporciones están decididas; lo que no lo estaba es cuánto mide el
conjunto. Así que hay **un solo número** —`--escala`— y de él cuelga la escala
entera (`--t-hero`, `--t-title`, `--t-body`, `--t-row`, `--t-sub`, `--t-label`,
`--t-micro`). Subirlo mueve los siete rangos a la vez y conserva las
proporciones, que es lo que no pasa cuando cada pantalla se retoca a mano. La
idea es de `meeting-ops-air`.

Ajustes → Aspecto lleva **Normal · Grande · Enorme** (`lib/tamano.js`, ×1, ×1,12
y ×1,26), guardado por dispositivo y aplicado en `main.jsx` antes del primer
pintado para que la app no parpadee de talla. **La de fábrica es Grande**: esto
lo lee gente de cuarenta y tantos, en la playa y con el sol de cara, y 19 px es
lo que se lee sin acercarse el móvil. Por eso el ×1,12 vive en `--escala` y las
otras dos tallas son desvíos de él — el valor de origen sigue estando en un solo
sitio. Va en un segmentado y no en un
desplegable: es lo único de esa pantalla cuyo efecto se ve en el sitio, y una
rueda de iOS encima taparía justo lo que hay que mirar para decidir. Va **antes**
que el tema, porque el que arregla un problema va antes que el que entretiene.

La escala se declara **una sola vez**, en `theme.css`: un tema cambia de qué
color es una cosa, nunca cuánto mide, así que una copia bajo otro selector solo
podría discrepar. Y `--toque: 44px` es el suelo de cualquier cosa tocable, que no
se baja: los botones pequeños bajan de cuerpo, no de altura.

### 14.14 El grupo: una ficha por familia, y la hoja que sube desde abajo

Familias, Bungalows y Gente eran **tres acordeones seguidos** de Ajustes, con
tres listas, tres botones y tres formularios. Lo que los une —qué familia duerme
en qué bunga, quién es de qué familia— no salía en ninguno de los tres: para
saber quiénes eran los García había que abrir Gente y leer la segunda línea de
seis filas. Y no se podía **editar nada**: se creaba y se borraba, así que un
nombre mal escrito se arreglaba borrando la familia, que se llevaba por delante
su vínculo con el bunga y dejaba a su gente sin ella.

Las opciones se dibujaron a 390 pt con la semilla de verdad y se midieron en un
navegador, en dos hojas que siguen en el repo:
[`docs/diseño/gente.html`](diseño/gente.html) (dónde vive: `G1`–`G5`; con qué se
asigna: `A1`–`A4`) y [`docs/diseño/gente-editar.html`](diseño/gente-editar.html)
(cómo se entra a editar: `E1`–`E4`; qué editor aparece: `F1`–`F4`; por dónde se
crea: `N1`–`N4`; dónde vive borrar: `D1`–`D4`).

**Lo elegido, y lo que cuesta:**

- **G2 · una ficha por familia** (`screens/GrupoSection.jsx`). Cabecera con el
  color y el emoji de la familia y su bunga en una pastilla; dentro, su gente.
  Es la única colocación donde la relación completa **se lee sin tocar nada**. Se
  paga en alto: con las tres familias de la semilla mide 868 pt contra los 643
  útiles de un iPhone base, así que hay que rodar.
- **«Sueltos»**, la otra mitad de G2: el bunga sin familia y quien no está en
  ninguna —y que por tanto no entra en ningún reparto— dejan de ser un dato que
  no está en ninguna parte y pasan a ser una fila que se ve.
- **A3 · hoja de elección** (`components/Hoja.jsx`). Filas de 48 pt con el alias
  entero. Lo que ya tiene dueño **se enseña apagado, no se esconde**: si el bunga
  que buscas no está, quieres saber que lo tienen los García.
- **E1 · se toca la fila y se edita.** La diana es la fila entera —358 × 74 la
  cabecera de una familia, 334 × 43 una persona—, no un lápiz de 34 repetido
  nueve veces por pantalla.
- **F2 · el editor es la misma hoja.** Sube desde abajo, deja ver por encima la
  ficha de la que sales y no se descoloca cuando aparece el teclado, que sube por
  ese mismo borde. Es un componente para dos usos, no dos.
- **N2 + N4 · cada cosa se crea donde vive.** La persona dentro de su ficha —y
  por eso su formulario ya **no pregunta la familia**: la dice el sitio donde has
  pulsado—, el bunga desde la pastilla de la cabecera, y solo la familia en el
  botón del final, que así sigue siendo **uno lleno por pantalla** (§14.12). La
  hoja de elegir bunga lleva su propia salida, «+ Bunga nuevo…»: quedarse sin
  ninguno libre es un botón y no un callejón.
- **D1 · borrar solo existe al fondo del editor, y dice qué se lleva.** Antes era
  un botón rojo en cada renglón y sin confirmación, justo donde cae el pulgar al
  rodar la lista. Ahora son tres toques y la confirmación dice la verdad: «Sus 3
  personas se quedan sin familia y Bunga 1 vuelve a quedar libre», que es
  exactamente lo que hace `borrarFamilia` en `db.js`. Para un bunga cuenta de
  cuántas cenas es sede; para una persona, en cuántos gastos participa.

**Todo va ordenado por nombre.** Los ids son aleatorios (`lib/ids.js`), así que
el orden de la base es el de un sorteo y una lista de nueve nombres sin orden se
recorre entera cada vez.

**Lo que la vuelta siguiente afinó, ya con la sección en la mano:**

- **Guardar y borrar van en la misma línea, separados.** Apilados y pegados, el
  rojo caía justo debajo del pulgar que acababa de dar a Guardar. El botón dice
  solo el verbo; qué se lleva por delante lo dice la confirmación, entera.
- **El emoji de una persona se elige de una galería**, además de escribirlo.
  Teclearlo en un móvil es abrir el teclado de emoji y buscarlo, que es la
  fricción por la que todo el mundo se quedaba con el 🧑 de fábrica.
- **La edad son dos botones y el peso sale de ella** (§5.1), sin desplegable y
  sin campo de peso.
- **El evento en curso se edita con la misma figura** —se toca la ficha, sube la
  hoja—, y al guardar **avisa de lo que se cae fuera de las fechas nuevas**: las
  cenas y los planes de un día que deja de existir se borran, y se dice cuántos
  son antes de tocar nada (`lib/evento.js`). Los gastos se cuentan y **no se
  tocan**: la compra grande es del día antes de salir, y borrar dinero por mover
  una fecha cambiaría los saldos de todos.
- **El orden de Ajustes es el de lo que se toca**, no el del cableado: Aspecto ·
  Evento · El grupo · Quién eres · Estadísticas · Sincronización · Tu cuenta ·
  La app. Primero el viaje, al final la fontanería.
- **Cada apartado recuerda si estaba abierto** (`localStorage`, por móvil).
  Forzar la última versión recarga la app, y la recarga devolvía todas las
  solapas plegadas: tocabas «actualizar» dentro de «La app» y volvías a una
  lista de solapas cerradas sin saber si había pasado algo. Ahora vuelve al
  mismo sitio y además se desplaza hasta él.

### 14.15 Quién entra: la sala de espera, las cuentas y los avisos

El alta era **por invitación con código copiado a mano**: quien quería entrar
veía un identificador de Apple en la pantalla de acceso, se lo pasaba por
WhatsApp a alguien del grupo, y ese alguien lo pegaba en Ajustes. Tres pasos y
dos personas para algo que el servidor ya sabía.

- **✅ Sala de espera.** Quien entra con Apple **queda apuntado solo**, con el
  nombre que Apple entrega, y recibe «ya estás en la lista» en vez de un error.
  La cuenta nace **inactiva y sin persona**: no es alguien con permisos a
  medias, es alguien de quien no sabemos quién es.
- **✅ Enlazar con una persona es lo que abre la puerta** (`personId` en
  `cuenta`, migración `0002`). Las dos cosas van juntas a propósito: en una app
  donde el reparto, las cenas y los planes cuelgan de una persona, entrar sin
  serlo no lleva a ninguna pantalla útil. Desenlazar devuelve a la sala de
  espera; eliminar borra la cuenta y sus dispositivos, y quien vuelva a entrar
  aparecerá otra vez pidiendo permiso.
- **✅ «Tu cuenta» pasa a ser «Cuentas»**, y lista a quien ha pedido entrar con
  el nombre que dio Apple, con quién es cada uno y qué familia. Todo eso, solo
  para quien administra.
- **✅ Un solo administrador, escrito a mano** (`lib/admin.js`): **Óscar García
  Chillón**. La cuenta que abre una instalación vacía nace administradora, así
  que sin esto el rol dependería de quién llegó primero. El nombre no da
  permisos —los da el `rol` que firma el Worker—: sirve para decir en pantalla
  de quién se está hablando.
- **✅ Avisos derivados, nunca filas** (`lib/avisos.js`, figura de `avisos.js` en
  `garciadoral-ops`). Hoy solo hay uno —alguien ha entrado y todavía no es
  nadie— y es del administrador. Al enlazar la cuenta, el aviso desaparece
  porque ya no hay nada que hacer: no hay que marcar nada como leído ni ir a
  borrar una fila que miente. **Y sí hay push** (§14.17): lo que se
  empuja es exactamente esta lista, que es el motivo de que se escribiera
  aparte antes de que hubiera por dónde empujarla.
- **✅ Buscar la última versión desde la pantalla de acceso.** Estaba solo dentro
  de Ajustes, o sea detrás de la puerta: si lo que falla es justo la pantalla de
  acceso —y es la que más cambia—, había que entrar para poder arreglarlo
  entrando.

### 14.17 Avisos al móvil: APNs directo, sin SDK de nadie

OneSignal y `@capacitor/push-notifications` estuvieron aquí y **se retiraron**
antes del primer envío a la App Store: los dos inertes —sin `APP_ID` no se
inicializaba nada y no había servidor que enviara— y el primero, un SDK de
terceros de los que Apple obliga a declarar con manifiesto de privacidad
firmado. Volver así habría sido volver al mismo sitio.

- **✅ Vuelve el plugin oficial y solo el plugin oficial.**
  `@capacitor/push-notifications` no habla con ningún tercero: habla con iOS. Las
  etiquetas de privacidad de la ficha siguen pudiendo decir «sin analítica, sin
  rastreo y sin SDK de nadie».
- **✅ Quien empuja es nuestro Worker** (`api/src/apns.js`, portado de
  `garciadoral-ops`): APNs es una petición HTTP/2 con una cabecera de más y un
  JWT ES256, y las dos cosas las sabe hacer el Worker con `fetch` y
  `crypto.subtle`. Sin dependencias.
- **✅ El JWT de proveedor se guarda 45 minutos**, no se firma en cada aviso:
  Apple lo limita a uno cada veinte minutos y quien firma por petición acaba en
  `TooManyProviderTokenUpdates`.
- **✅ Un token muerto se borra, no se reintenta.** Ante un `410` o un
  `BadDeviceToken` se olvida el token y el teléfono se da de alta solo la
  próxima vez que abra.
- **✅ El permiso se pide en Ajustes → Notificaciones, no al arrancar.** Al lado
  está escrito qué se avisa. Un permiso que se pide en el primer segundo se
  contesta que no, y solo se pide una vez en la vida.
- **✅ El token vive en `dispositivo`** (migración `0004`), no en `cuenta`: una
  persona tiene teléfono y iPad y quiere el aviso en los dos, y el token es de la
  instalación. `avisos` es el permiso tal como está en ese aparato.
- **✅ Hoy se avisa de una sola cosa**: alguien ha entrado con Apple y todavía no
  es nadie del grupo, y llega **solo a quien administra**, que es quien puede
  arreglarlo. El aviso no puede tumbar el alta que lo provocó: se manda sin
  esperar y sin lanzar.
- **✅ Un botón que se manda un aviso a sí mismo** (`POST /api/push/prueba`, en
  Ajustes → Notificaciones). La cadena tiene **seis eslabones** —permiso en el
  móvil, token de APNs, token guardado en la base, claves del Worker, entorno
  correcto y Apple—, y sin esto la única manera de probarla era que **otra
  persona** entrara con Apple. Devuelve **lo que dijo Apple, motivo incluido**:
  con `BadDeviceToken` o «el Worker no tiene las claves» delante se sabe cuál de
  los seis falta, que es la regla de §14.9-bis aplicada aquí.
- **✅ El identificador se vuelve a apuntar en cada arranque**
  (`lib/push.js` · `asegurarPush`, llamado desde `App.jsx` en cuanto hay sesión).
  El permiso de iOS y el token de APNs **no son la misma cosa**, y en pantalla lo
  parecían: «Avisos encendidos» arriba y «este móvil todavía no ha apuntado su
  identificador» debajo. Era un callejón sin salida —`registerPush()` solo se
  llamaba desde el botón «Encender», y ese botón **se esconde justo cuando el
  permiso ya está dado**—, así que con el permiso puesto y el token sin guardar no
  quedaba ningún gesto capaz de arreglarlo. Además el token **caduca y cambia**:
  reinstalar, restaurar una copia o actualizar iOS lo renueva, que es lo mismo que
  dice el punto del `410` visto desde el otro lado. Pedirlo en cada arranque es
  barato —se reescribe la misma fila— y silencioso: con el permiso concedido no
  aparece ninguna hoja. El botón de prueba lo hace también antes de mandar, para
  que arregle en vez de mandar a pulsar un botón que no está.
- **✅ El registro no pierde el evento, y su error se cuenta con palabras.**
  «Permiso dado, pero Apple no devuelve identificador» es verdad y no sirve de
  nada. Detrás había dos cosas. Una, que los dos escuchas se ponían **sin esperar
  el asa**: `addListener` cruza el puente y es asíncrono, así que iOS podía
  contestar antes de que su escucha existiera y el token se perdía. Dos, que
  `registrationError` se tiraba a la basura para devolver `null`, cuando lo que
  trae es el diagnóstico entero —«no valid `aps-environment` entitlement string
  found in application's signature» **es** la respuesta a por qué no llega ningún
  aviso—. Ahora se esperan las asas, se sueltan al acabar (esto corre en cada
  arranque: acumularlas es una fuga) y lo que falla **sube con su mensaje** hasta
  la pantalla. Sin identificador **ni** error en ocho segundos queda `sin-token`,
  que es el móvil sin red y no otra cosa.
- **✅ El puente entre APNs y el plugin vive en `AppDelegate.swift`**, y se repone
  solo (`scripts/appdelegate.mjs`, desde `patch-ios.mjs`). `register()` no habla
  con Apple: llama a `registerForRemoteNotifications()`, y **la respuesta la
  recibe el AppDelegate**. El plugin se entera solo si la reenvía por
  `NotificationCenter` con `capacitorDidRegisterForRemoteNotifications` y su
  gemela de error. Sin esos dos métodos no falla nada visible: el permiso se
  concede, la llamada devuelve bien y **no llega ni token ni error, nunca** —en
  pantalla, «Apple no contesta ni con identificador ni con error», que se confunde
  con un problema de red y no lo es—. `ios/` no se versiona, así que esto se
  comprueba en cada `sync:ios` igual que `aps-environment`.
- **⚠ No viaja por OTA.** Un plugin nativo exige `npm run sync:ios`, archivar y
  **un binario nuevo con su revisión**. El entitlement `aps-environment` lo
  repone `patch-ios.mjs` en cada pasada, porque `cap sync` regenera el proyecto.

### 14.18 El día es el de aquí, no el de Greenwich

`toISOString().slice(0, 10)` sobre una fecha construida en local **resta las dos
horas de verano** en España: la medianoche del 8 de agosto es el día 7 a las
22:00Z. Con eso, el calendario de un viaje que empieza el 8 salía empezando el
**7**, y la cena del primer día aparecía en la casilla del día anterior. `hoyISO`
tenía el mismo defecto entre las 00:00 y las 02:00, y `diaSiguiente` devolvía el
mismo día que le entraba.

- **✅ `isoLocal(fecha)`** (`lib/dias.js`) compone el día con `getFullYear`,
  `getMonth` y `getDate`, que es lo que ve quien mira el móvil. Lo usan `hoyISO`,
  `diasDe` y `diaSiguiente`.
- **✅ Las pruebas corren en `Europe/Madrid`** (`vite.config.js`), no en la zona
  del contenedor. En UTC pasaban las 274 y el error seguía ahí: una suite que
  corre en una zona horaria que no usa nadie del grupo no está probando el
  calendario del grupo.

### 14.19 La versión, abajo y tocable

La pregunta «¿tengo lo nuevo o es que no funciona?» se hace mirando la pantalla
donde tendría que verse el cambio, no dentro de la quinta solapa de Ajustes. Así
que la versión baja a **Hoy**, en un pie a la derecha (`components/PieDeVersion.jsx`,
figura de `garciadoral-ops`), y **se toca para buscar una nueva**: la respuesta a
esa pregunta casi siempre es «actualiza», y un número que no se puede accionar
obliga a irse a buscar el botón a otro sitio.

Dentro de la app enseña la versión del **paquete OTA aplicado** —que es la que se
está ejecutando— y no la que se horneó en el binario. Y en Ajustes, «La app» pasa
a llamarse **Actualizar** y se queda en dos cosas: qué versión hay y el botón. Lo
demás se leía una vez y estorbaba las demás.

### 14.17-bis «Forzar la última versión» tiene que traer la última versión

En la app de iOS hay **dos caminos** para una versión nueva y el botón solo
recorría uno:

| Camino | Qué trae | Cuándo corría |
| --- | --- | --- |
| Paquete **OTA** (`checkForOtaUpdate`) | El JS nuevo, del release de GitHub | **Solo al arrancar** la app |
| *Service worker* (`forzarActualizacion`) | Cachés de la web | Al tocar el botón |

Así que en el móvil se podía tocar «🔄 Forzar la última versión» las veces que
hiciera falta y seguir en la de antes: lo que faltaba estaba en el otro camino, y
el paquete descargado además esperaba al **siguiente** arranque para aplicarse.
Un botón que promete una cosa y hace otra es peor que no tenerlo.

Ahora, en la app nativa, el botón mira **primero** el OTA y lo aplica en el acto
(`CapacitorUpdater.reload()`), y solo si no había nada nuevo sigue con las
cachés. En el navegador no cambia nada: ahí el OTA no existe.

**Y el plugin que falta no se detecta preguntando: se detecta porque la llamada
no vuelve.** El JavaScript de `@capacitor/push-notifications` viaja **dentro del
paquete OTA**, así que importarlo funciona aunque el binario no lleve su parte
nativa. Y `Capacitor.isPluginAvailable` tampoco sirve: devuelve `true` con que
el JavaScript se haya registrado, que es lo que acaba de ocurrir al importarlo.

**Y el plugin se coge del puente, no se importa.** El `await import()` del
paquete se quedaba colgado dentro de la cáscara —en la consola de Xcode llegaba
el `Haptics` del toque y ninguna llamada más—, y era el único punto del camino
sin plazo. `Capacitor.Plugins` ya tiene el objeto: lo registra la parte nativa al
arrancar, es el mismo que devolvería el paquete y consultarlo no le pide un
fichero a nadie. El `import()` queda de reserva para la web, y con plazo.

Lo único que distingue de verdad si el plugin está es que **la promesa no se
resuelve ni se rechaza**. Así que **todas** las llamadas al puente llevan plazo —seis segundos
las que contesta el sistema, quince la que abre la hoja de permiso, que la
contesta una persona pero aparece en el acto o no aparece— y al agotarse se dice
lo que pasa: hace falta un binario nuevo. Un botón que puede quedarse en
«Pidiendo…» para siempre es peor que uno que se rinde y lo cuenta.

### 14.16 La IA: la clave vive en el servidor

Ajustes tiene un apartado **IA** que solo ve quien administra, con la clave de
Anthropic y el modelo. La clave **entra pero no sale**: se guarda en la tabla
`configuracion` (migración `0003`) y de vuelta solo salen sus cuatro últimos
caracteres y la fecha en que se puso, lo justo para reconocer cuál está sin
poder copiarla de la pantalla de nadie.

Es el modelo de `garciadoral-ops` (`api/src/redaccion.js`) y la razón es la
misma: es una credencial de pago y no debe viajar a ningún dispositivo, y la
llamada al modelo sale del Worker —donde el texto se compone con lo que ya está
en la base— y no del teléfono, así que el cliente no puede inyectarle nada.

### 14.16-bis El modelo se elige de una lista, y la clave se prueba

El modelo se escribía **a mano en una caja de texto**. Una errata —o un nombre
que Anthropic ha retirado— no se veía al guardar: se veía meses después, cuando
alguien pulsaba «¿Qué podríamos hacer?» y no pasaba nada. Y no había forma de
saber si la clave valía sin provocar esa misma llamada.

Dos servicios nuevos, los dos en el Worker y los dos solo para quien administra
(`api/src/ia.js`):

- **`GET /api/ia/modelos`** pregunta a Anthropic qué modelos admite la clave
  guardada y devuelve `{ id, nombre }`. La pregunta la hace el servidor **por el
  mismo motivo por el que sale de ahí la llamada al modelo**: preguntarlo desde
  el teléfono exigiría mandarle la clave. En Ajustes el campo pasa a ser un
  desplegable; si la lista no llega se queda la caja de texto y se dice por qué,
  que es mejor que un desplegable vacío.
- **`POST /api/ia/probar`** hace **la llamada de verdad** con `max_tokens: 1` y
  contesta si funcionó y cuánto tardó. Se prueba **el par entero**, clave y
  modelo: una clave buena con un modelo retirado falla igual, y eso es la mitad
  de lo que se puede tener mal. Un token cuesta lo que cuesta un token.

Cuando falla se dice con las palabras de Anthropic y su estado HTTP —«No funciona
— la API respondió 401: invalid x-api-key»—, con el mismo criterio de §14.9-bis:
«error» a secas no sirve para arreglar nada.

**Y si el modelo apuntado ya no existe, se cambia solo por el más cercano**
(`masCercano`, `conModeloVigente`). Un modelo retirado no rompe nada el día que
lo retiran: rompe el día que alguien pide sugerencias, meses después, y para
entonces nadie relaciona las dos cosas con «lo escribí mal». El más cercano es
**el más nuevo de su misma familia** —quien puso un Sonnet quería un Sonnet, y
darle un Opus le multiplica la factura sin habérselo pedido—; sin familia
reconocible, el primero de la lista, que es el último que salió.

Se sustituye en dos sitios y por dos motivos distintos:

- Al **traer la lista**, porque ahí es donde se puede comparar. Se guarda en el
  acto: enseñarlo sin guardarlo dejaría lo que se ve y lo que hay diciendo cosas
  distintas hasta que alguien pulsara Guardar.
- Al **usarlo** —probar o sugerir—, reintentando **solo con un 404**, que es lo
  que contesta Anthropic a un modelo que no reconoce. Una clave mala (401) o una
  cuota agotada (429) no se arreglan cambiando de modelo, y reintentar ahí sería
  gastar dos llamadas para dar el mismo error. Esto es lo que hace que las
  sugerencias se curen solas sin que nadie abra Ajustes.

El cambio **se dice siempre**, en Ajustes y al probar («claude-3-5-sonnet ya no
existe. Se ha puesto claude-sonnet-4-5, el más cercano»): sustituir en silencio
dejaría a alguien usando un modelo que no eligió.

### 14.16-ter La forma de los dos apartados: campo, pista y traza

La figura es la de `garciadoral-ops` (`campo()` en su `app.js`), y lo que la hace
más fina que lo que había aquí no es que tenga menos cosas: es **dónde vive cada
cosa**.

- **El estado vive en el campo, no en una ficha aparte.** «Qué clave hay puesta»
  era una tarjeta con icono, título y renglón encima del formulario: tres
  renglones y un dibujo para decir «····ab12». Ahora es el hueco del propio
  campo —«Guardada, termina en ab12»— y la línea de debajo dice qué pasa si lo
  dejas en blanco. Se lee donde se va a escribir, que es donde se mira.
- **La pista va debajo del control y no encima.** Arriba se lee antes de saber
  qué se está mirando; debajo se lee justo cuando se duda.
- **Lo que contesta el servidor va en una traza** (`<pre class="traza">`,
  `bien`/`mal`) y no en un aviso de prosa. Un fallo de Anthropic trae modelo,
  estado HTTP y mensaje: los saltos de línea son la mitad de la información, y
  monoespaciada porque lo que va dentro son identificadores, no frases.

**Y en «Actualizar», el progreso se pinta en su sitio** —dos renglones, un botón
discreto y la lista debajo—, con el mismo criterio con el que ya se hizo en
Sincronización (§14.9-bis). Era lo único que quedaba con **modal**: tapaba justo
lo que se venía a mirar, pedía un «Ok» para seguir y se llevaba por delante lo
que había contado en cuanto se cerraba. Contado en su sitio se queda y se puede
releer. Los rótulos de los pasos pasan a **infinitivo y sin emoji**: la lista ya
no desaparece, y un «Descargando…» con su ✓ al lado se lee mal —quien dice en qué
estado va es la marca, no el texto— y los emoji del cromo se retiraron en §14.13.

Dos defectos que salieron **al mirarlo en el navegador**, no en los tests:
`input[type=password]` estaba fuera de la lista de controles con estilo, así que
la única caja de contraseña de la app salía con el borde cuadrado del navegador y
más estrecha que la de al lado; y los tres rótulos con emoji eran los últimos que
quedaban del cromo.

### 14.16-quater Lo que se le pide al modelo se escribe en Ajustes

La clave y el modelo valen para **todo** lo que la app haga con un modelo; el
**encargo** es de cada cosa. Por eso van debajo y con su rótulo, uno por
función, como en `garciadoral-ops` —allí son seis; aquí, de momento, uno: las
ideas de plan (`api/src/encargos.js`)—.

El motivo de que sean editables no es la curiosidad. Un encargo es donde se sube
o se baja el tono, donde se le prohíbe lo que se suelta a decir y donde se ajusta
lo que no encaja con este grupo, y **todo eso se descubre usándolo**, no
escribiéndolo. Si vive en el código, cada retoque es una versión nueva de la app
y un OTA; en Ajustes es escribir en una caja y guardar.

Tres reglas:

- **La forma de la respuesta es parte del encargo.** El de ideas pide un JSON con
  cinco propuestas y la app lo lee así (`leerPropuestas`): reescribirlo perdiendo
  esa parte hace que no salga nada. La pista lo dice en la pantalla, no solo en
  el código.
- **Vacío no es un encargo vacío: devuelve el de origen.** Es la manera de
  deshacer, y tiene que estar a mano — quien la ha liado reescribiéndolo no
  debería tener que pedirle a nadie el texto de antes. Se guarda `''` y al leer
  vuelve el del catálogo.
- **Solo se guardan los encargos del catálogo** (`esEncargoConocido`). Esto no es
  ceremonia: `guardarConfiguracionIA` escribe la clave que le den, así que sin el
  filtro un móvil podría machacar `ia.clave` —la credencial de pago— mandando un
  encargo que se llame así.

Y un defecto que salió **al mirarlo en el navegador**: `textarea` estaba fuera de
`button, input, select { font: inherit; color: inherit; }`, y un `textarea` no lo
hereda solo. En la cara oscura eso era **texto negro sobre fondo oscuro** en las
siete cajas de varias líneas que tiene la app —el encargo, la descripción de un
plan y de una idea, y las dos de cada cena—, y monoespaciadas además. Llevaba así
desde que existen. `estilos.test.js` monta guardia.

### 14.20 Recetas con cantidades, y la compra que sale de ellas

Decidido en [`docs/diseño/cenas-cantidades.html`](diseño/cenas-cantidades.html) ·
**G2 · A1+A5 · C1 · D5 · E2 · F1**, con el detalle de A4.

**El problema.** Un plato guardaba **nombres sueltos** —«arroz, mejillones,
pollo»— escritos en una caja que se partía por comas, y la lista de la compra
era texto libre que nadie relacionaba con las cenas. Poner una cantidad al lado
parece un campo más, pero arrastra cuatro decisiones seguidas: **para cuántos**
es, **cómo se reparte** entre las dos mesas, **qué se redondea** al comprarlo y
**qué pasa cuando algo cambia** después.

**Para cuántos es** (`dishes.raciones`, una vez por plato). «2 kg» no se reparte
ni se escala: falta el denominador. Va una vez por plato y no por ingrediente —el
arroz para 12 y el pan para 20 es el lío que hace que nadie rellene nada—, y
estirarlo es una **regla de tres**, sin IA de por medio: una multiplicación que
unas veces diera 3 kg y otras 2,8 no valdría para comprar.

**Las dos mesas ya se sabían.** `comeConMayores` decide el lado y `pesoReparto`
—1 el adulto, 0,6 el niño— decide cuánto cuenta. Son los mismos números del
reparto de un gasto; no hay un segundo censo. Y **la mesa de niños puede comer
otra cosa** (G2): `dinners.platoIdsNinos` en `null` quiere decir «lo mismo», que
es la noche normal y la que no hay que escribir dos veces.

**La línea del ingrediente** (A1): la cantidad **en columna a la izquierda**,
como en una receta impresa, porque las cifras alineadas se comparan sin leerlas.
92 pt de columna y 234 para el nombre, medidos. Debajo crece el detalle de A4
—cuánto sale por ración, en qué envase se compra, si lo puso la IA— y solo
cuando hay algo que decir. Se borra deslizando (A5), como en Gastos.

**La compra enseña el total** (C1) y el desglose al abrir la línea: se compra una
vez, nadie va a dos supermercados, y el reparto sirve en la cocina. Se redondea
**al alza al envase** —1,62 kg no se compran; dos paquetes de uno, sí— y el
envase lo propone la IA (D5), porque nadie va a rellenar eso a mano en cuarenta
ingredientes. Dos cosas que salieron al mirarlo en el navegador: **un lote que
mide otra cosa que la receta no se usa** —«30 ud» de mejillones con una malla de
«1 kg» daba «15 mallas», que tiene pinta de cuenta y no lo es— y **el texto va en
la unidad de la receta** —«2 kg»—, porque «2 paquetes de 1 kg» empujaba el nombre
hasta «Arr…».

**Cuando cambia una cena** (E2), las líneas que vienen de recetas se rehacen
solas y **lo dicen**: «eran 2 kg · cambió una cena», y el renglón desaparece al
marcar la línea. Tres cosas no se tocan nunca: **lo escrito a mano** —«hielos» no
es de ninguna receta—, **lo ya comprado** —está en el carro, y es lo único que no
se puede deshacer— y, por lo mismo, tampoco se borra lo comprado que ya no sale
en ninguna cena.

**La IA se pide desde la receta** (F1), con un botón que rellena las que faltan
de una vez: ahí está el plato entero delante, que es lo que le permite decir «30
mejillones» en vez de «los que quieras», y de una vez porque lo caro es contarle
el contexto (§14.19-bis). Como allí, **los nombres no viajan**: le llega el
plato, para cuántos es y qué ingredientes le faltan. La marca «lo puso la IA» se
queda hasta que alguien toque el número.

**Lo que había guardado sigue valiendo.** Un `ingredientes: ['arroz']` se lee
como una línea sin cantidad, que es lo que es. No hay migración de datos que
correr; en la API sí hay columnas nuevas (`migraciones/0009_*.sql`).

### 14.20-bis El editor de una receta: dos campos, y dos botones

Decidido en [`docs/diseño/receta-ingredientes.html`](diseño/receta-ingredientes.html) ·
**U1 · B3 · R1 · L2+L4 · P2 · Q2+Q3+Q4**.

**El orden y el foco.** Queda **Nombre · Ingredientes · Raciones · Tipo**, y al
abrir un plato que ya existe el cursor entra en la primera línea de
ingredientes. Editar un plato es casi siempre tocarle la lista; el tipo se pone
una vez en la vida del plato y las raciones se afinan **mirando la lista**, no
antes de escribirla.

**Dos campos y no tres** (U1). La unidad vive dentro del de la cantidad: se
escribe «1,2 kg» de un tirón, que es como se dice en voz alta, y `partirCantidad`
lo separa. La compra necesita número y unidad aparte —sin eso no puede sumar dos
recetas ni redondear al envase—, pero eso es cosa suya y no de quien escribe. Lo
que no se entiende **no se inventa**: «al gusto» se queda sin cantidad.

**Un aspa de 26 pt sin caja** (B3). Deslizar no se veía, y borrar es la mitad de
lo que se hace escribiendo una receta. Medido: el aspa cuesta **34 pt** de ancho
al nombre —una caja de 34 costaba 42 y una de 44, 52—. La fila fantasma del final
reserva el hueco y no la pinta.

**Siempre hay una fila vacía al final** (L2) y **pegar varias líneas las
reparte** (L4): una receta de internet entra entera y cada línea se queda
**completa en el nombre**, porque partirla ahí sería adivinar.

**«Arreglar»** (R1) manda las líneas tal como están y devuelve cantidad, unidad y
nombre limpio: «tres pinchos de wagyu» → `3 ud` + «Pinchos de wagyu». Se aplica
directo —un toque es mejor que dos— y **se puede deshacer** mientras no se
guarde, que es lo único que hace falta para poder pulsarlo sin miedo. Lo tocado
queda marcado hasta que alguien cambie el número.

**«Parecidos»** (P2) propone cinco platos a partir del título y los ingredientes,
con la figura del regalo de `garciadoral-ops`: **tanda de cinco** —lo caro es
contarle el contexto— y se va **adelante y atrás** entre ellas. Llegan **enteras**
(Q2+Q3): nombre, por qué, tipo e ingredientes con cantidades. Coger una **no
guarda nada** (Q4): reabre el editor con todo puesto y sin `id`, para corregirlo
antes de que exista.

Dos defectos que salieron **al mirarlo en el navegador**: `input[type=text]` tiene
más especificidad que `.ing-cant`, así que su `width: 100%` ganaba y la caja de la
cantidad se comía la fila dejando el nombre fuera de la pantalla; y el carrusel se
pintaba al final del modal, donde no lo ve quien acaba de pulsar el botón. Y uno
que salió en los tests: `normalizarIngredientes` recortaba el nombre en cada
pintado, así que el espacio recién tecleado desaparecía y «Arroz bomba» se escribía
«Arrozbomba» — ahora el recorte es solo al guardar.

### 14.18 Un plan es dos cosas: la idea que se repite y la propuesta de este año

Decidido en [`docs/diseño/planes-catalogo.html`](diseño/planes-catalogo.html) ·
**A3 · B3 · C1**.

**El problema.** El encargo era que los planes se reutilizaran entre viajes
«como los platos». Pero un plato es un nombre y unas categorías —compartirlo es
compartir la fila, y por eso `dishes` pudo ser un catálogo plano desde el primer
día—. Un plan lleva además **día, estado y votos**, y esos tres son de *ese*
viaje. De los nueve campos de `addPlan()`, cuatro son de la idea, tres del viaje,
uno es el vínculo y uno está a caballo (`costeEstimado`: la entrada a las cuevas
es la misma cada año, pero el precio sube).

**Tres cosas que no viajan nunca**, y no son decisiones de diseño sino
consecuencias:

- **Los votos.** `votos` es `{ personId: '👍' }` y las personas cuelgan de un
  evento. Un plan traído de 2025 llegaría con votos de identificadores que en
  2026 no existen: recuento 0 · 0 · 0 con tres emoji dentro, invisibles.
- **El estado.** `confirmado` fue una decisión de aquel agosto. Una idea que
  llega confirmada se cuela en la agenda sin que nadie la haya votado.
- **El día.** El de entonces no es un día de este viaje, y ya sabemos qué le pasa
  a lo que cae fuera de las fechas (§14.10-quater).

**La forma: `planIdeas` ↔ `plans`**, que es la misma que `dishes` ↔ `dinners` y
no un invento nuevo. `planIdeas` guarda lo que se repite —título, descripción,
ubicación, enlace, coste orientativo—; `plans` sigue guardando la propuesta y
añade `ideaId`. El catálogo es **compartido entre eventos** y admite el mismo
`eventId` opcional que los platos, que es como el Demo tiene los suyos sin
ensuciar los de verdad (§14.9-quater).

**Se copia, no se enlaza** (C1). Traer una idea copia sus campos y a partir de
ahí son dos cosas independientes. `ideaId` solo sirve para poder decir «3
viajes» en el catálogo; no se lee para pintar nada. El coste es que corregir el
enlace en el catálogo no arregla los viajes ya planeados; lo paga porque **un
viaje pasado no cambia solo**, que es lo que uno espera de algo que ya ocurrió, y
las estadísticas de 2025 siguen diciendo lo que decían.

**Dos puertas** (B3), porque son dos preguntas distintas:

- **Planes · Ideas**, área nueva. Cuesta **66 pt** de cuerpo —Planes tenía 699,6
  y se queda en los 633,6 que ya tienen Agenda y Comidas, era la única sección
  sin mando— y los paga porque un catálogo invisible no es un catálogo:
  «¿qué hacíamos los otros años?» se pregunta en enero, no al crear.
- **El atajo del modal**: «¿De las de siempre?» arriba de «+ Plan», para cuando
  ya sabes qué quieres y solo no quieres volver a teclearlo.

**Y el camino inverso**, que es lo que llena el catálogo: un plan que ha salido
bien se guarda con «guardar idea» desde su propia fila, y entonces la fila lo
dice («en ideas»). Sin eso el catálogo empieza vacío y se queda vacío.

En la API son una tabla y una columna (`migraciones/0006_ideas_de_plan.sql`,
`npm run migrar:remoto6` si la base ya existía).


### 14.19 Planes: aquí solo se vota

Decidido en [`docs/diseño/planes-votar.html`](diseño/planes-votar.html) ·
**V3 + V5 · S2**.

**El defecto, medido.** La pantalla hacía tres trabajos a la vez —votar, poner
fecha y administrar— y se le notaba: cada plan era una tarjeta de **299,9 pt** en
un cuerpo de 633,6 (cabían **2,1**), con **siete botones**, un selector de fecha
nativo que traía su propio dibujo y su propia alineación, y **ocho colores**
contando el verde de la pastilla, el rojo de «borrar», el azul del enlace y los
tres emoji de voto.

**El reparto.** Aquí solo se vota. **El día se pone en Agenda**, tocando el día
del viaje, que es donde está el calendario y donde ya se podía. Lo de administrar
—devolver un plan al catálogo— vive dentro del plan abierto y solo lo ve quien
administra. Cada plan queda en una fila de **70,7 pt**: caben ocho, y los colores
bajan a tres.

**Y un plan no se crea en esta pantalla: sale de proponer una idea.** Había un
«+ Plan» con su propio formulario, así que un plan podía nacer por dos caminos —
desde el catálogo, enlazado a su idea, o suelto, sin idea detrás—. El segundo se
lleva por delante media razón de ser del catálogo, porque lo que se apunta a mano
este agosto no está el que viene, y duplicaba un formulario que ya existe en
Ideas. Queda un solo camino, y la pantalla **lo dice**: el vacío manda a Ideas, y
con la lista llena hay un renglón al final —donde aparece la pregunta, después de
recorrerla y no encontrar lo que buscabas— que explica que un plan sale de
proponer una idea.

**Dos grupos y un orden que significa algo.** Primero los **elegidos**, los que
ya tienen día; después los **disponibles**, ordenados por votos. El orden de
creación no decía nada. Lo que se cayó fuera de las fechas sigue apartado al
final (§14.10-quater): un plan en un día que el viaje ya no tiene no es un plan
elegido.

**La fila dice quién falta por votar** (V5), que es lo accionable —a esos hay que
darles un toque— y cabe en el subtítulo que ya existe. Con uno o dos se dan los
nombres, porque ahí un nombre sirve para algo; con más, el número: «faltan 5 por
votar». Cinco nombres seguidos no caben y no dicen nada que el número no diga.

**El plan abierto enseña los nombres agrupados bajo su voto.** Una línea por
voto, y cada votante es **su avatar, su nombre y el alias de su familia** en
pastilla de su color (`components/Alias.jsx`, la misma que firma una idea).
Empezó siendo **solo los avatares** (V3), y el defecto se ve en cuanto hay gente:
seis emoji en gris a 17,9 pt son seis manchas que hay que aprenderse, y quien no
ha elegido el suyo sale con la carita de fábrica, así que dos personas se pintan
igual. Un nombre no se aprende — y al lado del nombre el dibujo sí sirve, porque
es lo que se reconoce de un vistazo. El alias añade lo que no dice ninguno de los
otros dos: **de qué familia viene el voto**, que es lo que se mira para saber si
una casa entera está a favor. Los tres van pegados y sin partirse entre líneas:
partidos, el alias de uno queda junto al nombre del siguiente y el voto cambia de
dueño de un vistazo.

**Y ahí dentro no se listan los que faltan por votar.** Esa pregunta la contesta
la **fila cerrada**, en su subtítulo —«falta por votar Luis»—, que es donde
sirve: es donde se decide a quién dar un toque, sin abrir nada. Repetirlo dentro
gastaba 34 pt en decir lo mismo dos pantallas seguidas.

**En Ideas**, siete cambios del mismo encargo: se **edita tocando la fila** (el
lápiz competía por el pulgar con el verbo y gastaba 44 pt de 390); «traer» pasa a
**«Proponer»**, que es lo que hace; cada idea dice **quién la apuntó**
(`creadaPor`, una persona del grupo y no una cuenta); se van el **coste** —no se
usó nunca— y el **dónde** —cabía en la descripción, que crece a cuatro
renglones—; **una idea no se propone dos veces** —quedaban dos filas idénticas
repartiéndose los votos, y no ganaba ninguna—; y el editor es un **modal fino**,
que son dos campos. Lo de la lista de ideas —los dos grupos, la firma y el
renglón de apuntar— se rehízo después: §14.19-ter.

### 14.19-bis Las sugerencias de la IA: el material lo compone el Worker

`POST /api/plan/sugerir` (`api/src/sugerencias.js`), con la figura del regalo de
`garciadoral-ops`: **una tanda de cinco de una vez**, porque lo caro de la
llamada no es el texto sino contarle al modelo el contexto —una vez contado,
pasar de una propuesta a otra no vuelve a pedir nada—. Cada propuesta trae **qué**
y **por qué**, y se guarda como idea con un toque.

Dos decisiones que conviene que queden escritas:

- **El material se compone en el Worker, no en el móvil.** Del cliente llega el
  id del evento y lo ya visto en esta tanda, y nada más. Dónde es, cuándo, cuánta
  gente y qué hay ya apuntado sale de la base en el propio Worker, así que desde
  un teléfono no se le puede inyectar texto al modelo.
- **No viajan los nombres.** Al modelo le llega «6 personas, 4 adultas, 2 niños»,
  no quiénes son. Para proponer una excursión el nombre no aporta, y es lo único
  de aquí que identifica a alguien. Hay un test que lo fija.

**Sin clave, el botón no existe.** Si esta instalación no habla con la API el
botón no se pinta, y si la clave no está puesta el Worker contesta 409. Ofrecer
algo que va a fallar al pulsarlo es peor que no ofrecerlo.

### 14.21 El día del viaje: qué bungas, qué se cena y qué plan

Decidido en `docs/diseño/agenda-dia.html` (**A1 · B4 · F1 · G1 · C2 · D2 · E1**),
una hoja con seis partes y dieciocho opciones. El modal de un día pedía cuatro
cosas a la vez —dos bungas, seis chips de platos, una tarjeta para inventarse un
plato al vuelo, dos textos largos y una alfombra de nueve chips de planes— y
medía **1.773,8 pt**, con el rótulo de los planes a 994,8 del principio: 218,8 por
debajo de lo que se ve al abrir. Ahora son cuatro renglones y **679,8 pt**, un
62 % menos, y todo cabe en los 776 que deja la pantalla.

- **A1 · La fila de un día abre y no lo anuncia.** Fuera el lápiz de 44 × 44: un
  día **no se edita** —no es una fila de la base, existe porque el evento tiene
  esas fechas—, así que prometía algo que no pasa, y sus 52 pt eran justo los que
  le faltaban al titular (237 → 289 pt, y «Cine de verano en la plaza» deja de
  recortarse). La fecha larga la dice ahora el `aria-label` del botón, no un
  `span` escondido: una sola manera de decir lo mismo.
- **B4 · «Qué se hace» y «Cantidades», fuera de todo.** De los dos formularios
  —el modal del día y el de Comidas → Cenas— y de la ficha de una cena, más la
  semilla del Demo y este spec. **Las columnas se quedan** en D1 y en
  `tablas.js`: quitarlas no gana nada y rompería a un móvil que todavía mande el
  campo. Lo escrito se queda dormido, que es lo barato y lo reversible. Y las
  cantidades de verdad ya no viven ahí desde §14.20: son la receta del plato, con
  sus raciones y su regla de tres, y de ahí sale la compra. Un texto libre al lado
  diciendo «2 kg arroz» sin contar para nada es justo lo que confunde.
- **F1 · La cena es un renglón que abre su hoja.** «Qué se cena» dice lo que hay
  —«Paella mixta y cinco cosas más», la frase que ya escribía `titularDeCena()`—
  y al tocarlo sube la hoja con el catálogo, marcando los que entran
  (`HojaDeMarcar`, hermana de la que elige bunga). Por debajo no cambia nada: una
  cena sigue siendo sus `platoIds` y sus dos bungas.
- **G1 · «Plato nuevo al vuelo» vuelve a Comidas → Platos.** Eran 300,8 pt en
  medio del camino entre la cena y los planes, en una pantalla que ya existe
  desde §14.10-ter. De paso desaparece de raíz un fallo: llamaba a
  `addDish({…}, event)` con un `event` que **no existía en ese ámbito** —en el
  navegador resolvía al `window.event` del clic—, así que el plato se guardaba
  sin `eventId`, o sea en el catálogo compartido, también desde el Demo. El mismo
  fallo estaba copiado en `CenasScreen` y ahí se ha arreglado pasando el evento.
- **C2 · Los planes se eligen en una hoja, no en una alfombra de chips.** Nueve
  planes libres eran 448,9 pt en nueve renglones, en el orden en que se crearon y
  sin decir los votos ni quién falta. Ahora un renglón —«+ Añadir un plan (9
  libres)»— abre la hoja con **los votos y quién falta por votar** en cada fila,
  que es lo que hace falta para decidir. Sin planes libres el botón lo dice y no
  abre una hoja vacía.
- **D2 · Libre es «sin día» y también «fuera de las fechas».** Un plan cuyo día se
  cayó al acortar el viaje no estaba ni entre los del día ni entre los que no
  tienen ninguno: **desaparecía del modal** mientras en Planes seguía apartado y
  marcado. Ahora cuenta como libre y la hoja dice de dónde viene («era el 17,
  fuera del viaje»), que es lo que manda §14.10-quater.
- **E1 · Los planes siguen naciendo en Planes.** El día **coloca**, no inventa: un
  plan creado desde el calendario nacería con día y sin votos, que es justo lo que
  evita §14.19.

Las dos hojas no se comportan igual y no es un descuido: los platos se **marcan**
—varios— y se guardan con el botón de la cena, como hasta ahora; un plan se
**elige** —uno— y se coloca en el acto, porque un plan no es de la cena y ya se
quitaba así. Quién falta por votar lo dice `lib/planes.js`, compartido con la fila
cerrada de Planes: dos sitios contando lo mismo con palabras distintas se leen
como dos cosas distintas.

**Lo que la hoja deja escrito y no se hizo:** `F2`, un recetario de menús que se
copian al día como las Ideas de Planes (§14.18). Es la única opción que pide tabla
nueva, migración y sincronización, y **encaja sobre F1 sin deshacer nada** — el
día que se note que «la paella de Curro» se vuelve a marcar cada verano.
### 14.19-ter Ideas: dos grupos, una firma y un renglón para apuntar

Decidido en [`docs/diseño/planes-ideas.html`](diseño/planes-ideas.html) ·
**A1 · B3 · F2 · C1+C3 · D3**.

**El defecto, medido.** Ideas era **una lista plana** en orden de guardado: las ya
propuestas a este viaje y las que nadie había sacado, revueltas, y lo único que
las separaba era un botón apagado de **144,2 pt** que decía «Ya propuesta» y no
hacía nada. La firma existía a medias —«la apuntó Curro»— y no decía de qué
familia ni cuándo. Y la fila **no medía lo mismo dos veces**: entre 68,1 y
**117,3 pt**, porque el subtítulo doblaba contra ese botón.

**Dos grupos, como en Planes** (A1): «Propuestas · N» —a este viaje— y
«Posibles · N» —por nombre—. Es el dibujo de la pantalla de al lado, así que no
hay nada nuevo que aprender, y el corte se ve sin leer. En el grupo de arriba la
fila **no lleva verbo**: el encabezado ya dice que está propuesta.

**Cada idea la firma quien la apuntó** (B3): el nombre, el **alias de dos letras**
de su familia en una pastilla con su color, y el «cuándo» en palabras
(`lib/hace.js`). Dos letras se leen de lejos y «García» no cabe al lado de un
nombre y una fecha en una línea de 15,7 pt. El color de la familia tiñe el fondo
y la letra se mezcla con la tinta del tema, para que se lea igual en las dos
caras. Una idea sin autor —de la IA, o importada— dice **«sin autor»**.

**La fecha es la del grupo** (F2): en Propuestas, cuándo se propuso a *este*
viaje; en Posibles, cuándo se apuntó al catálogo. Son dos hechos distintos y cada
grupo pregunta por uno; enseñar siempre la del catálogo hacía que una idea
propuesta ayer dijera «el 12 de julio de 2024».

**Las dos fechas las escribe el cliente** (`planIdeas.apuntadaEl`,
`plans.propuestoEl`, migración `0008`) y **no se reusa `creadoEn`**: esa la pone
el Worker al insertar, así que una idea recién apuntada no tenía fecha hasta
sincronizar, y en la web —que no sincroniza a propósito, §14.9— no la tenía
nunca.

**Se apunta desde un renglón fijo bajo el mando de áreas** (C1 + C3), no desde un
modal. El modal medía **455,4 pt** de los 508 que quedan sobre el teclado: se
escribía sin ver el catálogo, que es justo lo que evita apuntar dos veces la
misma cosa. El renglón deja **258,2 pt** de lista visible —tres ideas—, **no se
cierra al guardar** —se vacía y se queda enfocado, así que apuntar tres seguidas
son tres frases y tres toques— y «Más detalles» crece **hacia abajo**: lo que se
mueve es la lista, nunca el campo que está mirando el pulgar. Con el renglón
puesto, **Ideas no tiene botón flotante**: dos puertas a lo mismo es una de más,
y la flotante tapaba la última fila. El ✓ está apagado mientras no hay título;
sin eso, un toque en vacío guarda una idea sin nombre.

**El contador de viajes se va de la fila** y vive dentro de la idea abierta: en
una línea de 15,7 no caben el autor, la familia, la fecha *y* el contador, y de
los cuatro es el menos accionable.

**El alias se propone del nombre y se puede corregir** (D3, `lib/alias.js`):
«García» → `GA`, y sigue escribiéndose solo mientras nadie lo toque a mano. Nace
lleno porque el único fallo que rompe la firma de una idea es que esté vacío, y
se puede cambiar porque «Solteros» sale `SO` y quizá se quiera `SL`. Las familias
de antes de la columna caen al propuesto, así que ninguna se queda coja. En la
ficha de familia el alias va **junto al nombre** —se piensa cuando se está
escribiendo el nombre; puesto abajo, se salta— y el **estado se queda solo y a lo
ancho**, que es lo que va a crecer.

Una nota de oficio que costó un rato: `Fila` estaba declarada **dentro** del
componente, y eso crea un tipo nuevo en cada pintado, así que React desmontaba y
volvía a montar la lista entera. Con seis consultas vivas encima, llegaba a
tragarse un toque —la fila se cambiaba por otra igual entre que bajaba el dedo y
se levantaba—. Vive fuera y recibe lo suyo por props.

### 14.12 Un solo tema, y sus dos caras

**Los nueve skins se van.** Eran nueve paletas: nueve sitios donde un contraste
podía estar mal y ocho que nadie miraba. Y la división en «para leer bien» y «con
guasa» dejó de tener sentido en cuanto el tema único se resolvió bien — si el que
hay es legible, no hace falta una categoría aparte para los que lo son.

Queda **Abisal Sobrio**: el azul de la marca con el volumen bajado. El fondo deja
de ser un degradado radial y pasa a plano, las tarjetas dejan de ser translúcidas
—lo que además retira el token `--fila-solida`, que existía solo para que el rojo
de «Borrar» no se transparentase por debajo de una fila de cristal— y el acento
se desatura de `#1f9fd0` a `#22708f`. Se va también el confeti de la cabecera.

Dos caras diseñadas por separado, no una invertida: en la oscura el papel se
hunde hacia el marino y la tinta sube, pero el acento **baja** de saturación en
vez de subir, porque sobre fondo oscuro un azul saturado vibra.

En Ajustes → Aspecto solo se elige **Automático · Claro · Oscuro**
(`lib/tema.js`). `auto` **quita** el atributo `data-tema`, que es lo que deja
mandar a la consulta de medios; los otros dos lo escriben, y por eso la cara
clara se repite bajo `[data-tema="claro"]` — tiene que ganarle a la consulta en
los dos sentidos, no solo hacia el oscuro.

### 14.13 Los dibujos, y el único color que informa

**Los emoji del cromo se van** (`components/Icono.jsx`). Traían su propia paleta
puesta, medían distinto en iOS y en el navegador y no se recoloreaban con el
tema; y como la barra de abajo ya iba con dibujo de línea, la app estaba
mezclando dos lenguajes. Todos los dibujos van ahora sobre rejilla de 24 con
trazo de 1,8, en una sola tabla, y heredan el color de quien los coloca — un
icono no sabe de qué color es.

**Los emoji que eliges tú se quedan**: tu avatar, tu estado, el de una familia.
Ahí el emoji es contenido y no cromo, y esa es toda la regla.

**Las cinco categorías de gasto llevan tono propio** (opción I4 de
`docs/diseño/iconos.html`): ámbar la bebida, verde la compra, terracota la
comida, azul el restaurante, gris lo demás. Es lo único de la app con color
propio aparte del rojo y el verde de los saldos, y lo lleva porque **informa**:
en una lista larga se distingue la compra de las cañas sin leer. Los cinco están
igualados a mano y no elegidos a ojo — contraste entre 4,3 y 4,8:1 en claro y
entre 5,3 y 6,0:1 en oscuro, con las luminancias de los trazos dentro de un
margen de 0,06 —, así que ninguno grita por encima de otro. Que es exactamente lo
que hacían los emoji a los que sustituyen.

**Y lo escrito a pelo en el JSX se recoge.** Dieciséis `style={{ fontSize: 13 }}` y
`fontWeight: 850` repartidos por cinco pantallas se saltaban `--escala` y la
escala de pesos: «Enorme» crecía la app **menos** las cabeceras de día de Cenas,
los subtítulos de Planes, el total de Gastos y las cifras de Estadísticas. Eso
era un defecto del control de tamaño, no desorden. Ahora son clases (`.cifra`,
`.dia-cena`, `.anfitrion`, `.apunte`…) y **`src/estilos.test.js` impide que
vuelvan**, señalando fichero, línea y qué usar en su lugar. Los otros setenta
inline —`marginTop`, `display`, `textAlign`— no molestan a nadie y se quedan.

**Los pesos bajan.** Los títulos de 800 a 650, las filas de 650 a 550, los
importes de 750 a 620, los botones de 750 a 600, y fuera el `letter-spacing`
negativo agresivo. Misma familia —la del sistema, que es la de iOS— y mismo
tamaño: la talla sigue en Grande.

**El relleno es para una acción por pantalla**, la que se ha venido a hacer; todo
lo demás va con contorno. Antes iban todos llenos del mismo cian saturado, y una
pantalla con cinco botones cantando no dice cuál es el bueno.

**La marca también se dibuja.** `WhaleLogo` era un emoji de ballena sobre un
cuadrado con una «B» de marca de agua tan apagada que no se leía; ahora es el
mismo trazo que el resto y se recolorea con `--whale`.

**El icono de la app sale de un solo sitio.** `app/assets/icon.png` (1024×1024)
ya alimentaba el binario de iOS vía `npm run assets:ios`; ahora también la web y
la PWA, con `npm run iconos:web` (`scripts/iconos-web.mjs`, sharp). Hasta aquí
eran **dos dibujos distintos según por dónde entraras**: la app instalada
enseñaba el de `assets/` y el navegador un `favicon.svg` que era un emoji sobre
un cuadrado. Ese SVG se ha retirado.

Lo que se genera, versionado en `public/`: `favicon-32.png`,
`apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` e
`icon-maskable-512.png`. El **maskable va aparte** y no como `purpose: 'any
maskable'` sobre el mismo fichero: quien recorta se cree esa promesa y le corta
la cola a la ballena, que llega casi al borde. El de 512 encoge el dibujo al
**80%** y rellena con el fondo del propio PNG (#08202C, que es prácticamente el
`--abyss` de la cara oscura, así que no se ve costura). Y `index.html` **declara
su icono**: sin eso el navegador iba a buscar `/favicon.ico`, que no existe.

`sharp` no es dependencia del proyecto a propósito —binario nativo pesado, se usa
una vez cada muchos meses—: se instala con `npm i --no-save sharp` el día que
cambie el dibujo. `src/iconos.test.js` vigila que los ficheros sigan ahí, que
sean PNG de verdad y que nadie vuelva a apuntar al SVG.

### 14.11 Lo que la App Store obliga a que exista

Tres piezas del producto no salen de ninguna necesidad del grupo: salen de que la
aplicación se distribuya por la App Store. Conviene que quede escrito, porque
desde dentro parecen adornos y no lo son. La secuencia de publicación está en
[`APPSTORE.md`](APPSTORE.md).

**El modo de demostración** (`app/src/lib/demo.js`). El acceso es por invitación,
de modo que quien no ha sido dado de alta —el equipo de revisión de Apple, sin ir
más lejos— no ve absolutamente nada. Sin una salida, eso es un rechazo por la
directriz 2.1 sin que nada esté mal. La salida es un segundo botón en la pantalla
de acceso que abre la app entera con el evento de ejemplo de `seedExample()`,
sembrado en la base local, sin sesión y por tanto sin sincronización: es el modo
solo-local de siempre, con datos dentro. La marca vive en `sessionStorage` —una
demostración se acaba al cerrar la app— y una **pastilla escrita y permanente** en
la cabecera la señala y es a la vez la salida: durante una demostración todo lo
que se ve es inventado, y esa es la única señal de que no es el viaje de verdad.
La pastilla **sustituye** al punto de sincronización en vez de sumarse a él: la
cabecera tiene sitio para tres cosas (§14.10) y aquí no hay nada que sincronizar,
así que un punto en verde estaría mintiendo.

No hay que confundirla con **«usar solo en este móvil»** (§14.9), que se le parece
y resuelve lo contrario. Esa es para quien **sí** es del grupo y no consigue
entrar: arranca **vacía** y lo que se escriba acaba subiendo cuando la puerta
abra. La demostración es para quien **no** es del grupo: arranca **llena** y no
sube nada nunca. Una app vacía no enseña lo que hace, que es justo lo que hay que
enseñarle a quien revisa.

**Eliminar la cuenta** (Ajustes → *Eliminar mi cuenta*). La directriz 5.1.1(v)
exige que quien puede crear una cuenta pueda eliminarla desde dentro de la app.
Se elimina el vínculo entre el Apple ID y el grupo, y los dispositivos; **no** se
eliminan los hechos del grupo —gastos, cenas, planes—, porque no son datos de esa
cuenta sino del grupo, y borrarlos descuadraría los saldos de todos los demás.
La otra mitad de la directriz es invisible: hay que **avisar a Apple**
(`api/src/revocacion.js`) para que la app desaparezca de «Apps que usan tu Apple
ID». Es lo único de todo el sistema que necesita una clave privada, el código de
autorización se pide en el momento de la baja y no se guarda nunca, y si la
revocación falla **la baja sigue adelante**: lo que no puede ocurrir es que
alguien no pueda irse porque un servidor ajeno no respondió. La pantalla lo dice
cuando pasa, en vez de callárselo.

Aquí no hace falta un «retirar mi solicitud» como el de `garciadoral-ops`, y el
motivo es que **entrar sin invitación no guarda nada**: el Worker responde 403 sin
escribir en la base. No hay cuenta que borrar, y eso se dice en la propia pantalla
de acceso y en las notas de revisión.

**Nada de terceros en el binario.** OneSignal y `@capacitor/push-notifications`
estaban en el `package.json` y eran inertes: sin `VITE_ONESIGNAL_APP_ID` no se
inicializaba nada y no había servidor que enviara ningún aviso. Se retiraron
antes del primer envío. Entraban igualmente en el binario, y OneSignal es de los
SDK que Apple obliga a declarar con su manifiesto de privacidad firmado, además
de tener que recogerse en las etiquetas de privacidad de la ficha. El día que se
quieran avisos, el camino corto es APNs directo desde el Worker —lo que hace
`garciadoral-ops`— y no un intermediario.

---

## 15. Registro de decisiones

### ✅ Cerradas
| # | Decisión | Resolución |
|---|---|---|
| Q1 | Autenticación | **Email mágico** (sin Apple, sin Google por ahora); login = identidad, no control de acceso |
| Q2 | Familias/personas | **Globales**, composición **congelada por evento** |
| Q3 | Unidad de deuda | **Entre familias** (familia = cartera; persona sin familia = familia de uno) |
| Q4 | Rol de persona | **Dos ejes:** edad (`adulto`/`niño`) + flags (`come_con_mayores`, `cuenta_como_adulto_reparto`) |
| Q7 | Permisos | **Todos editan todo, sin roles** → historial de cambios pasa a obligatorio |
| Q8 | Alcance v1 | **Priorizar gastos + gente**; comidas/planes/estadísticas después |
| Q5 | Bunga de comidas | **Rotación por día** (bunga anfitrión de mayores y de niños cada día), buscando balance |
| Q6 | Catálogo de platos | **Global + favoritos del grupo** |
| — | Moneda | **Multi-moneda** (moneda base por evento + tipo congelado por gasto) |
| — | Nombre | **Ballena Ops** (mascota: la ballenita) |
| — | Reparto de gastos | **Fino a nivel persona** (incluir/excluir personas), saldo agregado por familia |
| — | Liquidación | **Simplificada** (minimizar transferencias, estilo Splitwise) |
| — | Planes | **Lista + votación ligera** (👍/🤷/👎 + asignar a día), sin agenda por franjas |
| — | Balance de anfitrión | La app **muestra + sugiere**, decide un humano |
| — | Anfitrión de comida | **Solo presta el bunga** (espacio); cocinar es aparte |
| — | Cuentas | **≥1 login por familia**; perfiles-nombre gestionados o usuarios completos; **cada uno elige su familia** |
| — | Tipo de cambio | **Automático (API) + editable**, congelado en el gasto |
| — | Notificaciones | **Push a tope + resumen diario** (con preferencias por categoría) |
| — | Offline | **Offline-first** (apuntar sin red, sincronizar al reconectar) |
| — | Conflictos offline | **Último en sincronizar gana** (last-write-wins) + historial para recuperar |
| — | Categorías de plato | Añadido **Postres**; «Bebidas» NO es categoría (va en cantidades) |
| — | Recurrencia | **Duplicar evento anterior** al crear uno nuevo |
| — | Cierre de evento | **Se cierra pero es reabrible** (sin candado; resumen + liquidación) |
| — | Tono de estadísticas | **Gamberras pero opt-in** (las que señalan se activan por evento) |
| — | Pagadores | **Uno o varios** por gasto (reserva a medias) |
| — | Redondeo | **Reparto automático del sobrante**, avisando a quién le tocó el céntimo |
| — | Categorías de gasto | **Lista fija con iconos** (compra general / comida / bebida / restaurante / varios) |
| — | Fotos | **Sin fotos en v1** (pesan y complican el offline); a v2 |
| — | Peso de niños en reparto | **`peso_reparto` por persona** (en su perfil), default 1 |
| — | Historial de saldos | **Saldo actual + registro de cambios**; **gastos editables** con recálculo |
| — | Idioma | **Solo español** (sin i18n en v1) |
| — | Multi-evento | **Varios a la vez, con uno "activo"** resaltado |
| — | Unirse a un evento | **Enlace / QR** + elegir familia |
| — | Bunga↔familia | **1 familia = 1 bunga** en v1 (casos raros a mano) |
| — | Plataforma | **PWA únicamente** (sin app iOS nativa) |
| — | Stack Fase 1 (propuesta) | **Heredar counter-ops:** React+Vite (PWA) · **IndexedDB + doc compartido por evento + merge tombstone/LWW** · **GitHub Pages** (Actions). PowerSync+Supabase = vía de mejora (§14) |
| — | Forks vs counter-ops | Auth **con login** · backend **modelo simple (clave en cliente)** · **IndexedDB** desde el día 1 · fotos **v2**. **opción A** decidida: login = identidad/comodidad, no control de acceso (§14.6) |
| — | Safari iOS | **Funciona**; requiere **"añadir a pantalla de inicio"** para push + persistencia; **sin background sync** (sync al abrir) (§14.3–14.4) |
| — | Ambición | **Solo para el grupo** (sin escalar ni monetizar) |
| — | La ballenita | **Comenta en momentos clave**, sin cansar |
| — | Lista de la compra | **Manual (texto) en v1**, agregada en v2 |
| — | Agenda por días | **Vista que une comidas + planes** por día, junto a las secciones sueltas |
| — | Botes / gastos comunes | **No**: todo gasto vive dentro de un evento |
| — | Comidas en v1 | **Solo cenas** (una por día); resto por libre |
| — | Confirmar un plan | **Lo decide quien propone** (la votación orienta) |
| — | Día de un plan | **Opcional desde el principio** (con día o "a decidir") |
| — | Saldar deuda | **Apuntar "pagado" a mano**; la app no mueve dinero (Bizum a v2) |
| — | Turno de cocina | **No se registra** (va en el texto libre); solo se balancea el bunga |
| — | Offline (PWA) | **Completo desde el día 1** (enfoque counter-ops: merge local, no motor pesado) |
| — | Resumen diario | **Por la mañana** |
| — | Logo | Ballena **saltando en diagonal**, sonriente, con chorro |
| — | Entidad raíz | **Evento** (antes "viaje") — suele ser un viaje, pero puede ser cualquier plan con fechas |
| — | Perfil personalizable | **Persona y familia:** avatar/logo + estado con **emoji/imagen** (v1) o **foto** (v2, mismo coste que fotos de gasto) |
| — | Platos por cena | **Varios por tipo** (p. ej. 2-3 guarniciones); `platos[]` sin límite por categoría |
| — | Día de un plan | **Poner / cambiar / quitar** el día; y **borrar** el plan (queda en historial) |
| — | Campos extra por objeto | Evento **+lugar** · Persona **+apodo** · Plan **+enlace** · Bunga **+parcela/alias** · Plato **+ingredientes** (gasto/cena/familia: sin cambios) |

### 🟡 Aún abiertas (nivel implementación, no bloquean producto)
| # | Decisión | Recomendación |
|---|---|---|
| — | Proveedor concreto de la API de tipos de cambio + su fallback offline (§3.6) | A elegir al implementar |

*(A nivel de producto no queda ninguna decisión abierta. Lo único pendiente es técnico y se resuelve en la fase de implementación.)*
