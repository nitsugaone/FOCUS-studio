# Duración personalizada v3.9

En Una sesión se puede aplicar una duración entera de 1 a 180 minutos, mediante Aplicar o Enter. Los botones Libre, 25, 45 y 60 minutos siguen disponibles.

Aplicar reinicia el reloj y requiere estar en pausa. El campo y el botón quedan desactivados durante reproducción, transición de audio y ciclos 25/5 o 50/10. Los valores vacíos, decimales o fuera del rango muestran un aviso y no modifican el reloj ni los datos. La vista de concentración oculta esta configuración.

La duración se guarda en la sesión, mezclas y copias de seguridad. Al entrar en un ciclo y volver a Una sesión se conserva la duración anterior. Los ciclos mantienen sus tiempos fijos. La recuperación permanece en pausa y no agrega a la escucha los minutos que la app estuvo cerrada.

Las copias antiguas siguen siendo válidas. Las copias nuevas con tiempos personalizados requieren esta versión o una posterior al importarlas; las versiones antiguas solo reconocen sus duraciones predefinidas. El formato de copia sigue siendo focus-studio-backup versión 1.

Los accesos directos con duration o mode aceptan también valores enteros entre 1 y 180; los inválidos se ignoran.

## Validación
Pruebas de límites, ciclo y copias con duraciones de 1, 17 y 180 minutos; rechazo de valores inválidos; conservación de tiempos fijos en los ciclos. Regresiones de interfaz con tres rutas de audio. Navegadores: aplicación mediante Enter, mezcla, recarga sin autoplay, importación de copia, bloqueo durante reproducción y final de una sesión de un minuto con reloj acelerado. El resultado final se registra en el PR.

El reloj acelerado no equivale a una sesión completa en un teléfono físico.
