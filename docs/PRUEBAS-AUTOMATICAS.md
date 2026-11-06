# Comprobaciones automáticas

[FOCUS quality](../.github/workflows/quality.yml) ejecuta las mismas comprobaciones en pull requests hacia `main` y en cada push a `main`. La versión de Node de CI es 24.

## Node, build y recursos offline

Desde la raíz:

```sh
node --test tests/*.test.mjs
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run build -- --base=/FOCUS-studio/
node scripts/validate-build.mjs
```

Node ejecuta las 29 suites existentes de arranque modular, arquitectura, señal, interfaz simulada, sesiones y persistencia. No requiere instalar los paquetes del build. `npm run lint` comprueba la configuración TypeScript de las herramientas. Vite genera `dist/`; la validación comprueba la subruta publicada, manifest y los recursos precargados realmente emitidos.

## Navegadores

Desde `tools/browser-tests/`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium webkit
npm test
```

El destino predeterminado es fuente. Para comprobar la compilación, crear antes `dist/` y ejecutar:

```powershell
$env:FOCUS_TEST_TARGET = 'build'
npm test
```

Para volver a fuente en PowerShell: `$env:FOCUS_TEST_TARGET = 'source'`. En una shell POSIX: `FOCUS_TEST_TARGET=build npm test`.

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
