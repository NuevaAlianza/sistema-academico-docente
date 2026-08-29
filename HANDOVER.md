# HANDOVER.md — Estado actual del proyecto
# Sistema Académico Docente

**Versión:** 1.6.0  
**Fecha:** 2026-07-30  
**Estado:** Estable — pase de animaciones + generación de reportes por lote completados, build en curso

---

## Lo último que se hizo

### Importación de padrón completo por grado+sección (nuevo, sin versionar todavía)

Contexto: se está evaluando compartir el padrón de estudiantes con Portal-Ars (portal web separado de la misma institución, Supabase). En vez de una sincronización en vivo (rompería el diseño 100% offline de esta app), se acordó un archivo compartido que cualquiera de los dos sistemas puede generar/consumir.

- Nuevo botón "📥 Importar padrón completo" en Estudiantes, bajo la lista de cursos (a diferencia del import existente, que es por curso, este es para todo el año escolar de una vez).
- Archivo requerido: columnas `grado, seccion, numero_orden, nombre` — filas sin alguno de esos 4 datos se descartan y se informan como inválidas, no se adivinan.
- `previewImportPadron`/`confirmarImportPadron` en `database.js` + `abrir-archivo-padron`/`preview-import-padron`/`confirmar-import-padron` en `main.js` — agrupa por grado+sección, empareja contra `cursos` activos del año (`WHERE estado='activo'`, nunca reutiliza uno archivado), y dentro de cada curso empareja estudiante por `numero_lista` (no por nombre, a diferencia del import existente) — actualiza el nombre si cambió, inserta si es nuevo, no toca nada si ya coincide.
- Un grupo grado+sección sin curso existente **no se crea solo** — aparece en la vista previa con un checkbox "Crear curso" que el maestro tiene que marcar a propósito; si no lo marca, se omite sin tocar nada (se puede reintentar después con un archivo corregido).
- **Verificado (no solo build)**: se copió `sistema_docente.db` real a un directorio temporal fuera del repo y se replicó la lógica exacta de `previewImportPadron`/`confirmarImportPadron` en Python contra esa copia (no se tocó la BD real en ningún momento) — casos probados: fila igual a lo existente (sin cambios), fila con nombre distinto en el mismo número de lista (actualiza), número de lista nuevo (inserta), grupo sin curso sin marcar crear (se omite, no crea nada), mismo grupo confirmando crear (crea el curso y el estudiante), y correr el mismo archivo una tercera vez completa (todo queda en "sin cambios" — confirma que es seguro repetir la importación). `npx vite build` corrido para confirmar que el JSX nuevo compila sin errores.
- **Pendiente real**: esto es la mitad de la integración — falta el lado que genera el archivo desde Portal-Ars (o donde sea que viva la fuente de verdad del padrón) y decidir cuál sistema es la fuente. No se tocó nada del lado de Portal-Ars en esta sesión.

### Exportar promedio de período + asistencia para Portal-Ars (nuevo, sin versionar todavía)

Segunda parte de la integración con Portal-Ars, en sentido contrario al padrón: acá sistema-docente genera el archivo (nunca lo recibe). Pensado para que el estudiante vea en Portal-Ars el promedio del maestro (no solo sus notas de examen del portal) y su asistencia — datos que hoy Portal-Ars no tiene en absoluto.

