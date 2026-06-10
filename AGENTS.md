# AGENTS.md — Instrucciones para Claude Code
# Sistema Académico Docente

Léeme antes de tocar cualquier archivo del proyecto.

---

## Contexto rápido

- **Qué es**: app de escritorio Electron + React + SQLite offline-first para que un maestro lleve calificaciones, asistencia y temario.
- **Versión actual**: 1.5.0 — estabilizada, modo multi-competencia funcional.
- **4 competencias canónicas**: Comunicativa, Pensamiento Lógico, Cívica, Tecnológica.
- **Usuarios**: maestros no técnicos. Cada bug visible en UI es un problema real.

---

## Estructura de carpetas

```
sistema-docente/
├── electron/
│   ├── main.js          — IPC handlers, ventana, backup, archivos adjuntos
│   ├── database.js      — Clase SistemaDB: esquema, queries, fórmulas de cálculo
│   ├── preload.js       — Expone window.api.invoke() al renderer
│   └── updater.js       — Auto-update con electron-updater
│
├── src/
│   ├── App.jsx          — Router principal, estado global compartido
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Horario.jsx
│   │   ├── Cursos.jsx
│   │   ├── CursoEspacio.jsx
│   │   ├── Estudiantes.jsx
│   │   ├── Asistencia.jsx
│   │   ├── Calificaciones.jsx   ← módulo principal, más complejo
│   │   ├── Temario.jsx
│   │   ├── PlanClase.jsx
│   │   ├── Reportes.jsx
│   │   ├── Configuracion.jsx
│   │   └── Backup.jsx
│   └── components/
│       └── Layout.jsx           — Sidebar y selector de materia
│
├── scripts/                     — Scripts Python de mantenimiento de BD
│   ├── README.md
│   ├── backup-pre-migracion.py
│   ├── backup-pre-limpieza.py
│   ├── migrar-nombres-competencias.py
│   ├── limpiar-datos-prueba.py
│   ├── estado-bd-actual.py
│   └── archivo/                 — Scripts de diagnóstico históricos (no tocar)
│
├── AGENTS.md            — Este archivo
├── HANDOVER.md          — Estado actual del proyecto
├── TDR.md               — Diseño técnico detallado
├── PRD.md               — Requisitos del producto
├── CHANGELOG-v1.5.0.md  — Historial de cambios
└── package.json
```

---

## Convenciones de código

- **React funcional** con hooks. Sin clases, sin Redux.
- **Estado local** con `useState`. Sin contexto global de estado (el estado global vive en `App.jsx` y se pasa por props).
- **Llamadas a BD**: siempre vía `window.api.invoke('nombre-canal', datos)`. El renderer no accede a SQLite directamente.
- **Handler nuevo**: se registra en `electron/main.js` como `ipcMain.handle('nombre-canal', fn)`. La lógica de BD va en `electron/database.js`, no en `main.js`.
- **Sin comentarios superfluos**: solo cuando el "por qué" es no obvio.

---

## Reglas duras

### Competencias

- **Nunca hardcodear nombres**: usar la constante `COMPETENCIAS` en `Calificaciones.jsx`.
- `COMPETENCIAS_MULTI === COMPETENCIAS` — no duplicar ni crear un alias distinto.
- El orden es siempre fijo: Comunicativa → Pensamiento Lógico → Cívica → Tecnológica.
- Las claves internas en BD son **sin tilde**: `Comunicativa`, `Pensamiento Logico`, `Civica`, `Tecnologica`.
- Las competencias desconocidas se reportan con `console.warn(...)`, nunca se silencian con `filter`.

### Base de datos y migraciones

- **Antes de cualquier script que modifique datos**: crear backup en AppData con timestamp (usar `scripts/backup-pre-migracion.py` o equivalente).
- **Antes de borrar datos del usuario**: confirmar con el usuario en la conversación.
- Los scripts de migración deben ser **idempotentes** — correrlos más de una vez no debe romper nada.
- Toda `ADD COLUMN` nueva va en `migrarTablas()` en `database.js` con `IF NOT EXISTS`.

### Queries

- Toda query nueva debe filtrar por `materia_id`, `periodo_id` y `curso_id` donde aplique. Sin esto las notas de materias distintas se mezclan.
- Toda función de cálculo debe validar inputs: null, NaN, negativos.

### UI

- Los 4 slots de competencias deben ser siempre visibles. Las inactivas muestran `"—"` — no se ocultan.
- No cambiar el orden de las columnas de competencias.
- Toast de confirmación al guardar distribución multi.

---

## Workflow recomendado

1. Lee este `AGENTS.md`.
2. Lee `HANDOVER.md` para saber dónde quedó el usuario y qué está pendiente.
3. Lee `TDR.md` si vas a tocar BD, IPC o fórmulas de cálculo.
4. Antes de cualquier cambio en BD: crea un script de backup o corre `backup-pre-migracion.py`.
5. Commits pequeños y descriptivos (prefijo: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
6. Al terminar una tarea: actualiza `HANDOVER.md` con el nuevo estado.

---

## Scripts útiles

```powershell
# Desarrollo
npm run dev

# Build .exe
npm run build-app

# Ver estado de la BD (solo lectura, sin cerrar la app)
$env:PYTHONUTF8='1'; python scripts\estado-bd-actual.py

# Backup antes de migrar
$env:PYTHONUTF8='1'; python scripts\backup-pre-migracion.py

# Migrar nombres de competencias (idempotente)
$env:PYTHONUTF8='1'; python scripts\migrar-nombres-competencias.py
```

---

## Qué NO hacer

- No generar lógica de cálculo de notas en el renderer — eso va en `database.js`.
- No agregar dependencias sin preguntar al usuario.
- No borrar archivos de `scripts/archivo/` — son histórico de desarrollo.
- No hacer `git push` sin que el usuario lo pida explícitamente.
- No modificar `competencias_multi` o `distribucion_multi` en BD sin crear backup primero.
- No actualizar la versión en `package.json` hasta que el usuario confirme que está listo para release.
