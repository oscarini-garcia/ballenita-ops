# Ballena Ops 🐋 — Specs de producto

> Nombre de la app: **Ballena Ops** (el viaje como operación militar de precisión… o eso pretendemos). La mascota es *la ballenita*.

> App para gestionar la logística (y el caos) de los viajes con el grupo de amigos.
> Todo pasa dentro de un viaje. La ballena vigila.

**Estado:** borrador para discutir. Nada implementado.
**Autor:** tú + Claude.
**Última actualización:** 2026-07-21

---

## 0. Filosofía y tono

- **Todo vive dentro de un viaje.** No hay entidades globales "sueltas" desde el punto de vista del usuario: entras, eliges/creas un viaje, y ahí dentro pasa todo (gastos, comidas, planes, bungalows, gente). El viaje es el contenedor raíz.
- **Tono con humor.** Microcopy gamberro, estados vacíos con gracia, la ballena como mascota. **✅ La ballenita comenta en momentos clave** (estados vacíos, avisos, estadísticas) con gracia, pero **no molesta** — personalidad sin cansar, no está en todas las pantallas soltando frases.
- **✅ Todo gasto vive dentro de un viaje.** No hay "botes" ni cajas comunes que crucen viajes: cada gasto pertenece a un viaje y se salda al cerrarlo. Coherente con el principio raíz.
- **Mobile-first.** Esto se usa con el móvil en la mano, en chanclas, con mala cobertura. Debe funcionar rápido y, a poder ser, offline-tolerante.
- **Idioma: solo español** (✅ decidido). El grupo es español; una sola lengua, con los textos con gracia bien cuidados. El humor se escribe, no se traduce. Sin i18n en v1 (no es tanto trabajo dejarlo medianamente ordenado por si acaso, pero no es objetivo).

**Logo:** una ballena. Ver §11.

---

## 1. Glosario (para no pelearnos con las palabras)

| Término | Qué es |
|---|---|
| **Viaje** | Contenedor raíz. Tiene fecha de inicio y fin, un grupo de gente, bungalows, gastos, comidas y planes. |
| **Persona / Participante** | Alguien que va al viaje. Pertenece a una familia y tiene un rol (mayor / niño / ambos). |
| **Familia** | Unidad de agrupación de personas (p. ej. "Los García", "Los solteros"). Sirve para el reparto por defecto de gastos y para la logística de comidas. |
| **Bunga (bungalow)** | Alojamiento físico dentro del viaje. Se definen al principio. La gente duerme y/o come en un bunga. |
| **Gasto** | Un pago hecho por alguien, que se reparte entre varios. Estilo Splitwise. |
| **Plan** | Actividad candidata o programada para un día (playa, kayak, ir a por hielo…). |
| **Comida** | Un evento de comer (comida/cena/aperitivo). Tiene platos, bunga(s) donde se come, y notas. |
| **Plato** | Un ítem de comida (p. ej. "tortilla de patata"), clasificable (entrante/principal/etc.). |

---

## 2. Áreas comunes (transversales al viaje)

Estas áreas existen "de siempre" y se reutilizan, aunque su contenido normalmente se instancia dentro de un viaje.

### 2.1 Autenticación

- **Login con Apple ID (Sign in with Apple)** como método **principal**.
- **✅ Decidido (Q1):** además de Apple ID, hay **fallback** (Google y/o email con enlace mágico) para no dejar fuera a los amigos con Android o sin dispositivo Apple.
- Perfil mínimo: nombre visible, avatar (opcional), método de login.
- **Cuentas por familia:** cada familia tiene **mínimo un login**. Desde ese login se pueden crear **perfiles-nombre gestionados** (niños, el cuñado que no se instala nada) o pueden entrar más **usuarios completos** asignados a esa familia. Modelo detallado en §5.1.

### 2.2 Familias

- Una familia es una etiqueta/grupo de personas **dentro de un viaje**.
- Casos de uso:
  1. **Reparto de gastos por familia** (el pool con 5 personas paga más que el soltero).
  2. **Logística de comidas** (esta familia cocina hoy, los niños de estas familias comen en el bunga X).
