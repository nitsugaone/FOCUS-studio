# Motor de sonido v3.4

## Cambios
El ruido marrón y la textura blanca se generan continuamente en un AudioWorklet estéreo con dos salidas. No repiten los buffers de 16/19 segundos. Los canales mantienen estados independientes y el filtro se adapta a la frecuencia de muestreo.

Si no hay soporte, el módulo no carga o el procesador falla, FOCUS conserva la reproducción con los buffers anteriores. El módulo se incluye en la caché offline y en public/audio para builds con Vite.

Las notas se mueven uno o dos pasos dentro de la escala, en lugar de saltar a cualquier nota. Con evolución cero siguen un motivo estable. No se alteran los controles ni los datos guardados.

## Comprobaciones
- node tests/studio.test.mjs: interfaz y persistencia en tres rutas (sin soporte, carga fallida y worklet disponible), incluidos recuperación ante error del procesador y ciclo de actualización.
- node tests/noise.test.mjs: más de un millón de muestras, límites de amplitud, sesgo de continua, independencia estéreo, ausencia del bloque repetido a los 16 segundos, continuidad al cambiar tamaño de bloque y otras frecuencias de muestreo.

Estas pruebas usan un entorno simulado. No prueban calidad perceptual, consumo de batería ni continuidad en pantalla bloqueada de un teléfono real.

## Escucha pendiente
Comparar los cuatro ambientes con la versión anterior al mismo volumen de sistema. El nivel percibido del ruido puede variar aunque tenga margen digital.
Escuchar sesiones largas y verificar cambios de ambiente, pausa/reinicio, modo sin conexión y bloqueo de pantalla. El compresor existente sigue al final del grafo; no equivale a una garantía de volumen acústico seguro.
La melodía y los cambios lentos de parámetros siguen dependiendo de temporizadores del navegador; el generador continuo de ruido no los utiliza.

## Actualización
Pausar y usar Actualizar FOCUS en el panel de instalación. Si todavía se está ejecutando una versión sin avisos de actualización, cerrar las pestañas anteriores y volver a abrir.
