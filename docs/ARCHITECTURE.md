# Arquitectura ES6 de FOCUS

Este cambio conserva la interfaz, las claves y los formatos de datos y los valores acústicos. GitHub Pages sirve el HTML raíz y módulos ES6 nativos; no se agrega un bundler ni dependencias.

## Dependencias

- `src/main.js` inicia `src/ui/FocusController.js`.
- La interfaz coordina audio, almacenamiento y sesión. ResponsiveController y HistoryView se ocupan de sus vistas.
- `src/audio/FocusAudioEngine.js` es el único propietario del AudioContext, grafo, fuentes, notas y temporizadores de suspensión. Importa DSP y escenas, sin importar módulos de interfaz o almacenamiento.
- `src/audio/dsp.js` contiene los constructores y las funciones matemáticas de estéreo, balance, ruido, reverberación, ráfagas y envolventes. Sus parámetros Web Audio son explícitos.
- `src/session/cycles.js` define las reglas de sesiones simples, rondas y descansos. `SessionClock.js` mide tiempo real con reloj y temporizadores inyectables. `sharing.js` conserva el formato de enlaces.
- `src/storage/StorageService.js` centraliza acceso JSON y fallos de persistencia mediante un adaptador. `backups.js` conserva validación, combinación, límites, transacciones y recuperación. `mixes.js` e `insights.js` contienen reglas sin DOM.

## Audio

`new FocusAudioEngine({platform, clearTimeout})` no crea fuentes ni inicia reproducción. La interfaz entrega copias de ajustes, volúmenes y datos del tramo con `configure(settings, levels, {elapsedMs, durationMinutes, silent})`. Luego coordina `resume()`, `applyScene()` y `start()`. `pause(slowFade)` y `close()` gestionan los recursos y temporizadores del motor.

`scheduleEntry(smooth)` y `scheduleClosing(smooth)` mantienen las automatizaciones en AudioContext.currentTime. Extender una sesión cambia el cierre y conserva la entrada y las fuentes. Cambiar un nivel usa `updateLevel(id,value)`. La secuencia de notas se reinicia o reprograma mediante `resetNotes()` y `restartNotes()`.

El elemento HTML de audio auxiliar recibe el MediaStream devuelto por `stream()` en la interfaz. Media Session, Wake Lock y eventos de página son responsabilidad de la interfaz. El motor no conoce elementos HTML ni ejecuta callbacks que los busquen.

El AudioWorklet mantiene `audio/noise-processor.js` y su alternativa con buffers. Su URL y el nombre del procesador se conservan para no cambiar el contrato existente.

## Sesión y almacenamiento

SessionClock conserva el tiempo acumulado, la marca de avance y la duración. Un callback tardío se limita al final del tramo; una pausa no suma tiempo; un reloj que retrocede no resta tiempo. El controlador decide cuándo renderizar, contabilizar historial y guardar. Los descansos y rondas siguientes siguen requiriendo la misma acción explícita del usuario.

StorageService recibe el adaptador de almacenamiento desde el arranque. Devuelve un resultado de guardado para que la interfaz decida cómo informar el error. Las copias siguen usando el formato y versión existentes, incluidos el rollback y la recuperación de importación.

## PWA y pruebas

Los dos Service Workers precargan la lista completa de módulos además del HTML y el worklet. La actualización continúa requiriendo una acción desde una sesión pausada. Cambiar cualquier archivo de producción requiere actualizar la versión de caché y, si corresponde, su lista de recursos.

Las pruebas de navegador conservan casos, selectores y acciones. Las pruebas que renderizan Web Audio leen funciones de los módulos de producción mediante `tests/support/application-source.mjs`; no usan copias del código. La prueba simulada de la aplicación importa el controlador real con adaptadores de navegador inyectados. Las pruebas de arquitectura comprueban el arranque modular, aislamiento, fallos de almacenamiento y ciclo de vida del reloj.

Ejecutar:
- `node --test tests/*.test.mjs`
- En `tools/browser-tests`: `npm ci --ignore-scripts --no-audit --no-fund` y `npm test`.

El scaffold React/TypeScript previo se conserva fuera del punto de entrada de Pages; no forma parte del arranque modular de esta aplicación.