- **✅ Decidido (Q2): globales, congeladas por viaje.** Hay un catálogo **global** de personas y familias reutilizable cada año, pero la **composición de cada viaje se congela** al añadir gente (este año no vino el hijo mayor, hay novia nueva, etc.). Cambiar la familia global no reescribe viajes pasados.

### 2.3 Bungas (bungalows)

- Se **definen al principio del viaje**: nombre/identificador ("Bunga 1", "El de la piscina"), capacidad opcional.
- **✅ Modelo: cada familia tiene su bunga (1 a 1 en v1).** El bunga es el alojamiento de una familia — no se asigna persona a persona, sino **familia ↔ bunga**. La persona "hereda" el bunga de su familia.
- **✅ Decidido:** en v1, **1 familia = 1 bunga** exactamente. Los casos raros (familia grande con 2 bungas, dos familias pequeñas compartiendo uno) **se apañan a mano** por ahora; se revisará si aparece la necesidad real. Menos modelo, cubre lo normal.
- Los bungas se usan además como **sede rotatoria de las comidas** (§6): cada día se decide qué bunga acoge la comida de los mayores y cuál la de los niños, repartiendo la carga.

### 2.4 Gente / participantes (común pero se instancia por viaje)

Ver §5 (es tan central que tiene sección propia).

### 2.5 Ciclo de vida del viaje (crear, duplicar, cerrar)

- **✅ Varios viajes a la vez, con uno "activo":** el grupo puede tener el de verano en curso y **ya ir planeando el de invierno**. La app **resalta el viaje activo** (el que está pasando ahora) y deja el resto en una lista. Al abrir la app entras directo al activo.
- **✅ Unirse por enlace / QR:** quien crea el viaje comparte un **enlace o QR**; los demás entran y **eligen su familia** (§5). Sin gestionar emails ni invitaciones una a una. Ideal para pasarlo por el grupo de WhatsApp.
- **Crear:** nombre, fecha de inicio y fin, moneda base. A partir de ahí se añaden familias, bungas y gente.
- **✅ Duplicar el viaje anterior:** al crear un viaje se puede **clonar el del año pasado** (misma gente, familias, bungas, platos favoritos) y solo ajustar fechas y quién viene este año. Nadie quiere remontar el camping entero cada verano.
  - *(Recordatorio §2.2: la composición se **congela** por viaje; duplicar copia el estado, no crea un vínculo vivo con el viaje anterior.)*
- **✅ Cerrar (reabrible):** al terminar, **cualquiera** puede marcar el viaje como cerrado → se genera el **resumen de cuentas y la liquidación final** (§3.4). No hay candado (no hay roles, §9): se puede **reabrir** para meter ese gasto que faltaba y volver a cerrar.
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
- **Fecha** (por defecto hoy, dentro del rango del viaje).
- **Categoría** — **✅ lista fija con iconos:** 🍔 comida · 🏠 alojamiento · 🚗 transporte · 🎉 ocio · 📦 varios. Alimenta las estadísticas (§9); fija para que las stats salgan consistentes.
- **Nota** (texto libre, opcional). **Sin fotos en v1** (ver §3.5).

### 3.2 Cómo se divide el gasto
Modos de reparto:
1. **A partes iguales** entre las personas seleccionadas.
2. **Por importes exactos** (cada uno pone X).
3. **Por porcentajes.**
4. **Por partes/shares** (ponderado: la familia grande cuenta como N).

**✅ Redondeo (decidido): reparto automático del sobrante.** Cuando no cuadra al céntimo (10 € entre 3 → 3,34 / 3,33 / 3,33), la app **asigna los céntimos sueltos sola** y **avisa a quién le tocó el de más**. Nada de descuadres ni de pelearse por un céntimo. Aplica igual tras convertir divisa (§3.6).

### 3.3 Splits predefinidos por familia (el requisito clave) ⭐
- Como hay familias de distinto tamaño, se puede definir un **split por defecto del viaje** que tenga en cuenta a las familias.
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
- Marcar pagos/liquidaciones ("Ana ha pagado a Luis 20€").
- Estado por viaje: saldo total, tu saldo personal/familiar.
- **✅ Saldo actual + registro de cambios:** se muestra el "quién debe a quién" de ahora, con el **log de movimientos y pagos** (§9) para entender cómo se llegó ahí. Sin gráficas de evolución en v1 (eso a v2).
- **✅ Gastos editables:** un gasto mal metido **se puede editar** (importe, pagador, reparto…); el saldo se **recalcula** y el cambio queda en el historial. Editar tras liquidar deja aviso de que las cuentas se movieron.
- **Cierre de viaje:** al terminar, un resumen de "cuentas del viaje" y liquidación final. Reabrible (ver §2.5).

