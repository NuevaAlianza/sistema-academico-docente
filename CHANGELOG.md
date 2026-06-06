# Changelog — Sistema Académico Docente

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
