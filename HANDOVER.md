# HANDOVER.md — Estado actual del proyecto
# Sistema Académico Docente

**Versión:** 1.10.0
**Fecha:** 2026-10-28
**Estado:** v1.10.0 — curso/período activos para toda la app + registro por evidencias desde el plan (actividades, temas, tabla por evidencias, planillas, pendientes en Reportes). `.exe` generado en `release/` (verificado: versión 1.10.0 y código nuevo dentro del asar). Actualización probada sobre 3 backups de distintas épocas (sep ~1.7, 2-oct ~1.9.0, 28-oct 1.9.1), cada uno en su proceso: datos existentes idénticos fila por fila; solo se agregan tablas vacías. **Esta PC es de pruebas**; la de uso diario recibe cambios instalando el `.exe`. Antes de instalar allá: revisar si los datos del año actual quedaron sin materia (pendiente de decisión), cargar fechas de P3/P4. Pendientes viejos: rotar `service_role` de Portal-Ars, limpiar backup de prueba en Supabase, traslado de estudiantes (sin decisión). Nada pusheado desde v1.7.0.

---

## Lo último que se hizo

### Curso y período activos para toda la app (2026-10-28) — sin commit
Pedido del usuario: sin darse cuenta podía anotar asistencia/notas en 2do A (el primero de la lista) porque cada pestaña arrancaba siempre en el primer curso.
- Causa: cada página (Estudiantes, Asistencia, Calificaciones, Temario, Reportes) tenía su propio `cursoSel` que arrancaba en `cursos[0]`; el `?cursoId=` de CursoEspacio se perdía al tocar el menú. Calificaciones y Temario arrancaban además en **P1**.
- **Todos los períodos de la BD están `abierto`** (nunca se cierran), así que elegir por estado no sirve. Nuevo `periodoPorFecha()`: el período cuyas fechas contienen hoy; entre períodos, el último que ya empezó; sin fechas, el primero. **P3 y P4 del año 2 no tienen fechas** → hay que cargarlas en Configuración.
- `App.jsx`: `cursoActivoId` (guardado en config `curso_activo_id`) y `periodoActivoId` (no se guarda: al abrir la app se calcula por fecha). Hook `src/hooks/useSeleccionActiva.js` (`useCursoActivo`, `usePeriodoActivo`) usado por todas las páginas; cambiar curso/período en cualquiera cambia todas.
- `Layout.jsx`: bloque "CURSO ACTIVO" en el menú lateral con el color del curso, selector de curso y botones P1–P4 (el actual subrayado) + aviso ámbar si el período elegido no es el de hoy.
- CursoEspacio: entrar a un curso lo vuelve activo. Dashboard: clic en el semáforo de un curso abre Calificaciones **en ese curso** (antes abría el primero — bug).
- Verificado: `vite build` OK; `periodoPorFecha` probado con las fechas reales (28/10→P1, 31/10→P1, 2/11→P2, sin fechas→P1, vacío→null). **Falta**: revisión del usuario en la ventana real.

