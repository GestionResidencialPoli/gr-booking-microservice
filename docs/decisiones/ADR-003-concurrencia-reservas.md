# ADR-003: Control de concurrencia de las reservas

- **Estado:** aceptada
- **Fecha:** 2026-09-27
- **Work items:** SPIKE-3.1 (GR-74), TEC-3.1 (GR-70), TEC-3.2 (GR-71), HU-3.8 (GR-69), QA-3.1 (GR-121)

## Contexto

Una reserva debe comprobar que la franja tiene cupo y luego guardarse. Hecho de forma ingenua:

```
 hilo A                          hilo B
 ──────                          ──────
 SELECT count(*) → 0 (libre)
                                 SELECT count(*) → 0 (libre)
 INSERT reserva      ✔
                                 INSERT reserva      ✔   ← doble reserva confirmada
 ◄──────── ventana de la condicion de carrera ────────►
```

Entre la lectura y la escritura hay una ventana de milisegundos. No aparece en pruebas manuales y si aparece
un sabado por la manana, cuando varias familias abren la aplicacion a la vez. El servicio corre con varias
replicas en Kubernetes, asi que la solucion tiene que ser correcta **entre procesos**, no solo dentro de uno.

## Alternativas evaluadas

Cada alternativa se implemento como prototipo en `test/integration/support/estrategias-reserva.ts` y se midio
con la suite `test/integration/concurrencia-reservas.it.test.ts`. Hay **50 solicitudes simultaneas** sobre la
misma franja, liberadas en el mismo instante con una barrera (el equivalente a un `CountDownLatch` en JavaScript),
contra PostgreSQL 16 real.

| Alternativa | Aforo | Reservas confirmadas | Correcta con 1 replica | Correcta con 2 replicas | Latencia media / p95 | Solicitudes/s |
|---|---|---|---|---|---|---|
| Consultar y luego insertar (sin mecanismo) | 1 | **50** (46-47 sin ventana artificial) | No | No | 20.1 / 21.0 ms | 2366 |
| Consultar y luego insertar (sin mecanismo) | 5 | **50** | No | No | 20.3 / 21.2 ms | 2350 |
| Mutex en memoria del proceso (equivalente a `synchronized`) | 1 | 1 | Si | **No: 2 confirmadas** | 44.1 / 54.5 ms (1 replica) | 906 |
| Bloqueo pesimista `SELECT ... FOR UPDATE` sobre la zona | 1 | 1 | Si | Si | 32.4 / 45.2 ms | 1082 |
| Bloqueo pesimista `SELECT ... FOR UPDATE` sobre la zona | 5 | 5 | Si | Si | 96.5 / 113.6 ms | 436 |
| Restriccion de exclusion GiST (solo aforo 1) | 1 | 1 | Si | Si | 18.8 - 20.5 / 19.8 - 21.8 ms; **una de cuatro corridas: 25 532 / 48 081 ms (49 s en total)** | 2272 (1 en la corrida degradada) |
| **Contador atomico por franja (elegida)** | 5 | 5 | Si | Si | 14.1 / 18.5 ms | 2648 |
| **Contador atomico por franja (elegida)** | 1 | 1 (20 de 20 ejecuciones) | Si | Si | 11.4 - 13.5 / 16.6 - 19.6 ms | 2488 - 2972 |

Las filas ingenuas, la del mutex y la del bloqueo pesimista incluyen una espera de 15 ms entre la consulta y la
insercion. Esa espera representa cualquier trabajo intermedio (validaciones, una llamada de red) y vuelve
reproducible la carrera. **Sin esa espera la doble reserva igual ocurre**: en tres corridas se confirmaron 46,
47 y 47 reservas sobre una franja de aforo 1, y 50 sobre una de aforo 5. Por esa espera, la latencia de esas
filas no es comparable uno a uno con la de la alternativa elegida. Lo que se compara es la correctitud, y el
costo relativo de serializar la zona entera frente a solo la franja.

