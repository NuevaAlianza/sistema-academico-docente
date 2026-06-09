#!/usr/bin/env python3
"""
DIAGNÓSTICO COMPLETO del sistema de backup/restaurar.
Solo lectura del código y de los archivos.
"""
import sqlite3, json, os, sys, hashlib, re
from pathlib import Path
from datetime import datetime

DB_DIR    = Path(os.environ['APPDATA']) / 'sistema-academico-docente'
DB_ACTIVE = DB_DIR / 'sistema_docente.db'
PROJ_ROOT = Path(__file__).parent.parent

CANONICOS = {'Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'}
ANTIGUOS  = {'Científica', 'Ética', 'Cívica', 'Pensamiento Lógico', 'Tecnológica'}

def sep(ch='─', n=72): return ch * n
def hdr(t): print(f"\n{sep()}\n  {t}\n{sep()}")
def ok(m):   print(f"  ✅  {m}")
def warn(m): print(f"  ⚠️   {m}")
def err(m):  print(f"  ❌  {m}")
def ts(p):  return datetime.fromtimestamp(p.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
def kb(p):  return p.stat().st_size // 1024

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''): h.update(chunk)
    return h.hexdigest()

def leer_rango(path, patron_inicio, patron_fin, max_lineas=60):
    """Extrae bloque de código entre línea que matchea inicio y la que matchea fin."""
    lines = Path(path).read_text(encoding='utf-8').splitlines()
    resultado, dentro, n = [], False, 0
    for ln in lines:
        if not dentro and re.search(patron_inicio, ln):
            dentro = True
        if dentro:
            resultado.append(ln)
            n += 1
            if n > 2 and re.search(patron_fin, ln):
                break
            if n >= max_lineas:
                resultado.append('  ... (truncado)')
                break
    return '\n'.join(resultado)

def analizar_db(path):
    """Abre un .db en solo lectura y devuelve dict con métricas."""
    res = {'ok': False, 'actividades': 0, 'act_multi': 0, 'act_simple': 0,
           'calificaciones': 0, 'estudiantes': 0, 'temas': 0, 'asistencias': 0,
           'nombres_multi': set(), 'nombres_dist': set(), 'nombres_simple': set(),
           'schema_desconocido': False}
    try:
        con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        def q1(sql):
            try:
                r = con.execute(sql).fetchone()
                return r[0] if r else 0
            except: return None

        # Verificar que tiene el schema esperado
        tablas = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if 'actividades' not in tablas:
            res['schema_desconocido'] = True
            res['ok'] = True
            res['tablas_encontradas'] = sorted(tablas)
            con.close()
            return res

        res['ok']            = True
        res['actividades']   = q1("SELECT COUNT(*) FROM actividades") or 0
        res['act_multi']     = q1("SELECT COUNT(*) FROM actividades WHERE modo='multi'") or 0
        res['act_simple']    = q1("SELECT COUNT(*) FROM actividades WHERE modo='simple'") or 0
        res['calificaciones']= q1("SELECT COUNT(*) FROM calificaciones") or 0
        res['estudiantes']   = q1("SELECT COUNT(*) FROM estudiantes") or 0
        res['temas']         = q1("SELECT COUNT(*) FROM temas") or 0
        res['asistencias']   = q1("SELECT COUNT(*) FROM asistencias") or 0

        rows = con.execute("SELECT DISTINCT competencia FROM actividades WHERE modo='simple' AND competencia IS NOT NULL").fetchall()
        res['nombres_simple'] = {r[0] for r in rows}

        rows = con.execute("SELECT competencias_multi FROM actividades WHERE modo='multi' AND competencias_multi IS NOT NULL").fetchall()
        for r in rows:
            try:
                for k in json.loads(r[0]): res['nombres_multi'].add(k)
            except: pass

        rows = con.execute("SELECT distribucion_multi FROM calificaciones WHERE distribucion_multi IS NOT NULL").fetchall()
        for r in rows:
            try:
                for k in json.loads(r[0]).keys(): res['nombres_dist'].add(k)
            except: pass

        con.close()
    except Exception as e:
        res['error'] = str(e)
    return res

def clasificar_nombres(nombres):
    can = sorted(n for n in nombres if n in CANONICOS)
    ant = sorted(n for n in nombres if n in ANTIGUOS)
    unk = sorted(n for n in nombres if n not in CANONICOS and n not in ANTIGUOS)
    partes = []
    if can: partes.append('canónicos: ' + ', '.join(can))
    if ant: partes.append('⚠️ ANTIGUOS: ' + ', '.join(ant))
    if unk: partes.append('❓ desconocidos: ' + ', '.join(unk))
    return '  |  '.join(partes) if partes else '(vacío)'

