# Compartir ajustes por enlace v3.10

En Mis mezclas, Crear enlace de estos ajustes prepara una URL con el ambiente, evolución, brillo, melodía, volúmenes y duración o plan actuales. No exige guardar una mezcla. Si cambias los ajustes después, creá un enlace nuevo para incluirlos.

El enlace no contiene nombres de mezclas, historial, valoraciones ni progreso. Los ajustes se guardan en el fragmento #mix= de la URL. No hay cuenta ni sincronización automática. Copiar enlace usa el portapapeles cuando el navegador lo permite; si falla, selecciona el campo para copiarlo manualmente.

Al abrir el enlace se muestra una vista previa. No modifica ajustes ni inicia audio hasta pulsar Aplicar ajustes compartidos. Aplicar exige pausa, reemplaza los ajustes actuales y reinicia el reloj; un ciclo comienza en su primera ronda y conserva el temporizador simple anterior del dispositivo receptor. Las mezclas guardadas, historial y valoraciones permanecen. Para conservar la mezcla recibida con un nombre, se usa Guardar mezcla.

Descartar mantiene los ajustes actuales. Aplicar y descartar quitan el fragmento de la barra para evitar presentarlo otra vez al recargar. Los cambios de fragmento en una pestaña ya abierta también muestran la vista previa. La vista de concentración oculta los controles de compartir y recibir.

El formato v1 valida escenas, planes, tiempos, niveles, tipos y longitud del fragmento antes de mostrar la vista previa. Los datos se presentan como texto. Los enlaces inválidos dejan los ajustes actuales intactos. Si no puede persistir todos los ajustes por un error de almacenamiento, la app avisa que solo están aplicados en esa pestaña.

## Pruebas
La suite pura prueba ida y vuelta, exclusión de datos personales, límites, planes fijos y enlaces inválidos. La regresión simulada comprueba generación sin audio ni escrituras y rechazo de entradas inválidas. El navegador recorre copia y alternativa manual (portapapeles simulado), vista previa sin aplicar, bloqueo durante audio, aplicación, recarga, ciclo, descarte y enlace inválido. Incluye capturas en móvil y escritorio. El resultado final queda registrado en el PR.

No se probó el portapapeles real de un teléfono físico en este entorno.
