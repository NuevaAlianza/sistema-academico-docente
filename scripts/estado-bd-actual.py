#!/usr/bin/env python3
"""
DIAGNÓSTICO — Estado actual de la BD post-restauración.
Solo lectura.
"""
import sqlite3, json, os, sys
from pathlib import Path
from datetime import datetime

DB_DIR  = Path(os.environ['APPDATA']) / 'sistema-academico-docente'
DB_PATH = DB_DIR / 'sistema_docente.db'

CANONICOS = {'Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'}
ANTIGUOS  = {'Científica', 'Ética', 'Cívica', 'Pensamiento Lógico', 'Tecnológica'}

def sep(ch='─', n=72): return ch * n
def hdr(t): print(f"\n{sep()}\n  {t}\n{sep()}")
def ts(path): return datetime.fromtimestamp(path.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
def kb(path): return path.stat().st_size // 1024

# ── 1-3. Archivo BD ───────────────────────────────────────────────────────────
hdr("1-3. ARCHIVO DE BD")
if not DB_PATH.exists():
    print(f"  ❌  No se encontró: {DB_PATH}"); sys.exit(1)
print(f"  Ruta    : {DB_PATH}")
print(f"  Fecha   : {ts(DB_PATH)}")
print(f"  Tamaño  : {kb(DB_PATH)} KB")

# Archivos WAL / SHM
for ext in ['-wal', '-shm']:
    p = DB_DIR / ('sistema_docente.db' + ext)
    if p.exists():
        print(f"  ⚠️   {p.name:<30} {kb(p):>6} KB  (WAL presente — app puede estar abierta)")

# ── 4. Backups disponibles ────────────────────────────────────────────────────
hdr("4. BACKUPS DISPONIBLES")
backups = sorted(
    [f for f in DB_DIR.iterdir() if f.suffix == '.db' and f.name != 'sistema_docente.db'],
    key=lambda f: f.stat().st_mtime, reverse=True
)
if not backups:
    print("  (ningún backup encontrado)")
else:
    print(f"  {'Archivo':<55}  {'KB':>6}  Fecha")
    print(f"  {'─'*55}  {'─'*6}  {'─'*19}")
    for b in backups:
        marca = '  ← MÁS RECIENTE' if b == backups[0] else ''
        print(f"  {b.name:<55}  {kb(b):>6}  {ts(b)}{marca}")

# ── Conectar BD ───────────────────────────────────────────────────────────────
con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
con.row_factory = sqlite3.Row

def q(sql, *args):
    return con.execute(sql, args).fetchall()

def q1(sql, *args):
    r = con.execute(sql, args).fetchone()
    return r[0] if r else 0

# ── 5. Conteos por tabla ──────────────────────────────────────────────────────
hdr("5. CONTEOS POR TABLA")

tablas = [
    ('estudiantes',    "SELECT COUNT(*) FROM estudiantes"),
    ('cursos',         "SELECT COUNT(*) FROM cursos"),
    ('materias',       "SELECT COUNT(*) FROM materias"),
    ('periodos',       "SELECT COUNT(*) FROM periodos"),
    ('actividades',    "SELECT COUNT(*) FROM actividades"),
    ('  modo simple',  "SELECT COUNT(*) FROM actividades WHERE modo='simple'"),
    ('  modo multi',   "SELECT COUNT(*) FROM actividades WHERE modo='multi'"),
    ('calificaciones', "SELECT COUNT(*) FROM calificaciones"),
    ('  con dist_multi',"SELECT COUNT(*) FROM calificaciones WHERE distribucion_multi IS NOT NULL"),
    ('temas',          "SELECT COUNT(*) FROM temas"),
    ('asistencias',    "SELECT COUNT(*) FROM asistencias"),
    ('configuracion',  "SELECT COUNT(*) FROM configuracion"),
]
for nombre, sql in tablas:
    try:
        n = q1(sql)
        print(f"  {nombre:<25} {n:>6}")
    except Exception as e:
        print(f"  {nombre:<25}  ⚠️  {e}")

# ── 6. Actividades multi detalle ──────────────────────────────────────────────
hdr("6. ACTIVIDADES MULTI (detalle)")

acts_multi = q("""
    SELECT a.id, a.nombre, a.curso_id, a.periodo_id, a.peso,
           a.competencias_multi, c.nombre AS curso, p.nombre AS periodo
    FROM actividades a
    LEFT JOIN cursos c ON a.curso_id = c.id
    LEFT JOIN periodos p ON a.periodo_id = p.id
    WHERE a.modo = 'multi'
    ORDER BY a.curso_id, a.periodo_id, a.id
""")

if not acts_multi:
    print("  (ninguna actividad multi)")
else:
    print(f"  Total: {len(acts_multi)} actividades multi\n")
    for act in acts_multi:
        comps = json.loads(act['competencias_multi']) if act['competencias_multi'] else []
        n_califs = q1("SELECT COUNT(*) FROM calificaciones WHERE actividad_id=?", act['id'])
        n_comps  = len(comps)
        techo    = round(100/n_comps*10)/10 if n_comps else 0
        print(f"  id={act['id']:>4}  {act['nombre']:<20}  curso={act['curso']:<20}  per={act['periodo']}"
              f"  peso={act['peso']}  n_comps={n_comps}  techo={techo}  califs={n_califs}")
        print(f"          comps: {comps}")

# ── 7. Nombres de competencias en BD ─────────────────────────────────────────
hdr("7. NOMBRES DE COMPETENCIAS EN BD")

def marcar(nombre):
    if nombre in CANONICOS: return '✅ canónico'
    if nombre in ANTIGUOS:  return '⚠️  ANTIGUO'
    return '❓ desconocido'

# 7a. actividades.competencia (simple)
print("\n  [a] actividades.competencia (modo simple):")
rows = q("SELECT DISTINCT competencia FROM actividades WHERE modo='simple' AND competencia IS NOT NULL ORDER BY competencia")
if not rows:
    print("    (ninguna)")
else:
    for r in rows:
        print(f"    {r[0]:<30}  {marcar(r[0])}")

# 7b. actividades.competencias_multi
print("\n  [b] actividades.competencias_multi (keys en arrays):")
rows_multi = q("SELECT competencias_multi FROM actividades WHERE modo='multi' AND competencias_multi IS NOT NULL")
nombres_multi = set()
for r in rows_multi:
    try:
        for k in json.loads(r[0]): nombres_multi.add(k)
    except: pass
if not nombres_multi:
    print("    (ninguna)")
else:
    for n in sorted(nombres_multi):
        print(f"    {n:<30}  {marcar(n)}")

# 7c. calificaciones.distribucion_multi (keys en JSON)
print("\n  [c] calificaciones.distribucion_multi (keys en JSONs):")
rows_califs = q("SELECT distribucion_multi FROM calificaciones WHERE distribucion_multi IS NOT NULL")
nombres_dist = set()
for r in rows_califs:
    try:
        for k in json.loads(r[0]).keys(): nombres_dist.add(k)
    except: pass
if not nombres_dist:
    print("    (ninguna)")
else:
    for n in sorted(nombres_dist):
        print(f"    {n:<30}  {marcar(n)}")

# ── 8. Cursos con datos ───────────────────────────────────────────────────────
hdr("8. CURSOS CON DATOS")

cursos = q("""
    SELECT c.id, c.nombre, c.seccion, c.grado, a.nombre AS anio
    FROM cursos c
    LEFT JOIN anios_escolares a ON c.anio_escolar_id = a.id
    ORDER BY a.id DESC, c.nombre
""")

print(f"  {'ID':>4}  {'Curso':<28}  {'Sec':>4}  {'Estudiantes':>11}  {'Actividades':>11}")
print(f"  {'─'*4}  {'─'*28}  {'─'*4}  {'─'*11}  {'─'*11}")
for c in cursos:
    n_est  = q1("SELECT COUNT(*) FROM estudiantes WHERE curso_id=?", c['id'])
    n_acts = q1("SELECT COUNT(*) FROM actividades WHERE curso_id=?", c['id'])
    marca  = '' if n_acts == 0 else '  ← tiene actividades'
    print(f"  {c['id']:>4}  {c['nombre']:<28}  {c['seccion']:>4}  {n_est:>11}  {n_acts:>11}{marca}")

con.close()
print(f"\n{sep('═')}\n  FIN DEL DIAGNÓSTICO\n{sep('═')}\n")
