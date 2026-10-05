// Siembra datos de prueba en 6to (año activo, P1, materia F.I.H.R) para revisar Reportes:
// temas, actividades simple y multi con notas, asistencia y cuaderno anecdótico.
// Todo lo creado queda anotado en datos_prueba_reportes.json (junto a la BD) para poder borrarlo.
//
// Uso (desde la raíz del proyecto, con backup previo):
//   $env:ELECTRON_RUN_AS_NODE='1'; .\node_modules\electron\dist\electron.exe scripts\sembrar-prueba-reportes.js
//   ... scripts\sembrar-prueba-reportes.js --limpiar
'use strict'
const path   = require('path')
const fs     = require('fs')
const Module = require('module')

const USER_DATA = process.env.SD_USERDATA || path.join(process.env.APPDATA, 'sistema-academico-docente')
const origLoad = Module._load
Module._load = function (req, ...a) {
  if (req === 'electron') return { app: { getPath: () => USER_DATA } }
  return origLoad.call(this, req, ...a)
}
const db = require(path.join(__dirname, '..', 'electron', 'database.js'))
db.initialize()
const D = db.db
const MANIFIESTO = path.join(USER_DATA, 'datos_prueba_reportes.json')

if (process.argv.includes('--limpiar')) {
  if (!fs.existsSync(MANIFIESTO)) { console.log('No hay datos de prueba registrados.'); process.exit(0) }
  const m = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf-8'))
  D.transaction(() => {
    m.actividades.forEach(id => db.deleteActividad(id))
    m.temas.forEach(id => db.deleteTema(id))
    const delA = D.prepare('DELETE FROM asistencias WHERE id=?')
    m.asistencias.forEach(id => delA.run(id))
    const delO = D.prepare('DELETE FROM observaciones WHERE id=?')
    m.observaciones.forEach(id => delO.run(id))
  })()
  fs.renameSync(MANIFIESTO, MANIFIESTO.replace('.json', `_borrado_${Date.now()}.json`))
  console.log(`Borrado: ${m.temas.length} temas, ${m.actividades.length} actividades (con sus notas), ${m.asistencias.length} asistencias, ${m.observaciones.length} observaciones.`)
  process.exit(0)
}

if (fs.existsSync(MANIFIESTO)) {
  console.log('Ya hay datos de prueba sembrados (' + MANIFIESTO + '). Usa --limpiar primero.')
  process.exit(1)
}

// ── Contexto ──────────────────────────────────────────────────────────────
const anio    = db.getAnioActivo()
const materia = D.prepare("SELECT * FROM materias WHERE anio_escolar_id=? AND estado='activo' ORDER BY orden,id").get(anio.id)
const periodo = D.prepare("SELECT * FROM periodos WHERE anio_escolar_id=? AND numero_orden=1").get(anio.id)
const cursos  = D.prepare("SELECT * FROM cursos WHERE anio_escolar_id=? AND grado='6to' AND estado='activo' ORDER BY seccion").all(anio.id)
if (!materia || !periodo || cursos.length === 0) throw new Error('No se encontró materia/período/cursos de 6to')
const HOY = new Date().toISOString().slice(0, 10)
console.log(`Año ${anio.id} · ${materia.nombre} (id ${materia.id}) · ${periodo.nombre} · ${cursos.map(c => c.nombre).join(', ')}`)

// PRNG determinista: correr de nuevo (tras --limpiar) da los mismos datos
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const entre = (r, a, b) => Math.round(a + r() * (b - a))

const TEMAS = [
  ['La creación, regalo de Dios',            'realizado', '2026-09-04'],
  ['La dignidad de la persona humana',       'realizado', '2026-09-11'],
  ['La familia, primera comunidad',          'realizado', '2026-09-18'],
  ['Los valores del Reino de Dios',          'realizado', '2026-09-25'],
  ['Jesús, maestro y amigo',                 'realizado', '2026-10-02'],
  ['La oración en la vida diaria',           'aplazado',  '2026-10-02'],
  ['El servicio a los demás',                'pendiente', null],
  ['Las bienaventuranzas: camino de felicidad', 'pendiente', null],
]

// temas: índices (0-based) de TEMAS que evalúa
const ACTIVIDADES = [
  { nombre: 'Mural: la creación',                    tipo: 'Proyecto',   competencia: 'Comunicativa',       fecha: '2026-09-08', peso: 1, temas: [0] },
  { nombre: 'Cuestionario: dignidad de la persona',  tipo: 'Tarea',      competencia: 'Pensamiento Logico', fecha: '2026-09-15', peso: 1, temas: [1] },
  { nombre: 'Exposición: la familia',                tipo: 'Exposicion', competencia: 'Civica',             fecha: '2026-09-22', peso: 1, temas: [2] },
  { nombre: 'Proyecto integrador: valores del Reino', tipo: 'Proyecto',  modo: 'multi', competencias_multi: ['Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'], fecha: '2026-09-29', peso: 2, temas: [3, 4] },
  { nombre: 'Presentación digital: Jesús maestro',   tipo: 'Tarea',      competencia: 'Tecnologica',        fecha: '2026-10-02', peso: 1, temas: [4] },
]

// Perfiles para que el reporte muestre todos los estados
const PERFILES = [
  { id: 'bien',   hasta: 0.45, nota: [86, 100], asist: { presente: 0.94, tardanza: 0.04, ausente: 0.02 } },
  { id: 'limite', hasta: 0.65, nota: [72, 84],  asist: { presente: 0.88, tardanza: 0.05, ausente: 0.05, excusado: 0.02 } },
  { id: 'bajo',   hasta: 0.80, nota: [45, 68],  asist: { presente: 0.80, tardanza: 0.06, ausente: 0.12, excusado: 0.02 } },
  { id: 'sin',    hasta: 0.88, nota: null,      asist: { presente: 0.85, ausente: 0.15 } },
  { id: 'faltas', hasta: 1.00, nota: [80, 95],  asist: { presente: 0.45, ausente: 0.40, tardanza: 0.10, excusado: 0.05 } },
]