# ════════════════════════════════════════════════════════════════════════════
# 1. CÓDIGO DEL HANDLER DE BACKUP en electron/main.js
# ════════════════════════════════════════════════════════════════════════════
hdr("1. HANDLERS DE BACKUP — electron/main.js")

MAIN_JS = PROJ_ROOT / 'electron' / 'main.js'
if not MAIN_JS.exists():
    err(f"No encontrado: {MAIN_JS}"); sys.exit(1)

handlers = {
    'backup-exportar-bd':   (r"backup-exportar-bd",  r"^\}\);"),
    'backup-seleccionar-bd':(r"backup-seleccionar-bd",r"^\}\);"),
    'backup-importar-bd':   (r"backup-importar-bd",   r"^\}\);"),
    'backup-reset-bd':      (r"backup-reset-bd",      r"^\}\);"),
}
for nombre, (pat_ini, pat_fin) in handlers.items():
    print(f"\n  ── {nombre} ──")
    codigo = leer_rango(MAIN_JS, pat_ini, pat_fin)
    for ln in codigo.splitlines():
        print(f"    {ln}")

# Análisis de lo que hace cada handler
print(f"\n  {sep('·')}")
print(f"  ANÁLISIS:")
print(f"  backup-exportar-bd   : fs.copyFileSync(userData/sistema_docente.db → elegido por usuario)")
print(f"                         ⚠️  Solo copia el .db — NO copia el .wal ni el .shm")
print(f"  backup-importar-bd   : db.cerrar() → copyFileSync(backup → userData/sistema_docente.db) → db.initialize()")
print(f"                         ⚠️  NO elimina .wal ni .shm antes de copiar")
print(f"                         ⚠️  Si el .wal contiene cambios post-backup, se replayan encima del restore")
print(f"  db.cerrar()          : better-sqlite3 .close() → intenta checkpoint WAL, pero solo si es la ÚNICA conexión")
print(f"  db.initialize()      : PRAGMA journal_mode=WAL → si existe un .wal viejo lo REPLAY automáticamente")

# ════════════════════════════════════════════════════════════════════════════
# 2. CÓDIGO DEL UI DE BACKUP — src/pages/Backup.jsx
# ════════════════════════════════════════════════════════════════════════════
hdr("2. UI DE BACKUP — src/pages/Backup.jsx")

BACKUP_JSX = PROJ_ROOT / 'src' / 'pages' / 'Backup.jsx'
if not BACKUP_JSX.exists():
    err(f"No encontrado: {BACKUP_JSX}")
else:
    # Mostrar funciones clave
    for fn_name, pat in [('exportarBD', r'async function exportarBD'), ('seleccionarBD/confirmarImportar', r'async function seleccionarBD')]:
        print(f"\n  ── {fn_name} ──")
        bloque = leer_rango(BACKUP_JSX, pat, r'^\s{2}\}', max_lineas=25)
        for ln in bloque.splitlines():
            print(f"    {ln}")

    print(f"\n  {sep('·')}")
    print(f"  ANÁLISIS UI:")
    print(f"  Exportar   : abre save-dialog → llama backup-exportar-bd → toast con ruta")
    print(f"  Restaurar  : abre open-dialog → muestra modal confirmación con ruta → llama backup-importar-bd")
    print(f"  Toast post-restore: '✅ Base de datos restaurada. Reinicia la aplicación para ver los cambios.'")
    print(f"  Advertencia UI: 'Restaurar reemplaza todos los datos actuales. Esta acción no se puede deshacer.'")
    print(f"  Validaciones: NINGUNA — no verifica que el .db sea válido ni su contenido antes de restaurar")
    print(f"  Post-restauración: NO recarga automáticamente — el usuario debe reiniciar manualmente")

# ════════════════════════════════════════════════════════════════════════════
# 3. LISTADO Y ANÁLISIS DE TODOS LOS BACKUPS
# ════════════════════════════════════════════════════════════════════════════
hdr("3. TODOS LOS ARCHIVOS .db EN EL DIRECTORIO DE DATOS")