## Build Vite

El despliegue sin empaquetar conserva las rutas fuente en ambos workers del repositorio. Para `vite build`, el plugin `scripts/build-offline-worker.mjs` reemplaza el worker de salida después de emitir los archivos: precarga el bundle y recursos realmente presentes en el directorio de salida, sin mapas de fuentes ni rutas `src/` inexistentes. La versión de caché se deriva del contenido emitido. La prueba del hook usa un directorio temporal y comprueba que todas las rutas precargadas existen.

## Validación del build completo

La CI ejecuta `npm run build -- --base=/FOCUS-studio/` con las dependencias de la aplicación y valida el resultado real mediante `node scripts/validate-build.mjs`. Comprueba el bundle, la ubicación pública del manifest, sus recursos y accesos de inicio y las URLs precargadas por el worker. El hook HTML de Vite conserva el manifest en la raíz pública para que sus rutas relativas sigan siendo válidas.

El artefacto `focus-production-build` se descarga en un job de navegador independiente. Los mismos 210 casos se ejecutan sin cambios contra los módulos fuente y contra `dist/`, incluidos el uso offline y la reproducción. El servidor de pruebas elige `dist/` cuando `FOCUS_TEST_TARGET=build` y mantiene el montaje `/FOCUS-studio/`. Los reportes de ambas variantes se guardan por separado.

## Instalaciones con dependencias bloqueadas

El proyecto conserva `package-lock.json` en la raíz y otro en `tools/browser-tests/`, porque son instalaciones npm independientes. Ambos registran versiones resueltas, URLs e integridad de los paquetes. La CI instala con `npm ci --ignore-scripts --no-audit --no-fund`; el build y las pruebas usan esas resoluciones.

Para preparar el build local, ejecutar `npm ci --ignore-scripts --no-audit --no-fund` en la raíz. Para las pruebas de navegador, ejecutar el mismo comando en `tools/browser-tests/`. Las actualizaciones intencionales de dependencias deben incluir el manifest y su lockfile correspondiente y superar las validaciones de lógica, build, offline y ambas distribuciones.

## Pruebas de contratos ES6

Las pruebas unitarias de funciones puras de DSP, ciclos, enlaces, mezclas, copias e informes importan las exportaciones de producción. Así comprueban el contrato real del módulo y sus dependencias sin buscar cuerpos de funciones por nombre o indentación. Se conservan las mismas aserciones de comportamiento.

En esta etapa, 13 archivos eliminan la extracción textual de funciones; otros tres importan su parte pura y conservan el entorno simulado de interfaz para el comportamiento restante. La prueba de ciclos mantiene una comprobación estática de compatibilidad con navegadores sin `Object.hasOwn`. El AudioWorklet conserva el entorno simulado de `registerProcessor`.

`tests/support/application-source.mjs` sigue reservado para los casos que necesitan estado interno del controlador y para transportar funciones a las pruebas de renderizado Web Audio del navegador. Esos casos y los 210 escenarios de navegador se mantienen; esta migración no expone nuevas APIs del producto para facilitar las pruebas.

## Controlador de biblioteca de mezclas

`src/ui/MixLibraryController.js` coordina guardar cambios, eliminar y recuperar la última eliminación. Recibe el estado de la biblioteca, el acceso a elementos, la función de persistencia, el renderizado y la selección como dependencias explícitas. `FocusController` conserva el arranque, la carga y validación de datos, los eventos y la aplicación de ajustes al audio.

El controlador escribe antes de cambiar el estado. Una escritura fallida conserva las mezclas y la recuperación pendiente; una edición guardada descarta la recuperación anterior. La eliminación conserva una copia de los niveles y la recuperación mantiene posición y metadatos. La búsqueda y los mensajes conservan su comportamiento.

La prueba de recuperación importa la misma fábrica usada por la aplicación y proporciona su estado y adaptadores de UI/almacenamiento. Conserva las aserciones existentes sin leer archivos fuente ni reconstruir funciones. El módulo forma parte de la precarga de ambos workers; la caché fuente pasa a v3.28.

## Controlador de extensión de sesiones