- Botón nuevo "📤 Exportar para Portal-Ars" en Reportes, junto a "Generar reporte por lote" — mismo patrón de modal (grado + checkboxes de secciones + período), más un campo nuevo: "¿Cuántas actividades en total vas a calificar este período?" (el maestro lo escribe a mano; el sistema no tiene forma de saber cuántas actividades se van a crear a futuro, solo cuántas existen ya).
- `getExportPortalArs(cursoId, periodoId, materiaId)` en `database.js`: promedio general (igual fórmula que `getReporteGrupal`), desglose de las 4 competencias (misma fórmula de `getReporteIndividual`, simple/multi -- **duplicada a propósito** en vez de refactorizar esa función ya en uso por los PDFs, para no arriesgar una regresión ahí), conteo de `actividades_calificadas` (cuántas actividades del curso+período+materia ya tienen al menos una nota cargada, sin importar de qué estudiante), y asistencia acumulada del curso (la tabla `asistencias` no tiene `periodo_id` -- misma limitación que ya tenía `getReporteGrupal`, no es nueva).
- **Decisión de diseño importante, confirmada con el usuario**: el cálculo de "avance real del período" (ej. un 90 de promedio con solo 2 de 6 actividades hechas equivale a un ~30 de avance real, no un 90) y la "proyección estimada" si se mantiene el ritmo se hacen **del lado de Portal-Ars**, no acá. Este exportador solo manda los números crudos (`promedio_general`, 4 competencias, `actividades_calificadas`, `actividades_planeadas`) -- la fórmula (`avance_real = promedio × calificadas/planeadas`) vive en Portal-Ars.
- Archivo CSV con columnas `grado,seccion,numero_orden,materia,periodo,promedio_general,promedio_comunicativa,promedio_pensamiento_logico,promedio_civica,promedio_tecnologica,actividades_calificadas,actividades_planeadas,asist_presentes,asist_ausentes,asist_tardanzas,asist_excusados` -- sin nombre (Portal-Ars ya lo tiene, se empareja por grado+sección+número igual que el padrón).
- `guardar-csv-portal-ars` en `main.js`: mismo patrón que `backup-exportar-excel` (dialog.showSaveDialog + escribir a disco), no un download de navegador.
- **Verificado con datos reales de producción** (no sintéticos): curso "6to A FIHR", período 1, materia "Mi Materia" ya tenía calificaciones reales cargadas (6 actividades, modo multi, con `distribucion_multi`). Se replicó la función exacta en Python contra una copia de la BD real y se confirmó a mano el promedio general de un estudiante (58, verificado con la suma ponderada manual). Después se corrió la app Electron real (vía Playwright + `--user-data-dir` apuntando a otra copia) generando el archivo real desde la UI real -- el CSV resultante coincide línea por línea con el cálculo independiente en Python. La BD real (`%APPDATA%`) nunca se tocó en ningún momento de la prueba.
- **Pendiente real**: falta construir en Portal-Ars la pantalla de admin que reciba este archivo (emparejando por grado+sección+número contra `estudiantes_lista`), el cálculo de avance real/proyección, y la tarjeta nueva donde el estudiante lo vería.

### Ciclo v1.6.0 (completado — animaciones + reportes por lote)

Detalle completo en `PRD.md` § 9. Resumen:

1. **Pase de diseño con la skill `emil-design-eng`** (instalada en `.claude/skills/`, filosofía de Emil Kowalski): diagnóstico priorizado de toda la UI, después implementado en tres rondas:
   - Loading states en texto plano → spinner + fade-in del contenido.
   - Toasts de Calificaciones/Asistencia → entrada y salida animadas en vez de aparecer/desaparecer de golpe.
   - Los ~24 modales del proyecto → fade de backdrop + scale/fade del contenido al abrir y cerrar, vía hook nuevo `src/hooks/useModalTransition.js` (no cambia cuándo/por qué se abre o cierra cada modal, solo cuánto tarda en desmontarse al cerrar).
   - Semáforo del Dashboard → de `width` a `clip-path` para las barras (mejor encaje que `transform:scaleX()` al ser 3 segmentos co-dependientes).
2. **Bug de carrera encontrado al animar el semáforo**: cambiar de período varias veces seguido podía pisar los datos en pantalla con la respuesta de un período viejo llegando tarde. Corregido con un contador de solicitud más reciente en `Dashboard.jsx`.
3. **Generación de reportes por lote** (Reportes.jsx): nueva función — elegir grado + secciones (checkboxes) + período, y generar de una vez el PDF grupal de cada sección más el PDF individual de cada estudiante, todo en una carpeta con nombre descriptivo. Requirió refactorizar la generación de HTML del reporte (separada de la apertura de ventana/impresión) y agregar un IPC nuevo (`generar-reportes-lote`) que usa `webContents.printToPDF()` sobre una ventana oculta — sin diálogo por archivo. Se encontró y corrigió un bug real en pruebas (el script de auto-impresión embebido en el HTML rompía `printToPDF()`). Probado con datos reales de 6to A/B/C FIHR: 17 PDFs generados y verificados.
4. Bump versión a `1.6.0` en `package.json` (justificado: hay función nueva, no solo fixes).

### Ciclo v1.5.1 (completado — ronda de pruebas funcionales end-to-end)

Pruebas manuales/scripted end-to-end del flujo completo (calificaciones multi-competencia, reportes grupal/individual, temario, cuaderno anecdótico, dashboard/semáforo, CRUD de cursos), con datos de prueba reales creados en la BD de producción y también en BDs aisladas para casos que requerían mezclar materias. 11 bugs encontrados y corregidos — detalle completo en `PRD.md` § 8. Resumen:

