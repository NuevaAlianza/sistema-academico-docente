# Changelog — Sistema Académico Docente v1.5.0

> Formato: [Keep a Changelog](https://keepachangelog.com/es/)  
> Versión: **1.5.0** — Fecha de release: **2026-06-08**

---

## [1.5.0] — 2026-06-08

### Added

- **Modo multi-competencia completo**: una actividad puede distribuir puntos en 2, 3 o 4 competencias simultáneamente, con techo automático por competencia (`100 ÷ n_comps`).
- **Tab separado "Multi"** en la pantalla de Calificaciones para vista y calificación de actividades multi-competencia.
- **4 slots fijos siempre visibles** en el orden canónico (Comunicativa → Pensamiento Lógico → Cívica → Tecnológica); competencias inactivas en esa actividad muestran `—` como placeholder anti-confusión.
- **Franja visual de peso por competencia** en la lista de actividades (indica qué peso representa cada competencia del período).
- **PDF de período multi-competencia** con tabla de notas por estudiante × competencia y desglose por actividad.
- **Aviso de confirmación** antes de modificar las competencias de una actividad que ya tiene calificaciones guardadas.
- **Re-distribución automática** de todas las calificaciones al techo equitativo cuando el maestro cambia las competencias de una actividad ya calificada.
- **Toast de confirmación** al guardar distribución multi de un estudiante (muestra resumen de puntos y nota global).
- **Inputs con techo dinámico**: cada input de competencia muestra el techo como referencia y bloquea al usuario si ingresa un valor que lo supera (borde rojo + mensaje de error).
- **Validación inmediata**: bordes rojos y suma en tiempo real al tipear puntos por competencia.
- `console.warn` defensivo cuando una competencia leída de BD no está en la constante `COMPETENCIAS` (en lugar de silenciarla con `filter`).
- **Scripts de mantenimiento** en `/scripts/` con su `README.md`.

### Changed

- **Flujo de captura invertido**: antes, el maestro ingresaba la nota global y luego distribuía. Ahora ingresa directamente los puntos por competencia y la nota global se calcula automáticamente como suma. Esto elimina la ambigüedad del flujo anterior.
- **Nombres canónicos de competencias unificados** en toda la app y la BD:
  - `Comunicativa`
  - `Pensamiento Logico` *(sin tilde — clave interna)*
  - `Civica` *(sin tilde — clave interna)*
  - `Tecnologica` *(sin tilde — clave interna)*
  - Eliminados los nombres anteriores: `Científica`, `Ética` (y variantes con tildes que causaban desalineación).
- **Encabezados de competencias unificados** entre el tab Simple y el tab Multi (misma tipografía, colores e iconos).
- **Orden fijo de competencias** en toda la UI, PDFs y cálculos: Com → PL → Cív → Tec. Ya no varía según el orden en que se guardaron en BD.

### Fixed

- **BUG crítico — notas por competencia excedían 100**: cuando la distribución entre competencias estaba desbalanceada, una competencia podía recibir más puntos que su techo. Corregido con validación en `setCalificacionMulti`.
- **BUG crítico — backup no incluía WAL**: el backup anterior usaba copia de archivo crudo; si había transacciones pendientes en el WAL no se incluían. Corregido usando `db.backup()` de `better-sqlite3` (API atómica que integra el WAL).
- **BUG crítico — restore deshacía cambios**: al importar una BD, si el archivo `.wal`/`.shm` anterior no se borraba, SQLite los combinaba con la BD restaurada y revertía datos. Corregido limpiando WAL/SHM antes de copiar el archivo de backup.
- NaN al abrir la vista de calificaciones de la segunda actividad multi del período.
- Input de nombre bloqueado tras un error de validación en el modal de actividad (no se podía corregir el error).
- `semVerde before initialization` — crash en la vista de resumen al no inicializar la variable antes del guard.
- Solo se guardaba la primera competencia (Comunicativa) en distribuciones multi; las demás se descartaban silenciosamente.
- Pensamiento Lógico aparecía al final en lugar de segunda posición.
- Competencias desconocidas se silenciaban con `filter` sin ningún aviso en consola.
- Errores de punto flotante en distribución equitativa (la suma de los slots podía exceder la nota en ±0.2 puntos).
- **BUG-08 (auditoría v1.3.1)**: reporte individual no filtraba notas por `materia_id`, mezclaba calificaciones de materias distintas.
- **BUG-06**: clonar temas no copiaba `contenido_texto` ni `meta_json`.
- **BUG-02**: semáforo con umbrales inconsistentes entre módulos (Dashboard vs Calificaciones vs Reportes).
- **BUG-10**: `window.open()` podía retornar `null` en producción sin verificación, causando crash al generar PDF.

### Migrations

Scripts ejecutados sobre la BD de producción durante el ciclo v1.4–v1.5:

| Script | Descripción | Ejecutado en prod |
|---|---|---|
| `scripts/migrar-flujo-techo.js` *(archivado)* | Migración BD para el refactor del flujo inverso v1.4: recalculó distribuciones con el nuevo esquema de techo | Sí — durante desarrollo v1.4 |
| `scripts/limpiar-distribuciones.js` *(archivado)* | Corrección de claves desalineadas en `distribucion_multi` generadas al editar actividades en versiones anteriores | Sí — durante desarrollo v1.4.2 |
| `scripts/migrar-nombres-competencias.py` | Normaliza `Científica → Pensamiento Logico`, `Ética → Tecnologica` y elimina tildes de claves internas en `actividades.competencia`, `actividades.competencias_multi` y `calificaciones.distribucion_multi`. Idempotente. | Sí — 2026-06-08 |
| `scripts/limpiar-datos-prueba.py` | Borra actividades, calificaciones, temas y asistencias para dejar BD lista para datos reales. Preserva estructura (cursos, estudiantes, materias, configuración). | Pendiente — solo ejecutar cuando se confirme que los datos de prueba pueden eliminarse |

### Backups generados

Ubicación: `%APPDATA%\sistema-academico-docente\`

| Archivo | Fecha | Propósito |
|---|---|---|
| `backup_pre_migracion_nombres_20260608_181441.db` | 2026-06-08 18:14 | Snapshot antes de ejecutar `migrar-nombres-competencias.py`. BD con nombres Científica/Ética aún presentes. |
| `backup_pre_limpieza_v15_20260608_183112.db` | 2026-06-08 18:31 | Snapshot después de migración de nombres, antes de limpiar datos de prueba. Estado actual de la BD. |

> **Nota:** ambos backups tienen archivos `.wal` y `.shm` asociados en AppData, lo que indica que fueron restaurados pero la app se abrió sin haber integrado el WAL. Para usarlos como punto de restauración se recomienda abrir la BD con `estado-bd-actual.py` para verificar su integridad antes de restaurar.

---

## [1.4.2] — 2026-06-06

- Pestaña resumen Multi separada.
- Fix re-distribución al editar actividad con calificaciones.
- Aviso antes de editar competencias de actividad calificada.
- Distribución equitativa sin error de punto flotante.

## [1.4.1] — 2026-05-xx

- Fix JSX PDF Multi (paréntesis faltante).
- Fix `semVerde before initialization`.
- Fix distribución equitativa sin float error.
- Fix NaN en segunda actividad multi.

## [1.4.0] — 2026-05-xx

- Modo multi-competencia: BD, IPC, selector en modal, franja de peso, celda ajustable, PDF de período (pasos 1–5).

## [1.3.1] — 2026-04-xx

- Fix BUG-08, BUG-06, BUG-02, BUG-10.

## [1.2.0] — 2026-03-xx

- Base pública inicial del sistema.
