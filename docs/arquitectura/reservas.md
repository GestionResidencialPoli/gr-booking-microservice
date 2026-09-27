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
