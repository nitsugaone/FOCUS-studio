# Copias de seguridad v3.6

## Uso
Abrir Tus datos y copias de seguridad y descargar un archivo JSON.
En otro dispositivo, abrir el archivo para ver el contenido y el resultado previsto antes de confirmar.
La importación y Deshacer solo se permiten con audio en pausa. Al confirmar se recarga FOCUS para cargar los datos.

Se incluyen mezclas, historial diario, valoraciones, volúmenes, ambiente y sesión guardada.
Los ajustes y la sesión actuales se conservan salvo que se marque Incluir también volúmenes, ambiente y sesión.

## Combinación
- Mezclas idénticas: no se duplican; se conserva la condición de favorita de cualquiera de las copias.
- Mezclas diferentes, aunque tengan el mismo nombre: se conservan ambas.
- Historial: se conserva el mayor número de minutos por día, sin sumarlos.
- Valoraciones: se deduplican por fecha/ambiente/puntuación/duración/distracciones y se conservan las 200 más recientes.
- Se rechaza una combinación que supere 50 mezclas o 3660 días. No se eliminan mezclas para hacer espacio.

## Formato y validación
Formato focus-studio-backup, versión 1, hasta 1 MB en la selección del archivo.
Se admiten únicamente campos conocidos, escenas válidas, fechas de calendario válidas y valores dentro de rango.
El archivo no ejecuta código. Se procesa localmente, sin subirlo a un servidor.

## Recuperación
Antes de aplicar, se guarda una instantánea local de los valores originales.
Ante un error de escritura se intenta revertir todas las claves y mantener el respaldo anterior.
Si el navegador también bloquea esa reversión, la interfaz informa que la operación no pudo revertirse por completo. No se garantiza recuperación ante fallas permanentes del almacenamiento.
Deshacer restaura el estado completo anterior a la última importación; revierte también cambios hechos después. La instantánea se elimina tras deshacer correctamente.

## Validación
node tests/backup.test.mjs
node tests/studio.test.mjs

Pruebas específicas de formato, vista previa sin escritura, combinación idempotente, límites, ajustes opcionales, deshacer y reversión ante fallo de escritura.
La suite de interfaz verifica selección de archivo inválido/válido, cancelación, bloqueo durante reproducción, importación y recarga, deshacer y construcción de descarga JSON en las tres rutas de audio.
No se ha probado el selector de archivos ni la descarga en teléfonos físicos desde este entorno. Verificar exportar en PC e importar en celular, y a la inversa.
