import type { Knex } from "knex";

const ZONAS = [
  {
    nombre: "Salon Social",
    descripcion: "Espacio cerrado para celebraciones y reuniones de un solo grupo.",
    hora_apertura: "08:00",
    hora_cierre: "22:00",
    duracion_franja_minutos: 240,
    aforo: 1,
    anticipacion_minima_horas: 24,
    anticipacion_maxima_dias: 60,
    anticipacion_cancelacion_horas: 48,
  },
  {
    nombre: "Piscina",
    descripcion: "Admite varias familias a la vez por turnos de dos horas.",
    hora_apertura: "07:00",
    hora_cierre: "19:00",
    duracion_franja_minutos: 120,
    aforo: 5,
    anticipacion_minima_horas: 2,
    anticipacion_maxima_dias: 15,
    anticipacion_cancelacion_horas: 4,
  },
  {
    nombre: "Cancha Multiple",
    descripcion: "Cancha de microfutbol y baloncesto que se presta por hora.",
    hora_apertura: "06:00",
    hora_cierre: "22:00",
    duracion_franja_minutos: 60,
    aforo: 1,
    anticipacion_minima_horas: 1,
    anticipacion_maxima_dias: 7,
    anticipacion_cancelacion_horas: 2,
  },
  {
    nombre: "Zona BBQ",
    descripcion: "Dos asadores independientes por bloques de tres horas.",
    hora_apertura: "10:00",
    hora_cierre: "22:00",
    duracion_franja_minutos: 180,
    aforo: 2,
    anticipacion_minima_horas: 24,
    anticipacion_maxima_dias: 30,
    anticipacion_cancelacion_horas: 24,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const existentes = await knex("zonas_comunes").pluck("nombre");
  const nuevas = ZONAS.filter((zona) => !existentes.includes(zona.nombre));
  if (nuevas.length > 0) {
    await knex("zonas_comunes").insert(nuevas);
  }
}
