'use strict'
// ============================================================
// diagnostico-multi.js  — solo lectura, no modifica nada
//
// Ejecutar desde la raíz del proyecto:
//   npx electron scripts/diagnostico-multi.js
//
// (Se necesita Electron porque better-sqlite3 está compilado
//  para el Node embebido en Electron, no para el Node del sistema)
// ============================================================

const { app } = require('electron')
const Database = require('better-sqlite3')
const path     = require('path')
const os       = require('os')

// Suprimir advertencias de accesibilidad del SO
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')

app.whenReady().then(() => {
  try {
    runDiag()
  } catch (e) {
    console.error('ERROR:', e.message)
    console.error(e.stack)
  }
  app.quit()
})

// Evitar que Electron espere una ventana para salir
app.on('window-all-closed', () => app.quit())

function runDiag() {
  // Ruta absoluta: app.getPath('userData') no funciona fuera del proceso principal real
  const DB_PATH = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'sistema-academico-docente',
    'sistema_docente.db'
  )

  console.log(`\nBD: ${DB_PATH}`)

  const db = new Database(DB_PATH, { readonly: true })

  const sep  = () => console.log('─'.repeat(72))
  const sep2 = () => console.log('═'.repeat(72))

  // ── Detectar conjunto con más actividades multi ─────────────────────────
  sep2()
  console.log('DETECCIÓN AUTOMÁTICA DEL CONJUNTO CON ACTIVIDADES MULTI')
  sep2()

  const conjuntos = db.prepare(`
    SELECT a.curso_id, a.periodo_id, a.materia_id,
           c.nombre  AS curso_nombre,
           p.nombre  AS periodo_nombre,
           m.nombre  AS materia_nombre,
           COUNT(*)  AS total_multi
    FROM actividades a
    JOIN cursos   c ON c.id = a.curso_id
    JOIN periodos p ON p.id = a.periodo_id
    LEFT JOIN materias m ON m.id = a.materia_id
    WHERE a.modo = 'multi'
    GROUP BY a.curso_id, a.periodo_id, a.materia_id
    ORDER BY total_multi DESC, a.id DESC
  `).all()

  if (conjuntos.length === 0) {
    console.log('⚠  No hay actividades multi en la BD.')
    db.close(); return
  }

  console.log('Conjuntos encontrados:')
  conjuntos.forEach((r, i) => {
    const mat = r.materia_nombre || `materia_id=${r.materia_id ?? 'null'}`
    console.log(`  [${i+1}] ${r.curso_nombre} / ${r.periodo_nombre} / ${mat}  →  ${r.total_multi} acts multi`)
  })

  const sel       = conjuntos[0]
  const cursoId   = sel.curso_id
  const periodoId = sel.periodo_id
  const materiaId = sel.materia_id

  console.log(`\n► Usando: ${sel.curso_nombre} / ${sel.periodo_nombre} / ${sel.materia_nombre || 'sin materia'}`)
  console.log(`  curso_id=${cursoId}  periodo_id=${periodoId}  materia_id=${materiaId ?? 'null'}`)

  // ── A. Actividades multi ───────────────────────────────────────────────
  sep2()
  console.log('A) ACTIVIDADES MULTI DEL PERÍODO')
  sep2()

  const stmtActs = materiaId
    ? db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? AND modo='multi' ORDER BY id")
    : db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND modo='multi' ORDER BY id")

  const actsMulti = materiaId
    ? stmtActs.all(cursoId, periodoId, materiaId)
    : stmtActs.all(cursoId, periodoId)

  actsMulti.forEach(a => {
    const comps = JSON.parse(a.competencias_multi || '[]')
    console.log(`\n  [ID ${a.id}] ${a.nombre}`)
    console.log(`    modo=${a.modo}  peso=${a.peso}  tipo=${a.tipo}  fecha=${a.fecha || 'n/a'}`)
    console.log(`    competencias_multi (raw): ${a.competencias_multi}`)
    console.log(`    competencias_multi (arr): [${comps.join(', ')}]  n=${comps.length}  pesoComp=${(a.peso/comps.length).toFixed(2)}`)
  })

  // ── B. Calificaciones de los primeros 4 estudiantes ────────────────────
  sep2()
  console.log('B) CALIFICACIONES — PRIMEROS 4 ESTUDIANTES')
  sep2()

  const estudiantes = db.prepare(`
    SELECT * FROM estudiantes
    WHERE curso_id=? AND estado='activo'
    ORDER BY numero_lista
    LIMIT 4
  `).all(cursoId)

  console.log(`Estudiantes: ${estudiantes.length}`)

  for (const est of estudiantes) {
    sep()
    console.log(`👤 ${est.nombre_completo}  (lista #${est.numero_lista}, ID ${est.id})`)

    for (const act of actsMulti) {
      const comps = JSON.parse(act.competencias_multi || '[]')
      const n     = comps.length

      const calif = db.prepare(
        'SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?'
      ).get(act.id, est.id)

      console.log(`\n  [Act ${act.id}] ${act.nombre}  (peso=${act.peso}, n=${n}, pesoComp=${(act.peso/n).toFixed(2)})`)

      if (!calif) {
        console.log('    → SIN REGISTRO')
        continue
      }
      if (calif.nota === null) {
        console.log('    → nota=NULL (registro sin nota)')
        continue
      }

      const nota = calif.nota
      const dist = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null
      console.log(`    nota guardada : ${nota}`)
      console.log(`    distribuc_raw : ${calif.distribucion_multi || 'NULL'}`)

      if (dist) {
        const sumaTotal = Object.values(dist).reduce((s, v) => s + v, 0)
        const diff      = Math.abs(sumaTotal - nota)
        const estado    = diff <= 0.05 ? '✓ OK' : `✗ DIFERENCIA de ${(sumaTotal - nota).toFixed(3)}`
        console.log(`    dist parseado : ${JSON.stringify(dist)}`)
        console.log(`    suma_dist     : ${Math.round(sumaTotal*1000)/1000}  vs nota=${nota}  →  ${estado}`)
        comps.forEach(c => {
          const v = dist[c] !== undefined ? dist[c] : 'AUSENTE'
          console.log(`      dist[${c}] = ${v}`)
        })
        const extra = Object.keys(dist).filter(k => !comps.includes(k))
        if (extra.length > 0) console.log(`      ⚠ Claves extra: [${extra.join(', ')}]`)
      } else {
        console.log('    distribucion_multi: NULL → se usará equipartición como fallback')
      }
    }
  }

  // ── C. Resumen por competencia con 4 fórmulas ─────────────────────────
  sep2()
  console.log('C) RESUMEN POR COMPETENCIA — 4 FÓRMULAS COMPARADAS')
  sep2()

  const COMPS = ['Comunicativa', 'Científica', 'Ética', 'Cívica']

  for (const est of estudiantes) {
    sep()
    console.log(`👤 ${est.nombre_completo}`)

    for (const comp of COMPS) {
      const filas = []
      for (const act of actsMulti) {
        const comps = JSON.parse(act.competencias_multi || '[]')
        if (!comps.includes(comp)) continue
        const n = comps.length

        const calif = db.prepare(
          'SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?'
        ).get(act.id, est.id)

        if (!calif || calif.nota === null) continue

        const dist    = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null
        const ptsComp = dist ? (dist[comp] ?? 0) : (calif.nota / n)

        filas.push({
          actId:    act.id,
          nombre:   act.nombre,
          pesoAct:  act.peso,
          n,
          pesoComp: act.peso / n,
          nota:     calif.nota,
          ptsComp,
          dist,
          fallback: !dist,
        })
      }

      if (filas.length === 0) {
        console.log(`\n  ${comp}: (sin actividades con nota para este estudiante)`)
        continue
      }

      const sumPts       = filas.reduce((s, r) => s + r.ptsComp, 0)
      const sumPeso      = filas.reduce((s, r) => s + r.pesoComp, 0)
      const sumPonderada = filas.reduce((s, r) => s + r.ptsComp * r.pesoAct, 0)
      const sumPesoAct   = filas.reduce((s, r) => s + r.pesoAct, 0)
      const nRef         = filas[0].n

      // Fórmula A: (Σ pts × 100) / Σ pesoComp
      const notaA = sumPeso > 0 ? Math.round((sumPts * 100) / sumPeso) : null

      // Fórmula B: round(Σpts / Σpeso × 100) — igual a A, verificación
      const notaB = sumPeso > 0 ? Math.round(sumPts / sumPeso * 100) : null

      // Fórmula C del spec: (Σpts × Σpesoact) / (Σpeso × n)
      const notaC = (sumPeso > 0 && nRef > 0)
        ? Math.round((sumPts * sumPesoAct) / (sumPeso * nRef))
        : null

      // Implementación actual: Σ(pts × pesoAct) / Σ pesoComp
      const notaImpl = sumPeso > 0 ? Math.round(sumPonderada / sumPeso) : null

      console.log(`\n  ● ${comp}  (${filas.length} actividad/es con nota)`)
      filas.forEach(r => {
        const fb = r.fallback ? ' [fallback-equitativo]' : ''
        console.log(`    act[${r.actId}] nota=${r.nota}  pesoAct=${r.pesoAct}  n=${r.n}  pesoComp=${r.pesoComp.toFixed(2)}  dist[comp]=${r.ptsComp}${fb}`)
      })
      console.log(`    ─────────────────────────────────────`)
      console.log(`    Σ dist[comp]       = ${Math.round(sumPts*100)/100}`)
      console.log(`    Σ pesoComp         = ${Math.round(sumPeso*100)/100}`)
      console.log(`    Σ (pts × pesoAct)  = ${Math.round(sumPonderada*100)/100}`)
      console.log(`    Σ pesoAct          = ${sumPesoAct}`)
      console.log(`    ─────────────────────────────────────`)
      console.log(`    Fórmula A: round((Σpts×100) / Σpeso)              = ${notaA ?? '—'}`)
      console.log(`    Fórmula B: round(Σpts/Σpeso × 100)                = ${notaB ?? '—'}  ← igual a A`)
      console.log(`    Fórmula C: round((Σpts×Σpesoact)/(Σpeso×n))       = ${notaC ?? '—'}`)
      console.log(`    Impl.actual: round(Σ(pts×pesoAct)/Σpeso)          = ${notaImpl ?? '—'}`)
    }
  }

  // ── D. Tabla cruda completa ────────────────────────────────────────────
  sep2()
  console.log('D) TABLA CRUDA — todas las calificaciones de las acts multi')
  sep2()

  for (const act of actsMulti) {
    const comps = JSON.parse(act.competencias_multi || '[]')
    console.log(`\n  [Act ${act.id}] ${act.nombre}  peso=${act.peso}  comps=[${comps.join(', ')}]`)
    sep()

    const filas = db.prepare(`
      SELECT c.*, e.nombre_completo, e.numero_lista
      FROM calificaciones c
      JOIN estudiantes e ON e.id = c.estudiante_id
      WHERE c.actividad_id=?
      ORDER BY e.numero_lista
    `).all(act.id)

    if (filas.length === 0) { console.log('  (sin calificaciones)'); continue }

    filas.forEach(f => {
      const dist = f.distribucion_multi ? JSON.parse(f.distribucion_multi) : null
      const suma = dist
        ? Math.round(Object.values(dist).reduce((s, v) => s + v, 0) * 100) / 100
        : null
      const ok   = dist && typeof f.nota === 'number'
        ? (Math.abs(suma - f.nota) <= 0.05 ? '✓' : `✗ esperado ${f.nota}`)
        : ''
      const distStr = dist
        ? comps.map(c => `${c.slice(0,3)}=${dist[c] ?? '?'}`).join('  ')
        : 'sin dist'
      console.log(`  #${String(f.numero_lista).padStart(2,'0')} ${f.nombre_completo.padEnd(30)}  nota=${String(f.nota).padStart(3)}  suma=${String(suma ?? '-').padStart(5)} ${ok}  [${distStr}]`)
    })
  }

  db.close()
  sep2()
  console.log('Diagnóstico completo. BD no fue modificada.')
  sep2()
}