### 3.5 Fotos y adjuntos
- **✅ Decidido: sin fotos en v1.** Ni ticket ni foto de la paella. Motivo: las imágenes pesan y complican el **offline-first** (§12.2) — hay que almacenarlas, subirlas al reconectar y gestionar el espacio. Se pospone a v2. En v1 el justificante es la **nota de texto**.

### 3.6 Multi-moneda (decidido, con letra pequeña)
- **✅ Decidido:** se admiten **gastos en distintas monedas** con conversión.
- Cada viaje tiene una **moneda base** (donde se calculan saldos y liquidación). Cada gasto guarda su moneda original + el **tipo de cambio aplicado** en ese momento.
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

Actividades candidatas para los días del viaje.

- **Crear plan:** título, descripción, día/franja propuesta (o "sin fecha, a decidir"), coste estimado opcional, ubicación opcional.
- **Estados:** propuesto → votando → confirmado → hecho/cancelado.
- **Votación / interés:** la gente marca si le apunta (👍 / 🤷 / 👎) o se apunta a la lista. Útil para decidir sin discutir en el grupo de WhatsApp.
- **Asignar a un día** del calendario del viaje (vista por días).
- **✅ Decidido: lista + votación ligera.** Ideas para los días + 👍/🤷/👎 + asignar a un día. **Nada de agenda por franjas ni recordatorios** (eso es reinventar Google Calendar y dispara el scope).
- **Vínculo con gastos:** ¿un plan confirmado puede generar un gasto? (p. ej. "alquiler kayaks 40€"). Propuesta: enlace opcional, no obligatorio.
- **Vínculo con comidas:** una comida es un tipo de plan, pero la gestionamos aparte por su complejidad (§6).

### 4.1 Agenda por días (vista que une todo) ⭐
- **✅ Decidido:** además de las secciones sueltas (Gastos, Comidas, Planes), hay una **vista de agenda por días** que **une comidas y planes** de cada día: "Día 3 — playa por la mañana, paella de cena en Bunga 2".
- Da **sensación de itinerario** sin ser un calendario con franjas horarias (§4): es una lista por día, ordenada, con las comidas y los planes de ese día juntos.
- Las secciones sueltas siguen existiendo para "ver todos los gastos" o "toda la carta de comidas" de golpe; la agenda es la vista transversal del día a día.
- Es una buena **home del viaje activo**: al entrar, ves el día de hoy.

---

## 5. Personas dentro del viaje 👥

En la parte de viaje, por cada persona se define:

- **Familia** a la que pertenece (§2.2) — **cada uno elige su familia** (auto-asignación).
- **Rol:** edad (`adulto`/`niño`) + flags (ver abajo).
- **Bunga:** el de su familia (§2.3), no se asigna persona a persona.
- **Tipo de participante:** cuenta completa (con login) o perfil-nombre gestionado (§5.1).

### 5.1 Modelo de cuentas y pertenencia (aclarado) ⭐
- **Cada familia tiene como mínimo un login.** Ese login es quien puede saldar cuentas y gestionar la familia (encaja con "la deuda se salda entre familias", §3).
- Una persona puede ser:
  1. **Usuario completo:** se autentica (Apple/Google/email), **elige a qué familia pertenece** y participa por sí mismo.
  2. **Perfil-nombre gestionado ("fantasma"):** no tiene login; lo crea el login de una familia (típico para niños o para el cuñado que no se instala nada). Cuenta para comidas, bungas y reparto, pero no entra solo.
- Un perfil gestionado puede **"ascender" a usuario completo** más adelante si esa persona acaba instalando la app.
- **⚠️ Ojo (auto-asignación de familia):** si cada uno elige su familia libremente, alguien podría meterse en la familia equivocada y descuadrar el reparto. Propuesta: la elección es libre pero **visible para todos** en el viaje; sin aprobación formal (grupo de confianza), pero con el historial (§9) para detectar líos.

