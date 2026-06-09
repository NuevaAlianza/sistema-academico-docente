#!/usr/bin/env python3
"""
DIAGNÓSTICO POST-ELIMINAR ACTIVIDAD MULTI
Solo lectura — no modifica nada.

Verifica integridad de calificaciones multi-competencia:
  1. Lista actividades multi del período activo (o todos si no hay abierto).
  2. Por cada una, valida las calificaciones:
     - ¿Keys de distribucion_multi coinciden con competencias_multi?
     - ¿Suma de distribución == nota?
     - ¿Faltan/sobran competencias en la distribución?
  3. Muestra el handler deleteActividad de database.js.
  4. Resume anomalías.
"""

import sqlite3, json, os, sys, re
from pathlib import Path

# ── BD ────────────────────────────────────────────────────────────────────────
DB_PATH = Path(os.environ['APPDATA']) / 'sistema-academico-docente' / 'sistema_docente.db'
PROJ_ROOT = Path(__file__).parent.parent

if not DB_PATH.exists():
    print(f"❌  BD no encontrada en: {DB_PATH}"); sys.exit(1)

con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
con.row_factory = sqlite3.Row
cur = con.cursor()

TOLS = 0.05

def sep(ch='─', n=72): return ch * n
def hdr(t): print(f"\n{sep()}\n  {t}\n{sep()}")
def warn(m): print(f"  ⚠️   {m}")
def ok(m):   print(f"  ✅  {m}")

# ── 1. Período activo ─────────────────────────────────────────────────────────
hdr("1. PERÍODO ACTIVO")
cur.execute("""
    SELECT p.*, a.nombre AS anio
    FROM periodos p
    JOIN anios_escolares a ON p.anio_escolar_id = a.id
    WHERE p.estado = 'abierto'
    ORDER BY p.id DESC LIMIT 1
""")
periodo = cur.fetchone()

if periodo:
    print(f"  → Período: [{periodo['id']}] {periodo['nombre']} | Año: {periodo['anio']}")
    where_p = f"AND a.periodo_id = {periodo['id']}"
else:
    warn("No hay período abierto — mostrando TODAS las actividades multi existentes")
    where_p = ""

# ── 2. Actividades multi ──────────────────────────────────────────────────────
hdr("2. ACTIVIDADES MODO='multi'")
cur.execute(f"""
    SELECT a.*, c.nombre AS curso, p.nombre AS periodo
    FROM actividades a
    JOIN cursos c ON a.curso_id = c.id
    JOIN periodos p ON a.periodo_id = p.id
    WHERE a.modo = 'multi' {where_p}
    ORDER BY a.curso_id, a.id
""")
acts_multi = [dict(r) for r in cur.fetchall()]

if not acts_multi:
    warn("No hay actividades multi en el período indicado.")
else:
    print(f"  Encontradas: {len(acts_multi)} actividades multi\n")
    for a in acts_multi:
        comps = json.loads(a['competencias_multi'] or '[]')
        print(f"  [act {a['id']}] \"{a['nombre']}\" | Curso: {a['curso']} | Período: {a['periodo']}")
        print(f"           competencias_multi: {comps} ({len(comps)} comps)")
        print(f"           peso: {a['peso']}  modo: {a['modo']}  fecha: {a['fecha'] or '—'}")

# ── 3. Calificaciones por actividad ───────────────────────────────────────────
hdr("3. CALIFICACIONES POR ACTIVIDAD MULTI")
anomalias = []

