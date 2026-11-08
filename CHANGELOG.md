# Changelog — Sistema Académico Docente

## [1.11.1] — 2026-11-08

### Added (Nuevo)
- "Enviar a Portal-Ars" manda también las **evidencias de cada semana** (nombre, competencia, sesión, puntos sacados de puntos posibles). En la boleta del portal, el estudiante toca una semana y ve de qué actividades salió su nota («Mapa conceptual · Comunicativa · 10 de 15»).

### Internal (Interno)
- Solo lectura de `actividad_evidencias` y `evidencia_puntos`; sin cambios en la base de datos ni en las fórmulas (verificado: 2049/2049 promedios iguales).

## [1.11.0] — 2026-11-08

### Added (Nuevo)
- **Enviar a Portal-Ars** (Reportes → "Exportar para Portal-Ars" → "🌐 Enviar a Portal-Ars"): manda directo al portal, con el PIN de Configuración, el promedio del período, las competencias, la asistencia y el **detalle semana por semana** (peso de cada semana, nota, completa / pendiente / por venir). El estudiante ve en Portal-Ars cuántos puntos lleva («12 de 15»). Avisa qué números de lista no existen en el portal. El botón "Generar archivo" sigue igual. Se envía también el nombre del maestro (Configuración), que el portal muestra como firma de la boleta.
- **Novedades de Portal-Ars** (Estudiantes → "🌐 Novedades de Portal-Ars"): compara tus cursos con la lista del portal (actualizada desde el SIGERD) y sugiere estudiantes nuevos, cambios de número de lista, cambios de sección y quiénes ya no están. Compara por nombre (tolera errores de tipeo), nunca por número. Solo se aplica lo que marques, todo junto; si quedarían números repetidos no se aplica nada.

### Fixed (Corregido)
- "Importar padrón completo" ya no le pone a un estudiante el nombre de otra persona cuando la lista se corrió (eso pasaba sus notas a otro). Ahora lo informa y no lo toca.

### Internal (Interno)
- `electron/padronPortal.js` (comparación de nombres), `src/components/NovedadesPortal.jsx`. Sin cambios en la base de datos ni en las fórmulas de cálculo.
- Requiere en Portal-Ars las Tandas 33, 34 y 35 (ya corridas).

## [1.10.0] — 2026-10-28

### Added (Nuevo)
- **Curso activo para toda la app**: el curso elegido se mantiene al pasar entre Estudiantes, Asistencia, Calificaciones, Temario y Reportes, y se recuerda al cerrar. Se ve siempre en el menú lateral ("CURSO ACTIVO", con su color y un selector) junto a los botones P1–P4.
- **Período según la fecha**: al abrir, la app elige el período cuyas fechas incluyen hoy (Configuración → fechas de cada período). Aviso en el menú si se está trabajando en otro período.
- **Registro por evidencias** (Calificaciones → "📋 Crear desde el plan"): con el `plan.json` o `web.json` del período crea una actividad por semana con sus evidencias y pesos (10-15-20-15-15-25), y los temas de cada semana en el Temario, vinculados a su actividad. Vista previa con pesos editables; no duplica si se repite.
- Tabla por evidencias: se anotan los puntos del plan (p. ej. 20 de 25) y la app pone la nota en la competencia de la actividad, igual que si se escribiera a mano. Una evidencia que falta deja la semana "pendiente" (no cuenta en el promedio); botón "Pendientes → 0".
- Planilla imprimible del registro (en blanco o llena), por semana o del período completo, A4 horizontal.
- Reportes: tarjeta "📋 Evidencias pendientes" en el grupal, "Evidencias por semana" en el individual, indicador "N evidencias pendientes"; también en los PDF y en el HTML del lote.

### Changed (Cambiado)
- Calificaciones y Temario ya no abren siempre en P1, ni en el primer curso de la lista.
- Entrar a un curso desde Cursos lo vuelve el curso activo.
- "Duplicar a otros cursos" copia también las evidencias.
- Importar clases de Portal-Ars conserva la evaluación del período (`plan_periodo`).

### Fixed (Corregido)
- Dashboard: el clic en un curso del semáforo abría Calificaciones en el primer curso en vez del elegido.