1. `getReporteGrupal` no filtraba por `materia_id` (mezclaba notas de materias distintas).
2. Nota final del período distinta entre tab "Multi" de Calificaciones y Reportes (equal-weight vs ponderado por peso) — unificado a ponderado por peso.
3. Tab "Simple" de Calificaciones mal interpretaba actividades modo `multi` (y el PDF que lo usa).
4. Panel lateral "Competencias" con el mismo problema que el punto 3.
5. `abrir-archivo` (adjuntos de Temario) ignoraba errores de `shell.openPath`.
6. Import masivo de temario JSON: backend ya existía (`importTemarioJson`), se construyó la UI (vista previa + detección de duplicados) en Temario.
7. Dashboard no pasaba `materiaId` a `get-estudiantes-riesgo`/`get-semaforo-cursos`/`get-stats` (mezclaba materias).
8. `get-stats` contaba estudiantes de cursos archivados en el total.
9. Cuaderno anecdótico: tipo `'general'` (nota rápida del Espacio del curso) no estaba en `TIPOS_OBS`, se mostraba mal etiquetado.
10. Cursos: sin validación de nombre vacío (backend) ni duplicado (frontend) — agregadas.
11. Título de pestaña Cursos tenía un "TEST" pegado desde v1.2.0 — corregido.

Versión bump a `1.5.1` en `package.json` (todo el ciclo fue de fixes, sin features grandes nuevas — la única excepción es el punto 6, que completa una función que ya estaba documentada en el PRD pero nunca tuvo UI).

### Ciclo v1.5.0 (completado)

1. **Refactor completo del modo multi-competencia** (flujo invertido): el maestro ahora ingresa puntos directamente por competencia; la nota global se calcula automáticamente como suma. Elimina la ambigüedad del flujo anterior (nota global primero).
2. **Techo por competencia** (`100 ÷ n_comps`): inputs con límite dinámico, validación inmediata, bordes rojos al exceder.
3. **UI anti-confusión**: 4 slots siempre visibles, orden fijo canónico, `"—"` para competencias inactivas.
4. **Migración de nombres**: `Científica → Pensamiento Logico`, `Ética → Tecnologica`. Script idempotente ya ejecutado en BD de producción.
5. **Fix 3 bugs críticos de backup**: WAL no incluido en export, WAL no limpiado en restore, validación de techo en `setCalificacionMulti`.
6. **Scripts de mantenimiento** documentados con `README.md`.
7. **Documentación de cierre v1.5.0**: `CHANGELOG-v1.5.0.md`, `PRD.md`, `TDR.md`, `AGENTS.md`, este `HANDOVER.md`.

---

## Estado de la BD de producción

La BD en `%APPDATA%\sistema-academico-docente\sistema_docente.db` fue restaurada a un backup anterior durante las pruebas de backup/restore. Puede tener datos en estado antiguo (warnings de `Científica`/`Ética` en consola al abrir actividades multi).

**Antes de continuar hay que decidir:**

- **Opción A**: Ejecutar `migrar-nombres-competencias.py` sobre la BD actual para normalizar los nombres y eliminar los warnings.
- **Opción B**: Restaurar `backup_pre_limpieza_v15_20260608_183112.db` (estado post-migración de nombres, pre-limpieza de datos de prueba) y luego decidir si limpiar los datos de prueba.
- **Opción C**: Ejecutar `limpiar-datos-prueba.py` (borra actividades, calificaciones, temas, asistencias) para comenzar desde cero con datos reales.

Verificar con `estado-bd-actual.py` antes de decidir.

---

## Backups disponibles