Medicion de extremo a extremo por HTTP, con el servicio completo y la solucion elegida:

| Escenario | Resultado | Latencia media / p95 | Duracion total |
|---|---|---|---|
| 50 solicitudes, aforo 1, 1 replica | 1 × 201, 49 × 409, 0 × 500 | 87.1 / 97.8 ms | 100.7 ms |
| 50 solicitudes, aforo 5, 1 replica | 5 × 201 | 36.3 / 42.2 ms | 44.3 ms |
| 50 solicitudes, aforo 1, **2 replicas reales** (dos procesos) | 1 × 201, 49 × 409 | 103.5 / 112.5 ms | 117.9 ms |
| 100 solicitudes sobre **franjas distintas** | 100 × 201 | 73.6 / 75.8 ms | 80.1 ms (secuencial: 4.3 ms × 100 = 429 ms) |

Entorno: Apple M5 (10 nucleos), Docker 29.8, PostgreSQL 16 (Testcontainers), Node 24, pool de 20 conexiones por
proceso. Las cifras absolutas varian por maquina; las conclusiones de correctitud no.

### Por que no las demas

- **Mutex en memoria (`synchronized` / `ReentrantLock` en Java, una cola de promesas en Node):** protege dentro
  de un proceso y falla en cuanto hay dos. Cada replica tiene su propio candado, asi que dos solicitudes que
  llegan a replicas distintas no se excluyen: con dos replicas se confirmaron **2 reservas en una franja de
  aforo 1**. Es el contraejemplo central: el estado en memoria no sobrevive al escalado horizontal.
- **Bloqueo optimista con version:** protege la actualizacion de una fila existente, pero una reserva es una
  **fila nueva**. No hay version que comparar entre dos `INSERT` concurrentes, asi que no se prototipo como
  mecanismo principal. El contador por franja resuelve lo mismo sobre una fila que si existe.
- **Bloqueo pesimista sobre la zona:** correcto entre replicas, pero serializa **todas** las reservas de la
  zona, aunque sean de franjas distintas. Con aforo 5 fue la alternativa mas lenta (96.5 ms de media).
- **Restriccion de exclusion sola:** perfecta para aforo 1 y la mas rapida en ese caso, pero una restriccion de
  exclusion solo expresa "no se solapan"; no sabe contar hasta N. No sirve para la piscina ni para la zona BBQ.
- **Hallazgo de la restriccion de exclusion bajo carga:** con 50 `INSERT` simultaneos que chocan en la misma
  restriccion GiST, PostgreSQL detecta deadlocks (`40P01`) de forma intermitente: cada insercion espera a que
  otra transaccion confirme para decidir si hay conflicto. Sigue siendo correcta (1 confirmada), pero en una de
  cuatro corridas medidas la carga completa tardo **49 s**: los deadlocks se encadenan y cada uno se resuelve tras
  `deadlock_timeout` (1 s por defecto). Por eso, aunque siga como ultima linea de defensa, no
  debe recibir la contencion directamente. En la solucion elegida no la recibe, porque el bloqueo de la fila del
  contador serializa las inserciones de la misma franja antes de llegar a ella. Aun asi, un `40P01` se traduce a
  `409` igual que una violacion de restriccion, para que nunca se propague como `500`.
- **Bloqueo distribuido con Redis (Redlock):** agrega una dependencia de infraestructura en el camino critico y
  tiene casos limite de correccion conocidos (pausas del proceso, relojes). PostgreSQL ya es el unico componente
  compartido por todas las replicas.

## Decision

**Contador atomico por franja en PostgreSQL**, con la restriccion de exclusion como ultima linea de defensa:

1. La tabla `franjas_ocupacion` tiene una fila por franja reservada con su `aforo` y sus `ocupados`, y
   `CHECK (ocupados >= 0 AND ocupados <= aforo)`.
