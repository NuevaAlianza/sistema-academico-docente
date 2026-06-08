#!/usr/bin/env python3
"""
Limpia todos los datos de prueba de la BD para el cierre v1.5.0.

BORRA:
  - calificaciones
  - actividades
  - temas
  - asistencias

CONSERVA:
  - estudiantes
  - materias
  - cursos
  - periodos
  - anios_escolares
  - configuracion
"""
import sqlite3, os, sys
from pathlib import Path

DB_PATH = Path(os.environ['APPDATA']) / 'sistema-academico-docente' / 'sistema_docente.db'
if not DB_PATH.exists():
    print(f"❌  BD no encontrada: {DB_PATH}"); sys.exit(1)

TABLAS_BORRAR   = ['calificaciones', 'actividades', 'temas', 'asistencias']
TABLAS_CONSERVAR = ['estudiantes', 'materias', 'cursos', 'periodos', 'anios_escolares', 'configuracion']

def contar(cur, tabla):
    cur.execute(f"SELECT COUNT(*) FROM {tabla}")
    return cur.fetchone()[0]

con = sqlite3.connect(str(DB_PATH))
cur = con.cursor()

sep = '─' * 60

# ── Conteo previo ────────────────────────────────────────────────
print(f"\n{sep}\n  CONTEO PREVIO A LA LIMPIEZA\n{sep}")
for t in TABLAS_BORRAR + TABLAS_CONSERVAR:
    try:
        n = contar(cur, t)
        marca = '  ← se borrará' if t in TABLAS_BORRAR else ''
        print(f"  {t:<22} {n:>6} filas{marca}")
    except Exception as e:
        print(f"  {t:<22} ⚠️  {e}")

# ── Limpieza en transacción ──────────────────────────────────────
print(f"\n{sep}\n  EJECUTANDO LIMPIEZA\n{sep}")
try:
    con.execute("BEGIN")
    for t in TABLAS_BORRAR:
        con.execute(f"DELETE FROM {t}")
        print(f"  DELETE FROM {t}  ✅")
    con.commit()
    print(f"\n  Transacción confirmada (COMMIT).")
except Exception as e:
    con.rollback()
    print(f"\n  ❌  Error — ROLLBACK ejecutado: {e}")
    con.close()
    sys.exit(1)

# ── Verificación post-limpieza ───────────────────────────────────
print(f"\n{sep}\n  VERIFICACIÓN POST-LIMPIEZA\n{sep}")
ok = True
print("  [DEBEN QUEDAR EN 0]")
for t in TABLAS_BORRAR:
    n = contar(cur, t)
    estado = '✅  OK' if n == 0 else f'❌  ERROR — quedan {n} filas'
    print(f"  {t:<22} {n:>6}  {estado}")
    if n != 0:
        ok = False

print("\n  [DEBEN CONSERVARSE]")
for t in TABLAS_CONSERVAR:
    try:
        n = contar(cur, t)
        print(f"  {t:<22} {n:>6}  ✅")
    except Exception as e:
        print(f"  {t:<22} ⚠️  {e}")

con.close()

print(f"\n{'═'*60}")
if ok:
    print("  ✅  LIMPIEZA COMPLETADA — BD lista para verificación final.")
else:
    print("  ❌  LIMPIEZA INCOMPLETA — revisar errores.")
print(f"{'═'*60}\n")
