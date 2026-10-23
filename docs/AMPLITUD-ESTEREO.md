# Amplitud estéreo v3.11

Personalizar sonido incluye Amplitud estéreo de 0 a 100%. El valor inicial 100% conserva los canales originales. A 0%, ambos canales reproducen el promedio de izquierda y derecha; los valores intermedios reducen gradualmente su separación. Puede ajustarse mientras se escucha, sin reiniciar el reloj ni recrear los generadores.

El control actúa sobre la mezcla completa, antes del compresor y antes de separar la salida del navegador y el flujo para reproducción en segundo plano. Los cambios usan una transición de 0,08 segundos como constante de tiempo. No cambia el valor del volumen maestro. Promediar los canales puede cambiar el nivel percibido y cancelar componentes de fase opuesta; no es una normalización de sonoridad.

El ajuste se conserva en este navegador, mezclas, enlaces y copias de seguridad. Los datos anteriores que no incluyen stereoWidth se interpretan como 100%. Los valores fuera de 0–100 o con tipos incorrectos son rechazados al importar o recibir un enlace. Dos mezclas con igual nombre y distinto ancho se consideran diferentes al fusionar copias. El formato de enlace y copia mantiene su versión anterior; los clientes antiguos ignoran el campo nuevo.

## Implementación y pruebas
La salida utiliza L' = direct·L + cross·R y R' = direct·R + cross·L, con direct=(1+w)/2, cross=(1-w)/2 y w=porcentaje/100. Las ponderaciones suman 1. El nodo de entrada convierte las fuentes mono a dos canales mediante la interpretación speakers.

Se usan GainNode, ChannelSplitterNode y ChannelMergerNode de [Web Audio](https://www.w3.org/TR/webaudio/). No cambia el generador de ruido ni el código de las notas.

Las pruebas de lógica verifican extremos, rango, límite de amplitud de la matriz, transiciones sin recrear nodos, persistencia y compatibilidad de datos antiguos. La suite de navegador usa OfflineAudioContext para comparar cada muestra con la matriz esperada, con entradas estéreo y mono. También prueba el control durante reproducción, mezclas, recarga, copia e importación, enlaces y diseño sin desbordamiento. El resultado final se registra en el PR.

La verificación matemática y en navegador no sustituye una escucha en auriculares o altavoces físicos.
