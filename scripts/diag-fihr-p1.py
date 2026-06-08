#!/usr/bin/env python3
"""
DIAGNÓSTICO — Actividad multi FIHR 2do B / P1 con techo incorrecto.
Solo lectura.
"""
import sqlite3, json, os, sys
from pathlib import Path

DB_PATH   = Path(os.environ['APPDATA']) / 'sistema-academico-docente' / 'sistema_docente.db'
PROJ_ROOT = Path(__file__).parent.parent

if not DB_PATH.exists():
    print(f"❌  BD no encontrada: {DB_PATH}"); sys.exit(1)

con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
con.row_factory = sqlite3.Row

def sep(ch='─', n=72): return ch * n
def hdr(t): print(f"\n{sep()}\n  {t}\n{sep()}")
def warn(m): print(f"  ⚠️   {m}")
def ok(m):   print(f"  ✅  {m}")

cur = con.cursor()

# ── 1. Localizar cursos FIHR ──────────────────────────────────────────────────
hdr("1. CURSOS que contienen 'FIHR' o '2do B'")
cur.execute("""
    SELECT c.id, c.nombre, c.grado, c.seccion, a.nombre AS anio
    FROM cursos c
    JOIN anios_escolares a ON c.anio_escolar_id = a.id
    ORDER BY a.id DESC, c.nombre
""")
todos_cursos = [dict(r) for r in cur.fetchall()]
fihr_cursos  = [c for c in todos_cursos
                if 'FIHR' in c['nombre'].upper() or '2DO B' in c['nombre'].upper()
                or '2do B' in c['nombre'] or '2DOB' in c['nombre'].upper()]

if not fihr_cursos:
    warn("No se encontró ningún curso con 'FIHR' o '2do B'. Mostrando todos los cursos:")
    for c in todos_cursos:
        print(f"  id={c['id']}  nombre='{c['nombre']}'  grado='{c['grado']}'  sección='{c['seccion']}'  año='{c['anio']}'")
else:
    print(f"  Encontrados {len(fihr_cursos)} curso(s):\n")
    for c in fihr_cursos:
        print(f"  id={c['id']}  nombre='{c['nombre']}'  grado='{c['grado']}'  sección='{c['seccion']}'  año='{c['anio']}'")

# ── 2. Año académico activo y período P1 ──────────────────────────────────────
hdr("2. AÑO ACTIVO y PERÍODO P1")
cur.execute("SELECT * FROM anios_escolares WHERE estado='activo' ORDER BY id DESC LIMIT 1")
anio_activo = cur.fetchone()
if not anio_activo:
    warn("No hay año académico activo.")
    anio_activo_id = None
else:
    anio_activo_id = anio_activo['id']
    print(f"  Año activo: [{anio_activo_id}] {anio_activo['nombre']}")

cur.execute("""
    SELECT * FROM periodos
    WHERE anio_escolar_id = ? AND (nombre LIKE '%P1%' OR nombre LIKE '%1%')
    ORDER BY numero_orden
""", (anio_activo_id,))
periodos_p1 = [dict(r) for r in cur.fetchall()]

if not periodos_p1:
    warn("No se encontró período P1 en el año activo. Mostrando todos los períodos:")
    cur.execute("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden", (anio_activo_id,))
    for p in cur.fetchall():
        print(f"  id={p['id']}  nombre='{p['nombre']}'  orden={p['numero_orden']}  estado='{p['estado']}'")
    # Tomar todos los períodos como candidatos
    cur.execute("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden", (anio_activo_id,))
    periodos_p1 = [dict(r) for r in cur.fetchall()]
else:
    for p in periodos_p1:
        print(f"  Período: [{p['id']}] {p['nombre']}  orden={p['numero_orden']}  estado='{p['estado']}'")

# Usar el primer período P1 encontrado
periodo = periodos_p1[0] if periodos_p1 else None
if not periodo:
    warn("Sin períodos — abortando."); con.close(); sys.exit(1)
print(f"\n  → Usando período: [{periodo['id']}] {periodo['nombre']}")

# Usar todos los cursos FIHR (o todos si no se encontró ninguno)
target_cursos = fihr_cursos if fihr_cursos else todos_cursos
curso_ids     = [c['id'] for c in target_cursos]

# ── 3. Actividades multi ──────────────────────────────────────────────────────
hdr(f"3. ACTIVIDADES MULTI — cursos FIHR / período [{periodo['id']}] {periodo['nombre']}")

placeholders = ','.join('?' * len(curso_ids))
cur.execute(f"""
    SELECT a.*, c.nombre AS curso
    FROM actividades a
    JOIN cursos c ON a.curso_id = c.id
    WHERE a.modo = 'multi'
      AND a.curso_id IN ({placeholders})
      AND a.periodo_id = ?
    ORDER BY a.curso_id, a.id
""", curso_ids + [periodo['id']])
acts_multi = [dict(r) for r in cur.fetchall()]

if not acts_multi:
    warn(f"No hay actividades multi en esos cursos / período {periodo['nombre']}.")
    # Ampliar búsqueda: todas las actividades multi de esos cursos
    cur.execute(f"""
        SELECT a.*, c.nombre AS curso, p.nombre AS periodo_nombre
        FROM actividades a
        JOIN cursos c ON a.curso_id = c.id
        JOIN periodos p ON a.periodo_id = p.id
        WHERE a.modo = 'multi' AND a.curso_id IN ({placeholders})
        ORDER BY a.periodo_id, a.id
    """, curso_ids)
    acts_multi = [dict(r) for r in cur.fetchall()]
    if acts_multi:
        warn(f"(ampliado a todos los períodos) → {len(acts_multi)} actividades multi encontradas")
    else:
        warn("Ninguna actividad multi en ningún período para esos cursos.")