### Internal (Interno)
- Tablas nuevas `actividad_evidencias` y `evidencia_puntos` (se crean solas al abrir la app). No cambian las fórmulas de cálculo.
- Hook `src/hooks/useSeleccionActiva.js`; componente `RegistroEvidencias.jsx`; plantilla `src/reportes/planillaEvidencias.js`.

## [1.9.1] — 2026-10-05

### Changed (Cambiado)
- Reportes → "Generar reporte por lote" ahora crea **un solo archivo HTML** en vez de una carpeta con un PDF por estudiante. Se abre en cualquier navegador sin internet y se puede enviar al supervisor: tarjetas Van bien / Límite / En riesgo / Sin calificar (clic = filtro), filtro por sección, búsqueda por nombre o número, orden, y visor con el resumen grupal y el reporte de cada estudiante con el mismo diseño del programa.
- Desde el HTML, "Imprimir / Guardar PDF" (o Ctrl+P) imprime solo el reporte abierto.

### Added (Nuevo)
- Lista filtrada en el HTML del lote: al filtrar aparece "📋 Lista filtrada" con solo esos estudiantes, imprimible; y "Reportes individuales (N)" imprime en un solo PDF el reporte de cada estudiante filtrado, uno por página.
- Casilla "Incluir cuaderno anecdótico" al generar el lote (desmarcada por defecto, porque quien recibe el archivo ve a todos los estudiantes).

### Fixed (Corregido)
- Reportes: nombres, temas u observaciones con caracteres como `<` o `&` rompían el reporte impreso; ahora se muestran tal cual.

### Internal (Interno)
- Plantillas de reportes movidas a `src/reportes/plantillasHTML.js` (las usan la impresión desde el programa y el lote).
- Canal IPC `generar-reportes-lote` (PDF por estudiante con `printToPDF`) reemplazado por `guardar-reporte-html`.
- Script `scripts/sembrar-prueba-reportes.js` para sembrar/limpiar datos de prueba de Reportes en 6to P1.

## [1.9.0] — 2026-10-02

### Added (Nuevo)
- Participación por momento de la clase: en Cursos → Clase de hoy, el popup "±" ofrece Inicio / Desarrollo / Cierre (opcional) cuando el tema del día tiene plan de clase. El historial muestra el momento.
- Calificaciones: al crear o editar una actividad se marcan los "Temas que evalúa". Al colocar notas, nueva columna "✋ Particip." con los puntos de esos temas y el total del período (`0 / +1`); si la actividad no tiene temas vinculados muestra el total del período con un aviso. Clic abre el historial con los movimientos de esos temas resaltados. Solo referencia: no modifica la nota.

### Changed (Cambiado)
- Los puntos de participación solo se pueden dar dentro de un tema pendiente o aplazado del curso. Sin tema abierto, Clase de hoy oculta los botones de puntos y muestra un aviso; la base de datos también lo rechaza.
- Estudiantes: no se puede crear, editar ni reactivar un estudiante con un número de lista que ya tiene otro activo del mismo curso. Cada sección mantiene su propia numeración.

### Fixed (Corregido)
- Temario: el modal "Clonar" se salía de la pantalla con muchos cursos y no se podía confirmar.

### Internal (Interno)
- Columna `participaciones.fase` y tabla `actividad_temas` vía `migrarTablas()` (aditivas, no modifican datos existentes). Métodos `getActividadTemas`, `setActividadTemas`, `getParticipacionActividad`, `numeroListaOcupado`; canales IPC `get-actividad-temas`, `get-participacion-actividad`.
- Componente compartido `src/components/HistorialParticipacion.jsx`.

## [1.8.2] — 2026-09-24

### Fixed (Corregido)
- "Crear nuevo año escolar" (Configuración) dejaba el año nuevo sin ninguna materia: `createAnio()` creaba los 4 períodos pero nunca una materia, ni actualizaba `materia_activa_id`. El maestro quedaba sin forma de operar ese año — Configuración → Mis Materias aparecía vacío, y cualquier función que dependa de una materia activa (p. ej. participación) quedaba bloqueada pidiendo "selecciona una materia" sin ninguna forma de hacerlo.
- Header: el botón "+" para agregar materia dependía de que ya existiera al menos una — si `materias` quedaba vacío (como en el bug anterior), no había ninguna forma de agregar una desde la UI. Ahora se muestra siempre que haya un año activo y menos de 3 materias.