### Registro por evidencias (2026-10-28) — fases 1-3 hechas, sin commit
- BD (`migrarTablas`): `actividad_evidencias` (actividad, competencia, nombre, sesión, instrumento, puntos, orden) y `evidencia_puntos` (evidencia, estudiante, puntos). Aplicado a la BD real; backup previo `backup_pre_evidencias_20261028_122226.db`.
- `database.js`: `leerPlanEvaluacion` (plan.json o web.json; grupo 1 Com, 2 PL, 3 Tec, 4 Cív; pesos 10-15-20-15-15-25 si son 6 semanas; tipo: última = Proyecto, semana de integración = Exposicion), `prepararPlanEvaluacion` (vista previa; sin archivo busca `plan_periodo` en los temas), `crearActividadesDesdePlan` (idempotente por nombre, vincula al tema de la semana), `setPuntosEvidencia`, `cerrarPendientesEvidencias`, `getEvidenciasActividad`, `getPlanillaEvidencias`. `getActividades` trae `n_evidencias`; `deleteActividad` borra evidencias; `duplicarActividades` las copia (sin puntos). El import de Portal-Ars ahora guarda `plan_periodo`.
- La nota se deriva de las evidencias y se escribe en `calificaciones` como si fuera a mano (simple 0-100; multi por competencia sobre 100/n, 1 decimal). **No cambian las fórmulas.** Falta una evidencia → `nota=NULL` (pendiente, no cuenta). Nota escrita a mano sin evidencias anotadas = "directa", no se toca (ni con "Pendientes → 0").
- UI: Calificaciones → "📋 Crear desde el plan" (modal con vista previa, pesos editables, bloquea si el total pasa de 100, avisa grado/período distintos y actividades viejas), etiqueta "📋 N evidencias" en tarjetas, `src/components/RegistroEvidencias.jsx` (tabla por evidencia, Enter/↓ baja, valida máximo, estados, chips de grupo, "Pendientes → 0", "Notas directas"), planillas en blanco/llena por semana y por período (`src/reportes/planillaEvidencias.js`, A4 horizontal).
- Verificado: 61/61 pruebas backend sobre copia de la BD real (los 16 planes coinciden con sus `distribucion_sistema_docente.md`, conversiones, pendientes, validaciones, duplicar/borrar, datos existentes intactos); planillas renderizadas con Electron a PDF (período: guía + cuadrícula de 25 estudiantes en una hoja; semana: una hoja); `vite build` OK. **Falta**: prueba del usuario en la ventana real.
- **Temas (pedido tras probar)**: "Crear desde el plan" ahora también crea en el Temario los temas de las semanas que falten (desde el `web.json`; si se abre el `plan.json`, se toma el `web.json` de la misma carpeta) en el mismo curso/período/materia, y vincula S1↔tema 1… Reutiliza un tema existente por `meta.semana` o mismo título. Si las actividades ya existían sin tema, solo crea los temas y las vincula (no toca notas). Nunca borra ni reemplaza temas viejos. `metaTemaPortalArs()` compartido con el import de Portal-Ars. 18/18 pruebas sobre copia (incluye 5to A P2 del usuario: 0 actividades, 6 temas, 6 vínculos; temas viejos con materia NULL intactos).
- **Esta PC es de pruebas** (usuario, 2026-10-28): la BD real está en la PC de trabajo y recibe cambios solo instalando una versión nueva. Los arreglos de datos (materia NULL, temas del plan viejo) deben ir dentro de la app (seguros, sin borrar) o como script para correr allá.
- **Ojo P1 del año actual**: ya tiene 6 actividades reales (distribución vieja, notas en S1, `materia_id` NULL). Estrenar en **P2**. El problema de materia NULL sigue pendiente de decisión.
- **Fase 4 Reportes (2026-10-28, sin commit)**: `_seguimientoEvidencias` / `_evidenciasDeEstudiante` en `database.js`. Una semana es "iniciada" cuando tiene algún punto anotado; solo ahí lo que falta cuenta como pendiente (las semanas futuras no aparecen como deuda). `getReporteGrupal` agrega `evidencias_pendientes` por estudiante y `evidencias: { hay, semanas_iniciadas }`; `getReporteIndividual` agrega `evidencias: { semanas, pendientes }`. UI: tarjeta "📋 Evidencias pendientes" en el grupal (clic → individual), "Evidencias por semana" en el individual, indicador "N evidencias pendientes". Plantillas: sección de pendientes en el grupal impreso, detalle por semana en el individual impreso; el lote lo hereda (indicador + documentos embebidos). Promedios sin cambios. 16/16 pruebas sobre copia + PDFs revisados.
- Después: Excel, recuperación, editar evidencias de una actividad a mano.

### Antes: análisis del Registro por evidencias
Fuente: `C:\Users\leone\Documents\referencia-6to\<grado>\P<n>\plan.json` (`evaluacion.grupos[].evidencias` con sesión, instrumento, puntos) y `distribucion_sistema_docente.md` (reparto 10-15-20-15-15-25, una actividad por semana, grupo 3 = Tecnológica, grupo 4 = Cívica). El `web.json` de la semana 1 trae lo mismo en `detalle.plan_periodo.evaluacion`, pero `importClasesPortalArs` **lo descarta** (no guarda `plan_periodo`).
Idea acordada: crear las 6 actividades desde el plan (con vista previa) + anotar puntos crudos por evidencia (16/20) y que la app convierta a la distribución multi existente (sin tocar fórmulas) + imprimir planilla en blanco/llena.
Decisiones del usuario: evidencia vacía = **pendiente** (no 0); impresión **por semana y por período**. Pendiente preguntar: rúbrica por niveles o puntaje directo.

