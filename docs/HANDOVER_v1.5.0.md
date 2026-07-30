# Sistema Académico Docente — HANDOVER v1.5.0

**Fecha de release:** 2026-06-08  
**Versión:** 1.5.0  
**Autor del documento:** Claude Sonnet 4.6 — generado a partir del código fuente

---

## 1. Resumen ejecutivo

### Qué es

Sistema Académico Docente es una aplicación de escritorio para Windows que permite a un maestro gestionar calificaciones, asistencia, temario y reportes de sus cursos de forma offline. No requiere internet, servidor ni cuenta de usuario. Todos los datos se almacenan en un archivo SQLite local en la PC del maestro.

### Stack tecnológico

| Capa | Tecnología |
|---|---|
| Shell | Electron 29 |
| UI | React 18 + React Router 6 |
| Bundler | Vite 5 |
| Base de datos | SQLite 3 vía `better-sqlite3` (modo síncrono) |
| PDF | jsPDF + jsPDF-AutoTable |
| Excel | SheetJS (xlsx) |
| Empaquetado | electron-builder (target: NSIS para Windows) |
| Auto-update | electron-updater + GitHub Releases |

### Estado v1.5.0

- Release de producción del ciclo escolar 2025–2026
- Funcionalidad central completa: cursos, estudiantes, asistencia, calificaciones simple y multi-competencia, temario, reportes, backup
- BD en AppData del usuario; respaldo manual via UI
- Diferencia clave vs v1.3: modo multi-competencia completo, refactor de flujo (el maestro ingresa puntos por competencia y la nota global se calcula automáticamente), corrección de tres bugs críticos de backup/restore

---

## 2. PRD — Product Requirements

### 2.1 Usuarios objetivo

- Maestros de educación básica (primaria o secundaria)
- Un solo usuario por instalación (no hay multi-usuario ni roles)
- Uso offline en la PC personal del maestro
- No se requiere conexión a internet ni cuenta

### 2.2 Funcionalidades principales por módulo

#### Dashboard

**Propósito:** Vista general del estado del año escolar activo.

**Hace:**
- Muestra conteo de cursos activos, estudiantes y estado de temas (realizados / pendientes / aplazados / tarea)
- Lista de estudiantes en riesgo (promedio < mínimo aprobatorio o asistencia < semáforo verde)
- Semáforo por curso: distribución de estudiantes en verde / ámbar / rojo por período

**No hace:** No genera reportes desde aquí; no muestra datos históricos de años anteriores.

#### Horario

**Propósito:** Asignación visual de cursos a días y bloques de la semana.

**Hace:**
- Grilla de días × bloques (lunes–viernes, bloques numéricos)
- Asigna un curso + materia a cada celda
- Permite ver el horario filtrado por materia

**No hace:** No genera PDF de horario; no calcula horas acumuladas.

#### Cursos / Espacio de Curso

**Propósito:** Administrar la lista de cursos del año activo y su espacio de notas rápidas.

**Hace:**
- CRUD de cursos (nombre, grado, sección, color)
- Espacio del curso: nota rápida libre (texto) y anotaciones con fecha
- Historial de promedios del curso por período
- Vista de estudiantes en riesgo dentro del curso

**No hace:** No archiva cursos anteriores en la UI (quedan en BD pero `estado='archivado'`).

#### Estudiantes

**Propósito:** Gestión del padrón de alumnos por curso.

**Hace:**
- CRUD manual de estudiantes (nombre, número de lista, código único)
- Importación masiva desde Excel (.xlsx/.xls) o CSV
- Historial de promedios por período del estudiante
- Cuaderno de observaciones por estudiante (notas del maestro)

**No hace:** No hay foto de perfil ni datos de contacto de padres.

#### Asistencia

**Propósito:** Registro diario de asistencia por curso.

**Hace:**
- Vista de lista del curso con botones de estado: presente / ausente / tardanza / excusado
- Navegación por fecha (calendario)
- Vista mensual con resumen de asistencia por estudiante
- Filtra por materia si está activa

**No hace:** No genera reporte PDF de asistencia independiente (está incluido en reporte grupal/individual).

#### Calificaciones

**Propósito:** Registro y consulta de calificaciones por curso y período. Módulo central de la app.

**Modo Simple:**
- Actividades asociadas a una competencia única (Comunicativa, Pensamiento Lógico, Cívica, Tecnológica)
- Nota del 0 al 100 por estudiante
- Tipos de actividad: tarea, evaluación, participación, proyecto, otro
- Promedio ponderado por peso de actividad
- Vista resumen por estudiante

**Modo Multi-competencia:**
- Actividades que distribuyen puntos entre 2, 3 o 4 competencias simultáneamente
- Techo automático por competencia = 100 ÷ n_comps
- El maestro ingresa puntos por competencia; la nota global se calcula como suma
- 4 columnas fijas en el orden canónico: Comunicativa → Pensamiento Lógico → Cívica → Tecnológica
- Competencias no aplicables a esa actividad muestran "—" (placeholder)
- Vista de distribución con colores por competencia
- Toast de confirmación al guardar
- Vista resumen Multi: nota por competencia del período (promedio ponderado)
- PDF de período multi con desglose por actividad

**No hace:** No soporta decimales en nota final; no hay nota de conducta automática (es un peso de configuración, no se ingresa por actividad).

#### Temario

**Propósito:** Planificación y seguimiento del programa de temas por curso y período.

**Hace:**
- CRUD de temas con título, estado (pendiente / realizado / aplazado / tarea), fecha
- Reordenamiento por drag (índices)
- Clonar temario de otro curso/período
- Plan de clase: metadatos enriquecidos por tema (subtítulo, semana, fase, competencia, indicadores, etc.)
- Sincronizar plan de clase a múltiples cursos simultáneamente
- Importar temario desde JSON (generado externamente o por IA)
- Adjuntar archivos a temas (se copian a AppData/adjuntos/)

**No hace:** No exporta el temario como PDF.

#### Reportes

**Propósito:** Vista analítica y exportación de datos.

**Hace:**
- Reporte grupal: promedio, asistencia y estado de temas por curso/período
- Reporte individual: detalle por estudiante (promedio, competencias, asistencia, temas, observaciones)
- Exportar calificaciones a Excel (una hoja por curso-período)

**No hace:** No hay reporte anual consolidado; no hay PDF masivo de boletines.

#### Configuración

**Propósito:** Parámetros globales del sistema.