## [1.8.1] — 2026-09-21

### Added (Nuevo)
- Participación en Cursos → Clase de hoy: botones − / + por estudiante, "±" (cantidad libre con motivo, p. ej. mala práctica), "+1 al grupo" y deshacer el último movimiento del día. Filtro por grupo (`Todos · G1 … · Sin grupo`). Es solo un indicador: no modifica calificaciones.
- Cursos → Estado: columnas Grupo y Participación (total neto del período), filtro por grupo, y clic en la participación para ver el historial (fecha, puntos, motivo, tema).

### Internal (Interno)
- Tabla `participaciones` (eventos por estudiante/curso/materia/período/tema) creada en `crearTablas()`. Métodos `addParticipaciones`, `deshacerParticipacion`, `getParticipacionResumen`, `getHistorialParticipacion`; `getSemaforoEstudiantes` ahora devuelve `grupo_trabajo` y `participacion`. Canales IPC `add-participaciones`, `deshacer-participacion`, `get-participacion-resumen`, `get-historial-participacion`.

## [1.8.0] — 2026-09-20

### Added (Nuevo)
- Grupos de trabajo: cada estudiante puede pertenecer a un grupo (fijo todo el año) para colocar notas siguiendo el cuaderno por grupos de 5-6 integrantes. Se asignan desde Estudiantes: selector "Grupo" por estudiante, o botón "👥 Grupos" pegando el texto del cuaderno (`G1: 3, 7, 12`, rangos `10-15`) en modo "Agregar / actualizar" o "Reemplazar todo", más "Quitar todos".
- Calificaciones: filtro `Todos · G1 · G2 … · Sin grupo` (con progreso hechos/total) sobre la lista de notas, en actividades simples y multi. Solo aparece si el curso tiene grupos; con "Todos" la vista es la de siempre.

### Internal (Interno)
- Columna `estudiantes.grupo_trabajo INTEGER` (NULL = sin grupo) vía `migrarTablas()`. Métodos `setGrupoEstudiante`, `asignarGrupos`, `quitarGruposCurso` en `database.js`; canales IPC `set-grupo-estudiante`, `asignar-grupos`, `quitar-grupos-curso`.
- El filtro es solo de vista: las notas se guardan por los mismos caminos (`set-calificacion` / `set-calificacion-multi`), por lo que ambas vistas siempre coinciden. Los totales del pie siguen siendo de todo el curso.

## [1.7.0] — 2026-09-17

### Added (Nuevo)
- Temario: traer clases desde Portal-Ars, con dos caminos — importar un archivo JSON exportado desde el admin de Portal-Ars, o descarga directa desde la app (botón "🌐 Traer de Portal-Ars", pide el PIN de admin ya guardado en Configuración). Ambos caminos comparten el mismo modal de vista previa y el mismo adaptador (`importClasesPortalArs`), que preserva todo el `detalle` de Portal-Ars (rúbrica, texto bíblico, materiales, actividades, etc.) en `meta_json` del tema.
- Backup en la nube (Portal-Ars): nueva sección en Backup para subir una copia cifrada (contraseña, AES-256-GCM) a Supabase Storage y restaurarla — una sola copia por instalación, cada subida reemplaza la anterior.
- Configuración: nuevo campo "PIN de administrador" (Portal-Ars), usado por las dos funciones de arriba.

### Internal (Interno)
- `_restaurarArchivoBD` extraído en `electron/main.js` para que el restore manual y el restore desde la nube compartan exactamente el mismo camino (cerrar conexión, limpiar WAL/SHM, copiar, reabrir).
- `getOrCrearInstalacionId` en `database.js`: identificador estable por instalación (UUID), generado una sola vez, usado como llave del archivo de backup en la nube.

## [1.5.0] — 2026-06-08

### Added (Nuevo)
- Modo de calificación multi-competencia: una actividad puede distribuir puntos en hasta 4 competencias con techo automático (100 ÷ n_comps)
- Pestañas separadas Simple / Multi en pantalla de Calificaciones
- Vista de distribución con 4 slots fijos (Com, PL, Cív, Tec) y placeholder "—" para competencias no aplicables
- Toast de confirmación al guardar distribución multi
- Franja de peso por competencia en tiempo real
- PDF de período multi-competencia con desglose por actividad
- Re-distribución automática al editar competencias de actividad con calificaciones ya guardadas
- Scripts de mantenimiento en /scripts con README

