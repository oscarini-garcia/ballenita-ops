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
| **Agenda** | Hoy · Días · Números | El rótulo nombra la sección, no su primera área |
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
  Evento · El grupo · Quién eres · Sincronización · Tu cuenta · La app. Primero
  el viaje, al final la fontanería. **Estadísticas dejó Ajustes** (agosto 2026):
  se mira, no se ajusta, y lo que se mira del viaje vive en Agenda — es su
  tercera área, rotulada **«Números»** porque «Estadísticas» mide 121,2 pt y la
  casilla del mando de tres da 103,3, así que no cabe ni en Grande. La pantalla
  es la misma (`StatsScreen`, ya sin el modo `suelto` que la metía en un
  acordeón).
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
- **✅ El administrador no espera en su propia sala** (`api/src/administrador.js`,
  el gemelo del de arriba, con su correo). La sala solo la abre un
  administrador, así que si el único que hay sale de la cuenta, al volver se
  quedaba esperando a que le enlazara… él mismo, y la salida era escribir en la
  base a mano. Cuando el correo del token —**verificado por Apple**, no lo
  elige quien llama— es el suyo, la cuenta nace o vuelve administradora, activa
  y **enlazada sola con su persona** (`promoverCuentaAAdministrador`: por
  nombre, en eventos de verdad, sin pisar un enlace ya puesto). Vale en la
  puerta (`POST /api/sesion`) y en el sondeo de la sala
  (`POST /api/sesion/espera`), que es lo que saca a un móvil ya clavado en la
  sala sin volver a pasar por la hoja de Apple. **Hay una segunda llave, más
  débil, para cuando el correo no sirve**: con «Ocultar mi correo» Apple
  entrega una dirección de relé, no la de verdad. El **nombre** —comparado sin
  tildes ni mayúsculas, que Apple lo guarda «Oscar» y `lib/admin.js` lo escribe
  «Óscar»— también abre, pero **solo cuando no queda ningún administrador
  activo**: el nombre no lo firma Apple, lo manda la app, así que únicamente
  cuenta en el estado del cerrojo, donde la alternativa es un grupo cerrado con
  la llave dentro. La búsqueda de su persona normaliza igual.
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

### 14.17-ter «Se queda colgado en Pidiendo…»

Es el peor desenlace posible de los cinco que tiene encender los avisos, porque
es el único que **no dice nada**: ni sale, ni falla, ni se puede contar. Y el
sitio donde se quedaba no era ninguno de los que este apartado había mirado
—Apple, el binario, el permiso—, sino el cuarto y último, el que no se nombraba.

- **✅ `fetch` no tiene plazo, y ahora la API sí** (`sync/api.js`, `PLAZO_API` =
  20 s). Esa es la causa: con el permiso ya dado y el identificador ya en la
  mano, lo que quedaba era el `POST /api/push`, y una dirección que no responde
  —red de hotel, DNS, el Worker sin publicar— deja una promesa que **ni se cumple
  ni se rompe**. Dentro de un `await` sin carrera eso es un botón girando para
  siempre. Toda petición sale con corte, y al agotarse se dice con esas palabras
  («la API no contestó en 20 s»), que es lo que separa «la API no contestó» de
  «la API contestó que no» (§14.9-bis). Veinte segundos son de sobra para un
  Worker, arranque en frío incluido, y bastante menos que la paciencia de nadie.
- **✅ `register()` ya no se espera** (`lib/native.js`). Estaba con `await` justo
  delante del `Promise.race`, así que el reloj de los ocho segundos corría y **no
  lo miraba nadie**: una llamada nativa que no volviera dejaba lo mismo, la
  pantalla quieta. Lo que interesa de `register()` no es cuándo vuelve —en el
  acto, y sin dato— sino lo que llega después por el evento; y si rompe, rompe
  por el mismo sitio que un `registrationError`. Es la figura de
  `garciadoral-ops`: **una sola promesa que se contesta desde donde llegue la
  respuesta**, token, error o reloj. Las asas de los escuchas llevan también su
  plazo, porque cruzan el puente igual que todo lo demás.
- **✅ Con el permiso denegado no se vuelve a preguntar.** iOS enseña su hoja una
  sola vez en la vida de la instalación: pedirlo otra vez devuelve «denied» sin
  abrir nada, y solo servía para que el paso pareciera esperar algo.
- **✅ Y se dice en cuál de los cuatro se ha quedado** (`ListaDePasos`, la misma
  figura que Sincronización y Actualizar): *la parte nativa · el permiso de iOS ·
  el identificador de Apple · el servidor*. Son cuatro sitios distintos con
  cuatro arreglos distintos —reinstalar, Ajustes de iOS, el entitlement del
  binario, la dirección de `config.json`— y hasta ahora los cuatro se veían
  igual. El renglón del fallo **se toca para copiar el informe**; un «no valid
  `aps-environment` entitlement string found» no se transcribe a mano desde un
  teléfono.
- **✅ Y el renglón contestó: se paraba en el primero.** La lista se estrenó
  diciendo lo que ninguna de las vueltas anteriores había podido: no fallaba
  Apple, ni el permiso, ni el servidor —se quedaba en *«Buscando la parte nativa
  de los avisos»*—. Ese eslabón tenía una espera que sobraba: si el objeto no
  está en `Capacitor.Plugins`, se caía a `import('@capacitor/push-notifications')`
  con plazo de seis segundos. Y ese import **no es una segunda opinión**: el
  JavaScript del paquete viaja dentro del OTA, así que importarlo funciona
  siempre y el objeto que devuelve llama a una parte nativa que no existe (por
  eso se colgaba, que es lo que este apartado ya sabía y trataba con un plazo en
  vez de con la puerta). Dentro de la cáscara **la ausencia es la respuesta**: la
  parte nativa escribe `Capacitor.Plugins.<nombre>` para cada plugin registrado
  antes de que corra una línea de la aplicación (`JSExport.swift`, guiones
  `atDocumentStart`). Así que `plugin()` es ahora **síncrona**: si no está,
  `SIN_PLUGIN` en el acto. Cambiar una certeza instantánea por seis segundos de
  espera para acabar dando la respuesta equivocada es el peor de los dos tratos.
- **✅ Y el último eslabón fue TestFlight: `BadDeviceToken`.** Con los avisos ya
  funcionando desde Xcode, subir por TestFlight los rompió. La causa es de
  manual y aun así muerde: **TestFlight y la App Store firman `production`**,
  Xcode firma `development`, y un token de un entorno no vale en el otro. Lo
  grave no era que no llegara, sino **qué hacía el Worker al enterarse**: Apple
  contesta `BadDeviceToken`, que es *exactamente* lo mismo que contesta un token
  de un teléfono que desinstaló la aplicación, así que se daba por muerto y **se
  borraba de la base**. Mismo síntoma que una desinstalación, causa distinta y
  ninguna pista — y con eso, una variable mal puesta en `wrangler.toml`
  desregistraba a todo el grupo, uno por aviso.
  - **`apns.js` reintenta una vez contra el otro servidor** antes de dar un
    token por muerto, y solo con `BadDeviceToken`: un `410 Unregistered` sí es
    una desinstalación y no hay nada que probar. Si el de enfrente lo acepta, el
    aviso llega y el token se queda donde estaba. Un desajuste cuesta ahora una
    petición de más, no los avisos de todo el grupo.
  - **Y se dice** (`entornoCruzado`): la prueba avisa de que salió por el otro
    lado, porque el reintento no es una solución sino un colchón, y `APNS_ENTORNO`
    hay que corregirlo igual.
- **✅ «Mandado» no es «llegado», y eran dos eslabones en uno**
  (`escucharUnAviso`, `SIN_ENTREGA`). Con el registro por fin resuelto, el aviso
  de prueba decía «mandado» y se callaba — y eso es solo un **200 del servidor de
  APNs**. Entre eso y que el teléfono lo enseñe hay un tramo entero que no se
  miraba, y ahí caben dos cosas que se ven igual y se arreglan en sitios
  distintos: que no llegue —el entorno, que es la causa que más veces es y la
  única que **no da ningún error**, porque Apple contesta que sí y tira el
  aviso— o que llegue y **con la aplicación abierta iOS no pinte nada**. La
  prueba pone el oído **antes** de mandar (el aviso puede volver antes que la
  respuesta del servidor: ponerlo después es la misma carrera perdida que ya
  costó el token) y espera doce segundos. No llegar queda en **aviso**, no en
  fallo: salió bien.
- **✅ Y con la app abierta iOS no pinta nada si no se le dice**
  (`capacitor.config.json` · `PushNotifications.presentationOptions`). Sin esa
  clave, `willPresent` de Capacitor devuelve el conjunto vacío y el aviso se
  entrega sin banner, sin sonido y sin globo. `garciadoral-ops` tampoco la tiene
  y no lo nota, porque allí los avisos llegan con la aplicación cerrada; aquí el
  botón de prueba se pulsa **mirando la aplicación**, que es justo el caso.
  Es del binario: no viaja por OTA.
- **✅ Era el `AppDelegate`, y el aviso estaba dado desde el principio.** El
  renglón acabó diciendo que Apple no contestaba nada, y `grep -c
  didRegisterForRemoteNotifications ios/App/App/AppDelegate.swift` devolvió
  **`0`**: el reenvío no estaba. El porqué no fue el código sino **la copia
  local**, que iba en la **v0.10.1** —diez versiones por detrás—, y el
  `patch-ios.mjs` de aquella versión **no traía ese paso**: en su salida se ve
  saltar del permiso de avisos al storyboard sin nombrarlo. La causa, entonces,
  no era ninguna de las cuatro que se miraron, y por eso `sync:ios` daba verde.
- **✅ Y por eso `patch-ios.mjs` termina revisando y falla si falta algo**
  (`scripts/revision-de-avisos.mjs`). Lo que hizo que esto durase cuatro vueltas
  no fue la causa: fue que se avisaba con un `console.warn` **en medio de un log
  de compilación**, se seguía adelante y se terminaba en verde. **Un aviso que
  nadie lee y un `exit 0` dicen exactamente lo mismo que no haber comprobado
  nada.** Ahora relee los tres ficheros al final, imprime los tres renglones con
  su arreglo debajo, y **sale con error** si alguno falta: archivar un binario
  que no puede avisar es trabajo perdido que no se descubre hasta tener el
  teléfono en la mano. El `process.exit(0)` del storyboard se retiró para que el
  resumen corra siempre.
- **✅ El silencio de Apple tiene su propia causa, y no la que se decía**
  (`SIN_TOKEN_PORQUE`). Con el primer eslabón resuelto, el renglón pasó a pararse
  en el tercero, y ahí las dos pantallas que lo enseñaban decían **cosas
  distintas** y las dos adivinaban: «suele ser que al binario le falta el permiso
  de avisos» y «suele ser que no hay red». La primera es directamente falsa: un
  `aps-environment` que falta **no da silencio, da un `registrationError` con
  palabras**, y ese camino ya se cuenta entero desde §14.17. Lo que sí calla a
  Apple es que el `AppDelegate` del binario instalado no reenvíe la respuesta
  —lo repone `scripts/appdelegate.mjs` en cada `sync:ios`, y **no viaja por
  OTA**—, que el aparato no tenga red, o que sea el simulador. Escrito una sola
  vez y en el módulo que produce el silencio, no en las dos pantallas que lo
  pintan.
- **✅ El renglón dice qué ha pasado, no solo dónde.** «Pidiéndole el
  identificador a Apple ×» se reportó tal cual —«falla en pidiéndole el
  identificador a Apple»— y costó una vuelta entera, porque ahí caben **dos**
  cosas que se arreglan en sitios distintos: que Apple conteste que no, y
  entonces sus palabras son la causa y el arreglo está en el portal de Apple; o
  que no conteste nada, y entonces es el binario. El renglón pasa a poner «Apple
  ha rechazado el registro» o «Apple no ha contestado nada en ocho segundos», sin
  tener que tocarlo. Un rótulo que dice el eslabón es la mitad del trabajo; la
  otra mitad es decir el desenlace.
- **✅ La capacidad se activa por App ID, y la clave no** (`docs/DESPLIEGUE.md`).
  Es lo que explica que **otra app del mismo equipo avise y esta no**: la clave
  `.p8` es del equipo y vale para todas, así que verla funcionar en otro proyecto
  no dice nada de este; lo que se activa por identificador es la capacidad, en
  *Identifiers → Push Notifications*, **y hay que regenerar el perfil** —el
  entitlement vive en el perfil, no en el fichero, y un binario firmado con un
  perfil que no lo trae no lo tiene por mucho que `App.entitlements` lo diga—.
  Aquí no estaba documentado en ningún sitio: `DESPLIEGUE.md` cubría los tres
  secretos del Worker y el entorno, que es la mitad del asunto que **no** gatea
  el registro.
- **✅ El renglón que falla lleva en qué se basa** (`informeDelPuente`).
  «sin-plugin» copiado al portapapeles no informa de nada; qué plataforma dice el
  puente y **qué plugins trae** separa las dos causas que desde el móvil se ven
  igual: con `Haptics` y `Share` pero sin `PushNotifications`, el binario es
  anterior al plugin y hace falta instalar uno nuevo; sin ninguno, lo que falla
  es el puente entero y los avisos son lo de menos.
- **✅ El entitlement se escribe, no se avisa** (`scripts/entitlements.mjs`, de
  `garciadoral-ops`). Eran dos cosas y aquí solo se hacía media: `patch-ios.mjs`
  añadía `aps-environment` **si el fichero ya existía** y se limitaba a avisar por
  consola si no —justo el caso de la primera pasada tras un `cap add ios`—, y no
  declaraba `CODE_SIGN_ENTITLEMENTS` en el proyecto. Un `App.entitlements` que
  existe en disco y no está declarado en el target **no se firma**: mismo
  silencio, misma respuesta de Apple, y encima el fichero ahí para desmentirlo.

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

### 14.20-ter La lista más fina, y una IA que dice que está pensando

Decidido en [`docs/diseño/receta-fina.html`](diseño/receta-fina.html) ·
**F2 + F4 · C3 · P1 · M2 · A1 + A2**.

Cuatro ingredientes ocupaban **437,8 pt de los 844** que tiene la pantalla, y el
motivo no era la caja sino **el detalle debajo de cada línea**: una fila con
«0,1 kg/ración · paquete de 1 kg» mide **105,9 pt** y una sin él, **60,6**. O
sea que escribir una cantidad **alargaba la lista 45 pt bajo el dedo** mientras
la rellenabas.

**Sin cajas** (F2). Los bordes se van y se escribe encima del texto. Medido, eso
**no ahorra sitio** —2 pt por fila, porque el alto lo pone el relleno del campo—:
es una decisión de aspecto, para que ocho ingredientes se lean como una lista y
no como ocho formularios. Lo que hacía el borde sí hace falta, así que **el campo
enfocado se tiñe**: esa es la única señal de dónde estás escribiendo.

**El detalle, en un renglón al pie** (F4). Dice el de **la línea que estás
tocando** —«0,1 kg/ración · paquete de 1 kg»— y, cuando no tocas ninguna, el
resumen: para cuántas es, **cuántas van sin cantidad** y cuántas puso la IA. Ese
recuento es lo que decide si hay que pulsar «Arreglar», y es justo lo que no se
puede contar de un vistazo con ocho líneas delante. Alto fijo: si apareciera y
desapareciera, la pantalla saltaría al tocar cada línea.

**El mando dice qué cantidad se escribe** (C3): «Para 12» o «Por persona», y
**hace de rótulo de la columna**, que es el renglón que si no llevaría una
etiqueta muerta. **Lo guardado es siempre el total de la receta**: el mando solo
cambia en qué unidades se teclea, y el renglón del pie enseña la otra. Si se
guardara la cantidad por cabeza, cambiar las raciones de un plato ya escrito
cambiaría lo que hay que comprar sin que nadie tocara la receta. Sin raciones no
hay «por persona» que valga y el mando lo dice, en vez de mentir. Repartiendo,
la columna crece a 108 pt: un pollo entre doce son 0,083 ud y en 92 salía
«0,083 u».

Medido en el navegador, la lista entera pasa de **437,8** a **377,3 pt** —mando
36,1 · lista 320,0 · pie 21,2— y, sobre todo, **la fila mide siempre 60,6**.

**Sin conexión la IA no se ofrece** (`lib/ia.js`). Los tres botones se podían
pulsar sin red y lo que salía era el error del transporte contado con las
palabras del transporte —«Load failed», «sin API configurada»—, que no dice ni
qué ha pasado ni si es culpa tuya. Y en el navegador no van a funcionar nunca,
porque la clave vive en el Worker (§14.9): un botón que no puede funcionar no
debería poder pulsarse. Ahora van apagados **y dicen por qué**.

**Dice quién está pensando** (P1, `components/BotonIA.jsx`). El «Un momento…»
colgaba de una sola variable de estado y vivía en el botón de «Arreglar», así
que pulsar «Parecidos» hacía hablar a su vecino. Ahora lo dice **el que has
tocado**, con tres puntos que laten, y el otro se apaga —dos llamadas a la vez
no se pueden pagar dos veces—. Cero altura: la respuesta está donde acabas de
tocar.

**«Parecidos» abre un modal** (M2). Salían inline, en una tarjeta de **242,4 pt**
encajada entre los botones y «Para cuántas raciones», y ahí solo caben tres
renglones: nombre, porqué y **los ingredientes como una ristra de nombres
separados por puntos, sin cantidades**. Pero lo que llega es una receta entera, y
una receta se decide mirándola. El modal **dice desde el primer momento que está
cargando**, enseña una por pantalla con sus cantidades y se mueve con ‹ ›.

**Dos cosas se pueden hacer con la que te gusta.** **Añadirla como plato nuevo**
(A1) deja el plato desde el que llamaste sin tocar. **Sustituir la receta
abierta** (A2) escribe encima del editor y **avisa de en cuántas cenas está
metido ese plato** antes de hacerlo, con el mismo criterio con el que borrar ya
lo dice: cambiar la receta cambia lo que se cena esas noches. Ninguna de las dos
guarda nada; el modal solo rellena. Sustituir **borra el deshacer de
«Arreglar»**, que guarda una sola foto de la lista: dejarlo puesto ofrecería
volver a una receta que ya no es la de este plato.

**Tres defectos que salieron al implementarlo**, y que estaban desde antes:

- **No se podía escribir un decimal.** «1,2 kg» se teclea de izquierda a derecha,
  así que en algún momento lo escrito es «1,»; el punto suelto casaba con el
  hueco de la unidad —«1» y unidad «.»—, la caja se repintaba «1 .» y ahí se
  atascaba. Ahora la coma final se cae antes de mirar nada, y la caja guarda
  aparte lo que hay tecleado mientras todavía no es un número.
- **Una propuesta cogida no nacía.** Llega sin `id`, pero el editor la trataba
  como un plato existente: decía «Editar plato», ofrecía borrarlo y «Guardar»
  llamaba a `updateDish(undefined, …)`.
- **`event` no era un prop de `ModalPlato`.** `addDish(campos, event)` cogía el
  `window.event` del navegador, así que en el evento Demo un plato nuevo se
  escapaba al catálogo global (§14.9-quater).

### 14.20-quater Con qué se cocina, para que la IA lo tenga en cuenta

Decidido sobre la marcha: pedirle platos al modelo sin decirle **con qué se
cocinan** es pedírselos a ciegas, y falla en las dos direcciones —propone cosas
de horno, que no hay, y no propone las de barbacoa, que es donde se hace casi
todo—.

**Es un dato del evento** (`events.cocina`, migración `0011`, que se aplica
desde Ajustes → Actualizar como las demás, §14.23) y no de la app,
porque cambia con el sitio: otro año, otro camping y otros cacharros. Se escribe
en **Ajustes → Evento → Editar**, en un campo que dice lo único que hace:
«Solo lo lee la IA, para que lo que proponga se pueda cocinar».

**Texto libre y no una lista de casillas.** Una lista obligaría a decidir de
antemano qué cacharros existen, y lo que de verdad hay que contarle es la frase
entera —«en el bungaló se puede hacer algo sencillo en sartén, pero poco: da
mucho calor»—, que ninguna casilla dice.

**Vacío no es vacío**, como los encargos (§14.16-quater): vale el texto de
origen, que vive en el servidor (`api/src/cocina.js`) porque es el servidor
quien compone el material. La pantalla lo enseña **en gris**, porque si no esa
regla es invisible y el campo parece que no hace nada — y por eso el campo tiene
**seis renglones**: medido a 390 pt, el texto de origen ocupa seis líneas y en
tres se cortaba a media palabra. La app guarda una copia del texto solo para esa
pista, y `lib/cocina.test.js` lee el fichero del Worker y las compara: dos copias
que se separan enseñarían una cosa y mandarían otra.

**Dónde entra.** En el material de **platos parecidos** (§14.20-bis), que es
quien más lo necesita, y en el de las **ideas de plan** (§14.19-bis), porque
media hora de barbacoa es un plan y sin saber que hay barbacoa no se propone
nunca. Como todo el material, **lo compone el Worker leyendo la base**: del móvil
sale el `eventId` y nada más. Sin `eventId` —una app vieja— se propone igual, con
el texto de origen.

**No toca nada más**: ni la compra, ni las cenas, ni los saldos. Es un dato que
solo existe para que las cinco propuestas sean cinco propuestas que se pueden
cocinar.

### 14.20-quinquies El editor de receta se abre a leer, y el OTA dice por qué no ha traído nada

**El editor no roba el foco** y va **estrecho y centrado** (`.modal.center
.formulario`), la misma figura que el editor de una idea (§14.19-ter). Con el
cursor puesto, iOS saca el teclado solo: entre el teclado abajo y el modal a
ancho completo había que hacer scroll para ver la receta que venías a mirar. El
teclado ya no sale hasta que se toca un campo.

`.modal.center` estrecha **dos veces** —los 14 pt de aire del fondo y luego un
90 %—, y eso en un formulario se paga en la columna del nombre: medido, dejaba
al nombre 143,8 pt y «Costillas de cerdo» (169) se cortaba. `.formulario` deja
que estreche solo el aire del fondo: **362 pt frente a los 390 de antes**, y al
nombre le quedan **180**. La columna de la cantidad baja de 92 a **78** —estaba
medida para un modal de 390— y a 104 mientras se escribe por persona, que es
cuando las cifras se alargan. Con eso solo se corta un nombre de dieciocho
letras, y el campo se desplaza al tocarlo.

**Y el lápiz de la fila se retiró.** Era un objetivo de 44 pt al final de una
fila que ya se podía tocar entera, y decía «editar» cuando lo que se abre sirve
igual para **mirar** la receta —que desde que los platos llevan cantidades es la
mitad de las veces que se entra—. Ahora se toca la fila y se abre, que es el
idioma de El grupo (§14.14). La fila lleva **rótulo propio** («Abrir Paella
mixta»): la estrella de al lado también dice el nombre del plato, y sin él quien
lo oye tiene dos botones que dicen lo mismo y ninguno dice cuál abre la receta.
La estrella se queda aparte porque hace otra cosa y se hace sin abrir nada.

**Cuando el OTA no trae nada, se dice qué ha pasado** (§14.9-bis). El botón de
Actualizar llamaba al paquete OTA y **tiraba la respuesta**: si no era
«actualizado», seguía con el camino del service worker —que dentro de la app de
iOS no trae nada— y terminaba con su ✓. La pantalla decía que sí y el teléfono se
quedaba en la de antes. Ahora cada una de las cuatro respuestas
(`motivoDelOta`) dice **dónde** está el problema, porque están en sitios
distintos: ya la tienes, no se ha podido leer el manifiesto, aquí no hay paquete
que traer, o el error tal cual. Y el renglón de la versión enseña **el paquete
puesto** cuando no coincide con el que se horneó en el binario: dentro de la app
hay dos números, y saber cuál se ha quedado atrás es la diferencia entre «no ha
actualizado» y poder arreglarlo.

### 14.20-sexies El OTA se aplicaba con la llamada que no era, y no había nada que mirar

La app se quedaba en la versión de antes con el release publicado, el manifiesto
correcto y **el `bundle.zip` constando descargado** (`download_count: 1`). Con
eso no se puede decidir nada: no se sabe si el fallo está en bajarlo, en
aplicarlo o en que el plugin lo ha devuelto.

**`set()` no hace lo que este código creía.** Su documentación lo dice con esas
palabras —*terminal operation*—: cambia el paquete y **recarga en el acto**,
destruyendo el contexto de JavaScript. Se llamaba **siempre**, también en la
comprobación de fondo de `initNative()`, así que abrir la app con versión nueva
la reiniciaba sola nada más arrancar; y el `reload()` de la línea siguiente era
código muerto, porque nunca llegaba a ejecutarse. El test ya decía la intención
buena —«sin pedirlo, no recarga: se aplica al abrir la app la próxima vez»— y
era el código el que no la cumplía.

Ahora hay dos caminos, que es lo que el plugin ofrece: **`next()`** en segundo
plano —deja el paquete puesto para el próximo arranque, sin interrumpir a
nadie— y **`set()`** detrás del botón, porque quien lo toca ha venido a ver la
versión nueva ahora.

**Y se enseña qué paquetes hay** (`estadoDelPaquete`, `ListaDePaquetes`): el que
está puesto, el del binario y todos los bajados con su estado. Un paquete en
**`error`** es capgo **devolviéndolo** —hace rollback si el nuevo no llama a
`notifyAppReady()` a tiempo— y desde fuera eso se ve igual que una descarga que
nunca ocurrió. Va crudo y se toca para copiarlo, como el informe de
sincronización (§14.9-bis): resumirlo es lo que nos tenía a ciegas.

### 14.16-quinquies Cada encargo puede llevar su propio modelo

La clave es de la instalación —una credencial de pago, §14.16— pero **el modelo
no tiene por qué**. Ordenar una lista de ingredientes es traducción: sacar
«tres» de una frase no pide el modelo grande, y es además el botón que más se va
a pulsar. Proponer cinco platos que peguen con una paella, en cambio, sí.

- `configuracion` gana una clave por encargo, `ia.modelo:<id>`, hermana de
  `ia.encargo:<id>` y con el mismo filtro de nombres conocidos: sin él, un
  «modelo» llamado `clave` machacaría la credencial.
- El orden es **lo guardado → el de origen del encargo → el general**. Traen uno
  de origen «Ordenar una lista de ingredientes» y «Los recadillos del viaje»
  (`claude-haiku-4-5`: traducción y frases cortas) y «Mejorar la redacción de
  una idea» (`claude-sonnet-4-5`, fijado a propósito: contar con gracia sí pide
  criterio); los demás usan el de arriba.
- En Ajustes cada encargo lleva su desplegable con **«El de arriba»** como
  primera opción, que es lo de fábrica salvo que el encargo traiga otro puesto.
- La sustitución de un modelo retirado (§14.16-bis) se guarda **en la clave del
  encargo** y no en la general: si no, arreglar una lista con un haiku retirado
  cambiaría de paso el modelo de todo lo demás.

**Y el arreglo deja de corregir la ortografía.** El encargo pedía el nombre «con
la primera letra en mayúscula» y en singular o plural «según toque», así que
«azafran» salía «Azafrán» — cómodo hasta que te cambia el nombre raro que habías
escrito a propósito. Ahora se le dice que **no** corrija nada: saca la cantidad y
deja el nombre tal como está.

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
del viaje, que es donde está el calendario y donde ya se podía. Lo de organizar
—devolver un plan al catálogo— vive dentro del plan abierto y lo ven **los
adultos** (§14.43-bis; hasta entonces, solo quien administra). Cada plan queda en
una fila de **70,7 pt**: caben ocho, y los colores bajan a tres.

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

**El plan abierto se ve como una capa** ([`docs/diseño/plan-voto.html`](diseño/plan-voto.html)
· **P1 · F1+F4 · V2**). El papel de un modal era `--foam`, que es **el mismo
color** que el fondo de la app en las dos caras —`#0b1f2c` y `#f1f5f7`—:
contraste **1,0 : 1**, y lo único que separaba las dos capas era el velo. Peor:
las tarjetas de dentro son `--foam-2`, más claras que el modal que las contiene,
así que la jerarquía se leía al revés. Se arregla por tres vías a la vez, porque
ninguna aguanta sola las dos caras: **centrado** (la variante `.center` que ya
existía), **papel de tarjeta con borde y sombra** (`.modal.capa`) y **velo de
`.5` a `.68`**. Lo que arrastra: dentro de `.capa`, lo que era `--foam-2` baja
un escalón o se funde con el papel. Y lo que cuesta, medido: centrar sube los
chips de voto de 505,7 a 305,4 pt, **200,3 pt más lejos del pulgar**.

**Cada voto dice cuántos son**, en columna propia y con cifras tabulares. Es la
primera pregunta al abrir un plan —¿va ganando?— y se contesta de arriba abajo
sin leer un nombre; los nombres contestan la segunda, que es quién. El cero va
apagado: el número que importa es el que no lo es.

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
cuadrado con una «B» de marca de agua tan apagada que no se leía; pasó a ser el
mismo trazo que el resto, recoloreado con `--whale`.

**Y desde §14.37, la marca de dentro es el icono de fuera.** El trazo se retiró:
`WhaleLogo` sirve `public/icon-192.png` —el de 512 en la puerta, que mide 84 pt y
a 3× pide 252—, con la esquina redondeada al **22,37 %** del lado, la proporción
de iOS, para que se lea como la loseta que se toca en la pantalla de inicio.
Coherencia con los iconos de la interfaz a cambio de que tocaras un dibujo y se
abriera una app con otro; la cabecera es justo donde se comprueba que has abierto
lo que querías. Se paga en detalle: a 30 pt el chorro y la «B» no sobreviven y
queda la ballena sobre su fondo. Ya no hereda el color del tema, a propósito —un
icono de app no es un icono de interfaz—. `Icono` conserva el trazo `ballena`,
que sigue siendo el del acordeón de IA en Ajustes.

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

### 14.22 Mejoras: el roadmap de la app, apuntado desde el móvil

**El problema.** «Que la compra se pueda marcar por pasillos del súper» se dice
en una cena y a la semana no queda ni quién lo dijo. El roadmap de verdad vivía
en el «Pendiente (ideas)» de `CLAUDE.md`, un fichero del repositorio que el
grupo no lee ni puede tocar: el camino de una idea era el chat, la memoria o
nada. La figura que lo resuelve es el bloque **«Mejoras»** de `garciadoral-ops`,
y la decisión entera está en `docs/diseño/mejoras.html`
(**A1 · B1 · C2 · D2 · E1 · F2**).

**Qué es.** Ideas sobre la propia aplicación, que ven todos y cualquiera tacha.
**No se llaman «ideas»** a propósito: una idea aquí es una idea de plan
(`planIdeas`), y compartir el nombre obligaría a cada frase, cada test y cada
consulta a decir de cuál habla — la misma colisión que `garciadoral-ops` tenía
con las ideas de regalo. Y «roadmap» sería la única palabra inglesa de una
interfaz que es solo en español.

**Dónde vive (A1).** Un acordeón **«Mejoras»** en Ajustes, penúltimo y pegado a
«Actualizar»: las dos hablan de la app y no del viaje, y una mejora se apunta
menos veces que todo lo demás — Ajustes va «en el orden de lo que se toca». El
rótulo lleva **las que faltan** («3 sin hacer»), que se calcula en la pantalla y
no dentro del apartado: una mejora se marca sin cerrar la solapa y el número
tiene que moverse con ella. No hay atajo desde otras pantallas (B4 descartada):
un verbo de la herramienta entre los del viaje, y «+» en esta app significa un
gasto, una cena o un plan.

**Cómo se apunta (B1).** El renglón fijo de Ideas (§14.19-ter): un campo con su
✓, siempre puesto, que al guardar **no se cierra** — se vacía y se queda
enfocado, con la lista a la vista, que es lo que evita apuntar la que ya está.

