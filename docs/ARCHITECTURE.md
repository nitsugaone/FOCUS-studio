# Arquitectura de FOCUS Studio

FOCUS carga `src/main.js` desde el HTML raíz mediante un módulo ES6. El punto de entrada llama a `startFocusApp`; los IDs, clases y atributos accesibles del HTML son el contrato de los controladores y las pruebas de navegador.

GitHub Pages sirve este HTML y sus módulos nativos. El repositorio también dispone de un build Vite, validado de forma independiente. El scaffold React/TypeScript y sus dependencias de desarrollo no son el punto de entrada del sitio de Pages.

## Responsabilidades y dependencias

| Área | Módulos | Responsabilidad |
| --- | --- | --- |
| Arranque | [main.js](../src/main.js), [FocusController.js](../src/ui/FocusController.js) | Crear estado y servicios, conectar callbacks y ejecutar carga/registro en el orden existente. |
| Audio | [FocusAudioEngine.js](../src/audio/FocusAudioEngine.js) | Poseer AudioContext, grafo, fuentes, notas, suspensión y cierre. |
| DSP y escenas | [dsp.js](../src/audio/dsp.js), [scenes.js](../src/audio/scenes.js) | Cálculos, constructores de procesamiento con parámetros explícitos y datos de ambientes. |
| Tiempo y ciclos | [SessionClock.js](../src/session/SessionClock.js), [cycles.js](../src/session/cycles.js) | Tiempo real acumulado, duración y reglas de sesiones simples, rondas, descansos y extensión. |
| Progreso y recuperación | [ListeningProgress.js](../src/session/ListeningProgress.js), [SessionPersistence.js](../src/session/SessionPersistence.js) | Segundos ya contabilizados, cadencia de guardado y validación de snapshots. |
| Persistencia | [StorageService.js](../src/storage/StorageService.js), [DailyHistory.js](../src/storage/DailyHistory.js) | Adaptador JSON, carga compatible de niveles/estudio/biblioteca e historial por fecha local. |
| Ajustes del estudio | [studio.js](../src/storage/studio.js) | Validación y proyección de ajustes compatibles, sin acceso a la interfaz ni al almacenamiento. |
| Reglas de datos | [backups.js](../src/storage/backups.js), [mixes.js](../src/storage/mixes.js), [insights.js](../src/storage/insights.js), [sharing.js](../src/session/sharing.js) | Validación y transacciones de copias, búsqueda/duplicación de mezclas, informes y codec de enlaces. |
| Reproducción | [PlaybackController.js](../src/ui/PlaybackController.js), [PlaybackView.js](../src/ui/PlaybackView.js) | Inicio/pausa y coordinación de recursos; presentación, errores y botones principal/móvil. |
| Estudio y niveles | [StudioController.js](../src/ui/StudioController.js), [VolumeController.js](../src/ui/VolumeController.js) | Controles y estado visual, escena/entrada/cierre, captura/aplicación de mezclas y aviso de guardado; niveles, perfiles y mute. |
| Sesión en UI | [SessionTimerController.js](../src/ui/SessionTimerController.js), [CycleController.js](../src/ui/CycleController.js), [SessionExtensionController.js](../src/ui/SessionExtensionController.js) | Ticks/renderizado/reinicio/recuperación/accesos PWA, controles de ciclo/duración y acción de extensión. |
| Biblioteca | [MixLibraryController.js](../src/ui/MixLibraryController.js), [MixLibraryView.js](../src/ui/MixLibraryView.js) | Acciones y recuperación de eliminación; selección, favoritas, búsqueda y preview. |
| Historial y valoración | [HistoryController.js](../src/ui/HistoryController.js), [HistoryView.js](../src/ui/HistoryView.js), [InsightsController.js](../src/ui/InsightsController.js) | Registrar escucha y dibujar el historial; guardar valoraciones y presentar informes/filtros. |
| Datos portables | [SharedMixController.js](../src/ui/SharedMixController.js), [BackupController.js](../src/ui/BackupController.js) | Preview y acciones de enlaces; selección, preview, importación, recuperación y descarga de copias. |
| Navegador y PWA | [BrowserPlaybackServices.js](../src/ui/BrowserPlaybackServices.js), [PwaController.js](../src/ui/PwaController.js) | Wake Lock, Media Session y eventos de página; instalación y actualización manual. |
| Presentación adaptable | [ResponsiveController.js](../src/ui/ResponsiveController.js), [InteractionController.js](../src/ui/InteractionController.js) | Paneles por breakpoint; vista de concentración y atajos existentes. |

