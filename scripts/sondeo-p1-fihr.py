#!/usr/bin/env python3
"""
SONDEO — FIHR 2do B / P1: compara BD real vs valores esperados del usuario.
Solo lectura.

Fórmula de nota por competencia (replica database.js getResumenCompetenciasMultiPorEstudiante):
  nota_comp_act = (pts / techo) * 100      donde techo = 100 / n_comps
  nota_comp_per = round(Σ(nota_comp_act × peso_unit) / Σ(peso_unit))
                  donde peso_unit = act.peso / n_comps
"""
import sqlite3, json, os, sys
from pathlib import Path

DB_PATH = Path(os.environ['APPDATA']) / 'sistema-academico-docente' / 'sistema_docente.db'
if not DB_PATH.exists():
    print(f"❌  BD no encontrada: {DB_PATH}"); sys.exit(1)

con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
con.row_factory = sqlite3.Row

# Abreviaturas para comparación
ABREV = {'Comunicativa': 'Com', 'Pensamiento Logico': 'Pen', 'Civica': 'Cív', 'Tecnologica': 'Tec'}
COMPS = ['Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica']

# ── Valores esperados ─────────────────────────────────────────────────────────
ACTS_ESPERADAS = [
    {'peso': 10, 'comps': ['Comunicativa', 'Pensamiento Logico']},
    {'peso': 10, 'comps': ['Pensamiento Logico', 'Tecnologica']},
    {'peso': 15, 'comps': ['Comunicativa', 'Civica']},
    {'peso': 20, 'comps': ['Comunicativa', 'Pensamiento Logico', 'Tecnologica']},
    {'peso': 10, 'comps': ['Comunicativa', 'Tecnologica', 'Civica']},
    {'peso': 20, 'comps': ['Comunicativa', 'Pensamiento Logico', 'Tecnologica', 'Civica']},
    {'peso': 15, 'comps': ['Pensamiento Logico', 'Civica']},
]

# Est A, B, C: lista de dicts {comp_abrev: pts} por actividad (índice 0-6)
DISTS_ESPERADAS = [
    # Est A
    [
        {'Com': 38, 'Pen': 35},
        {'Pen': 36, 'Tec': 40},
        {'Com': 40, 'Cív': 38},
        {'Com': 25, 'Pen': 24, 'Tec': 26},
        {'Com': 25, 'Tec': 24, 'Cív': 22},
        {'Com': 19, 'Pen': 18, 'Tec': 20, 'Cív': 17},
        {'Pen': 35, 'Cív': 38},
    ],
    # Est B
    [
        {'Com': 40, 'Pen': 40},
        {'Pen': 40, 'Tec': 40},
        {'Com': 42, 'Cív': 40},
        {'Com': 27, 'Pen': 27, 'Tec': 26},
        {'Com': 26, 'Tec': 26, 'Cív': 28},
        {'Com': 20, 'Pen': 20, 'Tec': 20, 'Cív': 20},
        {'Pen': 40, 'Cív': 40},
    ],
    # Est C
    [
        {'Com': 45, 'Pen': 42},
        {'Pen': 42, 'Tec': 44},
        {'Com': 45, 'Cív': 43},
        {'Com': 30, 'Pen': 28, 'Tec': 29},
        {'Com': 30, 'Tec': 28, 'Cív': 25},
        {'Com': 22, 'Pen': 20, 'Tec': 21, 'Cív': 20},
        {'Pen': 42, 'Cív': 43},
    ],
]

NOTAS_COMP_ESPERADAS = [
    # Est A: Com Pen Cív Tec prom
    {'Comunicativa': 79, 'Pensamiento Logico': 74, 'Civica': 76, 'Tecnologica': 78, 'prom': 77},
    # Est B
    {'Comunicativa': 82, 'Pensamiento Logico': 82, 'Civica': 81, 'Tecnologica': 80, 'prom': 81},
    # Est C
    {'Comunicativa': 89, 'Pensamiento Logico': 85, 'Civica': 85, 'Tecnologica': 85, 'prom': 86},
]

def abrev_to_comp(a):
    m = {'Com': 'Comunicativa', 'Pen': 'Pensamiento Logico', 'Cív': 'Civica', 'Tec': 'Tecnologica'}
    return m.get(a, a)

def sep(ch='─', n=72): return ch * n
def hdr(t): print(f"\n{sep()}\n  {t}\n{sep()}")
def ok(m):   print(f"  ✅  {m}")
def warn(m): print(f"  ⚠️   {m}")
def err(m):  print(f"  ❌  {m}")

cur = con.cursor()

# ── Localizar curso FIHR 2do B ────────────────────────────────────────────────
hdr("LOCALIZACIÓN — Curso FIHR 2do B y Período P1")

