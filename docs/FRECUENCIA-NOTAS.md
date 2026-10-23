# Frecuencia de notas v3.12

Personalizar sonido incluye Frecuencia de notas, independiente del volumen:
- Más espaciadas: duplica el intervalo del ambiente.
- Ritmo actual: mantiene el intervalo anterior.
- Más frecuentes: usa el 75% del intervalo del ambiente.

Evolución conserva su variación temporal. En Espacio, el intervalo mínimo es 6 segundos y la envolvente directa de cada nota dura 5,05 segundos. No se alteran frecuencias, timbre, volumen ni amplitud estéreo de las notas.

Cambiar el ritmo mientras se escucha cancela la espera anterior y programa una nueva. No produce una nota inmediata ni reinicia el reloj. El cambio de ambiente también actualiza la espera. Desactivar Incluir melodía cancela las notas futuras y deshabilita el selector; las notas que ya sonaban terminan naturalmente. Al reactivar melodía se espera un intervalo completo. Al iniciar una sesión se conserva la primera nota inmediata que ya tenía FOCUS.

El ritmo se guarda en ajustes, mezclas, enlaces y copias. Los datos anteriores sin notePace se interpretan como normal. Los valores desconocidos se rechazan en enlaces y copias. La fusión de copias distingue mezclas con igual nombre pero distinto ritmo. Los clientes antiguos ignoran el campo nuevo y usan su ritmo original.

## Verificación
La suite pura comprueba intervalos de los cuatro ambientes, variación por evolución, compatibilidad del ritmo por defecto y rechazo de valores inválidos. La simulación de interfaz comprueba sustitución de un único temporizador, ausencia de notas inmediatas y cancelación al apagar la melodía, en las tres rutas de audio.

El navegador instrumenta la creación de osciladores y adelanta el reloj para comprobar los límites de 6, 16 y 8 segundos con Evolución en cero en Espacio. También comprueba reloj y volumen, guardado/carga, recarga en pausa, copia antigua y enlace. Se usa [el reloj controlado de Playwright](https://playwright.dev/docs/api/class-clock); no equivale a una escucha durante una sesión física completa. El resultado final queda en el PR.