### Release v1.9.1 (2026-10-05) — reporte por lote → un solo HTML interactivo
Pedido del usuario: en vez de una carpeta con un PDF por estudiante, un archivo para enviar al supervisor donde se pueda buscar/filtrar quién va bien y quién va flojo, y desde ahí sacar el PDF de un estudiante (p. ej. para un padre). Cuidar la estética del programa.
- Plantillas movidas a `src/reportes/plantillasHTML.js` (`construirHTMLGrupal`, `construirHTMLIndividual`, `construirHTMLLote`, `escapeHtml`, `slug`). El PDF individual/grupal desde el programa usa las mismas plantillas, así todo se ve igual.
- El lote ahora arma un `.html` autocontenido (sin dependencias, funciona offline con doble clic): tarjetas Estudiantes / Van bien / Límite / En riesgo / Sin calificar (clic = filtro) + promedio general, chips por sección, búsqueda por nombre o número, orden, lista + visor del reporte (iframe `srcdoc`), ‹ › y ↑/↓, botón "Imprimir / Guardar PDF" (y Ctrl+P) que imprime solo el reporte abierto. Responsive para celular.
- "En riesgo" = mismo `en_riesgo` de `getReporteGrupal`; "Límite" = promedio entre mínimo y semáforo verde. Los colores de promedio/asistencia en la lista usan los mismos cortes que los reportes.
- **Lista filtrada (pedido tras probar)**: al filtrar (tarjeta de estado o búsqueda) aparece "📋 Lista filtrada (N)" arriba de la lista y el visor la muestra con el diseño del grupal (sección, promedio, asistencia, ausencias, indicador + tarjetas de la lista). "Imprimir" imprime solo esa lista; "🖨️ Reportes individuales (N)" imprime en un solo documento el reporte de cada estudiante filtrado, uno por página. Verificado sobre 6to P1 con los datos de prueba: 36 en riesgo (15/8/13, igual que `getReporteGrupal`), lista de B = 8 filas, impresión combinada = 8 páginas.
- Casilla "Incluir cuaderno anecdótico" en el modal (desmarcada por defecto): en un archivo compartido todos ven a todos.
- Todo texto libre (nombres, temas, observaciones) ahora se escapa — antes un `<` rompía el reporte.
- `main.js`: `generar-reportes-lote` (printToPDF por estudiante) reemplazado por `guardar-reporte-html` (diálogo Guardar). Toast con "🌐 Abrir reporte".
- Verificado con datos de una copia de la BD real (6to A+B, P3, 68 estudiantes, ~370 KB; 121 estudiantes ≈ 615 KB): conteo en riesgo del visor = resumen grupal (A 14, B 18), filtros/búsqueda/orden/navegación, escape con nombre `</script><b>…` y observación con `<img onerror>`, imprimir y Ctrl+P llegan al reporte abierto; probado también con la plantilla minificada (como queda en el `.exe`). `vite build` OK. **Falta**: que el usuario pruebe el modal en la app real (`npm run dev`).
- **Hallazgo — datos del año actual sin materia (BD de esta PC)**: en el año 2 todo lo de 6to (temas de P1, actividades, asistencias) tiene `materia_id` NULL; con F.I.H.R (id 2) seleccionada, Temario/Calificaciones/Asistencia/Reportes filtran por `materia_id=2` y no lo muestran. Causa probable: el bug de v1.8.2 (año creado sin materia → todo se guardó sin materia; luego se creó F.I.H.R). Puede estar igual en la PC del trabajo. **No corregido** — pendiente de decisión: migrar NULL→materia del año (con backup). Ojo: `materia_activa_id` en configuración apunta a la materia 1 (año 1).
- **Datos de prueba sembrados en la BD real (2026-10-05)** con `scripts/sembrar-prueba-reportes.js` para revisar el reporte: 6to A/B/C, P1, F.I.H.R → 24 temas, 15 actividades (370 notas), 656 asistencias (solo días sin registro), 15 observaciones `[Prueba]`. Backup previo `backup_pre_migracion_nombres_20261005_180101.db`. Borrar con `--limpiar` (registro en `AppData\sistema-academico-docente\datos_prueba_reportes.json`). Probado antes en copia: datos existentes intactos (conteos y sumas de control iguales), segunda corrida rechazada, `--limpiar` deja la BD idéntica.

### Release v1.9.0 (2026-10-02)
Incluye todo lo de abajo de esta fecha más dos cambios pedidos tras probar:
- **Puntos solo dentro de un tema abierto**: `addParticipaciones` exige `temaId` de un tema `pendiente`/`aplazado` del mismo curso+período+materia; Clase de hoy oculta −/+/± y "+1 al grupo" sin tema y muestra aviso 🔒. Motivo (usuario): que el conteo por tema sea exacto y nadie pueda dar puntos con el período cerrado. Probado 10/10 sobre copia de la BD real.
- **Número de lista único por curso** (entre activos; 0 = sin número): `numeroListaOcupado` en `createEstudiante`/`updateEstudiante`, incluye reactivar. Cada sección tiene su propia numeración (confirmado con el usuario). Probado 9/9 sobre copia; la BD real no tenía duplicados.
- Analizado y **no construido** (pendiente de decisión del usuario): traslado de estudiante entre secciones. Recomendación: no cambiar `curso_id` (oculta notas/asistencia/participación de A y choca números); usar Retirar+Agregar (ya existe) o un "Trasladar a…" asistido (estado `trasladado`, columna `trasladado_de`, copia de notas del período por nombre de actividad con vista previa, sin tocar fórmulas). Preguntado al usuario: frecuencia y si las notas deben acompañarlo.

