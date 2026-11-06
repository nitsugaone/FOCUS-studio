# Comprobaciones automáticas

[FOCUS quality](../.github/workflows/quality.yml) ejecuta las mismas comprobaciones en pull requests hacia `main` y en cada push a `main`. La versión de Node de CI es 24.

## Node, build y recursos offline

Desde la raíz:

```sh
npm test
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run build -- --base=/FOCUS-studio/
npm run validate:build
```

`npm test` conserva el comando Node original, `node --test tests/*.test.mjs`. Node ejecuta las 30 suites de arranque modular, arquitectura, señal, interfaz simulada, sesiones, persistencia y mantenimiento. No requiere instalar los paquetes del build. `npm run lint` comprueba la configuración TypeScript de las herramientas. Vite genera `dist/`; la validación comprueba la subruta publicada, manifest y los recursos precargados realmente emitidos.

La prueba de limpieza ejecuta el script real en un proyecto temporal con rutas que contienen espacios y desde un directorio ajeno. Comprueba repetición, preservación de fuentes/servidor, enlaces anidados y rechazo de un archivo o enlace como `dist`. Repite la comprobación con una carpeta temporal accedida mediante enlace. No limpia el build del checkout de CI.

## Herramientas en Windows

El job independiente `windows` usa Node 24 en `windows-2025`, un [runner documentado por GitHub](https://github.com/actions/runner-images/blob/main/README.md#available-images). Ejecuta desde la raíz:

```sh
npm test
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run build -- --base=/FOCUS-studio/
npm run validate:build
npm run clean
```

Comprueba después que `dist/` ya no existe y que `src/main.js` y `package.json` siguen siendo archivos. Las 30 pruebas Node incluyen los fixtures de limpieza con enlaces, junctions, rutas con espacios y alias temporales. No se sustituyen las comprobaciones Linux ni sus artefactos; ambos sistemas trabajan en checkouts separados.

Este job valida herramientas y filesystem de Windows Server, no ejecuta Playwright en Windows ni acredita reproducción en un PC o teléfono físico.

## Navegadores

Instalar herramientas y navegadores desde `tools/browser-tests/`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium webkit
```

Ejecutar desde la raíz:

```sh
npm run test:browser
```

El destino predeterminado es fuente. Para comprobar la compilación, crear antes `dist/` y ejecutar desde la raíz:

```powershell
$env:FOCUS_TEST_TARGET = 'build'
npm run test:browser
```

Para volver a fuente en PowerShell: `$env:FOCUS_TEST_TARGET = 'source'`. En una shell POSIX: `FOCUS_TEST_TARGET=build npm run test:browser`.

El alias delega en `npm --prefix tools/browser-tests test --`: npm conserva la carpeta de trabajo del paquete de navegador, el entorno y los argumentos posteriores a `--`. El comando interno `npm test` desde esa carpeta sigue disponible. CI instala las dependencias allí y ejecuta el alias desde la raíz; no instala herramientas de navegador en el paquete principal.

La dependencia de Playwright está fijada en el lockfile de esta carpeta. CI usa la imagen `mcr.microsoft.com/playwright:v1.64.1-noble`, con navegadores y dependencias Linux preinstalados. Ejecuta Chromium a 320/390/768/1440 px y WebKit a 390/1440 px: los mismos 210 casos en fuente y build, 420 ejecuciones.

El [servidor de pruebas](../scripts/serve-tests.mjs) monta ambos destinos en `http://127.0.0.1:4173/FOCUS-studio/`; selecciona `dist/` cuando `FOCUS_TEST_TARGET=build`. Las pruebas no usan los datos personales del sitio publicado.

Cubren, entre otros:

- Disposición adaptable y ausencia de desbordamiento horizontal.
- Reproducción, barra móvil y estado al redimensionar.
- Mezclas, favoritas, búsqueda, duplicación, recuperación y enlaces.
- Exportación, importación, preview y recuperación de copias JSON.
- Recarga y reproducción offline tras instalar la caché.
- Ciclos, duración, entrada, cierre y extensión.
- Renderizado Web Audio y reconciliación al volver a una página visible.

## Artefactos y límites

CI conserva durante siete días el build y los reportes de navegador, incluidas capturas reales de revisión, capturas de fallos y trazas cuando corresponden. No se comparan con una imagen de referencia.

WebKit en Linux no equivale a un iPhone físico. Estas pruebas no verifican lo que oye una persona, fatiga, batería ni reproducción con pantalla bloqueada de un teléfono. El protocolo y el registro físico están en [VALIDACION-V3.md](VALIDACION-V3.md).

No se modifica la configuración de protección de ramas; ejecutar controles no implica que exista una regla obligatoria de merge.