2. La seccion critica (`RegistroReservas`) es una sola transaccion:
   `INSERT ... ON CONFLICT DO NOTHING` de la franja, luego
   `UPDATE franjas_ocupacion SET ocupados = ocupados + 1 WHERE zona_id = ? AND inicio = ? AND ocupados < aforo`,
   luego el `INSERT` de la reserva. Si el `UPDATE` no afecta ninguna fila, la franja no tiene cupo: `409`.
3. La condicion y la escritura son **una sola operacion del motor**. En `READ COMMITTED`, un segundo `UPDATE`
   sobre la misma fila espera al primero y reevalua `ocupados < aforo` con el valor ya confirmado.
4. El bloqueo de fila es **por franja**: franjas distintas no se esperan entre si. Una prueba determinista lo
   demuestra: con una transaccion abierta que retiene el cupo de una franja, la reserva de otra franja termina de
   inmediato y la de la misma franja queda esperando hasta que la primera termina. En la medicion, 100 solicitudes
   sobre franjas distintas tardaron 80 ms, frente a 429 ms si fueran secuenciales, en la maquina descrita. En el
   runner de CI de 2 vCPU la ganancia es menor, pero el tiempo sigue siendo sublineal.
5. Ultima linea de defensa: `ex_reservas_exclusivas_sin_solapamiento` (exclusion GiST para aforo 1) y el `CHECK`
   del contador rechazan cualquier escritura invalida, incluso por SQL directo o desde una carga masiva. Una
   violacion de cualquiera de las dos, o un deadlock detectado por el motor (`40P01`), se traduce a `409`, nunca a
   `500`.
6. Reglas que no dependen de la franja, pero si de la concurrencia:
   - `pg_advisory_xact_lock(1, apartamento_id)` serializa solo las reservas del **mismo apartamento**, para el
     maximo de 2 reservas activas.
   - `SELECT ... FOR SHARE` sobre la zona coordina con la desactivacion y con los bloqueos por mantenimiento,
     que la toman `FOR UPDATE`.
7. Cada conflicto queda en el log con nivel `WARN`, el identificador de correlacion y la franja implicada.

## Evidencia de que el mecanismo es lo que resuelve el problema

La suite incluye la contraprueba que pide HU-3.8 CA-4: la estrategia "consultar y luego insertar" usa exactamente
el mismo esquema y la misma carga, pero sin el contador. La prueba **exige** que esa estrategia sobre-reserve
(50 de 50 confirmadas con aforo 1). Si la carga dejara de generar contencion, esa asercion fallaria y la suite lo
delataria, asi que una prueba que pasa "tambien sin el mecanismo" no puede quedar en verde.

HU-3.8 CA-7 se verifica con dos procesos reales del servicio (`test/integration/support/replicas.ts`), cada uno
con su propio pool, apuntando a la misma base. Las 50 solicitudes se reparten entre ambos y el resultado es
exactamente una reserva.

## Consecuencias

- La correctitud no depende del numero de replicas ni de que todas las escrituras pasen por la aplicacion.
- Un `409` es un resultado **esperado** que el cliente debe manejar: explicar que la franja acaba de ser tomada
  y refrescar la disponibilidad. Las reglas de negocio responden `422`, porque no tiene sentido reintentarlas.
- La consulta de disponibilidad es informativa (ver `docs/arquitectura/reservas.md`); la garantia la da esta
  seccion critica.
- Etapa 2: el servicio ya es independiente, con su propia base. La dependencia con el modulo financiero (paz y
  salvo) no entra a la seccion critica como llamada de red: se replica por eventos de RabbitMQ en la tabla
  `estado_cartera` y se consulta localmente dentro de la misma transaccion.

## Como reproducir

```bash
pnpm test:integration -- test/integration/concurrencia-reservas.it.test.ts --silent=false
```

Cada escenario imprime una linea JSON con `medicion`, `latenciaMediaMs`, `latenciaP95Ms`,
`solicitudesPorSegundo` y `confirmadasEnBase`.
