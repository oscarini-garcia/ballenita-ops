/**
 * El evento de prueba «Ballenita 2026», en un fichero aparte para que también
 * lo puedan usar las pruebas: así se garantiza que estos datos siguen entrando
 * en el esquema real y saliendo íntegros, y no se descubre lo contrario al
 * sembrar una base de verdad.
 */

export function instantaneaDeEjemplo(ahora = new Date().toISOString()) {
  const EV = 'ev_demo';

  // Las marcas de tiempo van todas al pasado para que cualquier cosa que se
  // escriba desde la app después mande sobre esto, que es lo que se quiere de
  // unos datos de prueba: que estorben lo mínimo.
  const marca = new Date(Date.parse(ahora) - 1000 * 60 * 60 * 24).toISOString();

  const familias = [
    { id: 'fam_garcia', name: 'García', color: '#E5544B', avatar: '🏖️', estado: 'modo playa' },
    { id: 'fam_perez', name: 'Pérez', color: '#2E9E6B', avatar: '🍷', estado: 'a por el vino' },
    { id: 'fam_solteros', name: 'Solteros', color: '#1FA6D6', avatar: '🎉', estado: 'sin dormir' },
  ];

  const bungas = [
    { id: 'bunga_1', name: 'Bunga 1', alias: 'El de la piscina', familyId: 'fam_garcia' },
    { id: 'bunga_2', name: 'Bunga 2', alias: 'El del ruido', familyId: 'fam_perez' },
    { id: 'bunga_3', name: 'Bunga 3', alias: 'El del fondo', familyId: 'fam_solteros' },
  ];

  const personas = [
    { id: 'per_curro', name: 'Curro', familyId: 'fam_garcia', edad: 'adulto' },
    { id: 'per_marta', name: 'Marta', familyId: 'fam_garcia', edad: 'adulto' },
    { id: 'per_fran', name: 'Fran', familyId: 'fam_garcia', edad: 'niño', apodo: 'el adolescente', comeConMayores: true, cuentaComoAdultoReparto: true, pesoReparto: 1 },
    { id: 'per_ana', name: 'Ana', familyId: 'fam_perez', edad: 'adulto' },
    { id: 'per_luis', name: 'Luis', familyId: 'fam_perez', edad: 'adulto' },
    { id: 'per_lucia', name: 'Lucía', familyId: 'fam_perez', edad: 'niño' },
    { id: 'per_pablo', name: 'Pablo', familyId: 'fam_solteros', edad: 'adulto' },
  ].map((p) => ({
    avatar: '🧑',
    apodo: '',
    estado: '',
    comeConMayores: p.edad === 'adulto',
    cuentaComoAdultoReparto: p.edad === 'adulto',
    pesoReparto: p.edad === 'adulto' ? 1 : 0.5,
    ...p,
    eventId: EV,
  }));

  const mayores = personas.filter((p) => p.cuentaComoAdultoReparto).map((p) => p.id);
  const todos = personas.map((p) => p.id);

  const platos = [
    { id: 'dish_demo_aceitunas', name: 'Aceitunas y altramuces', categorias: ['aperitivo'] },
    { id: 'dish_demo_ensaladilla', name: 'Ensaladilla rusa', categorias: ['entrante'] },
    { id: 'dish_demo_paella', name: 'Paella mixta', categorias: ['principal'], esFavorito: true, ingredientes: ['arroz', 'mejillones', 'pollo'] },
    { id: 'dish_demo_pantomate', name: 'Pan con tomate', categorias: ['acompanamiento'] },
    { id: 'dish_demo_sandia', name: 'Sandía', categorias: ['postre'] },
  ].map((d) => ({ esFavorito: false, ingredientes: [], ...d }));

  const instantanea = {
    v: 1,
    tables: {
      events: [{
        id: EV,
        name: 'Ballenita 2026 (prueba)',
        lugar: 'Camping La Ballena Alegre',
        currency: 'EUR',
        startDate: '2026-08-08',
        endDate: '2026-08-15',
        status: 'activo',
        updatedAt: marca,
      }],
      families: familias.map((f) => ({ ...f, eventId: EV, updatedAt: marca })),
      bungas: bungas.map((b) => ({ ...b, eventId: EV, updatedAt: marca })),
      persons: personas.map((p) => ({ ...p, updatedAt: marca })),
      expenses: [
        {
          id: 'exp_demo_compra', eventId: EV, description: 'Compra grande Mercadona',
          amountCents: 14800, currency: 'EUR', amountOriginal: 148, rate: 1,
          category: 'compra_general', dateISO: '2026-08-08T18:00:00.000Z',
          payers: [{ familyId: 'fam_perez', amountCents: 14800 }], participantIds: todos,
          updatedAt: marca,
        },
        {
          id: 'exp_demo_gasolina', eventId: EV, description: 'Gasolina ida',
          amountCents: 6000, currency: 'EUR', amountOriginal: 60, rate: 1,
          category: 'varios', dateISO: '2026-08-08T09:00:00.000Z',
          payers: [{ familyId: 'fam_solteros', amountCents: 6000 }], participantIds: mayores,
          updatedAt: marca,
        },
        {
          id: 'exp_demo_hielo', eventId: EV, description: 'Hielo y birras 🍷',
          amountCents: 2430, currency: 'EUR', amountOriginal: 24.3, rate: 1,
          category: 'bebida', dateISO: '2026-08-09T12:00:00.000Z',
          payers: [{ familyId: 'fam_garcia', amountCents: 2430 }], participantIds: mayores,
          updatedAt: marca,
        },
        // Uno en otra moneda, para que se vea el tipo congelado en la pantalla.
        {
          id: 'exp_demo_souvenirs', eventId: EV, description: 'Souvenirs de la excursión',
          amountCents: 3300, currency: 'GBP', amountOriginal: 28, rate: 1.1786,
          category: 'varios', dateISO: '2026-08-12T17:00:00.000Z',
          payers: [{ familyId: 'fam_garcia', amountCents: 3300 }], participantIds: todos,
          updatedAt: marca,
        },
      ],
      // Una liquidación ya hecha, para que Saldos no salga virgen.
      settlements: [{
        id: 'set_demo_1', eventId: EV, dateISO: '2026-08-13T10:00:00.000Z',
        fromFamilyId: 'fam_solteros', toFamilyId: 'fam_perez', amountCents: 1500,
        updatedAt: marca,
      }],
      dishes: platos.map((d) => ({ ...d, updatedAt: marca })),
      dinners: [{
        id: 'cena_demo_1', eventId: EV, dia: '2026-08-09',
        platoIds: platos.map((d) => d.id),
        bungaMayoresId: 'bunga_2', bungaNinosId: 'bunga_3',
        queSeHace: 'Curro enciende la paellera a las 20:00. Que nadie toque el socarrat.',
        cantidades: '2 kg arroz · 30 mejillones · 1 pollo · 6 barras · 4 botellas tinto',
        updatedAt: marca,
      }],
      plans: [
        {
          id: 'plan_demo_playa', eventId: EV, titulo: 'Playa de la Cala', descripcion: '',
          dia: '2026-08-10', costeEstimado: null, ubicacion: 'Cala del sur', enlace: '',
          estado: 'confirmado',
          votos: { per_curro: '👍', per_ana: '👍', per_pablo: '👍' },
          updatedAt: marca,
        },
        {
          id: 'plan_demo_cuevas', eventId: EV, titulo: 'Excursión a las cuevas', descripcion: 'Hay que reservar con dos días',
          dia: '2026-08-12', costeEstimado: 1200, ubicacion: '', enlace: 'https://example.com/cuevas',
          estado: 'votando',
          votos: { per_curro: '👍', per_ana: '🤷', per_luis: '👎' },
          updatedAt: marca,
        },
        {
          id: 'plan_demo_juegos', eventId: EV, titulo: 'Noche de juegos de mesa', descripcion: '',
          dia: null, costeEstimado: null, ubicacion: '', enlace: '', estado: 'votando',
          votos: { per_pablo: '🤷' },
          updatedAt: marca,
        },
      ],
      shop: [
        { id: 'shop_demo_hielo', eventId: EV, texto: 'Hielos', categoria: 'hielo', comprado: false, compradoPor: null, compradoEn: null, updatedAt: marca },
        { id: 'shop_demo_vino', eventId: EV, texto: 'Vino tinto', categoria: 'bebida', comprado: true, compradoPor: 'per_ana', compradoEn: '2026-08-09T11:00:00.000Z', updatedAt: marca },
        { id: 'shop_demo_fruta', eventId: EV, texto: 'Fruta variada', categoria: 'fruta', comprado: false, compradoPor: null, compradoEn: null, updatedAt: marca },
        { id: 'shop_demo_basura', eventId: EV, texto: 'Bolsas de basura', categoria: 'otros', comprado: false, compradoPor: null, compradoEn: null, updatedAt: marca },
      ],
    },
  };

  return instantanea;
}
