# Arquitectura del modulo de reservas

## La disponibilidad es informativa, nunca una garantia

`GET /api/v1/zonas-comunes/{id}/disponibilidad` calcula en el backend el estado de cada franja (disponible,
parcial, completa, bloqueada o fuera de anticipacion) a partir de los parametros de la zona, del contador
`franjas_ocupacion` y de los bloqueos vigentes. El calculo vive en el servidor para que el frontend no derive
por su cuenta una disponibilidad que luego el servidor rechace.

Esa consulta **no reserva nada**. Entre el momento en que un residente ve una franja libre y el momento en que
confirma, otro residente puede tomarla. Tratar la respuesta como garantia y reservar con el patron "consultar si
esta libre y luego insertar" es exactamente la condicion de carrera que el proyecto debe eliminar.

La validacion definitiva ocurre en `POST /api/v1/reservas`, dentro de una unica seccion critica que resuelve
PostgreSQL:

1. El cupo de la franja se toma con una sentencia condicional atomica sobre `franjas_ocupacion`
   (`UPDATE ... SET ocupados = ocupados + 1 WHERE ... AND ocupados < aforo`). Si no afecta ninguna fila, la franja
   ya no tiene cupo y la respuesta es `409`.
2. El `CHECK (ocupados <= aforo)` y la restriccion de exclusion sobre `reservas` son la ultima linea de defensa,
   incluso frente a escrituras por fuera de la aplicacion.

Por eso el cliente debe tratar un `409` al reservar como un resultado esperado: explicar que la franja acaba de
ser tomada y volver a pedir la disponibilidad.

## Seccion critica de la reserva

`RegistroReservas` ejecuta todo en **una sola transaccion** de PostgreSQL, que es el unico componente compartido
por todas las replicas:

1. `pg_advisory_xact_lock(1, apartamento_id)`: serializa solo las reservas del **mismo apartamento**, para que dos
   solicitudes simultaneas no pasen a la vez la regla de maximo 2 reservas activas. Otros apartamentos no esperan.
2. `SELECT ... FROM zonas_comunes ... FOR SHARE`: las reservas de la zona no se bloquean entre si (el bloqueo es
   compartido), pero si esperan a una desactivacion o a un bloqueo por mantenimiento que tome la zona `FOR UPDATE`.
3. `ReglasReserva.validar(...)`: las cinco reglas de negocio, puras y sin escrituras, con un codigo por regla.
4. `INSERT ... ON CONFLICT DO NOTHING` de la fila de la franja y luego
   `UPDATE franjas_ocupacion SET ocupados = ocupados + 1 WHERE zona_id = ? AND inicio = ? AND ocupados < aforo`.
   La condicion y la escritura son una sola operacion del motor: si no afecta ninguna fila, la franja no tiene
   cupo y se responde `409`. El bloqueo de fila afecta solo a esa franja, asi que franjas distintas no se
   serializan.
5. `INSERT` de la reserva. Una violacion del `CHECK` del contador o de la restriccion de exclusion (aforo 1) se
   traduce a `409`, nunca a `500`.

Cualquier fallo revierte la transaccion completa: no quedan filas parciales.

## Paz y salvo replicado por eventos

La regla de paz y salvo se evalua **dentro** de la seccion critica, pero sin llamada de red: consulta la tabla
local `estado_cartera`, que se alimenta de los eventos `cartera.estado-actualizado` del modulo financiero por
RabbitMQ. Es la tercera opcion que plantea SPIKE-6.1 (replicar el estado por eventos) y evita alargar la seccion
critica con latencia y fallos de red. El costo es consistencia eventual: un pago recien registrado tarda lo que
tarde el evento en llegar. La interfaz `ConsultaPazYSalvo` desacopla la regla de su implementacion; cambiarla por
un cliente HTTP no toca la logica de reservas.
