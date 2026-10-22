# Validación FOCUS Studio v3

## Comprobaciones automatizadas
Ejecutar `node tests/studio.test.mjs`. Pruebas con DOM y Web Audio simulados; no sustituyen pruebas en dispositivos.

## Escucha pendiente antes de integrar
1. Con el mismo volumen de sistema y maestro, comparar 5 minutos de cada ambiente. Registrar comodidad y volumen percibido; corregir diferencias molestas.
2. Cambiar de ambiente durante reproducción y recorrer brillo/evolución de mínimo a máximo. No debe haber clics ni saltos de volumen.
3. Escuchar 45–60 minutos con evolución 0, 35 y 100. Registrar fatiga, monotonía y distracciones.
4. Completar una sesión de 25 minutos: entrada y cierre graduales, valoración opcional y minutos reales. Repetir después de pausar y reanudar.
5. Guardar mezcla, recargar, cargarla y borrarla. Verificar teclado y pantalla estrecha.
6. Chrome/Edge y Firefox de escritorio; Safari/iOS y Chrome/Android: probar bloqueo de pantalla, segundo plano, auriculares, controles multimedia y regreso a la aplicación.
7. Después de actualizar, abrir online una vez; verificar activación del nuevo service worker y funcionamiento offline.

## Límites conocidos
- Síntesis ambiental aproximada; no son grabaciones reales de lluvia u océano.
- La capa marrón conserva el buffer original de 16 segundos; la textura blanca usa un buffer de 19 segundos.
- Notas y actualizaciones lentas dependen de temporizadores del navegador, que pueden limitarse en segundo plano.
- No hay biometría ni promesas de eficacia clínica.
- Los datos históricos existentes se conservan, incluso si una versión anterior añadió demostraciones.
- No se ha demostrado igualdad de volumen percibido entre ambientes.