Audio solo importa su propio dominio. Almacenamiento y sesión pueden usar módulos de dominio, pero no UI ni el arranque. Los módulos de dominio reciben adaptadores y no acceden directamente al documento o al almacenamiento del navegador.

`FocusController` conserva la composición: no registra directamente eventos DOM ni asigna contenido visual. Los controladores de UI pueden coordinar el motor, pero no construyen recursos Web Audio.

## Contratos que deben conservarse

### Audio y reproducción

`new FocusAudioEngine({platform, clearTimeout})` no crea el grafo ni inicia sonido. `configure(settings, levels, {elapsedMs, durationMinutes, silent})` toma copias de ajustes y niveles. `resume()` inicializa o reanuda; `applyScene(smooth)` actualiza el grafo y `start()` programa las envolventes y notas.

La automatización de entrada y cierre usa `AudioContext.currentTime`. Los ticks de pantalla actualizan presentación y reconcilian tiempo; no son el reloj del cierre acústico. Extender una sesión reemplaza el cierre conservando entrada y fuentes. `updateLevel`, `resetNotes` y `restartNotes` conservan sus responsabilidades específicas.

`PlaybackController` mantiene la exclusión durante inicio/transición y coordina reloj, feedback, audio auxiliar, Media Session y Wake Lock. `stream()` entrega el MediaStream que la UI conecta al elemento auxiliar. El motor permanece desacoplado de elementos HTML.

El worklet conserva la ruta [audio/noise-processor.js](../audio/noise-processor.js), su copia pública y su alternativa con buffers.

### Estado, callbacks y arranque

Los getters consultan el estudio, ciclo y reproducción vigentes: cargar una mezcla o recuperar una sesión puede reemplazar esos objetos. Evitar capturar snapshots al construir un controlador que deba seguir leyendo cambios.

Algunas dependencias se construyen después de sus consumidores. Los adaptadores de temporizador, sincronización de UI/historial y reinicio de `FocusController` se resuelven al usarse. No adelantarlos ni ejecutar esas acciones durante construcción. Las acciones de escena ya se conectan directamente porque el estudio se construye antes de sus consumidores.

Los registros existentes conservan el orden: volumen, duración, reproducción, reinicio, historial, atajos y ciclo de página. La carga final conserva:

1. Ajustes de volumen.
2. Estudio y biblioteca; sincronización y renderizado inicial; registro de búsqueda, controles del estudio, acciones de mezclas y feedback.
3. Paneles adaptables e historial diario.
4. Recuperación del snapshot de sesión, sin autoplay ni guardado.
5. Informes, copias de seguridad y controles de ciclo.
6. Acceso PWA de duración y después enlace compartido.
7. Renderizado final de reloj, historial y estado de reproducción.

Esta precedencia permite que un acceso PWA reemplace la sesión recuperada y que el enlace se procese después. Las fases siguientes de ciclos guiados siguen requiriendo inicio explícito.

Al volver a una página visible, `BrowserPlaybackServices` avanza el reloj, aplica escena, renderiza y solicita Wake Lock solo si la reproducción continúa. En `pagehide` detiene el reloj salvo recarga por restauración, libera Wake Lock y cierra el motor. El flag de restauración evita sobrescribir datos recién importados.

### Tiempo y escucha