### Participación por fase + vínculo actividad↔tema (2026-10-02) — incluido en v1.9.0
Pedido del usuario: saber en qué momento de la clase se ganaron los puntos de participación y poder verlos al calificar la actividad correspondiente, sin que se sumen a la nota.
- **Fase**: columna `participaciones.fase` (`'I'|'D'|'C'|NULL`, vía `migrarTablas()`). En CursoEspacio → popup "±", chips opcionales Inicio/Desarrollo/Cierre, solo si el tema del día tiene plan de clase (`meta_json.actividades`). Los botones rápidos −1/+1/+1 grupo no piden fase. El historial muestra la fase.
- **Vínculo actividad↔tema**: tabla nueva `actividad_temas (actividad_id, tema_id)` con FK cascade + borrado explícito en `deleteActividad`/`deleteTema`. `setActividadTemas` solo acepta temas del mismo curso+período+materia. `createActividad`/`updateActividad` solo tocan el vínculo si reciben `temaIds` (otros llamadores no lo pisan). En el modal de actividad de Calificaciones: checkboxes "Temas que evalúa" (opcional).
- **Vista al calificar**: `getParticipacionActividad(actId)` → por estudiante, suma de puntos con `tema_id` en los temas vinculados + total del período. Columna "✋ Particip." al final (simple y multi, sin mover las 4 competencias): vinculada → `actividad / período` (0 si no hubo puntos); sin vínculo → total del período con aviso. Clic abre el historial con los movimientos de esos temas resaltados. Nunca toca `calificaciones`.
- **Decisión de diseño (confirmada con el usuario)**: se vincula por tema, no por rango de fechas entre actividades — las fechas de actividad suelen quedar vacías y cada punto ya se guarda con el `tema_id` del día. El vínculo se hace al crear/editar la actividad, no al crear el tema.
- Componente compartido nuevo `src/components/HistorialParticipacion.jsx` (usado por CursoEspacio y Calificaciones; exporta `FASES`, `fmtPts`, `colorPts`).
- **Verificado**: backup `backup_pre_migracion_nombres_20261002_182158.db` antes de empezar; 24/24 pruebas del backend contra copia de la BD real (fase, validación de temas ajenos, suma igual a SQL independiente, limpieza al borrar, `initialize()` repetido); `vite build`; migración aplicada a la BD real al abrir `npm run dev` con las 8 participaciones previas intactas; revisado por el usuario en la ventana real (6to A, actividad 1 vinculada al tema 1 → `0 / +1`, actividades sin vínculo → total del período).
- **Dato de la BD de esta PC**: en 6to A P1 el tema 6 (La Pascua) está `pendiente` mientras el 7 está `realizado`, por eso "Clase de hoy" sigue en La Pascua y todos los puntos están en ese tema.
- Pendiente: instalar el `.exe` de v1.9.0 en la PC de trabajo y probar; `git push` + release en GitHub cuando el usuario lo pida.

### Fix: modal Clonar en Temario (2026-10-02) — commit `c4393fc`
Con muchos cursos, la lista de destino empujaba Cancelar/Clonar fuera de la pantalla. Mismo patrón que el modal Archivos (`maxHeight: 80vh`, lista con scroll). Solo estilos.

### Fix: año escolar nuevo quedaba sin materia (2026-09-24) — v1.8.2, commiteado
Reportado por el usuario: en la PC de trabajo, después de crear un año escolar nuevo desde Configuración, no podía editar "Mis Materias" (aparecía vacío) y la función de participación/puntos pedía "selecciona una materia" sin ninguna forma de hacerlo. Reproducido contra una copia de la BD real: `createAnio()` en `database.js` creaba los 4 períodos del año nuevo pero nunca una materia ni actualizaba `materia_activa_id` (a diferencia del seed inicial, que sí lo hace). Con `materias` vacío, el botón "+" del header para agregar una también se ocultaba (`Layout.jsx`, condicionado a `materias.length > 0`) — sin salida desde la UI.
- Fix: `createAnio()` ahora crea una materia por defecto ("Mi Materia") para el año nuevo y la marca activa, igual que el seed inicial.
- Fix: el botón "+" del header ya no depende de que exista al menos una materia — se muestra siempre que haya año activo y <3 materias, como red de seguridad si esto vuelve a pasar por otra causa.
- Verificado con `vite build` + script contra copia aislada de la BD real (simulando exactamente "Crear nuevo año escolar"): antes del fix, año nuevo quedaba con `materias: []`; después, con la materia creada y `materia_activa_id` apuntando a ella.
- **Hallazgo aparte durante el diagnóstico**: la app instalada en `C:\Users\leone\AppData\Local\Programs\sistema-academico-docente` estaba en **v1.5.1** (build de julio), mientras el código local ya iba en v1.8.1 — le faltaban completas v1.6.0 (animaciones, reportes por lote), v1.7.0 (Portal-Ars, backup en la nube) y v1.8.0 (grupos de trabajo). Confirmado inspeccionando el `package.json` embebido en el `app.asar` instalado. Esto no aplica a la PC de trabajo del usuario (esa ya tenía v1.8.1), pero es la explicación para cualquier otra máquina con el instalador viejo.