### Changed (Cambiado)
- Flujo de captura multi: maestro ingresa puntos por competencia y la nota global se calcula automáticamente (en lugar de pedir nota global primero)
- Encabezados de competencias unificados entre tab Simple y Multi
- Orden canónico fijo de competencias en toda la app: Comunicativa → Pensamiento Lógico → Cívica → Tecnológica
- Nombres de competencias unificados (migración automática de nombres antiguos como Científica/Ética a los canónicos)

### Fixed (Corregido)
- Bug crítico: una competencia podía exceder 100 cuando la distribución era desbalanceada
- Bug crítico: backup de BD no incluía datos del WAL (transacciones recientes podían perderse)
- Bug crítico: restore de BD no limpiaba archivos .wal/.shm, lo que causaba que el restore se deshiciera al re-abrir la BD
- Reporte individual no filtraba notas por materia (BUG-08 de auditoría)
- Clonar temas no copiaba contenido_texto ni meta_json (BUG-06)
- Semáforo con umbrales inconsistentes entre módulos (BUG-02)
- window.open podía retornar null en producción sin verificación (BUG-10)
- Distribución equitativa con error de float (suma podía exceder la nota por 0.2)
- Inputs de competencias no respetaban el orden canónico al renderizar
- Competencias desconocidas se silenciaban sin advertencia

### Internal (Interno)
- Scripts de diagnóstico y migración archivados en /scripts/archivo
- Documentación de scripts en /scripts/README.md
- PRUEBAS-v1.5.0.md con checklist de pruebas manuales

---

## v1.4.2 — 2026-06-06

### Modo Multi-competencia

**Nuevas funcionalidades**
- Pestañas **Simple / Multi-competencia** en la pantalla de Calificaciones → Resumen, con notas por competencia y promedio final por estudiante.
- Modo de calificación **multi-competencia**: una actividad puede evaluarse sobre varias competencias a la vez, con distribución equitativa automática o ajustable manualmente por estudiante.
- Franja visual de **peso acumulado por competencia** en la vista de Actividades.
- **PDF de período multi-competencia** con desglose por actividad y resumen de competencias del grupo.
- Aviso de confirmación antes de modificar las competencias de una actividad que ya tiene calificaciones guardadas.

**Correcciones**
- Re-distribución automática de notas al cambiar competencias de una actividad con calificaciones (`updateActividad` en database.js).
- Limpieza de distribuciones corruptas generadas al editar actividades en versiones anteriores (claves desalineadas con las competencias actuales).
- Validación robusta de suma de distribución vs. nota (sin errores de punto flotante).
- Corrección de NaN en vista resumen de segunda actividad multi.

**Interno**
- Scripts de diagnóstico de datos en `scripts/` (no visible al usuario).
- Función `equipartir()` unificada entre frontend y backend (misma lógica, mismos resultados).
- Nuevo IPC `get-resumen-competencias-multi-por-estudiante` para cálculo por alumno.

---

## v1.4.1 — 2026-05-xx

**Correcciones**
- `semVerde` before initialization (crash en resumen).
- Input de nombre no se bloqueaba tras error de validación en el modal.
- JSX del botón PDF Multi (paréntesis faltante).
- Distribución equitativa sin error de punto flotante al guardar modo multi.
- NaN en segunda actividad multi y distribución de todas las competencias.

---

## v1.4.0 — 2026-05-xx

**Nuevas funcionalidades**
- Modo multi-competencia: BD, IPC, selector en modal, franja de peso, celda ajustable, PDF de período (pasos 1–5).

---

## v1.3.1 — 2026-04-xx

**Correcciones**
- Ventana de impresión null antes de `document.write`.
- Semáforos unificados con valores de configuración.
- `clonarTemas` preserva `contenido_texto` y `meta_json`.
- `getReporteIndividual` filtra notas por `materia_id`.

---

## v1.2.0 — 2026-03-xx

Base pública inicial del sistema.