Ubicación: `%APPDATA%\sistema-academico-docente\`

| Archivo | Fecha | Estado |
|---|---|---|
| `backup_pre_migracion_nombres_20260608_181441.db` | 2026-06-08 18:14 | BD con nombres Científica/Ética (antes de migración) |
| `backup_pre_limpieza_v15_20260608_183112.db` | 2026-06-08 18:31 | BD con nombres canónicos, datos de prueba presentes |

> Los backups tienen archivos `.wal`/`.shm` asociados. Verificar con `estado-bd-actual.py` antes de restaurar.

---

## Checklist de cierre v1.5.0

- [x] Refactor flujo inverso multi-competencia
- [x] Migración de nombres de competencias
- [x] UI 4 slots fijos anti-confusión
- [x] Fix bugs críticos de backup (WAL export + WAL restore)
- [x] Scripts de mantenimiento con README
- [x] Documentación de cierre (5 archivos MD en raíz)
- [ ] **Punto pendiente**: Resolver estado de la BD (ver sección anterior)
- [ ] Limpiar `/scripts` si procede (mover diagnósticos viejos ya están en `scripts/archivo/`)
- [ ] Bump versión a `1.5.0` en `package.json` *(ya está en 1.5.0 — verificar)*
- [ ] `npm run build-app` — generar `.exe`
- [ ] Probar `.exe` instalado en ubicación limpia
- [ ] `git push` + crear release `v1.5.0` en GitHub con `.exe` adjunto

---

## Checklist de cierre v1.5.1

- [x] 11 bugs encontrados y corregidos en ronda de pruebas end-to-end (ver § arriba y `PRD.md` § 8)
- [x] Bump versión a `1.5.1` en `package.json`
- [x] `PRD.md` y este `HANDOVER.md` actualizados con el resumen de fixes
- [ ] `npm run build-app` — generar `.exe`
- [ ] Probar `.exe` instalado
- [ ] Decidir si limpiar los datos de prueba de la BD antes o después de probar el instalador (ver nota abajo)
- [ ] `git push` + crear release `v1.5.1` en GitHub con `.exe` adjunto

---

## Checklist de cierre v1.6.0

- [x] Pase de animaciones con skill `emil-design-eng` (loading states, toasts, modales, semáforo) — ver `PRD.md` § 9
- [x] Bug de carrera en cambio de período del Dashboard, encontrado y corregido
- [x] Función nueva: generación de reportes por lote (Reportes.jsx + IPC `generar-reportes-lote` + bridge `preload.js`)
- [x] Probado con datos reales (6to A/B/C FIHR, P1) — 17 PDFs verificados, no solo build
- [x] Bump versión a `1.6.0` en `package.json`
- [x] `PRD.md` y este `HANDOVER.md` actualizados
- [x] Commit local del ciclo completo
- [ ] `npm run build-app` — generar `.exe`
- [ ] Probar `.exe` instalado en ubicación limpia (particularmente: el botón nuevo "Generar reporte por lote" en Reportes)
- [ ] Decidir si limpiar los datos de prueba de la BD (sigue sin tocar, a propósito — ver nota abajo)
- [ ] `git push` + crear release `v1.6.0` en GitHub con `.exe` adjunto

---

## Próximo bloque grande

### App de Orientación / Supervisor

Segunda aplicación de escritorio para el orientador o director del centro. Objetivo: recibir notas finales del maestro sin doble entrada de datos.

- Integración vía LAN (red local, sin internet)
- El padrón de estudiantes y notas finales de período se comparten entre apps
- La BD `supervisor.db` ya existe en AppData (creada en un prototipo anterior: `%APPDATA%\sistema-academico-docente\supervisor.db`)

---

## Notas para la próxima sesión

- **La BD de producción tiene datos de prueba sin limpiar, a propósito** (pendiente de decisión, no borrar todavía):
  - Curso "6to A FIHR": estudiantes `Prueba 01`–`Prueba 10` (códigos `PRUEBA-01`..`PRUEBA-10`) con calificaciones en los 4 períodos, más `TEST Estudiante A` (código `TEST-A`, solo con notas en P1).
  - Cursos `6to B FIHR` y `6to C FIHR` completos (duplicados de la estructura de 6to A), cada uno con 1 estudiante de prueba calificado.
  - Un curso "Curso Prueba Fase B TEMP" archivado (soft-delete, no aparece en ningún listado, se dejó así para no perder la evidencia de que el archivado funciona).
  - Temario y cuaderno anecdótico de prueba en 6to A / P1.
  - Decidir con el usuario si se limpia antes o después de probar el instalador de v1.5.1.
- El `.exe` de v1.6.0 aún no se ha generado / está en curso — no publicar la release hasta haber probado el instalador, en particular el botón nuevo "Generar reporte por lote" de Reportes.
- Las pruebas del lote de reportes se hicieron contra una **copia** de la BD (en un directorio temporal fuera del repo), nunca contra la BD real — los datos de prueba (`Prueba 01`–`10`, `6to B`/`6to C`, `TEST Estudiante A`) siguen intactos y sin limpiar, a propósito.
- El auto-update apunta a `NuevaAlianza/sistema-academico-docente` en GitHub. Verificar que el repo existe y tiene acceso antes del release.
- Migración de nombres de competencias (`Científica`→`Pensamiento Logico`, `Ética`→`Tecnologica`) ya fue ejecutada en la BD de producción durante el ciclo v1.5.0 — no debería haber warnings de nombres viejos.

---

## Referencias rápidas

| Qué necesito saber | Dónde mirarlo |
|---|---|
| Fórmulas de cálculo multi | `TDR.md` § 4 |
| Esquema de BD completo | `TDR.md` § 3 |
| Todos los IPC handlers | `docs/HANDOVER_v1.5.0.md` § 3.3 |
| Flujos de usuario | `docs/HANDOVER_v1.5.0.md` § 4 |
| Reglas de código | `AGENTS.md` |
| Bugs conocidos no críticos | `docs/HANDOVER_v1.5.0.md` § 10 |
