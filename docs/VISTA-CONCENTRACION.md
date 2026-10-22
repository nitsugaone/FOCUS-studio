# Vista de concentración v3.8

El botón Vista de concentración muestra una sola tarjeta con reproducción, volumen maestro, tiempo, ambiente actual y estado de los ciclos. Oculta el mezclador, historial, instalación, copias y controles de configuración. No usa pantalla completa del navegador ni solicita permisos nuevos.

Ver todos los controles o Escape vuelve a la vista completa. Escape funciona también desde el control de volumen y devuelve el foco al botón de la vista. Las animaciones del paisaje quedan detenidas en esta vista; el audio sigue igual. Los controles ocultos quedan fuera de la navegación con Tab.

La vista empieza desactivada al recargar; no se guarda en mezclas ni copias. Entrar o salir no inicia ni pausa la reproducción, no cambia volúmenes y no reinicia el reloj. Las sesiones y ciclos conservan su comportamiento. Las valoraciones y los errores aparecen en la tarjeta del reproductor para seguir disponibles durante la vista de concentración.

## Verificación
La suite de navegador cubre entrar mientras suena, conservar el reloj y ajustes, cambiar volumen, salir con Escape desde el deslizador, volver mediante botón, recargar sin autoplay y completar un tramo con la valoración visible en esta vista. Incluye capturas en seis configuraciones de Chromium/WebKit entre 320 y 1440 píxeles. El resultado de GitHub Actions se registra en el PR.

Las pruebas de navegador no sustituyen una comprobación en un teléfono físico.