todos_db = sorted(
    [f for f in DB_DIR.iterdir() if f.suffix == '.db'],
    key=lambda f: f.stat().st_mtime, reverse=True
)

print(f"  Directorio: {DB_DIR}\n")

md5_activo = md5(DB_ACTIVE) if DB_ACTIVE.exists() else None

for f in todos_db:
    es_activo = f.name == 'sistema_docente.db'
    tag       = ' ← ACTIVO' if es_activo else ''
    m         = md5(f)
    igual     = ' [≡ idéntico al activo]' if (not es_activo and m == md5_activo) else ''
    print(f"\n  {'━'*65}")
    print(f"  📄 {f.name}{tag}")
    print(f"     Tamaño : {kb(f)} KB  |  Fecha: {ts(f)}")
    print(f"     MD5    : {m}{igual}")

    info = analizar_db(f)
    if not info['ok']:
        print(f"     ⚠️  No se pudo abrir: {info.get('error','?')}")
        continue

    print(f"     actividades : {info['actividades']} (simple={info['act_simple']} multi={info['act_multi']})")
    print(f"     calificaciones: {info['calificaciones']}  |  estudiantes: {info['estudiantes']}")
    print(f"     temas: {info['temas']}  |  asistencias: {info['asistencias']}")

    todos_nombres = info['nombres_multi'] | info['nombres_dist'] | info['nombres_simple']
    tiene_ant = bool(todos_nombres & ANTIGUOS)
    tiene_can = bool(todos_nombres & CANONICOS)
    estado_nombres = ('⚠️ TIENE NOMBRES ANTIGUOS' if tiene_ant else '✅ solo canónicos') if todos_nombres else '(sin actividades)'
    print(f"     Nombres: {estado_nombres}")
    if todos_nombres:
        print(f"       multi   : {clasificar_nombres(info['nombres_multi'])}")
        print(f"       dist    : {clasificar_nombres(info['nombres_dist'])}")

# Archivos WAL / SHM
print(f"\n  {'━'*65}")
print(f"  Archivos WAL/SHM:")
for ext in ['-wal', '-shm']:
    p = DB_DIR / ('sistema_docente.db' + ext)
    if p.exists():
        warn(f"{p.name}  {kb(p)} KB  — app abierta o restore incompleto")
    else:
        ok(f"sistema_docente.db{ext}  (no existe — WAL limpio)")

# ════════════════════════════════════════════════════════════════════════════
# 4. COMPARACIÓN DE BACKUPS
# ════════════════════════════════════════════════════════════════════════════
hdr("4. COMPARACIÓN DE BACKUPS")

backups = [f for f in todos_db if f.name != 'sistema_docente.db' and f.name.endswith('.db')]
backups_datos = {f: analizar_db(f) for f in backups}

if not backups:
    print("  (ningún backup encontrado)")
else:
    print(f"  {'Archivo':<50}  {'Acts':>5}  {'Califs':>7}  {'Nombres'}")
    print(f"  {'─'*50}  {'─'*5}  {'─'*7}  {'─'*30}")
    for f, info in backups_datos.items():
        if not info['ok']: continue
        todos_nom = info['nombres_multi'] | info['nombres_dist']
        tiene_ant = bool(todos_nom & ANTIGUOS)
        noms_tag  = '⚠️ ANTIGUOS' if tiene_ant else '✅ canónicos' if todos_nom else '(vacío)'
        activo_tag = ' ← idéntico al activo' if md5(f) == md5_activo else ''
        print(f"  {f.name:<50}  {info['actividades']:>5}  {info['calificaciones']:>7}  {noms_tag}{activo_tag}")

    print(f"\n  Estado BD activa:")
    info_act = analizar_db(DB_ACTIVE) if DB_ACTIVE.exists() else {'ok': False}
    if info_act['ok']:
        todos_nom = info_act['nombres_multi'] | info_act['nombres_dist']
        tiene_ant = bool(todos_nom & ANTIGUOS)
        print(f"    actividades={info_act['actividades']}  califs={info_act['calificaciones']}  "
              f"nombres: {'⚠️ INCLUYE ANTIGUOS' if tiene_ant else '✅ canónicos'}")
        if tiene_ant:
            ant_en_act = sorted(todos_nom & ANTIGUOS)
            warn(f"Nombres antiguos presentes: {ant_en_act}")
            warn(f"→ La migración de nombres NO se ha aplicado a la BD activa")

