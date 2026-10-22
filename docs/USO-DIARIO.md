# Uso diario v3.3

## Funciones
- Recupera duración y tiempo transcurrido localmente, sin iniciar audio automáticamente. Guarda cada cinco segundos mientras se reproduce, y al pausar o salir.
- No vuelve a sumar al historial el tiempo recuperado ni acumula tiempo mientras la app estuvo cerrada.
- Conserva las mezclas v3 existentes. Agrega actualizar ajustes, renombrar y favoritas con acceso desde el reproductor.
- Ante errores de almacenamiento, no reemplaza la lista de mezclas en memoria por un cambio no guardado.
- Ofrece instalación cuando el navegador presenta un aviso compatible e instrucciones manuales para Android e iOS.
- Muestra disponibilidad offline después de preparar el service worker.
- Las futuras actualizaciones quedan en espera: se aplican por una acción explícita y solo en pausa.

## Validación
36 verificaciones con DOM, Web Audio y service worker simulados. Incluye recuperación sin autoplay, controles de reproducción, persistencia y favoritas, cambio de diseño por ancho, actualización bloqueada durante audio y activación del worker solo por petición.
Ejecutar: node tests/studio.test.mjs

No se realizaron pruebas visuales nuevas ni de instalación en dispositivos reales en este entorno.
Comprobar en Android e iOS: recuperar una sesión tras cerrar, guardar y abrir favoritas, instalar desde navegador, desconectar internet y actualizar tras pausar.

## Primera actualización desde v3.2
Las pestañas anteriores aún no incluyen el botón de actualización. El nuevo worker espera a que esas pestañas se cierren. Cerrar todas las pestañas/ventanas instaladas de FOCUS y volver a abrir con internet permite activar v3.3. Después se usa el aviso integrado.

## Límites
El navegador puede suspender procesos sin ejecutar el evento de salida; en ese caso puede perderse el progreso desde el último guardado (normalmente hasta cinco segundos).
Los datos permanecen en el mismo navegador y dispositivo. Borrar datos del sitio elimina mezclas, historial y sesión.