const OBS = [
  ['academico',  '[Prueba] Entregó el mural con mucha creatividad; explicó con sus palabras el relato de la creación.'],
  ['positivo',   '[Prueba] Ayudó a un compañero a terminar el cuestionario sin que se lo pidieran.'],
  ['negativo',   '[Prueba] No trajo el material para la exposición por segunda vez.'],
  ['conductual', '[Prueba] Interrumpe con frecuencia durante la oración inicial; se conversó con él/ella.'],
  ['citacion',   '[Prueba] Citación a padre/madre/tutor por inasistencias reiteradas (viernes 2 de octubre).'],
]

// Días de clase (lunes a viernes) desde el 24-sep hasta hoy, sin pasar del fin del período
function diasHabiles(desde, hasta) {
  const out = []
  for (let d = new Date(desde + 'T12:00:00'); d.toISOString().slice(0, 10) <= hasta; d.setDate(d.getDate() + 1)) {
    const w = d.getDay()
    if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10))
  }
  return out
}
const DIAS = diasHabiles('2026-09-24', HOY < periodo.fecha_fin ? HOY : periodo.fecha_fin)

function elegirEstado(r, dist) {
  let x = r(), acc = 0
  for (const [k, p] of Object.entries(dist)) { acc += p; if (x < acc) return k }
  return 'presente'
}

const m = { creado: new Date().toISOString(), materiaId: materia.id, periodoId: periodo.id, temas: [], actividades: [], asistencias: [], observaciones: [] }
const resumen = {}

D.transaction(() => {
  const existeAsist = D.prepare('SELECT 1 FROM asistencias WHERE estudiante_id=? AND fecha=?')

  for (const curso of cursos) {
    const ests = db.getEstudiantes(curso.id).filter(e => e.estado === 'activo')
    const r0 = rng(curso.id * 7919)
    const cuenta = { estudiantes: ests.length, perfiles: {}, asistencias: 0, notas: 0 }

    // Temas
    const temaIds = TEMAS.map(([titulo, estado, fecha], i) => {
      const id = Number(db.createTema({ materiaId: materia.id, cursoId: curso.id, periodoId: periodo.id, titulo, metaJson: { prueba_reportes: true } }).lastInsertRowid)
      db.updateTema(id, {
        titulo, estado,
        contenido_texto: `Tema ${i + 1} del primer período (dato de prueba).`,
        fecha_realizado: estado === 'realizado' ? fecha : null,
        fecha_aplazado:  estado === 'aplazado'  ? fecha : null,
      })
      m.temas.push(id)
      return id
    })

    // Actividades
    const acts = ACTIVIDADES.map(a => {
      const id = Number(db.createActividad({
        ...a, materiaId: materia.id, cursoId: curso.id, periodoId: periodo.id,
        descripcion: 'Dato de prueba para revisar Reportes', temaIds: a.temas.map(i => temaIds[i]),
      }).lastInsertRowid)
      m.actividades.push(id)
      return { ...a, id }
    })

    for (const est of ests) {
      const r = rng(est.id * 104729 + 17)
      const x = r()
      const perfil = PERFILES.find(p => x < p.hasta)
      cuenta.perfiles[perfil.id] = (cuenta.perfiles[perfil.id] || 0) + 1

      // Notas
      if (perfil.nota) {
        for (const a of acts) {
          const base = entre(r, perfil.nota[0], perfil.nota[1])
          if (a.modo === 'multi') {
            const techo = 100 / a.competencias_multi.length
            const dist = {}
            for (const c of a.competencias_multi) {
              const v = Math.max(0, Math.min(techo, (base + entre(r, -6, 6)) / 100 * techo))
              dist[c] = Math.round(v * 10) / 10
            }
            db.setCalificacionMulti({ actividad_id: a.id, estudiante_id: est.id, distribucion: dist })
          } else {
            db.setCalificacion({ actividadId: a.id, estudianteId: est.id, nota: base })
          }
          cuenta.notas++
        }
      }

      // Asistencia: solo días sin registro, para no pisar la asistencia real
      for (const fecha of DIAS) {
        if (existeAsist.get(est.id, fecha)) continue
        const estado = elegirEstado(r, perfil.asist)
        m.asistencias.push(Number(db.setAsistencia({ materiaId: materia.id, estudianteId: est.id, cursoId: curso.id, fecha, estado }).lastInsertRowid))
        cuenta.asistencias++
      }
    }

    // Cuaderno anecdótico: 5 estudiantes por sección, uno de cada tipo
    const elegidos = ests.slice().sort(() => r0() - 0.5).slice(0, OBS.length)
    elegidos.forEach((est, i) => {
      const [tipo, texto] = OBS[i]
      m.observaciones.push(Number(db.createObservacion({ estudianteId: est.id, fecha: DIAS[Math.min(i * 2, DIAS.length - 1)], texto, tipo }).lastInsertRowid))
    })

    resumen[curso.nombre] = cuenta
  }
})()

fs.writeFileSync(MANIFIESTO, JSON.stringify(m, null, 1), 'utf-8')
console.log(JSON.stringify(resumen, null, 1))
console.log(`Creado: ${m.temas.length} temas, ${m.actividades.length} actividades, ${m.asistencias.length} asistencias, ${m.observaciones.length} observaciones.`)
console.log('Registro para borrar: ' + MANIFIESTO)