### ✅ Rol de persona: dos ejes en vez de "ambos" (decidido, Q4)
Se abandona el enum `niño/mayor/ambos` (ambiguo). En su lugar, cada persona tiene:
- **Categoría de edad:** `adulto` / `niño` (binario, claro).
- **Flags de comportamiento** independientes:
  - `come_con_mayores` (por defecto según edad; sobrescribible) → afecta a §6.4.
  - `cuenta_como_adulto_reparto` (por defecto según edad; sobrescribible) → afecta a §3.
- **`peso_reparto`** (✅ decidido): **cuánto cuenta esta persona en el reparto por cabezas**, configurable **en su perfil**. Por defecto 1 (adulto); un niño puede ponerse a 0,5 o lo que el grupo acuerde, **por persona** — no es un ajuste global del viaje. Un bebé podría ir a 0.
- Ejemplo: un **adolescente** = `niño` + `come_con_mayores: true` + `cuenta_como_adulto_reparto: true` + `peso_reparto: 1`. El antiguo "ambos" queda expresado de forma explícita y sin magia.
- Los defaults hacen que el 90% de la gente se configure sola: adulto = flags true + peso 1; niño = flags false + peso a elegir en su perfil.

---

## 6. Comidas y cenas 🍳

La sección más peculiar y donde hay más miga logística.

### 6.1 Modelo
- Una **Comida** = un evento de comer en un día concreto (desayuno / comida / merienda / cena / aperitivo).
- Cada comida tiene:
  - **Día** y **tipo** (comida/cena/…).
  - **Platos** seleccionados (§6.2).
  - **Bunga(s)** donde se come (§6.4).
  - **Campo "qué se hace / cómo"** (texto libre: preparación, quién cocina, instrucciones).
  - **Campo "cantidades"** (texto o estructurado: "2 kg de arroz, 30 mejillones…").

### 6.2 Platos predefinidos
- Catálogo de **platos** reutilizables ("tortilla", "paella", "sangría", "aceitunas").
- Cada plato tiene una o varias **clasificaciones** (ver §6.3) — un plato **puede ser varias cosas a la vez** (p. ej. algo que es aperitivo y acompañamiento).
- Al montar una comida, **seleccionas platos** del catálogo (y puedes crear uno nuevo al vuelo).
- **✅ Decidido (Q6): catálogo global + favoritos del grupo.** Los platos viven en un **catálogo global** reutilizable entre viajes ("la paella de siempre"), y además el grupo puede **marcar sus clásicos como favoritos** para tenerlos a mano al montar comidas. Se pueden crear platos nuevos al vuelo.

### 6.3 Clasificación de platos
Categorías (multi-selección, un plato puede tener varias):
- **Aperitivos**
- **Entrantes**
- **Principales**
- **Acompañamientos**
- **Postres** ✅ (añadida — la sandía también cuenta)

*(«Bebidas» se decide NO añadirla como categoría: va en el campo de cantidades o como acompañamiento.)*

### 6.4 Bungas en las comidas — rotación diaria mayores / niños ⭐
Aclarado el modelo real (corrige la versión anterior):

- Cada familia tiene su bunga (§2.3). Las comidas **rotan de sede**: no se come siempre en el mismo sitio.
- **La asignación se hace POR DÍA** (Q5 resuelta → **por día**): cada día del viaje se decide:
  - **qué bunga acoge la comida de los mayores**, y
  - **qué bunga acoge la de los niños**.
- **Objetivo de balanceo:** repartir la carga de "hacer de anfitrión" a lo largo del viaje, para que no le toque siempre al mismo bunga/familia cargar con la comilona.
  - **✅ Decidido:** la app **muestra el marcador** (cuántas veces ha acogido cada bunga a mayores y a niños) **y sugiere** a quién le toca ("hoy le toca al Bunga 3"), pero **decide un humano** — no auto-asigna.