### Participación por grupo en Cursos (2026-09-21) — v1.8.1, commiteado, sin push, probada (25/25 pruebas sobre copia de la BD real + prueba manual del usuario)
Tabla nueva `participaciones` (eventos +/- por estudiante, con fecha, motivo, período, materia, tema del día). Es solo indicador: no toca `calificaciones`. En `CursoEspacio` → "Clase de hoy": filtro por grupo, botones −/+ por estudiante, "±" (cantidad libre + motivo, p. ej. mala práctica), "+1 al grupo", ↶ deshacer el último de hoy. Pestaña "Estado": columnas Grupo y Participación (acumulado del período) + filtro por grupo. IPC: `add-participaciones`, `deshacer-participacion`, `get-participacion-resumen`, `get-historial-participacion`. Estado: clic en la participación abre el historial (fecha, puntos, motivo, tema). Hecho en la BD de prueba: temas de 6to A clonados a 6to B/C (P1-P4, con backup) y 11 estudiantes de prueba por curso con grupos G1-G3. Pendiente: `git push`, generar `.exe` (parar `npm run dev` antes) y decidir si Estado muestra desglose por competencia multi.

### Grupos de trabajo para entrada de notas (2026-09-20) — v1.8.0, commiteado, sin push
Forma alternativa de ver/colocar notas por grupo del cuaderno (5-6 integrantes). Es solo un filtro de vista: las notas siguen en las mismas tablas y se guardan por los mismos caminos (`set-calificacion` / `set-calificacion-multi`), así la vista completa y la de grupo siempre coinciden.
- BD: columna `estudiantes.grupo_trabajo INTEGER` (NULL = sin grupo, fijo todo el año) vía `migrarTablas()`. Métodos en `database.js`: `setGrupoEstudiante`, `asignarGrupos(cursoId, items, reemplazar)`, `quitarGruposCurso`. IPC: `set-grupo-estudiante`, `asignar-grupos`, `quitar-grupos-curso`.
- `Estudiantes.jsx`: columna Grupo (select por estudiante) + botón "👥 Grupos" (texto `G1: 3, 7, 12`, rangos `10-15`; modo "Agregar/actualizar" o "Reemplazar todo"; "Quitar todos"). Editar/retirar un estudiante no borra su grupo.
- `Calificaciones.jsx`: chips `Todos · G1… · Sin grupo` (con progreso hechos/total) sobre la lista de notas simple y multi; solo aparecen si el curso tiene grupos. Totales/promedios del pie siguen siendo de todo el curso.
- Verificado con scripts contra BD aislada (asignar, mover, sacar, reemplazar, conflictos, aislamiento entre cursos, idempotencia, notas/resúmenes multi idénticos antes y después) + `vite build`. UI revisada por el usuario en la ventana real (6to A FIHR, 3 grupos de 4) y notas probadas en las 6 actividades del período 3 (72 escrituras por grupo, vista Todos coincide, grupos ajenos intactos, exceder techo rechazado). Los grupos de la BD de esta PC son de prueba; en la PC real hay que crearlos con "👥 Grupos". La columna se crea sola al abrir la app.

### Clases desde Portal-Ars + backup en la nube (2026-09-17)

**Motivación:** Portal-Ars ya tiene el contenido semanal de clases (`clases_contenido`) y el maestro quería poder traerlo a Temario sin duplicar el trabajo de cargarlo dos veces, además de una forma de no perder toda la información si el equipo se daña o se pierde (hasta ahora el backup era 100% local). Se agregaron dos piezas, ambas siguiendo el patrón ya establecido de intercambio por archivo/RPC puntual, sin sync en vivo de fondo.

**1) Clases semana a semana (Temario ← Portal-Ars), con dos caminos a propósito (pedido explícito: "da opciones")**
- Portal-Ars (`js/admin.js`): botón "📤 Exportar JSON" en Contenido, reverso exacto del import que ya existía — respeta los filtros de grado/período ya aplicados en pantalla.
- sistema-docente: `importClasesPortalArs` nuevo en `electron/database.js` — a diferencia de `importTemarioJson` (que nunca guardaba el `contenido` de la semana), este preserva tanto el `contenido`/`texto_ampliado` como todo el `detalle` (rúbrica, texto bíblico, materiales, actividades, actividades_cuaderno, classroom_txt, etc.) en `meta_json`, para no perder nada de lo que ya tiene Portal-Ars.
- Dos IPC nuevos (`import-clases-portal-ars-json`, `descargar-clases-portal-ars`) y un botón nuevo "🌐 Traer de Portal-Ars" en `Temario.jsx`, junto al de importar archivo — ambos caminos comparten el mismo modal de vista previa (detección automática de shape: array plano de Portal-Ars vs. el `{periodos:[...]}` que ya existía). La descarga directa reusa `admin_login` + `admin_listar_contenido`, las mismas RPCs que ya usa el admin de Portal-Ars — no hizo falta ninguna RPC nueva de lectura del otro lado.
- **Verificado con datos reales de prueba** (no solo build): script contra una copia aislada de la BD confirmando matcheo de período, detección de duplicados (2da pasada con las mismas filas → 0 nuevos, 2 omitidos), y que `contenido_texto` + los 17 campos de `meta_json` (incluida rúbrica y texto bíblico) se guardan completos.