**La fila (C2 · D2).** El **visto delante** —dibujo de 28 pt, toque de 44—
tacha; lo hecho **baja al final, tachado y legible**: una lista que se mira para
saber qué queda no debe empezar por lo que ya no queda, y dentro de cada mitad
mandan las más nuevas por `apuntadaEl`. **Deslizar** descubre Editar y Borrar
(el gesto de Gastos, §14.10-bis) y tocar el texto abre la mejora, para quien no
conoce el gesto. La firma es **la de Ideas**: nombre + alias de su familia en
pastilla de su color (`components/Alias.jsx`) + cuándo en palabras
(`lib/hace.js`). Cero piezas nuevas y las dos listas que dicen «quién apuntó
esto» se leen igual.

**Quién puede qué (E1).** Cualquiera todo, como con los gastos y las cenas. Lo
único que protege el quitar es la pregunta, que dice a quién afecta —«Se va de
la lista de todo el grupo»—, y **el verbo Borrar del deslizado no borra**: abre
la misma hoja con la pregunta ya puesta, para que ningún camino se la salte.
Quitar es `borrado = 1` en el servidor, no una destrucción. Y `hecho` va **sin
quién ni cuándo**: eso sería un registro de trabajo y esto es una lista de la
compra.

**La fontanería.** Tabla `mejoras` sincronizada por la cola de siempre
—`escribir()`, sin ruta propia de escritura—, con `texto`, `hecho`, `autorId`
(persona, como `planIdeas.creadaPor`), `apuntadaEl` (la escribe el cliente,
§14.19-ter) y `eventId` solo para el Demo (§14.9-quater): `meeting-ops-air` las
hizo primero en `localStorage` y lo deshizo, porque sobre una idea de la app se
actúa en otra máquina. **Tope de 2000 caracteres**, cortado en el móvil
(`TOPE_DE_MEJORA` en `db.js`) y rechazado en el Worker (`repositorio.js`) con
motivo que vuelve en la lista de pasos: sin él, un pegado largo entra en la
instantánea del grupo entero para siempre. Migración `0010_mejoras.sql`
(`npm run migrar:remoto10`), `version(7)` en Dexie.

**Cómo llega a donde se actúa (F2).** La pregunta que `garciadoral-ops` dejó
abierta —su transporte era una persona— aquí se cierra porque el Worker tiene la
lista: **`GET /api/mejoras`**, autenticada con el `TOKEN_SERVICIO` que ya usa la
siembra, devuelve las pendientes del grupo de verdad con el autor en palabras
(el nombre se resuelve en el Worker: al otro lado no hay tabla de personas). La
sesión de Claude que abre un encargo las lee al empezar —la regla está en
`CLAUDE.md`— y lo apuntado en el camping aparece solo donde se decide qué se
hace. Lo hecho y lo del Demo no salen: lo uno ya no es trabajo, lo otro es
arena.

### 14.23 Poner la base al día desde Ajustes, cuando va por detrás del código

**El problema.** La API se despliega sola al entrar en `main`, pero **las
migraciones no las lanza nadie por ti**, a propósito — y el día que se mergea
una tabla nueva con el móvil en la mano, el Worker nuevo llega antes que la
migración y `/api/sync` falla hasta que alguien encuentra un portátil con
`wrangler`. Pasó con la `0010` (las mejoras) el mismo día que se estrenó.

**La solución.** Las migraciones siguen sin lanzarse solas —van cuando alguien
las pide—, pero el camino cabe en el móvil: si administras y la base va por
detrás, **Ajustes → Actualizar** dice cuántas migraciones le faltan y con qué
nombre, y un botón —**«Poner la base al día»**— las aplica **una a una**,
contando el progreso en su sitio con la lista de pasos (la figura de
Sincronización). El fallo, si lo hay, se queda en su renglón con la sentencia y
el estado HTTP, y **se toca para copiarlo** (§14.9-bis). Quien no administra, o
una instalación sin API, no ve nada.

