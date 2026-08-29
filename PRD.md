# PRD — Product Requirements Document
# Sistema Académico Docente

**Versión:** 1.6.0  
**Fecha:** 2026-07-30  
**Estado:** Producción

---

## 1. Resumen del producto

Sistema Académico Docente es una aplicación de escritorio Windows para que un maestro lleve de forma completamente offline el seguimiento académico de sus cursos: calificaciones, asistencia, temario y reportes.

No requiere internet, servidor ni cuenta de usuario. Todos los datos se almacenan en un único archivo SQLite local en la PC del maestro. La distribución es un instalador `.exe` auto-actualizable vía GitHub Releases.

---

## 2. Usuarios objetivo

- **Perfil**: maestros de educación básica y media en República Dominicana.
- **Contexto de uso**: PC personal, sin red confiable, trabajando solos (no hay multi-usuario).
- **Expectativas técnicas bajas**: el maestro no es técnico. La app debe funcionar sin configuración y con flujos predecibles.
- **Un único usuario por instalación**: no hay roles, contraseñas ni sincronización.

---

## 3. Módulos principales

### Dashboard
Vista general del estado del año escolar activo. Muestra conteo de cursos y estudiantes, estado de temas (realizados / pendientes / aplazados / tarea) y lista de estudiantes en riesgo. Semáforo por curso con distribución verde / ámbar / rojo por período.

### Horario
Grilla visual de días × bloques (lunes–viernes). El maestro asigna un curso + materia a cada celda. Permite filtrar por materia.

### Cursos
CRUD de cursos del año activo (nombre, grado, sección, color) — nombre obligatorio y sin duplicados exactos dentro del mismo año, validado en frontend y backend. "Eliminar" es soft-delete (el curso y sus datos históricos quedan en la BD, solo deja de listarse). Cada curso tiene un **Espacio** privado con nota rápida libre, anotaciones con fecha e historial de promedios por período.

### Estudiantes
Padrón de alumnos por curso: CRUD manual o importación masiva desde Excel/CSV (columnas nombre/código/número, se importa dentro del curso ya seleccionado). Cuaderno de observaciones por estudiante (5 tipos: académico, conducta, familiar, salud, nota rápida) — se agrega desde el ícono 📓 en Asistencia (con selector de tipo) o el ícono ✏ en el Espacio del curso (nota rápida sin selector). Historial de promedios por período.

**Importar padrón completo** (botón aparte, bajo la lista de cursos): un solo archivo Excel/CSV con columnas `grado, seccion, numero_orden, nombre` puede traer estudiantes de **varios cursos a la vez** — cada fila se ubica automáticamente en el curso activo del año que coincida por grado+sección exactos. Pensado para compartir el mismo archivo de padrón con otro sistema que use esos mismos valores de grado/sección. Vista previa agrupada por curso antes de confirmar; un grupo sin curso existente se puede omitir o crear el curso nuevo con un check. El emparejamiento estudiante-a-estudiante es por `numero_orden` dentro del curso (no por nombre): actualiza el nombre si cambió, inserta si es nuevo, no toca nada si ya coincide — correr el mismo archivo dos veces es seguro (idempotente).

### Asistencia
Registro diario por curso con estados: presente, ausente, tardanza, excusado. Vista mensual con resumen por estudiante. Filtro por materia.

### Calificaciones
Módulo central. Dos modos:
- **Simple**: actividad → una competencia → nota 0–100.
- **Multi**: actividad → 2 a 4 competencias con distribución de puntos controlada por techo.

Incluye promedio ponderado del período, resumen por competencia, exportación a PDF y Excel.

### Temario
CRUD de temas con título, estado y fecha. Reordenamiento por drag. Plan de clase con metadatos enriquecidos (subtítulo, semana, fase, competencia, indicadores) — se puede armar a mano, copiando un prompt para pegar en una IA externa (Claude.ai) e importando el JSON que devuelve, o adjuntando archivos sueltos al tema. Clonar temario entre cursos, sincronizar plan a múltiples cursos. **Import masivo de temario desde un archivo JSON** (varios períodos/temas de una vez): vista previa antes de guardar (temas por período, períodos que no matchean), detección de duplicados por curso+período+materia+título.