cur.execute("""
    SELECT c.id, c.nombre, c.grado, c.seccion, a.id as anio_id, a.nombre as anio_nombre
    FROM cursos c JOIN anios_escolares a ON c.anio_escolar_id = a.id
    ORDER BY a.id DESC, c.nombre
""")
todos = [dict(r) for r in cur.fetchall()]
candidatos = [c for c in todos
              if 'FIHR' in c['nombre'].upper()
              and '2' in c['nombre']
              and ('B' in c['nombre'].upper().split() or c['seccion'].upper() == 'B')]
if not candidatos:
    # Fallback: cualquier FIHR 2do
    candidatos = [c for c in todos if 'FIHR' in c['nombre'].upper() and '2' in c['nombre']]
if not candidatos:
    err("No se encontró curso FIHR 2do B. Cursos disponibles:")
    for c in todos: print(f"  id={c['id']}  {c['nombre']}")
    con.close(); sys.exit(1)

curso = candidatos[0]
print(f"  Curso encontrado: id={curso['id']}  \"{curso['nombre']}\"  año={curso['anio_nombre']}")

cur.execute("SELECT * FROM anios_escolares WHERE estado='activo' ORDER BY id DESC LIMIT 1")
anio_activo = cur.fetchone()
if not anio_activo:
    err("No hay año académico activo."); con.close(); sys.exit(1)

cur.execute("""
    SELECT * FROM periodos
    WHERE anio_escolar_id=? AND (nombre LIKE '%P1%' OR nombre LIKE '%1%')
    ORDER BY numero_orden LIMIT 1
""", (anio_activo['id'],))
periodo = cur.fetchone()
if not periodo:
    err("No se encontró período P1."); con.close(); sys.exit(1)
print(f"  Período: id={periodo['id']}  \"{periodo['nombre']}\"")

# ── PARTE A — Estructura de actividades ──────────────────────────────────────
hdr("PARTE A — Estructura de actividades vs esperado")

cur.execute("""
    SELECT * FROM actividades
    WHERE curso_id=? AND periodo_id=? AND modo='multi'
    ORDER BY id
""", (curso['id'], periodo['id']))
acts_bd = [dict(r) for r in cur.fetchall()]

n_bd = len(acts_bd)
n_exp = len(ACTS_ESPERADAS)
print(f"  Actividades en BD: {n_bd}  |  Esperadas: {n_exp}")

if n_bd == 0:
    err("No hay actividades multi en BD para este curso/período.")
    err("La BD fue limpiada. Debe ingresar los datos de prueba en la app primero.")
    con.close(); sys.exit(0)

print()
diferencias_acts = []
suma_pesos = 0

for i, act in enumerate(acts_bd):
    comps_bd  = json.loads(act['competencias_multi']) if act['competencias_multi'] else []
    n         = len(comps_bd)
    techo     = round(100/n * 10)/10 if n > 0 else 0
    suma_pesos += float(act['peso'])

    if i < n_exp:
        exp = ACTS_ESPERADAS[i]
        peso_ok  = float(act['peso']) == exp['peso']
        comps_ok = comps_bd == exp['comps']
        estado   = '✅' if (peso_ok and comps_ok) else '❌'
        if not (peso_ok and comps_ok):
            diferencias_acts.append(i+1)
    else:
        estado, exp = '⚠️ (sin esperado)', None

    comps_str = ', '.join(ABREV.get(c, c) for c in comps_bd)
    print(f"  {estado} Act{i+1}  id={act['id']:>4}  peso={act['peso']:>5}  n={n}  techo={techo:>5}  comps=[{comps_str}]")
    if exp and not (float(act['peso']) == exp['peso'] and comps_bd == exp['comps']):
        exp_str = ', '.join(ABREV.get(c, c) for c in exp['comps'])
        print(f"          Esperado: peso={exp['peso']:>5}  comps=[{exp_str}]")

print(f"\n  Suma de pesos: {suma_pesos}  {'✅ = 100' if suma_pesos == 100 else '❌ ≠ 100'}")
if diferencias_acts:
    warn(f"Actividades con diferencias: {diferencias_acts}")
else:
    ok("Todas las actividades coinciden con el esperado.")

# ── Estudiantes con calificaciones ───────────────────────────────────────────
hdr("IDENTIFICACIÓN DE ESTUDIANTES CALIFICADOS")

act_ids = [a['id'] for a in acts_bd]
placeholders = ','.join('?'*len(act_ids))

cur.execute(f"""
    SELECT DISTINCT e.id, e.nombre_completo, e.numero_lista
    FROM calificaciones c JOIN estudiantes e ON c.estudiante_id=e.id
    WHERE c.actividad_id IN ({placeholders}) AND c.nota IS NOT NULL
    ORDER BY e.numero_lista
""", act_ids)
estudiantes = [dict(r) for r in cur.fetchall()]