**Hace:**
- Nombre del maestro y centro educativo
- Pesos de evaluación: actividades, participación, asistencia, conducta (deben sumar 100)
- Mínimo aprobatorio y umbrales del semáforo (verde / ámbar)
- CRUD de materias del año activo (máximo 3)
- Gestión de años escolares y períodos

**No hace:** No hay perfil de usuario; no hay contraseña.

#### Backup

**Propósito:** Respaldo y restauración de la BD.

**Hace:**
- Exportar BD como archivo `.db` (copia atómica con WAL integrado vía `db.backup()`)
- Importar/restaurar BD desde archivo `.db` (limpia WAL/SHM previo antes de copiar)
- Exportar calificaciones a Excel (todas las hojas)
- Reset total: borra la BD y la reinicia desde cero

**No hace:** No hace backup automático; no sube a la nube.

### 2.3 Reglas de negocio del modo multi-competencia

```
techo_por_competencia  = 100 / n_comps                      (ej. 2 comps → techo 50)
nota_global_actividad  = Σ(dist[comp])  para todas las comps activas
nota_comp_en_act       = (dist[comp] / techo) × 100
nota_comp_del_período  = Σ(nota_comp_en_act × peso_unit) / Σ(peso_unit)
  donde peso_unit      = actividad.peso / n_comps
```

- Ningún input puede superar su techo (`val > techo + 0.01` es error)
- Si el maestro edita las competencias de una actividad que ya tiene calificaciones, todas se redistribuyen al valor de techo por defecto (distribución equitativa)
- El "promedio final" del período en modo multi es el promedio simple de las notas de las competencias que tienen calificaciones
- Los nombres canónicos de competencia (sin tildes) son: `Comunicativa`, `Pensamiento Logico`, `Civica`, `Tecnologica`

### 2.4 Roadmap pendiente

- Integración con app de orientación vía LAN (siguiente proyecto)
- PDF anual consolidado de boletines
- Importación/exportación masiva de estudiantes entre años

---

## 3. TDR — Technical Design

### 3.1 Arquitectura

```
┌─────────────────────────────────────────────────┐
│              React UI (Renderer Process)         │
│  src/pages/*.jsx  ←→  window.api.invoke(canal)  │
└───────────────────────┬─────────────────────────┘
                        │ contextBridge (preload.js)
                        │ ipcRenderer.invoke()
┌───────────────────────▼─────────────────────────┐
│            Electron Main Process                 │
│  electron/main.js — ipcMain.handle(canal, fn)   │
│                     │                           │
│  electron/database.js — SistemaDB (singleton)   │
│                     │                           │
│          better-sqlite3 (síncrono)               │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│     %APPDATA%\sistema-academico-docente\         │
│       sistema_docente.db   (WAL mode)            │
│       sistema_docente.db-wal                     │
│       sistema_docente.db-shm                     │
│       adjuntos\<timestamp>_<nombre>              │
└─────────────────────────────────────────────────┘
```

**Rutas importantes:**