### Reportes
Reporte grupal (promedio + asistencia + temas por curso/período) y reporte individual (detalle completo del estudiante). Exportación PDF vía impresión (`window.print()`). Exportación de calificaciones a Excel.

**Generación por lote**: el maestro elige un grado, una o varias secciones (checkboxes) y un período, y la app genera de una sola vez el PDF grupal de cada sección elegida más el PDF individual de cada estudiante de esas secciones, todos en una carpeta nueva con nombre descriptivo (`Reportes_<grado><secciones>_<período>_<fecha>/`). Cada PDF individual se nombra `<grado><sección>_<número de lista>_<nombre-slugificado>.pdf` para poder identificarlo sin abrirlo. Sin diálogo de guardado por archivo — un único diálogo de carpeta al inicio, y una barra de progreso en vivo mientras se generan.

### Configuración
Nombre del maestro y centro educativo. Pesos de evaluación (actividades, participación, asistencia, conducta). Mínimo aprobatorio y umbrales del semáforo. CRUD de materias (máximo 3 por año). Gestión de años escolares y períodos.

### Backup
Exportar BD como archivo `.db` (copia atómica WAL-safe). Importar/restaurar BD desde archivo `.db`. Exportar calificaciones a Excel. Reset total de BD. Sin backup automático ni sincronización en la nube.

---

## 4. Modelos de calificación

### Modo Simple
Una actividad evalúa **una sola competencia**. El maestro ingresa una nota de 0 a 100 por estudiante. El promedio del período es el promedio ponderado de todas las actividades simples del período para esa competencia.

**Cuándo conviene:** la mayoría de actividades cotidianas (tarea, evaluación, participación) que apuntan a una habilidad específica.

### Modo Multi-competencia
Una actividad evalúa **2, 3 o 4 competencias simultáneamente**. El maestro asigna puntos a cada competencia activa dentro de un **techo automático** (`100 ÷ n_comps`). La nota global de la actividad es la suma de los puntos asignados.

**Cuándo conviene:** proyectos integradores o evaluaciones que cruzan varias áreas. Útil cuando una sola nota global no refleja el desempeño diferenciado por competencia.

---

## 5. Reglas de negocio

### Competencias fijas
Las 4 competencias son fijas e inmutables en la versión actual:

| Nombre visible | Clave interna (BD) | Icono | Color |
|---|---|---|---|
| Comunicativa | `Comunicativa` | 💬 | #2563A8 |
| Pensamiento Lógico | `Pensamiento Logico` | 🧠 | #00695C |
| Cívica | `Civica` | 🏛️ | #5C2D91 |
| Tecnológica | `Tecnologica` | 💻 | #C84B00 |

El orden es siempre: Comunicativa → Pensamiento Lógico → Cívica → Tecnológica.

### Pesos de evaluación
El peso total del período suma 100. Distribución configurable:
- Actividades (default 60%)
- Participación (default 20%)
- Asistencia (default 10%)
- Conducta (default 10%)

### Fórmulas del modo multi-competencia

```
techo_por_competencia  = 100 / n_comps
nota_global_actividad  = Σ(puntos asignados a cada competencia activa)
nota_comp_en_actividad = (puntos_comp / techo) × 100
nota_comp_del_período  = Σ(nota_comp_en_act × peso_unitario) / Σ(peso_unitario)
  donde peso_unitario  = peso_actividad / n_comps
```

### Semáforo
- Verde: promedio ≥ `semaforo_verde` (default 80)
- Ámbar: promedio ≥ `semaforo_amarillo` (default 60)
- Rojo: promedio < `semaforo_amarillo`

Los umbrales son configurables por el maestro.

### Otras reglas
- El promedio de actividades es ponderado por el campo `peso` de cada actividad.
- No se soportan decimales en la nota final.
- Eliminar un estudiante borra en cascada todas sus calificaciones, asistencias y observaciones (acción irreversible — requiere backup previo).
- Máximo 3 materias activas por año escolar.

---

## 6. Restricciones

