/**
 * Quién vigila si ha salido versión nueva mientras la app está abierta
 * (SPECS §14.46).
 *
 * El reparto de trabajo es el que decide si esto se puede hacer cada minuto:
 *
 * - **Preguntar es barato** (`hayOtaNueva`): un JSON de 204 bytes. Se hace en
 *   cada latido, y en cuanto la respuesta es que sí **se deja de preguntar** —
 *   ya lo sabemos, y repetirlo cada minuto durante media hora no añade nada.
 * - **Aplicar es caro y es intrusivo**: descarga el paquete y **recarga la
 *   webview**, que es tirar por la borda lo que haya a medio escribir —el
 *   formulario de un gasto no está en la base hasta que se guarda—. Por eso no
 *   se aplica en el latido sino **al volver a primer plano**: ahí el contexto
 *   ya estuvo suspendido, nadie tiene un dedo encima y una recarga es lo que
 *   cualquier app hace al volver.
 *
 * La consecuencia, dicha para que no se descubra usándola: con la app **abierta
 * y sin soltarla**, la versión nueva se detecta pero no se pone hasta que se
 * cambia de app y se vuelve. Es el precio de no quitarle a nadie un gasto a
 * medio teclear, y se paga una vez por versión.
 *
 * Todo lo que decide está aquí y con sus dependencias inyectadas: `native.js`
 * no se puede probar dentro de jsdom —importa el plugin de Capacitor— y esta
 * lógica sí, que es la que puede equivocarse.
 */
export function creaVigilante({ hayNueva, aplicar }) {
  // La versión que ya sabemos que hay ahí fuera, o null.
  let pendiente = null
  let aplicando = false

  return {
    /** El latido: pregunta, salvo que ya tengamos noticia. */
    async comprobar() {
      if (pendiente) return pendiente
      const r = await hayNueva()
      if (r?.hay && r.version) pendiente = r.version
      return pendiente
    },

    /**
     * Al volver a primer plano: si hay una esperando, se pone. Devuelve la
     * versión aplicada, o `null` si no había nada que hacer.
     *
     * `aplicando` no es paranoia: `aplicar` acaba recargando, y entre que se
     * llama y la recarga ocurre puede llegar otro `visibilitychange` — dos
     * descargas del mismo paquete a la vez.
     */
    async aplicarSiToca() {
      if (!pendiente || aplicando) return null
      aplicando = true
      const version = pendiente
      try {
        await aplicar()
        pendiente = null
        return version
      } catch {
        // Si no se pudo poner, la noticia se queda: al siguiente regreso a
        // primer plano se vuelve a intentar.
        return null
      } finally {
        aplicando = false
      }
    },

    /** Lo que sabemos ahora mismo, para quien quiera pintarlo. */
    get pendiente() { return pendiente },
  }
}
