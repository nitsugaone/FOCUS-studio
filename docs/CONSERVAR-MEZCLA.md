# Conservar la mezcla al cambiar ambiente v3.14

Personalizar sonido incluye Conservar mis volúmenes y melodía al cambiar de ambiente.

Activada, cambiar Ambiente conserva los cuatro controles de volumen y el estado de Incluir melodía. El paisaje cambia sus filtros, textura, afinación y ritmo propios sin reiniciar la sesión. Evolución, brillo, amplitud estéreo, frecuencia de notas y cierre conservan su comportamiento existente.

Desactivada, el próximo cambio de ambiente aplica sus niveles iniciales y su estado inicial de melodía, como antes. Activar o desactivar la opción no modifica inmediatamente los niveles. El volumen maestro siempre se conserva, incluso con la opción desactivada.

La opción solo afecta el cambio de Ambiente. Elegir un perfil acústico o cargar/aplicar una mezcla sigue usando los ajustes que esa acción indica. Conservar los valores de los controles no significa igualar la sonoridad percibida entre ambientes: cada textura y filtro sigue siendo diferente.

Se guarda en ajustes, mezclas, enlaces y copias con preserveMix. Los datos anteriores usan false y mantienen el comportamiento anterior. Los valores que no sean booleanos se rechazan al importar o recibir un enlace. Las mezclas de distinta preferencia se distinguen al fusionar copias. Los clientes anteriores ignoran el campo nuevo.

## Verificación
Las regresiones de interfaz prueban los cuatro ambientes, conservación de volúmenes y melodía apagada, reloj y fuentes, el cambio de preferencia sin modificar niveles y la recuperación del comportamiento anterior. Se ejecutan en las tres rutas de audio.

El navegador prueba además conservar melodía encendida al pasar a Cubrir conversaciones, niveles predeterminados al desactivar la opción, volumen maestro, reproducción y reloj, mezclas, recarga en pausa, copia antigua y enlace. Incluye captura en cada configuración móvil/escritorio. La comprobación no es una medición de sonoridad en un dispositivo físico. El resultado final queda en el PR.
