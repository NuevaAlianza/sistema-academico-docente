# Scripts de mantenimiento

Scripts Python para mantenimiento y administración de la base de datos.
Todos operan directamente sobre el archivo SQLite en AppData — **cerrar la app antes de ejecutarlos**.

```
$env:PYTHONUTF8 = '1'; python scripts\<nombre>.py
```

---

## backup-pre-migracion.py

Crea un backup con timestamp antes de cualquier migración de datos.

**Cuándo usarlo:** siempre antes de correr `migrar-nombres-competencias.py`
o cualquier otro script que modifique la BD.

**Genera:** `backup_pre_migracion_nombres_YYYYMMDD_HHMMSS.db` en AppData.

---

## backup-pre-limpieza.py

Crea un backup antes de eliminar datos de prueba.

**Cuándo usarlo:** antes de correr `limpiar-datos-prueba.py`.

**Genera:** `backup_pre_limpieza_v15_YYYYMMDD_HHMMSS.db` en AppData.

---

## migrar-nombres-competencias.py

Migra nombres de competencias con tilde o nombres antiguos a los nombres
canónicos que usa la app (`Comunicativa`, `Pensamiento Logico`, `Civica`,
`Tecnologica`).

Afecta tres campos:
- `actividades.competencias_multi`
- `actividades.competencia`
- `calificaciones.distribucion_multi`

**Cuándo usarlo:** si la BD contiene nombres como `Científica`, `Ética`,
`Cívica`, `Pensamiento Lógico`, `Tecnológica` (detectables con
`estado-bd-actual.py` sección 7).

**Precaución:** ejecutar `backup-pre-migracion.py` primero.

---

## limpiar-datos-prueba.py

Elimina todas las actividades, calificaciones, temas y asistencias.
Preserva la estructura: estudiantes, cursos, materias, períodos,
años escolares y configuración.

**Cuándo usarlo:** para dejar la BD limpia antes de comenzar a ingresar
datos reales (p. ej., al pasar de pruebas a producción).

**Precaución:** operación destructiva e irreversible. Ejecutar
`backup-pre-limpieza.py` primero.

---

## estado-bd-actual.py

Diagnóstico de solo lectura. Muestra:

1. Metadatos del archivo de BD (ruta, fecha, tamaño, WAL presente)
2. Backups disponibles en AppData con fechas
3. Conteos por tabla
4. Detalle de actividades multi (competencias, techo, calificaciones)
5. Auditoría de nombres de competencias en los tres campos relevantes
6. Cursos con cantidad de estudiantes y actividades

**Cuándo usarlo:** para verificar el estado de la BD en cualquier momento,
especialmente tras una migración o restauración de backup.

---

## archivo/

Contiene scripts de diagnóstico usados durante el desarrollo de v1.4–v1.5.
No se necesitan en producción, pero se conservan como referencia histórica.

| Script | Propósito original |
|---|---|
| `diagnostico-multi.js` | Verificar calificaciones multi en período activo |
| `verificar-distribucion-manual.js` | Comprobar que dist manual respeta el techo |
| `diagnostico-post-eliminar.js/.py` | Integridad post-eliminación de actividad multi |
| `diag-fihr-p1.js/.py` | Diagnóstico puntual curso FIHR 2do B período P1 |
| `sondeo-p1-fihr.py` | Comparar BD vs valores esperados FIHR P1 |
| `diag-backup-system.py` | Auditoría del sistema de backup/restaurar |
| `verificar-backup-reciente.py` | Validar MD5 y contenido de un backup específico |
| `migrar-flujo-techo.js` | Migración BD para refactor flujo inverso v1.4 |
| `limpiar-distribuciones.js` | Corrección de keys en distribucion_multi |

---

## sembrar-prueba-reportes.js

Siembra datos de prueba en 6to (año activo, P1, primera materia del año) para revisar Reportes:
8 temas por sección (5 realizados, 1 aplazado, 2 pendientes), 5 actividades (4 simples, una por
competencia, y 1 multi con las 4) vinculadas a temas, notas con perfiles variados (van bien, límite,
bajo, sin calificar, muchas faltas), asistencia desde el 24-sep hasta hoy **solo en días sin registro**
y 5 observaciones del cuaderno anecdótico por sección (texto con prefijo `[Prueba]`).

Usa los métodos de `database.js`, así que corre con el Electron del proyecto (no con Python).
Todo lo creado se anota en `datos_prueba_reportes.json` (en AppData) y `--limpiar` lo borra.
No vuelve a sembrar si ya hay datos registrados.

```
$env:ELECTRON_RUN_AS_NODE='1'; .\node_modules\electron\dist\electron.exe scripts\sembrar-prueba-reportes.js
$env:ELECTRON_RUN_AS_NODE='1'; .\node_modules\electron\dist\electron.exe scripts\sembrar-prueba-reportes.js --limpiar
```

**Antes:** `backup-pre-migracion.py`.
