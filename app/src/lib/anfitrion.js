// Cuántas veces le ha tocado acoger a cada bunga.

/**
 * El balance de anfitrión: **veces que cada bunga ha acogido** (§6.4, §14.72).
 *
 * Vive aquí y no dentro de `computeStats` porque lo leen **dos** pantallas —el
 * balance de Números y el elegidor de bunga de un día—, y son la misma pregunta
 * hecha en dos momentos: «¿cómo ha quedado el reparto?» y «¿a quién le toca hoy?».
 * Contarlo dos veces es la clase de cosa que se desfasa en silencio y acaba con
 * dos pantallas dando números distintos para lo mismo.
 *
 * **Una noche fuera no la acoge nadie** (§14.70-bis): los bungas no se borran al
 * marcar «se cena fuera» —se quedan por si se vuelve al camping, como los
 * platos—, así que sin esta guarda se le apuntaría una noche de anfitrión a quien
 * esa noche estaba en el chiringuito.
 *
 * `excepto` es un día que no se cuenta, y existe para el elegidor: al reabrir el
 * bunga de una noche ya repartida, la propia noche que se está decidiendo
 * inflaría a quien está puesto y la cuenta dejaría de contestar lo que se le
 * pregunta, que es a quién le toca **aparte de esta**.
 *
 * Una misma noche puede sumar **dos** —el mismo bunga acoge a mayores y a
 * niños—, y está bien: son dos mesas que montar y dos que recoger.
 */
export function anfitrionPorBunga(cenas = [], { excepto = null } = {}) {
  const cuenta = new Map()
  const dame = (id) => {
    if (!cuenta.has(id)) cuenta.set(id, { mayores: 0, ninos: 0, total: 0 })
    return cuenta.get(id)
  }
  for (const c of cenas) {
    if (c?.fuera) continue
    if (excepto && c?.dia === excepto) continue
    if (c?.bungaMayoresId) { dame(c.bungaMayoresId).mayores += 1; dame(c.bungaMayoresId).total += 1 }
    if (c?.bungaNinosId) { dame(c.bungaNinosId).ninos += 1; dame(c.bungaNinosId).total += 1 }
  }
  return cuenta
}

/**
 * Cómo se dice esa cuenta en el elegidor: «3 veces», «1 vez», «aún ninguna».
 *
 * El cero **se dice**, y es lo contrario de la regla de §14.38 —«el cero no se
 * dice»— porque aquí no es la ausencia de un dato sino **la respuesta**: el bunga
 * que no ha acogido todavía es justo el que se está buscando.
 */
export function vecesEnLetra(veces = 0) {
  if (!veces) return 'aún ninguna'
  return veces === 1 ? '1 vez' : `${veces} veces`
}