- **Offline-first**: la app no requiere internet para ninguna función excepto el auto-update.
- **Sin sincronización**: cada maestro tiene su propia BD. No hay compartición de datos entre instalaciones.
- **No multi-usuario**: una sola BD por instalación, un solo maestro.
- **Windows únicamente**: distribución NSIS para Windows 10+.
- **Sin contraseña ni autenticación**: el acceso a los datos depende del acceso físico a la PC.

---

## 7. Roadmap conocido

### Próximo bloque

- **App de Orientación / Supervisor**: segunda aplicación de escritorio para el orientador o director del centro. Objetivo: recibir los datos de notas finales del maestro vía LAN sin doble entrada de datos.
- **Integración LAN**: protocolo para que la app del maestro y la app del orientador se comuniquen en red local (sin internet). Padrón de estudiantes y notas finales de período compartidos.

### Mejoras pendientes dentro del sistema actual

- Auto-reload del renderer tras restore de BD (actualmente el maestro debe cerrar y reabrir la app manualmente).
- PDF de asistencia independiente.
- Exportación Excel con columnas de distribución multi por competencia (actualmente solo exporta la nota global).
- Reporte anual consolidado de boletines.
- Importación/exportación masiva de estudiantes entre años escolares.
- Selector de período del Dashboard: hoy siempre abre en el primer período del año (nada cambia el campo `estado` de un período de `'abierto'` a otro valor), no en el período vigente por fecha. Evaluar si conviene calcularlo por `fecha_inicio`/`fecha_fin` o agregar un control manual.

---

## 8. Fixes de la ronda de pruebas v1.5.1 (2026-07-20)

Ronda de pruebas funcionales end-to-end (calificaciones multi-competencia, reportes, temario, cuaderno anecdótico, dashboard/semáforo, CRUD de cursos) con datos reales y aislados. Bugs encontrados y corregidos:

1. **`getReporteGrupal` mezclaba notas entre materias** — el promedio del Reporte Grupal no filtraba por `materia_id`, mezclando calificaciones de todas las materias de un curso. Corregido agregando el filtro, igual que el resto de las queries de `database.js`.
2. **"Nota final" del período distinta entre pantallas** — el tab "Multi" de Calificaciones promediaba las 4 competencias en partes iguales; Reportes ponderaba por el peso real de cada actividad. Podían diferir más de 10 puntos y cruzar el umbral de aprobación. Se unificó: ambas pantallas usan ahora el promedio ponderado por peso.
3. **Tab "Simple" de Calificaciones mal interpretaba actividades en modo `multi`** — las agrupaba todas bajo la competencia legacy de la actividad en vez de excluirlas (se resumen aparte vía `distribucion_multi`). También afectaba el PDF de "Registro de Calificaciones".
4. **Panel lateral "Competencias" de Calificaciones** — mismo problema que el punto 3, en el conteo de actividades por competencia.
5. **`abrir-archivo` (adjuntos de Temario) tragaba errores en silencio** — no se hacía `await` del resultado de `shell.openPath`; ahora se revisa y se avisa al maestro si falla.
6. **Import masivo de temario vía JSON no tenía UI** — el backend (`importTemarioJson`) existía pero no había botón en ninguna pantalla. Se construyó la UI en Temario (vista previa + detección de duplicados).
7. **Dashboard mezclaba datos entre materias** — `get-estudiantes-riesgo`, `get-semaforo-cursos` y `get-stats` no recibían `materiaId` desde `Dashboard.jsx` pese a que las funciones de `database.js` ya lo soportaban.
8. **`get-stats` contaba estudiantes de cursos archivados** — el conteo de "Estudiantes" no filtraba por `cursos.estado='activo'`, a diferencia del conteo de "Cursos".
9. **Cuaderno anecdótico: tipo `'general'` (nota rápida desde el Espacio del curso) no estaba en `TIPOS_OBS`** — se mostraba mal etiquetado como "Académico". Se agregó como quinto tipo ("Nota rápida").
10. **Cursos: nombre vacío o duplicado no se validaba** — ahora se valida nombre no vacío en frontend y backend, y nombre duplicado (exacto, dentro del mismo año) en frontend.
11. Título de la pestaña Cursos tenía un "TEST" pegado desde v1.2.0 ("Cursos / Materias TEST") — corregido.