| Qué | Dónde |
|---|---|
| Código fuente | `C:\Users\<user>\Documents\sistema-docente\` |
| BD activa | `%APPDATA%\sistema-academico-docente\sistema_docente.db` |
| Archivos adjuntos | `%APPDATA%\sistema-academico-docente\adjuntos\` |
| Backups (manual) | Donde el usuario elija al hacer Exportar |
| Build/distributable | `release\` |
| Logs Electron | `%APPDATA%\sistema-academico-docente\logs\` |

### 3.2 Esquema de base de datos

La BD se crea en `initialize()` → `crearTablas()` y se actualiza con `migrarTablas()`. Modo WAL activo (`PRAGMA journal_mode = WAL`).

#### anios_escolares
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| nombre | TEXT NOT NULL | | Ej. "2025-2026" |
| fecha_inicio | TEXT | null | ISO 8601 |
| fecha_fin | TEXT | null | ISO 8601 |
| estado | TEXT | 'activo' | 'activo' / 'archivado' |

#### periodos
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| anio_escolar_id | INTEGER NOT NULL | | FK → anios_escolares |
| nombre | TEXT NOT NULL | | 'P1', 'P2', 'P3', 'P4' |
| numero_orden | INTEGER NOT NULL | | 1–4 |
| titulo | TEXT | '' | Ej. "Primer Período" |
| fecha_inicio | TEXT | null | |
| fecha_fin | TEXT | null | |
| estado | TEXT | 'abierto' | 'abierto' / 'cerrado' |

#### materias
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| anio_escolar_id | INTEGER NOT NULL | | FK → anios_escolares |
| nombre | TEXT NOT NULL | | Máx. 3 por año |
| color | TEXT | '#2563A8' | Hex color |
| orden | INTEGER | 0 | Orden en menú |
| estado | TEXT | 'activo' | 'activo' / 'archivado' |

#### periodo_titulos
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| materia_id | INTEGER NOT NULL | | FK → materias |
| grado | TEXT NOT NULL | | Ej. "2do" |
| numero_periodo | INTEGER NOT NULL | | 1–4 |
| titulo | TEXT NOT NULL | | Título personalizado por grado |
| UNIQUE | (materia_id, grado, numero_periodo) | | |

#### cursos
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| anio_escolar_id | INTEGER NOT NULL | | FK → anios_escolares |
| nombre | TEXT NOT NULL | | Ej. "FIHR 2do B" |
| grado | TEXT | '' | Ej. "2do" |
| seccion | TEXT | '' | Ej. "B" |
| descripcion | TEXT | '' | |
| color | TEXT | '#2563A8' | Hex color |
| estado | TEXT | 'activo' | 'activo' / 'archivado' |

#### horario_asignaciones
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| anio_escolar_id | INTEGER NOT NULL | | FK → anios_escolares |
| materia_id | INTEGER | null | FK → materias (migración) |
| curso_id | INTEGER NOT NULL | | FK → cursos |
| dia_semana | TEXT NOT NULL | | 'lunes'...'viernes' |
| bloque_id | INTEGER NOT NULL | | Número de bloque |
| UNIQUE | (anio_escolar_id, dia_semana, bloque_id) | | Un curso por celda |

#### estudiantes
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| curso_id | INTEGER NOT NULL | | FK → cursos |
| codigo_unico | TEXT | '' | Código externo opcional |
| numero_lista | INTEGER | 0 | Número de lista |
| nombre_completo | TEXT NOT NULL | | |
| estado | TEXT | 'activo' | 'activo' / 'inactivo' |

#### temas
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| materia_id | INTEGER | null | FK → materias (migración) |
| curso_id | INTEGER NOT NULL | | FK → cursos |
| periodo_id | INTEGER NOT NULL | | FK → periodos |
| orden | INTEGER | 0 | Para drag-reorder |
| titulo | TEXT NOT NULL | | |
| contenido_texto | TEXT | '' | Notas del tema |
| estado | TEXT | 'pendiente' | 'pendiente' / 'realizado' / 'aplazado' / 'tarea' |
| fecha_realizado | TEXT | null | ISO 8601 |
| fecha_aplazado | TEXT | null | ISO 8601 |
| meta_json | TEXT | null | JSON con plan de clase (migración) |

#### asistencias
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| materia_id | INTEGER | null | FK → materias (migración) |
| estudiante_id | INTEGER NOT NULL | | FK → estudiantes |
| curso_id | INTEGER NOT NULL | | FK → cursos |
| fecha | TEXT NOT NULL | | ISO 8601 'YYYY-MM-DD' |
| estado | TEXT | 'presente' | 'presente' / 'ausente' / 'tardanza' / 'excusado' |
| UNIQUE | (estudiante_id, fecha, materia_id) | | |

#### actividades
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| materia_id | INTEGER | null | FK → materias (migración) |
| curso_id | INTEGER NOT NULL | | FK → cursos |
| periodo_id | INTEGER NOT NULL | | FK → periodos |
| nombre | TEXT NOT NULL | | |
| tipo | TEXT | 'tarea' | 'tarea' / 'evaluacion' / 'participacion' / 'proyecto' / 'otro' |
| competencia | TEXT | 'Comunicativa' | Usado solo en modo='simple' |
| fecha | TEXT | null | ISO 8601 |
| peso | REAL | 1.0 | Peso relativo en promedio ponderado |
| descripcion | TEXT | '' | |
| modo | TEXT | 'simple' | 'simple' / 'multi' (migración) |
| competencias_multi | TEXT | null | JSON array de keys canónicos (migración) |

#### calificaciones
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| actividad_id | INTEGER NOT NULL | | FK → actividades |
| estudiante_id | INTEGER NOT NULL | | FK → estudiantes |
| nota | REAL | null | Nota global 0–100 |
| observacion | TEXT | '' | |
| distribucion_multi | TEXT | null | JSON `{comp: pts}` (migración) |
| UNIQUE | (actividad_id, estudiante_id) | | |

#### observaciones
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| estudiante_id | INTEGER NOT NULL | | FK → estudiantes |
| fecha | TEXT NOT NULL | | ISO 8601 |
| texto | TEXT NOT NULL | | |
| tipo | TEXT | 'academico' | 'academico' / otros |

#### configuracion
| Columna | Tipo | Notas |
|---|---|---|
| clave | TEXT PK | |
| valor | TEXT NOT NULL | Siempre texto, convertir al leer |

**Claves de configuración (valores por defecto):**

| Clave | Default | Descripción |
|---|---|---|
| actividades_peso | 60 | % peso de actividades en nota final |
| participacion_peso | 20 | % peso de participación |
| asistencia_peso | 10 | % peso de asistencia |
| conducta_peso | 10 | % peso de conducta |
| minimo_aprobatorio | 70 | Umbral de aprobación |
| semaforo_verde | 80 | Umbral superior semáforo |
| semaforo_amarillo | 60 | Umbral inferior semáforo |
| modo_competencias | false | (reservado) |
| nombre_maestro | Prof. Nombre Apellido | |
| centro_educativo | '' | |
| materia_activa_id | (id de primera materia) | Materia seleccionada en UI |

#### tema_archivos
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| tema_id | INTEGER NOT NULL | | FK → temas |
| nombre | TEXT NOT NULL | | Nombre original del archivo |
| ruta | TEXT NOT NULL | | Ruta absoluta en AppData/adjuntos/ |
| tipo | TEXT | 'file' | |
| fecha | TEXT | null | |

#### curso_nota_rapida
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| curso_id | INTEGER NOT NULL | | FK → cursos (ON DELETE CASCADE) |
| materia_id | INTEGER | null | |
| texto | TEXT | '' | Nota libre del maestro |
| updated_at | TEXT | null | |
| UNIQUE | (curso_id, materia_id) | | |

#### curso_anotaciones
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| id | INTEGER PK | autoincrement | |
| curso_id | INTEGER NOT NULL | | FK → cursos (ON DELETE CASCADE) |
| materia_id | INTEGER | null | |
| fecha | TEXT NOT NULL | | |
| texto | TEXT NOT NULL | | |
| created_at | DATETIME | CURRENT_TIMESTAMP | |

### 3.3 IPC handlers

Todos los handlers se registran en `electron/main.js` como `ipcMain.handle(canal, fn)`. El renderer los llama con `window.api.invoke(canal, ...args)`.

#### Años escolares / Períodos

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-anios` | — | Array de anios | `getAnios()` |
| `get-anio-activo` | — | Anio o null | `getAnioActivo()` |
| `create-anio` | `{nombre, fecha_inicio, fecha_fin}` | RunResult (crea 4 períodos automáticamente) | `createAnio(d)` |
| `get-periodos` | `anioId` | Array de períodos | `getPeriodos(anioId)` |
| `update-periodo` | `id, {nombre, titulo, fecha_inicio, fecha_fin}` | RunResult | `updatePeriodo(id, d)` |

#### Materias

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-materias` | `anioId` | Array de materias activas | `getMaterias(anioId)` |
| `create-materia` | `{anioId, nombre, color}` | RunResult | `createMateria(d)` |
| `update-materia` | `id, {nombre, color}` | RunResult | `updateMateria(id, d)` |
| `delete-materia` | `id` | RunResult (soft delete) | `deleteMateria(id)` |
| `get-periodo-titulos` | `materiaId` | Array | `getPeriodoTitulos(materiaId)` |
| `set-periodo-titulo` | `materiaId, grado, numeroPeriodo, titulo` | RunResult (upsert) | `setPeriodoTitulo(...)` |
| `get-titulo-grado` | `materiaId, grado, numeroPeriodo, anioId` | string | `getTituloParaGrado(...)` |
| `get-grados-titulos` | `materiaId` | Array de strings | `getGradosConTitulos(materiaId)` |
| `del-periodo-titulo` | `materiaId, grado, numeroPeriodo` | RunResult | `deletePeriodoTitulo(...)` |

#### Cursos

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-cursos` | `anioId` | Array de cursos activos | `getCursos(anioId)` |
| `create-curso` | `{anioId, nombre, grado, seccion, descripcion, color}` | RunResult | `createCurso(d)` |
| `update-curso` | `id, {nombre, grado, seccion, descripcion, color}` | RunResult | `updateCurso(id, d)` |
| `delete-curso` | `id` | RunResult (soft delete) | `deleteCurso(id)` |