**2) Backup en la nube (Portal-Ars, Supabase Storage)**
- Nuevo campo "PIN de administrador" en Configuración → Portal-Ars (mismo PIN que ya usa el admin humano de ese sistema).
- `TANDA_26_BACKUPS_DOCENTE.sql` (Portal-Ars): bucket privado `backups-docente`, `service_role` key guardado en Supabase Vault (nunca expuesto al cliente), y 2 RPCs `SECURITY DEFINER` (`admin_backup_subir_url`, `admin_backup_descargar_url`) gateadas por el mismo `admin_autorizado(p_pin_hash)` que el resto del proyecto — devuelven signed URLs de Storage, el cliente sube/descarga directo sin pasar los bytes por Postgres.
- sistema-docente: cifrado AES-256-GCM con `node:crypto` (sin dependencias nuevas) en `electron/main.js`, `getOrCrearInstalacionId` en `database.js` (UUID estable por instalación, es la llave del archivo en la nube), y sección "☁️ Backup en la nube" en `Backup.jsx` (subir/restaurar, pide contraseña, advierte que sin ella el backup no se puede recuperar). `_restaurarArchivoBD` se extrajo como función compartida para que el restore manual y el restore desde la nube usen exactamente el mismo camino (cerrar conexión, limpiar `.wal`/`.shm`, copiar, reabrir).
- Política confirmada con el usuario: **una sola copia por maestro** (cada subida reemplaza la anterior en la misma ruta) — logrado borrando el objeto anterior antes de generar la signed URL de subida, porque el parámetro `upsert` de la Storage API no se estaba respetando en pruebas reales (el token firmado siempre traía `upsert:false` sin importar lo que se mandara).
- **Verificado de punta a punta, dos niveles:**
  - Contra el Supabase real (vía `curl` directo a las signed URLs, sin pasar por la app): subida → descarga → contenido idéntico; segunda subida con contenido distinto → descarga trae la versión nueva, no la vieja (confirma "una sola copia").
  - Contra la app real (`npm run dev`, con datos de prueba del maestro, no producción real de un tercero): Configuración con el PIN guardado → "Subir backup a la nube" → toast de éxito → "Restaurar desde la nube" con la misma contraseña → toast de éxito → reinicio de la app → cursos y estudiantes intactos.
- **Incidente durante la configuración (ya resuelto):** al cargar el `service_role` key en Vault se invirtieron los argumentos de `vault.create_secret` la primera vez, lo que además expuso el key real en el chat de esta sesión. Se corrigió el orden y **se recomendó al usuario regenerar el `service_role` key** desde el dashboard de Supabase por las dudas — confirmar en la próxima sesión si ya se hizo.

### Integración con Portal-Ars — completa en ambos repos, pusheada, sin bump de versión

**Estado final (2026-08-30): las 3 piezas de esta integración están terminadas, probadas de punta a punta contra datos/Supabase reales (incluida una prueba de volumen con 240 filas reales), y pusheadas.** Lado sistema-docente: commits `ca969ba` (padrón) + `d475b83` (export) + `4abb6a8` (docs) en `origin/main`. Lado Portal-Ars (repo separado `NuevaAlianza/Portal-Ars`): commits `1e6906c` (RPCs + pantalla admin + tarjeta del estudiante), `f0a3827` (pulido visual de competencias), `6b0365f` (gestión ver/ocultar/eliminar — faltaba en la versión original, se agregó a pedido), y `eec5655` (filtros + colapso por grupo en el listado) en su `origin/main` — ver la memoria de esa sesión (`project_sync_sistema_docente.md`) para el detalle completo del lado Portal-Ars.

**Prueba de volumen (solo del lado Portal-Ars, no requirió ningún cambio acá):** se generó un archivo de 240 filas (60 estudiantes de prueba reales × 2 materias × 2 períodos, mismo formato que exporta este sistema) y se cargó contra Supabase real — 240/240 emparejadas y guardadas, 72 grupos generados, listado renderizado en 5ms con todo colapsado por defecto, filtros por grado/período reduciendo correctamente la cantidad de grupos visibles (72→12 por grado, 72→36 por período). Confirma que el listado con filtros aguanta bien un volumen realista de fin de período. Los 240 registros de prueba se eliminaron después, sin dejar nada en la base real.

**Lo que falta para que esto sea usable por el maestro en su PC**: nada de código — falta el empaquetado. `npm run build-app` para generar el `.exe` y publicar un release en GitHub. **No se hizo en esta sesión a propósito** — el usuario prefirió no bumpear versión hasta confirmar que todo el flujo funciona (ver AGENTS.md: "no actualizar la versión en package.json hasta que el usuario confirme que está listo"). Cuando se retome: decidir el número de versión (¿1.7.0? hay 2 features nuevas, no solo fixes) y seguir el checklist de cierre de un ciclo normal (ver checklists de v1.5.x/v1.6.0 abajo como plantilla).

**Confirmado con el usuario, no re-litigar**: el "Promedio de tu sección" que ve el estudiante en Portal-Ars (Tanda 19 de ese proyecto) y el reporte del maestro de esta integración son y deben seguir siendo **números independientes** — no se mezclan. Miden cosas distintas (exámenes del portal vs. evaluación diaria del maestro).