No se tocó el esquema de BD ni las fórmulas de cálculo de §4/§5 (siguen vigentes tal cual están documentadas arriba) — todos los fixes fueron de queries faltando un filtro, parámetros no propagados, o UI faltante/inconsistente.

---

## 9. Ronda v1.6.0 (2026-07-30) — Animaciones + Reportes por lote

### Pase de diseño con la skill `emil-design-eng`

Instalada a nivel de proyecto (`.claude/skills/emil-design-eng`) y aplicada en un diagnóstico priorizado de toda la UI. Cambios implementados (todos vía CSS `@starting-style`/`transition`, sin librería de animación nueva):

- **Loading states**: los `"Cargando..."` / `"⏳ Calculando..."` en texto plano (Dashboard, CursoEspacio, Reportes, Configuración, Estudiantes, App.jsx) ahora muestran un spinner (`.spinner`) y el contenido hace fade-in (`.content-fade-in`) al llegar.
- **Toasts** (Calificaciones, Asistencia): entrada y salida animadas (`.toast` + `[data-leaving]`) en vez de aparecer/desaparecer de golpe.
- **Modales** (los ~24 en Layout, Cursos, Estudiantes, Temario, Calificaciones, Asistencia, Configuración, CursoEspacio, PlanClase, Backup): fade del backdrop + scale/fade del contenido al abrir y cerrar, vía el hook nuevo `src/hooks/useModalTransition.js` — mantiene el modal montado ~160ms extra al cerrar para que la transición de salida se vea, sin cambiar cuándo/por qué se abre o cierra cada uno. Los dos lightbox de imagen (Temario, PlanClase) solo tienen fade de entrada — la lógica de cierre limpia el estado de la imagen en el mismo click, así que retrasar el desmontaje mostraría un ícono roto.
- **Semáforo del Dashboard**: las barras verde/ámbar/rojo pasaron de `width` a `clip-path` (recomendado por la skill sobre `transform:scaleX()` para este caso, porque son 3 segmentos co-dependientes, no un único elemento moviéndose) con grow-in en cada actualización de período.
- **Fix de bug preexistente, encontrado al animar el semáforo**: cambiar de período varias veces seguido podía hacer que la respuesta de un período viejo llegara después que la del nuevo y pisara los datos en pantalla (carrera de promesas). Se agregó un contador de "solicitud más reciente" (`semRequestId`) en `Dashboard.jsx` que descarta silenciosamente las respuestas obsoletas.

### Generación de reportes por lote (Reportes.jsx)

Ver §3 "Reportes" arriba para la descripción funcional. Notas de implementación relevantes:

- Las funciones que arman el HTML del reporte (`construirHTMLGrupal`, `construirHTMLIndividual`) se separaron de la apertura de ventana/impresión (`exportarPDFGrupal`, `exportarPDFIndividual`), que se mantienen sin cambios para los botones "🖨️ Exportar PDF" existentes.
- El lote **no** usa `window.print()` — usa `webContents.printToPDF()` de Electron sobre una ventana oculta reutilizada secuencialmente, con un único diálogo de carpeta al inicio (`generar-reportes-lote` en `electron/main.js`). Se descartó `.zip` (no había librería en el proyecto y no hacía falta agregar una) a favor de una carpeta con nombre descriptivo.
- **Bug encontrado en pruebas reales** (no solo build): el HTML reusado incluía `<script>window.onload=()=>window.print()</script>` para el flujo interactivo; `printToPDF()` lo rechaza ("Scripted print is not supported"). Se agregó un flag `autoprint` a ambas funciones constructoras de HTML — el lote pasa `autoprint:false` y el script no se incluye.
- Progreso en vivo durante la generación vía un bridge nuevo en `preload.js` (`window.api.on(canal, cb)`) — hasta ahora el preload solo exponía `invoke` (request/response).
- Probado con datos reales de los cursos 6to A/B/C FIHR (P1): 17 PDFs generados (3 grupales + 14 individuales), validados con `pdftotext` (nombre, promedio, competencias correctos por estudiante).
