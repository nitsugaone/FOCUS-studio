# Descansos en silencio v3.15

Los ciclos 25/5 y 50/10 incluyen Durante el descanso: Con el sonido de mi mezcla o En silencio. El valor inicial conserva el sonido actual. La preferencia se cambia en pausa y se guarda en ajustes, mezclas, enlaces y copias. Los datos anteriores usan sound.

En silencio, el descanso mantiene el reloj, muestra Descanso en silencio y conserva los controles de volumen y melodía para la siguiente ronda. No genera notas nuevas y su salida de audio se fija en cero después de las capas y antes de las salidas. El grafo se conserva. Al finalizar espera Siguiente; la siguiente ronda recupera el sonido solo cuando el usuario la inicia. Al recargar, el descanso se recupera en pausa.

Los descansos silenciosos no suman tiempo de escucha ni piden valoración. El marcador de tiempo registrado avanza durante ellos para que no se agreguen retroactivamente al historial al volver al foco. Los descansos con sonido mantienen la contabilización anterior.

El selector se oculta en Una sesión y en la vista de concentración; la elección permanece guardada para el próximo ciclo. Los estados del reproductor, reloj, botón y control móvil identifican el descanso. Cambiar el ambiente o el volumen durante un descanso silencioso prepara la mezcla siguiente sin anular el silencio.

Los clientes antiguos ignoran restSound y usan descansos con sonido. Los valores desconocidos se rechazan en enlaces/copias. La fusión de copias distingue mezclas con distinta preferencia.

## Verificación
Las pruebas puras clasifican tramos silenciosos y verifican que el historial no agregue descanso ni lo recupere como escucha posterior. Pruebas de copia y enlace verifican persistencia, tipos y datos anteriores. Las regresiones existentes mantienen el modo de descanso con sonido.

El navegador mide la señal del flujo de audio con un analizador y una conexión de monitor silenciada: comprueba señal en foco, cero en descanso y señal al iniciar la siguiente ronda. También controla que no se creen notas ni se cambien volúmenes, que el historial no aumente en silencio, recuperación e importación en pausa, mezcla, copia antigua y enlace. El resultado final queda en el PR.

La ejecución usa reloj acelerado y no sustituye una prueba física de un descanso completo. La actualización del reloj en segundo plano depende del navegador; al reanudarse los callbacks se calcula el tiempo por timestamps, sin iniciar otra ronda automáticamente.