for act in acts_multi:
    comps_act = json.loads(act['competencias_multi'] or '[]')
    nc        = len(comps_act)
    techo     = round(100 / nc * 10) / 10 if nc > 0 else 0

    cur.execute("""
        SELECT c.*, e.nombre_completo, e.numero_lista
        FROM calificaciones c
        JOIN estudiantes e ON c.estudiante_id = e.id
        WHERE c.actividad_id = ?
        ORDER BY e.numero_lista
    """, (act['id'],))
    califs = [dict(r) for r in cur.fetchall()]

    print(f"\n  ┌─ [act {act['id']}] \"{act['nombre']}\" — {comps_act} — {len(califs)} calificaciones")

    if not califs:
        print("  │  (sin calificaciones)")
        continue

    for c in califs:
        dist_raw  = c['distribucion_multi']
        dist_obj  = json.loads(dist_raw) if dist_raw else None
        dist_keys = list(dist_obj.keys()) if dist_obj else []
        nota      = c['nota']
        num_lista = str(c['numero_lista']).zfill(2)

        faltan_en_dist  = [k for k in comps_act if k not in dist_keys]
        sobran_en_dist  = [k for k in dist_keys if k not in comps_act]
        solo_comun      = dist_keys == ['Comunicativa'] and nc > 1
        suma            = round(sum(dist_obj.get(k, 0) for k in dist_keys) * 100) / 100 if dist_obj else None
        suma_no_coin    = (nota is not None and dist_obj is not None
                          and abs(suma - float(nota)) > TOLS)

        print(f"  │  Est #{num_lista} {c['nombre_completo']}")
        print(f"  │     nota={nota}  dist_raw={dist_raw}")
        if dist_obj:
            print(f"  │     dist_parsed={dist_obj}")
            print(f"  │     dist_keys={dist_keys}  suma_dist={suma}")

        # Alertas
        if not dist_raw and nota is not None:
            warn(f"act {act['id']} / est {c['estudiante_id']}: tiene nota ({nota}) pero SIN distribucion_multi")
            anomalias.append({'tipo': 'SIN_DIST', 'actId': act['id'], 'actNombre': act['nombre'],
                              'estId': c['estudiante_id'], 'estNombre': c['nombre_completo'], 'nota': nota})

        if faltan_en_dist:
            warn(f"act {act['id']} / est {c['estudiante_id']}: FALTAN comps en dist: {faltan_en_dist}")
            anomalias.append({'tipo': 'FALTAN_KEYS', 'actId': act['id'], 'actNombre': act['nombre'],
                              'estId': c['estudiante_id'], 'estNombre': c['nombre_completo'],
                              'nota': nota, 'faltanEnDist': faltan_en_dist, 'distKeys': dist_keys})

        if sobran_en_dist:
            warn(f"act {act['id']} / est {c['estudiante_id']}: keys SOBRANTES en dist (no en competencias_multi): {sobran_en_dist}")
            anomalias.append({'tipo': 'SOBRAN_KEYS', 'actId': act['id'], 'actNombre': act['nombre'],
                              'estId': c['estudiante_id'], 'estNombre': c['nombre_completo'],
                              'nota': nota, 'sobranEnDist': sobran_en_dist,
                              'distKeys': dist_keys, 'compsAct': comps_act})

        if solo_comun:
            warn(f"act {act['id']} / est {c['estudiante_id']}: dist SOLO tiene 'Comunicativa' (¿otras borradas?)")
            anomalias.append({'tipo': 'SOLO_COMUNICATIVA', 'actId': act['id'], 'actNombre': act['nombre'],
                              'estId': c['estudiante_id'], 'estNombre': c['nombre_completo'],
                              'nota': nota, 'distKeys': dist_keys})

        if suma_no_coin:
            warn(f"act {act['id']} / est {c['estudiante_id']}: suma_dist ({suma}) != nota ({nota}) [diff={abs(suma - float(nota)):.2f}]")
            anomalias.append({'tipo': 'SUMA_DISTINTA', 'actId': act['id'], 'actNombre': act['nombre'],
                              'estId': c['estudiante_id'], 'estNombre': c['nombre_completo'],
                              'nota': float(nota), 'suma': suma})

# ── 4. Handler deleteActividad (fuente) ───────────────────────────────────────
hdr("4. HANDLER deleteActividad EN database.js")
db_src_path = PROJ_ROOT / 'electron' / 'database.js'
try:
    src = db_src_path.read_text(encoding='utf-8')
    # Extraer el método deleteActividad
    m = re.search(r'deleteActividad\s*\([^)]*\)\s*\{[^}]*\}', src)
    if m:
        for line in m.group(0).split('\n'):
            print('  ' + line)
    else:
        # Fallback: buscar el bloque con contexto
        idx = src.find('deleteActividad')
        if idx >= 0:
            snippet = src[idx:idx+300]
            for line in snippet.split('\n')[:12]:
                print('  ' + line)
        else:
            warn("No se encontró deleteActividad en database.js")
except Exception as e:
    warn(f"No se pudo leer database.js: {e}")

# También mostrar updateActividad (redistribuye calificaciones)
hdr("4b. LÓGICA DE REDISTRIBUCIÓN EN updateActividad")
try:
    m2 = re.search(r'updateActividad\s*\([^)]*\)\s*\{.*?(?=\n  \w)', src, re.DOTALL)
    if m2:
        lines = m2.group(0).split('\n')[:40]
        for line in lines:
            print('  ' + line)
    else:
        idx2 = src.find('updateActividad')
        if idx2 >= 0:
            snippet2 = src[idx2:idx2+1200]
            for line in snippet2.split('\n')[:35]:
                print('  ' + line)
except Exception as e:
    warn(f"No se pudo extraer updateActividad: {e}")

# ── 5. Resumen ────────────────────────────────────────────────────────────────
hdr("5. RESUMEN DE ANOMALÍAS")

if not anomalias:
    ok("No se encontraron anomalías. Todos los datos son coherentes.")
else:
    print(f"  ❌  Total anomalías: {len(anomalias)}\n")
    tipos = list(dict.fromkeys(a['tipo'] for a in anomalias))
    for tipo in tipos:
        grupo = [a for a in anomalias if a['tipo'] == tipo]
        print(f"  [{tipo}] × {len(grupo)}")
        for a in grupo:
            print(f"    - Act {a['actId']} \"{a['actNombre']}\" | Est {a['estId']} \"{a['estNombre']}\"")
            if 'faltanEnDist' in a:
                print(f"      faltanEnDist: {a['faltanEnDist']}")
            if 'sobranEnDist' in a:
                print(f"      sobranEnDist: {a['sobranEnDist']}")
            if 'distKeys' in a:
                print(f"      distKeys: {a['distKeys']}")
            if tipo == 'SUMA_DISTINTA':
                print(f"      nota={a['nota']} vs suma_dist={a['suma']}")
        print()

print('\n' + sep('═') + '\n  FIN DEL DIAGNÓSTICO\n' + sep('═') + '\n')
con.close()
