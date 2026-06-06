'use strict'
// ============================================================
// migrar-flujo-techo.js
//
// Migra calificaciones del flujo antiguo (nota global manual)
// al flujo nuevo (nota = suma de pts por comp, techo = 100/n).
//
// Por cada calificación con distribucion_multi:
//   - Si algún valor > techo: capea a techo.
//   - Recalcula nota_global = suma de valores corregidos.
//   - Actualiza en BD si hubo cambios.
//
// Ejecutar: npx electron scripts/migrar-flujo-techo.js
// ============================================================

const { app } = require('electron')
const Database = require('better-sqlite3')
const path     = require('path')
const os       = require('os')

app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')
app.whenReady().then(() => {
  try { runMigration() } catch (e) { console.error('ERROR:', e.message, '\n', e.stack) }
  app.quit()
})
app.on('window-all-closed', () => app.quit())

function notaFromDist(dist) {
  return Math.round(Object.values(dist).reduce((a, b) => a + b, 0) * 10) / 10
}

function runMigration() {
  const DB_PATH = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'sistema-academico-docente',
    'sistema_docente.db'
  )
  console.log(`\nBD: ${DB_PATH}`)
  const db  = new Database(DB_PATH)
  const sep = () => console.log('─'.repeat(72))

  const rows = db.prepare(`
    SELECT c.id, c.nota, c.distribucion_multi, a.competencias_multi, a.id as act_id, a.nombre as act_nombre
    FROM calificaciones c
    JOIN actividades a ON c.actividad_id = a.id
    WHERE c.distribucion_multi IS NOT NULL AND a.modo = 'multi'
  `).all()

  console.log(`\nCalificaciones con distribucion_multi encontradas: ${rows.length}`)
  sep()

  let sinCambios = 0, conCambios = 0, conErrores = 0

  const stmtUpd = db.prepare("UPDATE calificaciones SET nota=?, distribucion_multi=? WHERE id=?")

  const batch = db.transaction(() => {
    for (const row of rows) {
      const comps = row.competencias_multi ? JSON.parse(row.competencias_multi) : []
      const nc    = comps.length
      if (nc === 0) { conErrores++; console.log(`  [ID ${row.id}] Act "${row.act_nombre}": sin competencias_multi → omitida`); continue }

      const techo   = 100 / nc
      let   dist    = JSON.parse(row.distribucion_multi)
      let   cambiado = false

      for (const comp of comps) {
        const vAntes = dist[comp] ?? 0
        if (vAntes > techo + 0.001) {
          dist[comp] = Math.round(techo * 10) / 10
          console.log(`  [ID ${row.id}] ${comp}: ${vAntes.toFixed(2)} → ${dist[comp]} (techo ${techo.toFixed(2)})`)
          cambiado = true
        }
      }

      if (cambiado) {
        const nuevaNota = notaFromDist(dist)
        console.log(`  [ID ${row.id}] Act "${row.act_nombre}" — nota: ${row.nota} → ${nuevaNota}`)
        stmtUpd.run(nuevaNota, JSON.stringify(dist), row.id)
        conCambios++
      } else {
        sinCambios++
      }
    }
  })

  batch()

  sep()
  console.log(`\nResumen:`)
  console.log(`  Total procesadas : ${rows.length}`)
  console.log(`  Sin cambios      : ${sinCambios}`)
  console.log(`  Actualizadas     : ${conCambios}`)
  console.log(`  Con errores      : ${conErrores}`)
  console.log('\nMigración completa.\n')
  db.close()
}