`src/ui/SessionExtensionController.js` coordina la acción existente de prolongar una sesión y su disponibilidad visual. Importa la regla pura de `src/session/cycles.js`; recibe el reloj, accesores al estado actual y callbacks de audio, persistencia y renderizado. Los accesores evitan conservar una copia obsoleta cuando el controlador principal reemplaza el estado de un ciclo.

La extensión avanza el reloj antes de validar, conserva el tiempo transcurrido y el historial, y reprograma únicamente el cierre de audio cuando hay reproducción. Mantiene el límite de 180 minutos y la exclusión de sesiones libres, ciclos, tramos terminados y transiciones. El fallo de guardado conserva el cambio en memoria y el mensaje existente.

La prueba importa el controlador de producción, conserva todas las aserciones anteriores y añade comprobaciones del contrato visual y del fallo de guardado. No reconstruye cuerpos de funciones ni lee código fuente. Ambos workers precargan el módulo; la caché fuente pasa a v3.29. No cambian el HTML, los eventos ni los escenarios de navegador.

## Contabilización del tiempo de escucha

`src/session/ListeningProgress.js` mantiene la marca del tiempo ya contabilizado. `advance(elapsedMs, {silent, flush})` devuelve los segundos nuevos: acumula por bloques de al menos cinco segundos durante la reproducción o de uno al cerrar, conservando la fracción pendiente. Un descanso en silencio actualiza la marca sin devolver segundos, por lo que ese tiempo no se añade al reanudar el sonido.

`checkpoint(elapsedMs = 0)` conserva el punto ya registrado al restaurar una sesión o reinicia la contabilización al iniciar otro tramo. El módulo no conoce DOM, almacenamiento ni Web Audio. `FocusController` conserva la coordinación de guardado y renderizado del historial y los mismos puntos de cierre, restauración y reinicio.

La prueba de descansos importa la clase de producción, conserva las aserciones anteriores y comprueba umbrales, fracciones, llamadas repetidas, restauración, reinicio y exclusión del silencio. Ambos workers precargan el módulo con caché fuente v3.30. No cambian las claves o el formato del historial, la asignación por día ni su redondeo.

## Coordinación de pausa

`src/ui/PlaybackController.js` coordina la pausa mediante adaptadores explícitos de estado, reloj, motor de audio, persistencia, interfaz, Media Session y Wake Lock. `FocusController` conserva el registro de eventos y el arranque. Los accesores leen el estado y los ajustes actuales; el motor sigue sin dependencias del DOM.

Se conserva el orden: detener el reloj y registrar el progreso, comprobar el final y persistir el ciclo completado, preparar la valoración del tramo de foco cuando corresponde, marcar la pausa, pausar el motor y el audio auxiliar, actualizar Media Session, liberar Wake Lock y sincronizar la interfaz. Una pausa repetida o durante una transición no ejecuta efectos.

La prueba de cierre de audio importa ahora la fábrica real y conserva todas sus aserciones anteriores. También comprueba el orden, la finalización tras un callback tardío, pausas repetidas, transiciones, valoración y navegadores sin Media Session o audio auxiliar. Ninguna prueba unitaria reconstruye ya funciones de UI desde texto; el helper de fuente se conserva para la comprobación estática de compatibilidad de ciclos y las pruebas de renderizado Web Audio en navegador. Ambos workers precargan el nuevo módulo con caché fuente v3.31.

## Inicio y reanudación de reproducción

`PlaybackController` reúne `play()` y `pause(slowFade = false)` con los mismos adaptadores de estado y recursos. Sustituye al módulo dedicado solo a pausa. `FocusController` registra los mismos eventos y conserva configuración, renderizado, persistencia y servicios de navegador. `FocusAudioEngine` sigue siendo el propietario del grafo sin acceso al DOM.

El arranque conserva la exclusión durante reproducción o transición, el avance manual al siguiente tramo, reinicio de una sesión vencida y orden de configuración/reanudación del motor. El stream y Media Session se preparan solo al inicializar el motor; al reanudar se conservan progreso y fuentes. Si falla el inicio, se detiene el reloj, se muestra el error existente y siempre se libera la marca de transición y sincroniza la interfaz. El rechazo del audio auxiliar continúa siendo tolerado.