`SessionClock` recibe reloj y temporizadores inyectados. Limita callbacks tardíos al final del tramo, no acumula tiempo detenido y no resta tiempo si el reloj retrocede. Los adaptadores de APIs nativas deben conservar el receptor correcto. `rebase()` actualiza solo la referencia temporal con la fuente inyectada, conservando progreso, duración y timer. El inicio y los reinicios durante reproducción usan esa misma operación; los controladores no escriben la marca temporal con `Date.now()`.

`ListeningProgress.advance(elapsedMs, {silent, flush})` entrega segundos nuevos al acumular al menos cinco segundos, o uno con cierre forzado. Conserva la fracción pendiente. Un descanso silencioso mueve el checkpoint sin sumar escucha; recuperar una sesión fija el checkpoint al tiempo ya registrado.

`HistoryController` agrega y redibuja solo cuando hay segundos registrables. `DailyHistory` mantiene fechas locales, asignación al día del registro, redondeo a décimas por actualización y minutos enteros para el gráfico.

`SessionPersistence.save` limita guardados normales a cinco segundos y admite guardado forzado. Devuelve el resultado de escritura o `undefined` cuando omite el guardado por cadencia. La UI presenta el error de sesión solo ante `false` estricto. Recuperar valida y limita el snapshot; aplicar ese resultado al reloj pertenece a `SessionTimerController`.

## Persistencia y formatos

`StorageService` recibe el adaptador desde el arranque. `read` usa fallback ante datos ausentes/ilegibles; `write` devuelve éxito o fallo. La presentación del aviso existente pertenece a `StudioController.writeLocal/showStorageError`.

| Clave | Datos |
| --- | --- |
| `focus-studio-v3` | Ajustes del estudio. |
| `focus-audio-settings-v2` | Niveles master/noise/drone/notes. |
| `focus-mixes-v3` | Biblioteca de mezclas y favoritas. |
| `focus-session-v1` | Duración, tiempo acumulado y estado de ciclo. |
| `focus-feedback-v3` | Valoraciones de sesiones. |
| `focus-daily-history-v1` | Minutos por fecha local. |
| `focus-backup-undo-v1` | Datos para recuperar la importación previa. |

`loadLevels(defaults)` recupera los niveles guardados, conserva los valores finitos limitados a 0–100 y completa los ausentes o inválidos con los defaults recibidos. `VolumeController` aplica el resultado a los controles y al motor en el mismo orden, sin guardar durante la carga.

`studio.js` concentra `validStudio` y la proyección pura `studioSettings`; `mixes.js` conserva sus exportaciones anteriores por compatibilidad y se ocupa de búsqueda y duplicación. Los consumidores de ajustes importan directamente desde `studio.js`. `loadStudio(key)` valida y aplica esa proyección. `loadMixes(levelKeys)` conserva el filtrado y límite de 50, sin reescribir registros. Al aplicar mezclas guardadas o compartidas se usan los mismos defaults de compatibilidad, manteniendo las diferencias de validación y los resultados de persistencia de cada ruta. La normalización de enlaces y copias también reutiliza `studioSettings` después de sus propias validaciones. Las pruebas de ambos formatos fijan el JSON legado y configurado para proteger campos, orden, defaults y exclusión de datos adicionales, sin modificar los objetos de origen.

Las acciones de biblioteca escriben antes de reemplazar estado. Una escritura fallida conserva datos y recuperación pendiente; una mutación guardada invalida la eliminación recuperable anterior. Esa eliminación pendiente vive en memoria y no se exporta.

Las copias usan `format: 'focus-studio-backup'`, `version: 1`, con validación, combinación, rollback y recuperación en `backups.js`. El controlador descarta lecturas de archivo obsoletas. Aplicar o recuperar una copia recarga solo después de la transacción.

Los enlaces usan la lista permitida de ajustes con `v: 1`. Compartir no incluye nombres de mezclas, historial ni tiempo acumulado. Recibir/descartar un enlace no aplica ajustes; aplicarlo requiere pausa.

