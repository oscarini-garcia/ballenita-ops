/**
 * Cómo se agrupa la lista de la compra cuando cada familia tiene la suya
 * (SPECS §14.54, `docs/diseño/siete-encargos.html` · C1 · C2).
 *
 * **Se eligió secciones y no un filtro.** Un segmentado «Todas · La mía» cuesta
 * ~57 pt permanentes arriba y, sobre todo, obliga a un toque para ver lo que ya
 * cabía: en el súper lo que hace falta es la lista entera de un vistazo, porque
 * quien va compra para todos. Con ocho líneas un filtro esconde; con cuarenta,
 * las secciones ya separan.
 *
 * **Y nada se oculta.** En esta app no hay nada privado —todo se sincroniza y
 * todo se ve—, así que la lista de una familia la leen las demás. Es lo que hace
 * que quien sale hacia el súper pregunte una vez en vez de nueve, y evita tener
 * que decidir qué ve quien administra.
 *
 * Puro: recibe filas y devuelve grupos. Sin esto la pantalla tendría tres
 * bucles anidados y ninguna prueba que dijera en qué orden salen.
 */

/**
 * Los grupos, en el orden en que se pintan:
 *
 *  1. **De las cenas** — lo que calcula la receta, que no es de nadie y es lo
 *     primero que hay que meter en el carro.
 *  2. **Común** — lo apuntado a mano sin dueño: el hielo, el papel de cocina.
 *  3. **Una sección por familia**, por nombre.
 *
 * Dentro de los dos primeros se sigue partiendo por categoría, que es el corte
 * que tenían desde §6.6 y que sirve para recorrer los pasillos. Dentro de una
 * familia **no**: son tres o cuatro cosas y partirlas en cinco encabezados de
 * una línea cada uno gasta más alto que la lista.
 *
 * Una línea de una familia que ya no existe —se borró la familia y sus líneas
 * no— cae en «Común» en vez de desaparecer: perderla de vista sería peor que
 * enseñarla en el sitio de al lado.
 */
export function gruposDeCompra(pendientes = [], familias = [], categorias = []) {
  const porId = new Map(familias.map((f) => [f.id, f]))
  const grupos = []

  const deCenas = pendientes.filter((x) => x.origen === 'cena')
  const comunes = pendientes.filter((x) => x.origen !== 'cena' && !porId.has(x.familyId))
  const deFamilia = pendientes.filter((x) => x.origen !== 'cena' && porId.has(x.familyId))

  const porCategoria = (lista, prefijo, titulo) => {
    for (const cat of categorias) {
      const list = lista.filter((x) => x.categoria === cat.id)
      if (list.length) grupos.push({ clave: `${prefijo}:${cat.id}`, titulo: titulo(cat), cat, list })
    }
    // Lo que lleva una categoría que ya no existe no se pierde: se va al final
    // de su bloque, con el nombre que tenga.
    const sueltas = lista.filter((x) => !categorias.some((c) => c.id === x.categoria))
    if (sueltas.length) grupos.push({ clave: `${prefijo}:otras`, titulo: 'Sin categoría', cat: null, list: sueltas })
  }

  porCategoria(deCenas, 'cena', (cat) => `De las cenas · ${cat.label}`)
  porCategoria(comunes, 'comun', (cat) => `${cat.label}`)

  for (const fam of [...familias].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))) {
    const list = deFamilia.filter((x) => x.familyId === fam.id)
    if (list.length) grupos.push({ clave: `fam:${fam.id}`, titulo: `Los ${fam.name}`, familia: fam, cat: null, list })
  }

  return grupos
}

/**
 * Cómo se llama el sitio donde se está apuntando, para el renglón de arriba.
 *
 * Se dice **siempre**, también cuando es «Común»: un renglón que solo habla
 * cuando has elegido familia deja el caso normal sin decir dónde va lo que
 * escribes, y esa es justo la vez que hay que acertar.
 */
export const dondeSeApunta = (familia) => (familia ? `Para los ${familia.name}` : 'Para todos')
