export interface Medicion<T> {
  resultados: T[];
  latenciaMediaMs: number;
  latenciaP95Ms: number;
  duracionTotalMs: number;
  solicitudesPorSegundo: number;
}

export interface Barrera {
  esperar: () => Promise<void>;
  liberar: () => void;
}

export function barrera(): Barrera {
  let liberar: () => void = () => undefined;
  const abierta = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  return { esperar: () => abierta, liberar };
}

function percentil(valores: number[], p: number): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(indice, 0)] ?? 0;
}

export async function lanzarALaVez<T>(cantidad: number, tarea: (indice: number) => Promise<T>): Promise<Medicion<T>> {
  const salida = barrera();
  const latencias: number[] = [];

  const pendientes = Array.from({ length: cantidad }, async (_, indice) => {
    await salida.esperar();
    const inicio = performance.now();
    const resultado = await tarea(indice);
    latencias.push(performance.now() - inicio);
    return resultado;
  });

  const inicio = performance.now();
  salida.liberar();
  const resultados = await Promise.all(pendientes);
  const duracionTotalMs = performance.now() - inicio;

  return {
    resultados,
    latenciaMediaMs: latencias.reduce((suma, valor) => suma + valor, 0) / latencias.length,
    latenciaP95Ms: percentil(latencias, 95),
    duracionTotalMs,
    solicitudesPorSegundo: (cantidad / duracionTotalMs) * 1000,
  };
}

export function contar<T>(valores: T[], valor: T): number {
  return valores.filter((item) => item === valor).length;
}

export function registrarMedicion(escenario: string, medicion: Medicion<unknown>, extra: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      medicion: escenario,
      latenciaMediaMs: Number(medicion.latenciaMediaMs.toFixed(1)),
      latenciaP95Ms: Number(medicion.latenciaP95Ms.toFixed(1)),
      duracionTotalMs: Number(medicion.duracionTotalMs.toFixed(1)),
      solicitudesPorSegundo: Number(medicion.solicitudesPorSegundo.toFixed(1)),
      ...extra,
    }),
  );
}