#### Horario

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-horario` | `anioId` | Array con joins curso+materia | `getHorario(anioId)` |
| `get-horario-materia` | `anioId, materiaId` | Array | `getHorarioMateria(anioId, materiaId)` |
| `set-horario-celda` | `{anioId, materiaId, cursoId, dia, bloqueId}` | RunResult (upsert) | `setHorarioCelda(d)` |
| `del-horario-celda` | `{anioId, dia, bloqueId}` | RunResult | `deleteHorarioCelda(d)` |
| `get-dias-curso` | `cursoId, materiaId` | Array de strings (días) | `getDiasCurso(...)` |

#### Estudiantes

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-estudiantes` | `cursoId` | Array (solo activos, ordenado por número lista) | `getEstudiantes(cursoId)` |
| `get-estudiantes-todos` | `cursoId` | Array (activos + inactivos) | `getEstudiantesTodos(cursoId)` |
| `create-estudiante` | `{cursoId, nombre, codigo, numero}` | RunResult | `createEstudiante(d)` |
| `update-estudiante` | `id, {nombre, codigo, numero, estado}` | RunResult | `updateEstudiante(id, d)` |
| `delete-estudiante` | `id` | RunResult (hard delete + cascade califs/asist/obs) | `deleteEstudiante(id)` |
| `importar-estudiantes` | `cursoId, [{nombre, codigo, numero}]` | `{insertados, omitidos}` | `importarEstudiantes(...)` |
| `abrir-archivo-estudiantes` | — | `{filas, total, archivo}` o `{error}` | Dialog + parser XLSX/CSV en main.js |

#### Asistencia

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-asistencia-dia` | `cursoId, fecha, materiaId` | Array estudiantes con campo `asistencia` | `getAsistenciaDia(...)` |
| `set-asistencia` | `{materiaId, estudianteId, cursoId, fecha, estado}` | RunResult (upsert) | `setAsistencia(d)` |
| `get-asistencia-mes` | `cursoId, anio, mes, materiaId` | `{estudiantes, asistencias}` | `getAsistenciaMes(...)` |

#### Temas

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-temas` | `cursoId, periodoId, materiaId` | Array | `getTemas(...)` |
| `create-tema` | `{cursoId, periodoId, materiaId, titulo, metaJson}` | RunResult | `createTema(d)` |
| `update-tema` | `id, {titulo, estado, contenido_texto, fecha_realizado, fecha_aplazado, metaJson}` | RunResult | `updateTema(id, d)` |
| `delete-tema` | `id` | RunResult (también borra tema_archivos) | `deleteTema(id)` |
| `reordenar-temas` | `[temaId, ...]` (array ordenado) | `{ok: true}` | `reordenarTemas(temaIds)` |
| `clonar-temas` | `srcCursoId, srcPeriodoId, dstCursoId, dstPeriodoId, materiaId` | `{total, copiados}` | `clonarTemas(...)` |
| `import-temario-json` | `{jsonData, cursoId, materiaId, anioId}` | `{count}` o `{error}` | `importTemarioJson(...)` |
| `sync-plan-cursos` | `{titulo, materiaId, anioId, metaJson, cursoIds}` | `{count}` | `syncPlanToCursos(d)` |

#### Archivos adjuntos a temas

| Canal | Parámetros | Retorno | Notas |
|---|---|---|---|
| `get-archivos-tema` | `temaId` | Array | |
| `adjuntar-archivo-tema` | `temaId` | `{nombre, ruta, fecha}` o null | Dialog + copia a adjuntos/ |
| `delete-archivo-tema` | `id` | `{ok: true}` | Borra registro + archivo físico |
| `abrir-archivo` | `ruta` | `{ok: true}` | `shell.openPath(ruta)` |

#### Actividades

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-actividades` | `cursoId, periodoId, materiaId` | Array ordenado por fecha DESC | `getActividades(...)` |
| `create-actividad` | `{materiaId, cursoId, periodoId, nombre, tipo, competencia, fecha, peso, descripcion, modo, competencias_multi}` | RunResult | `createActividad(d)` |
| `update-actividad` | `id, {nombre, tipo, competencia, fecha, peso, modo, competencias_multi}` | RunResult (redistribuye califs si cambian comps) | `updateActividad(id, d)` |
| `delete-actividad` | `id` | RunResult (cascade calificaciones) | `deleteActividad(id)` |
| `duplicar-actividades` | `srcCursoId, srcPeriodoId, dstCursoId, dstPeriodoId, materiaId` | `{total, copiadas}` | `duplicarActividades(...)` |

#### Calificaciones

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-calificaciones` | `actividadId` | Array con join estudiante | `getCalificaciones(actividadId)` |
| `set-calificacion` | `{actividadId, estudianteId, nota, observacion}` | RunResult (upsert) | `setCalificacion(d)` |
| `set-calificacion-multi` | `{actividad_id, estudiante_id, distribucion}` | RunResult (valida techo, calcula nota global) | `setCalificacionMulti(data)` |
| `get-distribucion-multi` | `actividadId, estudianteId` | `{comp: pts}` o null | `getDistribucionMulti(...)` |
| `get-resumen-competencias-multi` | `cursoId, periodoId, materiaId` | Array `{competencia, peso_total, peso_evaluado, nota}` | `getResumenCompetenciasMulti(...)` |
| `get-resumen-competencias-multi-por-estudiante` | `estudianteId, cursoId, periodoId, materiaId` | `{comp: {nota}}` | `getResumenCompetenciasMultiPorEstudiante(...)` |

#### Observaciones

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-observaciones` | `estudianteId` | Array ordenado por fecha DESC | `getObservaciones(estudianteId)` |
| `get-observaciones-recientes` | `estudianteId, limite` | Array (top N) | `getObservacionesRecientes(...)` |
| `create-observacion` | `{estudianteId, fecha, texto, tipo}` | RunResult | `createObservacion(d)` |
| `delete-observacion` | `id` | RunResult | `deleteObservacion(id)` |

#### Configuración y estadísticas

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-config` | — | `{clave: valor, ...}` (objeto plano) | `getConfig()` |
| `set-config` | `clave, valor` | RunResult (upsert) | `setConfig(clave, val)` |
| `get-stats` | `anioId, materiaId` | `{cursos, estudiantes, temas_*}` | `getStats(...)` |
| `get-semaforo-cursos` | `anioId, periodoId, materiaId` | Array `{id, nombre, verde, amarillo, rojo, sinNota, promedio, total}` | `getSemaforoCursos(...)` |
| `get-historial-curso` | `cursoId, anioId, materiaId` | Array por estudiante con promedios por período | `getHistorialCurso(...)` |
| `get-estudiantes-riesgo` | `anioId, periodoId, materiaId` | Array estudiantes con promedio < mínimo o asist < semVerde | `getEstudiantesRiesgo(...)` |
| `get-semaforo-estudiantes` | `cursoId, periodoId, materiaId` | Array con `color_nota`, `color_asist`, `en_riesgo` | `getSemaforoEstudiantes(...)` |
| `get-estudiantes-sin-nota` | `cursoId, periodoId, materiaId` | `{actividad, sin_nota: [...]}` | `getEstudiantesSinNota(...)` |