# ════════════════════════════════════════════════════════════════════════════
# 5. ANOMALÍAS DEL SISTEMA DE BACKUP/RESTAURAR
# ════════════════════════════════════════════════════════════════════════════
hdr("5. ANOMALÍAS DETECTADAS EN EL SISTEMA")

anomalias = []

# 5a. WAL no manejado en exportar
anomalias.append({
    'sev': '⚠️  CRÍTICO',
    'titulo': 'backup-exportar-bd no copia el WAL',
    'detalle': (
        "fs.copyFileSync(origen, filePath) copia solo el .db principal.\n"
        "    Si hay cambios pendientes en el WAL (app abierta con datos recientes),\n"
        "    el backup NO incluye esos cambios. El backup quedará en un estado\n"
        "    anterior al momento del guardado."
    )
})

# 5b. WAL no eliminado en restaurar
anomalias.append({
    'sev': '⚠️  CRÍTICO',
    'titulo': 'backup-importar-bd NO elimina .wal / .shm antes de restaurar',
    'detalle': (
        "Flujo actual:\n"
        "    1. db.cerrar()  →  better-sqlite3 .close() intenta checkpoint del WAL\n"
        "    2. fs.copyFileSync(backup → sistema_docente.db)  ← copia el backup\n"
        "    3. db.initialize()  ← re-abre la BD (WAL mode)\n"
        "\n"
        "    PROBLEMA: si el WAL no fue completamente checkpointed (conexión Python\n"
        "    activa, bloqueo, o fallo silencioso), el archivo .wal permanece con\n"
        "    frames del estado ANTERIOR al restore. Cuando db.initialize() abre\n"
        "    la BD recién copiada, SQLite ve el .wal existente y lo REPLAY\n"
        "    automáticamente, sobreescribiendo el backup restaurado con datos\n"
        "    del estado viejo.\n"
        "\n"
        "    SOLUCIÓN: eliminar .wal y .shm después de db.cerrar() y antes de\n"
        "    db.initialize():\n"
        "      const wal = destino + '-wal'\n"
        "      const shm = destino + '-shm'\n"
        "      if (fs.existsSync(wal)) fs.unlinkSync(wal)\n"
        "      if (fs.existsSync(shm)) fs.unlinkSync(shm)"
    )
})

# 5c. Sin checkpoint forzado al exportar
anomalias.append({
    'sev': '⚠️  MODERADO',
    'titulo': 'backup-exportar-bd no fuerza WAL checkpoint antes de copiar',
    'detalle': (
        "Al exportar, si la app tiene datos en el WAL no checkpointed, la copia\n"
        "    del .db puede estar incompleta (missing committed frames still in WAL).\n"
        "    Solución: ejecutar PRAGMA wal_checkpoint(FULL) antes del copyFileSync,\n"
        "    o usar la API de backup de SQLite (sqlite3_backup_init) que garantiza\n"
        "    una copia consistente. better-sqlite3 lo expone como db.backup(dest)."
    )
})

# 5d. Sin validación del archivo antes de restaurar
anomalias.append({
    'sev': 'ℹ️   MENOR',
    'titulo': 'No hay validación del archivo antes de restaurar',
    'detalle': (
        "La UI solo verifica que el usuario seleccionó un archivo .db.\n"
        "    No verifica: ¿es un SQLite válido? ¿tiene las tablas esperadas?\n"
        "    ¿es compatible con la versión del schema actual?"
    )
})

# 5e. Sin recarga automática post-restauración
anomalias.append({
    'sev': 'ℹ️   MENOR',
    'titulo': 'Post-restauración requiere reinicio manual',
    'detalle': (
        "El toast dice 'Reinicia la aplicación para ver los cambios.' pero la\n"
        "    app podría recargar automáticamente con app.relaunch() + app.exit(0)\n"
        "    para evitar que el usuario trabaje con datos desactualizados en memoria."
    )
})

for a in anomalias:
    print(f"\n  {a['sev']} — {a['titulo']}")
    for ln in a['detalle'].splitlines():
        print(f"    {ln}")

print(f"\n  RESUMEN: {sum(1 for a in anomalias if 'CRÍTICO' in a['sev'])} críticas, "
      f"{sum(1 for a in anomalias if 'MODERADO' in a['sev'])} moderadas, "
      f"{sum(1 for a in anomalias if 'MENOR' in a['sev'])} menores")

print(f"\n{sep('═')}\n  FIN DEL DIAGNÓSTICO\n{sep('═')}\n")
