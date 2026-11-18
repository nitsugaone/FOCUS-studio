# Trabajo con Codex en FOCUS-studio

- El coordinador recibe el objetivo, decide la arquitectura, define el alcance y planifica las tareas. Asigna archivos a un único escritor por vez, resuelve conflictos y verifica el diff y las pruebas antes de entregar.
- Delegá preferentemente búsquedas, exploración y documentación de hallazgos a `archivista`. Su informe incluye rutas verificadas, símbolos relevantes, dependencias y un resumen breve. Nunca modifica archivos ni usa herramientas para escribir.
- Delegá preferentemente implementación, correcciones y pruebas a `programador`. Su tarea debe indicar alcance, archivos y validación esperada. No cambia arquitectura sin aprobación e informa los archivos modificados y las pruebas ejecutadas.
- Evitá agentes adicionales y duplicación de trabajo. El coordinador puede resolver directamente una tarea sencilla. Nunca asignes escrituras simultáneas sobre los mismos archivos.
- Preservá cambios previos, comportamiento del audio, interfaz, selectores, eventos, formatos de datos y funcionamiento offline. Commits, pushes y despliegues requieren autorización aplicable al trabajo.

## Delegación y permisos

Desde una sesión de Codex abierta en el repositorio, pedí al coordinador que delegue por nombre. Por ejemplo: «Pedile a `archivista` que ubique los puntos de entrada del audio y a `programador` que valide el cambio autorizado. Revisá ambos resultados». Las definiciones se cargan desde `.codex/agents/`.

Los subagentes heredan los permisos del coordinador. Las instrucciones de `archivista` prohíben escrituras, pero no pueden imponer un sandbox propio. Cuando sea obligatorio garantizar solo lectura, hacé la exploración en una sesión separada con sandbox de solo lectura y sin herramientas externas con permisos de escritura. Compartí el informe con el coordinador antes de pasar a la implementación.

Si esta sesión no expone los perfiles personalizados o no puede iniciar los agentes, indicá la limitación. El coordinador hace primero la exploración en lectura y después el trabajo autorizado, sin presentar esas fases como delegaciones reales.