#### Reportes

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-reporte-grupal` | `cursoId, periodoId, materiaId` | `{temas_total, temas_realizados, estudiantes, config}` | `getReporteGrupal(...)` |
| `get-reporte-individual` | `estudianteId, cursoId, periodoId, materiaId` | `{estudiante, promedio, competencias, asistencia, temas, observaciones}` | `getReporteIndividual(...)` |

#### Espacio del curso

| Canal | Parámetros | Retorno | Método DB |
|---|---|---|---|
| `get-curso-nota` | `cursoId, materiaId` | string (texto libre) | `getCursoNota(...)` |
| `set-curso-nota` | `cursoId, texto, materiaId` | RunResult (upsert) | `setCursoNota(...)` |
| `get-curso-anotaciones` | `cursoId, materiaId` | Array ordenado por fecha DESC | `getCursoAnotaciones(...)` |
| `add-curso-anotacion` | `cursoId, texto, materiaId` | RunResult | `addCursoAnotacion(...)` |
| `del-curso-anotacion` | `id` | RunResult | `deleteCursoAnotacion(id)` |

#### Backup

| Canal | Parámetros | Retorno | Notas |
|---|---|---|---|
| `backup-exportar-bd` | — | `{ok, ruta}` o `{cancelado}` o `{ok:false, error}` | Dialog save + `db.db.backup(filePath)` (atómico con WAL) |
| `backup-seleccionar-bd` | — | `{ruta}` o null | Dialog open (solo selecciona, no restaura) |
| `backup-importar-bd` | `rutaOrigen` | `{ok}` o `{ok:false, error}` | Cierra DB, borra WAL/SHM, copia, reabre |
| `backup-exportar-excel` | — | `{ok, ruta}` o `{cancelado}` | Dialog save + `db.getExportData()` → XLSX |
| `backup-reset-bd` | — | `{ok}` o `{ok:false, error}` | Borra archivo DB completo y reinicia |

#### Sistema

| Canal | Parámetros | Retorno | Notas |
|---|---|---|---|
| `leer-imagen` | `ruta` | `data:image/...;base64,...` o null | Lee archivo físico y lo convierte |
| `limpiar-participacion` | — | `{eliminadas: n}` | Borra todas las actividades tipo 'Participacion' y sus calificaciones |

### 3.4 Fórmulas críticas

Todas las fórmulas están implementadas en `electron/database.js`. El frontend no calcula notas finales — solo pasa los datos al IPC.

#### 1. Promedio ponderado del período (modo simple)

```js
// getReporteGrupal / getHistorialCurso / getSemaforoCursos
const pesoTotal = notas.reduce((s, n) => s + n.peso, 0);
promedio = Math.round(
  notas.reduce((s, n) => s + n.nota * n.peso, 0) / pesoTotal
);
```

#### 2. Nota global de actividad (modo multi)

```js
// notaFromDist() en database.js
nota = Math.round(Object.values(dist).reduce((a, b) => a + b, 0) * 10) / 10;
// Equivale a: Σ(dist[comp]) redondeado a 1 decimal
```

#### 3. Techo por competencia

```js
// defaultDist() en database.js
const techo = Math.round(100 / n_comps * 10) / 10;
// Ej. 2 comps → 50.0 | 3 comps → 33.3 | 4 comps → 25.0
```

#### 4. Nota por competencia en una actividad

```js
// getResumenCompetenciasMultiPorEstudiante()
const techo    = 100 / n_comps;       // sin redondear en el divisor
const nota_comp = (pts / techo) * 100;
// pts = dist[comp] (puntos que el maestro asignó a esa competencia)
```

#### 5. Nota por competencia del período (por estudiante)

```js
// getResumenCompetenciasMultiPorEstudiante()
const peso_unit = act.peso / n_comps;
// Para cada actividad que incluye esta competencia y tiene calificación:
peso_evaluado  += peso_unit;
suma_ponderada += nota_comp * peso_unit;  // nota_comp = (pts/techo)×100

// Resultado:
nota_comp_periodo = Math.round(suma_ponderada / peso_evaluado);
```

#### 6. Nota por competencia del período (grupal)

```js
// getResumenCompetenciasMulti()
// Por actividad que incluye la competencia:
const peso_unit = act.peso / n_comps;
// nota_comp_acto = promedio de (pts/techo)×100 entre todos los calificados
const nota_comp_acto = suma_notas_comp / califs.length;
suma_ponderada += nota_comp_acto * peso_unit;
peso_evaluado  += peso_unit;

nota_comp = Math.round(suma_ponderada / peso_evaluado);
```

#### 7. Semáforo

```js
// getSemaforoEstudiantes() / getSemaforoCursos()
const semVerde    = Number(cfg.semaforo_verde    || 80);
const semAmarillo = Number(cfg.semaforo_amarillo || 60);

color = promedio >= semVerde    ? 'verde'
      : promedio >= semAmarillo ? 'amarillo'
      :                          'rojo';
