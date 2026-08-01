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

### 2.4 Gente / participantes (común pero se instancia por evento)

Ver §5 (es tan central que tiene sección propia).

### 2.5 Ciclo de vida del evento (crear, duplicar, cerrar)

- **✅ Varios eventos a la vez, con uno "activo":** el grupo puede tener el de verano en curso y **ya ir planeando el de invierno**. La app **resalta el evento activo** (el que está pasando ahora) y deja el resto en una lista. Al abrir la app entras directo al activo.
- **✅ Unirse por enlace / QR:** quien crea el evento comparte un **enlace o QR**; los demás entran y **eligen su familia** (§5). Sin gestionar emails ni invitaciones una a una. Ideal para pasarlo por el grupo de WhatsApp.
- **Crear:** nombre, fecha de inicio y fin, moneda base. A partir de ahí se añaden familias, bungas y gente.
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
- Idea: cada gasto, por defecto, se reparte **por la suma del `peso_reparto` de las personas de cada familia participante** (§5). Así un niño con peso 0,5 cuenta la mitad automáticamente, sin reglas globales.
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
- **`peso_reparto`** (✅ decidido): **cuánto cuenta esta persona en el reparto por cabezas**, configurable **en su perfil**. Por defecto 1 (adulto); un niño puede ponerse a 0,5 o lo que el grupo acuerde, **por persona** — no es un ajuste global del evento. Un bebé podría ir a 0.
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
  - **Campo "qué se hace / cómo"** (texto libre: preparación, quién cocina, instrucciones).
  - **Campo "cantidades"** (texto o estructurado: "2 kg de arroz, 30 mejillones…").

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
Event 1─* Cena          (1 por día: → Dish[], bungaMayores→Bunga, bungaNiños→Bunga, qué_se_hace, cantidades)
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
- `queSeHace` (texto libre) · `cantidades` (texto libre)

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

Barra: **Hoy · Dinero · Cenas · Planes · Ajustes**.

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
mismo trazo que el resto y se recolorea con `--whale`. El icono de la app —el de
la pantalla de inicio— sigue siendo `public/favicon.svg` y se cambia cuando haya
dibujo nuevo.

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
