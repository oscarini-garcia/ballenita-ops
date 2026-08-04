/**
 * Las cinco categorías de un gasto.
 *
 * Viven aquí y no en la pantalla porque las miran cuatro sitios —la lista, la
 * ficha, la hoja del reparto y Estadísticas— y tenerlas colgando de
 * `ExpensesScreen.jsx` obligaba a importar una pantalla entera para saber cómo
 * se llama «bebida».
 *
 * `icon` es el nombre de un dibujo de `components/Icono.jsx` y `tono` el que le
 * toca de la paleta de categorías (`theme.css`). Es **el único color de la app
 * además del de los saldos** (§14.13) y está ahí porque informa: en una lista de
 * cuarenta gastos, el tono se lee antes que la palabra.
 */
export const CATEGORIES = [
  { id: 'compra_general', label: 'Compra general', corto: 'Compra', icon: 'compra', tono: 'compra' },
  { id: 'comida', label: 'Comida', corto: 'Comida', icon: 'comida', tono: 'comida' },
  { id: 'bebida', label: 'Bebida', corto: 'Bebida', icon: 'bebida', tono: 'bebida' },
  { id: 'restaurante', label: 'Restaurante', corto: 'Restau.', icon: 'restaurante', tono: 'restaurante' },
  { id: 'varios', label: 'Varios', corto: 'Varios', icon: 'varios', tono: 'varios' },
]

/** La categoría de un gasto, con «Varios» de red por si llega una que ya no existe. */
export const catOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES.at(-1)
