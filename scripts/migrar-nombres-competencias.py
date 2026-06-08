#!/usr/bin/env python3
"""
Migra nombres de competencias antiguas a los nombres canónicos (sin tilde,
exactamente como están definidos en COMPETENCIAS en Calificaciones.jsx).

Nombres canónicos (sin tilde, igual que c.key en JS):
  Comunicativa, Pensamiento Logico, Civica, Tecnologica

MAPEO completo (cubrir viejos Y variantes con tilde):
  Científica        → Pensamiento Logico
  Ética             → Tecnologica
  Cívica            → Civica          (normalizar tilde)
  Pensamiento Lógico → Pensamiento Logico  (normalizar tilde; puede existir)
  Tecnológica       → Tecnologica     (normalizar tilde; puede existir)

Alcance:
  - actividades.competencias_multi  (modo='multi')
  - actividades.competencia         (modo='simple')
  - calificaciones.distribucion_multi
"""
import sqlite3, json, os, sys
from pathlib import Path

DB_PATH = Path(os.environ['APPDATA']) / 'sistema-academico-docente' / 'sistema_docente.db'
if not DB_PATH.exists():
    print(f"❌  BD no encontrada: {DB_PATH}"); sys.exit(1)

MAPEO = {
    "Científica":          "Pensamiento Logico",
    "Ética":               "Tecnologica",
    "Cívica":              "Civica",
    "Pensamiento Lógico":  "Pensamiento Logico",   # normalizar tilde
    "Tecnológica":         "Tecnologica",           # normalizar tilde
}

def renombrar_array(arr):
    """Renombra + deduplica preservando orden."""
    seen, result = set(), []
    for k in arr:
        nuevo = MAPEO.get(k, k)
        if nuevo not in seen:
            seen.add(nuevo)
            result.append(nuevo)
    return result

def renombrar_dist(obj):
    """Renombra keys; colisión → suma valores. Retorna (nuevo_obj, hubo_colision)."""
    nuevo, colision = {}, False
    for k, v in obj.items():
        nuevo_k = MAPEO.get(k, k)
        if nuevo_k in nuevo:
            nuevo[nuevo_k] = round((nuevo[nuevo_k] + v) * 100) / 100
            colision = True
        else:
            nuevo[nuevo_k] = v
    return nuevo, colision

# ── Conectar con escritura ────────────────────────────────────────────────────
con = sqlite3.connect(str(DB_PATH))
con.row_factory = sqlite3.Row
cur = con.cursor()

stats = {'acts_multi': 0, 'acts_simple': 0, 'califs': 0, 'colisiones': 0}
sep = '─' * 72

# ── 1. actividades modo='multi' ───────────────────────────────────────────────
print(f"\n{sep}\n  1. ACTIVIDADES MULTI (competencias_multi)\n{sep}")

cur.execute("SELECT id, nombre, competencias_multi FROM actividades WHERE modo='multi' AND competencias_multi IS NOT NULL")
for act in cur.fetchall():
    old_arr = json.loads(act['competencias_multi'])
    new_arr = renombrar_array(old_arr)
    if new_arr != old_arr:
        con.execute("UPDATE actividades SET competencias_multi=? WHERE id=?",
                    (json.dumps(new_arr, ensure_ascii=False), act['id']))
        stats['acts_multi'] += 1
        print(f"  act {act['id']:>4} \"{act['nombre']}\"")
        print(f"    viejo: {old_arr}")
        print(f"    nuevo: {new_arr}")
    else:
        print(f"  act {act['id']:>4} \"{act['nombre']}\" — sin cambio {old_arr}")

# ── 2. actividades modo='simple' ─────────────────────────────────────────────
print(f"\n{sep}\n  2. ACTIVIDADES SIMPLE (competencia)\n{sep}")

old_keys_sql = ','.join(f"'{k}'" for k in MAPEO)
cur.execute(f"SELECT id, nombre, competencia FROM actividades WHERE modo='simple' AND competencia IN ({old_keys_sql})")
acts_simple = cur.fetchall()
if not acts_simple:
    print("  (ninguna actividad simple usa nombres a migrar)")
for act in acts_simple:
    nuevo = MAPEO[act['competencia']]
    con.execute("UPDATE actividades SET competencia=? WHERE id=?", (nuevo, act['id']))
    stats['acts_simple'] += 1
    print(f"  act {act['id']:>4} \"{act['nombre']}\"  {act['competencia']} → {nuevo}")

# ── 3. calificaciones — distribucion_multi ────────────────────────────────────
print(f"\n{sep}\n  3. CALIFICACIONES (distribucion_multi)\n{sep}")

cur.execute("""
    SELECT c.id, c.actividad_id, c.distribucion_multi,
           e.nombre_completo, e.numero_lista
    FROM calificaciones c
    JOIN estudiantes e ON c.estudiante_id = e.id
    WHERE c.distribucion_multi IS NOT NULL
""")
n_sin_cambio = 0
for c in cur.fetchall():
    dist_old = json.loads(c['distribucion_multi'])
    if not any(k in dist_old for k in MAPEO):
        n_sin_cambio += 1
        continue
    dist_new, colision = renombrar_dist(dist_old)
    con.execute("UPDATE calificaciones SET distribucion_multi=? WHERE id=?",
                (json.dumps(dist_new, ensure_ascii=False), c['id']))
    stats['califs'] += 1
    if colision:
        stats['colisiones'] += 1
    marca = " ⚠️ COLISIÓN (valores sumados)" if colision else ""
    print(f"  calif {c['id']:>5} act={c['actividad_id']} est={c['numero_lista']:>2} {c['nombre_completo']}{marca}")
    print(f"    viejo: {dist_old}")
    print(f"    nuevo: {dist_new}")

if stats['califs'] == 0:
    print("  (ninguna calificación tenía keys a migrar)")
print(f"\n  ({n_sin_cambio} calificaciones sin cambio)")

# ── Commit ────────────────────────────────────────────────────────────────────
con.commit()
con.close()

# ── Resumen ───────────────────────────────────────────────────────────────────
print(f"\n{'═'*72}")
print(f"  RESUMEN DE MIGRACIÓN")
print(f"{'═'*72}")
print(f"  Actividades multi  migradas : {stats['acts_multi']}")
print(f"  Actividades simple migradas : {stats['acts_simple']}")
print(f"  Calificaciones     migradas : {stats['califs']}")
print(f"  Colisiones de keys (sumadas): {stats['colisiones']}")
print(f"{'═'*72}\n")