### Importación de padrón completo por grado+sección (pusheado, commit `ca969ba`)

Contexto: se está evaluando compartir el padrón de estudiantes con Portal-Ars (portal web separado de la misma institución, Supabase). En vez de una sincronización en vivo (rompería el diseño 100% offline de esta app), se acordó un archivo compartido que cualquiera de los dos sistemas puede generar/consumir.

- Nuevo botón "📥 Importar padrón completo" en Estudiantes, bajo la lista de cursos (a diferencia del import existente, que es por curso, este es para todo el año escolar de una vez).
- Archivo requerido: columnas `grado, seccion, numero_orden, nombre` — filas sin alguno de esos 4 datos se descartan y se informan como inválidas, no se adivinan.
- `previewImportPadron`/`confirmarImportPadron` en `database.js` + `abrir-archivo-padron`/`preview-import-padron`/`confirmar-import-padron` en `main.js` — agrupa por grado+sección, empareja contra `cursos` activos del año (`WHERE estado='activo'`, nunca reutiliza uno archivado), y dentro de cada curso empareja estudiante por `numero_lista` (no por nombre, a diferencia del import existente) — actualiza el nombre si cambió, inserta si es nuevo, no toca nada si ya coincide.
- Un grupo grado+sección sin curso existente **no se crea solo** — aparece en la vista previa con un checkbox "Crear curso" que el maestro tiene que marcar a propósito; si no lo marca, se omite sin tocar nada (se puede reintentar después con un archivo corregido).
- **Verificado (no solo build)**: se copió `sistema_docente.db` real a un directorio temporal fuera del repo y se replicó la lógica exacta de `previewImportPadron`/`confirmarImportPadron` en Python contra esa copia (no se tocó la BD real en ningún momento) — casos probados: fila igual a lo existente (sin cambios), fila con nombre distinto en el mismo número de lista (actualiza), número de lista nuevo (inserta), grupo sin curso sin marcar crear (se omite, no crea nada), mismo grupo confirmando crear (crea el curso y el estudiante), y correr el mismo archivo una tercera vez completa (todo queda en "sin cambios" — confirma que es seguro repetir la importación). `npx vite build` corrido para confirmar que el JSX nuevo compila sin errores.

### Exportar promedio de período + asistencia para Portal-Ars (pusheado, commit `d475b83`)

Segunda parte de la integración con Portal-Ars, en sentido contrario al padrón: acá sistema-docente genera el archivo (nunca lo recibe). Pensado para que el estudiante vea en Portal-Ars el promedio del maestro (no solo sus notas de examen del portal) y su asistencia — datos que hoy Portal-Ars no tiene en absoluto.

- Botón nuevo "📤 Exportar para Portal-Ars" en Reportes, junto a "Generar reporte por lote" — mismo patrón de modal (grado + checkboxes de secciones + período), más un campo nuevo: "¿Cuántas actividades en total vas a calificar este período?" (el maestro lo escribe a mano; el sistema no tiene forma de saber cuántas actividades se van a crear a futuro, solo cuántas existen ya).
- `getExportPortalArs(cursoId, periodoId, materiaId)` en `database.js`: promedio general (igual fórmula que `getReporteGrupal`), desglose de las 4 competencias (misma fórmula de `getReporteIndividual`, simple/multi -- **duplicada a propósito** en vez de refactorizar esa función ya en uso por los PDFs, para no arriesgar una regresión ahí), conteo de `actividades_calificadas` (cuántas actividades del curso+período+materia ya tienen al menos una nota cargada, sin importar de qué estudiante), y asistencia acumulada del curso (la tabla `asistencias` no tiene `periodo_id` -- misma limitación que ya tenía `getReporteGrupal`, no es nueva).
- **Decisión de diseño importante, confirmada con el usuario**: el cálculo de "avance real del período" (ej. un 90 de promedio con solo 2 de 6 actividades hechas equivale a un ~30 de avance real, no un 90) y la "proyección estimada" si se mantiene el ritmo se hacen **del lado de Portal-Ars**, no acá. Este exportador solo manda los números crudos (`promedio_general`, 4 competencias, `actividades_calificadas`, `actividades_planeadas`) -- la fórmula (`avance_real = promedio × calificadas/planeadas`) vive en Portal-Ars.
- Archivo CSV con columnas `grado,seccion,numero_orden,materia,periodo,promedio_general,promedio_comunicativa,promedio_pensamiento_logico,promedio_civica,promedio_tecnologica,actividades_calificadas,actividades_planeadas,asist_presentes,asist_ausentes,asist_tardanzas,asist_excusados` -- sin nombre (Portal-Ars ya lo tiene, se empareja por grado+sección+número igual que el padrón).
- `guardar-csv-portal-ars` en `main.js`: mismo patrón que `backup-exportar-excel` (dialog.showSaveDialog + escribir a disco), no un download de navegador.
- **Verificado con datos reales de producción** (no sintéticos): curso "6to A FIHR", período 1, materia "Mi Materia" ya tenía calificaciones reales cargadas (6 actividades, modo multi, con `distribucion_multi`). Se replicó la función exacta en Python contra una copia de la BD real y se confirmó a mano el promedio general de un estudiante (58, verificado con la suma ponderada manual). Después se corrió la app Electron real (vía Playwright + `--user-data-dir` apuntando a otra copia) generando el archivo real desde la UI real -- el CSV resultante coincide línea por línea con el cálculo independiente en Python. La BD real (`%APPDATA%`) nunca se tocó en ningún momento de la prueba.
- **Del lado de Portal-Ars** (ya construido y pusheado, commit `1e6906c` de ese repo): pantalla de admin que recibe este archivo (empareja por grado+sección+número contra `estudiantes_lista`, nunca crea estudiantes), tabla `reportes_maestro` con upsert por estudiante+materia+periodo (sin historial, decisión confirmada), y una tarjeta nueva en "Mis notas" del estudiante con el cálculo de avance real (`promedio × actividades_calificadas/actividades_planeadas`) y proyección — ese cálculo vive ahí, no acá. Probado con un curso completo (varios estudiantes, notas y asistencia variadas) y con un estudiante de competencias desbalanceadas a propósito, ambos vía la app Electron real contra copias sandbox + el Portal-Ars real.

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

