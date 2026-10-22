# Sesiones con descansos v3.7

## Planes
- Una sesión: conserva modo libre y temporizadores de 25, 45 y 60 minutos.
- 25/5: cuatro rondas de concentración de 25 minutos, con descansos de cinco minutos entre rondas.
- 50/10: dos rondas de concentración de 50 minutos, con un descanso de diez minutos entre ambas.

Cada tramo se detiene al terminar. El usuario inicia el siguiente mediante el botón principal, la barra inferior o el control multimedia. No se inicia un descanso ni otra ronda automáticamente.
Después de la última ronda, Repetir vuelve a la primera ronda del mismo plan.
El selector de plan se bloquea durante reproducción. Reiniciar tramo vuelve a cero el tramo actual.
El ambiente y los volúmenes se mantienen. El tiempo de escucha incluye descansos; solo los tramos de concentración ofrecen valoración al terminar.

## Persistencia
Se conserva plan, ronda, tramo, estado completado y duración previa de la sesión sencilla en focus-session-v1.cycle.
La recuperación siempre queda pausada. Si el tramo guardado llegó al final, se ofrece el siguiente sin reproducirlo.
Las mezclas pueden guardar el plan; cargarlas comienza ese plan desde la primera ronda y conserva los ajustes de sonido.
Las copias JSON anteriores siguen siendo válidas. Las nuevas conservan ciclo y mezcla con plan; para trasladarlas, usar una versión actualizada en ambos dispositivos.

## Pruebas
node --test tests/*.test.mjs
La suite específica comprueba avance manual, límites de ronda, repetición y estados inválidos. Los tests de copia verifican planes, fase y duración consistente.
Playwright comprueba en seis combinaciones de motor/tamaño la finalización de foco, espera sin inicio automático, descanso, siguiente ronda, recuperación de un descanso y exportación del plan. Se adelanta el reloj de la página para probar la secuencia sin esperar el tiempo real.
Las pruebas no sustituyen sesiones de duración real ni pantalla bloqueada de un teléfono físico.

Se impide que pagehide sobrescriba el progreso importado o deshecho al recargar después de una restauración. La prueba de navegador recupera el descanso mediante el selector de copia de seguridad y la confirmación de importación.