**Cómo sabe qué falta.** No hay tabla de contabilidad de migraciones: la base
ya existía con nueve aplicadas a mano y ninguna apuntada, y una contabilidad
que nace mintiendo hay que sembrarla. En su lugar el Worker mira **el esquema
de verdad**: todas las sentencias de `migraciones/` son de tres formas —`CREATE
TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y `ALTER TABLE … ADD
COLUMN`— y las tres declaran qué crean, así que «¿está aplicada?» es «¿existe
su tabla, su índice o su columna?» (`api/src/migrador.js`). Aplicar también va
sentencia a sentencia y **salta las que ya están**: una base a medio migrar se
termina en vez de atascarse en el «duplicate column name». Un test convierte
cualquier forma nueva de sentencia en un fallo de la suite: una migración con
`UPDATE` no se puede decidir mirando el esquema, y ese día se decide en el
código, no se descubre en producción.

**Por dónde viaja el SQL.** Dentro del Worker: `api/src/migraciones.js` es una
copia generada de `migraciones/*.sql` (`npm run generar:migraciones`), porque
`wrangler` sabría empaquetar los `.sql` pero `node --test` no sabe importarlos.
El riesgo de un fichero generado —quedarse viejo— lo vigila la suite, que lo
compara con el directorio fichero a fichero. **Del móvil no llega ninguna
sentencia**: llega «aplica la siguiente» (`POST /api/migraciones`), reservado a
administradores como la IA, y el POST aplica **una** y devuelve lo que queda,
para que el progreso que se pinta sea el de verdad y no un rótulo delante de
una petición larga. Y las dos rutas funcionan con la base por detrás —no tocan
las tablas del grupo—, que es exactamente cuándo hacen falta.

### 14.24 El editor de una idea: centrado, sin teclado encima, y con «Mejorarla»

Dos vueltas del mismo editor (`ModalIdea` en `IdeasScreen.jsx`), y las dos
valen también para la hoja de una mejora, que es su hermana.

**Centrado y sin robar el foco.** El editor abría como hoja pegada abajo y con
el foco puesto en «Qué es»: el teclado salía solo y, entre él y el modal, había
que hacer scroll para llegar a Guardar y Borrar. Se abre a **leer** —la firma,
el contador, los verbos— tanto como a escribir, así que el foco ya no se roba
(el teclado no sale hasta tocar un campo) y, sin teclado que lo pelee, el modal
va **centrado** (`modal-bg center`), que se lee mejor que pegado a ningún
borde. Hubo una versión intermedia pegada arriba (`arriba`): era el remedio
para el teclado, y al quitar el foco automático el remedio sobró.

**«Mejorarla» (IA).** La figura de «Arreglar» del editor de receta
(§14.20-bis), aplicada a una idea: un botón que manda el título, la
descripción y el enlace **tal como están** y recibe la misma idea mejor
contada **y con gracia** — título corto y concreto, descripción de una a tres
frases con lo práctico rematada con **una coña ligera**, de las de sobremesa.
El humor va en la forma, nunca en los datos: **sin inventar sitios, precios ni
horarios que no estén**, una sola coña y que salga del propio plan — una que no
aterriza es peor que ninguna, y por eso el encargo trae **Sonnet fijado**
(§14.16-quinquies): contar con gracia sí pide criterio, y este botón se pulsa
poco. Lo que vuelve **no se guarda**:
rellena los campos, hay «deshacer» mientras no se guarde, y tocar un campo a
mano retira el deshacer, porque lo escrito ya es tuyo y no del modelo. El
encargo es `mejorarIdea` (`api/src/idea.js`, reescribible desde Ajustes →
IA como los demás, §14.16-quater), la ruta `POST /api/idea/mejorar` sale del
Worker como todas (la clave no viaja, §14.16) y **los nombres de la gente no
viajan**: para pulir «playa cala sur llevar sombrilla» no hacen falta. El
botón no aparece donde nunca va a funcionar (web, sin clave), como el resto de
botones de IA (§14.20-ter).

---

### 14.25 Que se note que es verano: el sol de la cabecera y los recados

Decidido en `docs/diseño/verano.html` (**A4 · B2 · C2+C4 · D2+D3**), una hoja con
cinco partes y diecinueve opciones. El encargo eran dos cosas de cariño y ninguna
arregla nada — que es exactamente el motivo por el que había que medir lo que
cuestan antes de ponerlas: una app que va a un camping con nueve personas dentro
puede permitirse ser simpática, pero no que la simpatía se coma la pantalla.

**Antes de las opciones, dos arreglos que no se votaron.** Los tres emoji grandes
—`.empty .e` a 42 px, la cara del perfil a 28 y la ballena del modal a 52— iban en
píxeles a pelo, fuera de `--escala`: el cuerpo va de 17,0 pt en Normal a 21,4 en
Enorme y ellos se quedaban clavados en las tres tallas (`estilos.test.js` no los
veía porque persigue los `style={{…}}` del JSX, no el CSS). Y
`prefers-reduced-motion` era una lista de tres selectores escritos a mano en vez de
una regla de barrido: con esa forma, cada cosa nueva que se moviera había que
acordarse de apuntarla. Los dos van en `theme.css`.

**A4 · La línea del horizonte.** Una franja de **3 pt** —el 0,4 % del cuerpo—
pegada bajo la cabecera, que se llena de amanecer a anochecer con el astro de 9 pt
como tirador (`components/LineaDelHorizonte.jsx`). No es decoración con forma de
sol: es el día dibujado como una barra, y de un vistazo dice cuánta luz queda, que
en un camping es una pregunta de verdad. Se descartó el **arco** que cruza la
cabecera (A1) porque el disco pasa **7 h 29 al día por detrás del título** —el sol
avanza 25,2 pt a la hora sobre los 358 que da un iPhone de 390— y el **cielo
literal** (A6) porque al mediodía deja el título en **1,26 : 1** y al ocaso no hay
tinta que llegue a 4,5 : 1 con ninguna de las dos caras.

Tres detalles que se descubrieron dibujándola: el surco **no** puede ser del color
de la cabecera —siéndolo, lo que falta por recorrer no se ve y la franja queda en
un lunar suelto—; el disco viaja **de su propio radio al ancho menos su radio**,
porque al amanecer exacto se salía media luna por el borde; y **no se anima, salta**
cada minuto: a 0,4 pt por minuto, interpolar sería gastar batería para mover menos
de medio punto.

**A2 · Y el cielo, que se añadió después de verlo fallar.** La hoja daba A4 + A2
como la combinación buena y la primera vuelta se quedó solo con A4. Fue un error
de lectura, y se vio en cuanto estuvo puesto: la franja **se llena desde el
amanecer**, así que a las **08:07** de un 4 de agosto son **27,3 pt de 390** —el
7 %— de naranja en la esquina izquierda, y los otros 363 son surco. Bajo una
cabecera negra eso se lee como el borde de la cabecera. A la hora a la que se abre
la app por la mañana no había nada que ver.

El cielo no tiene ese problema porque **no se llena, cambia**: a cualquier hora
ocupa los 390 × 78,8 pt enteros. `--appbar-bg` pasa a ser siete tonos
interpolados por la hora (`lib/cielo.js`), con el azul de siempre de reserva —sin
JavaScript, o en la pantalla de eventos donde la franja no se monta, la cabecera
es la de toda la vida—. Los tonos son **hondos a propósito**: la tinta es
`#e6eef3` fija, el cielo literal de agosto (A6) la deja en 1,26 : 1 al mediodía, y
estos mantienen el peor de la serie en **7,54 : 1**. Hay un test que lo comprueba
**minuto a minuto de las 24 horas** contra las horas de sol reales, en agosto y en
diciembre. La transición es de 1,2 s y entre un minuto y el siguiente el color
cambia como mucho dos cifras de 255: no se ve cambiar, se ve que a media tarde ya
no es el de por la mañana.

De paso la franja engordó de 3 a **4 pt** y el disco de 9 a **14**, y el surco
dejó de ser el color de la cabecera aclarado —que con el cielo encima ya no valía—
para ser un blanco al 26 %, que se lee sobre cualquiera de los siete tonos.

Y la franja pasó a `z-index: 7`, **por encima de la cabecera**, que va a 5. El
disco sobresale 5 pt hacia arriba para quedar centrado en el surco, y con la
franja por debajo la cabecera le pintaba encima ese trozo: se veía medio sol
asomando. Es un solapamiento de pintura y no de sitio —la franja sigue siendo
`flex: none` y no tapa nada, §14.10—, así que subirla no le quita espacio a nadie.

**B2 · La hora del sol se calcula** (`lib/sol.js`): día juliano, anomalía media,
declinación y ángulo horario en unas cuarenta líneas puras, sin red y sin
dependencias, comprobadas contra tres fechas conocidas. Las alternativas se caían
solas: dos constantes de verano (B1) mienten **3 h 28** en el ocaso de un puente de
enero, y cuatro tramos de reloj (B3) no dan el continuo que la franja necesita. La
latitud va escrita a mano (40,4 N) y no sale del `lugar` del evento, que pediría
geocodificar: 500 km al norte o al sur mueven el ocaso unos 20 minutos en agosto,
menos de un punto de franja.

**C2 + C4 · Los recados viven donde no cuestan nada.** Al final del *scroll*
—donde ya vive la versión— y dentro de las pantallas vacías, que en un camping se
ven todo el rato porque el primer día no hay ni gastos ni cenas ni planes. Los dos
sitios cuestan **0 pt permanentes**. El **renglón fijo sobre la barra** (C1) se
descartó midiéndolo: entre **42,6 y 60,5 pt** del cuerpo según lo larga que sea la
frase —el ancho útil son 329,2 pt, o sea 37 letras— y **66,2 en Enorme**, o sea que
quien peor ve pagaba más por la broma. En los vacíos la broma va **además** de la
instrucción, nunca en su lugar: «Ponlas en Ajustes → Evento» dice por dónde se
sigue y una frase que lo sustituya deja a alguien colgado.

**D3 · Las frases con datos no se repiten porque los datos cambian**
(`lib/recados.js`, puro y testeado). No son frases: son plantillas con un número
dentro, sacadas de lo que ya está apuntado, y no dan risa por ser ingeniosas sino
**por ser verdad**. Dos reglas de oficio: **cada una lleva su guarda** —sin ella un
evento recién creado saluda con «0,00 € apuntados», que se lee como que la app
cuenta mal— y **no se señala a nadie**, ni a una persona ni a una familia: se habla
en plural o de números, porque «lleváis cuatro días sin apuntar nada» tiene gracia
y con un nombre delante la pierde el día que alguien lo lea torcido.

**D2 · La tanda de la IA, y por qué cuesta céntimos** (`api/src/recados.js`,
`lib/tanda.js`). Se piden **doce de una vez**, porque lo caro de la llamada no es
el texto sino contarle el contexto al modelo: doce frases son unas 350 fichas de
salida contra 60 de dos, así que el número no lo decide el dinero —lo decide que a
partir de quince el modelo se repite—. Con haiku, una tanda sale por unas **0,25
décimas de céntimo**, y a seis u ocho tandas al día son **dos o tres céntimos
diarios**, unos veinte por un viaje de siete días.

**La ventana de dos horas se cumple dos veces, y las dos hacen falta.** La del
Worker evita la llamada al modelo: el primero que pregunta pasadas las dos horas la
paga y los otros ocho teléfonos se llevan la misma tanda de la base —sin eso serían
nueve llamadas por ventana y, peor en un grupo, nueve bromas distintas a la vez—.
La del móvil evita la petición: se mira al abrir, al volver del fondo y **cada cinco
minutos**, y un latido corto con una ventana larga es lo que hace que valga igual
con la app abierta toda la tarde que abriéndola una vez al día. **La hora se apunta
aunque la respuesta venga vacía**: sin eso, una instalación sin clave de IA
preguntaría cada cinco minutos para siempre.

Y las dos fuentes se mezclan en **una sola bolsa** de la que se saca una al azar
(`bolsaDeRecados`): las de datos son pocas y condicionales —de cero a cinco— y la
tanda es una docena, así que los números de verdad salen una de cada cuatro o cinco
veces, que es la proporción que hace que sorprendan. **Sin nada que decir no se
pinta nada**: un hueco con un emoji de relleno es peor que el silencio.

**Dos detalles de fontanería que costaron un rato.** La tanda se guarda en
`localStorage` y **no** en Dexie —es una copia de algo que el servidor ya tiene, no
un hecho del grupo, y en la cola de cambios no pinta nada—, pero hay que
llevársela en `olvidarTodo()` o el siguiente que entre en ese móvil lee las bromas
del viaje del anterior. Y `lib/tanda.js` trae el transporte con un `import()`
**dentro** de la función: con el `import` de arriba, `db.js` acababa arrastrando
`sync/api.js` —y con él la configuración y la sesión— a la capa de datos.

### 14.26 Apuntar un gasto en la puerta del súper: sin teclado, y con la cuenta hecha

Decidido en `docs/diseño/gasto-nuevo.html` (**A1 · B3 con el subtítulo de B2 · C1 ·
D2 · E2**), una hoja con cinco partes y veintiuna opciones.

**El problema, medido.** La ficha de un gasto medía **830,6 pt** en un teléfono de
844, salía como hoja desde abajo y abría el teclado alfabético sola (`autoFocus` en
Descripción). Con el teclado puesto quedaban **508 pt** de ventana: se veía el
**61 %** y había que hacer *scroll* dentro de un modal para llegar a Guardar. Y lo
que se viene a hacer ahí —apuntar «24,30 de hielo y birras» con el carro en la
mano— son **dos datos**: cuánto y de qué.

**Los cinco arreglos que no se eligieron**, porque lo que está mal se arregla y se
cuenta, no se somete a votación: se fue el `autoFocus`; la moneda y el tipo de
cambio salieron del camino normal a Detalles —91,7 pt fijos y 76,4 más cuando
difiere, para un caso que en un camping de Girona no pasa—; el pagador por defecto
dejó de ser `families[0]` y pasa a ser **tu familia** (`lib/identidad.js`); el botón
de guardar dejó de hacer `return` en silencio y **se apaga diciendo por qué**; y el
«solo mayores 🍷» perdió la copa, que era un emoji del cromo de los que se fueron
en §14.13 y que sobrevivió dentro de un `label`.

**A1 · El importe se teclea en un pad propio, y suma.** Cuatro columnas de teclas
de **76 × 48** con `+ − ⌫ =` en la de la derecha, la operación en curso en una
cinta y el total **en vivo** en la cifra grande. Un pad de tres columnas (A2) da
teclas de 104 y es mejor pad sin discusión, pero cuesta una fila de 48 más su hueco
y esos **56 pt no existen**: la ficha se iría a 689,6 sobre un tope de 658, o sea a
hacer *scroll* justo para llegar a Guardar, que es el defecto que se venía a
arreglar. Con A1 la ficha real mide **603,6 pt** en Grande y **651 en Enorme**,
medidas en el navegador contra `theme.css` — cabe sin *scroll* en las dos tallas
porque **el alto de la tecla cuelga de `--escala`** como todo lo demás.

Se descartó el teclado del sistema con una barra de operadores (A5), que era lo
mínimo que había que hacer: el numérico de iOS son 260 pt y 336 si alguien toca
Descripción, así que en cuanto tocas una categoría el teclado se va, la ficha salta
260 pt y vuelve a saltar al volver al importe. Y los operadores irían en la barra
accesoria que dibuja iOS, que no se puede tematizar ni medir.

**Se teclea como una caja registradora**, y esto cambió respecto al dibujo: los
dígitos entran por la derecha, `2·4·3·0` son 24,30 € y **el pad no lleva coma**,
porque en registradora no significaría nada. Donde la hoja dibujaba la coma va
**`C`**, que borra la operación entera — `⌫` borra un dígito, y con dos sumandos mal
puestos eso eran ocho toques. Registradora es además lo que quita la duda de si
«148» son ciento cuarenta y ocho euros o un euro con cuarenta y ocho. Toda la
aritmética vive en `lib/importe.js`, pura y con su test: entra un estado, una tecla,
sale un estado.

**B3 + el subtítulo de B2 · Qué identifica una fila cuando no hay descripción.** La
descripción si la hay, y si no la categoría —`e.description?.trim() || catOf(…).label`—.
Debajo, quién pagó y, **cuando el reparto no fue el de todos, cuál**: «sin los
niños», que es información que hoy no se veía en ningún sitio sin abrir el gasto.
La hora solo cuando no hay descripción, que es cuando hace falta desempatar:
«Pagó Solteros · sin los niños» ya son 238 pt de los 245 que caben. **No hay
migración** — los gastos con nombre propio siguen exactamente igual, que es lo que
se le perdió a B1 («la categoría manda siempre»).

**C1 · «Paga» y «Entre», dos renglones con el valor puesto.** 98,5 pt frente a los
205,3 que gastaban un `select` y seis pastillas, y cada uno se toca para abrir su
hoja — la figura de `GrupoSection`, que ya está construida. Se descartó no enseñar
nada (C4): un valor por defecto invisible **se lee como que no hay valor**, y el día
que alguien pague con la tarjeta de otra familia el gasto se guarda mal y nadie lo
ve hasta Saldos.

**D2 · Detalles es una capa entera, no un acordeón.** Ahí viven la descripción, la
fecha, la moneda y el reparto fino, y ahí **sí** sale el teclado del sistema, que es
lo suyo cuando se escribe una palabra sentado. La ficha rápida **mide siempre lo
mismo**, se abra o no Detalles, y eso es lo que permite aprender dónde cae cada
tecla sin mirar; con acordeón (D1) pasaría de 603,6 a 1.229,7 pt y el pad se iría de
la vista mientras escribes.

**E2 · Un campo `reparto` con tres modos, y los importes en céntimos.** Es la única
parte que toca la base: columna `reparto` en `expenses` (JSON, migración
`0012_reparto_del_gasto.sql`, se aplica desde Ajustes → Actualizar, §14.23).

```
reparto: null                                                  ← por pesos, lo de siempre
reparto: { modo: 'partes',   porFamilia: { garcia: 2, perez: 1 } }
reparto: { modo: 'importes', porFamilia: { garcia: 1040, perez: 350 } }
```

**Nulo es un valor con sentido**, no un hueco: significa «por pesos», así que los
gastos ya apuntados no hay que tocarlos y un cliente viejo sigue leyéndolos y
sacando la cuenta de antes. Los tres modos pasan por `splitCents()` —el mismo
método del resto mayor que ya repartía por pesos—, así que **no se pierde ni se
inventa un céntimo** y no hay código nuevo de aritmética; en modo `importes`,
cuando los números guardados cuadran con el total, `splitCents` devuelve
exactamente lo escrito, y cuando no —un gasto corregido después de repartirlo— la
diferencia se reparte en proporción en vez de descuadrar los saldos. En la pantalla,
**el último renglón lleva lo que falte** y ninguno de los otros puede pasarse del
total: no hay forma de guardar un gasto descuadrado. Se descartaron los porcentajes
(E3) porque **cuestan el céntimo**: 42,8 % de 24,30 € son 10,4004 €, hay que
redondear en cada lectura y dos móviles con el mismo hecho podrían pintar saldos
distintos, que es justo lo que la regla de oro prohíbe.

**Los cinco tonos de categoría subieron de saturación.** No estaba en la hoja: se
vio al dibujar la ficha, que es el primer sitio donde **se ven los cinco juntos en
una rejilla**. Los de antes eran el mismo tono apagado con la temperatura movida
—«varios» era gris de oficina— y en fila eso no se lee como una paleta sino como una
avería. Ahora son cinco colores de verdad y uno es morado, que era el único hueco
libre entre el azul del acento y el rojo y el verde de los saldos; el trazo contra su
propio fondo va de **4,57 a 5,56 : 1** en la cara clara y de **5,89 a 8,49 : 1** en la
oscura, medido. Y llevan su tono **siempre puesto**, no solo la casilla elegida:
cinco casillas grises con una azul son un formulario, y esto es lo único de la app
con color propio porque **informa** (§14.13).

**Lo que arrastró la vuelta.** `ExpensesScreen.jsx` se quedó con la lista y salieron
`screens/FichaDeGasto.jsx` (la ficha rápida, la hoja de «Entre» y Detalles),
`components/PadDeImporte.jsx`, `lib/importe.js` y `lib/categorias.js` —las cinco
categorías las miran cuatro sitios y ninguno debería importar una pantalla entera
para saber cómo se llama «bebida»—. Y las familias de la ficha se ordenan ahora
**por nombre**: Dexie las devolvía en el orden en que caen los ids, o sea al azar, y
con el reparto por importes eso importa, porque la última es la que lleva lo que
falte.

### 14.26-bis Una capa que se ve como capa, en todos los modales

Decidido en `docs/diseño/gasto-entre.html` (**parte seis, F3**), junto con §14.27,
porque son el mismo problema visto dos veces: la hoja de «Entre» se veía fea en
parte porque no se veía **dónde acababa**.

**El fallo, medido.** El papel de un modal era `--foam`, que es también
`--app-bg`: **1,00 : 1** sin velo, y con el velo de entonces —`rgba(4,18,26,.5)`—
**1,06 : 1** en la cara oscura. Lo único que separaba las dos capas era una sombra
que no existía. Ya se había arreglado en §14.19 para el modal de votar un plan,
con una clase `.capa` que había que **acordarse de poner** — y once modales
después seguía sin ponerse en ninguno.

**Por qué el velo no vale de palanca.** Es el dato que decide la parte: subirlo de
`.50` a `.78` lleva el papel de **1,06 a 1,10 : 1** en la cara oscura. Cuatro
centésimas por tapar el fondo casi del todo, porque el fondo ya es `#0b1f2c` y el
velo `#041219`: oscurecer lo que ya es casi negro no lo aleja de nada. En la cara
clara sí funciona —de 3,48 a 6,36— y por eso el fallo se veía en un móvil en
oscuro y no en el portátil de al lado.

**Las tres palancas a la vez**, que es lo que ya decía `plan-voto.html` y aquí se
cumple entero: papel propio (`--papel-capa`, `#1a3d4f` en oscuro y blanco en
clara → **1,60 : 1** contra el fondo velado), **canto de 1,5 pt** un punto por
encima de la línea normal (`--linea-capa`, **3,12 : 1**, que es el que de verdad
dibuja el borde) y el velo a `.68`, que es lo que hace trabajar a la cara clara
(**6,98 : 1**).

**Sube al `.modal` de todos y no a una clase.** La hoja lo planteaba para la ficha
de gasto y sus hojas; al ponerlo se vio que el fallo lo tenían los once modales y
que dos papeles distintos habrían sido peor que uno malo. Con eso, `.capa` y
`velo-fuerte` se quedaron sin nada que añadir y **salieron del marcado**.

**Lo que arrastra, y es lo interesante.** Dentro de una capa, lo que era
`--foam-2` se fundiría con el papel —en la cara clara serían el mismo blanco—, así
que baja un escalón **redefiniendo la variable en `.modal`** y no regla a regla:
con lo segundo, cada cosa nueva que se metiera en un modal habría que acordarse de
apuntarla, que es exactamente el error que se está arreglando. De rebote, una fila
de persona sangrada quedaba **del mismo color que la lista** que la contiene y hubo
que teñirla hacia el papel.

**La guardia va en el CSS y no en el marcado** (`src/estilos.test.js`): que
`.modal` no use `var(--foam)` de papel, que lleve canto y sombra, y que las cuatro
caras declaren los dos tokens. Un test que comprobara «este modal tiene la clase
`capa`» habría pasado en verde los once modales sin ella.

### 14.27 Entre quién se divide: cuatro atajos, las familias, y salir sin guardar

Decidido en `docs/diseño/gasto-entre.html` (**A3 · B2 · C2 con el renglón de C4 ·
D2 + D4 · E2**), una hoja con seis partes y veintiséis opciones.

**El problema, medido.** La hoja eran dos chips y **los nueve nombres del grupo
puestos uno detrás de otro**: **711,3 pt** en un teléfono de 844 —el **84 %**—, de
los que **434 eran nombres**. Sin familias, sin buscar, y con doce personas se
pasaba de los 776,5 pt de tope y empezaba a hacer *scroll* dentro de la hoja.

**Los cuatro arreglos que no se eligieron.** (1) **Tocar el fondo guardaba**:
`HojaDeEntre` llamaba a `onCambio` en cada toque, así que escribía en la ficha y al
cerrarse ya estaba hecho — no faltaba un botón de Cancelar, faltaba un **borrador**
que cancelar, y sin él la parte cinco no se podía construir. (2) Ni la ficha ni sus
hojas llevaban `.capa` (§14.26-bis). (3) **«Solo mayores» no tenía contrario** —ni
atajo para los peques, que es la merienda de la playa, ni forma de vaciar la lista,
así que marcar a dos personas sueltas eran siete toques de quitar y dos de poner—.
(4) La nota del peso ocupaba **69,5 pt permanentes** para una regla que no cambia
nunca y que desde §14.26 ya no siempre se aplica: baja a un renglón de apunte.

**A3 · Tres niveles, y solo dos desplegados.** Los cuatro atajos y las familias con
su recuento; la gente sale **de dentro de su familia**, sangrada, así que una
persona no aparece nunca huérfana. Medido sobre el componente real: **389,6 pt**
cerrada y **421,6 en «Enorme»**, contra 711,3 — y **no crece** aunque el grupo pase
de nueve personas a quince, porque las familias siguen siendo tres. Con una abierta
son 533,6 y sigue sin *scroll*. Se descartó desplegarlo todo (A1): con las nueve
personas son **876,8 pt**, o sea **más que antes**, que es el encargo al revés.

**B2 · Un segmentado y no cuatro pastillas.** Aquí la medida cambió la
recomendación: las cuatro palabras como chips suman **384,7 pt de los 356** que hay,
así que **doblan a dos filas ya en la talla de fábrica** —no en «Enorme»— y el
bloque pasa de 50,3 a 96,7. En columnas miden lo mismo en las tres tallas y de paso
dicen que son excluyentes, que un chip encendido no dice. **«Nadie» no es un estado
como los otros tres** —un gasto sin nadie no se puede guardar— y va ahí igualmente
porque es lo que hace baratos los repartos raros: vaciar y marcar dos.

**C2 con el renglón de C4 · Dos verbos en una fila de 48.** La casilla marca —con
**44 × 44 pt** de toque alrededor de un dibujo de 24, la regla del visto de
§14.22— y el cuerpo de la fila abre. El objetivo pequeño es el que marca y el
grande el que abre, porque abrir sin querer no cambia nada y marcar sin querer sí.
Los **tres estados se dibujan** —lleno, **raya**, vacío—, que es lo que hace que
«2 de 3» no haya que leerlo; y el renglón dice **quién** está dentro mientras quepa
(26 caracteres) y «n de m» cuando no. Una familia a medias **se completa** al
tocarla, que es lo que se quiere el 100 % de las veces.

**D2 + D4 · El buscador detrás de una lupa.** Comparte renglón con el rótulo
«Familias», así que no cuesta ni un punto propio mientras no se usa —el 95 % del
tiempo—, y al escribir las familias se retiran y salen las personas que coinciden,
con su familia al lado para desambiguar dos Anas. Sin tildes y sin mayúsculas, y
buscando también por el apodo. Aquí el `autoFocus` **sí** se pide: has tocado la
lupa para escribir, que es lo contrario del que se quitó de la ficha en §14.26.

**E2 · Los dos verbos arriba** —«Cancelar» a la izquierda, «Entre» en medio y
«Listo» a la derecha, en un renglón de 44 pt que sustituye al título: 61,9 pt menos
que dos botones abajo—. **Duró una versión y se cambió por E1** (§14.27-bis). El
fondo y el deslizar siguen haciendo **lo mismo que «Cancelar»**, no lo contrario —
si el gesto más fácil hiciera lo opuesto al botón más visible, el botón sobraría.

**Lo que arrastró.** `screens/HojaDeEntre.jsx` nuevo con el borrador dentro;
`lib/reparto-gente.js` puro y testeado con los atajos, el agrupado por familia, los
tres estados, el renglón y el buscador —y ahí baja `comoSeReparte`, que lo miraban
dos pantallas—; `components/Hoja.jsx` gana la cabecera de dos verbos; y el icono de
la lupa entra en la tabla de `Icono.jsx`.

### 14.27-bis Lo que dijo el móvil, que no lo decía la hoja

Siete correcciones de la primera pasada de §14.26 y §14.27, todas de haberlo tenido
delante. Ninguna es de gusto y ninguna se votó: cinco eran fallos y dos, la app
contradiciéndose a sí misma.

**Un gasto se corrige tocándolo.** Corregir estaba **detrás de un gesto**: había que
deslizar la fila para descubrir «Editar». Y corregir es lo que se hace la mitad de
las veces que se abre un gasto —un 24,60 que eran 26,40—, así que el camino normal
no puede ser el escondido. Ahora la fila es un botón y abre **la misma pantalla con
la que se apuntó**. «Editar» se retiró del gesto: dos caminos a la misma pantalla,
uno de ellos oculto, es la figura del «+ Plan» de §14.19. Queda «Borrar», y el
cajón se estrecha de 152 a 76 pt.

**Los dos verbos vuelven abajo, y el modal se centra** (E1 en vez de E2). La
cabecera de dos verbos era el patrón de hoja modal de iOS y ahorraba 61,9 pt
medidos — y era **el único sitio de la app que confirmaba arriba**. Todas las demás
pantallas confirman abajo y en azul, así que esos 61 pt costaban más de lo que
valían: una app que hace lo mismo de dos formas obliga a mirar antes de tocar.
«Entre» pasa además de hoja pegada al borde a **modal centrado**, como la ficha de
la que sale. El prop `acciones` de `components/Hoja.jsx` se retiró con ella.

**«Detalles» baja al final del formulario.** Estaba arriba, a la izquierda del
aspa, donde era cromo **delante de la cifra** — lo primero que se lee en una
pantalla cuyo título es el importe. Ahora es el tercer renglón de la caja, hermano
de «Paga» y «Entre»: los tres abren su pantalla, los tres dicen lo que llevan
dentro, y van en el orden en que se rellenan. El renglón enseña la descripción si
la hay y, si no, qué se va a encontrar.

**El modal no cambia de tamaño: cuando no cabe, hace scroll.** Es lo que hace que
se pueda aprender dónde cae cada tecla sin mirar, y lo que la ficha ya prometía en
§14.26 respecto a abrir Detalles. Con el renglón nuevo la ficha mide **649,8 pt** en
«Grande» sobre un tope de 658,3, y en «Enorme» toca el tope y **hace scroll dentro**
en vez de crecer. La hoja de «Entre» centrada, lo mismo: 597,8 y 616,2 con una
familia abierta.

**El campo «Cuándo» se veía en blanco.** `input[type=datetime-local]` no estaba en
la lista de campos vestidos de `theme.css`, así que heredaba `color: inherit`
—tinta clara— y se quedaba con el `Field` **blanco** del navegador: texto claro
sobre fondo blanco, o sea nada. De paso traía su propio ancho (287 pt de los 356) y
un borde de 2. Es la **tercera vez** que muerde lo mismo —`password` salió con el
borde cuadrado, `url` se pintó blanco— y las tres se vieron en el móvil y ninguna en
los tests. Ahora hay una guardia en `src/estilos.test.js` que **saca los tipos de
`input` del propio JSX** y comprueba que todos estén en la regla; comprobada
quitando `datetime-local` a mano, falla nombrándolo.

**Es un coeficiente, no un peso.** Lo que multiplica a lo que a cada uno le toca —1
el mayor, 0,6 el niño— es un coeficiente; un peso es otra cosa, y encima en una app
donde se habla de comida se lee mal. Cambia la palabra en la pantalla —el chip pasa
de «Peso» a «Coeficiente» y las dos notas lo dicen— y **no el campo**
`pesoReparto`, que es de la persona y lo miran Grupo, Cenas y el motor de reparto.
El identificador interno del modo se queda en `'pesos'` por la misma razón: no se
guarda nunca —el reparto de siempre es `reparto: null`— pero está escrito en la
migración `0012`, que ya está aplicada.

### 14.28 El mapa del repositorio, compuesto leyendo el código

Abrir una sesión aquí exigía estudiarse la aplicación entera para saber dónde
mirar. Y cualquier resumen escrito a mano se desfasa en silencio: el árbol de
módulos de `CLAUDE.md` ya se había quedado sin cuatro pantallas y seguía diciendo
que el acceso con Apple funciona en web.

**Se escribió en julio, en la PR #28, y se quedó sin fusionar.** Diez meses y 62
commits después, la rama tenía nueve ficheros en conflicto y dos de los que
tocaba —`UpdateModal.jsx` y `skins.js`— ya no existen. Antes de rehacerla se hizo
la prueba que en julio no se podía hacer: coger el generador tal cual y ponerlo
contra el código de hoy. **Funcionó sin tocarle una línea** — leyó las 12 rutas
del Worker, los 71 ficheros de test, `mejoras`, `planIdeas` y los recados, nada de
lo cual existía cuando se escribió. Eso es lo que decidió rehacerla en vez de
tirarla: la parte cara estaba probada.

**Las tres capas.** (1) `herramientas/mapa.mjs` + `escaner.mjs`, determinista, sin
IA y **sin dependencias** —se ejecuta al arrancar la sesión y en cada empujón, así
que no puede depender de un `install`—. (2) El hook `SessionStart`, que lo corre
con `--contexto` e inyecta el resultado más el estado vivo de git; **no escribe
nada en el árbol de trabajo** y si falla la sesión arranca igual con un aviso.
(3) `docs/mapa.md` versionado, con un trabajo de CI que corre `--verificar`: un
commit no puede dejar el mapa desfasado sin que salte.

Lo que hace que se mantenga solo es que **el hook no lee `docs/mapa.md`**: lo
genera en ese instante a partir del código que hay delante. Un resumen guardado se
desfasa en silencio; este no puede.

**Sin AST, y con una prueba que lo justifica.** Ni Node ni Python traen un
analizador de JavaScript en su biblioteca estándar, así que sin dependencias no
hay AST. `escaner.mjs` es un autómata sobre la gramática léxica —comentarios, las
tres clases de cadena, literales de expresión regular, `${}` anidados—. Para no
pedir que se confíe en eso, **una prueba importa de verdad los módulos y compara
las exportaciones que Node ve con las que el escáner deduce del texto**.

**Los desfases son la mitad del valor.** Donde un hecho está declarado dos veces,
el mapa contrasta las dos. Al ponerlo contra `main` salieron doce, y filtrarlos
uno a uno es lo que dejó el trabajo de esta vuelta:

- **`otaManifiesto` estaba en `config.json` y no lo leía nadie.** La URL del
  manifiesto OTA seguía a fuego en `native.js` mientras `CLAUDE.md` la vendía como
  configuración en caliente. Es el hallazgo original de julio, sin arreglar desde
  entonces porque la PR no se fusionó. Ahora se lee de la configuración, con la
  constante de respaldo — sin ella, una configuración a medias dejaría a los
  móviles sin poder actualizarse, y en el propio canal de actualización eso es
  tener que actualizar para poder actualizar.
- **`notifyGroup` y `VITE_PUSH_ENDPOINT` eran código muerto** de la era OneSignal:
  la función no la llamaba nadie y la variable no la inyectaba ningún flujo. §14.17
  las sustituyó por APNs desde el Worker y estas se quedaron. Se retiran.
- **Siete rutas del Worker** estaban en la tabla `RUTAS` y no en la lista de su
  cabecera. Añadidas.
- **Doce módulos sin cabecera** —`App.jsx`, `main.jsx` y diez pantallas—, que
  habrían salido en blanco. Escritas.
- **Y uno era del generador**: decía que `planIdeas` y `mejoras` no estaban en la
  migración de D1, y sí están, en la 0006 y la 0010. Solo miraba
  `0001_esquema.sql`. **Un aviso falso es peor que ninguno** —enseña a ignorar la
  lista—, así que ahora lee todas.

El presupuesto de contexto sube de ~200 líneas a **380**: la app ha crecido de 47
a 112 módulos y de 93 a 786 pruebas desde julio, y el mapa con ella. Sigue habiendo
una prueba que vigila que no se desmadre, porque un mapa que no cabe en el
contexto no es un mapa.

**Queda una decisión abierta**, la misma que dejó la PR #28: si sembrar datos de
prueba en producción justifica tener viva `POST /api/importar`, una ruta que puede
sobrescribir la base entera con un secreto registrado.

### 14.29 La puerta, la sala de espera y el primer arranque tras ser aceptado

Decidido en `docs/diseño/acceso.html` · **A3 · B2 + B4 · C2 + C4**, más los cinco
arreglos que no se eligen.

**Lo que estaba mal, medido.** La pantalla de acceso pedía **909,2 pt** tal cual y
**1.292,8** con la sala de espera puesta, en una ventana de **844**. Y `.acceso`
era `min-height: 100dvh` con `justify-content: center` y sin `overflow-y`: lo que
sobraba no se apartaba, se **recortaba** —196,5 pt por arriba y 196,5 por abajo—,
y el de arriba no se alcanzaba ni con el scroll de la página. Se perdían la
ballena, el título y «Buscar la última versión», que es el botón que arregla la
app cuando la app está mal. Dentro de la sala de espera, el párrafo que explica
qué hacer estaba a **1,52 : 1**: `.acceso-aviso .note` cambiaba el color y
heredaba el papel casi blanco de `.note`, y solo se leía la negrita —14,21 : 1,
porque `.note b` la pinta con `--ink`—. Y solo mordía con el móvil en **claro**:
en oscuro eran 7,54. La pantalla es oscura siempre, pero sus variables seguían al
sistema.

**Los cinco arreglos.** (F1) `.acceso` pasa a `height: 100dvh` con
`overflow-y: auto`, y el centrado lo hace `justify-content: safe center`, que
deja de centrar cuando no cabe en vez de comerse el principio. (F2) `.acceso > *`
lleva `flex: none`: sin él, el botón de la demostración se aplastaba de 61,5 a 44
pt con dos líneas dentro. (F3) `.acceso > .note` recupera `border: none` —quitaba
el fondo y el relleno de `.note` pero se dejaba su `1px dashed`, y quedaban cuatro
marcos de rayas—. (F4) la letra pequeña de esta pantalla se pinta sola
(`.acceso-pista`) en vez de heredar `.note`, y lo mismo el botón lleno y las
marcas de `.pasos`, que seguían al tema sobre un fondo que no lo sigue. (F5)
`useSyncEngine` recibe la **sesión** como dependencia: montaba con la app, o sea
antes de que nadie hubiera entrado, su primera vuelta devolvía `sin-sesion` y
nadie lo volvía a llamar hasta el latido de 90 s. Ese era el fallo que se veía
desde el móvil —«me aceptan, entro, y la app dice que no hay ningún evento; al
reiniciar está»—, y reiniciar lo arreglaba porque entonces el motor montaba con
la sesión ya puesta.

**A3 · una puerta y un pie.** La pantalla dice tres cosas —quién eres, qué es esto
en una línea y «Entrar con Apple»— y las otras tres salidas son renglones de 44 pt
en un pie. Cada uno **abre su hoja**, con el texto entero y su botón. Los 353,8 pt
de prosa que había en la puerta explicaban tres cosas que se hacen una vez en la
vida, y las pagaba todo el mundo cada vez que entraba. La segunda frase de la
cabecera baja **debajo** del botón de Apple, que es donde importa: se lee cuando
Apple ya ha fallado.

**B2 · la sala de espera es la pantalla.** Si estás en la lista, eso es lo que
dice la pantalla, y el botón grande deja de ser «Entrar con Apple» —que aquí no
hace nada— para ser «¿Ya me han dejado entrar?». Se **recuerda entre arranques**
(`auth/espera.js`, en `localStorage` como la sesión): sin eso, cada arranque se
leía como si nunca lo hubieras intentado. La puerta vuelve sola en cuanto la
espera se resuelve, se cancela o el pase deja de valer.

**B4 · y mira sola.** `POST /api/sesion/espera` con un **pase** que el Worker
entrega al apuntar la solicitud (`emitirPaseDeEspera`, `api/src/sesion.js`).
Antes, «¿ya me han dejado entrar?» era otro `entrarConApple()` entero, o sea
sacar la hoja del sistema por encima de la app: se puede hacer con un botón, no
cada veinte segundos. Con el pase, la app pregunta cada 20 s y **entra sola** en
cuanto la enlacen. El pase va firmado con el secreto de la sesión y lleva
`tipo: 'espera'`, y las dos verificaciones se cierran en las dos direcciones: una
sesión no vale como pase y un pase no vale como sesión. Dura 30 días, no 90.
Devolver la sesión desde el pase es legítimo: se le entregó a quien ya demostró
ante Apple ser el dueño de esa cuenta, y lo que faltaba no era demostrar quién es
sino que alguien del grupo le diera acceso.

**C2 · la primera bajada se cuenta.** Recién entrado y sin nada bajado todavía,
`BienvenidaScreen` saluda por tu nombre y pinta la **lista de pasos** de siempre
(§14.9-bis) mientras `lib/primeraBajada.js` trae la instantánea. Si falla, sale el
motivo con su estado HTTP, un «Reintentar» y un «Seguir sin esperar» —un fallo que
se repite no puede encerrar a nadie—. Es hermana de `sincronizarTodo` y **no la
misma**: aquella comprueba además si hay versión nueva y recarga, y recargar a los
tres segundos de entrar por primera vez es la peor primera impresión posible.

**C4 · y se entra sola si hay un evento.** Al terminar la bajada, si el grupo
tiene exactamente uno se entra en él sin preguntar. Con dos o más se enseña la
lista: el atajo se retira solo el día que deje de ser cierto.

**Lo que sustituye todo esto** es la pantalla que decía «Aún no hay ningún evento.
Crea uno o carga el de ejemplo» con un «+ Nuevo evento» a mano. El susto era lo de
menos: el peligro era crear ahí un evento duplicado **que sube al grupo** y que ya
no quita nadie desde un móvil. **C3 —esconder «+ Nuevo evento» hasta la primera
instantánea— se dejó fuera** y sigue disponible: con C2 y C4 puestos, esa ventana
se cierra casi entera, pero no del todo si la primera bajada falla y se sigue sin
esperar.

Medido después de construirlo, renderizando los componentes reales contra
`theme.css`: la puerta, la sala de espera y la bienvenida **caben en 844 pt en las
tres tallas de letra y en las dos caras**, el peor contraste de las tres es
**4,64 : 1** y ningún objetivo tocable baja de 44 pt. La puerta con un fallo largo
de Apple mide 1.106 pt en «Enorme» y **se desplaza**: 262 px de scroll, con el
principio y el final alcanzables.

### 14.30 El día abierto: el mueble de un plan, y cada toque escribe

Decidido en `docs/diseño/dia-abierto.html` · **M2 · H1 · R2 · P2**, más los tres
arreglos que no se eligen. Supera a §14.21 en lo que toca al modal del día; la
lista de Días (filas de 70,7, la fila entera abre) no se toca.

**Lo que estaba mal, medido.** Un plan y un día son las dos únicas cosas de la app
que se abren **para leerse y tocarse**, y no compartían ni la posición, ni las
figuras, ni la memoria. El plan es una capa centrada desde `plan-voto.html` · P1;
el día era un formulario pegado abajo con **seis controles de cuatro figuras
distintas** —dos selectores nativos, dos pastillas, un botón lleno y uno
fantasma—. La mitad de la ventana escribía al toque —poner y quitar planes— y la
otra mitad vivía en un borrador que **moría al cerrar sin pulsar el botón**
—bungas y platos—, sin decirlo. El verbo decía «Guardar la cena» justo debajo del
bloque de planes: guardaba también las bungas y no tocaba los planes, que ya se
habían guardado solos. Y en «Hoy» el titular era siempre la cena: el lunes de la
playa confirmada abría con «Sin cena montada» —lo que **no** hay— con el día de
verdad 127 pt más abajo en letra de fila, mientras la lista de Días titulaba ese
mismo día «Playa de la Cala» (`resumenDeDia` ya titulaba lo que hay).

**M2 · el mueble.** El día se abre en el mismo mueble que un plan: `modal center
formulario` (la variante ancha del editor de receta, 362 pt de los 390), papel,
canto y velo de §14.26-bis. Las hojas de elegir siguen subiendo desde abajo,
ahora **sobre** la capa —la combinación de toda la app—, en vez de hoja sobre
hoja del mismo borde. Cuesta lo ya pagado en `plan-voto.html` (renglones a 200,3
pt del pulgar) y una estrechez medida: al titular de una fila le quedan **257 pt
frente a 313**, «Paella mixta y cinco cosas más» dobla a dos líneas y la fila de
la cena pasa de 70,7 a 96,7 (`.fila-capa` deja doblar; recortar perdía justo lo
que se viene a leer). La capa del día 9 del Demo mide **532,9 pt**: cabe entera
sin scroll (el tope de una capa es 658,3 en una ventana de 844).

**H1 · la memoria.** Todo escribe al toque, como votar: la bunga al elegirla, el
plato al marcarlo, el plan al ponerlo. **No hay botón de guardar** y cerrar nunca
pierde nada. La cena **nace sola** con el primer plato o la primera bunga —con
guarda para que dos toques más rápidos que la consulta viva no críen dos cenas
(`cenaRef` en `CapaDeDia`)— y quitarla es un verbo dentro de su hoja con segunda
pulsación, como «Devolver a ideas»: dice que se lleva platos y bungas y que los
planes se quedan. Marcar seis platos son seis entradas en la cola de cambios, que
suben en un solo `POST /api/cambios` como siempre. La nota del pie dice la regla
—«Cada toque queda guardado. Los planes se **votan** en Planes; aquí se
colocan»—, como la nota del plan abierto dice la suya.

**R2 · los renglones.** Dos grupos como los de Planes. **«La cena»**: una fila
con los platos (titular `titularDeCena`, debajo «dos platos») que abre la hoja de
marcar de siempre, y una fila con las bungas («Mayores en El del ruido» · «niños
en El del fondo») que abre una hoja con las dos listas (`HojaDeBungas`): los dos
selectores nativos se van —la rueda de iOS que tapa media pantalla, el motivo por
el que `agenda-dia.html` · C1 los descartó para los planes, valía igual para las
bungas—. **«El plan»**: una fila con lo puesto que abre una **hoja de marcar
planes** (`HojaDeMarcar` con `notaDebajo`): los del día marcados, los libres
debajo con sus votos y quién falta (`lib/planes.js`), los caídos fuera de fechas
con su «era el mié, 12 ago» (§14.10-quater). Marcar pone, desmarcar quita, así
que el «quitar» que vivía dentro de la fila —la figura que Planes acababa de
retirar— sobra. La misma figura tres veces, cero controles nuevos.

**P2 · las palabras.** El titular de «Hoy» titula **lo que hay**
(`titularDeHoy`, `lib/dias.js`): la cena con platos manda; sin ella, manda el
plan del día y la cena baja al renglón pequeño («Confirmado, en Cala del sur ·
sin cena montada todavía»); sin nada, «Día libre». Una cena vacía pero montada
solo manda si tampoco hay plan: es un hueco reservado, no lo que se hace ese
día. Es la regla que `resumenDeDia` ya usaba en Días: dos pantallas hermanas
contestan igual a la misma pregunta.

Las opciones descartadas —el día como pantalla con «volver» (M3), el acordeón en
la lista (M4), el borrador con «Cancelar · Listo» (H2), los planes puestos como
filas que abren la capa de votar (R3, que queda como añadido posible sobre R2)—
están argumentadas en la hoja. Nada de esto toca la base ni la API: todo es
`app/` y cero migraciones.

### 14.31 Los elegidores del día: al centro, con borrador y buscador

Decidido en `docs/diseño/elegidores.html` · **C2 · V2 · S2 · B1 · L3 + L1**.
Revisa dos piezas de §14.30 con nombre y apellido, a encargo de quien lo usa:
H1 (cada toque escribía) y la mitad de R2 (las bungas dentro de «La cena», con
una hoja de dos listas).

**C2 · el elegidor trabaja sobre un borrador.** La figura de la hoja de «Entre»
(§14.27): al abrir se copia lo puesto, tocar marca **el borrador**, «Listo»
escribe todo junto y «Cancelar», el fondo y desmontar descartan. El motivo de
revisar H1 es de palabras: el encargo pidió un «Cancelar», y **un «Cancelar»
sin borrador es un verbo que miente** — cierra sin deshacer, que es el mismo
defecto que §14.30 quitó con «Guardar la cena». La regla cabe en una frase:
dentro de un elegidor, nada es definitivo hasta «Listo». La capa del día no
cambia de memoria: enseña lo guardado y sigue sin botón global. En los planes
el «Listo» aplica el **diff** contra lo guardado —lo desmarcado vuelve a
libres, lo nuevo se coloca, lo que no cambió no encola nada— y hay dos guardas:
«Ninguna» o cero platos en un día **sin** cena no crían una cena vacía, y un
«Listo» sin cambios no escribe. «Quitar la cena» sigue dentro del elegidor de
platos con su segunda pulsación: es un verbo con confirmación propia, no parte
del borrador.

**V2 · una capa cada vez.** El elegidor **sustituye** al día en la misma capa
—apilar dos papeles iguales casi concéntricos se lee como un marco doble, y el
canto de 1,5 pt de §14.26-bis separa una capa del fondo, no de otra igual— y
como el día ya no se ve, lo lleva en su cabecera: «Bunga mayores» y debajo
«domingo, 9 de agosto». El fondo, con un elegidor abierto, es su «Cancelar»:
descarta y vuelve al día; sin elegidor, cierra el día, que con C2 no tiene nada
que perder. Los dos verbos van abajo y en azul (§14.27-bis), con `.salida`.

**S2 · el día en tres secciones.** «La cena» (una fila: los platos), «Los
bungas» (**dos filas**: mayores y niños, cada una con su casa y de quién es —
«Mayores · El del ruido / el de los Pérez»—) y «El plan». Cada bunga abre su
selector de **una** lista: el doble con la fila rica medía **815,8 pt** en la
hoja y el tope de una capa es 658,3 — no cabía, y fue lo que decidió partirlo.

**B1 · la familia manda en la fila.** El selector de un bunga lo nombra por su
familia, con el alias de seña a la derecha («Pérez · El del ruido»); un bunga
sin familia dueña se queda con su alias. «Ninguno» encabeza la lista, porque
quitar también es elegir.

**L3 + L1 · el buscador.** Platos y planes llevan **campo de buscar siempre a
la vista** —era el encargo original: «el buscador de planes y platos»— que
filtra sin esconder (`filtraOpciones`, `lib/dias.js`: sin tildes ni mayúsculas,
y mira también la nota, porque en los platos es la categoría y buscar «postre»
es legítimo) y **no roba el foco** (§14.24). Las bungas no llevan (L1): tres
casas no se buscan. `input[type=search]` entra en la lista de campos vestidos
de `theme.css` — la guardia de §14.27-bis lo exige y es la cuarta vez que un
tipo nuevo pasa por ahí.

Con esto `HojaDeMarcar` se quedó sin su único consumidor y **se retira**;
`Hoja` y `HojaDeEleccion` siguen siendo la figura de elegir de Ajustes y
Gastos. Nada toca la base ni la API: todo es `app/`, cero migraciones.

### 14.32 El semáforo del día, y el género del bunga

Decidido en `docs/diseño/dia-estado.html` · **E1 · K4 · G1 · D1**.

**E1 · el icono tiñe.** El estado de cada renglón del día abierto va en su
pastilla de 34 × 34, la figura exacta de la fila elegida de Planes
(`.ico.verde`): cero puntos de sitio nuevos, el estado va en tinta y montado en
un dibujo — como dibujo el listón de contraste es 3 : 1, como texto habría sido
4,5 y el rojo de la app no llega (3,51 en oscuro sobre su pastilla). Las otras
tres figuras —el punto suelto, el subtítulo teñido y la pastilla escrita de
87,7 pt— están costadas en la hoja.

**K4 · verde · ámbar.** El encargo pedía rojo, y la hoja lo dibujó para verlo:
un día sin montar abría con **cuatro renglones rojos**, con el mismo rojo que
la app usa para **deuda y borrar** — el único color con carga además del verde
y las categorías (`iconos.html` · I4)—. El punto de sincronización ya reparte
el semáforo: **amarillo con cola** —pendiente—, rojo sin red —roto—, y un
renglón vacío está pendiente, no roto. `.ico.ambar` usa `--gold` (el de
`.pill.fx`, sin estrenar color): **4,06 : 1** en oscuro y **3,70 : 1** en claro
como dibujo. Si el ámbar se queda corto visto en el móvil, pasar a rojo (K1) es
cambiar una variable.

**G1 · cada renglón, el suyo.** Cuatro estados independientes: la cena en verde
con **al menos un plato** —montada y vacía sigue pendiente—, cada bunga con el
suyo puesto, el plan con al menos uno colocado. Se ve **qué** falta, no solo
que falta algo.

**D1 · la lista de Días, quieta.** Su resumen ya distingue el día lleno del
vacío con palabras; teñir los números eran ocho avisos ocupando la pantalla
tres semanas antes del viaje (D2 y D3, descartadas en la hoja).

**Y el género del bunga.** El grupo dice «el bunga» —los alias son «El del
ruido» y «El del fondo», y Gente dice «+ Bunga nuevo…»— y §14.31 se escribió en
femenino. Corregido en la app y en este spec: **«Ninguno»** en el selector,
**«el de los Pérez»**, **«toca para cambiarlo»**, **«toca para elegir el
bunga»**, la sección **«Los bungas»** y «Sin bungas repartidos todavía» en el
titular de Hoy.

### 14.33 Números crece, y el semáforo llega a la lista de Días

Decidido en `docs/diseño/numeros.html`: tres encargos directos y una elección
(T1 · T2 · T3 · T4 en la rejilla, T7 · T8 al pique).

**El semáforo en la lista de Días** (revisa la D1 de `dia-estado.html`, a
encargo): la casilla del número tiñe con los mismos pares que los iconos del
día abierto — **verde el día completo, ámbar al que le falta algo**. «Completo»
son los cuatro estados de G1 en verde: cena con platos, los dos bungas y algo
de plan. Una consecuencia dibujada antes de hacerla: «hoy» pintaba su casilla
del mismo verde, y pasa a un **aro del acento** para que el relleno quede libre
para el semáforo (el titular de hoy sigue en negrita).

**El selector del bunga lleva el color de la familia**: la pastilla de dos
letras de `lib/alias.js` (`Alias.jsx`, la firma de Ideas y de los votantes de
un plan) junto al nombre — «Pérez PE · El del ruido». El color solo tiñe el
fondo y la letra se mezcla con la tinta del tema, como en todas partes.

**En Números, el balance de anfitrión primero**: la sección sube encima de la
rejilla — es la cuenta que evita discusiones, quién ha acogido ya y a quién le
toca, y estaba debajo de la media por persona. **Y cada bunga se enseña ahí
como en su selector** (§14.31 · B1, a encargo): la familia manda con su
pastilla de dos letras y el alias baja a la línea de debajo, junto al recuento
—«a quién le toca» es a una familia, y «El del ruido» solo lo contesta si te
sabes los motes—; el bunga sin familia dueña se queda con su alias, como en el
selector. `hostBalance` lleva por eso el `familyId`. De paso el 🏠 del cromo
deja su sitio al dibujo de línea de siempre (§14.13), que es además el que ya
lleva el bunga en el día.

**Y cuatro fichas nuevas más dos retratos**, todo calculado en local en
`computeStats` (`lib/stats.js`, puro y con tests) a partir de hechos que ya
están en el móvil — nada viaja, nada llama a la IA, cero migraciones—:

- **El día más caro** (T1): los gastos agrupados por su **día local**
  (`isoLocal` sobre `dateISO`, que viaja en UTC — el gasto de la 1:30 cuenta
  para la noche en que se pagó, no para el día de Greenwich).
- **«Así vais a acabar»** (T2): el gasto proyectado al cierre — total entre
  días transcurridos por días del viaje—. Solo existe **durante** el viaje; el
  susto del primer día es el chiste y se corrige solo.
- **Días con plan** (T3): «2 de 8», el contrapunto en cifra del semáforo.
- **Racha de cenas** (T4): la tirada más larga de noches seguidas con cena.
- **El entusiasta y el indeciso** (T7 · T8, 🌶️): quién más 👍 reparte y quién
  más 🤷 acumula, **dentro del interruptor del pique** con el 👎 de siempre —
  señalan, y nada señala por defecto (§7)—. Los **empates se dicen** («Ana y
  Pablo, empatados»), que es mejor chiste que elegir a uno por orden de mapa.

Se descartaron T5 (la compra pendiente: la Compra ya lo dice en su área) y T6
(la bebida por adulto: divertida el día tres, incómoda el día siete); se suman
con una línea si algún verano apetecen.

### 14.34 Cada versión se describe a sí misma

La figura de `meeting-ops-air`, copiada a encargo: **la app cuenta qué cambió
en cada actualización**, y que lo cuente es una propiedad de los checks, no de
la memoria de nadie.

- **`lib/notas.js`** lleva unas pocas líneas **escritas a mano** por versión
  publicada — la más nueva primero, en la voz de la interfaz: lo que cambió en
  pantalla, no qué módulo se tocó. No se puede derivar del código: el código
  dice qué es verdad de un build, no qué notaría quien sostiene el móvil.
- **Ajustes → 🐳 La app** enseña la versión puesta y **las tres de antes** como
  tarjetas de lado (`.relnotas`), entre la versión en curso y «Comprobar
  ahora»: la pantalla contesta «¿qué me trajo la actualización?» y no solo
  «¿cuál tengo puesta?». De lado y no en pila para no empujar el botón fuera
  de un acordeón que ya es largo.
- **La guardia** (`lib/notas.test.js`) ata la entrada de arriba al número de
  `app/package.json`: subir la versión sin describirla —o describirla sin
  subirla— pone las pruebas en rojo en cada PR. En `meeting-ops-air` además el
  bump se niega desde el otro lado (`tools/bump.py`); aquí la versión se sube
  a mano y la guardia es la que avisa, en `npm test` y en CI.

### 14.34-bis Las novedades, al final; y los dos «al día», iguales

- **El defecto:** las tarjetas de novedades (§14.34) se pintaban **entre** el
  estado de la versión y el botón que la actualiza, así que el bloque de
  actualizar la app salía **partido en dos** por 244 pt de tarjetas. Y el otro
  bloque que hace exactamente lo mismo sobre otra cosa —«Poner la base al día»
  (§14.23)— salía entero y sin rótulo, pegado detrás, como si fuera una
  coletilla del primero. Dos cosas gemelas escritas de dos maneras.
- **✅ Los tres bloques de «La app» llevan rótulo** (`sec-h`): **Los datos del
  grupo** · **La versión** · **La base de datos**, y las novedades al final bajo
  **Qué ha cambiado**. Sin ellos, el apartado era una cinta de tres estados,
  tres botones y tres listas de pasos seguidas, y no había forma de saber a cuál
  de las tres cosas pertenecía lo que se estaba leyendo.
- **✅ El mismo esqueleto en los dos:** rótulo → en qué estado está → el botón →
  el progreso debajo. Y **el mismo verbo**: «Poner la app al día» y «Poner la
  base al día». Antes el primero se llamaba «Comprobar ahora», que dice otra
  cosa —comprobar es mirar, y este botón descarga y aplica—.
- **Las novedades se leen después, no antes.** Contestan «¿qué me ha traído la
  actualización?», que es una pregunta de cuando ya ha pasado; delante del botón
  ocupaban el sitio de la que sí se hace antes, que es «¿tengo la última?».
- **El rótulo de la base va dentro de su bloque** y no fuera, para no romper
  §14.37-bis: un «La base de datos» solo, con el hueco debajo mientras contesta
  la API, sería una quinta forma de no decir nada.
- **«La versión» y no «La app»**, que es como se llama el acordeón que lo
  contiene: un rótulo que repite el de su apartado no dice dónde estás.

### 14.34-ter «Qué ha cambiado» es un apartado, no el final de otro

§14.34-bis sacó las novedades de en medio del botón de actualizar y las dejó al
final del mismo acordeón. Eso era **la mitad del camino**: seguían siendo el
tercer bloque de un apartado que ya contaba dos operaciones, y para leerlas
había que desplegar «La app» y pasar por encima de los dos botones que la ponen
al día y de sus dos listas de progreso.

- **Son dos preguntas distintas y se contestan de distinta manera:** «¿estoy al
  día?» **se toca** —dos botones y lo que va pasando debajo—; «¿qué me ha
  traído?» **se lee**. Meterlas en la misma solapa obliga a abrir la de tocar
  para llegar a la de leer, y son las dos únicas cosas de Ajustes que se hacen
  el mismo día.
- **✅ Acordeón propio, `Qué ha cambiado`, el último de Ajustes** y detrás de
  «La app», no delante: se lee **después** de actualizar. «La app» se queda con
  sus dos bloques —**Los datos del grupo** y **La versión**, más **La base de
  datos** para quien administra— y ninguno más.
- **La solapa va sin nota**, que es lo único de esta vuelta que se probó y se
  cayó. El titular de la última versión —«Grupo en tres áreas, y los avisos que
  no llegaban»— pide **370 pt** y en el renglón quedan **174,8**: salía por la
  mitad y además empujaba el rótulo a dos líneas, de **48 a 73,2 pt** de alto
  entre nueve solapas de 48. Y el número, que sí cabe, ya lo dice «La app» dos
  renglones más arriba: repetirlo se lee como un descuido. «Qué ha cambiado» se
  basta solo.
- La prosa no se mueve: sigue en `lib/notas.js` con su guardia (§14.34), y las
  tarjetas siguen siendo cuatro y de lado (`.relnotas`). Lo que cambia es de qué
  cuelgan.

### 14.34-quater «La app» son cuatro hechos y dos botones

Sacadas las novedades (§14.34-ter), lo que quedaba seguía siendo **tres bloques
con sus tres rótulos, tres estados, tres botones y tres listas de progreso**, y
cada dato salía **dentro de una frase**: «Versión en curso: v0.50.0. Paquete
puesto: v0.49.0», «Última actualización: hoy a las 14:03», «Un toque sube lo
pendiente, trae la última copia del grupo y de paso mira si hay versión nueva».
Lo que se viene a mirar aquí son cuatro números y un sí o un no, y estaban
repartidos entre seis párrafos.

- **✅ Una ficha de cuatro renglones** (`.hechos`, rótulo a la izquierda y dato a
  la derecha): **Binario** · **Paquete OTA** · **Última sincronización** ·
  **Base de datos**. En el navegador no hay binario ni paquete, así que esos dos
  se funden en **Versión**, y el renglón lo dice en vez de dejar dos guiones.
- **Los dos números de versión se enseñan siempre, coincidan o no.** Esa
  diferencia es justo la que separa «no ha actualizado» de «el binario se ha
  quedado atrás», y solo se decía —dentro de una frase— cuando no coincidían.
- **✅ Dos botones, uno por cosa:** «Poner la app al día» y «Poner la base al
  día». El de la base sale **siempre** para quien administra y va **apagado**
  cuando no hay nada que aplicar: aparecer solo a veces obliga a saber de
  antemano si iba a estar, y este apartado se abre justo para buscarlo.
- **El tercer botón, «Sincronizar todo», se retira.** Hacía exactamente lo mismo
  que el punto de la cabecera (§14.10) —datos y versión en una pasada—, y ese
  está en todas las pantallas y con su propia lista de progreso. Aquí se queda
  **cuándo fue la última**, que es el dato, no el verbo.
- **La segunda línea de un renglón solo sale cuando hace falta:** qué migraciones
  faltan, que la sincronización no va bien, que acaba de actualizarse. Un
  renglón que dice «Al día» no necesita explicarse, y «Al día» debajo de la hora
  de la última sincronización se lee como ruido.
- **Se acaba el silencio del primer instante**, que era lo único que §14.37-bis
  dejó vivo: el renglón de la base existe siempre y solo cambia su palabra —
  «Preguntando…», «Al día», «1 por detrás», «No se ha podido preguntar», «No te
  toca»—.
- **La lista de paquetes se guarda para cuando falla** (§14.37). Es un volcado
  crudo del plugin y estaba siempre puesta; ahora sale detrás de una respuesta
  que **no** fue bien, que es el caso para el que se escribió. Su dato útil —la
  versión del binario— subió al primer renglón.
- **Medido en Chromium a 390 pt**, en el mismo estado (demostración, navegador,
  sin sesión, con las tres segundas líneas puestas): el apartado pasa de
  **657,2 pt a 447,8**. En el móvil de quien administra, con los renglones sin
  segunda línea, son cuatro de 38.

### 14.35 Saldos: la familia con su pastilla, y quién paga a quién

Decidido en `docs/diseño/saldos.html` · **F3 · R2 · E1**, más los tres arreglos
que no se eligen.

**F3 · la familia se enseña como en el resto de la app.** El nombre con su
pastilla de dos letras (`Alias.jsx`) en vez del emoji sobre el color pleno. Las
iniciales sobre el color no se podían poner, y está medido: **2,81 : 1** en el
azul de los Solteros con letra blanca y **4,24 : 1** en el rojo de los García
con letra oscura — habría que elegir la letra por familia, y el color lo elige
quien crea la familia, así que cualquier color puede tocar. La pastilla mezcla
—fondo al 20 %, letra al 55 % con la tinta del tema— y da **4,82 a 5,85 : 1**
en las dos caras sin decidir nada. El emoji no se pierde: sigue en Ajustes →
El grupo, que es donde se elige y donde se mira quién es quién.

**R2 · el renglón de saldar, en dos líneas.** «García → Solteros» arriba, el
importe debajo y **«pagado»** al lado en vez de apilado bajo la cifra. La
sección pasa a llamarse **«Quién paga a quién»**, que es lo que la flecha
dibuja: dicho una vez en el encabezado, ninguna fila necesita glosarlo — y con
eso se va «transferencia pendiente», que lo decía por tercera vez después del
encabezado y del botón. Medido: **de 93,5 a 70,7 pt**, un 24 % menos, **sin
tocar la letra**. Y arregla un defecto que solo aparece midiendo: con el botón
apilado al titular le quedaban **233 pt** y «García → Solteros» **salía
recortado**.

La hoja llegó a decir que la fila de hoy medía 119,4 pt: su maqueta dejaba
**doblar** el titular donde `theme.css` lo **recorta** (`.row .main .n` es
`nowrap` con puntos suspensivos). Corregido en la hoja antes de escribir esto,
con la maqueta comportándose como la app.

**E1 · la letra no se toca.** El encargo pedía «más pequeño» y la respuesta es
que al renglón le sobraba **estructura**, no tamaño: bajar un escalón de tipo
(E2) solo gana **4,8 pt** más por fila, y dos (E3) dejarían el botón en 30 pt,
por debajo del mínimo tocable de 44 (§14.11).

**Y el tercer arreglo:** una persona sin familia es una «familia de uno»
(`solo:<persona>`, §3.3) y la pantalla las llamaba a **todas** «Sin familia» —
con dos, no había manera de saber cuál debía qué. Ahora sale con su nombre y su
pastilla en gris de `--ink-faint`. «Pagos apuntados» hereda la misma figura en
pasado, con el ✓ verde a la derecha: ahí el dibujo dice el estado, no la
familia.

### 14.36 Tu estado, en la cabecera

Decidido en `docs/diseño/estado.html` · **A3 · V1 · M2 · I1 + I3 · G3**.

**El hallazgo que ordenó el encargo.** El estado de una persona
(`persons.estado`) ya existía, ya se escribía en Ajustes y ya **sincronizaba a
todo el grupo** — y no se pintaba en ninguna pantalla. Lo que se veía en la
ficha de una familia es el estado **de la familia**, otro campo. Así que era un
dato que viajaba a nueve móviles para nada; de ahí que la vuelta traiga también
G3, que no estaba en el encargo.

**A3 · la segunda línea de la cabecera.** La línea que decía el lugar —que
después del primer día es decoración— pasa a ser tu estado, en una pastilla que
se toca (`PastillaDeEstado`). Es la única de las tres colocaciones dibujadas que
**no le quita ancho al nombre del evento**: la pastilla al lado del título lo
dejaba en 146 pt y recortaba «Ballenita 2026», que pide 188,1. Se paga en alto
—la cabecera pasa de **78,8 a 94,1 pt**— y en que el objetivo se queda en 32,
por debajo de los 44 de iOS: es una pastilla dentro de una barra, no un botón
suelto. **Los estados largos caben**: la pastilla recorta con puntos
suspensivos, y «desaparecido en combate» son 187,4 pt de los 262 de la línea.

**V1 · los dos huecos.** Con identidad y sin estado, la pastilla **invita**
(«+ tu estado»): un botón que no se ve no se estrena, y por eso el campo
llevaba años vacío. Sin identidad en este móvil vuelve el lugar — no hay estado
de nadie que enseñar, y la cabecera no es sitio para pedir que te identifiques.

**M2 · el modal.** Capa centrada con **cinco estados enteros** que se tocan y,
debajo, dos campos para el tuyo. Enteros y no «emoji por un lado, frase por
otro» porque un estado se lee de una pieza y porque la tanda de la IA viene
así. Al abrir salen cinco **al azar de los doce escritos a mano**: la lista
tiene que traer algo antes de que nadie llame a nadie. Trabaja sobre un
borrador (§14.31 · C2): «Guardar» escribe, «Cancelar» y el fondo descartan.

**I1 + I3 · la IA, dos botones.** «Otras cinco» pide una tanda
(`POST /api/estados/sugerir`, encargo `estados`, haiku) y **solo cuando se
pulsa**: llamar al abrir el modal sería gastar una credencial de pago sin que
nadie lo pida, que es lo que se descartó para las ideas de plan. «Más gracioso»
(`POST /api/estados/gracia`, encargo `estadoGracia`, sonnet) coge lo escrito y
lo devuelve mejor contado — la figura de «Mejorarla» de una idea: **no guarda
nada**, rellena el campo y hay «Deshacer». Sin clave puesta, los dos botones no
aparecen. Al modelo le llegan el sitio, el día del viaje y qué se lleva
apuntado; **los nombres no viajan**, y el propio encargo le prohíbe nombrar a
nadie en una frase. **La tanda no se guarda ni se comparte**, al revés que los
recadillos: allí la broma es del viaje y que todos lean la misma es lo bueno;
aquí un estado es tuyo, y compartir la lista acabaría con nueve personas
puestas lo mismo.

**G3 · quién anda en qué.** Una tira de caras con su estado en «Hoy», bajo los
planes, que se desplaza de lado —en pila serían 9 × 44 pt de la única pantalla
que es «un titular y nada más»—. **Solo salen los que han dicho algo**: una
tira de caras mudas no cuenta nada.

Un estado se guarda como **una sola cadena** («🍺 de resaca») porque es como se
lee y como ya se escribía; partirlo en dos columnas pediría una migración para
no ganar nada. `lib/estados.js` lo parte y lo junta, y sabe que la «a» de «a mi
bola» no es un emoji.

### 14.36-bis Lo que dijo el móvil de la tira de estados

Tres correcciones al usarlo, ninguna de diseño abierto.

**La pastilla admite dos líneas.** A3 se dibujó recortando en una, y en una
caben **37 letras** — «desaparecido en combate» entra, pero cualquier frase
escrita del tirón se corta a la mitad, que en un campo cuya gracia es la coña es
cortar justo el remate. Con `-webkit-line-clamp: 2` caben **65**, 1,76 veces lo
que entraba, y **solo crece cuando se usa la segunda línea**: 42 pt con una,
44,9 con dos. El coste real son **2,9 pt de cabecera** los días que alguien se
enrolla, y sigue siendo una píldora —`border-radius` grande— y no un rectángulo.
Lo que pase de dos líneas se recorta: ese es el único tope que queda.

**Cada nombre de la tira lleva el acrónimo de su familia.** La misma pastilla de
`Alias.jsx` que firma una idea y a un votante, pegada al nombre (4 pt de margen
en vez de los 5 de una fila suelta: dentro de una pastilla ya estrecha se
notan). Sin ella, dos nombres iguales en el grupo son dos caras sin apellido; y
la tira se lee de lejos, que es cuando el color de la casa hace más que el
nombre.

**Y van por novedad**, lo último puesto primero. Ordenada por nombre, lo que
alguien acaba de escribir salía donde le tocara por alfabeto y no se distinguía
de lo de anteayer, con lo que la tira dejaba de tener por qué mirarse dos veces.
El «cuándo» es **`estadoEl`** (migración `0013`), que **escribe el cliente** al
guardar —como `apuntadaEl` de una idea—, así que la tira ordena bien desde el
primer pintado y sin esperar a sincronizar. No es `updatedAt`: ese se mueve con
cualquier cambio de la persona y pondría en cabeza a quien solo se ha corregido
el apodo. Vaciar el estado borra también la fecha. Los estados escritos **antes**
de la migración no tienen fecha: van detrás de los fechados y entre ellos por
nombre, que es lo que había. Todo el orden vive en `quienTieneEstado`, pura.

Como toda migración, la `0013` **no se aplica sola** (§14.23): hasta que se
lance desde Ajustes → Actualizar, el Worker no conoce la columna y el «cuándo»
no sobrevive a una vuelta de sincronización.

### 14.36-ter En claro, el campo del estado se veía en blanco

**Lo que se veía:** en la cara clara, lo que escribías en «Tu estado» no se leía.
En la oscura, perfecto.

- **La causa, medida:** tinta `#e6eef3` sobre campo `#f1f5f7` — **1,1 : 1**. Los
  campos heredan el color (`button, input, select, textarea { color: inherit }`)
  y esta hoja la abre **la pastilla de la cabecera**, así que colgaba de
  `.appbar` → `.modal-bg` → `.modal`. Y `.appbar` lleva `--appbar-ink`, que es la
  tinta **clara** con la que se escribe sobre la barra oscura. En la cara oscura
  no se notaba porque ahí la tinta del cuerpo también es clara.
- **✅ La regla de los campos declara su tinta** (`color: var(--ink)`): un campo
  no puede depender del subárbol en el que lo hayan colgado. Es el **cuarto**
  mordisco de esa lista —`password`, `url`, `datetime-local` y ahora esto— y el
  primero que no es un `type` que faltaba sino una herencia; por eso la guardia
  de `estilos.test.js` crece con él.
- **✅ Y las dos capas de la cabecera salen por un portal al `body`**
  (§14.55-ter): la hoja del estado y el modal del perfil. Colgar una capa de la
  barra es lo que hizo posible el fallo, y arreglar solo el color habría dejado
  el resto de la herencia —tipografía, apilado, el `fixed` del WebKit— esperando
  su turno.
- **Comprobado en el navegador, en las dos caras:** de **1,1 : 1 a 14,24 : 1** en
  claro, y 14,35 en oscuro, que ya estaba bien.

### 14.37 La marca es el icono, y el rojo se reserva para lo que falla

Tres cosas que dijo la pantalla de Ajustes → 🐳 La app, ninguna de diseño
abierto.

**La marca de dentro pasa a ser el icono de fuera.** `WhaleLogo` servía el trazo
de `Icono` (§14.13); ahora sirve el icono de la app, con la esquina redondeada al
**22,37 %** del lado, la proporción de iOS. El detalle en el que se pagaba antes
era el contrario: coherencia con los iconos de la interfaz a cambio de que
tocaras un dibujo en la pantalla de inicio y se abriera una app con otro. La
cabecera es justo donde se comprueba que has abierto lo que querías abrir. Ya no
hereda `--whale`, a propósito — un icono de app no es un icono de interfaz.

**Y aquí salió el desfase: el icono del binario no está en el repositorio.**
`assets/icon.png` —la ballena sobre la «B»— es el único que hay, y es de lo que
comen `assets:ios` e `iconos:web`; pero la app instalada lleva **otro dibujo**
(la ballena azul con el chorro de colores) que nunca se subió. Se descubrió al
poner el de `assets/` en la cabecera y no reconocerlo. Las dos consecuencias
importan más que la marca: **el día que alguien corra `npm run assets:ios` el
icono de la pantalla de inicio vuelve al viejo**, y `docs/APPSTORE.md` dice que
el icono sale de ese fichero, que hoy es falso.

Mientras no aparezca el original, `assets/marca.png` es ese icono **sacado de una
captura de 202 px** —recortado del marco y con las esquinas devueltas a cuadrado—
y `public/marca-192.png` lo que se sirve. De ahí el tamaño único: 192 px es todo
lo que da. Sobra para la cabecera (30 pt, hasta 6×) y para la lista de eventos;
en la puerta, que mide 84, se queda por debajo de los 252 de un 3× y se nota un
punto blando. **No sustituye a `assets/icon.png`**: un JPEG de 202 px estirado a
1024 no es un icono de App Store. El día que aparezca el dibujo de verdad se pone
ahí, `npm run iconos:web` regenera, y esto vuelve a comer de un solo sitio.

**«Ya tienes el último paquete» salía en rojo.** De los cinco desenlaces de
`motivoDelOta`, **tres no son un fallo**: ya la tienes, queda puesta para el
próximo arranque, y en la web no hay paquete que traer. Los cinco se pintaban
`traza mal` porque la variable que los guardaba se llamaba `fallo` y el color
venía detrás del nombre. Leer en rojo la respuesta normal del botón dice lo
contrario de lo que ha pasado, y aquí el rojo es deuda y borrar: gastarlo en lo
corriente lo deja sin significar nada el día que sí falle algo. Lo decide
`otaFueBien`, y los nombres de las pruebas de `Actualizar.test.jsx` ya decían
«no es un fallo» desde que se escribieron.

**Y el bloque de migraciones se callaba cuando no podía preguntar.**
`leerMigraciones().catch(() => {})`: desde el móvil, «no hay nada que aplicar» y
«no he podido preguntarlo» se ven exactamente igual —no se ve nada—, y quien
entra justo a lanzar una migración se queda buscando un botón que no existe. Es
el principio de §14.9-bis en el sitio donde faltaba: ahora el motivo sale con su
estado HTTP.

### 14.37-bis Un hueco no es una respuesta

El arreglo de arriba se quedó corto y lo dijo la pantalla: con el error ya
contado, el bloque **seguía sin pintar nada**. Porque no eran dos estados sino
cuatro, y tres se veían igual — como un hueco:

| | Se veía | Ahora dice |
|---|---|---|
| No administras | nada | «La base de datos la pone al día quien administra el grupo» |
| Todavía no ha contestado | nada | nada (dura un instante, y es el único silencio que queda) |
| La base está al día | nada | «La base de datos está al día» |
| No se ha podido preguntar | nada → el error (§14.37) | el motivo con su estado HTTP |

El de «al día» se escondía a propósito, para no poner un renglón donde no hay
nada que hacer. Sale caro: quien viene a lanzar una migración porque se lo han
dicho no puede distinguir «ya está» de «no te toca» de «no ha cargado», y las
tres se arreglan de forma distinta. Un renglón de más en un acordeón que se abre
para diagnosticar es más barato que una pregunta sin respuesta desde el móvil.

El de «no administras» es el que se resistía: el bloque ni se montaba
(`{esAdmin && <MigracionesBloque />}`), así que el componente no podía hablar. Lo
que se mueve es **dónde se decide**: el bloque se monta siempre y decide dentro,
que es donde puede explicarlo. La consulta a la API sigue sin salir si no
administras — un 403 no se pide para tirarlo.

### 14.38 Borrar pregunta, y la pregunta dice qué se lleva

`docs/diseño/borrar-confirmaciones.html` · **A2 · B2 · B3**, con **A1** en la compra.

Nueve borrados ya confirmaban, y los cuatro de **Grupo** hacían lo que hay que
hacer: la pregunta **nombra la cascada**. Quedaban tres que no preguntaban nada
—un gasto, una cena y una línea de la compra— y no eran los tres borrados más
pequeños: eran los tres que mueven cosas que quien borra **no tiene delante**.

- **✅ Una figura, no tres.** Convivían la segunda pulsación, el bloque en sitio
  y la confirmación en línea dentro de un modal, sin haber elegido ninguna.
  `components/Confirmar.jsx` es la elegida —el bloque de Grupo, que ya tenía
  colores y prueba— y Grupo pasa a usarlo en vez de repetirlo. Gana porque es la
  única que **puede nombrar la cascada sin tapar la fila que se decide**: una
  capa centrada esconde justo aquello sobre lo que se pregunta, y §14.27-bis ya
  cerró esa figura al mover «Entre».
- **✅ El número es la mitad del mensaje, y el cero no se dice** (`lib/borrados.js`,
  puro). Un gasto dice el importe, quién pagó y **a cuántas familias les mueve el
  saldo** —lo que pasa en otra pantalla—; con una sola familia en juego no habla
  de saldos, porque no hay reparto que rehacer. Una cena dice cuántas **líneas de
  la compra** se caen con ella y que lo comprado se queda; sin nada que arrastrar,
  la frase se acaba antes. «Se van 0 líneas» es algo que nadie diría en voz alta.
- **✅ Las líneas de una cena hay que calcularlas, no leerlas.** Una línea de la
  compra **no apunta a su cena**: sale de sumar todas (§14.20). Así que se compone
  la lista dos veces —con esta cena y sin ella— y se mira qué claves quedan
  huérfanas. Es lo mismo que hará el recálculo después, y por eso la frase no
  puede mentir.
- **✅ El verbo de una cena baja al fondo de su tarjeta.** Estaba arriba a la
  derecha, en minúsculas y como `btn sm ghost`: el verbo destructivo más barato
  de pulsar de toda la aplicación —ni rojo, ni detrás de un gesto, ni al final de
  un editor— y a la vez el que más arrastra.
- **✅ En la compra, segunda pulsación y dos controles distintos** (**A1**). La
  misma columna era dos cosas según la fila: en una línea de cena **despliega** el
  reparto, en una escrita a mano **borraba**. Ahora el que destruye lleva su color
  (`.quitar`) y pregunta rellenándose. Aquí no hay cascada que contar —una línea
  no arrastra nada—, solo hay que evitar el toque de más, y eso cuesta **0 pt**.

### 14.39 De qué avisarte, y no avisarte de lo tuyo

Los avisos existían desde §14.17 y avisaban de **una sola cosa**: alguien ha
entrado con Apple y todavía no es nadie. La cañería estaba puesta y no la usaba
nadie más. Ahora avisan de tres, y se puede elegir.

- **✅ Un interruptor por clase**, en Ajustes → Notificaciones. El catálogo lo
  manda el servidor con los nombres puestos (`api/src/avisos.js`,
  `CLASES_DE_AVISO`) y **la pantalla no lleva su propia copia**: una clase que se
  llame distinto en los dos sitios se apaga en uno y sigue sonando en el otro.
- **✅ Es de la cuenta, no del aparato** (migración `0014`, `cuenta.avisosClases`).
  `dispositivo.avisos` ya existía y es otra cosa: el permiso del sistema, que se
  da y se quita en iOS y vale solo para ese teléfono. Quien tiene móvil e iPad no
  quiere apagar «los estados» dos veces.
- **✅ Se guarda lo apagado, no lo encendido.** Así una clase nueva llega
  encendida a todo el mundo sin tocar ninguna fila. Guardando la lista de las que
  sí, cada aviso que se inventara nacería apagado para los que ya estaban, que es
  la forma más silenciosa de que una función no exista.
- **✅ Dos avisos nuevos, los dos de lo que se mira sin estar delante.** Un
  **gasto que te mueve el saldo** —tu familia paga o entras en el reparto— y una
  **deuda saldada**, las dos bajo la clase `dinero`; y **el estado de alguien**,
  que hasta ahora viajaba a todos los móviles y solo se veía entrando en «Hoy».
- **✅ Nunca se avisa a quien lo provocó.** Se pidió con esas palabras —«yo, al
  ser admin, también me llegan los míos»— y es la regla que decide si los avisos
  se leen o se apagan enteros: un aviso de lo que uno acaba de hacer no informa
  de nada. Va en los dos sitios, en la elección de a quién (`tokensParaAviso`,
  `exceptoCuentaId`) y en la de qué (`avisoDeEstado`).
- **✅ Se avisa de lo que cambia el saldo, no de lo que se toca**
  (`elGastoMueveElSaldo`). Corregir la descripción de un gasto no le mueve un
  céntimo a nadie; el importe, los pagadores o el reparto, sí. Sin esa
  distinción, editar tres veces seguidas un gasto son tres avisos a nueve
  teléfonos. Lo mismo con el estado: la app manda la fila entera de la persona al
  corregir un apodo, así que se compara con lo que había.

- **✅ Y una columna que falta no puede apagarlo todo.** Nombrar `c.avisosClases`
  en el `SELECT` hacía que **toda** la consulta reventara mientras la migración
  `0014` no estuviera aplicada — y con ella se caían hasta los avisos que ya
  funcionaban, **en silencio**, porque el `catch` del Worker se lo tragaba. Se
  vio con esas palabras: «he cambiado mi estado y no me llega nada». Ahora las
  lecturas no la nombran (`c.*`), así que la columna ausente llega como
  `undefined` y cae en el caso que ya estaba escrito: lo que no está dicho, está
  encendido. **Escribir** las preferencias sí la necesita, y ahí el error se ve
  en su sitio. El `catch` deja además de ser mudo: sale por el log del Worker,
  que es donde se mira cuando alguien dice que no le llega nada.

### 14.40 En Comidas, el área se llama «Carta»

`Comidas` son **Cenas · Carta · Compra** (§14.10-ter). El área del medio se
llamaba «Platos» y nombraba dos cosas a la vez: el **catálogo** de lo que el
grupo sabe cocinar, que es lo que hay ahí, y los **platos de una cena**, que se
marcan en Cenas y en el día. «Carta» solo puede ser lo primero.

El `id` del área **se queda en `platos`**: es lo que hay guardado en cada móvil
—`lib/areas.js` recuerda el área abierta— y renombrarlo devolvería a todo el
mundo a Cenas a cambio de nada. Los dos sitios que mandaban «a Comidas → Platos»
—los vacíos del elegidor de platos del día— dicen ahora «a Comidas → Carta».

### 14.39-bis La hoja de una mejora es un cuaderno, no un renglón

Una mejora admite **2000 letras** (§14.22) y su hoja medía 380 pt de ancho con
cuatro renglones: lo escrito no cabía en la pantalla mientras se escribía, y el
único camino para apuntarla era un renglón de **una línea**. Las largas se
apuntaban a medias.

- **✅ La hoja pierde `fino`** y pasa al ancho del resto de capas, con diez
  renglones y la cuenta de letras debajo.
- **✅ Se puede escribir una larga desde el renglón** («Escribir una larga»), y
  **lo ya tecleado viaja con el gesto**: el mismo mueble sirve para apuntar y
  para editar.
- **✅ Y se copia al portapapeles.** Una mejora se apunta aquí y acaba en otro
  sitio —un mensaje al grupo, el encargo de la vuelta siguiente— y transcribir a
  mano un párrafo desde un móvil es justo lo que no se hace. Es la figura del
  renglón que se toca para copiar de la lista de pasos (§14.9-bis).

### 14.41 Quién puede tocar qué: la cuenta siembra la identidad, y los cerrojos

La app era igual de editable para todo el mundo: un niño con la tablet podía
borrar un gasto, y cualquiera podía reescribir el censo del grupo. Y «quién
eres» había que elegirlo a mano en cada móvil, cuando el servidor ya lo sabía
desde que el administrador enlaza cada cuenta con su persona (§14.15).

- **✅ La cuenta viaja con la instantánea** (`cuentaPublica` en
  `api/src/index.js`): `{ id, nombre, rol, personId }` sale en el canje de
  sesión, en el sondeo de la sala de espera y **al lado de cada instantánea**
  (`GET /api/sync`, `POST /api/cambios`). Lo último es lo que importa: un
  enlace hecho **después** de entrar llega a los móviles que ya estaban dentro,
  en su siguiente sincronización y sin volver por Apple. El motor lo refresca
  (`actualizarCuenta`, `auth/sesion.js`) sin tocar el token.
- **✅ La identidad se siembra sola** (`useIdentidad`, `lib/identidad.js`): sin
  nadie elegido en este móvil, la persona enlazada de la sesión entra sola —al
  enlazar a Mariona, su móvil ya sabe que es Mariona—. Solo rellena el hueco:
  una elección hecha a mano no se pisa, y si la persona enlazada no es de este
  evento no se inventa nada.
- **✅ Dinero escribe solo con manos adultas** (`puedeTocarDinero`,
  `lib/personas.js`): con la identidad de un niño puesta, Gastos pierde el
  «+ Gasto», el toque que abre la ficha y el gesto de borrar —la fila deja de
  ser un botón—, y Saldos pierde «pagado». Mirar, todo lo que quieran: los
  saldos son del grupo. Sin identidad no se capa nada: la libreta local y el
  primer arranque no tienen a nadie elegido y una app muda no invita a entrar.
- **✅ Y hay una tercera edad: el adolescente.** Pesa **como un adulto** —come y
  cuesta como uno: peso 1, mesa de mayores y reparto de adulto de fábrica— y lo
  único que lo distingue es que **Dinero no es suyo**. Vive en la misma tabla
  `EDADES` con su columna `dinero`, que es de donde bebe `puedeTocarDinero`:
  una edad nueva se añade en un sitio y sale en el editor, en el peso y en el
  cerrojo a la vez. No pide migración: `edad` ya era texto libre en la base, y
  a un cliente viejo un «adolescente» le pesa 1 (`pesoDe` cae en 1 ante lo
  desconocido).
- **✅ El grupo lo edita quien administra** (`GrupoSection`): con sesión de
  miembro es el censo —sin «+ Familia», sin «+ Persona», sin abrir fichas ni
  emparejar bungas—. Sin sesión no se capa: la libreta local y la demostración
  son de quien tiene el móvil en la mano. Es un cerrojo de pantalla, no de
  servidor: en un grupo de nueve amigos el riesgo es el dedo, no el dolo.
- **✅ El administrador no cambia de persona** (pedido expreso): su «Cambiar de
  persona» de Quién eres se retira mientras tenga identidad — el servidor ya le
  enlaza (§14.15) y no la usa. Si se queda sin ella, la lista vuelve sola.
- **✅ Sincronización y Actualizar se consolidan en «La app»** (pedido expreso):
  eran dos acordeones contando la misma operación por mitades, cuando el punto
  de la cabecera ya hace las dos cosas en una pasada (datos + versión, §14.10).
  Un acordeón, con la versión en el rótulo.
- **Lo que no se toca:** IA ya era solo del administrador, y el acordeón
  «Cuentas» de un miembro se queda en lo mínimo que exige Apple — «Salir» y
  «Eliminar mi cuenta» (directriz 5.1.1(v)) no pueden desaparecer.

### 14.42 Con sesión, quién eres lo dice la cuenta y no se elige

§14.41 dejó la identidad **sembrada** desde la cuenta pero seguía siendo
elegible: cualquiera podía ponerse el nombre de otro y apuntar gastos en su
sitio — y el cerrojo de Dinero (§14.41) se saltaba eligiéndose un adulto.

- **✅ La lista de personas se retira con sesión** (pedido expreso). Solo sale
  donde no hay cuenta que lo diga: la **libreta local** y la **demostración**.
- **✅ Y la cuenta manda, no rellena.** Sembrar el hueco y esconder la lista, a
  la vez, dejaría atrapado para siempre a quien se hubiera elegido mal antes de
  que esto existiera — que es justo a quien esto viene a corregir. Así que la
  persona enlazada **se impone** en cada arranque (`useIdentidad`), y una
  elección vieja de este móvil se corrige sola.
- **✅ «Salir» desaparece con ella.** Olvidar la identidad tiene sentido cuando
  se eligió aquí; con la cuenta enlazada volvería a ponerse en el acto, o sea un
  botón que se deshace solo. El «Salir» de **Cuentas** —cerrar sesión— no se
  toca: es otra cosa y sigue donde estaba.
- **✅ Queda una salida:** si la persona enlazada **no es de este evento**, la
  lista vuelve. Es el único caso en que la cuenta no puede contestar, y sin ella
  ese evento no se podría usar.
- **La pantalla dice por qué**: «Eres Mariona porque tu cuenta está enlazada con
  esa persona: lo decide quien lleva el grupo, no este móvil». Un control que
  desaparece sin explicación se lee como una avería.

### 14.43 Organizar el viaje es de los adultos, y el evento de quien administra

§14.41 cerró el dinero y §14.42 la identidad. Faltaba lo demás de organizar: un
niño podía **montar una cena**, **pasar una idea a propuesta** —que crea un plan
del viaje— y **colocar el día** de todos. Y las **fechas del evento**, que
apartan cenas y planes de todo el grupo (§14.10-quater), las cambiaba cualquiera.

- **✅ Un solo predicado, `puedeOrganizar`** (`lib/personas.js`), porque es una
  sola regla: escribir lo que organiza el viaje. Sustituye a `puedeTocarDinero`
  —dos nombres para la misma decisión se separan solos con el tiempo— y bebe de
  la columna `organiza` de `EDADES`, así que una edad nueva se declara en un
  sitio y sale en las cinco pantallas a la vez.
- **✅ Lo que queda dentro:** gastos y liquidaciones (§14.41), montar y borrar
  cenas, «Proponer» una idea, y los tres renglones del día —platos, bungas y
  plan—.
- **✅ Lo que queda fuera, a propósito:** **votar** un plan, **apuntar** una idea
  —media razón de ser del catálogo—, marcar la compra, cambiar el estado y
  mirarlo todo. Un viaje en el que los peques no pueden opinar no es este.
- **✅ El día se abre igual**, y sus renglones dejan de ser botones en vez de
  salir apagados: una fila `disabled` se lee como una avería, y aquí no falta
  nada —simplemente no te toca colocar el día—. Las pistas cambian con ellos:
  «toca para elegir el bunga» pasa a «sin elegir», porque un renglón no puede
  prometer un gesto que no ocurre.
- **✅ El evento lo edita quien administra** (pedido expreso). Su ficha de
  Ajustes deja de ser un botón para los demás y dice por qué: cambiar las fechas
  aparta cenas y planes de todos.
- **Sin sesión no se capa nada** —libreta local y demostración—, como en todo lo
  demás: ahí el viaje es de quien tiene el móvil en la mano.

### 14.43-bis Devolver un plan al catálogo también es organizar

- **El defecto:** «Devolver a ideas» —dentro del plan abierto— iba por
  `esAdministrador`, y proponer una idea iba por `puedeOrganizar` desde §14.43.
  Son **los dos sentidos del mismo movimiento**, y con dos reglas distintas
  cualquier adulto podía traer una idea al viaje y **nadie más que quien
  administra** podía deshacerlo. Quien lo trajo por error no podía retirarlo:
  tenía que pedírselo a otro.
- **✅ Pasa a `puedeOrganizar`** (`screens/PlanesScreen.jsx`). Los dos cerrojos
  de la app resuelven cosas distintas y aquí se habían cruzado:
  `esAdministrador` es el del **grupo** —quién entra, quién es quién, las fechas
  del evento, la clave de la IA—, y `puedeOrganizar` es el del **viaje** —el
  dinero, las cenas, los planes y el día—. Un plan del viaje es de los segundos.
- **La identidad se saca de la persona, no de la sesión.** La pantalla ya tenía
  `useIdentidad` para votar, pero solo le pedía el `meId`; el predicado necesita
  la fila entera, porque lo que decide es la **edad** (`EDADES.organiza`).
- **Y de paso se destapa donde no había que capar nada**: con `esAdministrador`,
  la libreta local y la demostración —que no tienen sesión— no enseñaban el
  botón a nadie. `puedeOrganizar` no capa sin identidad, que es la regla de
  §14.43 y la de toda la app.
- **Votar sigue siendo de todos**, incluido el niño que no puede devolverlo: es
  el mismo reparto de §14.43 —opinar es de todos, escribir lo que organiza el
  viaje es de los adultos—.

### 14.44 Los estados, uno debajo de otro; el recado, bajo el selector

Dos sitios donde el ahorro de alto salía caro, y los dos se ven en el mismo
pantallazo: la tira de «Quién anda en qué» cortada por la derecha y un recado
que solo aparece si llegas al fondo.

- **✅ «Quién anda en qué» pasa a pila** (revisa el G3 de §14.36). Nació
  horizontal para ahorrar alto —nueve personas en 390 pt— y ese ahorro se
  pagaba dos veces: lo que no cabe **no se ve** —hay que arrastrar para
  descubrir que hay alguien más, y nada anuncia que lo haya— y dentro de una
  pastilla de 240 el estado **se corta justo donde está la gracia**: «no sé si
  me dejo algo» se leía «no sé si me dej…». En pila se lee entero, medido en
  navegador: tres filas, **63 pt cada una** y **cero textos recortados**. El
  alto lo paga el scroll, que en esa pantalla ya existía.
- **✅ El recado sube al principio del cuerpo, bajo el selector** (revisa C2 de
  §14.25). El sitio de antes —el pie del scroll— seguía costando 0 pt
  permanentes, pero a cambio **no lo leía nadie**: en Gastos hay que recorrer
  el viaje entero para llegar. Arriba se lee al entrar y **se va con el scroll**
  en cuanto se empieza a mirar la lista, así que el argumento de §14.25 se
  mantiene: no ocupa sitio fijo. Sigue en voz baja —`--t-sub` y tinta tenue— y
  el aire pasa de encima a debajo, que es donde hace falta ahora.
- Está en las cinco pantallas que ya lo tenían (Gastos, Cenas, Carta, Compra y
  Hoy). En Hoy hay **dos** `.body` —el del evento sin fechas y el de verdad— y
  el recado va en el segundo: en el primero ya hay un vacío que habla.

### 14.45 Quien administra sí cambia de persona, y «Hoy» invita a decir tu estado

Dos correcciones sobre lo anterior, las dos del uso.

- **✅ Cambiar de persona vuelve, pero solo para quien administra** (revisa
  §14.42, que se lo había quitado a todo el mundo). Es la única identidad que
  tiene un motivo para moverse: mirar la app **tal como la ve otro** cuando
  alguien dice «a mí no me sale» — con los cerrojos de §14.43 encima, eso ya no
  se puede comprobar de otra manera. A los demás la cuenta les sigue mandando.
- **✅ Y por eso a él la cuenta le *siembra*, no le impone**
  (`mandaLaCuenta` en `lib/identidad.js`): imponérsela le desharía la elección
  en el acto, que es el mismo defecto que §14.42 arregló al revés. El hueco
  vacío sí se le rellena, para que empiece siendo él sin tocar nada.
- **✅ «Hoy» invita a decir en qué andas** cuando tienes identidad y **no has
  dicho nada**: primera fila de «Quién anda en qué», **de rayas y no llena**
  —en una lista de estados puestos, una fila igual que las demás se leería como
  que ya has dicho algo— y con sus 44 pt de objetivo, que las otras filas no
  necesitan porque no se tocan. Medido: 56 pt de alto, el ancho entero.
- **La pastilla de la cabecera ya invitaba** (§14.36 · V1) y se queda, pero ahí
  son 15 pt sobre el cielo que se leen como parte del rótulo del evento. El
  sitio donde se ve lo que dicen los demás es donde apetece decir lo tuyo. En
  cuanto hay estado la invitación de «Hoy» **desaparece** —la pastilla sigue
  sirviendo para cambiarlo— porque dos invitaciones a la vez son ruido.
- **✅ El estado lo escribe un solo sitio** (`ponerEstado`, en `db.js`): lo
  guardan la pastilla y el botón nuevo, y dos copias de la misma regla —el
  `estadoEl` que escribe el cliente, §14.36-bis— se separan a la primera.

### 14.46 Al minuto: los datos se traen y la versión se vigila

Con la app abierta, lo nuevo del grupo tardaba **90 s** en aparecer y la versión
de la app no se miraba **nunca** — solo al arrancar (`initNative`). Publicar un
OTA y no cerrar la app significaba quedarse en la de antes toda la tarde.

- **✅ Los datos, cada 60 s** (`LATIDO_DATOS_MS`, en `sync/engine.js`). Sigue
  saliendo **solo con la app visible**, así que no despierta a nadie de fondo.
- **✅ La versión, también cada 60 s, pero solo la pregunta.** `hayOtaNueva()`
  lee el manifiesto —un JSON de **204 bytes**— y lo compara con el paquete
  instalado, **sin descargar** los ~380 KB del bundle. Por eso se puede
  preguntar al minuto; bajar al minuto no. Y en cuanto la respuesta es que sí,
  **se deja de preguntar**: ya lo sabemos.
- **✅ Y se pone al volver a primer plano**, no en el latido. Aplicar un OTA
  **recarga la webview**, y eso se lleva por delante lo que haya a medio
  escribir —el formulario de un gasto no está en la base hasta que se guarda—.
  Al volver del fondo el contexto ya estuvo suspendido, nadie tiene el dedo
  encima y una recarga es lo que hace cualquier app. Es la misma decisión que
  ya tomó `checkForOtaUpdate` al separar `set()` de `next()`.
- **La consecuencia, dicha:** con la app abierta y **sin soltarla**, la versión
  nueva se detecta pero no se pone hasta cambiar de app y volver. Es el precio
  de no quitarle a nadie un gasto a medio teclear, y se paga una vez por
  versión. El botón de siempre —el punto de la cabecera— sigue aplicándola en
  el acto para quien no quiera esperar.
- **✅ Quién decide qué está en `lib/vigilante.js`**, puro y con las
  dependencias inyectadas: `native.js` no se puede probar dentro de jsdom
  —importa el plugin de Capacitor— y esta lógica sí, que es la que se puede
  equivocar. Incluye la guarda de los **dos regresos a la vez**, que si no
  descargarían el mismo paquete dos veces.

### 14.47 Pulsar Agenda lleva al calendario, y en un emoji caben tres

- **✅ Pulsar «Agenda» abre «Días»**, esté donde esté. Es el calendario del
  viaje y lo que se viene a mirar cuando se pulsa esa pestaña; «Hoy» se sigue
  viendo **al abrir la app** —ahí no hay pulsación y el titular del día es con
  lo que se quiere abrir— y a un toque en el mando. Las otras cuatro secciones
  siguen recordando dónde estabas (`lib/areas.js`), que es lo suyo: solo Agenda
  tiene destino fijo.
- Para eso `useArea` aprende a escuchar (`ponerArea` + evento propio): quien
  cambia el área desde **fuera** de la pantalla —la barra de abajo— tiene que
  despertar al mando ya montado, porque el mapa de áreas es memoria muda.
- **✅ En un campo de emoji caben tres dibujos** (`lib/emojis.js`). Antes había
  un `maxLength={4}` que cuenta **unidades UTF-16**, y eso hacía dos cosas raras
  a la vez: dejaba poner **dos** caritas —🙂 son dos unidades— y **ninguna
  familia**, porque 👨‍👩‍👧 son **ocho**. O sea que el emoji que traen puestas las
  familias de fábrica no se podía escribir a mano.
- Se cuenta por **dibujos**: banderas (dos indicadores regionales), tonos de
  piel, selectores de variante y cadenas con ZWJ. A mano y no con
  `Intl.Segmenter` porque el binario admite **iOS 15** y el segmentador llega en
  el 16.4 — un camino que a veces existe y a veces no se prueba una vez y falla
  en el móvil de otro.
- **✅ Y la casilla los encoge en vez de recortarlos.** Tres emoji a 19 px piden
  57 pt y la casilla mide 36: sin esto el tercero se sale y, centrados, se
  pierde por los dos lados. `data-emojis` en el avatar y dos reglas de tamaño;
  a tres se dejan **doblar** con el interlineado apretado (dos renglones, 27 pt
  de los 36). Medido en navegador: caja de 36 × 36, letra a 12,88 px, **sin
  desbordar ni a lo ancho ni a lo alto**. La casilla **no crece**: es la unidad
  de la fila, y una fila más alta por el emoji de alguien descuadra la lista.

### 14.47-bis Pulsar la pestaña donde ya estás vuelve a su primera casilla

§14.47 hizo que pulsar «Agenda» abriera «Días» **esté donde esté**. Eso dejó a
la pestaña activa sin gesto y a las cinco secciones sin salida: metido en
«Números», en «Compra» o en «Gadgets», la única forma de volver al principio era
volver a buscar la casilla en el mando — y tocar la pestaña que ya está
encendida no hacía nada.

- **✅ Tocar la pestaña activa devuelve a la primera casilla de su mando**:
  Agenda → **Hoy**, Dinero → **Gastos**, Comidas → **Cenas**, Planes →
  **Planes**, Grupo → **Familias**. Es el gesto de toda la vida en iOS —la
  pestaña encendida devuelve a la raíz—, y aquí la raíz de una sección es su
  primera casilla.
- **§14.47 se queda, acotado a entrar desde fuera.** Venir de otra sección a
  Agenda sigue abriendo el calendario, que es lo que se viene a mirar; la
  **segunda** pulsación lleva a «Hoy». Así los dos toques seguidos son
  «llévame al día de hoy» sin haber perdido el atajo al calendario.
- **La app sigue abriendo en «Hoy»**: ahí no hay pulsación, y el titular del día
  es con lo que se quiere abrir.
- **Dónde está escrito con qué empieza cada sección:** en `AREA_DE_ORIGEN`
  (`lib/areas.js`) y en ningún otro sitio. Antes era el segundo argumento de
  `useArea` repetido en las cinco pantallas; ahora lo leen **dos** sitios —el
  mando y la barra de abajo— y un mismo hecho en dos ficheros es un desfase
  esperando a pasar.
- **Comprobado en el navegador** sobre el Demo: al abrir, Agenda · Hoy; entrar
  desde Dinero, Agenda · Días; volver a pulsar, Agenda · Hoy; y otra vez, Hoy
  —el gesto es idempotente—. En las otras cuatro: Saldos → Gastos, Compra →
  Cenas, Trucos → Planes, Gadgets → Familias.

### 14.48 Un bunga con familia también se corrige

- **El defecto:** en cuanto un bunga tenía familia, sus datos quedaban escritos
  para siempre. `EditorBunga` existía desde §14.14 y se abría desde **un solo
  renglón**, el de «Sueltos»; y «Sueltos» lo pinta `bungasLibres`, que por
  definición **no incluye** los que ya tienen familia. Desde la ficha de la
  familia, la pastilla lleva a «¿Qué bunga?», que es *cuál*, no *cómo se llama*.
  En el Demo los tres bungas tienen familia: hoy no se puede corregir ninguno.
  Cambiarle el nombre a «Bunga 1» pedía desasignarlo, editarlo y volvérselo a
  dar, con la cascada de cenas colgando en medio.
- **✅ La salida vive en esa misma hoja**: bajo la lista, `Editar «El de la
  piscina»…` junto a `+ Bunga nuevo…`. Es donde se mira justo después de tocar
  la pastilla, y no cuesta un pixel de la ficha —la hoja mide **433,0 pt** de
  los 844 de la ventana, con los dos renglones de 48 y sin recorte de la
  etiqueta (326 px de 326 medidos en navegador)—. No es un lápiz en la
  pastilla: la pastilla mide lo que mide y ya tiene su verbo.
- El nombre va **en la etiqueta**: «Editar» a secas, debajo de una lista de
  cinco bungas, no dice cuál de los cinco.
- `HojaDeEleccion` admite ahora **una o varias** salidas (`extra` acepta objeto
  o lista). Elegir de una lista y corregir lo que hay son dos cosas distintas y
  las dos se buscan en el mismo sitio.
- **Y la nota de la familia nueva dejó de mentir**: decía «puedes crear uno
  nuevo desde la misma lista» y esa lista no lleva la salida de N4 —una familia
  que aún no existe no puede quedarse con nada—. Ahora manda al sitio donde sí
  se puede: «Guarda esta y créale el suyo desde su pastilla».

### 14.49 «Mayores» son los mayores, y «Peques» se retira

- **El defecto:** el atajo «Mayores» de un gasto no miraba la edad sino
  `cuentaComoAdultoReparto`, una **casilla guardada en cada persona** que se
  pone sola al crearla y luego se queda quieta. Fran, en el Demo, está apuntado
  como `edad: 'niño'` con esa casilla a `true` —se hizo así cuando «Adolescente»
  no existía—, así que salía **dentro de «Mayores»** con su ficha diciendo
  «Niño». Una casilla que nadie ve y que contradice al dato que sí se ve no es
  un dato, es una trampa.
- **✅ Ahora lo dice la edad** (`lib/personas.js` · `esMayor`, columna `mayor`
  de `EDADES`). Es una columna y no `peso === 1` porque son dos preguntas
  —cuánto cuestas y si eres de los mayores— que hoy contestan igual y mañana a
  lo mejor no; y el día que haga falta el bebé se declara en un sitio, como el
  peso y como `organiza`. El **adolescente entra**: la edad se creó diciendo que
  «pesa como un adulto, come y cuesta como uno», y lo único que lo distingue es
  que no toca Dinero (§14.41). Sacarlo del reparto de la cena de los mayores
  sería inventar una regla que nadie ha pedido — si se quiere fuera, es cambiar
  ese `mayor: true` por `false` y nada más.
- Edad desconocida cuenta como mayor: entrar en un reparto hace menos daño que
  desaparecer de él sin que nadie lo pida.
- **✅ Y «Peques» se retira.** Un gasto solo de los niños no lo apunta nadie —la
  merienda de la playa la paga alguien y se reparte entre todos—, y su casilla
  se llevaba un cuarto de un mando de 328 pt para no usarse nunca. Quien lo
  necesite lo tiene en dos toques más: «Nadie» y marcar. `pequesDe` **se queda**,
  porque «solo los peques» sigue siendo una de las dos formas de reparto que
  `comoSeReparte` sabe nombrar.
- Con esto `cuentaComoAdultoReparto` deja de leerse en toda la app. La columna
  y su escritura se quedan —quitarlas es una migración a cambio de nada— pero
  ya no decide.

### 14.50 Lo que hace el grupo se apunta, y al final se cuenta

- **✅ Hay bitácora** (tabla sincronizada `registro`, migración `0015`): cada
  cosa que alguien hace deja un renglón con **quién, cuándo y qué**, y al final
  del viaje eso es el recap. Se escribe dentro de `escribir()` y `removeRow()`,
  que es por donde pasa **toda** escritura de la app: no hay que acordarse de
  apuntar nada en cada pantalla, y una pantalla nueva queda apuntada sola.
- **La frase viaja compuesta**, no el campo. «Marta apuntó “Cena del sábado”» es
  un renglón de recap; «`description` pasó de X a Y» es un log de programador.
  La compone `lib/registro.js` (puro) con la fila **ya fusionada** y la de
  antes, que es lo único que separa «votó» de «cambió el día» cuando las dos
  cosas son un `upsert` sobre `plans`. El Worker **no la rehace**: una cena
  borrada en agosto no puede volver a decir de qué día era, y rehacerlo allí
  obligaría al servidor a saber de cenas, de planes y de la compra.
- **Tres cosas no dejan rastro, y las tres se descubrieron mirándolo en el
  navegador**, no en las pruebas:
  - **Sembrar no es hacer.** Cargar el Demo dejaba **45 renglones** —«Alguien
    dio de alta a los García», «Alguien apuntó a Curro»— y el recap se abría
    lleno antes de que nadie tocara nada.
  - **Recalcular no es hacer.** Abrir Comidas → Compra rehace las líneas que
    salen de una receta (§14.20), y quien tuviera la pantalla delante firmaba
    **seis** «apuntó “Arroz bomba”» que no había escrito. Las líneas con
    `origen: 'cena'` no se apuntan al nacer ni al morir; **tacharlas sí**, que
    eso lo hace un dedo en el pasillo del súper.
  - **Recibir no es hacer.** Lo que llega en la instantánea ya trae su renglón
    del móvil donde se hizo; volver a apuntarlo multiplicaría cada hecho por los
    teléfonos del grupo.
- **Lo mismo repetido es una vez** (`MISMA_COSA_MS`, 10 min): si el último
  renglón es de la misma persona sobre la misma fila y con la misma acción, se
  **actualiza** en vez de añadir otro. Sin esto, el recap del viaje lo escribe
  quien más dudó al teclear —corregir un gasto cuatro veces son cuatro
  escrituras y **un** hecho—. Crear y editar no se juntan: son dos cosas.
- **El registro no cuenta como «cambio sin subir».** Sube por la misma cola, sí,
  pero el número del punto de la cabecera existe para decidir si esperar a tener
  cobertura (§14.9-quinquies): si cada gasto contara dos, mentiría por el doble.
  `cuantosPendientes` lo filtra; `hayCambiosPendientes` no, porque antes de
  borrar la libreta hay que subirlo todo (§14.9-ter).
- **El recap vive al final de Números** (`lib/recap.js`, puro): las cuentas
  —cuántas cosas, quién ha andado más, el día más movido, el desglose por
  clase— y el **diario por días**, del más nuevo al más viejo. De fábrica sale
  solo el último día y el resto está detrás de «ver todo», por la misma razón
  que el pique está detrás de su interruptor: en un viaje de una semana son
  cientos de renglones y ninguno es lo que vienes a ver un martes. Va **dentro
  de Números** y no en un área propia porque una cuarta casilla en el mando de
  Agenda deja las cuatro por debajo de 77 pt.
- **El renglón dobla en vez de recortarse** (`.row.recap-linea`). En una lista
  de filas gemelas el recorte con puntos suspensivos es lo correcto —el nombre
  entero está a un toque—; aquí no hay toque y **la frase es el dato**. Medido
  en navegador: ocho de los cuarenta y cinco renglones del Demo se recortaban, y
  «Curro apuntó “Tomate de un…» no cuenta nada.
- **Nada de esto ordena a la gente de mejor a peor**: el podio es de «quién ha
  estado más encima», y un podio de una sola persona no se enseña —sería esa
  persona leyendo su nombre—, igual que un «día más movido» de un solo día. Lo
  que señala sigue detrás del interruptor de §7.
- **Lo que crece:** es la única tabla que suma una fila por cada toque, y la
  instantánea se baja entera en cada latido (§14.9). Con el juntado, un viaje de
  una semana y nueve personas son unos cientos de renglones — decenas de KB. Si
  algún día molesta, lo que toca es lo de la evaluación de WebSockets: un
  marcador de «¿cambió algo?» que evite bajar la instantánea entera cada minuto.

### 14.51 Un pago apuntado se puede deshacer

- **El defecto:** `removeSettlement` estaba escrito en `db.js` desde siempre y
  **no lo llamaba nadie**. «pagado» es un botón de una sola pulsación, sin
  confirmación, en una fila de 70,7 pt: un toque sin querer metía una
  liquidación que ya no había forma de quitar desde la app, y descuadraba el
  saldo de **dos** familias hasta que alguien entrara por la consola de D1.
  Salió mirando qué le falta a Saldos frente a Splitwise, y no es una mejora:
  es un agujero.
- **✅ Detrás del gesto, como en Gastos** (`Deslizable`, §14.10-bis): la fila de
  «Pagos apuntados» se desliza y descubre **Deshacer**. Detrás del gesto y no en
  la fila porque el 99 % de las veces lo que se hace con esa lista es mirarla, y
  un verbo permanente ahí sería un botón de descuadrar el saldo al alcance del
  pulgar.
- **La pregunta dice el efecto, que es el contrario del que se ve**
  (`lib/borrados.js` · `queSeLlevaUnPago`): «Se deshace el pago de 70,56 € de
  García a Pérez. **García vuelve a deber 70,56 €**». Es el criterio de §14.38
  —esto mueve algo que quien borra no tiene delante— con una vuelta de tuerca:
  lo que se quita no es un gasto sino una **marca**, y el número que cambia está
  dos secciones más arriba.
- **El verbo va en azul, no en rojo.** El rojo aquí es deuda y borrado (§14.32,
  §14.37) y lo que se quita es una marca; quien avisa de lo que mueve es la
  pregunta. Y **se mide solo**: los 76 pt de `.verbo` son la medida de «Borrar»,
  y «Deshacer» son dos letras más —se salía por la derecha—. Con `--verbos`, que
  pone el propio `Deslizable`, el botón llena exactamente lo que el gesto
  descubre: **96 pt**, con la palabra en 76,4 (Grande) y **86,0 (Enorme)**.
- **✅ Y la pregunta se enseña sola** (`components/Confirmar.jsx`). El bloque
  nace al final de su lista, así que con la lista rodada cae fuera de la
  ventana: medido en Saldos con **un solo** pago y la letra en Enorme, se abría
  en el **788** y acababa en el **984** de una pantalla de 844. Desde el móvil
  eso se lee como que el botón no ha hecho nada, y el siguiente toque es otra
  vez el mismo botón. Con el `scrollIntoView`, 580 → 776: dentro. Vale para
  **los diez** borrados de la app, no solo para este.
- Con la identidad de un niño puesta no hay gesto ni verbo, igual que no hay
  «pagado» (§14.41): es el mismo saldo movido en el sentido contrario.
- **Lo que no se toca:** el algoritmo. `simplifyDebts` ya es el *Simplify Debts*
  de Splitwise —netear y emparejar voraz a la mayor deudora con la mayor
  acreedora— y con **tres familias es óptimo siempre**: para bajar de *n − 1*
  hace falta un subconjunto propio que sume cero, y con tres saldos distintos de
  cero eso no existe. Comprobado contra el óptimo exacto por fuerza bruta: 3
  familias 2 y 2, 5 familias 4 y 4, y la primera diferencia aparece con **seis**
  (5 contra 4). Cambiarlo hoy no ahorraría ni una transferencia.
- **Sigue faltando el pago parcial**: «pagado» apunta la transferencia **entera**
  que sugiere la app, y un Bizum de 20 sobre una deuda de 34,67 no se puede
  decir. Es el hueco grande que queda frente a Splitwise, y es otra vuelta.

### 14.61-bis El enlace deja de ser de un solo uso

- **El defecto:** §14.61 lo dejó de **un solo uso** por ser una credencial al
  portador, y sobre el papel se sostiene. En la mano no: lo que ese cierre tiraba
  abajo casi nunca era un reenvío con mala idea, sino **el camino normal** —
  abrirlo y volver a abrirlo, mirarlo primero en el móvil y luego en el portátil,
  cerrar la pestaña sin querer, o que la **vista previa de WhatsApp** lo estrene
  antes que su dueño—. Y el que se quedaba fuera era **quien no tiene iPhone**,
  o sea exactamente aquel para quien se hizo esto: su único camino de entrada
  también era el único que se rompía solo.
- **✅ Se puede canjear las veces que haga falta.** El canje ya no borra
  `cuenta.enlaceJti`; solo comprueba que el pase sea **el** enlace vivo de esa
  cuenta.
- **Los otros dos cierres se quedan enteros**, y son los que de verdad acotan una
  credencial al portador: **caduca a los tres días** sola, y **generar otro
  revoca el anterior** en el acto. El segundo, además, **ahora sirve para algo
  más**: mientras era de un solo uso, un enlace ya canjeado se revocaba solo y no
  había forma de anular el de alguien que ya había entrado.
- **Y de quitarlo salió una columna** (`cuenta.enlaceExpira`, migración `0020`).
  No es de adorno ni se coló de paso: la pantalla de Cuentas enseña `enlaceVivo`
  para separar «se lo he mandado» de «ya ha entrado», y eso lo contestaba
  `enlaceJti IS NOT NULL` **porque el canje lo vaciaba**. Sin el vaciado esa
  columna no vuelve a ser `NULL` nunca, así que la pastilla se quedaría puesta
  para siempre, también con el enlace caducado hace meses — **peor que no
  tenerla, porque miente**. Con la fecha, `enlaceVivo` pasa a contestar la
  pregunta que ahora importa: **¿hay por ahí un enlace que todavía abre esta
  cuenta?**, que es lo que se mira para decidir si conviene generar otro y
  revocarlo.
- **La fecha no se deduce de nada de lo que ya había**: el `jti` es aleatorio y
  no lleva nada dentro, y el `exp` del pase lo tiene quien lo recibió, no el
  servidor. Sale de `VIGENCIA_ENLACE`, que pasa a exportarse para que el papel y
  la columna no puedan decir cosas distintas.
- **La pastilla cambia de palabras**: «enlace sin usar» → **«con enlace
  activo»**. «Ya ha entrado» lo sigue contestando el renglón de al lado, con
  `ultimoAcceso`, que es de donde salía de verdad.
- **Y el estado `usado` se llama ahora `caducado`**, porque ya no existe el
  motivo que le daba nombre: si un enlace no vale es porque hay otro más nuevo.
  El texto lo dice así — «se ha generado otro más nuevo», sin el «ya se ha usado»
  que mandaba a mirar en el sitio equivocado.

### 14.61 Entrar sin iPhone: un enlace que abre la puerta una vez

- **El defecto:** el acceso lo firma Apple, y esa hoja vive **en la cáscara
  nativa**. Quien no tiene iPhone no es que tenga la app capada: no tiene por
  dónde entrar. Y la guarda que lo escribía —`hayApi()` devolviendo `false` si
  no es nativo (`sync/api.js`)— decía la regla por donde estaba mal dicha: lo
  que decide no es **dónde corre la app** sino **si tiene con qué
  autenticarse**. Mientras la única puerta fue Apple, las dos frases se
  distinguían solo en teoría.
- **✅ El enlace de acceso.** Quien administra lo genera en **Ajustes →
  Cuentas → Entrar sin iPhone**, elige **a la persona** y le manda la dirección.
  Abrirla en cualquier navegador canjea el pase por **la sesión de siempre** —el
  mismo JWT de noventa días que sale de la puerta de Apple—, y a partir de ahí
  no hay nada distinto: la app sincroniza igual y el Worker no se acuerda de por
  dónde entró nadie.
- **Se pide por persona y no por cuenta**, que es lo único que hacía falta
  pensar: quien no tiene iPhone **no está en la lista** de «quién ha pedido
  entrar», porque no ha podido pedir nada. El Worker crea la cuenta si no la hay
  —con `appleSub` prefijado `enlace:`, como `invitacion:`— y le renueva el pase a
  la que ya tuviera, así que generar dos veces no deja dos cuentas.
- **Un enlace es una credencial al portador**, y de ahí salen las tres reglas
  (`api/src/sesion.js`, migración `0016`):
  - **Un solo uso.** El pase lleva un `jti` que se guarda en `cuenta.enlaceJti`
    y se borra al canjearlo. Un JWT no sabe cuántas veces lo han leído, y el
    reenvío a un grupo de WhatsApp es el caso normal, no el raro.
  - **Generar es revocar.** El `jti` nuevo pisa al anterior, así que el botón
    que sirve para «se me ha perdido» sirve también para «ha acabado donde no
    debía». No hace falta un segundo verbo.
  - **Tres días.** Los treinta del pase de espera valen para un papel que solo
    sirve para preguntar; este abre la puerta.
- **El pase viaja en el fragmento** (`#pase=…`), no en la consulta. El fragmento
  no se manda al servidor: no acaba en los registros de Cloudflare, ni en el
  `Referer` de la primera página que se visite después. Y la URL **se limpia al
  recibir respuesta**, no antes: si lo que falla es la red, recargar tiene que
  poder reintentar con el mismo pase, que el servidor todavía no ha quemado.
- **Los cuatro finales se dicen por separado** (`auth/enlace.js`,
  `screens/EnlaceScreen.jsx`): «ya se ha usado» se arregla pidiendo otro, «está
  desactivada» hablando con quien te la cerró, «no vale» copiándolo entero, y
  «sin respuesta» esperando —y es el único que se reintenta—. Con un solo «no se
  pudo entrar», quien lo abre no sabe ni a quién escribirle. La pantalla es la
  pantalla entera, como la sala de espera (§14.29 · B2): quien abre el enlace no
  viene a usar la libreta local.
- **Salir de la demostración antes de entrar** (`App.jsx`). Lo sembrado por el
  Demo lleva su cola de cambios detrás; sin esto, abrir el enlace desde una
  demostración le subiría al grupo un camping inventado.
- **CORS deja de ser decorativo.** La app de iOS no pasa por el navegador, así
  que `ORIGENES_PERMITIDOS` era una lista sin uso; ahora el dominio de Pages
  tiene que estar en ella o el navegador tira todas las peticiones y lo que se
  ve es un enlace que no entra **sin decir por qué**.
- **Lo que sigue igual:** sin sesión, el navegador es exactamente la libreta
  local de siempre —ni el modo local ni el Demo guardan sesión—, y la puerta de
  Apple no aparece en la web, donde no puede funcionar.
- **Lo que queda pendiente:** en el navegador **no hay avisos** —el push va por
  APNs con un plugin nativo—; la app está dibujada a 390 pt, así que en un
  portátil se ve como un móvil grande; y cuando la sesión web caduce a los
  noventa días no hay puerta que enseñar, así que la app vuelve a ser una
  libreta local y hace falta pedir otro enlace.

### 14.62 Tu perfil vive detrás de tu emoji, y «Quién eres» se retira

- **El defecto:** «Quién eres» era un apartado de Ajustes, y nació para contestar
  una pregunta que **ya no existe**: «¿quién eres en este móvil?». Desde §14.42
  lo dice la cuenta —quien administra enlaza cada cuenta con su persona—, así
  que con sesión ese apartado enseñaba una lista que no salía y un rótulo que
  prometía una elección que no había. Lo que quedaba dentro no era una identidad
  sino **tu perfil**: tu emoji, tu foto y tu estado.
- **✅ Y un perfil no es un ajuste.** Es tuyo, se toca a menudo y se mira desde
  cualquier pantalla, que es justo lo contrario del sitio donde estaba: **tres
  toques**, detrás de la rueda que desde §14.52 guarda solo lo que casi nunca se
  cambia. Pasa a la cabecera, detrás de **tu emoji**
  (`components/BotonDePerfil.jsx`).
- **Va antes del punto de sincronizar**, porque el orden de la cabecera es el de
  lo que se toca: **tú · cómo van los datos · los ajustes**. Cuesta 34 pt de la
  fila de 390, que salen de donde sobraban desde que el badge con tu nombre se
  retiró (§14.10) — aquel gastaba 112 y decía menos.
- **El emoji es el botón**, no un icono de cromo: es de las pocas cosas que el
  usuario elige (§14.13), y ponerlo ahí hace que la puerta a tu perfil sea **tu
  cara**. Con foto puesta, la foto; recortada en redondo, que un cuadrado dentro
  de un botón redondeado se ve como un parche.
- **La hoja del estado sustituye a la capa del perfil**, no se monta encima
  (§14.31 · V2). Y es **la misma** `HojaDeEstado` que abre la pastilla de la
  cabecera: una sola pieza para una sola cosa, con sus cinco de siempre, las
  otras cinco de la IA y el «más gracioso».
- **La pastilla de la cabecera se queda** (§14.36) y no es una puerta duplicada:
  su trabajo es **enseñar** tu estado —y pedirlo cuando no lo has dicho—, y
  tocar lo que se ve para cambiarlo es el gesto más corto que hay. El emoji es
  la puerta a **todo** lo tuyo; la pastilla, el atajo a un renglón.
- **La lista de personas sobrevive donde la cuenta no puede contestar**: libreta
  local, demostración, y una persona enlazada que no es de este evento — la
  regla de §14.42, intacta. Con cuenta enlazada no aparece, que es el caso de
  todo el grupo. Borrarla del todo dejaría la demostración y la libreta local
  sin manera de decir quién eres, y ahí no hay nadie que lo diga por ti.
- «Para votar hace falta saber quién eres» ya no manda a un apartado que no
  existe: manda **al emoji de arriba**.

### 14.65 Los avisos se recuerdan cada semana, y el bunga vuelve a su familia

- **El defecto de los avisos:** el permiso se pide en Ajustes → Notificaciones y
  no al arrancar (§14.17), que es lo correcto —un permiso que se pide en el
  primer segundo se contesta que no—. El precio es que **quien no pasa por ahí no
  lo enciende nunca**, y entonces no se entera de un gasto, de la cena de esta
  noche ni de que alguien quiere entrar. Y no lo echa de menos, porque nunca lo
  tuvo.
- **✅ Un recordatorio en «Hoy», cada siete días** (`components/AvisoDeAvisos.jsx`,
  `lib/recordatorioDeAvisos.js`). En «Hoy» porque es la pantalla que se abre
  sola: aparece **donde ya estabas** en vez de ponerse delante de lo que ibas a
  hacer. **No es un modal al arrancar** — se cierra sin leerlo, y encima gasta la
  única hoja de permiso que iOS enseña en la vida de la instalación.
- **Y no es «volver a preguntar», porque no se puede.** Está escrito en
  `lib/native.js` desde §14.17-ter: **iOS enseña su hoja una sola vez**, y
  `requestPermissions()` con el permiso ya denegado devuelve «denied» sin abrir
  nada.
  - `prompt` — nadie ha contestado: lleva **el botón** que abre la hoja, y
    encender hace el camino entero (permiso, identificador de Apple y apuntarlo
    en el servidor), porque los tres hacen falta para que llegue algo.
  - `denied` — ya se dijo que no: **no hay botón**. Lo único cierto es dónde se
    enciende, que es en los Ajustes del iPhone.
- **Dos estados no se recuerdan**: `granted`, que no hay nada que pedir, y
  `sin-plugin`, que **no se arregla desde el teléfono**. Tampoco **en el primer
  arranque**. **«Ahora no»** pone el reloj a cero, y **lo que falla se queda a la
  vista**: encender apunta el recordatorio pase lo que pase, y eso retiraba el
  bloque justo después de escribir el motivo del fallo.
- **✅ El bunga vuelve a la ficha de su familia.** Al partir Grupo en áreas
  (§14.63) la ficha se quedó **sin él**: dónde duerme cada casa es media
  pregunta de esta pantalla, y contestarla obligaba a cambiar de área y buscar la
  fila del bunga cuya familia se acababa de mirar. Vuelve como una fila más de
  las de dentro, con **el nombre** —en un camping un bungalow se busca por su
  número, que es lo que lleva el nombre; el mote va debajo— y **lleva a su
  pantalla**, que es donde están sus notas, sus pegatinas y quién estuvo otros
  años (§14.56). Sin bunga, el renglón lo dice y abre la hoja de elegir: no hay
  pantalla de un bunga que todavía no existe.
- **✅ Y el rastro de «El grupo» en Ajustes se retira.** §14.52 lo mudó a su
  pestaña y dejó un renglón diciendo a dónde había ido. Un cartel de mudanza
  sirve las primeras veces y estorba el resto.

### 14.66 El bunga se resume en una frase, se comenta, y la familia va en pastilla

- **El defecto:** un bunga acumula pegatinas y **notas del sitio** que crecen
  viaje a viaje —«la nevera congela, bájala al 2», «el segundo cuarto no tiene
  enchufe»— y todo eso vivía **dentro** de su pantalla. La lista solo decía el
  mote, así que *cuál es el bueno* —que es la pregunta que se hace al
  repartirlos— no la contestaba nadie sin abrir los seis.
- **✅ Una frase con guasa, escrita por el modelo** (`api/src/bunga.js`,
  encargo `resumenDeBunga`, haiku). Sale bajo el nombre de cada bunga en la
  lista, y el encargo pide dos cosas a la vez: que **diga lo que hay** —lo bueno
  y lo malo— y que tenga la guasa del grupo. Una coña que no dice nada deja la
  lista igual que estaba.
- **Detrás de un botón, no al pintar.** Es la regla de §14.19-bis: la IA entra
  cuando se le pide. Con nueve teléfonos abriendo Grupo, resumir al pintar serían
  nueve llamadas de pago para leer **nueve bromas distintas sobre la misma
  nevera**.
- **Y se guarda en el sitio, no en el móvil** (`alojamientos.resumen`, migración
  `0019`): lo pide uno y lo leen los nueve, y sigue ahí el año que viene, como
  las notas de las que sale.
- **`resumenDe` es la huella de lo que se resumió** (`huellaDelSitio`, puro). Sin
  ella, una frase escrita antes de «se ha roto el aire» se lee igual de
  convincente que una recién hecha, y en una lista que se mira **para decidir**
  eso es peor que no tener ninguna. Con ella, la vieja **se sigue enseñando,
  marcada**: esconderla dejaría la fila peor que antes —sin frase y sin saber que
  la hubo—.
- **Con el sitio en blanco no se pide.** Sin pegatinas ni notas, lo único que
  puede hacer el modelo es inventarse cómo es el bungalow.
- **✅ Comentarios en el bunga** (§14.55, la misma pieza que en un plan, un gasto
  y un día). Es de las cosas que más se comentan —«¿os importa cambiarlo?», «se
  ha vuelto a ir la luz»— y era de las pocas que no tenía dónde. La fila cuenta
  los que hay y enciende el punto de los que no has visto.
- **A quién avisa: a la familia que duerme ahí**, y a quien ya escribió en el
  hilo. Es el criterio del gasto —a quién le toca— y no el del día —todos—:
  despertar a las otras ocho casas por «¿os importa cambiarlo?» es lo que hace
  que se apaguen los avisos. Y **tocarlo abre ese bunga** (§14.60):
  `destinoDeAncla` lo mandaba a «Hoy», que para un hilo que sí existe es mentir.
- **✅ De quién es, con el emoji y el alias** (`Alias.jsx`) en vez del nombre
  entero. Es la misma pareja que firma una idea y un voto, así que las cosas de
  una familia se reconocen **sin leer ningún nombre** — y cabe al lado de una
  frase larga, que «— de nadie —» y «Solteros» no.
- **✅ Y el estado de la familia se retira.** Quien dice en qué anda es **cada
  persona** (§14.36), y dos estados encima del mismo grupo se contradicen sin que
  nadie los actualice: el de la familia lo ponía uno en junio y ahí se quedaba. La
  columna sigue en la base —no se tira una columna para dejar de escribirla— y
  deja de viajar (`api/src/tablas.js`), que es lo que importa.

### 14.66-bis El resumen se rehace solo, y el botón se retira

- **Pedido expreso**, y va contra lo que decidió §14.66 media hora antes: allí la
  frase se pedía con un botón, por la regla de §14.19-bis —la IA entra cuando se
  le pide—. Queda escrito por si dentro de seis meses alguien lee las dos cosas
  seguidas y no entiende cuál manda: **manda esta**.
- **✅ En cuanto cambia una nota o una pegatina, la frase se rehace.** No hay que
  acordarse de pulsar nada, que era el defecto real del botón: quien apunta «se
  ha roto el aire» está apuntando eso, no pensando en el resumen — y la frase se
  quedaba vieja con el aviso puesto.
- **Lo que impide que esto sean nueve llamadas es dónde vive**: dentro de la
  **pantalla de un bunga**, que es la que abre quien lo está tocando. La lista no
  pide nada, solo enseña lo guardado. Esa era la mitad importante del argumento
  de §14.19-bis, y se conserva entera.
- **Tres guardas**, y las tres son la diferencia entre «se actualiza solo» y «se
  llama sin parar»:
  1. **La huella** (`huellaDelSitio` ≠ `resumenDe`): abrir el bunga cuarenta
     veces no pide nada, porque no ha cambiado nada.
  2. **Un respiro de 1,5 s**: marcar tres pegatinas seguidas son tres escrituras
     y **una** llamada. Sin él, cada toque paga la suya.
  3. **Una sola vez por huella**: si el modelo falla —sin clave, sin red— no se
     reintenta en bucle contra la misma versión del texto.
- **El único botón que queda es el de recuperarse de un fallo**, y solo aparece
  cuando lo ha habido. Pedir la frase ya no se pide; volver a intentarlo cuando
  no había clave de IA, sí — si no, el único camino sería tocar una pegatina y
  destocarla.
- Mientras se rehace, la frase vieja **se sigue leyendo** y el renglón dice
  «Rehaciéndola con lo último…» en vez de marcarla como desfasada: es verdad
  durante dos segundos y ya se está arreglando.

### 14.66-ter La familia por su nombre, y la evaluación debajo y redactada

- **Las dos letras obligaban a traducir.** La pastilla decía «GA» (§14.66), que
  es la firma de `Alias.jsx` y funciona **donde firma algo** —una idea, un voto—:
  ahí la pregunta es «¿de quién es esto?» sobre una lista de cosas de gente
  distinta, y las dos letras se leen de un vistazo. Aquí la pregunta es **«¿quién
  duerme en el 12?»**, y eso se contesta con un nombre. Traducir cada vez cuesta
  más que los 30 pt que ahorra. **Va el nombre, y el emoji se queda de seña.**
- **✅ Y la evaluación baja a su propio renglón, a lo ancho.** Estaba en el
  subtítulo de la fila, o sea compitiendo por el ancho con el nombre del bunga y
  con la pastilla de la familia: quedaban unos 150 pt de los 390 para una frase
  que ahora está redactada. Debajo y sangrada hasta donde empieza el nombre caben
  **dos líneas** sin recortar nada, y el mote vuelve a su sitio, bajo el nombre.
- **✅ Sin coña, a petición.** §14.66 pedía guasa; se corrige media hora después
  y **manda esta**. El motivo, escrito para dentro de seis meses: **la gracia ya
  la ponen las notas** —las escribe el grupo, y son suyas—, así que un chiste
  encima de ellas es una capa de más. Lo que hace falta al repartir los bungas es
  que alguien te diga cómo es: lo bueno primero, lo malo después, concreto. El
  encargo prohíbe además el otro extremo, el lenguaje de folleto —«acogedor»,
  «ideal»—: es lo que le contarías a un amigo que pregunta qué tal está.
- **El tope sube de 90 a 180 caracteres.** Noventa era lo que cabía compartiendo
  renglón, y obligaba a elegir entre decir lo bueno o decir lo malo.

### 14.66-quater El comentario que propone la ballena, y sale de cómo es el sitio

- **El defecto:** en el hilo de un bunga había un botón para mandar y ninguno
  para escribir. La evaluación —«la nevera va sobrada; hay bichos en la
  terraza»— estaba tres dedos más arriba en la misma hoja y **no la usaba
  nadie**: comentar seguía siendo empezar de cero delante de una casilla vacía,
  que es donde se abandona la mitad de los hilos.
- **✅ «Que lo escriba la ballena» trae uno, y trae uno de este bunga.** Al
  material del resumen (§14.66) se le añaden dos cosas: **la evaluación** —lo que
  se pidió que tuviera en cuenta— y **los últimos seis del hilo**. Sin la
  primera, lo que sale vale para cualquier bungalow del camping —«¡qué ganas
  ya!»—, que es lo mismo que no escribir nada; sin la segunda, repite lo que hay
  justo encima. El encargo lo dice con esas palabras y es editable como todos
  (`comentarioDeBunga`, `api/src/bunga.js`).
- **No se manda: rellena la casilla.** La figura de «Mejorarla» de una idea
  (§14.19-ter) y de «Más gracioso» del estado (§14.36) — se corrige, se borra o
  se envía, y **lo firma quien pulsa**. Un hilo donde escribe la app deja de ser
  una conversación; uno donde a alguien le cuesta menos arrancar, no.
- **✅ Y se puede volver a pulsar.** «Otro distinto» le manda **los que ya ha
  traído** (`yaPropuestas`, en memoria y sin guardarse en ningún sitio): sin eso,
  el segundo toque devuelve el primero con otras palabras y el botón parece
  roto. Se vacía al mandar el comentario, que es cuando la tanda deja de valer.
- **`sugerir` es una prop opcional de `Comentarios`**, y por eso el componente no
  ha tenido que aprender qué es un bunga: recibe una función y le pasa lo único
  que él sabe y quien enchufa no —el hilo y lo ya propuesto—. **Hoy la pasa solo
  el bunga**: el plan, el gasto y el día no tienen ninguna evaluación detrás de
  la que hablar, y un botón de IA en los cuatro sitios sería IA por tenerla.
- **Sonnet fijado**, como «Mejorar la redacción de una idea»: esto lo va a mandar
  una persona con su nombre debajo, y un comentario que no aterriza es peor que
  ninguno. Se pulsa poco y solo cuando alguien quiere, al revés que la
  evaluación, que sale sola y va con haiku.
- **Del hilo viaja lo que se dijo, nunca quién lo dijo** — la regla de §14.19-bis,
  y aquí además el autor no aporta nada.

## 15. Registro de decisiones

### 14.78 Quien se va unos días deja de contar

El grupo no está entero toda la semana: alguien llega el miércoles, alguien se
vuelve el viernes. Hasta ahora la única forma de sacar a alguien de las cuentas
era **borrarlo**, que se lleva por delante todo lo que ya había apuntado a su
nombre — y por eso no lo hacía nadie, y la compra y el reparto seguían contando
a quien estaba en su casa.

- **✅ Un interruptor en su ficha**, «Se ha ido unos días» (Grupo → Familias →
  la persona). **Sin fechas**, que es lo que se pidió: unas de ida y vuelta
  obligan a decidir qué pasa con el gasto apuntado el martes por quien se fue el
  miércoles, y aquí no hay nada que decidir — cuenta o no cuenta.
- **Lo tocan los adultos**, que es la línea que ya decide todo lo demás de esta
  pantalla: `puedeEditarFamilia` (§14.63) — un adulto de su casa, o quien
  administra. No hace falta regla nueva.
- **En «Nueva persona» no se pregunta**: un interruptor que dice «no está» en
  alguien que se está creando pregunta por un estado que todavía no significa
  nada.

**Dónde deja de contar** (tres sitios, y los tres en la lógica pura para que no
se pueda olvidar uno):

| dónde | qué cambia |
| --- | --- |
| `reparto-gente.js` · `genteDeAtajo` | «Todos» y «Mayores» son **los que están**. Meter a los Pérez en la paella del martes que se volvieron a casa es cobrarles una cena que no se comen. |
| `compra.js` · `racionesPorMesa` | Quien no está **no come**. Se filtra dentro y no en cada quien llama —son dos, `db.js` y `lib/borrados.js`— porque olvidarse en uno deja la compra de una semana contando a alguien que no está. |
| `planes.js` · `quienFaltaPorVotar` y `cacharros.js` · `quienesPuedenVotar` | **No se le espera**. Un plan del jueves con «faltan 3 por votar» que son los tres que se fueron el martes no se cierra nunca. |

**Y dónde sigue contando, a propósito**: `votosDe` no mira la ausencia, así que
el 👍 que dejó antes de irse **no se pierde**; y **lo ya apuntado a su nombre no
se toca** — `participantIds` vive dentro de cada gasto, así que ningún saldo se
mueve al marcar a alguien.

- **Se aparta, no se esconde** (la regla de §14.10-quater). Sigue en su familia,
  en su sitio y en la lista de «Entre quién se divide», con «fuera ·» delante de
  la edad y el avatar a media tinta. Poder marcarlo a mano es el caso legítimo:
  la garrafa de aceite se compró cuando estaba. Lo que se quita es que entre
  **solo**.
- **El recuento de la familia dice las dos cosas**: «1 persona · 1 fuera». «2
  personas» de una casa donde una se ha vuelto es el número con el que nadie
  hace la compra.

**Dos defectos que habría metido esta vuelta y se vieron en el navegador**, no en
las pruebas:

- **La ficha de un gasto tenía la regla escrita dos veces.** `FichaDeGasto.jsx`
  arrancaba con `persons.map((p) => p.id)` en vez de `genteDeAtajo('todos', …)`,
  así que el renglón seguía diciendo «Entre todos (6)» con la sexta persona en su
  casa. Ahora hay un solo sitio que define «Todos».
- **Todo gasto nuevo habría salido marcado como raro.** `comoSeReparte` decía
  «lo normal no se anuncia» comparando contra el censo entero; con alguien fuera,
  el reparto normal pasaba a ser «entre 5» de 6. Ahora **hay dos normales** —el
  grupo entero, que es como se apuntaron los gastos de antes, y el grupo que está
  hoy— y ninguno de los dos se anuncia. Lo mismo en `estadoDeFamilia`: sin
  tocarlo, la casilla de cualquier familia con alguien de viaje se quedaba con la
  raya de «a medias» **para siempre**, señalando como raro su estado normal.

**Lo que no cambia y conviene saber**: el «gasto medio por persona» de Números
divide por el censo entero, porque es una media de todo el viaje y quien se fue
estuvo parte de él; y la tira de «Quién anda en qué» sigue enseñando el estado de
quien se ha ido, que es suyo y lo puso él.

**Base de datos**: `persons.ausente INTEGER` (migración `0023`). Nulo = está, así
que las filas de antes quedan bien sin tocarlas — la misma regla que `esMayor`
con la edad desconocida. **Quien administra tiene que aplicarla** en Ajustes →
Actualizar.

### 14.77 Una familia trae los cacharros que quiera

El tope de **uno por familia** (§14.57 · G1) se retira. La fila de apuntar
desaparecía en cuanto se traía el primero, así que el segundo **no tenía por
dónde entrar**: quien llega al camping con la nevera y el proyector solo podía
apuntar uno de los dos, o reescribir el que ya tenía puesto.

- **✅ La fila de apuntar se queda siempre.** Antes la lista de abajo eran «las
  familias que aún no han traído nada»; ahora son **todas**, y el renglón dice
  cuántos lleva cada una —«sin cacharro este año», «trae uno», «trae dos»—, que
  es lo que hace falta saber para decidir si añadir otro y para no apuntar dos
  veces la misma nevera. El verbo cambia con ello: **«+ Cacharro»** la primera
  vez y **«+ Otro»** después.
- **El voto sigue siendo uno por cabeza** (G2) y **nadie vota el suyo** (G3).
  Nada de `lib/cacharros.js` cambia: `puedeVotar` mira la familia y no la fila,
  así que con tres entradas de los Pérez ningún Pérez puede votar ninguna.
- **Lo que sí cambia y conviene decir**: con tres entradas se tienen **tres
  oportunidades** de llevarse el voto único de cada uno de los demás. Es otra
  ventaja de traer mucho, como ya lo era el tamaño de la familia, y va en la
  misma cuenta de que esto es **un juego y no unas elecciones** — que es lo que
  §14.57 ya decía al lado del ranking en vez de esconderlo.
- **Por qué el tope no era lo que hacía el ranking.** El comentario de `db.js`
  decía que «uno por familia» es «lo que lo convierte en un ranking y no en una
  lista». No lo es: lo que lo convierte en ranking es el **voto único**. Con 👍
  múltiple los tres empatan a nueve tengan una entrada o cinco; con elección hay
  ganador aunque haya quince. El tope solo quitaba entradas.
- **Sin cambios en la base**: `cacharros` ya tenía una fila por cacharro con su
  `familyId`; lo único que había era un filtro en la pantalla. Y la sección tenía
  **cero pruebas de pantalla** —solo las del módulo puro—, así que esta vuelta
  estrena `CacharrosSection.test.jsx`.

### 14.76 En la capa del día la cena se nombra, incluida la de los niños

El renglón de «La cena» decía **«dos platos · los niños, otra cosa»**, en la
pantalla a la que se entra justamente a saber qué se cena. Era el último sitio de
la app donde faltaba la regla de §14.69 —**se nombra en vez de contar**—, y de
las dos mitades la peor era la segunda: «los niños, otra cosa» avisa de que hay
una respuesta distinta y **no la da**.

- **✅ El titular lleva los principales y el renglón lo que acompaña**
  (`acompanan`, `lib/dias.js`, puro). No hay que adivinar qué nombró el titular:
  `titularDePlatos` nombra principales, así que lo que le queda al renglón es
  exactamente el resto. Sin ningún principal titula el primer plato y acompaña
  todo lo demás. Se ordenan por la carta —aperitivo a postre— y no por el orden
  en que se marcaron.
- **✅ Los niños tienen su propio renglón**, no un trozo encadenado con un punto
  medio. Medido a 257 pt, que es el ancho útil de la fila de la capa:
  «Ensaladilla rusa, Pan con tomate y 3 más · los niños, Nuggets» son 61 letras,
  dos líneas en Grande y **tres** en Enorme. Partidos en dos, cada uno se lee
  entero. Con mesa propia y sin platos apuntados se dice —«otra cosa, sin
  apuntar»— en vez de callarse; **mientras hereden no se dice nada**, que es lo
  que pasa siete noches de ocho.
- **✅ Y aquí no hay tope: se nombran todos.** `LETRAS_DEL_RENGLON` son 36 y
  existe para la **lista** de días, donde la fila no parte línea y ocho tienen
  que caber en 594 pt. Esto es otra cosa: una fila sola, que parte línea, en una
  capa que ya rueda. Con el tope puesto, la cena de seis platos del camping decía
  «Aceitunas y altramuces y 4 más» — o sea que seguía contando, que es
  exactamente lo que se venía a quitar. Medido con esa cena: la fila pasa de 70,7
  a **188,4 pt** en Grande y 208,7 en Enorme, y la capa sigue en su tope de 658,3
  con los bungas y el plan a la vista.
- **Un renglón vacío no se pinta** (la regla de §14.74): con un solo plato el
  titular ya lo dice todo y debajo no va nada, en vez de un `div` en blanco que
  ocupa su línea igual. `renglon()` acepta un segundo subtítulo (`s2`) y los dos
  se separan **4 pt** en `theme.css`: pegados, dos frases de la misma letra y el
  mismo color se leen como un párrafo.
- **Solo cambia el modo montar.** En lectura la capa ya enseñaba las dos cartas
  enteras con `ListaDePlatos` desde §14.30; lo que contaba era el otro modo, que
  es donde se estaba mirando.

### 14.75 La hora cabe en su pastilla, y se escoge a pulsos

Decidido en `docs/diseño/hora-que-quepa.html` · **C2 · S4**. La hoja midió dos
preguntas que resultaron ser una: **si el selector solo da horas en punto, la
pastilla deja de tener un problema**.

**Antes de las opciones, la hoja encontró dos defectos** y los dos se arreglan
aquí:

- **La maqueta que decidió §14.73 ya se salía.** `plan-con-hora.html` · V3 dibujó
  la pastilla con dos renglones y luego metió «10:30» entero en el de arriba: a
  13 px mide **41,4 pt** y la caja **34**. No se vio porque sus cinco insignias
  `data-mide` medían la tarjeta de cuatro renglones, que mide lo mismo con la
  hora dentro que con la hora fuera.
- **La letra de la pastilla no pasaba por `--escala`** (`13px` a pelo): la hora
  medía igual en Normal que en Enorme, o sea que quien agranda la app lo
  agrandaba todo menos la hora.

**C2 · dentro va «20h», no «20:00».** Sin los minutos cabe en una línea y con
aire, y el cuerpo cuelga de la escala: `calc(12px * var(--escala))`. Medido en
las tres tallas, «20h» da **25,3 · 28,3 · 31,8 pt** en una caja de 34 — cabe
hasta en Enorme, que es lo que fija el número: con 13 px de base se salía por
medio punto. Los 13,4 px de Grande son además un pelo **más** que los 13 fijos de
antes. Sin el cero de delante: «9h» y no «09h».

**S4 · menos, la cifra y más.** Fuera el `<input type="time">`, que sacaba el
disco del sistema: dos rodillos y **1.440 posiciones para una decisión de 24**,
con las 20:45 tan fáciles de poner sin querer como las 20:00 porque el segundo
rodillo arranca donde esté el reloj del móvil. El renglón mide **60 pt** —los que
sustituye medían 61,6—, cabe bajo cada plan marcado sin sacar el elegidor de su
capa, y las dianas son de 44, el mínimo de Apple.

- **Da la vuelta en los dos extremos**: 23h → 0h y 0h → 23h. Sin eso, el plan de
  medianoche no se puede poner subiendo desde las 20h, y el camino más corto
  entre dos horas cualesquiera nunca pasa de doce toques. Es lo que le quita
  hierro al coste conocido de S4 —que llegar es a pulsos, y de 20 a 9 son once—.
  Es **un dial sobre las 24 horas de ese día**, no aritmética sobre una línea de
  tiempo: 0h es el principio del día, no el final. Es lo mismo que hacía el disco.
- **Sin hora puesta sale «Poner hora», y pone las 12h.** Es el punto del día desde
  el que ninguna hora queda a más de doce toques, y desde el que las de un camping
  —la playa por la mañana, la cena por la noche— quedan a cuatro y a ocho. Con
  rejilla no habría hecho falta ninguna; con un paso a paso hay que elegir.

**Lo viejo con minutos se redondea, y por dos caminos.** C2 solo es honesta si
nada puede guardar «20:45», así que:

- **La regla vive en la puerta**, no en la pantalla: `addPlan` y `updatePlan`
  (`db.js`) fuerzan la hora en punto. Vale también para lo que llegue de un
  cliente viejo por la cola de cambios, que es lo que una comprobación en el
  elegidor no cubre.
- **Se redondea hacia abajo, nunca al más próximo**: subir las 23:46 a las 00:00
  cambiaría el plan **de día**, y un plan que salta a la madrugada siguiente es
  peor error que uno adelantado 46 minutos.
- **El instante se rehace siempre que venga la hora.** Redondear sin mover
  `cuando` dejaría el aviso sonando a las 10:30 de un plan que en pantalla pone
  «10h» — la clase de desfase que no se ve hasta que suena el teléfono a la hora
  que no es.
- **Y un barrido al arrancar** (`redondearHorasDePlanes`, llamado desde
  `App.jsx`): la puerta se ocupa de lo que se escriba a partir de ahora, pero un
  plan que nadie vuelva a abrir se quedaría con sus «23:46» y con la pastilla
  enseñándolos enteros, saliéndose de la caja. Lee, y si no hay nada que
  redondear no escribe; que los nueve móviles lo corran a la vez no rompe nada,
  porque los nueve escriben el mismo valor.
- **Mientras tanto, la pastilla no miente**: `horaCorta` enseña **entera** una
  hora que todavía lleve minutos. Decir «10h» donde pone «10:30» es la única
  forma de que mienta, y caber no vale ese precio — se sale de la caja hasta que
  se guarde, y guardarla es abrir su día o reabrir la app.

**Lo que no se eligió y por qué se descartó**, para no rehacer el camino: C1 (dos
renglones siempre) dejaba el minuto a 10 px, por debajo de todo lo demás de la
app; C3 (caja de 48) costaba 14 pt de título en los cuatro renglones y dejaba el
icono nadando; C4 (letra a 10 px) cabía por 2,2 pt que desaparecen al colgarla de
la escala; S1 (rejilla de 24 en hoja propia) es mejor selector pero pedía un
componente y un nivel de navegación; S2 y S5, desplegadas en su sitio, piden 222
y 170 pt **por plan marcado** en una capa cuyo tope son 658,3.

### 14.74 En «Hoy» un plan no dice «A votación», y tocarlo lo abre

Dos peticiones de una pantalla, y debajo de la primera un valor muerto que
llevaba cinco vueltas dando falso.

- **✅ «A votación» se retiró de la lista de planes de «Hoy».** Los cuatro planes
  del día lo decían, y no por casualidad: es el estado de origen de todo plan,
  así que la línea repetía cuatro veces lo que ya se sabe por estar mirando una
  lista de planes. Ahora **solo se dice lo afirmativo** —«Se hace», y el sitio si
  lo hay— y sin nada que decir el subtítulo **no se pinta**, que no es lo mismo
  que pintarlo vacío: la fila baja de 70,7 pt a 56.
- **✅ Y tocar un plan lo abre.** Llevaba a la pestaña de Planes y ahí te dejaba,
  con la lista entera delante y el plan que acababas de tocar en algún sitio de
  ella. **El mecanismo ya existía**: `abrirFila` está desde §14.60 para que un
  aviso tocado abra la fila de la que habla, y `PlanesScreen` ya lo consume
  esperando a que los planes estén; solo estaba cableado al camino del aviso.
  `onGoTab` pasa a ser `irA(destino, fila)` en `App.jsx`, y **pone también el
  área**: Planes tiene tres —Planes · Ideas · Trucos— y las recuerda
  (`lib/areas.js`), así que quien se dejó abierto el catálogo habría llegado a
  Ideas y el plan no se habría abierto en ninguna parte.

**El valor muerto.** Debajo de «A votación» había una comparación que **nunca
podía dar verdadero**: `plan.estado === 'confirmado'`. Los estados de un plan
son `'sehace'` y `'votando'` desde §14.59, y `'confirmado'` es de antes; el único
sitio del código que lo escribía era **el sembrado del Demo** (`db.js`). O sea
que la app decía «A votación» en todos los planes de todos los eventos, y en el
Demo —el único donde alguien lo habría visto raro— decía lo correcto. Estaban
afectados **seis sitios**, y se arreglan los seis porque son el mismo defecto:

| dónde | qué salía mal |
| --- | --- |
| `screens/HoyScreen.jsx` | «A votación» en todos los planes del día |
| `lib/dias.js` · `titularDeHoy` | lo mismo en el titular grande |
| `screens/DiasScreen.jsx` · `notaDePlan` | un plan decidido enseñaba sus votos y quién falta, que es justo lo que §14.59 quitó |
| `lib/stats.js` | «Planes confirmados» decía **0 de N** en todos los eventos |
| `lib/recados.js` | un plan ya decidido seguía «esperando votos» |
| `db.js` · sembrado del Demo | el único sitio que escribía el valor viejo |

Todos pasan a `seHace()`, el predicado que §14.59 dejó escrito en
`lib/planes.js` precisamente para esto, con su nota de que un plan sin estado
también se vota.

- **Lo que hizo que durase cinco vueltas fueron las pruebas.** No es que faltasen:
  había cuatro, y **las cuatro fijaban el valor muerto** —sembraban
  `estado: 'confirmado'` y comprobaban que salía «Confirmado»—, así que pasaban
  en verde mientras la pantalla decía lo contrario. Una prueba que se escribe con
  el mismo dato que el código compara no comprueba nada: comprueba que dos copias
  del error coinciden. Ahora siembran `ESTADO_SE_HACE` —la constante, no la
  cadena— y hay una nueva que dice lo que se pidió: **un plan a votación no dice
  que está a votación**.

### 14.73 La hora de un plan, el día en orden y el aviso una hora antes

Decidido en [`docs/diseño/plan-con-hora.html`](diseño/plan-con-hora.html) ·
**H3 · S1 · A1 · V3**.

- **Eran dos encargos de tamaños muy distintos.** La hora y el orden son un campo
  y un `sort`; el aviso a la hora justa es otra cosa, porque **nada en esta app se
  disparaba solo**: los cinco avisos que había salían todos de
  `POST /api/cambios`, o sea porque alguien acababa de tocar algo.
- **✅ H3 · el instante lo calcula el móvil.** `plans.hora` («20:00», local) y
  `plans.cuando` (el mismo momento en epoch), migración `0022`. `dia` y `hora`
  son tiempo **local** y el Worker corre en **UTC**: Madrid es +2 en agosto y +1
  en enero, así que convertir allí obliga a deducir un desfase. El móvil ya sabe
  el suyo. `instanteDe` (`lib/horas.js`) es **la única línea de todo esto que
  sabe de husos horarios**, y vive donde está la respuesta — la misma figura que
  los IDs de cliente, y la misma cicatriz que dejó `toISOString()` corriendo los
  días un día atrás.
- **✅ A1 · un cron cada cinco minutos**, y es **lo primero de esta app que se
  dispara solo** (`[triggers]` en `wrangler.toml`, `scheduled` en `index.js`).
  288 ejecuciones al día sobre un tope gratuito de 100.000.
- **La ventana es «ya entra en la última hora y todavía no ha pasado»**, no
  «faltan exactamente sesenta minutos». Con lo segundo bastaría **una pasada
  perdida** —un despliegue, un pico— para que el aviso no saliera nunca; con
  esto, la siguiente lo recoge. Lo que impide que salga doce veces no es la
  ventana sino `avisadoEl`.
- **Y se marca antes de mandar.** Si APNs falla a medias se pierde un aviso;
  marcando después, un fallo dejaría el plan sin marcar y volvería a intentarlo
  **cada cinco minutos hasta la hora**. Un aviso perdido es mejor que doce
  repetidos.
- **`avisadoEl` no está en `tablas.js`**, a propósito: es del servidor, y dejarlo
  fuera de lo que acepta `aplicarCambio` es lo que impide que un cliente lo borre
  y desate la tanda de doce. Viaja en la instantánea —`SELECT *`— y no molesta.
- **Un plan ya empezado no avisa**: apuntar a las 21:30 algo que era a las 21:00
  no puede disparar un recordatorio de algo que ya está pasando.
- **✅ «Una hora antes» es una clase de aviso propia**, la sexta. Por la regla de
  §14.39 —se guarda lo apagado, no lo encendido— **nace encendida para todo el
  mundo** sin tocar ninguna fila, que es justo lo que se quiere. `personIds` va
  en `null`, «el grupo entero», como en `avisoDeEstado`: aquí no lo provoca una
  persona sino el reloj, así que no hay a quién excluir.
- **✅ S1 · los sueltos al final.** Los que tienen hora son el esqueleto del día y
  van de menor a mayor; «Día de playa» no empieza a ninguna hora, y ponerlo entre
  las 10:30 y las 20:00 sería inventarse una. `porHora` es estable, así que dos a
  la misma hora no bailan en cada pintada. Sin hora, el renglón lo **dice** —«a
  lo largo del día»—, que es lo que explica por qué está abajo.
- **✅ V3 · la hora ocupa el sitio del icono**, midiendo lo mismo (34 × 34) y con
  cifras de ancho fijo. Lo que se decidió ahí **no fue el alto**: las tres
  opciones medían 96,7 pt. Fue que la hora metida en un titular que parte por
  donde le toca queda a cuatro alturas distintas con cuatro planes, y así no se
  lee de un vistazo; en el sitio del icono está siempre en la misma x. El icono
  que sustituye es una chincheta igual en los cuatro.
- **La hora se pone en el elegidor y solo sobre los planes ya puestos en ese
  día**, porque una hora es **del día y no de la idea**: «Kayak» no es a las
  diez, es a las diez *el martes*. Por eso el campo sale al marcarlo y
  desaparece al desmarcarlo, y **quitar un plan del día le quita la hora** — si
  no, reaparecería al colocarlo en otro día distinto.
- **Lo que queda fuera y hay que saber:** mover la hora de un plan **ya avisado
  no vuelve a avisar**, porque `avisadoEl` no se limpia y un cliente no puede
  tocarlo. Es lo prudente por defecto —cambiar dos veces una hora no son dos
  avisos a nueve teléfonos—, pero significa que adelantar un plan tres horas no
  se anuncia.
- **Y la cena sigue sin hora**, así que en un día ordenado flota fuera de la
  fila. Está dicho en la hoja y sin decidir.

### 14.72 El elegidor de bunga dice cuántas veces ha acogido cada uno

- **El defecto:** la pregunta que se hace al abrir ese elegidor no es «¿cuál es
  cuál?» —eso ya lo contesta §14.31 · B1, con la familia mandando y el alias de
  seña— sino **«¿a quién le toca?»**. Y eso se contestaba de memoria, o yéndose a
  **Números** a mirar el balance de anfitrión: otra sección, y el día a medio
  montar detrás.
- **✅ Cada fila lo dice** en su renglón de abajo, donde había sitio: «El del
  ruido · **3 veces**», «El de la piscina · **aún ninguna**».
- **El cero se dice**, y es lo contrario de la regla de §14.38 —«el cero no se
  dice»—. Allí es la ausencia de un dato; aquí **es la respuesta**: el bunga que
  no ha acogido todavía es justo el que se está buscando.
- **Sin la noche que se está decidiendo** (`excepto`). Al reabrir el bunga de una
  noche ya repartida, contarla inflaría a quien está puesto y la cuenta dejaría
  de contestar lo que se le pregunta, que es a quién le toca **aparte de esta**.
- **Una noche puede sumar dos** —el mismo bunga acoge a mayores y a niños—, y
  está bien: son dos mesas que montar y dos que recoger.
- **Y una noche fuera no la acoge nadie** (§14.70-bis), que es la misma guarda
  que ya llevaba Números.
- **La cuenta se extrae a `lib/anfitrion.js`** (`anfitrionPorBunga`), y esa es la
  decisión de fondo: ahora la leen **dos** pantallas —el balance de Números y
  este elegidor—, que son la misma pregunta en dos momentos, «¿cómo ha quedado
  el reparto?» y «¿a quién le toca hoy?». Dejarla copiada en `computeStats` y
  escrita otra vez aquí es la clase de cosa que se desfasa en silencio y acaba
  con dos pantallas dando números distintos para lo mismo — el mismo motivo por
  el que §14.70 sacó `titularDeFuera` a un solo sitio.

### 14.71 En el día se ven todos los planes, uno por renglón

- **El defecto, en pantalla:** el martes 18 de Ballenita’26 tenía cuatro planes y
  la capa del día enseñaba **uno**: «Torneo de pingpong comunitario **y tres
  más**». Para saber cuáles eran los otros tres había que abrir el elegidor —
  que es la herramienta de **cambiarlos**, no la de mirarlos—, y encima allí
  salen mezclados con los libres del viaje.
- Es **la misma corrección que §14.69** hizo en la lista de Días —nombrar en vez
  de contar—, pero aquí ni siquiera hacía falta apretar: en la lista el titular
  es una línea de 289 pt que no parte, y **la capa rueda**. Un plan más son
  **56,4 pt** y no hay nada que recortar.
- **✅ Un renglón por plan**, cada uno con **su** nota —«Confirmado», o
  «1 👍 · faltan 4 por votar»—. Con el renglón único los votos **solo salían
  cuando había un plan**: con dos o más se cambiaban por «11 planes libres por
  traer», que es una tarea de montar el día y no un dato de lo que se hace.
- **Todos abren el mismo elegidor**, así que «cada renglón abre su elegidor»
  (§14.30) se sigue cumpliendo y no hace falta ningún control nuevo.
- **El rótulo va en plural cuando toca**: «El plan» con uno, «Los planes» con
  varios. Un encabezado en singular sobre tres filas se lee como un error.
- **Sin planes no cambia nada**: sigue el renglón de «Nada apuntado» con su
  cuenta de libres por traer y su apagado cuando no hay ninguno.
- **Lo que se vio en el navegador y no en las pruebas:** React avisaba de
  **claves repetidas**. `renglon()` traía `clave = null` de fábrica y varios
  hermanos con `key={null}` son, para React, la misma clave; con los renglones
  fijos de siempre no se notaba, y la primera lista de verdad lo destapó. Ahora
  cada renglón lleva la suya —`'cena'`, `'mayores'`, `'ninos'`, el `id` del
  plan—, que además es lo que le deja conservar la identidad al reordenarse.

### 14.70-bis O se cena fuera, o se reparten bungas — y el día se nombra en el aviso

Dos remates de §14.70, y uno de ellos tapa un fallo que aquella vuelta dejó
puesto sin verlo.

- **✅ Los bungas se retiran cuando se cena fuera.** Son **alternativas**, no dos
  preguntas del mismo día: esa noche no acoge nadie. §14.70 ya contaba el día
  como completo sin ellos, pero los dos renglones se quedaban en pantalla,
  **ámbar y perpetuamente a medias**, pidiendo algo que no se puede contestar —
  la capa decía una cosa y el semáforo otra.
- **Lo elegido no se borra**, igual que los platos: vuelve entero al volver al
  camping. Lo que se retira es **la pregunta**, no la respuesta.
- **✅ Y el balance de anfitrión deja de contarlas** (`lib/stats.js`). Esto era un
  **fallo latente de §14.70**, y su spec llegó a afirmar lo contrario —«el
  balance de anfitrión no la cuenta, porque no tiene bungas que contar»—, que
  solo es verdad si nunca se pusieron. Poner los bungas y luego marcar «se cena
  fuera» le apuntaba a alguien una noche de anfitrión **por una noche en la que
  estaba en el chiringuito**. Se ve en Números y no en la capa del día, que es
  por donde no se mira.
- **✅ El aviso de un comentario en un día lo nombra en palabras**
  (`api/src/avisos.js` · `diaEnLetras`): salía «ha comentado en «2026-08-15»» —el
  `id` en crudo, que es la fecha tal como la guarda la base— y en la pantalla de
  bloqueo se lee como una avería. Ahora, «ha comentado en el sábado 15 de
  agosto», **sin comillas**: entrecomillar una fecha la convierte en el nombre
  de algo.
- **La fecha se compone a mano y en UTC**, como el importe: el Worker no lleva
  datos de locales, así que `toLocaleDateString('es-ES')` devuelve el inglés o la
  fecha en crudo según dónde corra — y eso no se ve al probarlo, se ve en el
  móvil de otro. En UTC porque la fecha viene sin hora y leerla en local la
  correría un día atrás al oeste de Greenwich.
- **Lo que ya estaba bien y se comprobó antes de tocar nada:** un comentario en
  un día **ya avisaba a todo el grupo** desde §14.55 (`avisoDeComentario`, rama
  `tipo === 'dia'` → todas las personas menos quien escribe), y el hilo del día
  se ve sin permisos. Se verificó de punta a punta por `sobresDeLosCambios` con
  la forma real de la instantánea, no solo por la función pura. Lo único que
  puede dejar a alguien sin recibirlo es lo de siempre: no tener cuenta enlazada,
  no tener el aparato con avisos, o llevar apagada la clase **«Comentarios»** —
  que apaga los de un plan, los de un gasto y los de un día a la vez.

### 14.70 Noches que se cena fuera, y dónde

- **El defecto:** no había forma de decirlo. Las noches de chiringuito se
  apuntaban como **plan** —«Tardeo cena de chiringo», «Cena en la playa con
  música!»— porque era el único sitio donde cabía escribirlo, y de ahí salían
  tres cosas mal a la vez: el día decía **«sin cena»** teniendo la cena decidida,
  el semáforo no se ponía verde nunca porque le faltaba justo lo que no puede
  tener, y la noche no contaba como cena en ningún sitio.
- **✅ Una cena puede ser «fuera», con su sitio.** `dinners.fuera` (0/1) y
  `dinners.donde` (texto libre), migración `0021`.
- **Dos columnas y no una.** La alternativa era guardar solo el sitio y leer «hay
  sitio» como «se cena fuera», y eso deja `''` —salir y no saber aún dónde—
  valiendo lo mismo que `NULL` en cualquier `if` de JavaScript. Es el tipo de
  trampa que se paga meses después y en la pantalla de otro.
- **El sitio en blanco es legítimo**, y por eso la frase no lo inventa: «Se cena
  fuera» ya es la noticia, y el dónde se sabe más tarde. Con sitio, «Fuera · El
  chiringuito de Paco».
- **Lo compone un solo sitio** (`titularDeFuera`, `lib/dias.js`) porque lo dicen
  **cuatro** pantallas —la lista de Días, el renglón del día, «Hoy» y la capa en
  lectura—, y una frase escrita cuatro veces es un desfase esperando a pasar.
- **✅ No entra en la lista de la compra**, que es la parte que cuesta dinero si
  sale mal: comprar arroz para una paella que nadie va a cocinar. Se corta en
  `platosDeLaCena` (`lib/compra.js`) y **no en cada consumidor**, para que la
  lista y la pregunta de borrar una cena (§14.38) cuenten lo mismo — si no, la
  pregunta diría un número que el recálculo luego no hace.
- **Los platos marcados no se borran al salir.** Se quedan por si se vuelve
  atrás; lo que cambia es cómo se lee la cena, no lo que hay guardado en ella.
- **En el elegidor, «fuera» sustituye a la lista en vez de convivir con ella**
  (§14.31): elegir platos y decir que se sale son la misma decisión con dos
  respuestas, y enseñadas a la vez habría que leer para saber cuál manda. Se
  entra por un verbo de una línea —la figura de «Los niños comen otra cosa…»— y
  se vuelve con «Cenamos en el camping». Todo dentro del borrador: no escribe
  hasta «Listo».
- **✅ Y decirlo cría la cena** aunque no haya ni un plato ni un sitio: es una
  decisión tomada, no el hueco reservado de una cena vacía. Por eso el renglón
  del día sale **verde** con `fuera`, y por eso no reclama platos —esa noche no
  cocina nadie— ni dice «cena sin platos».
- **Y no pide bungas.** El día se cuenta como completo con `fuera` y un plan, sin
  los dos bungas: no acoge nadie, así que exigirlos era pedir lo imposible.
- **Lo que se deja igual a propósito:** la racha de cenas de Números sigue
  contando una noche fuera como noche con cena —lo es— y el balance de anfitrión
  no la cuenta, porque no tiene bungas que contar. Ninguno de los dos necesitó
  tocarse.

### 14.69 Un día dice lo que hay, en vez de contarlo

Decidido en [`docs/diseño/dia-titular.html`](diseño/dia-titular.html) ·
**N1 · P4 · C1 · I1**.

- **El defecto, y no cabía arreglarlo como se pidió.** El encargo era «si hay
  más de un plan, que salga y el título tenga los planes». Medido: «Bici
  electrica a Cadaques · Kayak por la cala» son **445,2 pt** y el titular tiene
  **289** con `white-space: nowrap` — le faltan **156,2, el 54 %**. En Enorme,
  501,2 contra los mismos 289. Lo que sí cabe es abajo: el renglón de debajo
  **sí parte línea**, y ahí «Bici eléctrica · Kayak por la cala» mide 250 y entra
  sin tocar el alto. La decisión no era si los nombres caben arriba sino **dónde
  van**.
- **✅ N1 · el renglón nombra en vez de contar.** «sin cena · 2 planes» pasa a
  «Kayak por la cala · sin cena». Contar sirve para comparar días; nombrar sirve
  para saber qué hay, que es a lo que se entra a esta pantalla. El segundo plan
  del día **no salía en ninguna pantalla** sin abrir el día.
- **Se nombra lo que no esté ya arriba.** Con cena titulan los platos y bajan
  todos los planes; sin cena titula el primer plan y bajan los demás. Repetir el
  titular en su propio renglón gasta la única línea que queda.
- **✅ C1 · la cena manda y el plan baja**, que es la regla que ya tenía y la
  que comparte con `titularDeHoy`. Arriba lo que hay de comer, abajo lo que hay
  que hacer.
- **«sin planes» se dice y «1 plan» no.** Que un día no tenga nada que hacer es
  el dato que se busca al repasar el viaje; que tenga uno ya lo dice el titular.
- **✅ P4 · el titular nombra los principales, con dos como tope.** Mandaba
  **uno solo** (`platoQueManda`), así que la tortilla de una Noche Ibérica de
  jamón y tortilla no salía en ninguna pantalla sin abrir el elegidor. Solo los
  principales —el aperitivo y el postre acompañan, no titulan—, dos por su
  nombre y del tercero en adelante «y N más».
- **Y un tope de letras encima del tope de dos**, porque dos nombres largos
  tampoco caben: «Pinchos Arnall 🍖 y Tortilla de patata» mide **370,7 pt** en
  289 y saldría partida. `LETRAS_DEL_TITULAR = 26` y `LETRAS_DEL_RENGLON = 36`,
  los dos sacados de medir contenido real —«Bici electrica a Cadaques» son 25
  letras y 253,1 pt; «Cena en la playa con música!» son 28 y 293,4, que **hoy ya
  se recorta en la app**—. Son aproximados a propósito: medir el texto de verdad
  pide navegador, y esto es una función pura que corre en las pruebas sin montar
  nada.
- **Con uno solo se rinde y lo devuelve aunque se pase.** Algo hay que decir, y
  recortar es cosa del CSS.
- **✅ I1 · sin IA**, aunque el encargo la permitía. La app **ya sabe redactar
  esto sin ella** desde §14.67 —`fraseDeLaNoche`, pura y sin red—, y aquí es
  enumerar lo que ya está escrito: instantáneo, igual en los nueve móviles, sin
  cobertura en el camping y sin coste. Las otras tres —una por día guardada en el
  evento, un botón por día, o solo en «Hoy»— siguen dibujadas en la hoja por si
  algún día la guasa compensa la dependencia.
- **Lo que costó, medido: cero.** La tarjeta de ocho días medía **590,8 pt** en
  un hueco de **594** —sobraban 3,2— y sigue midiendo 590,8. Ninguna fila creció:
  por eso hay tope de letras en el renglón y no solo en el titular, porque ahí
  partir línea cuesta **+22,8 pt** y con 3,2 de margen eso hace rodar la lista
  entera. En Enorme rodaba 58 pt antes y sigue rodando 58.
- **`titularDeCena` se alinea, y pierde su recuento.** Es el renglón de la cena
  dentro de la capa del día, y decía «Paella mixta y cinco cosas más» con el
  mismo defecto. Ahora nombra los principales igual que la lista —dos pantallas
  hermanas no contestan distinto a la misma pregunta, que es la regla que
  `titularDeHoy` se puso en §14.30— y el recuento se va porque el renglón de
  debajo de esa misma fila ya lo lleva («tres platos»).
- **Lo que encontraron las pruebas y no el navegador:** con dos nombrados y
  resto, enumerar de la forma normal daba **«Jamón y Tortilla y 1 más»**, con dos
  «y» seguidas que se leen como si el tercero se llamara «1 más». Con resto, los
  nombrados se juntan con coma (`juntarYContar`).
- **Lo que se deja sin arreglar, y por qué:** «Cena en la playa con música!»
  **sigue recortándose**. Es el título que escribió una persona, mide 293,4 en
  289, y las únicas salidas son partirlo en dos líneas —+22,8 pt sobre 3,2 de
  margen, o sea rodar la lista entera por un nombre largo— o reescribírselo.
  Recortar con puntos suspensivos es lo menos malo de los tres.

### 14.68 Las cenas se montan en el día, y el gasto dice cómo se reparte

Decidido en
[`docs/diseño/cenas-fuera-y-reparto.html`](diseño/cenas-fuera-y-reparto.html) ·
**N1 · H3 · K1 · R1 + R5**. Dos encargos que se decidieron juntos porque los dos
chocaban con lo que ya había puesto: el primero es una retirada y había que
recolocar lo que se caía con ella; el segundo es añadir, y el sitio donde había
que añadirlo estaba lleno.

- **El defecto, medido:** montar una cena tenía **dos puertas que no se
  parecían** —una lista de tarjetas en Comidas → Cenas con un modal de fecha
  libre, y la capa del día— y la de Comidas dejaba crear una cena en una fecha
  que el viaje no tiene, que es de donde salían las cenas huérfanas de
  §14.10-quater. Y al apuntar un gasto, lo que mueve el saldo de tres casas
  **no lo decía ninguna pantalla hasta después de guardarlo**.
- **✅ N1 · Comidas se queda en Carta y Compra.** Lo que queda es lo que **no
  cuelga de un día**. Se descartó N3 («Cocina»): el rótulo de la barra es lo
  único de esto que hay que aprenderse y lleva puesto desde §14.10-ter. La
  compra **no** se va a Agenda: es lo que se abre en el súper, de pie y con el
  carro. Con dos áreas el mando da 173 pt por hueco.
- **Un área que ya no existe cae en la primera.** `lib/areas.js` es memoria del
  módulo y sobrevive a un cambio de pestaña, así que quien tuviera «Cenas»
  abierta se quedaba con el mando sin nada marcado y el cuerpo en blanco.
- **✅ H3 · el buscador ofrece crear el plato**, y no es la mudanza del
  formulario de «Cenas» —nombre más las cinco categorías, siempre desplegado—,
  que aquí no cabe y hace falta una vez de cada veinte. Cero controles en
  reposo: el verbo sale **solo cuando lo buscado no existe**, con el nombre ya
  escrito. El plato **nace sin categoría** y se completa en la Carta.
- **El alta escribe en el catálogo aunque luego se cancele**, y es a propósito.
  Un plato es del grupo y de todos los viajes; lo que el borrador de §14.31
  protege es *qué se cena hoy*. Aplazarlo hasta «Listo» obligaría a guardar un
  plato a medio nacer dentro del borrador y a perderlo al cancelar, que es justo
  lo que se lee como que la app pierde cosas.
- **✅ K1 · la mesa de niños, en el elegidor — con un segmentado y no dos listas
  seguidas.** La hoja aceptaba «dos listas», y dibujadas una debajo de otra son
  dos catálogos enteros en una capa cuyo tope son 658,3 pt: para llegar a la
  segunda hay que pasar por toda la primera. Las dos listas están, se enseña una
  cada vez, y el buscador y el orden sirven a las dos. Mientras hereden (`null`)
  no hay segmentado ni nada que leer, solo el verbo de una línea.
- **Y el día lo dice sin abrir el elegidor**: «tres platos · los niños, otra
  cosa». Vive dentro del elegidor, así que sin esto habría que abrirlo para
  saberlo — el mismo error que este apartado arregla en el punto de abajo.
- **✅ R1 · una línea, antes de Guardar.** «3 familias · **16,20 €** cada una»,
  y cuando el reparto no es a partes iguales, «3 familias · de **8,10** a
  **24,30 €**» — porque «a cada una» con coeficientes distintos **sería
  mentira**, y es justo el caso en que hace falta mirar. Un céntimo de
  diferencia sigue siendo «a cada una»: repartir 10,00 entre tres da 3,34 · 3,33
  · 3,33 por resto mayor, y eso es un reparto igual con el pico colocado.
- **Que quepa en un renglón no es estilo, es el requisito, y costó tres
  redacciones.** La ficha rápida cabía **exacta** en Grande —0 pt de scroll— con
  su botón de guardar entero. Con «Se reparte entre 3 familias, de 8,10 € a
  24,30 €.» se iba a dos líneas: 41 pt de scroll y el botón al **59 %**. La
  línea puesta para no tener que abrir nada obligaba a rodar para llegar a
  Guardar. En una son 15 pt y el botón vuelve al **100 %**. Por eso no dice «Les
  toca» ni «Se reparte entre»: cada palabra de cortesía costaba el renglón. En
  el intervalo el símbolo va **una vez** («de 8,10 a 24,30 €»), que con seis
  familias y cifras de cuatro dígitos es lo que lo parte en dos —y hay guardia
  de 34 letras en `reparto-vista.test.js`, contando letras porque en jsdom no
  hay maquetación—.
- **Lo que cuesta en Enorme, dicho:** ahí la ficha **ya rodaba** 30 pt antes de
  esto, con el botón al 84 %; con la línea son 62 pt y el 12 %. Se acepta porque
  §14.27-bis ya fijó que esta capa **no cambia de tamaño, hace scroll**, pero es
  el coste real de R1 y no conviene que se descubra dentro de seis meses.
- **✅ R5 · y en Detalles, lo que le toca a cada familia en euros.** Cuelga del
  `<label>Cómo se reparte</label>` **que ya estaba ahí** desde §14.26 —no
  estrena sección, que dejaría dos con el mismo nombre en dos capas— y va debajo
  del control, para mover un coeficiente y ver el efecto sin cerrar la capa.
- **El agujero era más estrecho de lo que parecía**, y verlo cambió el
  planteamiento: en «Partes» e «Importes» cada casa **ya tenía su casilla con su
  número**. El único modo sin ninguna cifra era **«Coeficiente»**, que es el de
  fábrica y el de casi todos los gastos.
- **Ninguna de las dos necesitó lógica nueva**: `expenseFamilyShares` ya
  devolvía el reparto en céntimos con los tres modos. `lib/reparto-vista.js` es
  un envoltorio que ordena, quita las familias a cero —una casa que no entra no
  es un renglón que diga «0,00 €»— y compone la frase.
- **Tres cosas que la hoja no vio y salieron al implementar**, las tres del
  mismo tipo —una garantía que vivía en «Cenas» y se caía con ella—:
  1. **Una cena fuera de las fechas se quedaba invisible.** `diasDe` solo mira
     los días apuntados **cuando el evento no tiene fechas**, así que con fechas
     puestas no salía ninguna fila. Seguiría contando en Números y ocupando
     bunga, que es exactamente lo que §14.10-quater se puso para evitar. Ahora
     bajan al final de Días, marcadas. **Solo las cenas**: un plan que se cayó
     fuera ya sale en Planes y en `libres` de cualquier día.
  2. **Quitar la cena dejaba de decir qué se lleva.** El renglón del día tenía
     una frase a mano que nombra platos y bungas y **calla la compra**; la de
     §14.38 la compone `queSeLlevaUnaCena`, que cuenta las líneas que se caen
     —hay que calcularlo, porque una línea no apunta a su cena—. Se muda el
     `Confirmar` entero, y con él `queSeLlevaUnaCena`, que si no quedaba muerta.
  3. **`FueraDeFechas.test.jsx` se quedaba sin sujeto.** El reflejo fácil era
     borrar sus dos casos: suite verde y la cena del 14 invisible. Un test que
     guarda una regla se **muda** con ella.
- **Lo que se retira:** `CenasScreen.jsx` entero, y de
  `SoloAdultosOrganizan.test.jsx` el bloque «las cenas las montan los adultos» —
  ese cerrojo es el que ya prueba «colocar el día», y mudarlo sería el mismo
  test dos veces.
- **Lo que la hoja dejó abierto y sigue abierto:** «la semana» no existe. Agenda
  es Hoy · Días · Números y «Días» es la lista del viaje. Si algún día se quiere
  una rejilla de siete días, es otra obra y otra hoja.

### 14.67 «Hoy» cuenta el día, y el día se puede mirar sin montarlo

Decidido en [`docs/diseño/hoy-el-dia.html`](diseño/hoy-el-dia.html) ·
**T1 · P1 · L2 · E3**, más las dos cosas que iban ya decididas.

- **El defecto, medido:** el titular de «Hoy» nombraba **1 plato de 3** —los
  otros eran «y dos cosas más»—, los bungas salían por su mote sin decir de qué
  familia son, **el plan del día no estaba** y la tarjeta **no se tocaba**. Todo
  lo que faltaba estaba a un toque pero en otra pantalla, y esa pantalla es el
  **editor** del día: para mirarlo había que entrar en la herramienta de
  montarlo.
- **✅ T1 · la cena se redacta.** «Esta noche **Paella mixta**, con pan con
  tomate y sandía. Los mayores cenan en **El del ruido** y los niños en **El del
  fondo**.» `fraseDeLaNoche` (`lib/dias.js`) devuelve **trozos** con su `fuerte`
  y no una cadena: lo que se busca va en negrita, y componer eso en la pantalla
  sería volver a partir la frase allí. Fuera del día de hoy abre con «Se cena».
  Sin cena manda el plan y se queda el titular de siempre (§14.30 · P2).
- **Los nombres de los platos van tal como están escritos**, también en medio de
  la frase: bajarles la primera letra convertiría «BBQ de pescado» en «bBQ de
  pescado», y un plato es un nombre propio.
- **✅ P1 · el titular se toca y abre el día en lectura.** Es **la misma**
  `CapaDeDia` con `lectura`, no una pantalla nueva: sin elegidores, con la carta
  entera en vez del titular de la cena, y con «Montar este día» para quien
  organiza —que apaga el modo sin cerrar la capa ni cambiar de sitio—. Dos
  pantallas parecidas era el coste que marcaba la hoja, y así no se paga.
- **Mirando, ningún renglón promete un gesto**: «sin elegir» en vez de «toca
  para elegir el bunga», y el renglón del plan deja de contar cuántos hay libres
  por traer — eso es una tarea de montar el día, no un dato de lo que se hace.
- **✅ L2 · los platos, en el orden en que se comen y diciendo de qué es cada
  uno.** `lib/carta.js` —nuevo— se lleva `DISH_CATEGORIES` de `db.js`: **no es un
  hecho de la base, es cómo se come**, y lo leen cuatro pantallas, tres de las
  cuales tenían su propia copia de la misma línea (`etiquetaCategoria`,
  `catLabel`, `etiqueta`). De ahí salen `porOrdenDeCarta` —estable dentro de cada
  categoría— y `agrupadosPorCategoria`.
- **✅ E3 · el elegidor de platos, agrupado y con lo puesto arriba.** Con nueve
  platos y tres marcados, los tres estaban repartidos por la lista. Los marcados
  **no saltan de sitio al marcarlos**: el grupo «Esta cena» se compone al abrir
  el elegidor, no bajo el dedo — un plato que se mueve al tocarlo es la peor
  sorpresa de una lista.
- **✅ El total de Dinero, al final de todo.** Estaba antes de la lista: un dato
  de cierre en el sitio por donde se entra.
- **✅ Los niños comen lo mismo y ya no se anuncia.** Una tarjeta de dos
  renglones decía en **todas** las cenas lo que pasa siempre; queda el verbo en
  una línea —«Los niños comen otra cosa…»— y la tarjeta vuelve en cuanto tienen
  lista propia.
- **Lo que se vio en el navegador y no en las pruebas:** la categoría de un plato
  salía **con borde y en columna**. `.cat` es la casilla de categoría de un
  gasto —`display: flex; flex-direction: column`, con su borde— y se colaba
  entera; la clase pasa a `.tipo`.

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

### 14.52 El grupo dejó de ser un ajuste, y Ajustes sube a un botón

- **El defecto:** la quinta pestaña era **Ajustes** y dentro tenía nueve
  acordeones, de los cuales **tres no lo son**: «El grupo», «Quién eres» y
  «Mejoras». Mientras «El grupo» era un censo —quién es de qué familia— se
  aguantaba. Al darle al bunga notas e histórico (§14.56), a cada familia su
  cacharro (§14.57) y a las personas la casilla de quién lleva las cuentas
  (§14.58), eso dejó de ajustarse y pasó a **mirarse** — exactamente lo que sacó
  a las estadísticas de Ajustes en §14.10-ter.
- **✅ Q2** (`docs/diseño/donde-vive-el-grupo.html`): la quinta pestaña pasa a
  ser **«Grupo»** —con la gente, sus bungas y sus cacharros— y **Ajustes se va
  arriba a la derecha en pequeño**. No cuesta ninguna de las dos casillas de
  `SubNav` que quedaban libres (§14.53 se lleva la de Planes): Ajustes no tenía
  mando de áreas, así que el cambio es un renombrado.
- **Por qué arriba a la derecha, si §14.10 lo bajó.** El argumento de entonces
  sigue siendo cierto —es lo que peor alcanza el pulgar de una mano sola— y por
  eso lo que se queda arriba es **lo que menos se pulsa**: aspecto, evento,
  avisos, cuentas, IA y la app. Lo que se pulsa a diario baja.
- **El mismo botón entra y sale.** La rueda se convierte en aspa y devuelve a
  **donde estabas** (`volverA`), no a un sitio por defecto. Sin eso la única
  salida sería tocar otra pestaña, y volver exigiría acordarse de dónde estabas.
- **Se descartó renombrar Planes** (Q4): Planes es *lo que se hace* y el grupo es
  *quién lo hace*; además obligaría a que los planes fueran un área dentro de
  «Grupo», escondiendo detrás de una casilla lo que más se abre del viaje. Y una
  sexta pestaña (Q5) baja cada casilla del mando de dentro a **67,6 pt**, con lo
  que dejan de caber «Compra» (77,8) y «Números» (90,3), que ya están puestas.
- **En Ajustes queda el rastro** (`.acor-ido`): un renglón que dice a dónde ha
  ido «El grupo» y que lleva. Nueve solapas memorizadas no se reordenan solas en
  la cabeza de nadie.
- Medido a 390 pt: «Grupo» son **44,2 pt** en una casilla de barra de 76,4 — el
  ancho nunca fue el problema.
- **Lo que no se movió:** «Quién eres» y «Mejoras» siguen en Ajustes. La hoja
  proponía llevárselas también; se dejaron donde estaban para no rehacer dos
  flujos en la misma vuelta, y es lo primero que hay que revisar si Ajustes
  vuelve a parecer un cajón.

### 14.53 Los trucos: lo que hay que acordarse de un viaje a otro

- Lista **compartida entre todos los eventos**, como `dishes` y `planIdeas`:
  «el súper del pueblo cierra a las 14:00» sigue siendo verdad el agosto que
  viene, y ésa es toda la razón de ser de la lista. Tabla `trucos`, `eventId`
  nulo = de todos, con valor = solo del Demo (§14.9-quater).
- **No se tacha, y no es un descuido.** La primera hoja dibujó dos grupos —«Para
  llevar», que se tildaba cada viaje, y «Para saber»— y se descartó: un truco no
  es una tarea, y tildarlo obligaba a una segunda tabla de estado por evento
  para nada. Para lo otro ya está la lista de la compra.
- **Vive en Planes → Trucos** (D1), tercera área. Cabe: la palabra mide **65,4
  pt** y con tres casillas cada una da 103,3. Y encaja de significado — Planes ya
  es el sitio de lo que se repite de un viaje a otro. Se descartó el acordeón de
  Ajustes (D2) porque durante el viaje ahí no entra nadie, que es justo cuando un
  truco sirve.
- Con **categorías** (T3), la figura de `SHOP_CATEGORIES`: antes de salir, el
  coche, el camping, la cocina, la playa. Con quince trucos sobran y con sesenta
  son lo que hace que se encuentren.
- Renglón fijo para apuntar que **no se cierra al guardar**, deslizar para editar
  y borrar, y la firma de Ideas: nombre + alias de su familia + cuándo. Es la
  misma figura que «Mejoras» (§14.22), y por eso se lee igual.

### 14.54 La compra, por familia

- **Lo que ya estaba:** marcar sin borrar y el aspa a la derecha existen desde
  §14.38. El encargo describía la pantalla que había; lo único nuevo es el
  **ámbito**.
- **✅ C1 + C2**: una columna `shop.familyId` —**nula = común**, que es como
  nacen todas las de siempre y todas las que calculan las cenas— y la misma
  pantalla partida en **secciones**: «De las cenas», «Común» y una por familia.
- **Secciones y no un filtro** (se descartó C3): un segmentado «Todas · La mía»
  cuesta ~57 pt permanentes y obliga a un toque para ver lo que ya cabía. En el
  súper hace falta la lista entera de un vistazo, porque quien va compra para
  todos.
- **Nada se oculta.** En esta app no hay nada privado —todo se sincroniza y todo
  se ve—, así que la lista de una familia la leen las demás. Es lo que hace que
  quien sale hacia el súper pregunte una vez en vez de nueve, y evita decidir qué
  ve quien administra. Hacerla privada de verdad pediría cifrarla o filtrarla en
  el Worker: es una obra, no un campo.
- El renglón de apuntar **arranca en tu familia** si la app sabe quién eres —la
  mitad de lo que se apunta a mano es de una casa— y **dice siempre para quién**,
  también cuando es para todos: un renglón que solo habla al elegir familia deja
  el caso normal sin decir dónde va lo que escribes.
- Dentro de una familia **no** se parte por categoría: son tres o cuatro cosas, y
  cinco encabezados de una línea gastan más alto que la lista.
- Una línea de una familia borrada cae en «Común» y no desaparece; una categoría
  retirada tampoco pierde su línea. Todo en `lib/compra-familias.js`, puro.

### 14.55 Los comentarios: una tabla con ancla, y un componente

- **✅ M1**: tabla `comentarios` con **ancla** —`'<tipo>:<id>'`: `plan:abc`,
  `gasto:def`, `dia:2026-08-15`— y un `<Comentarios eventId ancla />` que se
  enchufa donde sea. Una tabla, un componente, una clase de aviso, N sitios: el
  octavo cuesta tres líneas de JSX.
- **Se descartó una columna JSON por tabla** (M2) por dos defectos que no se
  arreglan después: una migración por sitio, y **dos personas comentando a la vez
  se pisan**, porque cada una sube la fila entera del plan. Y se descartó reusar
  `registro` (M4): esa se compone sola y no se corrige ni se borra.
- **✅ K2 · los dos últimos y el resto detrás de un renglón.** La capa de un plan
  mide **470 pt** y con el hilo entero dentro pasa de **900**, así que habría que
  rodar dentro de un modal para llegar a escribir — el defecto que §14.26 le
  quitó a la ficha de un gasto. Con dos crece 130 pt y **se para ahí**, con ocho
  comentarios o con ochenta. Es la figura del recap (§14.50).
- **✅ K4 · la fila lo dice sin abrir nada**: un globo con cuántos hay y un aro
  cuando alguno no lo has visto. Cuesta **0 pt de alto** —va donde ya va el
  recuento de votos— y es lo que hace que un hilo se lea.
- **✅ K6 · lo leído es del móvil y no se sincroniza** (la variante barata). La
  exacta es una tabla más y una escritura cada vez que abres algo; ésta se
  equivoca solo al cambiar de teléfono, y lo que se pierde es un punto. Se marca
  **hasta el último que había**, no hasta «ahora»: uno escrito mientras tienes el
  hilo abierto quedaría marcado sin haberlo visto. Y **lo tuyo nunca cuenta como
  sin leer**.
- **Dónde está enchufado:** el plan, el gasto y el día. El gasto es probablemente
  el más útil —«¿esto qué era?» es la pregunta que más se hace al repasar
  cuentas, y hasta hoy la única respuesta era la descripción—. Quedan fuera de
  esta vuelta la cena, el bunga, la línea de la compra, la idea y la mejora: el
  componente ya vale, es enchufarlo.
- **A quién avisa: N1 ∪ N2.** Los **involucrados** —quien votó el plan, a quien le
  mueve el saldo el gasto, todos en un día— **y los del hilo**, que son los que ya
  escribieron ahí. Sin los segundos, contestarle a alguien que no votó el plan no
  le llega, que es lo primero que rompe una conversación. Nunca a quien escribe.
- **Clase propia** (`comentario`, N4) con su interruptor, y **agrupado por hilo**:
  un ida y vuelta de seis mensajes deja **un** aviso, no seis.
- El aspa solo está en **los tuyos**: borrar lo que escribió otro no es moderar,
  es reescribir la conversación.

### 14.55-bis El hilo, sin cantos

Decidido en [`docs/diseño/comentarios.html`](diseño/comentarios.html) ·
**A2 · B1 · C3 · D2**, más los dos arreglos que no se votaron.

- **El defecto, medido** en Chromium sobre el Demo, dentro de la capa de un plan:
  el bloque ocupaba **430,2 pt de una capa de 658,3** —el **65 %**— con **cuatro
  cantos apilados**: la tarjeta del hilo, «Ver los N» en **otro rectángulo
  idéntico pegado debajo** —dos iguales que se tocan se leen como uno partido—,
  la casilla de escribir y el botón lleno de 44. Más una línea por comentario.
- **Arreglo, no votación · un comentario es prosa, no un titular.** Se pintaba a
  **peso 550** porque heredaba `.row .main .n`, que existe para el *nombre* de
  una fila: en la capa de un plan, el texto de un comentario acababa siendo lo
  más negro de la pantalla, más que «Quién ha votado». Ahora es `--t-body` a
  **400**.
- **Arreglo, no votación · los comentarios dejan de tomar prestada `.row`.** Esa
  clase es «nombre a la izquierda, importe a la derecha», centrada
  verticalmente; un comentario envuelve, no tiene columna derecha y lo que pesa
  es quién lo dijo. El `.n.envuelve` de §14.55 era un parche sobre ella, y
  mientras la compartieran, cualquier cosa que se decidiera aquí habría que
  escribirla como excepción a una fila de lista.
- **✅ A2 · el hilo es un fondo, no una tarjeta**: `--foam` sin borde. Sigue
  siendo un bloque sin dibujar cuatro esquinas. Su coste era la cara oscura —un
  solo escalón de fondo se distingue peor— y se comprobó: se lee.
- **✅ B1 · quién habla sigue debajo.** Se dibujó encima (B2), en línea (B3) y
  con avatar (B4); gana quedarse. Lo que cambia es la firma, que baja a
  `--t-micro`: la línea de servicio no compite con lo que se dijo.
- **✅ C3 · la pastilla de escribir**: redonda, sin canto, con el botón dentro.
  Su coste era que el botón baja de 44 a 34 pt —el suelo de iOS—, y se paga
  **por fuera**: `.coment-enviar::after` con `inset: -5px` le da los 44 sin
  crecer el dibujo.
- **✅ D2 · «Ver los N» es un enlace centrado**, no una caja. Su coste era el
  mismo suelo, y se paga con relleno: 45,1 pt de renglón.
- **El aspa vuelve al pie**, al lado de la firma: sin `.row` no hay columna
  derecha donde ponerla. Sigue siendo segunda pulsación y sigue estando solo en
  los tuyos.
- **Lo que se ve en el navegador y no en las pruebas:** la pastilla salía con una
  casilla con canto dentro. `.coment-escribir input` tiene la **misma**
  especificidad que la regla general `input[type=text], …` y va más arriba en el
  fichero, así que perdía. Tercera vez que muerde lo mismo: la regla lleva
  `input[type=text]`. Y el foco pasa a dibujarse alrededor de la pastilla
  (`:focus-within`), que es el control que se ve.
- **Resultado medido:** **430,2 → 387,1 pt** (−43,1) y **cuatro cantos → cero**.
  Vale para los cuatro sitios enchufados —plan, gasto, día y bunga (§14.66)— y
  para la hoja de «ver todos», que reusa el mismo dibujo.

### 14.55-ter La hoja sale por un portal, y en el iPhone eso era el fallo

**Lo que se veía:** «Ver los 4 comentarios» abría la hoja **metida en la caja del
modal del plan** —el título salía como «omentarios», los comentarios cortados por
la izquierda y el último partido por abajo—. En el navegador de desarrollo se
dibujaba perfecta.

- **La causa:** `Comentarios` pinta su `<Hoja>` donde está, y donde está es
  **dentro** de la capa del plan (o del gasto, o del día). Así el `.modal-bg` de
  la hoja quedaba de **hijo de un `.modal`**, que es un scroller —`overflow-y:
  auto` con `-webkit-overflow-scrolling: touch`—. Chromium coloca un
  `position: fixed` contra la ventana pase lo que pase; **el WebKit del iPhone lo
  coloca y lo recorta contra ese scroller**. De ahí la hoja dentro del modal.
- **✅ El arreglo:** `Hoja` sale por `createPortal(…, document.body)`. Deja de ser
  hija de la capa de fuera y pasa a ser su hermana, sin ningún ancestro con
  scroll — comprobado en el navegador: 0 ancestros con `overflow: auto`, la hoja
  a 390 pt de ancho pegada abajo. Vale para **todas** las hojas de la app de una
  vez, no solo para la de comentarios.
- **Los eventos no se mueven de sitio.** Un portal cambia el árbol del DOM, no el
  de React: un toque dentro de la hoja sigue subiendo hasta el `stopPropagation`
  de la capa de fuera, así que cerrar la hoja **no** cierra además el plan. Está
  atado en `Hoja.test.jsx`, que es lo único de esto que se puede romper sin que
  se note en el navegador.
- **Es la cuarta vez que un fallo solo se ve en el móvil** —`password`, `url`,
  `datetime-local` y ahora esto—, y las cuatro por la misma razón: lo que se
  comprueba aquí es Chromium. Las tres primeras dejaron una guardia (`estilos
  .test.js`); ésta deja la suya sobre de quién cuelga una capa.
- **Ninguna otra capa estaba anidada**: se comprobaron «Entre» y «Detalles» de un
  gasto y «Parecidos» de un plato, y las tres se pintan como hermanas en el
  `body`. Por eso el arreglo va en `Hoja` y no en un refactor de las dieciséis.

### 14.56 El bunga es un sitio, y por eso puede tener historia

- **El defecto:** `bungas` lleva `eventId`, así que el «Bunga 12» de 2025 y el de
  2026 eran **dos filas sin nada que las una**. Una nota escrita este agosto se
  iba con el evento, y el histórico de qué familia durmió dónde **no existía**:
  no estaba esperando a que lo pintáramos, había que crearlo.
- **✅ B2**: catálogo `alojamientos`, la figura de la casa por cuarta vez
  (`dishes` ↔ `dinners`, `planIdeas` ↔ `plans`). En el catálogo vive lo que **no
  cambia de un año a otro** —cómo es el sitio, sus notas, sus pegatinas— y en el
  bunga del evento lo que es de este agosto: qué familia lo tiene
  (`bungas.alojamientoId`).
- **✅ B4 · pegatinas de un toque** —🧊 buena nevera, 🚿 baño bien, 🔇 tranquilo,
  🌳 sombra, 🔌 enchufes, 🐜 bichos, 📶 sin cobertura— y no cinco estrellas (B3):
  son cinco preguntas que en agosto no contesta nadie, y un toque sí se paga.
- **✅ B5 · el histórico se calcula, no se guarda.** Es la regla de oro: se
  sincronizan los hechos y lo demás sale de ellos. El año lo da `startDate` y no
  `creadoEn` —un evento se crea en junio y es de agosto—, y un viaje sin fechas
  entra igual y va al final, que es lo que §14.10-quater decidió con las cenas.
- **El alojamiento se crea solo**, con el nombre del bunga, la primera vez que se
  escribe algo que es del sitio. Preguntarlo antes sería pedir que se entienda la
  partición para poder apuntar una nota.

### 14.57 El cacharro del año

- Uno **por familia** (G1) y un voto **por cabeza** (G2): es lo que lo convierte
  en un ranking. Con 👍 múltiple los tres empatan a nueve y no hay ganador —
  distinto de un plan a propósito, donde se decide si algo se hace y a eso puede
  decir que sí todo el mundo.
- **Nadie vota el suyo** (G3): quita la trampa evidente, y con tres familias el
  ganador sale siempre de fuera. El precio se dice y no se esconde: una familia
  grande arrastra más votos, así que esto es un juego y no unas elecciones.
- Es un plan con otro nombre —`votos` es el mismo mapa persona → valor— así que
  no hay maquinaria nueva. Todo lo que decide está en `lib/cacharros.js`, puro.
- **Vive en Grupo** y no en una pestaña propia: lo que se pregunta es qué ha
  traído cada familia, y eso se lee al lado de quién duerme dónde. Además no
  quedaba casilla — «Gadgets» mide **83,8 pt** y la cuarta casilla de un mando da
  **73,5** (GD2).
- **Lo que falta:** el palmarés entre años (G4) no está. La tabla ya cuelga de su
  evento, así que es una ficha en Números que recorra los eventos y saque el
  ganador de cada uno; no se hizo en esta vuelta.

### 14.58 Quién lleva las cuentas

- Columna `persons.llevaLasCuentas` (L1). Es un **encargo, no un rasgo**: lo pone
  quien administra, en la ficha que ya edita nombre, apodo, edad y familia, y no
  se deduce de la edad. Solo se ofrece a quien puede escribir en Gastos
  (`puedeOrganizar`, L5): marcar de contable a un niño sería una casilla que no
  puede hacer nada. Pasar a niño a quien la llevaba **la apaga en el mismo
  gesto**, para no dejar una fila marcada que la pantalla ya no enseña.
- **Clase de aviso propia** (`gastoTodos`, L2) y **no** dentro de «dinero»: si
  fuera dentro, quien se harta de los gastos ajenos perdería al apagarla también
  los suyos, y entonces no se enteraría de nada.
- **Un solo aviso** (L4): quien lleva las cuentas **y** además le toca el gasto
  recibe uno. El descarte se hace en `avisosDeGasto` y no en APNs —
  `apns-collapse-id` sustituye una notificación por otra en la pantalla de
  bloqueo, pero **las dos suenan**.
- **El aviso dice por qué llega** (L3): «Te llega porque llevas las cuentas». Sin
  esa coletilla, ver un gasto de una familia con la que no compartes nada se lee
  como un fallo de la app y no como el encargo que uno aceptó.
- **✅ L6 · y los gastos borrados avisan.** Es la única parte que toca la
  maquinaria: hasta hoy el bucle de avisos se saltaba los borrados enteros,
  porque la regla era «se avisa de lo que mueve el saldo» y nadie se paró a ver
  que un gasto borrado lo mueve **hacia atrás** — desde la pantalla, un número
  que baja solo. A los demás se les sigue sin avisar: enterarse de que ya no
  debes algo no es urgente. A quien lleva las cuentas sí, porque es justo lo que
  le impide cuadrarlas.

### 14.59 Hay cosas que no se someten a votación

- **La columna llevaba un año escrita y no la leía nadie.** `addPlan` escribía
  `estado: 'votando'`, la columna viajaba a D1 y a la instantánea, y lo que
  separaba «Elegidos» de «Disponibles» era tener día. El encargo no pedía una
  columna nueva, pedía usar la que estaba: **cero migraciones**.
- **✅ P1**: `'votando'` | `'sehace'`. Tres grupos en la lista —**Se hacen**,
  Elegidos, A votación— y el primero manda sobre el día, porque «esto se hace» y
  «esto tiene día» son cosas distintas y muchas veces se decide la primera antes:
  «a los kayaks vamos fijo, ya veremos cuándo». Un plan que se hace y no tiene día
  sale arriba con el icono en **ámbar** (pendiente, §14.32) diciendo que le falta.
- **Lo decidido no enseña votos ni cuenta quién falta.** Enseñarlos era la queja:
  un plan ya decidido con «faltan Ana y Luis» debajo dice que aún se está
  decidiendo.
- **✅ P3 · el interruptor va dentro del plan**, para quien organiza —la misma
  guarda que ya tiene «Proponer» (§14.43)— y **los votos no se borran**: se
  guardan por si vuelve a votación. Es lo que permite tocarlo sin miedo; un
  cambio de opinión no puede costar los votos de nueve personas.
- **✅ P4 · se pregunta al proponer una idea**, que es donde uno tiene la decisión
  en la cabeza: proponer «la paella del sábado» ya es haberlo decidido.
- Un plan sin `estado`, o con el `'confirmado'` de los viejos, **se vota**: la
  comprobación es por el valor afirmativo y nunca por la ausencia del otro, así
  que nada de antes cambia de comportamiento.
- **Se descartó P5** (que valga también para las cenas): allí «se hace y punto»
  es el estado de siempre y lo que faltaría es lo contrario. Otra vuelta.

### 14.60 El aviso abre lo que lo generó

- **Media pieza llevaba escrita desde el principio.** El sobre de APNs mete fuera
  de `aps` lo que llegue en `aviso.datos`, el comentario de `api/src/apns.js`
  dice literalmente que «es lo que le dice a qué pantalla ir», y el Worker
  llevaba mandando `ir: 'dinero' | 'hoy' | 'ajustes/cuentas'` desde que existen
  los avisos. **Nadie lo leía**: la app escuchaba `pushNotificationReceived` —el
  que llega, y solo para la prueba de Ajustes— y no
  `pushNotificationActionPerformed` —el que se **toca**—. El destino viajaba en
  cada aviso y se tiraba a la basura; pulsar abría la app donde la dejaste. Es la
  tercera pieza medio escrita de esta tanda, con `plans.estado` y el bunga sin
  catálogo.
- **✅ R2 · pestaña, área y fila**: `ir: 'planes/planes/plan_a1'` abre ese plan;
  `'dinero/gastos/exp_9f2'` ese gasto; `'agenda/dias/2026-08-15'` ese día. Los
  tres niveles son opcionales de derecha a izquierda, así que los avisos viejos
  —que mandan solo la pestaña— siguen valiendo. Lo que no se reconoce lleva a
  «Hoy»: mejor la portada que una pantalla vacía.
- **✅ R3 · y el evento.** El sobre lleva ahora `datos.evento`. Sin él, un aviso
  de un viaje que no es el abierto lleva a una pantalla donde esa fila no existe,
  y eso se lee como que la app se ha perdido. Se cambia **antes** de navegar.
- **✅ R4 · con la app cerrada.** El toque llega antes de que haya nada montado y
  antes de que la sincronización traiga la fila, así que el destino **se guarda y
  se consume** cuando el evento ya está resuelto. Sin esto funcionaría con la app
  abierta y fallaría justo cuando más se usa, que es a las ocho de la mañana con
  el teléfono en la mesilla. Es la figura de `lib/primeraBajada.js`.
- Las pantallas de llegada **esperan a tener datos**: abrir un plan que aún no ha
  bajado sería no abrir nada.
- **Lo que no está: R5**, los botones dentro del aviso para contestar desde la
  pantalla de bloqueo. El sobre ya manda `category`, que es lo que los enciende,
  pero declararlos es nativo y **no viaja por OTA**: exige binario nuevo y pasar
  por Apple.


### 14.63 El grupo, en tres áreas y con tres niveles de permiso

- **El defecto:** Grupo salió a su pestaña en §14.52 con el censo dentro, y en la
  misma tanda se le metieron las notas del bunga, su histórico (§14.56) y el
  gadget de cada casa (§14.57). Una sola columna con todo eso obliga a rodar
  media pantalla para llegar a lo que se venía a mirar, y con seis familias la
  lista de gente no cabe.
- **✅ Tres áreas: Familias · Bungas · Gadgets.** Las tres palabras caben — la
  casilla de un mando de tres da **103,3 pt** y la más larga es «Gadgets» con
  83,8—. Los bungas salen de dentro de la ficha de cada familia y pasan a su
  propia lista, que es donde se les puede dar alias, dueño y notas sin abrir
  tres solapas.
- **✅ Cada familia es un desplegable.** La solapa cerrada dice lo justo para no
  abrirla —su emoji sobre su color, su nombre, su estado y cuántos son— y **la
  tuya nace abierta**, que es la que se abre siempre. `Acordeon` gana `cabecera`
  y `clave` para esto: una familia no cabe en una cadena de texto.
- **«Quién eres» no acaba aquí, y es una corrección de esta vuelta.** Se pidió
  moverlo a Grupo y llegó a estarlo, arriba de Familias. Mientras tanto §14.62 lo
  resolvió mejor por otro camino: **el perfil entero detrás de tu emoji en la
  cabecera**, alcanzable desde cualquier pantalla en vez de desde una pestaña.
  Tenerlo en los dos sitios sería peor que en cualquiera de los dos, así que la
  copia de Grupo se retiró antes de fusionar.
- **✅ Tres niveles de permiso y no dos** (`lib/permisos.js`):
  1. **Quien administra**, todo.
  2. **Un adulto**, lo de **su** familia —su ficha, su gente, su gadget— y **los
     bungas de cualquiera**. Los bungas se comparten a propósito: colocar a las
     familias lo hace quien llega primero al camping, y el estado de un bunga
     —«la nevera congela», «hay bichos»— lo sabe quien ha dormido ahí.
  3. **El resto** —adolescentes y niños—, mirar.
- **Lo que no se delega**: crear y borrar familias, y mover gente de una a otra.
  Son las dos cosas que **redistribuyen el reparto de todos los demás**, y por
  eso siguen siendo de quien administra.
- **Sin sesión no se capa nada**, como en toda la casa (§14.41, §14.43): la
  libreta local y la demostración son de quien tiene el móvil en la mano.
- **Y a quien no puede se le dice por qué**, con la razón que le toca —«esto lo
  llevan los adultos» o «puedes cambiar lo de tu familia y lo de los bungas»—:
  una pantalla que no reacciona y se calla es peor que una que capa y lo explica.
- **Se dice «gadget» y no «cacharro».** El módulo se llama `cacharros.js` porque
  nació así; lo que lee el grupo es la palabra que pidió el grupo.

### 14.63-bis Los avisos no mandaban nada, y una tabla que falta tumbaba la sincronización

Dos fallos del servidor que salieron de una pregunta concreta —«he probado con
un comentario a Dani y no me ha ido»— y que no se parecen en nada al síntoma.

- **La instantánea se leía con la forma equivocada.** `leerInstantanea` devuelve
  `{ v: 1, tables: { persons, families, … } }` y quien componía los sobres leía
  `instantanea.persons`: **siempre `undefined`**. Con la lista de personas vacía,
  `familiasDeUnGasto` no encuentra a nadie, `personIds` sale vacío y
  `avisoDeGasto`, `avisoDeLiquidacion` y `avisoDeComentario` devuelven `null`.
  **No se manda nada y no falla nada** — sin error, sin log, sin 500—, que es la
  clase de fallo que no se nota hasta que alguien pregunta. Sobrevivía solo «En
  qué anda la gente», porque `avisoDeEstado` no mira las personas y su
  `personIds` es `null`. Lleva así desde §14.39: **«Gastos que te tocan» no ha
  avisado nunca.**
- **Por qué no lo cazó ningún test:** los de `avisos.test.js` prueban las
  funciones puras pasándoles las listas a mano, así que verifican *a quién le
  toca* y nunca *qué forma tiene lo que les llega*. El que compone los sobres es
  ahora `sobresDeLosCambios`, exportado, y `avisos-cableado.test.js` le pasa una
  instantánea **leída de una base** — más un test que fija la forma vieja y
  comprueba que con ella no sale ningún sobre.
- **Una tabla que aún no existe dejaba a todo el grupo sin sincronizar.** El
  Worker se publica solo en cada entrada a `main` y las migraciones se aplican a
  mano (§14.23): entre las dos cosas hay una ventana en la que el `SELECT` de la
  instantánea nombra tablas que no están. Eso lanzaba y `/api/sync` y
  `/api/cambios` contestaban **500**. Pasó con las cuatro tablas de §14.52–§14.60
  y habría vuelto a pasar con la siguiente migración. Ahora la tabla que falta
  llega **vacía** y sale en `faltan`; cualquier **otro** error de la base sigue
  reventando, porque devolver una lista vacía ahí sería decirle al móvil que el
  grupo no tiene gastos.

### 14.64 Un plato dice qué lleva y ahora también cómo se hace

Un plato sabía **qué lleva** —`ingredientes` con sus cantidades y `raciones`
para poder estirarlas (§14.20)— y no sabía **cómo se hace**. Son dos cosas
distintas y las dos hacen falta: de los ingredientes sale la lista de la compra,
y de esto sale lo que se lee delante del fuego. Sin el campo, quien cocinaba el
martes tenía la compra hecha y la receta en la cabeza de otro.

- **✅ `dishes.receta`, texto libre y multilínea** (migración `0018`, columna
  `TEXT` sin `NOT NULL` ni `DEFAULT`: los platos ya apuntados no se tocan, y
  `NULL` y cadena vacía significan lo mismo). Viaja en la sincronización como
  cualquier campo del catálogo, así que la receta que escribe uno la lee todo el
  grupo.
- **Texto y no pasos numerados**, a propósito. Una receta de este grupo es
  «sofríes la cebolla, echas el arroz y cuando empiece a hervir bajas el fuego»:
  obligar a partirla en pasos es pedir una estructura que nadie rellena, y es el
  mismo descarte que las cinco estrellas del bunga (§14.56 · B3). Un `textarea`
  de cinco renglones, opcional, con «Sofríes la cebolla, echas el arroz…» de
  ejemplo.
- **Va después de los ingredientes y de las raciones**, que es el orden en que
  se rellena: primero qué lleva y para cuántos, luego qué hacer con ello. Y con
  su pista, porque los dos campos se parecen y solo uno va a la compra: «Lo que
  se lee delante del fuego. Los ingredientes de arriba son los que van a la
  compra».
- **Se ve sin abrirlo:** la fila del catálogo dice `· 📖 con receta` en el
  subtítulo que ya tenía. Cuesta **cero puntos** de alto y es lo que se busca
  cuando hay veinte platos y toca cocinar uno.
- **Sin tope de caracteres**, al revés que mejoras, trucos y comentarios
  (2000). Aquellos son listas a las que se añade; esto es un campo de una fila
  que ya existe y que se edita encima, así que no hay por dónde crecer — y 2000
  sí es corto para una receta larga.

### 🟡 Aún abiertas (nivel implementación, no bloquean producto)
| # | Decisión | Recomendación |
|---|---|---|
| — | Proveedor concreto de la API de tipos de cambio + su fallback offline (§3.6) | A elegir al implementar |

*(A nivel de producto no queda ninguna decisión abierta. Lo único pendiente es técnico y se resuelve en la fase de implementación.)*
