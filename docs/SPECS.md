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
- **Tono con humor.** Microcopy gamberro, estados vacíos con gracia, la ballena como mascota que comenta cosas ("La ballenita ha detectado que Fran lleva 3 cenas sin pagar 🐋").
- **Mobile-first.** Esto se usa con el móvil en la mano, en chanclas, con mala cobertura. Debe funcionar rápido y, a poder ser, offline-tolerante.

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
- **Invitados sin cuenta:** ¿se puede añadir a alguien al viaje que no tiene la app (p. ej. la pareja de un amigo, un niño)? Sí, deberían existir **participantes "fantasma"** (perfiles gestionados por otro usuario, sin login propio) — sobre todo para niños y para gente que no se instala nada. Ver §5.

### 2.2 Familias

- Una familia es una etiqueta/grupo de personas **dentro de un viaje**.
- Casos de uso:
  1. **Reparto de gastos por familia** (el pool con 5 personas paga más que el soltero).
  2. **Logística de comidas** (esta familia cocina hoy, los niños de estas familias comen en el bunga X).
- **✅ Decidido (Q2): globales, congeladas por viaje.** Hay un catálogo **global** de personas y familias reutilizable cada año, pero la **composición de cada viaje se congela** al añadir gente (este año no vino el hijo mayor, hay novia nueva, etc.). Cambiar la familia global no reescribe viajes pasados.

### 2.3 Bungas (bungalows)

- Se **definen al principio del viaje**: nombre/identificador ("Bunga 1", "El de la piscina"), capacidad opcional.
- Una persona se asigna a un bunga (dónde duerme).
- Los bungas se usan también en comidas (§6): dónde se come cada cosa.
- **Pregunta (Q abierta):** ¿una persona puede estar en varios bungas? (p. ej. duerme en uno, pero come en otro). Propuesta: separar **"bunga de dormir"** (1 por persona) de **"bunga donde come"** (que se decide por comida). Ver §6.4.

### 2.4 Gente / participantes (común pero se instancia por viaje)

Ver §5 (es tan central que tiene sección propia).

---

## 3. Gastos — "Modo Splitwise" 💸

El corazón económico. Inspirado en Splitwise pero con el giro de **reparto por familias**.

### 3.1 Crear un gasto
Campos:
- **Descripción** ("Compra grande Mercadona", "Gasolina").
- **Importe** + **moneda** del gasto (**multi-moneda**, ver §3.6).
- **Quién paga** (uno o varios pagadores; normalmente uno).
- **Cómo se divide** (ver §3.2).
- **Fecha** (por defecto hoy, dentro del rango del viaje).
- **Categoría** (comida, alojamiento, transporte, ocio, varios) — opcional pero alimenta las estadísticas (§9).
- Nota/foto del ticket (opcional).

### 3.2 Cómo se divide el gasto
Modos de reparto:
1. **A partes iguales** entre las personas seleccionadas.
2. **Por importes exactos** (cada uno pone X).
3. **Por porcentajes.**
4. **Por partes/shares** (ponderado: la familia grande cuenta como N).

### 3.3 Splits predefinidos por familia (el requisito clave) ⭐
- Como hay familias de distinto tamaño, se puede definir un **split por defecto del viaje** que tenga en cuenta a las familias.
- Idea: cada gasto, por defecto, se reparte **por número de personas de cada familia participante** (o por un peso configurable por familia).
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

### 3.4 Saldos y liquidación
- Vista de **"quién debe a quién"** con **simplificación de deudas** (minimizar el nº de transferencias, como Splitwise).
- Marcar pagos/liquidaciones ("Ana ha pagado a Luis 20€").
- Estado por viaje: saldo total, tu saldo personal/familiar.
- **Cierre de viaje:** al terminar, un resumen de "cuentas del viaje" y liquidación final.