- **✅ Anfitrión = solo prestar el bunga (el espacio).** Lo que se balancea es el **uso del sitio/mesa**, no el cocinar. Quién cocina puede ser una familia distinta y va aparte (§6.5). Así "acoger" no implica "currar".
- **Quién es "mayor" aquí** sale del flag `come_con_mayores` de cada persona (§5), no de la edad directamente. Así un adolescente marcado como niño pero que come con los adultos cae en la mesa correcta sin excepciones a mano.
- **Granularidad:** por defecto la asignación del día vale para todas las comidas de ese día; se puede afinar por comida si un día hace falta (p. ej. la cena especial donde comen todos juntos en un solo bunga).

### 6.5 Preguntas abiertas de comidas
- **Quién cocina es distinto de quién acoge** (§6.4). ¿Se modela como campo estructurado (asignar familia/personas) o va en el texto libre de "qué se hace"? Propuesta: empezar libre, estructurar si duele. ¿Se balancea también el turno de cocina, o eso ya os lo montáis a mano? (pendiente)
- ¿Las comidas generan gasto automáticamente (la compra) o el gasto va por libre en §3? Propuesta: desacoplado en v1, con enlace manual opcional.
- **✅ Lista de la compra: manual en v1, agregada en v2.** En v1 las cantidades son **texto libre por comida**; agregar todo en una lista de la compra global del viaje (sumando cantidades) se deja para **v2** (requiere cantidades estructuradas).

---

## 7. Estadísticas 📊

Sección de vanidad y de piques sanos. Todo por viaje (y quizá histórico entre viajes).

Ideas de métricas (con la ballena troleando):
- **Gastos:** total del viaje, gasto por persona/familia, quién ha pagado más, categoría más cara, "el más rácano" / "el manirroto".
- **Comidas:** nº de platos por tipo, plato más repetido, familia que más ha cocinado, **balance de anfitrión** (veces que cada bunga ha acogido comidas de mayores/niños — el mismo marcador que usa §6.4).
- **Planes:** planes propuestos vs realizados, el que más propone, el que más vota que no.
- **Curiosidades:** día más caro, ratio vino/persona, etc.
- **✅ Decidido: gamberras pero opt-in.** Por defecto las stats son suaves; las que **señalan a alguien** ("el rácano", "el manirroto") se **activan por viaje** si el grupo quiere. Humor sí, dramas reales no.

---

## 8. Modelo de datos (borrador de alto nivel)

```
User (Apple ID) 1─* Membership *─1 Trip
Trip 1─* Family
Trip 1─* Bunga
Trip 1─* Person   (Person → Family, Person → Bunga_dormir, rol)
Trip  1─1 monedaBase
Trip 1─* Expense  (Expense → payer(family), → splits[Family], moneda_original, tipo_cambio)
Trip 1─* SplitTemplate
Trip 1─* Plan
Trip 1─* Meal     (Meal → Dish[], → Bunga[], notas, cantidades)
Dish  *─* Category (aperitivo/entrante/principal/acompañamiento)   [¿global?]
```

Cerrado: unidad de deuda = **familia**; Family/Person = **globales, congeladas por viaje**; rol = **edad + flags**; **multi-moneda** (moneda base + tipo por gasto); **sin roles de app** (→ historial obligatorio). Pendiente: globalidad del catálogo de platos (Q6), granularidad bunga-comida (Q5), origen de tipos de cambio.

---

## 9. Permisos y roles de la app

- **✅ Decidido (Q7): todos editan todo, sin roles.** Cualquier miembro del viaje puede crear/editar/borrar gastos, comidas y planes. Confianza alta de grupo de amigos.
- **⚠️ Consecuencias que hay que asumir (yo recomendaba un "creador con extras"):**
  - **No hay quién "cierre" el viaje ni la liquidación** de forma autoritativa. Solución mínima: cualquiera puede marcar el viaje como cerrado, pero cualquiera puede reabrirlo (sin candado).
  - **Nadie puede expulsar** a un miembro problemático ni proteger un gasto de un borrado accidental o troll.
  - **Imprescindible un historial de cambios** (quién tocó qué y cuándo) para poder deshacer líos y evitar el "yo no fui". Esto pasa de nice-to-have a **requisito** precisamente porque no hay roles.
  - Recomiendo dejar el **modelo de datos preparado para roles** aunque la v1 no los use, por si el grupo pide un organizador más adelante.

---

## 10. Alcance por versiones (propuesta)