Las pruebas importan el controlador real y cubren inicio, reanudación, guardas durante una promesa pendiente, siguiente tramo, sesión vencida, recursos multimedia opcionales y fallos de reanudación o inicio. Las aserciones anteriores de pausa y cierre se conservan. Ambos workers sustituyen la ruta antigua por el módulo compartido con caché fuente v3.32.

## Datos del historial diario

`src/storage/DailyHistory.js` conserva la carga, acumulación, reinicio, últimos siete días y cálculo de racha. Recibe `StorageService` y una función opcional `currentDate` para obtener fechas locales. No accede al DOM, al motor de audio ni a `localStorage` directamente.

`FocusController` conserva los mismos eventos de historial, el cálculo de segundos mediante `ListeningProgress` y la coordinación con `HistoryView`. La clave `focus-daily-history-v1`, el formato por fecha, el redondeo a décimas por actualización y el redondeo del gráfico a minutos permanecen intactos. El tiempo se asigna al día vigente al registrar, como antes; una escritura fallida conserva los datos en memoria y no cambia el tratamiento existente de errores.

Las pruebas importan el módulo real con almacenamiento y fecha controlados. Cubren carga ausente o inválida, redondeo, cambio de día/año, semana con febrero bisiesto, rachas, reinicio y fallos de lectura/escritura. Ambos workers precargan el módulo con caché fuente v3.33. El HTML y los escenarios de navegador se conservan.

## Servicios de reproducción del navegador

`src/ui/BrowserPlaybackServices.js` posee el Wake Lock y prepara los metadatos y acciones de Media Session. Recibe el navegador, el estado actual de reproducción y los callbacks `play`/`pause`; el constructor de metadatos se obtiene de forma diferida y puede inyectarse en pruebas. No construye nodos ni accede al DOM o al almacenamiento.

`FocusController` conserva los eventos de visibilidad y salida de página, y entrega los mismos servicios a `PlaybackController`. Se mantienen solicitud de bloqueo durante reproducción, limpieza al liberar o recibir el evento `release`, tolerancia a rechazos y navegadores sin estas APIs. Los metadatos y handlers `play`, `pause` y `stop` permanecen idénticos.

Las pruebas importan el servicio real y simulan adquisición, liberación externa o explícita, reacquisición, fallos y soporte opcional. También comprueban metadatos y despacho de las acciones multimedia. Son verificaciones automatizadas de coordinación; no sustituyen pruebas de pantalla bloqueada en dispositivos reales. Ambos workers precargan el módulo con caché fuente v3.34.

## Instalación y actualización PWA

`src/ui/PwaController.js` posee el aviso de instalación pendiente, el worker en espera y la marca de recarga solicitada. Recibe ventana, navegador, acceso a los elementos, estado actual de reproducción y guardado de sesión. `FocusController` conserva el arranque y sincroniza el mismo botón al cambiar la reproducción.

Los eventos y mensajes se conservan: instalación manual con `beforeinstallprompt`, registro del worker al cargar o recuperar conexión, disponibilidad offline y descubrimiento de actualizaciones. El controlador solo envía `SKIP_WAITING` tras la acción existente del usuario en pausa y guarda antes la sesión; `controllerchange` solo recarga después de esa solicitud. No se modifican las reglas de activación del worker.

Las pruebas importan el controlador real con adaptadores de eventos y promesas. Comprueban ausencia de recarga automática, bloqueo de actualización durante reproducción/transición, guardado previo a activación, descubrimiento de un worker instalado, instalación pendiente y sus fallos, conexión y soporte opcional. Ambos workers precargan el módulo con caché fuente v3.35.

## Vista de valoraciones e informes

`src/ui/InsightsController.js` coordina la lectura de valoraciones mediante `StorageService`, los selectores existentes de período/ambiente y el renderizado del resumen, comparación, tabla y diez registros recientes. Recibe documento, acceso a elementos y servicio de almacenamiento. Las reglas de validación, agrupación y comparación permanecen en `src/storage/insights.js`.