### 3.6 Multi-moneda (decidido, con letra pequeña)
- **✅ Decidido:** se admiten **gastos en distintas monedas** con conversión.
- Cada viaje tiene una **moneda base** (donde se calculan saldos y liquidación). Cada gasto guarda su moneda original + el **tipo de cambio aplicado** en ese momento.
- **⚠️ Aviso de complejidad (fui recomendación de "una sola moneda"):** multi-moneda mete decisiones que hay que cerrar antes de implementar:
  - ¿De dónde salen los tipos de cambio? (manual por el usuario / API de tipos / fijado por viaje). Sin esto, los saldos no cuadran.
  - Los tipos fluctúan: si se recalcula a posteriori, los saldos cambian. Propuesta: **congelar el tipo al crear el gasto** y no re-tocarlo.
  - Redondeos y descuadres de céntimos al convertir. Hay que decidir a favor de quién redondea.
  - Esto encarece el MVP; si aprieta el tiempo, se puede lanzar con una moneda y activar multi-moneda justo después sin romper el modelo (por eso guardamos moneda+tipo desde el día 1).

### 3.7 Preguntas abiertas de gastos
- ¿Gastos que ocurren fuera del rango de fechas (adelantos, reservas previas)? Propuesta: permitir fecha fuera de rango con aviso.
- ¿Editar/borrar gastos ya liquidados? (historial/auditoría).
- **Origen de los tipos de cambio** (ver §3.6) — decisión pendiente.

---

## 4. Planes 🗺️

Actividades candidatas para los días del viaje.

- **Crear plan:** título, descripción, día/franja propuesta (o "sin fecha, a decidir"), coste estimado opcional, ubicación opcional.
- **Estados:** propuesto → votando → confirmado → hecho/cancelado.
- **Votación / interés:** la gente marca si le apunta (👍 / 🤷 / 👎) o se apunta a la lista. Útil para decidir sin discutir en el grupo de WhatsApp.
- **Asignar a un día** del calendario del viaje (vista por días).
- **⚠️ Crítica:** cuidado con solapar esto con una app de calendario. v1 debería ser ligera: lista de ideas + votación + a qué día va. Sin invitaciones tipo Google Calendar ni recordatorios complejos.
- **Vínculo con gastos:** ¿un plan confirmado puede generar un gasto? (p. ej. "alquiler kayaks 40€"). Propuesta: enlace opcional, no obligatorio.
- **Vínculo con comidas:** una comida es un tipo de plan, pero la gestionamos aparte por su complejidad (§6).

---

## 5. Personas dentro del viaje 👥

En la parte de viaje, por cada persona se define:

- **Familia** a la que pertenece (§2.2).
- **Rol:** `mayor`, `niño` o **`ambos`**.
- **Bunga donde duerme** (§2.3).
- (Opcional) si es un participante "fantasma" gestionado por otro.

### ✅ Rol de persona: dos ejes en vez de "ambos" (decidido, Q4)
Se abandona el enum `niño/mayor/ambos` (ambiguo). En su lugar, cada persona tiene:
- **Categoría de edad:** `adulto` / `niño` (binario, claro).
- **Flags de comportamiento** independientes:
  - `come_con_mayores` (por defecto según edad; sobrescribible) → afecta a §6.4.
  - `cuenta_como_adulto_reparto` (por defecto según edad; sobrescribible) → afecta a §3.
- Ejemplo: un **adolescente** = `niño` + `come_con_mayores: true` + `cuenta_como_adulto_reparto: true`. El antiguo "ambos" queda expresado de forma explícita y sin magia.
- Los defaults hacen que el 90% de la gente se configure sola: adulto = ambos flags true, niño = ambos false.

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
- **Q abierta:** ¿el catálogo de platos es global (se reutiliza entre viajes, "la paella de siempre") o por viaje? Propuesta: **global**, para no reescribir la carta cada año.

### 6.3 Clasificación de platos
Categorías (multi-selección, un plato puede tener varias):
- **Aperitivos**
- **Entrantes**
- **Principales**
- **Acompañamientos**

*(¿Faltan "postres" y "bebidas"? Los apunto como candidatos — Q abierta.)*

