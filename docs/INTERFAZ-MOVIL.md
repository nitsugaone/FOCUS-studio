# Interfaz móvil v3.1

## Cambios
- Ambiente, reproducción, volumen maestro y duración reunidos en el reproductor.
- Personalizar sonido, Mis mezclas e Historial usan paneles desplegables nativos, cerrados inicialmente.
- Controles táctiles de al menos 48 px, texto de campos de 16 px y controles de volumen con pista fina y área táctil amplia.
- En pantallas de hasta 760 px, una barra inferior ofrece ambiente, tiempo e iniciar/pausar cuando el botón principal sale de vista.
- La barra respeta las áreas seguras del teléfono y comparte estado con el reproductor principal.
- La valoración de sesión permanece oculta hasta completar una sesión con duración.
- El motor de audio mantiene su comportamiento anterior.

## Validación ejecutada
Se ejecutaron 20 verificaciones de la suite con DOM y Web Audio simulados, incluyendo el inicio/pausa desde ambos controles, sincronización del tiempo y estado accesible, aparición de la barra según visibilidad y regresión de la valoración oculta. Sintaxis del script comprobada.

## Verificación visual pendiente
El navegador de comprobación no respondió en este entorno. No se afirma validación visual ni pruebas nuevas en dispositivos reales.
Comprobar:
1. 320, 360, 390 y 430 px de ancho, también en horizontal: sin desplazamiento horizontal; ambiente e iniciar visibles al entrar.
2. Desplazarse hacia ajustes: la barra aparece al salir de vista el botón principal y desaparece al regresar. Verificar que no cubra el contenido final ni controles enfocados.
3. Iniciar desde la barra, pausar desde el botón principal y repetir a la inversa. Confirmar que ambos muestran el mismo estado y tiempo.
4. Expandir cada panel mediante toque y teclado. Seleccionar ambientes, modificar brillo y evolución, guardar y recuperar mezclas.
5. Completar una sesión: la valoración aparece únicamente entonces; guardar la valoración vuelve a ocultarla.
6. Escritorio: paneles compactos, reproductor sin el espacio vertical excesivo de la versión anterior.
7. Tras instalar la nueva caché, comprobar apertura offline y reproducción con pantalla bloqueada en los mismos dispositivos ya probados por el propietario.