## Checklist de cierre v1.8.0

- [x] Grupos de trabajo + filtro en Calificaciones, probado en datos y en la ventana real
- [x] Bump versión a `1.8.0` en `package.json` + `CHANGELOG.md`
- [x] Commit local
- [ ] `npm run build-app` — generar `.exe` (parar `npm run dev` antes)
- [ ] Instalar en la PC real, crear los grupos con "👥 Grupos" y probar una actividad multi
- [ ] `git push` + release `v1.8.0` en GitHub con `.exe` adjunto (pendiente que el usuario lo pida)

---

## Checklist de cierre v1.7.0

- [x] Clases desde Portal-Ars: importar archivo + descarga directa, ambas al mismo modal de vista previa de Temario
- [x] Backup en la nube: cifrado AES-256-GCM, subida/restauración, "una sola copia por maestro"
- [x] `TANDA_26_BACKUPS_DOCENTE.sql` corrida contra el Supabase real de Portal-Ars (bucket + Vault + 2 RPCs)
- [x] Probado con datos reales — script contra copia de BD (Feature A), `curl` directo contra Supabase (Feature B backend), y ciclo subir/restaurar completo en la app real (Feature B end-to-end)
- [x] Bump versión a `1.7.0` en `package.json` + `CHANGELOG.md`
- [x] Este `HANDOVER.md` actualizado
- [ ] Commit local del ciclo completo (sistema-docente + Portal-Ars, repos separados)
- [ ] Confirmar que el usuario ya rotó el `service_role` key de Portal-Ars (quedó expuesto en el chat durante la configuración de Vault — ver detalle arriba)
- [ ] Limpiar los datos de prueba en Supabase (`docentes_backups` + objeto `prueba-instalacion-1.enc` en el bucket) si no se hizo ya
- [ ] `npm run build-app` — generar `.exe`
- [ ] Probar `.exe` instalado en ubicación limpia (particularmente: los botones nuevos de Temario y Backup)
- [ ] `git push` (ambos repos) + crear release `v1.7.0` en GitHub con `.exe` adjunto

---

## Próximo bloque grande

### App de Orientación / Supervisor

Segunda aplicación de escritorio para el orientador o director del centro. Objetivo: recibir notas finales del maestro sin doble entrada de datos.

- Integración vía LAN (red local, sin internet)
- El padrón de estudiantes y notas finales de período se comparten entre apps
- La BD `supervisor.db` ya existe en AppData (creada en un prototipo anterior: `%APPDATA%\sistema-academico-docente\supervisor.db`)

---

## Notas para la próxima sesión

- **Pendiente de confirmar: ¿ya se rotó el `service_role` key de Portal-Ars?** Quedó expuesto en el chat durante la configuración de Vault de esta sesión (orden de argumentos invertido en `vault.create_secret`). Se recomendó regenerarlo desde el dashboard de Supabase y volver a guardarlo en Vault — si no se hizo todavía, hacerlo antes de confiar en el backup en la nube para datos reales.
- **Pendiente: limpiar `docentes_backups`/`prueba-instalacion-1.enc`** en Supabase, datos de la prueba end-to-end de esta sesión.
- **Integración con Portal-Ars completa y pusheada (`ca969ba`, `d475b83`, `4abb6a8`), pero sin `.exe` ni bump de versión** — ver sección de arriba. Antes de generar el instalador, probar con un roster real (no de prueba) una vez que el curso tenga estudiantes reales cargados — hoy "6to A FIHR" solo tiene estudiantes de prueba (ver punto siguiente).
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