**✅ Decidido (Q8): priorizar gastos + gente.** El MVP no intenta cubrir las cinco áreas a la vez.

- **v1 (MVP, foco):** Auth (Apple ID + fallback), viajes con fechas, **personas/familias/bungas**, **gastos estilo Splitwise con reparto por familia + liquidación entre familias**. Es el núcleo de valor y lo más difícil de acertar.
- **v1.5:** comidas (platos, clasificación, bungas mayores/niños) y planes básicos.
- **v2:** estadísticas ricas, lista de la compra agregada, multi-moneda, notificaciones, histórico entre viajes, votaciones ricas en planes.
- Las áreas de comidas/planes/estadísticas se **especifican** en este doc pero **no se implementan** hasta cerrar el núcleo económico.

---

## 11. Marca y logo 🐋

- **Logo: una ballena** (ballenita — encaja con el repo `ballenita-ops`).
- **Inspiración:** el viaje del grupo es a **Camping La Ballena Alegre** (Sant Pere Pescador, Costa Brava). La mascota es una **ballena azul, sonriente y alegre**, en homenaje a ese sitio.
- **Referencia real:** la ballena del camping es azul, **saltando en diagonal**, con una **sonrisa dentona muy marcada** y un **chorro de gotas** sobre la cabeza, sobre fondo azul marino, acompañada del rótulo manuscrito "la ballena alegre / Costa Brava".
- **⚠️ Ojo legal:** ese logo (silueta + rótulo "la ballena alegre / Costa Brava") es **marca registrada de una empresa real**. La app usa una **ballena propia y original** que evoca el espíritu (azul, sonrisa dentona, chorro de gotas) **sin** copiar la silueta exacta y **sin** el rótulo del camping. Nada de dar a entender afiliación oficial.
- Dirección visual: ballena redondeada, azul, con **gran sonrisa con dientes** y **chorro de gotas**; el chorro puede ser de monedas/iconos según la sección.
- Mascota con voz en el microcopy (comenta en momentos clave, §0).

---

## 12. Notificaciones y sincronización

### 12.1 Notificaciones push
- **✅ Decidido: push a tope + resumen diario.** Se notifica bastante (te añaden a un gasto, te toca de anfitrión, alguien propone/vota un plan, se cierra el viaje…) y además un **resumen diario** ("lo que pasó ayer en el viaje", con la ballenita de narradora).
- **⚠️ Riesgo (yo recomendaba "mínimas"):** notificar mucho cansa y la gente silencia la app. Mitigación imprescindible: **preferencias por categoría** (que cada uno apague lo que no quiera) y el resumen diario como digest agrupado en vez de 20 pings sueltos. Sin esos controles, "push a tope" se vuelve en contra.
- Requiere permiso de notificaciones del sistema y un backend que sepa a quién avisar de qué.

### 12.2 Offline-first ⭐
- **✅ Decidido: la app funciona sin cobertura.** Se pueden apuntar gastos, comidas y planes **sin conexión** y todo se **sincroniza al recuperar red**. Es clave: los campings tienen poca o ninguna cobertura, que es justo donde se usa.
- **⚠️ Esto es la decisión más cara de todas técnicamente.** Implica:
  - **✅ Resolución de conflictos: último en sincronizar gana** (last-write-wins), apoyado en el **historial (§9)** para recuperar lo que se haya pisado. Simple y suficiente para un grupo pequeño; el historial es lo que lo hace tolerable sin roles.
  - **IDs generados en cliente** para no chocar al subir.
  - **La API de tipos de cambio no está disponible offline** (§3.6): si metes un gasto en divisa sin red, hay que permitir tipo manual o dejarlo pendiente de completar al reconectar.
  - Encaja bien con "todos editan todo", pero sube el listón de ingeniería del MVP. Merece una nota de riesgo en la planificación.

---

## 13. Tecnología y ambición

