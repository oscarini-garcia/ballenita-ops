# Ballenita 🐋 — Specs de producto

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

- **Login con Apple ID (Sign in with Apple).**
- Perfil mínimo: nombre visible, avatar (opcional), Apple ID.
- **⚠️ Crítica de diseño:** *solo* Apple ID deja fuera a cualquier amigo con Android/sin dispositivo Apple. En un grupo de amigos casi seguro hay alguien con Android. **Decisión pendiente (Q1).** Recomendación: Apple ID como método principal + un fallback (Google o email/enlace mágico) para no bloquear a nadie.
- **Invitados sin cuenta:** ¿se puede añadir a alguien al viaje que no tiene la app (p. ej. la pareja de un amigo, un niño)? Sí, deberían existir **participantes "fantasma"** (perfiles gestionados por otro usuario, sin login propio) — sobre todo para niños y para gente que no se instala nada. Ver §5.

### 2.2 Familias

- Una familia es una etiqueta/grupo de personas **dentro de un viaje**.
- Casos de uso:
  1. **Reparto de gastos por familia** (el pool con 5 personas paga más que el soltero).
  2. **Logística de comidas** (esta familia cocina hoy, los niños de estas familias comen en el bunga X).
- **⚠️ Crítica / decisión (Q2):** ¿la familia es global (persiste entre viajes, "Los García" siempre son Los García) o se define por viaje? Recomendación: catálogo global de personas + familias, pero **la pertenencia y composición se congela por viaje** (la gente cambia: divorcios, nuevos novios, un año no viene el hijo mayor).

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
- **Importe** + **moneda** (¿multi-moneda? Q abierta; propuesta: una sola moneda por viaje, fijada al crear el viaje).
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
- **⚠️ Decisión importante (Q3):** ¿la deuda se salda entre **personas** o entre **familias**? Esto cambia todo el modelo:
  - *Entre personas*: Splitwise clásico. Al final, "Ana debe 20€ a Luis".
  - *Entre familias*: "Los García deben 60€ a Los Pérez", y dentro de la familia ya se apañan. Más simple para grupos donde cada familia tiene una "cartera" común.
  - Recomendación: **saldar entre familias** como modo por defecto (encaja con "familias más grandes"), con la persona como unidad opcional. Pero necesito tu confirmación porque es el eje del diseño.

### 3.4 Saldos y liquidación
- Vista de **"quién debe a quién"** con **simplificación de deudas** (minimizar el nº de transferencias, como Splitwise).
- Marcar pagos/liquidaciones ("Ana ha pagado a Luis 20€").
- Estado por viaje: saldo total, tu saldo personal/familiar.
- **Cierre de viaje:** al terminar, un resumen de "cuentas del viaje" y liquidación final.

### 3.5 Preguntas abiertas de gastos
- ¿Multi-moneda con conversión? (propuesta: no en v1).
- ¿Gastos que ocurren fuera del rango de fechas (adelantos, reservas previas)? Propuesta: permitir fecha fuera de rango con aviso.
- ¿Editar/borrar gastos ya liquidados? (historial/auditoría).

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

### ⚠️ El problema del rol "ambos"
"Niño / mayor / ambos" es ambiguo y me chirría. ¿Qué significa "ambos"?
- ¿Un adolescente que a veces cuenta como niño (para comidas) y a veces como adulto (para el vino)?
- ¿Alguien que come en la mesa de los niños pero paga como adulto?

**Propuesta (a validar, Q4):** separar dos ejes en vez de un enum confuso:
- **Categoría de edad:** `adulto` / `niño` (binario, claro).
- **Flags de comportamiento** independientes, p. ej. "come en la mesa de los mayores", "cuenta como adulto para el reparto". Así un adolescente = niño + "come/paga como mayor". Esto elimina el "ambos" mágico y lo hace explícito.

Si prefieres mantener `mayor/niño/ambos` tal cual por simplicidad, lo dejamos, pero conviene decidir **qué decisiones concretas depende de ese rol** (comidas, gastos, o ambas).

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
- Esto conecta con el rol de persona (§5): "mayores" y "niños" salen de ahí. Por eso urge cerrar el tema del rol/"ambos".

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
Trip 1─* Expense  (Expense → payer(s), → splits[Person|Family])
Trip 1─* SplitTemplate
Trip 1─* Plan
Trip 1─* Meal     (Meal → Dish[], → Bunga[], notas, cantidades)
Dish  *─* Category (aperitivo/entrante/principal/acompañamiento)   [¿global?]
```

Pendiente de cerrar según respuestas: unidad de deuda (persona vs familia), globalidad de Family/Dish, ejes del rol.

---

## 9. Permisos y roles de la app (NO cubierto en tu brief — lo levanto)

- ¿Quién puede crear un viaje? ¿Quién invita?
- ¿Todos editan todo, o hay un **admin/organizador** del viaje?
- ¿Puede alguien borrar un gasto de otro?
- **Propuesta v1 (simple):** todos los miembros del viaje pueden editar todo (grupo de amigos, confianza alta), con un historial de cambios para auditar. Un "creador del viaje" con poderes extra (cerrar viaje, expulsar). Confírmame (Q abierta).

---

## 10. Alcance por versiones (propuesta)

- **v1 (MVP):** Auth, viajes con fechas, personas/familias/bungas, gastos estilo Splitwise con splits por familia, saldos + liquidación, planes básicos, comidas con platos y bungas, estadísticas mínimas.
- **v2:** lista de la compra agregada, multi-moneda, notificaciones, histórico entre viajes, votaciones ricas en planes.
- **⚠️ Riesgo de scope:** esto es MUCHO para un MVP. Recomiendo priorizar duro: probablemente **gastos + personas/familias/bungas** primero (es lo que da valor y es lo más difícil), y comidas/planes/estadísticas después.

---

## 11. Marca y logo 🐋

- **Logo: una ballena** (ballenita — encaja con el repo `ballenita-ops`).
- Dirección visual: ballena redondeada, simpática, azul; podría "escupir" un chorro que sean monedas/iconos según la sección.
- Mascota con voz en el microcopy (estados vacíos, avisos, estadísticas).
- **Q abierta:** ¿nombre de la app? ("Ballenita", "Ballena Ops", otro).

---

## 12. Resumen de decisiones que necesito de ti

| # | Decisión | Recomendación |
|---|---|---|
| Q1 | ¿Solo Apple ID o también fallback (Android/email)? | Apple ID + fallback |
| Q2 | Familias: ¿globales o por viaje? | Personas globales, composición congelada por viaje |
| Q3 | Deuda: ¿se salda entre personas o entre familias? | Entre familias (con persona opcional) |
| Q4 | Rol persona: ¿enum `niño/mayor/ambos` o ejes separados (edad + flags)? | Ejes separados |
| Q5 | Bunga de comida mayores/niños: ¿por viaje, día o comida? | Por viaje, override por comida |
| Q6 | Catálogo de platos/familias: ¿global o por viaje? | Global |
| Q7 | Permisos: ¿todos editan o hay admin? | Todos editan + creador con extras |
| Q8 | Alcance v1: ¿todo o priorizar gastos primero? | Priorizar gastos + gente |
```
