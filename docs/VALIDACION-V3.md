# Validación FOCUS Studio v3

## Comprobaciones automatizadas
Ejecutar `node --test tests/*.test.mjs` para la suite completa. El test de estudio usa DOM y Web Audio simulados. Las pruebas de navegador y renderizado real se detallan en [PRUEBAS-AUTOMATICAS.md](PRUEBAS-AUTOMATICAS.md); no sustituyen pruebas físicas.

## Registro de pruebas en dispositivos reales

Información recibida del usuario el 6 de noviembre de 2026: pruebas en celulares Android y PC, todas desde navegador web. Luego precisó Windows y Chrome para el PC. En el intercambio previo informó que la reproducción, la escucha entre ambientes y la continuidad con pantalla bloqueada funcionaban; no se detalló qué comprobaciones se realizaron en cada equipo. Es un reporte manual del usuario, no una validación adicional realizada por el agente.

| Equipo informado | Sistema operativo | Modalidad | Modelo y versiones | Navegador y versión |
| --- | --- | --- | --- | --- |
| Celulares | Android; versión no informada | Navegador web | No informados | No informados |
| PC | Windows; versión no informada | Navegador web | No informados | Chrome; versión no informada |

No se informó la fecha de ejecución ni la duración del bloqueo por equipo. No se documentan pruebas de una PWA instalada ni de sistemas o navegadores específicos adicionales.

Para cada prueba registrar: fecha, modelo, versión del sistema, navegador y versión, navegador o PWA instalada, uso de auriculares, duración del bloqueo y resultado al regresar. Los perfiles Chromium/WebKit de CI son automatizados sobre Linux y no constituyen pruebas de teléfonos físicos.

## Protocolo de escucha y validación física
1. Con el mismo volumen de sistema y maestro, comparar 5 minutos de cada ambiente. Registrar comodidad y volumen percibido; corregir diferencias molestas.
2. Cambiar de ambiente durante reproducción y recorrer brillo/evolución de mínimo a máximo. No debe haber clics ni saltos de volumen.
3. Escuchar 45–60 minutos con evolución 0, 35 y 100. Registrar fatiga, monotonía y distracciones.
4. Completar una sesión de 25 minutos: entrada y cierre graduales, valoración opcional y minutos reales. Repetir después de pausar y reanudar.
5. Guardar mezcla, recargar, cargarla y borrarla. Verificar teclado y pantalla estrecha.
6. Chrome/Edge y Firefox de escritorio; Safari/iOS y Chrome/Android: probar bloqueo de pantalla, segundo plano, auriculares, controles multimedia y regreso a la aplicación.
7. Después de actualizar, abrir online una vez; verificar activación del nuevo service worker y funcionamiento offline.

## Límites conocidos
- Síntesis ambiental aproximada; no son grabaciones reales de lluvia u océano.
- Con AudioWorklet, ruido y crepitaciones se generan continuamente. La ruta de respaldo usa buffers sintetizados: marrón de 16 segundos y blanco/crepitaciones de 19 segundos.
- Notas y actualizaciones lentas dependen de temporizadores del navegador, que pueden limitarse en segundo plano.
- No hay biometría ni promesas de eficacia clínica.
- Los datos históricos existentes se conservan, incluso si una versión anterior añadió demostraciones.
- No se ha demostrado igualdad de volumen percibido entre ambientes.