```

---

## 4. UX — Flujos de usuario

### 4.1 Flujo: crear curso y estudiantes (primera vez)

1. **Configuración** → confirmar nombre del maestro y centro educativo
2. **Configuración → Materias** → crear materia (nombre, color). Máximo 3.
3. **Cursos** → botón "Nuevo curso" → ingresar nombre, grado, sección, color
4. **Cursos → [Curso]** → tab "Estudiantes" → agregar manualmente o importar desde Excel/CSV
   - Excel/CSV debe tener columnas: `nombre_completo`, `numero` (o `numero_lista`), `codigo` (opcional)
5. Repetir para cada curso

### 4.2 Flujo: crear actividad modo Simple

1. **Calificaciones** → seleccionar curso + período + materia
2. Tab "Actividades" → "Nueva actividad"
3. Modo: **Simple**
4. Ingresar: nombre, tipo, competencia (dropdown), fecha, peso, descripción
5. Guardar → aparece en lista de actividades

### 4.3 Flujo: crear actividad modo Multi

1. **Calificaciones** → seleccionar curso + período + materia
2. Tab "Actividades" → "Nueva actividad"
3. Modo: **Multi-competencia**
4. En el selector de competencias: marcar las 2–4 competencias que evalúa esta actividad
5. El techo se calcula automáticamente y se muestra: 100 ÷ n_comps
6. Ingresar: nombre, tipo, fecha, peso, descripción
7. Guardar

### 4.4 Flujo: calificar estudiantes (Simple)

1. **Calificaciones** → seleccionar actividad simple
2. Tab "Calificar" → lista de estudiantes con input de nota (0–100)
3. Ingresar nota por estudiante → `set-calificacion` se llama al salir del input (blur)
4. Los inputs resaltados en rojo indican nota < mínimo aprobatorio

### 4.5 Flujo: calificar estudiantes (Multi)

1. **Calificaciones** → seleccionar actividad multi
2. Tab "Calificar" → tabla con 4 columnas fijas: Comunicativa | Pensamiento Lógico | Cívica | Tecnológica
3. Las columnas de competencias no activas en esta actividad muestran "—" (no editables)
4. Las columnas activas muestran un input numérico con:
   - Color de fondo y borde propio de la competencia
   - Placeholder con el techo como referencia (ej. `50`)
   - El input valida en blur que no supere el techo
5. La nota global se calcula automáticamente como suma
6. Al guardar (botón "✓") → `set-calificacion-multi` → toast de confirmación

### 4.6 Flujo: editar actividad con calificaciones (re-distribución)

1. En la lista de actividades → editar actividad multi que ya tiene calificaciones
2. Si se cambian las competencias marcadas → **aviso de confirmación** ("Esta actividad tiene N calificaciones. Al cambiar las competencias, todas se redistribuirán al techo por defecto.")
3. Si el maestro acepta → `update-actividad` redistribuye automáticamente todas las calificaciones a la distribución equitativa de las nuevas competencias

### 4.7 Flujo: generar reportes y PDFs

**Reporte grupal:**
1. **Reportes** → seleccionar curso + período
2. Se muestra tabla con promedio, asistencia y estado de temas de cada estudiante
3. Botón "PDF" → genera PDF con jsPDF (se abre ventana nueva del sistema)

**Reporte individual:**
1. **Reportes** → seleccionar estudiante
2. Se muestra: promedio global, nota por competencia, asistencia, lista de temas, observaciones
3. Botón "PDF" → genera PDF individual

**PDF multi-competencia:**
1. En **Calificaciones** → tab "Resumen Multi" → botón "PDF"
2. Genera PDF con tabla por estudiante × competencia y desglose por actividad

### 4.8 Flujo: backup y restore

**Backup:**
1. **Backup** → "Exportar base de datos"
2. Dialog de guardado → elegir nombre y ubicación del `.db`
3. Se crea una copia atómica que incluye el WAL completo
4. Recomendado: guardar con nombre de fecha, en USB o nube

**Restore:**
1. **Backup** → "Importar base de datos" → seleccionar archivo `.db`
2. Confirmar → la app cierra la BD, elimina WAL/SHM existentes, copia el archivo, reabre la BD
3. La app muestra toast: "Base de datos restaurada. Reinicia la aplicación para ver los cambios."
4. **El usuario debe reiniciar la app** para que la UI se actualice con los nuevos datos

### 4.9 Convenciones visuales

**Iconos y colores por competencia:**

| Competencia | Key BD | Icono | Color texto | Color fondo input |
|---|---|---|---|---|
| Comunicativa | `Comunicativa` | 💬 | #2563A8 | #D6E4F7 |
| Pensamiento Lógico | `Pensamiento Logico` | 🧠 | #00695C | #D0EDE8 |
| Cívica | `Civica` | 🏛️ | #5C2D91 | #EDE0F7 |
| Tecnológica | `Tecnologica` | 💻 | #C84B00 | #FDECD7 |

**Semáforo:**
- 🟢 Verde: promedio ≥ `semaforo_verde` (default 80)
- 🟡 Ámbar: promedio ≥ `semaforo_amarillo` (default 60)
- 🔴 Rojo: promedio < `semaforo_amarillo`
- ⚪ Sin nota: no hay calificaciones registradas

**Estados de temas:**
- `pendiente`: tema programado, no realizado aún
- `realizado`: tema impartido en clase
- `aplazado`: se pospuso (con fecha)
- `tarea`: asignado como trabajo en casa

---

## 5. Manual de usuario final

### 5.1 Primera vez usando la app

1. Al abrir la app por primera vez, ya tiene un año escolar 2025-2026 y cuatro períodos P1–P4 creados.
2. Ve a **Configuración** y cambia el nombre del maestro y el centro educativo.
3. En **Configuración → Materias**, cambia "Mi Materia" por el nombre real de tu materia.
4. Ve a **Cursos** y crea tu primer grupo (por ejemplo: "2do B", grado "2do", sección "B").
5. Entra al curso y agrega los estudiantes en la pestaña "Estudiantes".

### 5.2 Calificar día a día

1. Ve a **Calificaciones**, selecciona el curso y el período en los menús superiores.
2. En la pestaña "Actividades", crea una nueva actividad (botón "+").
3. Ingresa el nombre, el tipo, el peso y la competencia.
4. Haz clic en la actividad para abrir la lista de estudiantes y registrar las notas.
5. La app calcula automáticamente el promedio ponderado.

### 5.3 Cómo usar el modo multi-competencia

**¿Cuándo conviene Simple vs Multi?**

- **Simple**: cuando la actividad evalúa una sola habilidad o competencia. Es lo más común.
- **Multi**: cuando una actividad integra varias competencias y quieres registrar cuánto aportó cada una. Útil para proyectos integradores o evaluaciones que cruzan áreas.

**Cómo crear una actividad Multi:**

1. Al crear la actividad, elige modo "Multi-competencia".
2. Marca las competencias que va a evaluar (entre 2 y 4).
3. La app te muestra automáticamente el **techo**: es el máximo de puntos que puedes asignar a cada competencia.

**Cómo ingresar puntos por competencia:**

1. Abre la actividad multi para calificar.
2. Verás columnas de colores, una por competencia activa. Las columnas grises ("—") son competencias que no aplican a esta actividad.
3. En cada columna activa, escribe cuántos puntos gana el estudiante (de 0 al techo).
4. La **nota global** se suma automáticamente.
5. Haz clic en "✓" para guardar. Verás un mensaje de confirmación con el resumen.

**¿Qué significa el techo y por qué existe?**

El techo asegura que cada competencia valga lo mismo dentro de la actividad. Si la actividad tiene 3 competencias, cada una vale hasta 33.3 puntos (100 ÷ 3). Así, si un estudiante lo hace perfecto en todas, su nota es 100. Si solo destaca en una, refleja un perfil parcial.

**Cómo ver el resumen Multi del período:**

En la pestaña "Resumen Multi" de Calificaciones verás la nota de cada competencia para cada estudiante, calculada como promedio ponderado del período. Puedes exportarlo a PDF con el botón "PDF Multi".

### 5.4 Generar reportes

1. Ve al módulo **Reportes** en el menú lateral.
2. Selecciona el curso y el período.
3. Para el **reporte grupal**: verás una tabla con todos los estudiantes, su promedio y su asistencia. Haz clic en "PDF" para exportar.
4. Para el **reporte individual**: selecciona un estudiante de la lista. Verás su detalle completo con notas por competencia, asistencia y temas vistos.

### 5.5 Hacer backup (recomendado mensual)

1. Ve a **Backup** en el menú lateral.
2. Haz clic en "Exportar base de datos".
3. Elige dónde guardar el archivo `.db`. Recomendado: carpeta con la fecha (ej. `backup_2026-06-08.db`).
4. Guarda el archivo en un USB o compártelo por WhatsApp/Drive como seguro adicional.

### 5.6 Restaurar backup

1. Ve a **Backup**.
2. Haz clic en "Importar base de datos".
3. Selecciona el archivo `.db` del backup.
4. Confirma la acción. **Esta operación reemplaza todos los datos actuales.**
5. Cuando aparezca el mensaje de éxito, **cierra y vuelve a abrir la app** para ver los datos restaurados.

### 5.7 Preguntas frecuentes

**¿Puedo tener varias materias?**  
Sí, hasta 3 materias por año escolar. Se crean en Configuración → Materias.

**¿Qué pasa si elimino un estudiante?**  
Se borran también todas sus calificaciones, asistencias y observaciones. Esta acción es irreversible. Haz un backup antes.

**¿Puedo copiar el temario de un curso a otro?**  
Sí, en Temario hay una opción "Clonar temario" que copia los temas de otro curso/período.

**¿El promedio que muestra la app es la nota final?**  
El promedio de actividades es el componente principal. La nota final oficial puede incluir participación, asistencia y conducta según los pesos configurados, pero la app no calcula esa combinación automáticamente — cada maestro lo aplica manualmente según su criterio.

**¿Funciona sin internet?**  
Sí, completamente offline. Solo el auto-update (cuando hay nueva versión publicada en GitHub) requiere internet.

---

## 6. Referencia de archivos

```
sistema-docente/
├── electron/
│   ├── main.js          — Proceso principal: IPC handlers, ventana, backup, archivos adjuntos
│   ├── database.js      — Clase SistemaDB: esquema, queries, fórmulas
│   ├── preload.js       — Expone window.api.invoke() al renderer
│   └── updater.js       — Auto-update con electron-updater
│
├── src/
│   ├── App.jsx          — Router principal, state global (anio, curso, periodo, materia)
│   ├── pages/
│   │   ├── Dashboard.jsx        — Vista general, semáforo, estudiantes en riesgo
│   │   ├── Horario.jsx          — Grilla de horario semanal
│   │   ├── Cursos.jsx           — CRUD de cursos
│   │   ├── CursoEspacio.jsx     — Espacio privado del curso (notas, anotaciones, historial)
│   │   ├── Estudiantes.jsx      — Padrón, importación, cuaderno de observaciones
│   │   ├── Asistencia.jsx       — Registro diario y vista mensual
│   │   ├── Calificaciones.jsx   — Actividades, calificación simple/multi, resumen, PDFs
│   │   ├── Temario.jsx          — Temas, plan de clase, archivos adjuntos
│   │   ├── PlanClase.jsx        — Editor de metadatos del plan de clase
│   │   ├── Reportes.jsx         — Reporte grupal e individual con PDF
│   │   ├── Configuracion.jsx    — Parámetros globales, materias, años/períodos
│   │   └── Backup.jsx           — Exportar/importar BD, Excel, reset
│   └── components/
│       └── Layout.jsx           — Sidebar de navegación, selector de materia
│
├── scripts/
│   ├── README.md                — Descripción y uso de cada script
│   ├── backup-pre-migracion.py  — Backup antes de migrar datos
│   ├── backup-pre-limpieza.py   — Backup antes de limpiar datos de prueba
│   ├── migrar-nombres-competencias.py — Migra nombres antiguos a canónicos
│   ├── limpiar-datos-prueba.py  — Borra actividades/califs/temas/asistencias
│   ├── estado-bd-actual.py      — Diagnóstico de solo lectura de la BD
│   └── archivo/                 — Scripts de diagnóstico del desarrollo (histórico)
│
├── docs/
│   ├── HANDOVER_v1.5.0.md       — Este documento
│   └── index.html               — (placeholder)
│
├── public/
│   └── icon.ico                 — Icono de la app
│
├── release/                     — Distributable generado por electron-builder
├── dist/                        — Build de Vite (generado)
├── package.json                 — Dependencias + config electron-builder
├── vite.config.js               — Config de Vite
├── CHANGELOG.md                 — Historial de versiones
├── PRUEBAS-v1.5.0.md            — Checklist de pruebas manuales
└── README.md                    — (raíz del proyecto)
```

---

## 7. Mantenimiento y operación

### 7.1 Cómo correr en desarrollo

```powershell
# Instalar dependencias
npm install

