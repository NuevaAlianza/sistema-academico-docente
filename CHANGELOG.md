# Changelog — Sistema Académico Docente

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
