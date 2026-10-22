# Historial de valoraciones v3.5

## Funciones
El panel Tu historial distingue minutos de reproducción y valoraciones subjetivas.
Incluye filtros de 7 días, 30 días y todo lo guardado, con selección por ambiente.
Muestra cantidad de valoraciones, promedio de ayuda de 1 a 5, número de sesiones con pocas distracciones y las diez valoraciones más recientes.

Solo destaca el mayor promedio cuando al menos dos ambientes tienen tres valoraciones cada uno y sus promedios redondeados a un decimal no empatan. No estima concentración ni establece eficacia. Las muestras pequeñas se muestran con su cantidad.

## Datos
Se reutilizan las valoraciones locales focus-feedback-v3 (hasta 200).
Los filtros no modifican las valoraciones ni el historial de minutos.
Se excluyen registros malformados, fechas futuras, ambientes desconocidos y valores fuera de rango.
El período se calcula como una ventana móvil desde la hora actual del dispositivo.
El ambiente guardado es el seleccionado al finalizar la sesión; no se infiere cuánto tiempo se escuchó cada ambiente dentro de una sesión mixta.

## Pruebas
node tests/studio.test.mjs
node tests/insights.test.mjs

La suite de interfaz cubre carga inicial, creación de filas, filtros por período/ambiente e inmutabilidad de los datos en las tres rutas de audio.
La suite específica verifica promedios, umbrales, empates, límites del período, datos inválidos y límite de 200 entradas.
Se comprobó que el código de reproducción permanece sin cambios.

Pendiente en dispositivos reales: abrir el historial en celular y PC, filtrar después de guardar una valoración y revisar el desplazamiento de la tabla en pantallas estrechas. La verificación de este entorno usa DOM y audio simulados, sin captura visual.