### 6.4 Bungas en las comidas — mayores vs niños
- Se puede **definir en qué bunga(s) comen los mayores y en cuál(es) los niños**.
- **⚠️ Decisión de granularidad (Q5):** ¿esto se define…
  - (a) **una vez por viaje** ("los niños siempre comen en el Bunga 2"),
  - (b) **por día**,
  - (c) **por comida**?
  - Recomendación: por defecto **a nivel viaje** (los niños comen en el Bunga X, los mayores en el Y), con posibilidad de **sobrescribir por comida** cuando haga falta. Menos clicks el 90% del tiempo.
- **Quién es "mayor" aquí** sale del flag `come_con_mayores` de cada persona (§5), no de la edad directamente. Así un adolescente marcado como niño pero que come con los adultos cae en el bunga correcto sin excepciones a mano.

### 6.5 Preguntas abiertas de comidas
- ¿Quién cocina se modela como campo estructurado (asignar personas/familia) o va en el texto libre de "qué se hace"? Propuesta: empezar libre, estructurar si duele.
- ¿Las comidas generan gasto automáticamente (la compra) o el gasto va por libre en §3? Propuesta: desacoplado en v1, con enlace manual opcional.
- ¿Lista de la compra agregada a partir de las "cantidades" de todas las comidas? Sería potente pero es v2.

---

## 7. Estadísticas 📊

Sección de vanidad y de piques sanos. Todo por viaje (y quizá histórico entre viajes).

Ideas de métricas (con la ballena troleando):
- **Gastos:** total del viaje, gasto por persona/familia, quién ha pagado más, categoría más cara, "el más rácano" / "el manirroto".
- **Comidas:** nº de platos por tipo, plato más repetido, familia que más ha cocinado.
- **Planes:** planes propuestos vs realizados, el que más propone, el que más vota que no.
- **Curiosidades:** día más caro, ratio vino/persona, etc.
- **⚠️ Crítica:** ojo con estadísticas que señalen a alguien de forma incómoda ("el que menos paga"). Con humor sí, pero con opción de que sea opt-in/desactivable para no montar dramas reales.

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
- Dirección visual: ballena redondeada, simpática, azul; podría "escupir" un chorro que sean monedas/iconos según la sección.
- Mascota con voz en el microcopy (estados vacíos, avisos, estadísticas).
- **Q abierta:** ¿nombre de la app? ("Ballenita", "Ballena Ops", otro).

---

## 12. Registro de decisiones

### ✅ Cerradas
| # | Decisión | Resolución |
|---|---|---|
| Q1 | Autenticación | **Apple ID + fallback** (Google / email con enlace mágico) |
| Q2 | Familias/personas | **Globales**, composición **congelada por viaje** |
| Q3 | Unidad de deuda | **Entre familias** (familia = cartera; persona sin familia = familia de uno) |
| Q4 | Rol de persona | **Dos ejes:** edad (`adulto`/`niño`) + flags (`come_con_mayores`, `cuenta_como_adulto_reparto`) |
| Q7 | Permisos | **Todos editan todo, sin roles** → historial de cambios pasa a obligatorio |
| Q8 | Alcance v1 | **Priorizar gastos + gente**; comidas/planes/estadísticas después |
| — | Moneda | **Multi-moneda** (moneda base por viaje + tipo congelado por gasto) |
| — | Nombre | **Ballena Ops** (mascota: la ballenita) |

### 🟡 Aún abiertas (recomendación entre paréntesis)
| # | Decisión | Recomendación |
|---|---|---|
| Q5 | Bunga de comida mayores/niños: ¿por viaje, día o comida? | Por viaje, override por comida |
| Q6 | Catálogo de platos: ¿global o por viaje? | Global |
| — | Origen de los tipos de cambio (§3.6) | Congelar al crear el gasto; fuente a decidir |
| — | ¿Postres y bebidas como clasificación de plato? (§6.3) | Añadirlas |
```