## PWA y dos distribuciones verificadas

Para Pages con módulos nativos, [sw.js](../sw.js) y [public/sw.js](../public/sw.js) deben ser idénticos y precargar el grafo completo, worklet y recursos públicos. Un cambio de producción requiere revisar la versión de caché y agregar/quitar recursos cuando corresponda. Cambios solo de documentación o pruebas no requieren una nueva caché.

`PwaController` descubre el worker en espera y solo envía `SKIP_WAITING` tras la acción existente en pausa, guardando antes la sesión. La instalación no fuerza activación; `controllerchange` solo recarga tras esa solicitud.

El build de [vite.config.ts](../vite.config.ts) usa [build-offline-worker.mjs](../scripts/build-offline-worker.mjs). Después de emitir archivos, genera la precarga de los recursos reales de `dist/` y una versión derivada de su contenido, sin rutas fuente inexistentes ni mapas de fuentes. El hook HTML mantiene el manifest en la raíz pública.

[validate-build.mjs](../scripts/validate-build.mjs) verifica el bundle real, subruta de despliegue, manifest, accesos PWA y cada recurso offline. El servidor de pruebas monta tanto fuente como build bajo `/FOCUS-studio/`; selecciona `dist/` con `FOCUS_TEST_TARGET=build`.

## Validación y mantenimiento

La [CI de calidad](../.github/workflows/quality.yml) ejecuta Node, build y los mismos 210 casos de navegador en fuente y build: 420 ejecuciones en seis perfiles Chromium/WebKit. Mantiene artefactos de build y reportes separados por variante.

Las dependencias de desarrollo están bloqueadas mediante dos lockfiles, uno en la raíz y otro en `tools/browser-tests/`. Para reproducir los comandos de CI desde la raíz:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/*.test.mjs
npm run build -- --base=/FOCUS-studio/
node scripts/validate-build.mjs
```

En `tools/browser-tests/`, con los navegadores de Playwright disponibles, ejecutar en PowerShell:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
$env:FOCUS_TEST_TARGET = 'source'
npm test
$env:FOCUS_TEST_TARGET = 'build'
npm test
```

El build debe existir antes de probar la segunda variante. CI usa la imagen Playwright indicada en el workflow. Estas pruebas cubren coordinación y renderizado Web Audio; la escucha, volumen percibido y bloqueo de pantalla en equipos físicos corresponden a [la guía de validación](VALIDACION-V3.md).

Las pruebas de lógica importan módulos de producción y usan adaptadores controlados. [session-timer.test.mjs](../tests/session-timer.test.mjs) compone el temporizador con reloj, progreso, persistencia y pausa de producción; cubre reinicios con tiempo inyectado, fallo de guardado, recuperación sin doble escucha, finalización tardía de descansos y precedencia de accesos PWA. [application-source.mjs](../tests/support/application-source.mjs) permanece para la comprobación estática de compatibilidad de ciclos y el transporte de funciones DSP a los escenarios de navegador; no reconstruye controladores de UI.

[architecture.test.mjs](../tests/architecture.test.mjs) protege el arranque modular y la delegación de eventos/presentación. [module-graph.test.mjs](../tests/module-graph.test.mjs) detecta ciclos en los imports estáticos de una línea usados por producción, límites de dominio y propiedad de recursos de audio. Compara el inventario JavaScript de `src/` con el grafo alcanzado por el arranque. También ejecuta el handler de instalación del worker de producción con caché simulada, comprueba los recursos realmente enviados a `cache.addAll` y lee cada archivo precargado, además de conservar la verificación textual y de igualdad entre ambos workers. Si cambia el formato de imports, debe ampliarse ese lector estructural.

Al modificar un módulo, conservar firmas/eventos/selectores y orden de efectos; revisar consumidores, estado vigente y precarga; ejecutar Node, build y ambas variantes de navegador. Mantener este documento como descripción del estado actual; el historial de extracción está en los commits y PRs.