print(f"  Estudiantes con nota: {len(estudiantes)}")
for i, e in enumerate(estudiantes):
    label = chr(65+i) if i < 3 else str(i+1)
    print(f"  Est {label}: #{e['numero_lista']:>2}  {e['nombre_completo']}")

if not estudiantes:
    err("No hay calificaciones en BD. La BD fue limpiada. Ingresar datos en la app primero.")
    con.close(); sys.exit(0)

# ── PARTE B — Distribuciones ──────────────────────────────────────────────────
hdr("PARTE B — Distribuciones por estudiante (BD vs Esperado)")

total_diffs_dist = []

for ei, est in enumerate(estudiantes):
    label = chr(65+ei) if ei < 3 else str(ei+1)
    print(f"\n  {'─'*64}")
    print(f"  Est {label}: {est['nombre_completo']}")
    print(f"  {'─'*64}")

    exp_dists = DISTS_ESPERADAS[ei] if ei < len(DISTS_ESPERADAS) else None

    for ai, act in enumerate(acts_bd):
        comps_bd = json.loads(act['competencias_multi']) if act['competencias_multi'] else []

        cur.execute("""
            SELECT nota, distribucion_multi FROM calificaciones
            WHERE actividad_id=? AND estudiante_id=?
        """, (act['id'], est['id']))
        row = cur.fetchone()

        dist_bd = {}
        nota_bd = None
        if row:
            nota_bd = row['nota']
            dist_bd = json.loads(row['distribucion_multi']) if row['distribucion_multi'] else {}

        # Esperado para esta act
        exp_dist_abrev = exp_dists[ai] if exp_dists and ai < len(exp_dists) else None
        exp_dist = {abrev_to_comp(k): v for k, v in (exp_dist_abrev or {}).items()}

        # Comparar
        diffs = {}
        if exp_dist:
            for comp in comps_bd:
                bd_val  = dist_bd.get(comp)
                exp_val = exp_dist.get(comp)
                if bd_val != exp_val:
                    diffs[ABREV.get(comp, comp)] = {'bd': bd_val, 'exp': exp_val,
                                                     'delta': (bd_val - exp_val) if (bd_val is not None and exp_val is not None) else None}

        bd_str  = '  '.join(f"{ABREV.get(c,c)}={dist_bd.get(c,'-')}" for c in comps_bd)
        exp_str = '  '.join(f"{ABREV.get(c,c)}={exp_dist.get(c,'-')}" for c in comps_bd) if exp_dist else '(sin esperado)'
        estado  = '✅' if not diffs else '❌'
        nota_str = f"nota={nota_bd}" if nota_bd is not None else "sin nota"

        print(f"\n    Act{ai+1}  {estado}  {nota_str}")
        print(f"      BD      : {bd_str if bd_str else '(vacío)'}")
        print(f"      Esperado: {exp_str}")
        if diffs:
            for abv, d in diffs.items():
                delta_str = f"  Δ={d['delta']:+.1f}" if d['delta'] is not None else ""
                print(f"      ⚠️  {abv}: BD={d['bd']}  Esp={d['exp']}{delta_str}")
            total_diffs_dist.append({'est': label, 'act': ai+1, 'diffs': diffs})

# ── PARTE C — Notas calculadas ────────────────────────────────────────────────
hdr("PARTE C — Notas por competencia calculadas (fórmula app) vs esperado")

def calcular_notas_comp_estudiante(est_id, acts_bd):
    """Replica getResumenCompetenciasMultiPorEstudiante de database.js."""
    resultado = {}
    for comp in COMPS:
        peso_evaluado = 0.0
        suma_ponderada = 0.0
        en_periodo = False

        for act in acts_bd:
            comps = json.loads(act['competencias_multi']) if act['competencias_multi'] else []
            if comp not in comps:
                continue
            n         = len(comps)
            techo     = 100 / n
            peso_unit = float(act['peso']) / n
            en_periodo = True

            cur.execute("""
                SELECT nota, distribucion_multi FROM calificaciones
                WHERE actividad_id=? AND estudiante_id=?
            """, (act['id'], est_id))
            row = cur.fetchone()

            if row and row['nota'] is not None:
                dist = json.loads(row['distribucion_multi']) if row['distribucion_multi'] else None
                pts  = dist[comp] if dist and comp in dist else float(row['nota']) / n
                nota_comp = (pts / techo) * 100
                peso_evaluado  += peso_unit
                suma_ponderada += nota_comp * peso_unit

        if en_periodo:
            nota = round(suma_ponderada / peso_evaluado) if peso_evaluado > 0 else None
            resultado[comp] = nota

    return resultado