`FocusController` conserva el guardado de valoraciones, la importación/restauración y el arranque; invoca el mismo renderizado cuando corresponde. Se mantienen la clave `focus-feedback-v3`, todos los selectores, eventos, textos, fechas locales y el uso de `textContent` para los datos mostrados.

La cobertura existente de cálculo, aplicación simulada y navegador comprueba el período predeterminado, todo el historial, filtro por ambiente y filas de grupos/registros. Se conserva sin cambios y se ejecuta completa contra módulos fuente y build. Ambos workers precargan el módulo con caché fuente v3.36; no cambian el HTML, los controles ni las dependencias.

## Interfaz de copias de seguridad

`src/ui/BackupController.js` posee la copia pendiente y la secuencia de lecturas de archivo. Recibe adaptadores de documento, ventana, elementos, almacenamiento, descarga y estado actual de reproducción. Valida y aplica mediante `StorageService`; las reglas de transacción, combinación y recuperación permanecen en `src/storage/backups.js`.

Se conservan selección, límite de 1 MB, vista previa, cancelación, opción existente de ajustes, importación/recuperación solo en pausa y descarga JSON con liberación diferida de su URL. La secuencia descarta lecturas antiguas tras otra selección o una cancelación. `FocusController` conserva el indicador que evita guardar el estado anterior durante la salida de página tras restaurar: el callback de recarga se invoca solo después de aplicar o recuperar la copia.

Las pruebas de aplicación existentes siguen comprobando datos inválidos, vista previa, importación en pausa, progreso restaurado durante `pagehide`, recuperación y exportación. La prueba del controlador importa los módulos reales para verificar lecturas asíncronas superpuestas, cancelación y errores sin aplicar datos obsoletos. Ambos workers precargan el nuevo módulo con caché fuente v3.37; se mantienen HTML, eventos, formatos y dependencias.

## Enlaces de mezclas compartidas

`src/ui/SharedMixController.js` posee la mezcla recibida pendiente y coordina vista previa, creación/copia del enlace, menú nativo, aplicación o descarte y limpieza del hash. Recibe ventana, navegador, elementos, estado vigente y callbacks de la aplicación. La codificación y validación continúan en `src/session/sharing.js` con el mismo formato y lista de campos.

`FocusController` conserva la aplicación de ajustes al estudio, niveles y sesión. El callback devuelve los mismos resultados de persistencia; después se oculta la vista previa, se limpia la valoración y se muestran los mensajes existentes, conservando el orden. Recibir o descartar un enlace no aplica ajustes; aplicarlo sigue requiriendo pausa. Compartir utiliza únicamente el enlace generado y el mismo título.

La cobertura existente comprueba la apertura de enlaces de ajustes y compatibilidad, uso del menú nativo, promesa pendiente sin duplicar solicitudes, cancelación/error y copia manual cuando faltan APIs. Se ejecuta completa sin modificar pruebas ni selectores. Ambos workers precargan el módulo con caché fuente v3.38; no cambian controles, datos compartidos ni dependencias.

## Persistencia de sesiones

`src/session/SessionPersistence.js` conserva la clave `focus-session-v1`, intervalo de guardado de cinco segundos, guardados forzados y normalización de sesiones recuperadas. Recibe `StorageService`, las reglas de ciclos y una función de tiempo inyectable. No modifica el reloj ni accede al DOM o al motor de audio.

`FocusController` entrega la instantánea y conserva el mensaje de fallo de escritura. Al recuperar, aplica la duración, progreso y ciclo devueltos, marca el tiempo ya contabilizado y actualiza la misma interfaz sin iniciar audio. Se conservan compatibilidad con sesiones antiguas sin ciclo, rechazo de datos inválidos o superiores a siete días, límite al final de un tramo y finalización de un ciclo agotado sin avanzar automáticamente.

La prueba del módulo usa almacenamiento real con adaptador en memoria y tiempo controlado. Verifica cadencia y guardado forzado/fallido, compatibilidad, validación, sesiones libres y tramos completados. Las pruebas anteriores de reloj, pausa, restauración y navegador se conservan. Ambos workers precargan el módulo con caché fuente v3.39.