# Iniciar modo desarrollo (Vite dev server + Electron)
npm run dev
```

Esto lanza Vite en `http://localhost:5173` y abre Electron apuntando a esa URL con DevTools abiertos.

### 7.2 Cómo generar el .exe

```powershell
# Build completo: Vite + electron-builder
npm run build-app
```

Genera en `release/`:
- `Sistema Académico Docente Setup X.X.X.exe` — instalador NSIS
- `win-unpacked/` — versión portable sin instalador

Requisitos: Node 20+, Windows 10+. La nativa `better-sqlite3` está precompilada para el módulo de Electron (NODE_MODULE_VERSION 121) y no requiere rebuild manual.

### 7.3 Cómo distribuir nuevas versiones

1. Incrementar versión en `package.json`
2. Actualizar `CHANGELOG.md`
3. Correr `npm run build-app`
4. Crear release en GitHub con el tag `vX.X.X`
5. Subir el `.exe` y `latest.yml` (generado por electron-builder) al release de GitHub
6. Las apps en producción detectan la nueva versión al arrancar via `electron-updater`

### 7.4 Auto-update (cómo funciona)

Implementado en `electron/updater.js`. Al iniciar la app en producción (`app.isPackaged = true`):

1. `electron-updater` consulta el repositorio de GitHub Releases configurado en `package.json`
2. Si hay versión mayor a la instalada, descarga el instalador en background
3. Al terminar la descarga, muestra una notificación al usuario para reiniciar e instalar