total_diffs_notas = []

for ei, est in enumerate(estudiantes):
    label = chr(65+ei) if ei < 3 else str(ei+1)
    notas_calc  = calcular_notas_comp_estudiante(est['id'], acts_bd)
    notas_exp   = NOTAS_COMP_ESPERADAS[ei] if ei < len(NOTAS_COMP_ESPERADAS) else {}

    print(f"\n  Est {label}: {est['nombre_completo']}")
    print(f"  {'Comp':<22}  {'Calc':>6}  {'Esper':>6}  {'Diff':>6}")
    print(f"  {'─'*46}")

    notas_para_prom = []
    for comp in COMPS:
        nc = notas_calc.get(comp)
        ne = notas_exp.get(comp)
        if nc is None and ne is None:
            continue
        diff = (nc - ne) if (nc is not None and ne is not None) else None
        diff_str = f"{diff:+d}" if diff is not None else "N/A"
        estado   = '✅' if diff == 0 else ('⚠️' if diff is not None else '❓')
        print(f"  {estado} {ABREV.get(comp,comp):<20}  {str(nc) if nc is not None else '-':>6}  {str(ne) if ne is not None else '-':>6}  {diff_str:>6}")
        if nc is not None:
            notas_para_prom.append(nc)
        if diff != 0 and diff is not None:
            total_diffs_notas.append({'est': label, 'comp': ABREV.get(comp, comp), 'calc': nc, 'exp': ne, 'diff': diff})

    prom_calc = round(sum(notas_para_prom) / len(notas_para_prom)) if notas_para_prom else None
    prom_exp  = notas_exp.get('prom')
    diff_prom = (prom_calc - prom_exp) if (prom_calc is not None and prom_exp is not None) else None
    diff_str  = f"{diff_prom:+d}" if diff_prom is not None else "N/A"
    estado    = '✅' if diff_prom == 0 else '⚠️'
    print(f"  {'─'*46}")
    print(f"  {estado} {'Promedio':<20}  {str(prom_calc) if prom_calc is not None else '-':>6}  {str(prom_exp) if prom_exp is not None else '-':>6}  {diff_str:>6}")

# ── PARTE D — Resumen final ───────────────────────────────────────────────────
hdr("PARTE D — Resumen final")

n_dist = len(total_diffs_dist)
n_nota = len(total_diffs_notas)

if n_dist == 0:
    ok("Distribuciones: 0 diferencias — todas coinciden con lo esperado.")
else:
    err(f"Distribuciones con diferencias: {n_dist} caso(s)")
    for d in total_diffs_dist:
        print(f"    Est {d['est']}  Act{d['act']}: {d['diffs']}")

print()
if n_nota == 0:
    ok("Notas por competencia: 0 diferencias — todas coinciden con lo esperado.")
else:
    warn(f"Notas por competencia con diferencias: {n_nota} caso(s)")
    for d in total_diffs_notas:
        print(f"    Est {d['est']}  {d['comp']:>4}: calc={d['calc']}  exp={d['exp']}  Δ={d['diff']:+d}")

# Diagnóstico de causa
print()
if n_dist == 0 and n_nota == 0:
    ok("Conclusión: BD coincide exactamente con los valores esperados.")
elif n_dist == 0 and n_nota > 0:
    warn("Conclusión: Las distribuciones están bien ingresadas, pero la FÓRMULA de cálculo")
    warn("            produce resultados distintos a los esperados. Posibles causas:")
    print("            - Redondeo en cada paso (la app redondea al final)")
    print("            - Diferente fórmula que el usuario usó para calcular el esperado")
elif n_dist > 0 and n_nota == 0:
    warn("Conclusión: Hay diferencias en distribuciones pero las notas finales coinciden.")
    warn("            Posible causa: redondeo al ingresar puntos individuales.")
else:
    warn("Conclusión: Hay diferencias tanto en distribuciones como en notas finales.")
    deltas = [abs(d['diff']) for d in total_diffs_notas if d['diff'] is not None]
    if deltas:
        max_delta = max(deltas)
        avg_delta = sum(deltas)/len(deltas)
        if max_delta <= 1:
            print(f"            Diferencia máxima en notas: {max_delta} punto. Probable: REDONDEO.")
        elif max_delta <= 3:
            print(f"            Diferencia máxima en notas: {max_delta} puntos. Probable: FÓRMULA distinta.")
        else:
            print(f"            Diferencia máxima en notas: {max_delta} puntos. Probable: DATOS MAL ingresados.")

print(f"\n{sep('═')}\n  FIN DEL SONDEO\n{sep('═')}\n")
con.close()
