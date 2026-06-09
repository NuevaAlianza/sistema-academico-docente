'use strict'
// ============================================================
// verificar-distribucion-manual.js — solo lectura
//
// Verifica si getResumenCompetenciasMultiPorEstudiante respeta
// los valores manuales en distribucion_multi.
//
// Ejecutar: npx electron scripts/verificar-distribucion-manual.js
// ============================================================

const { app } = require('electron')
const Database = require('better-sqlite3')
const path     = require('path')
const os       = require('os')

app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')
app.whenReady().then(() => {
  try { runDiag() } catch (e) { console.error('ERROR:', e.message, '\n', e.stack) }
  app.quit()
})
app.on('window-all-closed', () => app.quit())

// ── Misma función que usa el frontend y database.js ──────────────────────
function equipartir(nota, comps) {
  const nc = comps.length
  if (nc === 0) return {}
  const base = Math.floor(nota * 10 / nc) / 10
  const dist = {}
  comps.forEach((c, i) => {
    dist[c] = i < nc - 1 ? base : Math.round((nota - base * (nc - 1)) * 10) / 10
  })
  return dist
}

// ── Replica exacta de getResumenCompetenciasMultiPorEstudiante ────────────
function calcularResumenEstudiante(db, estudianteId, cursoId, periodoId, materiaId) {
  const COMPS = ['Comunicativa', 'Científica', 'Ética', 'Cívica']
  const q = materiaId
    ? db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? AND modo='multi' ORDER BY id")
    : db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND modo='multi' ORDER BY id")
  const actsMulti = materiaId ? q.all(cursoId, periodoId, materiaId) : q.all(cursoId, periodoId)

  const resultado = {}
  for (const comp of COMPS) {
    let peso_evaluado  = 0
    let suma_ponderada = 0
    let en_periodo     = false

    for (const act of actsMulti) {
      const comps = JSON.parse(act.competencias_multi || '[]')
      if (!comps.includes(comp)) continue
      const n       = comps.length
      const pesoComp = act.peso / n
      en_periodo    = true

      const calif = db.prepare(
        'SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?'
      ).get(act.id, estudianteId)

      if (calif && calif.nota !== null) {
        peso_evaluado  += pesoComp
        const dist      = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null
        const pts       = dist ? (dist[comp] ?? 0) : (calif.nota / n)
        suma_ponderada += pts * act.peso
      }
    }

    if (!en_periodo) continue
    resultado[comp] = {
      puntos_obtenidos: Math.round(suma_ponderada * 100) / 100,
      peso_evaluado:    Math.round(peso_evaluado  * 100) / 100,
      nota: peso_evaluado > 0 ? Math.round(suma_ponderada / peso_evaluado) : null,
    }
  }
  return resultado
}