El repo de GitHub es: `NuevaAlianza/sistema-academico-docente` (configurado en `package.json` → `build.publish`).

### 7.5 Logs y debugging

- En desarrollo: DevTools abiertos automáticamente + `console.log` en main.js visible en la terminal
- En producción: logs de Electron en `%APPDATA%\sistema-academico-docente\logs\`
- Para debugging de BD: usar `scripts/estado-bd-actual.py` (solo lectura, no requiere que la app esté cerrada)

### 7.6 Migraciones de datos

Los scripts de `/scripts/` operan directamente sobre el archivo SQLite. **Siempre cerrar la app antes de ejecutarlos.**

Flujo recomendado para cualquier migración:

```powershell
# 1. Cerrar la app

# 2. Hacer backup
$env:PYTHONUTF8 = '1'; python scripts\backup-pre-migracion.py

# 3. Correr la migración
$env:PYTHONUTF8 = '1'; python scripts\migrar-nombres-competencias.py

# 4. Verificar resultado
$env:PYTHONUTF8 = '1'; python scripts\estado-bd-actual.py

# 5. Reabrir la app
```

`migrar-nombres-competencias.py` es idempotente: se puede correr más de una vez sin daño. Si todos los nombres ya son canónicos, reporta "sin cambio" para cada actividad.

---

## 8. Historial de versiones

| Versión | Fecha | Cambios principales |
|---|---|---|
| v1.2.0 | 2026-03-xx | Base pública inicial del sistema |
| v1.3.1 | 2026-04-xx | Fix BUG-08 (reporte individual filtra por materia), BUG-06 (clonar temas preserva contenido), BUG-02 (semáforos unificados), BUG-10 (window.open null) |
| v1.4.0 | 2026-05-xx | Modo multi-competencia: BD, IPC, selector, franja de peso, celda ajustable, PDF de período (pasos 1–5) |
| v1.4.1 | 2026-05-xx | Fix JSX PDF Multi, semVerde initialization, distribución equitativa sin float error, NaN en segunda actividad multi |
| v1.4.2 | 2026-06-06 | Pestaña resumen Multi separada, fix re-distribución al editar actividad, aviso antes de editar competencias, distribución equitativa corregida |
| v1.5.0 | 2026-06-08 | Flujo inverso multi (puntos → nota global), orden canónico fijo, labels en columnas, migración automática de nombres (Científica/Ética → canónicos), fix 3 bugs críticos backup (WAL export + WAL restore), scripts de mantenimiento con README |

---

## 9. Decisiones técnicas relevantes

### Por qué SQLite local (no LAN, no nube)

El usuario objetivo es un maestro individual en una PC personal. No existe infraestructura de servidor ni red confiable en muchos centros educativos de la región. SQLite es suficiente para un usuario, no requiere instalación de servidor, el archivo de BD es portable y el backup es tan simple como copiar el archivo. La integración LAN (con app de orientación) está en el roadmap pero es un proyecto separado.

### Por qué Electron (no PWA)

Se necesita acceso al sistema de archivos (guardar PDFs, adjuntos, backups) y compilación nativa de `better-sqlite3`. Las PWAs no pueden hacer acceso arbitrario a archivos sin la File System Access API, que aún no está disponible en todos los contextos. Electron da acceso completo al FS y al Node runtime.

### Por qué better-sqlite3 (síncrono vs sqlite3 async)

`better-sqlite3` expone una API síncrona que simplifica enormemente el código: no hay callbacks ni Promises en las queries. Dado que el main process de Electron es el único proceso que toca la BD, no hay riesgo de bloqueo. El modo WAL asegura que las escrituras no bloqueen las lecturas. La API `db.backup(dest)` de better-sqlite3 es la única forma correcta de hacer un backup atómico que incluya las transacciones pendientes del WAL.

### Por qué el flujo invertido del modo multi

La versión v1.4.x pedía primero la nota global y luego la distribución. Esto creaba confusión: el maestro no sabía si sus puntos por competencia sumaban la nota deseada, y la UI tenía que hacer ajustes opuestos. El flujo v1.5.0 invierte el orden: el maestro asigna puntos directamente a cada competencia, y la nota global se deriva automáticamente como suma. Así el maestro controla lo que realmente evalúa.

### Por qué techo por competencia (vs otras alternativas)

Alternativas consideradas:
1. Nota por competencia de 0 a 100, nota global = promedio → no refleja el "esfuerzo" asignado a cada competencia
2. Porcentaje libre por competencia → suma puede no llegar a 100, la UX sería confusa

El techo (`100 / n_comps`) garantiza que la nota global de la actividad sigue siendo del 0 al 100, que la distribución es equitativa por defecto, y que el maestro puede diferenciar el desempeño por competencia dentro de un rango claro y predecible.

### Por qué pestañas Simple/Multi separadas

Poner ambos modos en la misma lista creaba filas heterogéneas: algunas con una columna de nota y otras con 4 sub-columnas. La separación en pestañas permite una UX limpia y especializada para cada modo, y evita que el maestro mezcle accidentalmente contextos.

---

## 10. Issues conocidos / Próximos pasos

### Bugs menores no críticos

- El nombre de la actividad "aemana 6" (typo en datos) en el curso FIHR 2do B es un dato real ingresado por el maestro — no es un bug de la app
- El toast de confirmación post-restore pide reiniciar la app manualmente; no hay auto-reload
- La exportación a Excel no incluye el desglose de distribución multi (solo nota global por actividad)
- `limpiar-participacion` (IPC handler) no tiene botón en la UI — solo accesible via invocación directa

### Mejoras pendientes

- Auto-reload del renderer después de restore sin necesidad de reinicio manual
- Reporte PDF de asistencia independiente
- Exportación Excel con columnas de distribución multi
- Botón de UI para `limpiar-participacion`
- Validación de suma de pesos de configuración en tiempo real (actualmente solo se valida al guardar)

### Integración LAN (próximo proyecto)

Conectar esta app con la app de orientación vía red local para compartir el padrón de estudiantes y las notas finales de período, eliminando la doble entrada de datos entre docente y orientador.
