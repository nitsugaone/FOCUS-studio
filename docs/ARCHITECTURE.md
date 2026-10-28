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
