#!/usr/bin/env python3
"""
Verifica que un backup recién creado desde la app:
  1. Tiene MD5 diferente a todos los backups anteriores.
  2. Al abrirlo con SQLite, contiene solo nombres canónicos.
  3. Tiene un tamaño razonable (>= 50 KB).

Uso:
  python scripts\verificar-backup-reciente.py <ruta_del_backup.db>
  python scripts\verificar-backup-reciente.py   ← busca el más reciente automáticamente
"""
import sqlite3, json, os, sys, hashlib
from pathlib import Path
from datetime import datetime

DB_DIR     = Path(os.environ['APPDATA']) / 'sistema-academico-docente'
DB_MAIN    = DB_DIR / 'sistema_docente.db'
CANONICOS  = {'Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'}

OK  = '  ✅'
ERR = '  ❌'
WRN = '  ⚠️ '

def sep(ch='─', n=72): return ch * n
def hdr(t): print(f"\n{sep()}\n  {t}\n{sep()}")
def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''): h.update(chunk)
    return h.hexdigest()

# ── Resolver ruta del backup ──────────────────────────────────────────────────
if len(sys.argv) >= 2:
    target = Path(sys.argv[1])
    if not target.exists():
        # Intentar relativo a DB_DIR
        target = DB_DIR / sys.argv[1]
    if not target.exists():
        print(f"❌  Archivo no encontrado: {sys.argv[1]}"); sys.exit(1)
else:
    # Auto: backup más reciente (excluye sistema_docente.db y supervisor.db)
    candidatos = [
        f for f in DB_DIR.iterdir()
        if f.suffix == '.db'
        and f.name != 'sistema_docente.db'
        and f.name != 'supervisor.db'
    ]
    if not candidatos:
        print("❌  No se encontró ningún backup en", DB_DIR); sys.exit(1)
    target = max(candidatos, key=lambda f: f.stat().st_mtime)
    print(f"  (sin argumento — usando el backup más reciente)")

ts  = datetime.fromtimestamp(target.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
kb  = target.stat().st_size // 1024
h_target = md5(target)

print(f"\n{'═'*72}")
print(f"  VERIFICACIÓN DE BACKUP")
print(f"{'═'*72}")
print(f"  Archivo : {target.name}")
print(f"  Ruta    : {target}")
print(f"  Fecha   : {ts}")
print(f"  Tamaño  : {kb} KB")
print(f"  MD5     : {h_target}")

errores = 0

# ── CHECK 1 — Tamaño razonable ────────────────────────────────────────────────
hdr("CHECK 1 — Tamaño razonable (>= 50 KB)")
if kb >= 50:
    print(f"{OK}  {kb} KB — tamaño OK")
else:
    print(f"{ERR}  {kb} KB — demasiado pequeño (esperado >= 50 KB)")
    errores += 1

# ── CHECK 2 — MD5 diferente a backups anteriores ─────────────────────────────
hdr("CHECK 2 — MD5 diferente a otros backups")

otros = [
    f for f in DB_DIR.iterdir()
    if f.suffix == '.db'
    and f.name != 'supervisor.db'
    and f.resolve() != target.resolve()
]

if not otros:
    print(f"{WRN}  No hay otros backups para comparar")
else:
    print(f"  {'Archivo':<52}  {'MD5 igual?':>10}")
    print(f"  {'─'*52}  {'─'*10}")
    duplicados = []
    for f in sorted(otros, key=lambda x: x.stat().st_mtime, reverse=True):
        h = md5(f)
        igual = (h == h_target)
        marca = '= IGUAL ⚠️' if igual else '≠ distinto ✅'
        print(f"  {f.name:<52}  {marca}")
        if igual: duplicados.append(f.name)

    if duplicados:
        print(f"\n{WRN}  El backup tiene el mismo MD5 que: {duplicados}")
        print(f"      Puede significar que el export no capturó cambios recientes.")
        errores += 1
    else:
        print(f"\n{OK}  MD5 único — el backup es diferente a todos los anteriores")

# ── CHECK 3 — Solo nombres canónicos en la BD ─────────────────────────────────
hdr("CHECK 3 — Nombres de competencias (solo canónicos)")

try:
    con = sqlite3.connect(f"file:{target}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row

    nombres_encontrados = {'multi': set(), 'simple': set(), 'dist': set()}
    antiguos_hallados   = []

    # actividades.competencias_multi
    for r in con.execute("SELECT competencias_multi FROM actividades WHERE modo='multi' AND competencias_multi IS NOT NULL"):
        try:
            for k in json.loads(r[0]): nombres_encontrados['multi'].add(k)
        except: pass

    # actividades.competencia (simple)
    for r in con.execute("SELECT DISTINCT competencia FROM actividades WHERE modo='simple' AND competencia IS NOT NULL"):
        nombres_encontrados['simple'].add(r[0])

    # calificaciones.distribucion_multi
    for r in con.execute("SELECT distribucion_multi FROM calificaciones WHERE distribucion_multi IS NOT NULL"):
        try:
            for k in json.loads(r[0]).keys(): nombres_encontrados['dist'].add(k)
        except: pass

    con.close()

    ANTIGUOS = {'Científica', 'Ética', 'Cívica', 'Pensamiento Lógico', 'Tecnológica'}
    campos = [
        ('competencias_multi', nombres_encontrados['multi']),
        ('competencia simple', nombres_encontrados['simple']),
        ('distribucion_multi', nombres_encontrados['dist']),
    ]

    todo_ok = True
    for campo, nombres in campos:
        viejos = nombres & ANTIGUOS
        otros_  = nombres - CANONICOS - ANTIGUOS
        print(f"\n  [{campo}]")
        if not nombres:
            print(f"    (vacío)")
            continue
        for n in sorted(nombres):
            tag = '✅ canónico' if n in CANONICOS else ('⚠️  ANTIGUO' if n in ANTIGUOS else '❓ desconocido')
            print(f"    {n:<35} {tag}")
        if viejos:
            todo_ok = False
            antiguos_hallados.extend(list(viejos))
        if otros_:
            print(f"{WRN}  Keys desconocidos en {campo}: {sorted(otros_)}")

    print()
    if todo_ok:
        print(f"{OK}  Todos los nombres de competencias son canónicos")
    else:
        print(f"{ERR}  Nombres ANTIGUOS encontrados: {sorted(set(antiguos_hallados))}")
        print(f"      El backup fue tomado ANTES de la migración.")
        errores += 1

except Exception as e:
    print(f"{ERR}  Error al leer el backup: {e}")
    errores += 1

# ── Resumen final ─────────────────────────────────────────────────────────────
print(f"\n{'═'*72}")
if errores == 0:
    print(f"  RESULTADO FINAL: ✅  BACKUP VÁLIDO ({target.name})")
else:
    print(f"  RESULTADO FINAL: ❌  {errores} PROBLEMA(S) ENCONTRADO(S) — ver arriba")
print(f"{'═'*72}\n")

sys.exit(0 if errores == 0 else 1)