function runDiag() {
  const DB_PATH = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'sistema-academico-docente',
    'sistema_docente.db'
  )
  console.log(`\nBD: ${DB_PATH}`)
  const db   = new Database(DB_PATH, { readonly: true })
  const sep  = () => console.log('─'.repeat(72))
  const sep2 = () => console.log('═'.repeat(72))

  // ── 1. Localizar la actividad objetivo ───────────────────────────────────
  sep2()
  console.log('BÚSQUEDA DE LA ACTIVIDAD OBJETIVO')
  sep2()

  // Buscar por ID=4 primero, luego por nombre, luego primer multi peso=20
  let act = db.prepare("SELECT * FROM actividades WHERE id=4 AND modo='multi'").get()
  let cómo = 'ID=4'
  if (!act) {
    act = db.prepare(
      "SELECT * FROM actividades WHERE modo='multi' AND (LOWER(nombre) LIKE '%proyecto%' OR LOWER(nombre) LIKE '%interdisciplin%') LIMIT 1"
    ).get()
    cómo = 'nombre ~proyecto/interdisciplin'
  }
  if (!act) {
    act = db.prepare("SELECT * FROM actividades WHERE modo='multi' AND peso=20 ORDER BY id LIMIT 1").get()
    cómo = 'primer multi con peso=20 (fallback)'
  }
  if (!act) {
    act = db.prepare("SELECT * FROM actividades WHERE modo='multi' ORDER BY id LIMIT 1").get()
    cómo = 'primera actividad multi (último recurso)'
  }

  if (!act) { console.log('⚠  No hay actividades multi en la BD.'); db.close(); return }

  const compsAct = JSON.parse(act.competencias_multi || '[]')
  console.log(`\nActividad encontrada (método: ${cómo}):`)
  console.log(`  ID        = ${act.id}`)
  console.log(`  Nombre    = "${act.nombre}"`)
  console.log(`  Peso      = ${act.peso}`)
  console.log(`  Modo      = ${act.modo}`)
  console.log(`  Comps     = [${compsAct.join(', ')}]  (n=${compsAct.length})`)
  console.log(`  curso_id  = ${act.curso_id}`)

  // Meta del período/materia
  const meta = db.prepare("SELECT periodo_id, materia_id FROM actividades WHERE id=?").get(act.id)
  const periodoId = meta.periodo_id
  const materiaId = meta.materia_id
  const cursoId   = act.curso_id

  const perNombre = db.prepare("SELECT nombre FROM periodos WHERE id=?").get(periodoId)?.nombre || `ID ${periodoId}`
  console.log(`  periodo   = ${perNombre} (id=${periodoId})`)
  console.log(`  materia_id= ${materiaId ?? 'null'}`)

  // ── 2. Primeros 4 estudiantes ─────────────────────────────────────────────
  const estudiantes = db.prepare(
    "SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista LIMIT 4"
  ).all(cursoId)

  sep2()
  console.log('SECCIÓN A — CALIFICACIONES CRUDAS EN LA ACTIVIDAD OBJETIVO')
  console.log(`Actividad [${act.id}] "${act.nombre}"  comps=[${compsAct.join(', ')}]`)
  sep2()

  for (const est of estudiantes) {
    const calif = db.prepare(
      'SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?'
    ).get(act.id, est.id)

    console.log(`\nESTUDIANTE #${String(est.numero_lista).padStart(2,'0')} ${est.nombre_completo}`)
    if (!calif || calif.nota === null) {
      console.log('  Sin nota guardada para esta actividad.')
      continue
    }

    const nota    = calif.nota
    const distRaw = calif.distribucion_multi
    const dist    = distRaw ? JSON.parse(distRaw) : null

    console.log(`  nota guardada           : ${nota}`)
    console.log(`  distribucion_multi RAW  : ${distRaw ?? 'NULL'}`)

    if (dist) {
      console.log(`  distribucion_multi      : ${JSON.stringify(dist)}`)
      const suma = Object.values(dist).reduce((s, v) => s + v, 0)
      console.log(`  suma de valores         : ${Math.round(suma * 1000) / 1000}`)

      // ¿Equitativa? — todos los valores iguales ±1
      const vals   = Object.values(dist)
      const minV   = Math.min(...vals)
      const maxV   = Math.max(...vals)
      const equit  = (maxV - minV) <= 1 ? 'SÍ' : 'NO (distribución manual)'
      console.log(`  ¿es equitativa? (±1)    : ${equit}`)

      // Diferencia vs equipartición
      const distEq = equipartir(nota, compsAct)
      const igualAEq = JSON.stringify(dist) === JSON.stringify(distEq)
      if (!igualAEq) {
        console.log(`  equipartir esperaría    : ${JSON.stringify(distEq)}`)
        console.log(`  → DIFERENCIA detectada  : el cálculo debe usar dist real, NO equipartir`)
      } else {
        console.log(`  → Coincide con equipartir (sin ajuste manual o ajuste idéntico)`)
      }
    } else {
      console.log('  distribucion_multi: NULL → el cálculo usará nota/n como fallback')
    }
  }

  // ── 3. Resultado de getResumenCompetenciasMultiPorEstudiante ─────────────
  sep2()
  console.log('SECCIÓN B — RESULTADO DE getResumenCompetenciasMultiPorEstudiante')
  console.log('(Replica exacta del método en database.js)')
  sep2()

  for (const est of estudiantes) {
    sep()
    console.log(`ESTUDIANTE #${String(est.numero_lista).padStart(2,'0')} ${est.nombre_completo}`)
    const resumen = calcularResumenEstudiante(db, est.id, cursoId, periodoId, materiaId)

    if (Object.keys(resumen).length === 0) {
      console.log('  (Sin actividades multi con nota para este estudiante)')
      continue
    }

    for (const [comp, v] of Object.entries(resumen)) {
      const notaStr = v.nota !== null ? String(v.nota) : '—'
      console.log(`  ${comp.padEnd(14)} puntos=${String(v.puntos_obtenidos).padStart(7)}  peso_eval=${String(v.peso_evaluado).padStart(6)}  nota=${notaStr}`)
    }
  }

  // ── 4. Detalle paso a paso para la ÚLTIMA competencia del Est. 3 ─────────
  sep2()
  const est3 = estudiantes[2]  // índice 2 = lista #3
  const compTarget = compsAct[compsAct.length - 1]  // última comp de la actividad
  console.log(`SECCIÓN C — DETALLE PASO A PASO`)
  console.log(`Estudiante: ${est3 ? est3.nombre_completo : 'N/A (menos de 3 en el curso)'}`)
  console.log(`Competencia analizada: "${compTarget}"`)
  console.log('(Si la competencia pedida no existe en multi, se usa la última de la actividad)')
  sep2()

  if (!est3) { db.close(); return }

  // Buscar todas las actividades multi del período que incluyen compTarget
  const stmtAllMulti = materiaId
    ? db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? AND modo='multi' ORDER BY id")
    : db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND modo='multi' ORDER BY id")
  const todasMulti = materiaId
    ? stmtAllMulti.all(cursoId, periodoId, materiaId)
    : stmtAllMulti.all(cursoId, periodoId)

  let pesoEvalAcum   = 0
  let puntosAcum     = 0
  let actividadesCon = 0

  console.log(`\nActividades multi que incluyen "${compTarget}":`)
  sep()

  for (const a of todasMulti) {
    const comps = JSON.parse(a.competencias_multi || '[]')
    if (!comps.includes(compTarget)) {
      console.log(`  [Act ${a.id}] "${a.nombre}"  →  NO incluye "${compTarget}", omitida`)
      continue
    }

    const n        = comps.length
    const pesoComp = a.peso / n

    const calif = db.prepare(
      'SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?'
    ).get(a.id, est3.id)

    if (!calif || calif.nota === null) {
      console.log(`  [Act ${a.id}] "${a.nombre}"  peso=${a.peso}  n=${n}  pesoComp=${pesoComp.toFixed(2)}`)
      console.log(`             SIN NOTA para este estudiante — no contribuye`)
      continue
    }

    const dist    = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null
    const pts     = dist !== null ? (dist[compTarget] ?? 0) : (calif.nota / n)
    const fuente  = dist !== null
      ? (dist[compTarget] !== undefined ? `dist["${compTarget}"]=${dist[compTarget]}` : `dist["${compTarget}"] AUSENTE → 0`)
      : `fallback: nota/n = ${calif.nota}/${n} = ${Math.round(calif.nota/n*100)/100}`

    const contrib_peso   = pesoComp
    const contrib_puntos = pts * a.peso

    pesoEvalAcum   += pesoComp
    puntosAcum     += contrib_puntos
    actividadesCon++

    console.log(`\n  [Act ${a.id}] "${a.nombre}"`)
    console.log(`    peso_act   = ${a.peso}`)
    console.log(`    n_comps    = ${n}  →  pesoComp = ${a.peso}/${n} = ${pesoComp.toFixed(4)}`)
    console.log(`    nota est.  = ${calif.nota}`)
    console.log(`    dist RAW   = ${calif.distribucion_multi ?? 'NULL'}`)
    console.log(`    pts usados = ${fuente}`)
    console.log(`    contrib peso_evaluado  += ${pesoComp.toFixed(4)}   (acum: ${(pesoEvalAcum).toFixed(4)})`)
    console.log(`    contrib puntos_obteni. += ${pts} × ${a.peso} = ${contrib_puntos.toFixed(4)}  (acum: ${puntosAcum.toFixed(4)})`)
  }

  sep()
  if (actividadesCon === 0) {
    console.log(`\nResultado: sin actividades con nota que incluyan "${compTarget}"`)
  } else {
    const notaFinal = Math.round(puntosAcum / pesoEvalAcum)
    console.log(`\nTotales acumulados:`)
    console.log(`  peso_evaluado    = ${Math.round(pesoEvalAcum*100)/100}`)
    console.log(`  puntos_obtenidos = ${Math.round(puntosAcum*100)/100}`)
    console.log(`  nota final       = round(${Math.round(puntosAcum*100)/100} / ${Math.round(pesoEvalAcum*100)/100}) = ${notaFinal}`)
    console.log(`\n¿El valor de pts_usados viene del dist real o de equipartir?`)
    console.log('  → Ver arriba: si dice "dist[comp]=X" usó el valor real.')
    console.log('  → Si dice "fallback" usó nota/n (no había distribucion_multi en BD).')
  }

  db.close()
  sep2()
  console.log('Diagnóstico completo. BD no fue modificada.')
  sep2()
}
