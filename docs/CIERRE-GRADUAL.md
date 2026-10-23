# Cierre gradual configurable v3.13

Personalizar sonido permite elegir un cierre de 5, 20 o 60 segundos. El valor inicial 20 conserva el cierre anterior. El control exige una sesión con duración o un ciclo, y queda bloqueado mientras se reproduce o se inicia el audio. Cambiarlo en pausa no reinicia el reloj ni cambia el volumen maestro.

Cada tramo limita el cierre a la mitad de su duración. Por ejemplo, una sesión de un minuto con 60 segundos elegidos utiliza 30 segundos; el texto junto al selector muestra el tiempo efectivo. Los ciclos aplican la elección tanto al foco como al descanso. La sesión libre conserva la elección para usarla más adelante, sin apagado automático.

Se mantiene la entrada suave existente y la pausa con fundido al finalizar. El ajuste modifica la envolvente de sesión, separada del volumen maestro. Cambiarlo durante una pausa avanzada puede situar la reanudación dentro del cierre correspondiente al tiempo que queda.

La preferencia se conserva en ajustes, mezclas, enlaces y copias de seguridad. Los datos anteriores sin fadeOutSeconds usan 20. Se rechazan valores desconocidos al importar o recibir un enlace. La fusión de copias distingue mezclas con distinto cierre. Los clientes antiguos ignoran el campo nuevo y conservan su cierre anterior.

## Pruebas
Las pruebas puras verifican la equivalencia del valor 20 con la fórmula anterior, los límites de ganancia, la reducción monotónica, el límite en tramos cortos y la ausencia de cierre en sesión libre. Las regresiones de interfaz incluyen bloqueo durante audio, guardado sin reinicio del reloj y validación.

La suite de navegador comprueba un cierre de 60 segundos en una sesión de tres minutos, el límite a 30 segundos en una sesión de un minuto, fin automático, reloj/volumen, mezclas, recarga en pausa, copia antigua, enlace y ciclos. El resultado final queda en el PR.

El reloj acelerado no equivale a una escucha de duración real en un teléfono físico.
