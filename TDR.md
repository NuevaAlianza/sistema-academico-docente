# TDR — Technical Design Document
# Sistema Académico Docente

**Versión:** 1.5.0  
**Fecha:** 2026-06-08

---

## 1. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Shell de escritorio | Electron | 29 |
| UI | React | 18.2 |
| Router | React Router | 6.22 |
| Bundler | Vite | 5 |
| Base de datos | SQLite vía better-sqlite3 | 9.4 |
| PDF | jsPDF + jsPDF-AutoTable | 2.5 / 3.8 |
| Excel | SheetJS (xlsx) | 0.18 |
| Empaquetado | electron-builder (NSIS) | 24 |
| Auto-update | electron-updater | 6.8 |

---

## 2. Arquitectura

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
│  electron/database.js — clase SistemaDB          │
│                     │                           │
│          better-sqlite3 (API síncrona)           │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│     %APPDATA%\sistema-academico-docente\         │
│       sistema_docente.db   (modo WAL)            │
│       sistema_docente.db-wal / .db-shm           │
│       adjuntos\<timestamp>_<nombre>              │
└─────────────────────────────────────────────────┘
```

### Responsabilidades por archivo

| Archivo | Responsabilidad |
|---|---|
| `electron/main.js` | Ventana principal, todos los `ipcMain.handle()`, diálogos de archivo, backup, auto-update, carga de imágenes |
| `electron/database.js` | Clase `SistemaDB`: `initialize()`, `crearTablas()`, `migrarTablas()`, todas las queries y fórmulas de cálculo |
| `electron/preload.js` | Expone `window.api.invoke(canal, ...args)` al renderer vía `contextBridge` |
| `electron/updater.js` | Auto-update con `electron-updater` en modo producción (`app.isPackaged`) |
| `src/App.jsx` | Router principal, estado global compartido: `anioActivo`, `cursoSeleccionado`, `periodoSeleccionado`, `materiaActiva` |
| `src/pages/*.jsx` | Páginas de la app, lógica de UI |
| `src/components/Layout.jsx` | Sidebar de navegación y selector de materia activa |

### Rutas del sistema de archivos

| Qué | Dónde |
|---|---|
| BD activa | `%APPDATA%\sistema-academico-docente\sistema_docente.db` |
| Archivos adjuntos | `%APPDATA%\sistema-academico-docente\adjuntos\` |
| Logs Electron | `%APPDATA%\sistema-academico-docente\logs\` |
| Código fuente | `C:\Users\<user>\Documents\sistema-docente\` |
| Build distributable | `release\` |

---

## 3. Esquema de base de datos

La BD se inicializa en `initialize()` → `crearTablas()` y se actualiza con `migrarTablas()`. Modo WAL activo (`PRAGMA journal_mode = WAL`).

### anios_escolares
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | autoincrement |
| nombre | TEXT NOT NULL | Ej. "2025-2026" |
| fecha_inicio | TEXT | ISO 8601 |
| fecha_fin | TEXT | ISO 8601 |
| estado | TEXT | 'activo' / 'archivado' |

### periodos
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | autoincrement |
| anio_escolar_id | INTEGER NOT NULL | FK → anios_escolares |
| nombre | TEXT NOT NULL | 'P1'–'P4' |
| numero_orden | INTEGER NOT NULL | 1–4 |
| titulo | TEXT | Ej. "Primer Período" |
| fecha_inicio / fecha_fin | TEXT | ISO 8601 |
| estado | TEXT | 'abierto' / 'cerrado' |

### materias
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| anio_escolar_id | INTEGER NOT NULL | FK → anios_escolares |
| nombre | TEXT NOT NULL | |
| color | TEXT | Hex color |
| orden | INTEGER | |
| estado | TEXT | 'activo' / 'archivado' |

### cursos
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| anio_escolar_id | INTEGER NOT NULL | |
| nombre, grado, seccion | TEXT | |
| color | TEXT | |
| estado | TEXT | 'activo' / 'archivado' |

### estudiantes
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| curso_id | INTEGER NOT NULL | FK → cursos |
| codigo_unico | TEXT | Código externo opcional |
| numero_lista | INTEGER | |
| nombre_completo | TEXT NOT NULL | |
| estado | TEXT | 'activo' / 'inactivo' |

### actividades
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| materia_id | INTEGER | FK → materias |
| curso_id | INTEGER NOT NULL | FK → cursos |
| periodo_id | INTEGER NOT NULL | FK → periodos |
| nombre | TEXT NOT NULL | |
| tipo | TEXT | 'tarea' / 'evaluacion' / 'participacion' / 'proyecto' / 'otro' |
| competencia | TEXT | Solo modo='simple'. Ej. 'Comunicativa' |
| fecha | TEXT | ISO 8601 |
| peso | REAL | Default 1.0 |
| modo | TEXT | **'simple' / 'multi'** |
| competencias_multi | TEXT | **JSON array de claves canónicas** (solo modo='multi') |

### calificaciones
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| actividad_id | INTEGER NOT NULL | FK → actividades |
| estudiante_id | INTEGER NOT NULL | FK → estudiantes |
| nota | REAL | Nota global 0–100 |
| observacion | TEXT | |
| distribucion_multi | TEXT | **JSON `{comp: pts}`** (solo actividades multi) |
| UNIQUE | (actividad_id, estudiante_id) | |

### temas
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| materia_id, curso_id, periodo_id | INTEGER | FKs |
| orden | INTEGER | Para drag-reorder |
| titulo | TEXT NOT NULL | |
| contenido_texto | TEXT | Notas del tema |
| estado | TEXT | 'pendiente' / 'realizado' / 'aplazado' / 'tarea' |
| fecha_realizado / fecha_aplazado | TEXT | ISO 8601 |
| meta_json | TEXT | JSON con datos del plan de clase |

### asistencias
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| materia_id, estudiante_id, curso_id | INTEGER | FKs |
| fecha | TEXT NOT NULL | 'YYYY-MM-DD' |
| estado | TEXT | 'presente' / 'ausente' / 'tardanza' / 'excusado' |
| UNIQUE | (estudiante_id, fecha, materia_id) | |

### configuracion
| Columna | Tipo | Notas |
|---|---|---|
| clave | TEXT PK | |
| valor | TEXT NOT NULL | Siempre texto — convertir al leer |

**Claves relevantes:** `actividades_peso` (60), `participacion_peso` (20), `asistencia_peso` (10), `conducta_peso` (10), `minimo_aprobatorio` (70), `semaforo_verde` (80), `semaforo_amarillo` (60), `nombre_maestro`, `centro_educativo`, `materia_activa_id`.

### Otras tablas
`horario_asignaciones`, `observaciones`, `tema_archivos`, `curso_nota_rapida`, `curso_anotaciones`, `periodo_titulos`. Ver `electron/database.js → crearTablas()` para el DDL completo.

---

## 4. Modo Multi-Competencia — detalle técnico

### Campos en BD

- `actividades.modo`: `'simple'` o `'multi'`
- `actividades.competencias_multi`: JSON array de claves canónicas, ej. `["Comunicativa","Pensamiento Logico"]`
- `calificaciones.distribucion_multi`: JSON object `{clave: puntos}`, ej. `{"Comunicativa": 45.0, "Pensamiento Logico": 38.5}`
- `calificaciones.nota`: nota global = suma de `distribucion_multi` values

### Fórmulas

```js
// Techo por competencia (defaultDist en database.js)
techo = Math.round(100 / n_comps * 10) / 10
// Ej: 2 comps → 50.0 | 3 comps → 33.3 | 4 comps → 25.0

// Nota global de la actividad (notaFromDist en database.js)
nota = Math.round(Σ(dist[comp]) * 10) / 10

// Nota por competencia en una actividad (getResumenCompetenciasMultiPorEstudiante)
techo_calc = 100 / n_comps   // sin redondear en el divisor
nota_comp  = (puntos_comp / techo_calc) * 100

// Nota por competencia del período — por estudiante
peso_unit      = actividad.peso / n_comps
peso_evaluado  += peso_unit
suma_ponderada += nota_comp * peso_unit
nota_comp_periodo = Math.round(suma_ponderada / peso_evaluado)

// Nota por competencia del período — grupal (promedio del curso)
nota_comp_acto = promedio de nota_comp entre todos los estudiantes calificados
suma_ponderada += nota_comp_acto * peso_unit
nota_comp      = Math.round(suma_ponderada / peso_evaluado)
```

### Validaciones

- `val > techo + 0.01` → error, se rechaza el input (borde rojo)
- Sin valores negativos
- Redistribución automática a `defaultDist` cuando se editan las competencias de una actividad ya calificada

### Constante COMPETENCIAS (única fuente de verdad)

```js
// Definida en Calificaciones.jsx y referenciada en toda la UI
const COMPETENCIAS = [
  { key: 'Comunicativa',      label: 'Comunicativa',      icono: '💬', color: '#2563A8', fondo: '#D6E4F7' },
  { key: 'Pensamiento Logico',label: 'Pensamiento Lógico', icono: '🧠', color: '#00695C', fondo: '#D0EDE8' },
  { key: 'Civica',            label: 'Cívica',             icono: '🏛️', color: '#5C2D91', fondo: '#EDE0F7' },
  { key: 'Tecnologica',       label: 'Tecnológica',        icono: '💻', color: '#C84B00', fondo: '#FDECD7' },
];
// COMPETENCIAS_MULTI = COMPETENCIAS (no duplicar, no crear alias)
```

---

## 5. Migraciones aplicadas

Orden de ejecución para una BD nueva o en actualización:

| Orden | Script | Qué hace | Idempotente |
|---|---|---|---|
| 1 | `migrarTablas()` en `database.js` | Agrega columnas `modo`, `competencias_multi`, `distribucion_multi`, `materia_id`, `meta_json`, etc. vía `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | Sí |
| 2 | `scripts/migrar-flujo-techo.js` *(archivado)* | Recalculó distribuciones multi con el esquema de techo v1.4 | No aplicable a BDs nuevas |
| 3 | `scripts/limpiar-distribuciones.js` *(archivado)* | Corrigió claves desalineadas en `distribucion_multi` | No aplicable a BDs nuevas |
| 4 | `scripts/migrar-nombres-competencias.py` | Normaliza nombres antiguos (Científica → Pensamiento Logico, Ética → Tecnologica, elimina tildes de claves) | Sí |

Para BDs nuevas solo aplica el paso 1 (automático al iniciar la app). Los pasos 2–4 son únicamente para BDs que vienen de v1.3–v1.4.

---

## 6. Patrones de UI obligatorios

- Usar la constante `COMPETENCIAS` como única fuente de verdad para orden, claves y etiquetas.
- `COMPETENCIAS_MULTI === COMPETENCIAS` — no duplicar ni crear alias.
- Las 4 columnas de slots deben estar siempre visibles; columnas inactivas muestran `"—"` (no se ocultan).
- Competencias desconocidas: `console.warn(...)` en lugar de `filter` silencioso.
- Llamadas a BD siempre vía `window.api.invoke(canal, ...args)` — nunca lógica de BD en el renderer.

---

## 7. Scripts de utilidad

Ubicación: `scripts/`

| Script | Cómo ejecutar | Propósito |
|---|---|---|
| `backup-pre-migracion.py` | `$env:PYTHONUTF8='1'; python scripts\backup-pre-migracion.py` | Backup con timestamp antes de cualquier migración |
| `backup-pre-limpieza.py` | `$env:PYTHONUTF8='1'; python scripts\backup-pre-limpieza.py` | Backup antes de limpiar datos de prueba |
| `migrar-nombres-competencias.py` | `$env:PYTHONUTF8='1'; python scripts\migrar-nombres-competencias.py` | Normaliza claves de competencias a canónicos (idempotente) |
| `limpiar-datos-prueba.py` | `$env:PYTHONUTF8='1'; python scripts\limpiar-datos-prueba.py` | Borra actividades, calificaciones, temas y asistencias. **Irreversible.** |
| `estado-bd-actual.py` | `$env:PYTHONUTF8='1'; python scripts\estado-bd-actual.py` | Diagnóstico de solo lectura: conteos, actividades multi, auditoría de nombres |

**Regla:** cerrar la app antes de ejecutar cualquier script. Los scripts en `scripts/archivo/` son históricos de desarrollo — no usar en producción.

---

## 8. Build y distribución

### Desarrollo

```powershell
npm run dev
# Lanza Vite en http://localhost:5173 + Electron apuntando a esa URL con DevTools abiertos
```

### Generar .exe

```powershell
npm run build-app
# Equivale a: vite build && electron-builder
# Genera en release/:
#   Sistema Académico Docente Setup X.X.X.exe  — instalador NSIS
#   win-unpacked/                               — versión portable
```

### Ciclo de release

1. Incrementar `version` en `package.json`
2. Actualizar `CHANGELOG.md` o `CHANGELOG-v1.5.0.md`
3. `npm run build-app`
4. Crear release en GitHub con tag `vX.X.X`
5. Subir `.exe` y `latest.yml` (generado por electron-builder) al release
6. Las apps instaladas detectan la nueva versión al arrancar vía `electron-updater`

### Auto-update

Implementado en `electron/updater.js`. Solo activo en producción (`app.isPackaged === true`). Consulta `NuevaAlianza/sistema-academico-docente` en GitHub Releases. Si hay versión mayor, descarga en background y notifica al usuario para reiniciar.

La nativa `better-sqlite3` está precompilada para NODE_MODULE_VERSION 121 (Electron 29) y no requiere rebuild manual.