- **✅ Ambición: solo para el grupo de amigos.** No aspira a escalar ni a monetizar. Esto **simplifica muchísimo**: nada de onboarding pulido para desconocidos, ni políticas de privacidad complejas, ni soporte, ni panel de admin. Se optimiza para *nosotros*, con nombres y bromas internas.
- **✅ Plataforma: empezar como PWA (web app), migrar a iOS nativo con el tiempo.** Estrategia por fases:
  - **Fase 1 — PWA:** funciona en cualquier móvil desde el navegador, instalable, rápida de repartir por un enlace (encaja con el "unirse por QR/enlace"). No hay que pasar por la App Store para que la use el grupo.
  - **Fase 2 — iOS nativo (SwiftUI):** cuando compense, se va a nativo para un Sign in with Apple y un offline más finos y una sensación más pulida.
  - **⚠️ Tensión a tener presente:** hemos decidido **offline-first** (§12.2) y **PWA** a la vez. El offline en PWA es posible (Service Worker + IndexedDB) pero es **de lo más difícil de hacer bien** en web; hay que asumir ese coste desde el principio o aceptar un offline más limitado en Fase 1 y completo en Fase 2. Conviene decidirlo explícitamente al planificar.
  - Sign in with Apple **funciona en web**, así que el login con Apple no obliga a nativo desde el día 1.

---

## 14. Registro de decisiones

### ✅ Cerradas
| # | Decisión | Resolución |
|---|---|---|
| Q1 | Autenticación | **Apple ID + fallback** (Google / email con enlace mágico) |
| Q2 | Familias/personas | **Globales**, composición **congelada por viaje** |
| Q3 | Unidad de deuda | **Entre familias** (familia = cartera; persona sin familia = familia de uno) |
| Q4 | Rol de persona | **Dos ejes:** edad (`adulto`/`niño`) + flags (`come_con_mayores`, `cuenta_como_adulto_reparto`) |
| Q7 | Permisos | **Todos editan todo, sin roles** → historial de cambios pasa a obligatorio |
| Q8 | Alcance v1 | **Priorizar gastos + gente**; comidas/planes/estadísticas después |
| Q5 | Bunga de comidas | **Rotación por día** (bunga anfitrión de mayores y de niños cada día), buscando balance |
| Q6 | Catálogo de platos | **Global + favoritos del grupo** |
| — | Moneda | **Multi-moneda** (moneda base por viaje + tipo congelado por gasto) |
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
| — | Recurrencia | **Duplicar viaje anterior** al crear uno nuevo |
| — | Cierre de viaje | **Se cierra pero es reabrible** (sin candado; resumen + liquidación) |
| — | Tono de estadísticas | **Gamberras pero opt-in** (las que señalan se activan por viaje) |
| — | Pagadores | **Uno o varios** por gasto (reserva a medias) |
| — | Redondeo | **Reparto automático del sobrante**, avisando a quién le tocó el céntimo |
| — | Categorías de gasto | **Lista fija con iconos** (comida/aloj./transporte/ocio/varios) |
| — | Fotos | **Sin fotos en v1** (pesan y complican el offline); a v2 |
| — | Peso de niños en reparto | **`peso_reparto` por persona** (en su perfil), default 1 |
| — | Historial de saldos | **Saldo actual + registro de cambios**; **gastos editables** con recálculo |
| — | Idioma | **Solo español** (sin i18n en v1) |
| — | Multi-viaje | **Varios a la vez, con uno "activo"** resaltado |
| — | Unirse a un viaje | **Enlace / QR** + elegir familia |
| — | Bunga↔familia | **1 familia = 1 bunga** en v1 (casos raros a mano) |
| — | Plataforma | **PWA primero → iOS nativo (SwiftUI) después** |
| — | Ambición | **Solo para el grupo** (sin escalar ni monetizar) |
| — | La ballenita | **Comenta en momentos clave**, sin cansar |
| — | Lista de la compra | **Manual (texto) en v1**, agregada en v2 |
| — | Agenda por días | **Vista que une comidas + planes** por día, junto a las secciones sueltas |
| — | Botes / gastos comunes | **No**: todo gasto vive dentro de un viaje |

### 🟡 Aún abiertas (recomendación entre paréntesis)
| # | Decisión | Recomendación |
|---|---|---|
| — | Turno de cocina: ¿se balancea o va a mano? (§6.5) | A mano en v1 |
| — | Proveedor de la API de tipos de cambio + fallback (§3.6) | Por decidir (nivel implementación) |
| — | Alcance del offline en Fase 1 PWA (§13): ¿completo o limitado? | Limitado en PWA, completo en nativo |
```