else:
    print(f"  Encontradas: {len(acts_multi)} actividades multi\n")

anomalias = []

for act in acts_multi:
    raw   = act['competencias_multi']
    comps = json.loads(raw) if raw else []
    nc    = len(comps)
    techo = round(100 / nc * 10) / 10 if nc > 0 else 0

    print(f"\n  ╔═ [act {act['id']}] \"{act['nombre']}\"")
    print(f"  ║  curso    : {act['curso']}")
    print(f"  ║  modo     : {act['modo']}   peso: {act['peso']}")
    print(f"  ║  comps_raw: {repr(raw)}")
    print(f"  ║  comps_arr: {comps}")
    print(f"  ║  n_comps  : {nc}   techo calculado: {techo}")

    # ── 4. Calificaciones ────────────────────────────────────────────────────
    cur.execute("""
        SELECT c.*, e.nombre_completo, e.numero_lista
        FROM calificaciones c
        JOIN estudiantes e ON c.estudiante_id = e.id
        WHERE c.actividad_id = ?
        ORDER BY e.numero_lista
    """, (act['id'],))
    califs = [dict(r) for r in cur.fetchall()]

    print(f"  ║  calificaciones: {len(califs)}")
    print(f"  ╠{'─'*60}")

    if not califs:
        print("  ║  (sin calificaciones)")
        continue

    for c in califs:
        dist_raw  = c['distribucion_multi']
        dist_obj  = json.loads(dist_raw) if dist_raw else None
        dist_keys = list(dist_obj.keys()) if dist_obj else []
        n_keys    = len(dist_keys)
        nota      = c['nota']
        num       = str(c['numero_lista']).zfill(2)

        faltan   = [k for k in comps if k not in dist_keys]
        sobran   = [k for k in dist_keys if k not in comps]
        excesos  = {k: v for k, v in (dist_obj or {}).items() if v > techo + 0.05} if dist_obj else {}
        suma     = round(sum((dist_obj or {}).values()) * 100) / 100
        suma_ok  = nota is None or dist_obj is None or abs(suma - float(nota)) <= 0.05

        print(f"  ║")
        print(f"  ║  Est #{num} {c['nombre_completo']}")
        print(f"  ║    nota       = {nota}")
        print(f"  ║    dist_raw   = {dist_raw}")
        print(f"  ║    dist_obj   = {dist_obj}")
        print(f"  ║    dist_keys  = {dist_keys}  (n={n_keys}  vs n_comps={nc})")
        print(f"  ║    suma_dist  = {suma}")

        if faltan:
            warn(f"FALTAN keys en dist: {faltan}")
            anomalias.append({'tipo':'FALTAN_KEYS','actId':act['id'],'actNombre':act['nombre'],
                              'estId':c['estudiante_id'],'estNombre':c['nombre_completo'],
                              'nota':nota,'faltan':faltan,'distKeys':dist_keys,'comps':comps})
        if sobran:
            warn(f"SOBRAN keys en dist (no en competencias_multi): {sobran}")
            anomalias.append({'tipo':'SOBRAN_KEYS','actId':act['id'],'actNombre':act['nombre'],
                              'estId':c['estudiante_id'],'estNombre':c['nombre_completo'],
                              'nota':nota,'sobran':sobran,'distKeys':dist_keys,'comps':comps})
        if excesos:
            warn(f"VALORES > techo ({techo}): {excesos}")
            anomalias.append({'tipo':'EXCEDE_TECHO','actId':act['id'],'actNombre':act['nombre'],
                              'estId':c['estudiante_id'],'estNombre':c['nombre_completo'],
                              'nota':nota,'excesos':excesos,'techo':techo})
        if not suma_ok:
            warn(f"suma_dist ({suma}) ≠ nota ({nota})")
            anomalias.append({'tipo':'SUMA_DISTINTA','actId':act['id'],'actNombre':act['nombre'],
                              'estId':c['estudiante_id'],'estNombre':c['nombre_completo'],
                              'nota':float(nota),'suma':suma})
        if n_keys != nc:
            warn(f"n_keys ({n_keys}) ≠ n_comps ({nc}) — DESFASE CLARO")
            anomalias.append({'tipo':'DESFASE_N_KEYS','actId':act['id'],'actNombre':act['nombre'],
                              'estId':c['estudiante_id'],'estNombre':c['nombre_completo'],
                              'nota':nota,'n_keys':n_keys,'n_comps':nc,
                              'distKeys':dist_keys,'comps':comps})

    print(f"  ╚{'═'*60}")

# ── 5. Resumen ────────────────────────────────────────────────────────────────
hdr("5. RESUMEN DE ANOMALÍAS")
if not anomalias:
    ok("No se encontraron anomalías.")
else:
    print(f"  ❌  Total anomalías: {len(anomalias)}\n")
    tipos = list(dict.fromkeys(a['tipo'] for a in anomalias))
    for tipo in tipos:
        grupo = [a for a in anomalias if a['tipo'] == tipo]
        print(f"  [{tipo}] × {len(grupo)}")
        for a in grupo:
            print(f"    Act {a['actId']} \"{a['actNombre']}\"  Est {a['estId']} \"{a['estNombre']}\"  nota={a.get('nota')}")
            for campo in ('faltan','sobran','excesos','distKeys','comps'):
                if campo in a: print(f"      {campo}: {a[campo]}")
            if tipo == 'SUMA_DISTINTA':  print(f"      nota={a['nota']} vs suma={a['suma']}")
            if tipo == 'DESFASE_N_KEYS': print(f"      n_keys={a['n_keys']} vs n_comps={a['n_comps']}")
        print()

print('\n' + sep('═') + '\n  FIN DEL DIAGNÓSTICO\n' + sep('═') + '\n')
con.close()
