# Comprobaciones automáticas

El workflow FOCUS quality corre en pull requests hacia main y en cada push a main.

## Suite de Node
Ejecuta los tests existentes de interfaz simulada, señal de audio, estadísticas y copias de seguridad usando Node 24.

## Navegadores
Instala @playwright/test 1.64.1 en tools/browser-tests, separado de las dependencias de la aplicación.
Los runners usan Ubuntu 24.04 y separan dependencias de Linux y descarga de navegadores, con tiempos máximos por paso.
Ejecuta Chromium en tamaños 320/390/768/1440 px y WebKit en 390/1440 px.

Comprueba:
- Página sin desbordamiento horizontal y disposición de paneles según el ancho.
- Reproducción con Web Audio real, barra inferior y continuidad del estado al redimensionar.
- Persistencia de favoritas.
- Descarga de copia, vista previa sin escritura, importación y deshacer.
- Recarga y reproducción sin conexión después de instalar la caché.
- Filtros de valoraciones y ancho móvil.

Los tests guardan capturas de página completa, capturas de fallos, trazas e informe HTML como artefactos de GitHub Actions durante 7 días. Las capturas sirven para revisión; no se comparan contra una imagen de referencia todavía.

## Ejecutar localmente
node --test tests/*.test.mjs
cd tools/browser-tests
npm install --ignore-scripts --package-lock=false
npx playwright install chromium webkit
npm test

El servidor de prueba usa http://127.0.0.1:4173/FOCUS-studio/ para reproducir el subdirectorio de GitHub Pages. No cambia el sitio publicado ni usa los datos personales del usuario.

## Límites
WebKit en Linux no equivale a un iPhone físico. Estas pruebas no verifican lo que oye una persona, consumo de batería ni reproducción con pantalla bloqueada del teléfono. No se modifica la configuración de protección de ramas; la ejecución de controles no implica una regla obligatoria de merge.
