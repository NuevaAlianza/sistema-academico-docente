'use strict'
// ============================================================
// limpiar-distribuciones.js
// Detecta y corrige distribucion_multi con claves que no
// coinciden con las competencias actuales de su actividad.
//
// Ejecutar: npx electron scripts/limpiar-distribuciones.js
// ============================================================

const { app } = require('electron')
const Database = require('better-sqlite3')
const path     = require('path')
const os       = require('os')

app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')
app.whenReady().then(() => {
  try { runLimpieza() } catch (e) { console.error('ERROR:', e.message, e.stack) }
  app.quit()
})
app.on('window-all-closed', () => app.quit())

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

function runLimpieza() {
  const DB_PATH = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'sistema-academico-docente',
    'sistema_docente.db'
  )
  console.log(`\nBD: ${DB_PATH}`)

  const db  = new Database(DB_PATH)
  const sep  = () => console.log('─'.repeat(72))
  const sep2 = () => console.log('═'.repeat(72))

  sep2()
  console.log('LIMPIEZA DE DISTRIBUCIONES CORRUPTAS')
  console.log('Criterio: claves en distribucion_multi ≠ competencias_multi de la actividad')
  sep2()

  // Traer todas las calificaciones con distribucion_multi y nota
  const filas = db.prepare(`
    SELECT c.id, c.actividad_id, c.estudiante_id, c.nota,
           c.distribucion_multi,
           a.nombre         AS act_nombre,
           a.competencias_multi,
           e.nombre_completo,
           e.numero_lista
    FROM calificaciones c
    JOIN actividades a ON a.id = c.actividad_id
    JOIN estudiantes e ON e.id = c.estudiante_id
    WHERE c.distribucion_multi IS NOT NULL
      AND c.nota IS NOT NULL
    ORDER BY c.actividad_id, e.numero_lista
  `).all()

  console.log(`Filas con distribucion_multi: ${filas.length}\n`)

  const stmtUpdate = db.prepare(
    "UPDATE calificaciones SET distribucion_multi=? WHERE id=?"
  )

  let correctas  = 0
  let corregidas = 0

  const ejecutar = db.transaction(() => {
    for (const fila of filas) {
      const comps  = JSON.parse(fila.competencias_multi || '[]')
      const dist   = JSON.parse(fila.distribucion_multi)

      const oldKeys = Object.keys(dist).sort()
      const newKeys = [...comps].sort()
      const ok      = JSON.stringify(oldKeys) === JSON.stringify(newKeys)

      if (ok) { correctas++; continue }

      const distNueva = equipartir(fila.nota, comps)
      stmtUpdate.run(JSON.stringify(distNueva), fila.id)
      corregidas++

      sep()
      console.log(`  Act [${fila.actividad_id}] "${fila.act_nombre}"`)
      console.log(`  Estudiante: #${String(fila.numero_lista).padStart(2,'0')} ${fila.nombre_completo}`)
      console.log(`  nota       = ${fila.nota}`)
      console.log(`  comps act  = [${comps.join(', ')}]`)
      console.log(`  dist VIEJA = ${JSON.stringify(dist)}`)
      console.log(`  dist NUEVA = ${JSON.stringify(distNueva)}`)
    }
  })

  ejecutar()

  sep2()
  console.log('RESUMEN')
  sep2()
  console.log(`  Distribuciones sin cambio (correctas): ${correctas}`)
  console.log(`  Distribuciones corregidas:             ${corregidas}`)
  sep2()

  db.close()
  console.log('BD cerrada. Limpieza completa.')
}
