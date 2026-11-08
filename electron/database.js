'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { randomUUID } = require('node:crypto');
const padronPortal = require('./padronPortal');

// Distribución por defecto: cada comp al techo (100 / n_comps).
// Usada al abrir celda vacía o al cambiar competencias de una actividad.
function defaultDist(comps) {
  const nc = comps.length;
  if (nc === 0) return {};
  const techo = Math.round(100 / nc * 10) / 10;
  const dist = {};
  comps.forEach(c => { dist[c] = techo; });
  return dist;
}

function notaFromDist(dist) {
  return Math.round(Object.values(dist).reduce((a, b) => a + b, 0) * 10) / 10;
}

// ── Evaluación del plan (referencia-6to: plan.json / web.json) ─────────────
// Grupos de competencias del plan → claves de la app. Ojo: en el plan el grupo 3 es
// Tecnológica y el 4 Cívica; en la app el orden de columnas es Com → PL → Cív → Tec.
const GRUPO_COMPETENCIA = { 1: 'Comunicativa', 2: 'Pensamiento Logico', 3: 'Tecnologica', 4: 'Civica' };
const ORDEN_COMPS = ['Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'];
const PESOS_6_SEMANAS = [10, 15, 20, 15, 15, 25];
const r1 = x => Math.round(x * 10) / 10;

// Acepta plan.json (tiene `evaluacion`) o web.json (arreglo de semanas; la evaluación
// viene en detalle.plan_periodo de alguna semana). Devuelve una actividad por semana.
function leerPlanEvaluacion(json) {
  let plan = null;
  if (Array.isArray(json)) {
    const conPlan = json.find(s => s && s.detalle && s.detalle.plan_periodo && s.detalle.plan_periodo.evaluacion);
    if (conPlan) plan = { ...conPlan.detalle.plan_periodo, semanas: json.map(s => ({ semana: s.semana, titulo: s.titulo })) };
  } else if (json && typeof json === 'object' && json.evaluacion) {
    plan = json;
  }
  if (!plan || !Array.isArray(plan.evaluacion && plan.evaluacion.grupos)) {
    return { error: 'El archivo no trae la evaluación del período (evaluacion.grupos). Usa el plan.json o el web.json del período.' };
  }

  const avisos = [];
  const porSemana = {};
  for (const gr of plan.evaluacion.grupos) {
    const comp = GRUPO_COMPETENCIA[gr.grupo];
    if (!comp) {
      console.warn('Plan: grupo de competencias desconocido', gr.grupo);
      avisos.push(`Grupo de competencias desconocido (${gr.grupo}): se omitió.`);
      continue;
    }
    for (const e of gr.evidencias || []) {
      const m = /S(\d+)/i.exec(e.sesion || '');
      const puntos = Number(e.puntos);
      if (!m) { avisos.push(`"${e.nombre}": sesión sin semana (${e.sesion || 'vacía'}), se omitió.`); continue; }
      if (!Number.isFinite(puntos) || puntos <= 0) { avisos.push(`"${e.nombre}": puntos inválidos (${e.puntos}), se omitió.`); continue; }
      const w = Number(m[1]);
      (porSemana[w] = porSemana[w] || []).push({
        competencia: comp, nombre: String(e.nombre || 'Evidencia'), sesion: e.sesion || '',
        instrumento: e.instrumento || '', puntos,
      });
    }
  }

  const nums = Object.keys(porSemana).map(Number).sort((a, b) => a - b);
  if (nums.length === 0) return { error: 'La evaluación del plan no tiene evidencias con puntos.' };
  const pesoIgual = Math.round(100 / nums.length);
  const intSemana = plan.integracion && Number(plan.integracion.semana);
  const ultima = nums[nums.length - 1];

  const semanas = nums.map((w, i) => {
    const evidencias = porSemana[w].sort((a, b) =>
      ORDEN_COMPS.indexOf(a.competencia) - ORDEN_COMPS.indexOf(b.competencia) || a.sesion.localeCompare(b.sesion));
    const competencias = ORDEN_COMPS.filter(c => evidencias.some(e => e.competencia === c));
    const s = (plan.semanas || []).find(x => Number(x.semana) === w);
    return {
      semana: w,
      nombre: `S${w} — ${(s && s.titulo) || 'Semana ' + w}`,
      tipo: w === ultima && nums.length > 1 ? 'Proyecto' : (w === intSemana ? 'Exposicion' : 'Tarea'),
      modo: competencias.length > 1 ? 'multi' : 'simple',
      competencias,
      peso: nums.length === 6 ? PESOS_6_SEMANAS[i] : pesoIgual,
      evidencias,
    };
  });

  return {
    grado: plan.grado || null,
    periodo: plan.periodo != null ? Number(plan.periodo) : null,
    unidad: plan.unidad && plan.unidad.titulo ? plan.unidad.titulo : null,
    semanas, avisos,
  };
}

// meta_json de un tema a partir de una fila de Portal-Ars / web.json (guarda todo el `detalle`).
function metaTemaPortalArs(it) {
  const d = (it.detalle && typeof it.detalle === 'object') ? it.detalle : {};
  const meta = {
    semana: it.semana ?? null, texto_ampliado: it.texto_ampliado || null,
    subtitulo: d.subtitulo || null, fase: d.fase || null, competencia: d.competencia || null,
    indicadores: d.indicadores || null, peso: d.peso || null, instrumento: d.instrumento || null,
    actividades: d.actividades || null, texto_biblico: d.texto_biblico || null,
    metacognicion: d.metacognicion || null, recursos: d.recursos || null,
    materiales: d.materiales || null, actividades_cuaderno: d.actividades_cuaderno || null,
    classroom_txt: d.classroom_txt || null, rubrica: d.rubrica || null, nota_sustituto: d.nota_sustituto || null,
    plan_periodo: d.plan_periodo || null,
    origen: 'portal-ars',
  };
  Object.keys(meta).forEach(k => { if (meta[k] === null) delete meta[k]; });
  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

// Nota de una actividad a partir de los puntos de sus evidencias, igual que si el
// docente la escribiera: simple → 0-100; multi → por competencia, sobre su techo (100/n).
// Devuelve null si falta alguna evidencia (pendiente) o la configuración no cuadra.
function notaDesdeEvidencias(act, evidencias, puntosEst) {
  if (evidencias.some(e => puntosEst[e.id] == null)) return null;
  const sumar = comp => {
    const evs = evidencias.filter(e => comp == null || e.competencia === comp);
    const max = evs.reduce((a, e) => a + e.puntos, 0);
    if (max <= 0) return null;
    return evs.reduce((a, e) => a + puntosEst[e.id], 0) / max;
  };
  if (act.modo !== 'multi') {
    const f = sumar(null);
    return f == null ? null : { nota: r1(f * 100), distribucion: null };
  }
  const comps = act.competencias_multi ? JSON.parse(act.competencias_multi) : [];
  if (comps.length === 0) return null;
  const techo = 100 / comps.length;
  const distribucion = {};
  for (const c of comps) {
    const f = sumar(c);
    if (f == null) return null;
    distribucion[c] = r1(Math.min(f * techo, techo));
  }
  return { nota: notaFromDist(distribucion), distribucion };
}

class SistemaDB {
  constructor() { this.db = null; }

  initialize() {
    const dbPath = path.join(app.getPath('userData'), 'sistema_docente.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.crearTablas();
    this.migrarTablas();
    this.seedDatos();
    const m = this.db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)");
    m.run('nombre_maestro',   'Prof. Nombre Apellido');
    m.run('centro_educativo', '');
    console.log('Base de datos lista en:', dbPath);
  }

  migrarTablas() {
    const columnas = [
      { tabla: 'horario_asignaciones', col: 'materia_id',          def: 'INTEGER' },
      { tabla: 'asistencias',          col: 'materia_id',          def: 'INTEGER' },
      { tabla: 'actividades',          col: 'materia_id',          def: 'INTEGER' },
      { tabla: 'actividades',          col: 'modo',                def: "TEXT DEFAULT 'simple'" },
      { tabla: 'actividades',          col: 'competencias_multi',  def: 'TEXT' },
      { tabla: 'calificaciones',       col: 'distribucion_multi',  def: 'TEXT' },
      { tabla: 'temas',                col: 'materia_id',          def: 'INTEGER' },
      { tabla: 'curso_nota_rapida',    col: 'materia_id',          def: 'INTEGER' },
      { tabla: 'curso_anotaciones',    col: 'materia_id',          def: 'INTEGER' },
      { tabla: 'estudiantes',          col: 'grupo_trabajo',       def: 'INTEGER' },
      { tabla: 'participaciones',      col: 'fase',                def: 'TEXT' },
    ]
    for (const { tabla, col, def } of columnas) {
      try {
        this.db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${def}`)
        console.log(`Migración: ${tabla}.${col} agregado`)
      } catch(e) { /* columna ya existe */ }
    }

    this.db.exec("CREATE TABLE IF NOT EXISTS materias (id INTEGER PRIMARY KEY AUTOINCREMENT, anio_escolar_id INTEGER NOT NULL, nombre TEXT NOT NULL, color TEXT DEFAULT '#2563A8', orden INTEGER DEFAULT 0, estado TEXT DEFAULT 'activo', FOREIGN KEY (anio_escolar_id) REFERENCES anios_escolares(id))")
    this.db.exec("CREATE TABLE IF NOT EXISTS periodo_titulos (id INTEGER PRIMARY KEY AUTOINCREMENT, materia_id INTEGER NOT NULL, grado TEXT NOT NULL, numero_periodo INTEGER NOT NULL, titulo TEXT NOT NULL, UNIQUE(materia_id, grado, numero_periodo), FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE)")

    try {
      const info = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='curso_nota_rapida'").get()
      if (info && info.sql && !info.sql.includes('UNIQUE(curso_id, materia_id)') && !info.sql.includes('materia_id, curso_id')) {
        this.db.exec(`CREATE TABLE IF NOT EXISTS curso_nota_rapida_new (id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL, materia_id INTEGER, texto TEXT DEFAULT '', updated_at TEXT, UNIQUE(curso_id, materia_id), FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE)`)
        this.db.exec("INSERT OR IGNORE INTO curso_nota_rapida_new (curso_id, materia_id, texto, updated_at) SELECT curso_id, NULL, texto, updated_at FROM curso_nota_rapida")
        this.db.exec("DROP TABLE curso_nota_rapida")
        this.db.exec("ALTER TABLE curso_nota_rapida_new RENAME TO curso_nota_rapida")
        console.log('curso_nota_rapida recreada')
      }
    } catch(e) { console.error('Error recreando nota:', e.message) }

    const sinMaterias = this.db.prepare("SELECT COUNT(*) as n FROM materias").get()
    if (sinMaterias.n === 0) {
      const anio = this.db.prepare("SELECT * FROM anios_escolares WHERE estado='activo' ORDER BY id DESC LIMIT 1").get()
      if (anio) {
        const mat = this.db.prepare("INSERT INTO materias (anio_escolar_id, nombre, color, orden) VALUES (?, ?, ?, ?)").run(anio.id, 'Mi Materia', '#2563A8', 0)
        this.db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)").run('materia_activa_id', String(mat.lastInsertRowid))
      }
    }

    try { this.db.prepare('ALTER TABLE temas ADD COLUMN meta_json TEXT').run() } catch (_) {}

    this.db.exec("CREATE TABLE IF NOT EXISTS actividad_temas (actividad_id INTEGER NOT NULL, tema_id INTEGER NOT NULL, PRIMARY KEY (actividad_id, tema_id), FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE, FOREIGN KEY (tema_id) REFERENCES temas(id) ON DELETE CASCADE)")

    // Evidencias del plan por actividad (semana) y los puntos crudos de cada estudiante.
    // La nota de la actividad se deriva de aquí y se guarda en `calificaciones` como siempre.
    this.db.exec("CREATE TABLE IF NOT EXISTS actividad_evidencias (id INTEGER PRIMARY KEY AUTOINCREMENT, actividad_id INTEGER NOT NULL, competencia TEXT NOT NULL, nombre TEXT NOT NULL, sesion TEXT DEFAULT '', instrumento TEXT DEFAULT '', puntos REAL NOT NULL, orden INTEGER DEFAULT 0, FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE)")
    this.db.exec("CREATE TABLE IF NOT EXISTS evidencia_puntos (evidencia_id INTEGER NOT NULL, estudiante_id INTEGER NOT NULL, puntos REAL NOT NULL, PRIMARY KEY (evidencia_id, estudiante_id), FOREIGN KEY (evidencia_id) REFERENCES actividad_evidencias(id) ON DELETE CASCADE, FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id))")
  }

  crearTablas() {
    this.db.exec("CREATE TABLE IF NOT EXISTS anios_escolares (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, fecha_inicio TEXT, fecha_fin TEXT, estado TEXT DEFAULT 'activo')");
    this.db.exec("CREATE TABLE IF NOT EXISTS periodos (id INTEGER PRIMARY KEY AUTOINCREMENT, anio_escolar_id INTEGER NOT NULL, nombre TEXT NOT NULL, numero_orden INTEGER NOT NULL, titulo TEXT DEFAULT '', fecha_inicio TEXT, fecha_fin TEXT, estado TEXT DEFAULT 'abierto', FOREIGN KEY (anio_escolar_id) REFERENCES anios_escolares(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS materias (id INTEGER PRIMARY KEY AUTOINCREMENT, anio_escolar_id INTEGER NOT NULL, nombre TEXT NOT NULL, color TEXT DEFAULT '#2563A8', orden INTEGER DEFAULT 0, estado TEXT DEFAULT 'activo', FOREIGN KEY (anio_escolar_id) REFERENCES anios_escolares(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS periodo_titulos (id INTEGER PRIMARY KEY AUTOINCREMENT, materia_id INTEGER NOT NULL, grado TEXT NOT NULL, numero_periodo INTEGER NOT NULL, titulo TEXT NOT NULL, UNIQUE(materia_id, grado, numero_periodo), FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE)");
    this.db.exec("CREATE TABLE IF NOT EXISTS cursos (id INTEGER PRIMARY KEY AUTOINCREMENT, anio_escolar_id INTEGER NOT NULL, nombre TEXT NOT NULL, grado TEXT DEFAULT '', seccion TEXT DEFAULT '', descripcion TEXT DEFAULT '', color TEXT DEFAULT '#2563A8', estado TEXT DEFAULT 'activo', FOREIGN KEY (anio_escolar_id) REFERENCES anios_escolares(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS horario_asignaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, anio_escolar_id INTEGER NOT NULL, materia_id INTEGER, curso_id INTEGER NOT NULL, dia_semana TEXT NOT NULL, bloque_id INTEGER NOT NULL, UNIQUE(anio_escolar_id, dia_semana, bloque_id), FOREIGN KEY (anio_escolar_id) REFERENCES anios_escolares(id), FOREIGN KEY (materia_id) REFERENCES materias(id), FOREIGN KEY (curso_id) REFERENCES cursos(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS estudiantes (id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL, codigo_unico TEXT DEFAULT '', numero_lista INTEGER DEFAULT 0, nombre_completo TEXT NOT NULL, estado TEXT DEFAULT 'activo', FOREIGN KEY (curso_id) REFERENCES cursos(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS temas (id INTEGER PRIMARY KEY AUTOINCREMENT, materia_id INTEGER, curso_id INTEGER NOT NULL, periodo_id INTEGER NOT NULL, orden INTEGER DEFAULT 0, titulo TEXT NOT NULL, contenido_texto TEXT DEFAULT '', estado TEXT DEFAULT 'pendiente', fecha_realizado TEXT, fecha_aplazado TEXT, meta_json TEXT, FOREIGN KEY (materia_id) REFERENCES materias(id), FOREIGN KEY (curso_id) REFERENCES cursos(id), FOREIGN KEY (periodo_id) REFERENCES periodos(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS asistencias (id INTEGER PRIMARY KEY AUTOINCREMENT, materia_id INTEGER, estudiante_id INTEGER NOT NULL, curso_id INTEGER NOT NULL, fecha TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'presente', UNIQUE(estudiante_id, fecha, materia_id), FOREIGN KEY (materia_id) REFERENCES materias(id), FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id), FOREIGN KEY (curso_id) REFERENCES cursos(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS actividades (id INTEGER PRIMARY KEY AUTOINCREMENT, materia_id INTEGER, curso_id INTEGER NOT NULL, periodo_id INTEGER NOT NULL, nombre TEXT NOT NULL, tipo TEXT DEFAULT 'tarea', competencia TEXT DEFAULT 'Comunicativa', fecha TEXT, peso REAL DEFAULT 1.0, descripcion TEXT DEFAULT '', FOREIGN KEY (materia_id) REFERENCES materias(id), FOREIGN KEY (curso_id) REFERENCES cursos(id), FOREIGN KEY (periodo_id) REFERENCES periodos(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS calificaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, actividad_id INTEGER NOT NULL, estudiante_id INTEGER NOT NULL, nota REAL, observacion TEXT DEFAULT '', UNIQUE(actividad_id, estudiante_id), FOREIGN KEY (actividad_id) REFERENCES actividades(id), FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS observaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, estudiante_id INTEGER NOT NULL, fecha TEXT NOT NULL, texto TEXT NOT NULL, tipo TEXT DEFAULT 'academico', FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)");
    this.db.exec("CREATE TABLE IF NOT EXISTS tema_archivos (id INTEGER PRIMARY KEY AUTOINCREMENT, tema_id INTEGER NOT NULL, nombre TEXT NOT NULL, ruta TEXT NOT NULL, tipo TEXT DEFAULT 'file', fecha TEXT, FOREIGN KEY (tema_id) REFERENCES temas(id))");
    this.db.exec("CREATE TABLE IF NOT EXISTS curso_nota_rapida (id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL, materia_id INTEGER, texto TEXT DEFAULT '', updated_at TEXT, UNIQUE(curso_id, materia_id), FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE)");
    this.db.exec("CREATE TABLE IF NOT EXISTS curso_anotaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL, materia_id INTEGER, fecha TEXT NOT NULL, texto TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE)");
    this.db.exec("CREATE TABLE IF NOT EXISTS participaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, estudiante_id INTEGER NOT NULL, curso_id INTEGER NOT NULL, materia_id INTEGER, periodo_id INTEGER NOT NULL, tema_id INTEGER, fecha TEXT NOT NULL, puntos INTEGER NOT NULL, motivo TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_participaciones_curso ON participaciones (curso_id, periodo_id, materia_id)");
  }

  seedDatos() {
    const count = this.db.prepare('SELECT COUNT(*) as n FROM anios_escolares').get();
    if (count.n > 0) return;
    const anio = this.db.prepare("INSERT INTO anios_escolares (nombre, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?)").run('2025-2026', '2025-08-01', '2026-07-31', 'activo');
    const aid = anio.lastInsertRowid;
    const ins = this.db.prepare("INSERT INTO periodos (anio_escolar_id, nombre, titulo, numero_orden, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?, ?)");
    ins.run(aid, 'P1', 'Primer Periodo',   1, '2025-08-01', '2025-10-31');
    ins.run(aid, 'P2', 'Segundo Periodo',  2, '2025-11-01', '2026-01-31');
    ins.run(aid, 'P3', 'Tercer Periodo',   3, '2026-02-01', '2026-04-30');
    ins.run(aid, 'P4', 'Cuarto Periodo',   4, '2026-05-01', '2026-07-31');
    const mat = this.db.prepare("INSERT INTO materias (anio_escolar_id, nombre, color, orden) VALUES (?, ?, ?, ?)").run(aid, 'Mi Materia', '#2563A8', 0);
    const cfg = this.db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)");
    cfg.run('actividades_peso',   '60');
    cfg.run('participacion_peso', '20');
    cfg.run('asistencia_peso',    '10');
    cfg.run('conducta_peso',      '10');
    cfg.run('minimo_aprobatorio', '70');
    cfg.run('semaforo_verde',     '80');
    cfg.run('semaforo_amarillo',  '60');
    cfg.run('modo_competencias',  'false');
    cfg.run('nombre_maestro',     'Prof. Nombre Apellido');
    cfg.run('centro_educativo',   '');
    cfg.run('materia_activa_id',  String(mat.lastInsertRowid));
  }

  getAnios() { return this.db.prepare("SELECT * FROM anios_escolares ORDER BY id DESC").all(); }
  getAnioActivo() { return this.db.prepare("SELECT * FROM anios_escolares WHERE estado='activo' ORDER BY id DESC LIMIT 1").get(); }
  createAnio(d) {
    const res = this.db.prepare("INSERT INTO anios_escolares (nombre,fecha_inicio,fecha_fin) VALUES (?,?,?)").run(d.nombre, d.fecha_inicio||null, d.fecha_fin||null);
    const aid = res.lastInsertRowid;
    const ins = this.db.prepare("INSERT INTO periodos (anio_escolar_id,nombre,titulo,numero_orden,fecha_inicio,fecha_fin) VALUES (?,?,?,?,?,?)");
    ins.run(aid,'P1','Primer Periodo',  1, null, null);
    ins.run(aid,'P2','Segundo Periodo', 2, null, null);
    ins.run(aid,'P3','Tercer Periodo',  3, null, null);
    ins.run(aid,'P4','Cuarto Periodo',  4, null, null);
    // Sin esto el año nuevo queda con 0 materias: el selector del header
    // y el botón "+" para agregar una se ocultan porque dependen de
    // materias.length > 0, y el maestro queda sin forma de salir de ahí.
    const mat = this.db.prepare("INSERT INTO materias (anio_escolar_id,nombre,color,orden) VALUES (?,?,?,?)").run(aid, 'Mi Materia', '#2563A8', 0);
    this.db.prepare("INSERT OR REPLACE INTO configuracion (clave,valor) VALUES ('materia_activa_id',?)").run(String(mat.lastInsertRowid));
    return res;
  }

  getPeriodos(anioId) { return this.db.prepare("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden").all(anioId); }
  updatePeriodo(id, d) { return this.db.prepare("UPDATE periodos SET nombre=?,titulo=?,fecha_inicio=?,fecha_fin=? WHERE id=?").run(d.nombre, d.titulo||'', d.fecha_inicio||null, d.fecha_fin||null, id); }

  getMaterias(anioId) { return this.db.prepare("SELECT * FROM materias WHERE anio_escolar_id=? AND estado='activo' ORDER BY orden,id").all(anioId); }
  createMateria(d) {
    const count = this.db.prepare("SELECT COUNT(*) as n FROM materias WHERE anio_escolar_id=? AND estado='activo'").get(d.anioId);
    if (count.n >= 3) throw new Error('Maximo 3 materias por año escolar');
    const orden = this.db.prepare("SELECT COALESCE(MAX(orden),0)+1 as o FROM materias WHERE anio_escolar_id=?").get(d.anioId).o;
    return this.db.prepare("INSERT INTO materias (anio_escolar_id,nombre,color,orden) VALUES (?,?,?,?)").run(d.anioId, d.nombre, d.color||'#2563A8', orden);
  }
  updateMateria(id, d) { return this.db.prepare("UPDATE materias SET nombre=?,color=? WHERE id=?").run(d.nombre, d.color||'#2563A8', id); }
  deleteMateria(id) { return this.db.prepare("UPDATE materias SET estado='archivado' WHERE id=?").run(id); }

  getPeriodoTitulos(materiaId) { return this.db.prepare("SELECT * FROM periodo_titulos WHERE materia_id=? ORDER BY grado, numero_periodo").all(materiaId); }
  setPeriodoTitulo(materiaId, grado, numeroPeriodo, titulo) {
    return this.db.prepare("INSERT INTO periodo_titulos (materia_id,grado,numero_periodo,titulo) VALUES (?,?,?,?) ON CONFLICT(materia_id,grado,numero_periodo) DO UPDATE SET titulo=excluded.titulo").run(materiaId, grado, numeroPeriodo, titulo);
  }
  getTituloParaGrado(materiaId, grado, numeroPeriodo, anioId) {
    const especifico = this.db.prepare("SELECT titulo FROM periodo_titulos WHERE materia_id=? AND grado=? AND numero_periodo=?").get(materiaId, grado, numeroPeriodo);
    if (especifico) return especifico.titulo;
    const generico = this.db.prepare("SELECT titulo FROM periodos WHERE anio_escolar_id=? AND numero_orden=?").get(anioId, numeroPeriodo);
    return generico?.titulo || 'Periodo ' + numeroPeriodo;
  }
  getGradosConTitulos(materiaId) { return this.db.prepare("SELECT DISTINCT grado FROM periodo_titulos WHERE materia_id=? ORDER BY grado").all(materiaId).map(r => r.grado); }
  deletePeriodoTitulo(materiaId, grado, numeroPeriodo) { return this.db.prepare("DELETE FROM periodo_titulos WHERE materia_id=? AND grado=? AND numero_periodo=?").run(materiaId, grado, numeroPeriodo); }

  getCursos(anioId) { return this.db.prepare("SELECT * FROM cursos WHERE anio_escolar_id=? AND estado='activo' ORDER BY grado,nombre").all(anioId); }
  createCurso(d) {
    if (!d.nombre || !d.nombre.trim()) throw new Error('El nombre del curso es obligatorio');
    return this.db.prepare("INSERT INTO cursos (anio_escolar_id,nombre,grado,seccion,descripcion,color) VALUES (?,?,?,?,?,?)").run(d.anioId, d.nombre, d.grado||'', d.seccion||'', d.descripcion||'', d.color||'#2563A8');
  }
  updateCurso(id, d) { return this.db.prepare("UPDATE cursos SET nombre=?,grado=?,seccion=?,descripcion=?,color=? WHERE id=?").run(d.nombre, d.grado||'', d.seccion||'', d.descripcion||'', d.color||'#2563A8', id); }
  deleteCurso(id) { return this.db.prepare("UPDATE cursos SET estado='archivado' WHERE id=?").run(id); }

  getHorario(anioId) { return this.db.prepare("SELECT h.*,c.nombre as curso_nombre,c.color as curso_color,m.nombre as materia_nombre,m.color as materia_color FROM horario_asignaciones h JOIN cursos c ON h.curso_id=c.id LEFT JOIN materias m ON h.materia_id=m.id WHERE h.anio_escolar_id=?").all(anioId); }
  getHorarioMateria(anioId, materiaId) { return this.db.prepare("SELECT h.*,c.nombre as curso_nombre,c.color as curso_color FROM horario_asignaciones h JOIN cursos c ON h.curso_id=c.id WHERE h.anio_escolar_id=? AND h.materia_id=?").all(anioId, materiaId); }
  setHorarioCelda(d) { return this.db.prepare("INSERT OR REPLACE INTO horario_asignaciones (anio_escolar_id,materia_id,curso_id,dia_semana,bloque_id) VALUES (?,?,?,?,?)").run(d.anioId, d.materiaId||null, d.cursoId, d.dia, d.bloqueId); }
  deleteHorarioCelda(d) { return this.db.prepare("DELETE FROM horario_asignaciones WHERE anio_escolar_id=? AND dia_semana=? AND bloque_id=?").run(d.anioId, d.dia, d.bloqueId); }
  getDiasCurso(cursoId, materiaId) {
    if (materiaId) return this.db.prepare("SELECT DISTINCT dia_semana FROM horario_asignaciones WHERE curso_id=? AND materia_id=?").all(cursoId, materiaId).map(r => r.dia_semana);
    return this.db.prepare("SELECT DISTINCT dia_semana FROM horario_asignaciones WHERE curso_id=?").all(cursoId).map(r => r.dia_semana);
  }

  getTemas(cursoId, periodoId, materiaId) {
    if (materiaId) return this.db.prepare("SELECT * FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY orden,id").all(cursoId, periodoId, materiaId);
    return this.db.prepare("SELECT * FROM temas WHERE curso_id=? AND periodo_id=? ORDER BY orden,id").all(cursoId, periodoId);
  }
  createTema(d) {
    const max  = this.db.prepare("SELECT COALESCE(MAX(orden),0) as m FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ?").get(d.cursoId, d.periodoId, d.materiaId||null);
    const meta = d.metaJson ? JSON.stringify(d.metaJson) : null;
    return this.db.prepare("INSERT INTO temas (materia_id,curso_id,periodo_id,orden,titulo,estado,meta_json) VALUES (?,?,?,?,?,'pendiente',?)").run(d.materiaId||null, d.cursoId, d.periodoId, max.m+1, d.titulo, meta);
  }
  updateTema(id, d) {
    if (d.metaJson !== undefined) {
      return this.db.prepare("UPDATE temas SET titulo=?,estado=?,contenido_texto=?,fecha_realizado=?,fecha_aplazado=?,meta_json=? WHERE id=?")
        .run(d.titulo, d.estado, d.contenido_texto||null, d.fecha_realizado||null, d.fecha_aplazado||null, JSON.stringify(d.metaJson), id);
    }
    return this.db.prepare("UPDATE temas SET titulo=?,estado=?,contenido_texto=?,fecha_realizado=?,fecha_aplazado=? WHERE id=?")
      .run(d.titulo, d.estado, d.contenido_texto||null, d.fecha_realizado||null, d.fecha_aplazado||null, id);
  }
  deleteTema(id) {
    this.db.prepare("DELETE FROM tema_archivos WHERE tema_id=?").run(id);
    this.db.prepare("DELETE FROM actividad_temas WHERE tema_id=?").run(id);
    return this.db.prepare("DELETE FROM temas WHERE id=?").run(id);
  }
  reordenarTemas(temaIds) {
    const upd = this.db.prepare("UPDATE temas SET orden=? WHERE id=?");
    const trx = this.db.transaction(() => { temaIds.forEach((id, i) => upd.run(i, id)); });
    trx();
    return { ok: true };
  }
  clonarTemas(srcCursoId, srcPeriodoId, dstCursoId, dstPeriodoId, materiaId) {
    const q = materiaId ? this.db.prepare("SELECT * FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY orden,id") : this.db.prepare("SELECT * FROM temas WHERE curso_id=? AND periodo_id=? ORDER BY orden,id");
    const temas = materiaId ? q.all(srcCursoId, srcPeriodoId, materiaId) : q.all(srcCursoId, srcPeriodoId);
    const ins2 = this.db.prepare("INSERT INTO temas (materia_id,curso_id,periodo_id,orden,titulo,estado,contenido_texto,meta_json) VALUES (?,?,?,?,?,'pendiente',?,?)");
    let copiados = 0;
    for (const t of temas) {
      const existe = this.db.prepare("SELECT id FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ? AND titulo=?").get(dstCursoId, dstPeriodoId, materiaId||null, t.titulo);
      if (!existe) { ins2.run(materiaId||null, dstCursoId, dstPeriodoId, t.orden, t.titulo, t.contenido_texto||null, t.meta_json||null); copiados++; }
    }
    return { total: temas.length, copiados };
  }
  getArchivosTema(temaId) { return this.db.prepare("SELECT * FROM tema_archivos WHERE tema_id=? ORDER BY id").all(temaId); }
  addArchivoTema(temaId, nombre, ruta, fecha) { return this.db.prepare("INSERT INTO tema_archivos (tema_id,nombre,ruta,fecha) VALUES (?,?,?,?)").run(temaId, nombre, ruta, fecha); }
  deleteArchivoTema(id) {
    const a = this.db.prepare("SELECT ruta FROM tema_archivos WHERE id=?").get(id);
    this.db.prepare("DELETE FROM tema_archivos WHERE id=?").run(id);
    return a ? a.ruta : null;
  }
  importTemarioJson({ jsonData, cursoId, materiaId, anioId }) {
    const periodos = this.db.prepare('SELECT * FROM periodos WHERE anio_escolar_id = ? ORDER BY numero_orden').all(anioId);
    const maxOrden = this.db.prepare('SELECT COALESCE(MAX(orden), 0) AS mx FROM temas WHERE curso_id = ? AND materia_id IS ?').get(cursoId, materiaId || null)?.mx || 0;
    const insertTema = this.db.prepare('INSERT INTO temas (materia_id, curso_id, periodo_id, titulo, estado, orden, contenido_texto, meta_json) VALUES (?, ?, ?, ?, ?, ?, \'\', ?)');
    const existeTema = this.db.prepare('SELECT id FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ? AND titulo=?');
    let count = 0, omitidos = 0;
    const periodosNoEncontrados = [];
    let ordenBase = maxOrden;
    const batch = this.db.transaction(() => {
      (jsonData.periodos || []).forEach(p => {
        const periodo = periodos.find(dbP => dbP.numero_orden === p.numero || dbP.nombre === p.nombre);
        if (!periodo) { periodosNoEncontrados.push(p.numero ?? p.nombre ?? '?'); return; }
        (p.temas || []).forEach(t => {
          const titulo = t.titulo || 'Sin titulo';
          if (existeTema.get(cursoId, periodo.id, materiaId || null, titulo)) { omitidos++; return; }
          ordenBase += 1;
          const meta = { subtitulo:t.subtitulo||null, semana:t.semana||null, fase:t.fase||null, competencia:t.competencia||null, indicadores:t.indicadores||null, peso:t.peso||null, instrumento:t.instrumento||null, actividades:t.actividades||null, texto_biblico:t.texto_biblico||null, metacognicion:t.metacognicion||null, recursos:t.recursos||null };
          Object.keys(meta).forEach(k => { if (meta[k] === null) delete meta[k]; });
          insertTema.run(materiaId || null, cursoId, periodo.id, titulo, t.estado || 'pendiente', ordenBase, Object.keys(meta).length > 0 ? JSON.stringify(meta) : null);
          count++;
        });
      });
    });
    batch();
    return { count, omitidos, periodosNoEncontrados };
  }
  // Importar clases desde Portal-Ars: mismo destino (temas) que
  // importTemarioJson, pero el archivo/descarga de Portal-Ars viene
  // como un array plano de semanas (no agrupado por periodo), y trae
  // "contenido"/"texto_ampliado" además de los campos de "detalle"
  // (rubrica, materiales, actividades_cuaderno, etc.) que el import de
  // Temario JSON de más arriba no conocía -- se guarda todo en
  // meta_json para no perder nada de lo que ya tiene Portal-Ars.
  importClasesPortalArs(filasPlanas, { cursoId, materiaId, anioId }) {
    const periodos = this.db.prepare('SELECT * FROM periodos WHERE anio_escolar_id = ? ORDER BY numero_orden').all(anioId);
    const maxOrden = this.db.prepare('SELECT COALESCE(MAX(orden), 0) AS mx FROM temas WHERE curso_id = ? AND materia_id IS ?').get(cursoId, materiaId || null)?.mx || 0;
    const insertTema = this.db.prepare('INSERT INTO temas (materia_id, curso_id, periodo_id, titulo, estado, orden, contenido_texto, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const existeTema = this.db.prepare('SELECT id FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ? AND titulo=?');
    let count = 0, omitidos = 0;
    const periodosNoEncontrados = [];
    let ordenBase = maxOrden;
    const batch = this.db.transaction(() => {
      (filasPlanas || []).forEach(it => {
        const periodo = periodos.find(dbP => dbP.numero_orden === Number(it.periodo));
        if (!periodo) { if (!periodosNoEncontrados.includes(it.periodo)) periodosNoEncontrados.push(it.periodo ?? '?'); return; }
        const titulo = it.titulo || 'Sin titulo';
        if (existeTema.get(cursoId, periodo.id, materiaId || null, titulo)) { omitidos++; return; }
        ordenBase += 1;
        insertTema.run(materiaId || null, cursoId, periodo.id, titulo, 'pendiente', ordenBase, it.contenido || '', metaTemaPortalArs(it));
        count++;
      });
    });
    batch();
    return { count, omitidos, periodosNoEncontrados };
  }

  getEstudiantes(cursoId) { return this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista,nombre_completo").all(cursoId); }
  // El número de lista empareja al estudiante en el padrón y en Portal-Ars: no puede repetirse
  // entre activos del mismo curso. 0 = sin número, no se valida.
  numeroListaOcupado(cursoId, numero, excluirId) {
    const n = Number(numero) || 0;
    if (n <= 0) return null;
    return this.db.prepare("SELECT id, nombre_completo FROM estudiantes WHERE curso_id=? AND numero_lista=? AND estado='activo' AND id<>?").get(cursoId, n, excluirId || 0) || null;
  }
  createEstudiante(d) {
    const ocupado = this.numeroListaOcupado(d.cursoId, d.numero, 0);
    if (ocupado) return { error: `El número ${d.numero} ya lo tiene ${ocupado.nombre_completo}` };
    return this.db.prepare("INSERT INTO estudiantes (curso_id,codigo_unico,numero_lista,nombre_completo) VALUES (?,?,?,?)").run(d.cursoId, d.codigo||'', d.numero||0, d.nombre);
  }
  updateEstudiante(id, d) {
    const estado = d.estado || 'activo';
    if (estado === 'activo') {
      const est = this.db.prepare("SELECT curso_id FROM estudiantes WHERE id=?").get(id);
      const ocupado = est && this.numeroListaOcupado(est.curso_id, d.numero, id);
      if (ocupado) return { error: `El número ${d.numero} ya lo tiene ${ocupado.nombre_completo}` };
    }
    return this.db.prepare("UPDATE estudiantes SET nombre_completo=?,codigo_unico=?,numero_lista=?,estado=? WHERE id=?").run(d.nombre, d.codigo||'', d.numero||0, estado, id);
  }
  // Grupos de trabajo del cuaderno (fijos todo el año). NULL = sin grupo.
  // Solo afecta cómo se filtra la vista de notas; no toca calificaciones.
  setGrupoEstudiante(estudianteId, grupo) {
    const g = (grupo === null || grupo === '' || grupo === undefined) ? null : Number(grupo);
    if (g !== null && (!Number.isInteger(g) || g < 1)) return { error: 'Grupo inválido' };
    const r = this.db.prepare("UPDATE estudiantes SET grupo_trabajo=? WHERE id=?").run(g, estudianteId);
    return { cambiados: r.changes };
  }

  // items: [{ grupo, numeros: [numero_lista, ...] }]. Los números se ubican por
  // numero_lista entre los estudiantes activos del curso.
  // reemplazar=false: solo agrega/mueve los listados, los demás quedan como están.
  // reemplazar=true: además saca de grupo a los activos que no aparezcan.
  asignarGrupos(cursoId, items, reemplazar) {
    const vistos = new Map();
    for (const it of items || []) {
      const g = Number(it && it.grupo);
      if (!Number.isInteger(g) || g < 1) return { error: 'Grupo inválido: ' + (it && it.grupo) };
      for (const n of it.numeros || []) {
        const num = Number(n);
        if (!Number.isInteger(num) || num < 1) return { error: 'Número de lista inválido: ' + n };
        if (vistos.has(num) && vistos.get(num) !== g) {
          return { error: `El número ${num} aparece en el grupo ${vistos.get(num)} y en el grupo ${g}` };
        }
        vistos.set(num, g);
      }
    }
    const activos = this.getEstudiantes(cursoId);
    const porNumero = new Map();
    for (const e of activos) if (!porNumero.has(e.numero_lista)) porNumero.set(e.numero_lista, e);
    const noEncontrados = [...vistos.keys()].filter(n => !porNumero.has(n));
    const upd = this.db.prepare("UPDATE estudiantes SET grupo_trabajo=? WHERE id=? AND curso_id=?");
    let asignados = 0, sacados = 0;
    this.db.transaction(() => {
      const tocados = new Set();
      for (const [num, g] of vistos) {
        const e = porNumero.get(num);
        if (!e) continue;
        upd.run(g, e.id, cursoId);
        tocados.add(e.id);
        asignados++;
      }
      if (reemplazar) {
        for (const e of activos) {
          if (!tocados.has(e.id) && e.grupo_trabajo !== null) { upd.run(null, e.id, cursoId); sacados++; }
        }
      }
    })();
    return { asignados, sacados, noEncontrados };
  }

  quitarGruposCurso(cursoId) {
    const r = this.db.prepare("UPDATE estudiantes SET grupo_trabajo=NULL WHERE curso_id=? AND grupo_trabajo IS NOT NULL").run(cursoId);
    return { sacados: r.changes };
  }

  importarEstudiantes(cursoId, lista) {
    const ins = this.db.prepare("INSERT INTO estudiantes (curso_id,codigo_unico,numero_lista,nombre_completo) VALUES (?,?,?,?)");
    let insertados = 0, omitidos = 0;
    for (const est of lista) {
      const nombre = (est.nombre||'').trim();
      if (!nombre) continue;
      const existe = this.db.prepare("SELECT id FROM estudiantes WHERE curso_id=? AND nombre_completo=? AND estado='activo'").get(cursoId, nombre);
      if (existe) { omitidos++; continue; }
      ins.run(cursoId, est.codigo||'', est.numero||0, nombre);
      insertados++;
    }
    return { insertados, omitidos };
  }

  // ── Importar padrón completo (varios cursos a la vez) ──────────
  // Pensado para un archivo compartido con otro sistema (mismo grado/
  // sección/número de orden que usa Portal-Ars) — agrupa las filas por
  // grado+sección y las empareja contra los cursos activos del año.
  // No inserta nada acá: solo arma la vista previa para que el maestro
  // confirme, igual que el resto de los imports del proyecto.
  previewImportPadron(anioEscolarId, filas) {
    const cursosActivos = this.db.prepare("SELECT id,nombre,grado,seccion FROM cursos WHERE anio_escolar_id=? AND estado='activo'").all(anioEscolarId);
    const grupos = new Map();
    for (const f of filas) {
      const key = f.grado + '||' + f.seccion;
      if (!grupos.has(key)) grupos.set(key, { grado: f.grado, seccion: f.seccion, estudiantes: [] });
      grupos.get(key).estudiantes.push({ numero: f.numero, nombre: f.nombre });
    }
    return Array.from(grupos.values()).map(g => {
      const curso = cursosActivos.find(c => c.grado === g.grado && c.seccion === g.seccion);
      g.estudiantes.sort((a, b) => a.numero - b.numero);
      return { grado: g.grado, seccion: g.seccion, cursoId: curso ? curso.id : null, cursoNombre: curso ? curso.nombre : null, estudiantes: g.estudiantes };
    }).sort((a, b) => a.grado.localeCompare(b.grado) || a.seccion.localeCompare(b.seccion));
  }

  // Confirma la importación de padrón ya revisada. Por cada grupo sin
  // curso existente, solo crea uno nuevo si el maestro marcó "crear"
  // explícitamente (grupos sin marcar se omiten, no se pierden --
  // el maestro puede volver a intentar con un archivo corregido).
  // Emparejamiento estudiante-a-estudiante por numero_lista dentro del
  // curso (no por nombre): actualiza el nombre si cambió, no duplica.
  confirmarImportPadron(anioEscolarId, grupos) {
    let cursosCreados = 0, insertados = 0, actualizados = 0, sinCambios = 0;
    const errores = [];
    for (const g of grupos) {
      let cursoId = g.cursoId;
      if (!cursoId) {
        if (!g.crear) continue;
        const nombre = `${g.grado} ${g.seccion}`;
        const dup = this.db.prepare("SELECT id FROM cursos WHERE anio_escolar_id=? AND nombre=? AND estado='activo'").get(anioEscolarId, nombre);
        if (dup) { errores.push(`Ya existe un curso activo llamado "${nombre}" -- no se creó de nuevo, revisalo a mano.`); continue; }
        try {
          const r = this.createCurso({ anioId: anioEscolarId, nombre, grado: g.grado, seccion: g.seccion });
          cursoId = r.lastInsertRowid;
          cursosCreados++;
        } catch (e) { errores.push(`${g.grado} ${g.seccion}: ${e.message}`); continue; }
      }
      for (const est of g.estudiantes) {
        const nombre = (est.nombre || '').trim();
        if (!nombre) continue;
        const existente = this.db.prepare("SELECT id,nombre_completo FROM estudiantes WHERE curso_id=? AND numero_lista=? AND estado='activo'").get(cursoId, est.numero || 0);
        if (existente) {
          if (existente.nombre_completo === nombre) {
            sinCambios++;
          } else if (padronPortal.parecido(existente.nombre_completo, nombre) >= 0.75) {
            // Mismo estudiante, nombre escrito distinto: se corrige.
            this.db.prepare("UPDATE estudiantes SET nombre_completo=? WHERE id=?").run(nombre, existente.id);
            actualizados++;
          } else {
            // Otra persona en ese número (la lista se corrió): NO se
            // renombra, porque sus notas pasarían a otro estudiante.
            errores.push(`${g.grado} ${g.seccion} N.º ${est.numero}: en el archivo es «${nombre}» pero acá es «${existente.nombre_completo}». No se tocó: usá «Novedades de Portal-Ars» para reacomodar la lista.`);
          }
        } else {
          this.db.prepare("INSERT INTO estudiantes (curso_id,codigo_unico,numero_lista,nombre_completo) VALUES (?,?,?,?)").run(cursoId, '', est.numero || 0, nombre);
          insertados++;
        }
      }
    }
    return { cursosCreados, insertados, actualizados, sinCambios, errores };
  }

  // ── Novedades de Portal-Ars (sugerencias elegidas por el maestro) ──
  // Ver electron/padronPortal.js. Todo en una transacción: si al final
  // quedan dos estudiantes activos con el mismo N.º en un curso, no se
  // aplica nada.
  getEstudiantesActivosAnio(anioEscolarId) {
    return this.db.prepare(`SELECT e.id, e.curso_id, e.numero_lista, e.nombre_completo FROM estudiantes e
      JOIN cursos c ON c.id=e.curso_id WHERE c.anio_escolar_id=? AND c.estado='activo' AND e.estado='activo'`).all(anioEscolarId);
  }

  aplicarNovedadesPortal(acciones) {
    const ins = this.db.prepare("INSERT INTO estudiantes (curso_id,codigo_unico,numero_lista,nombre_completo) VALUES (?,?,?,?)");
    const setNum = this.db.prepare("UPDATE estudiantes SET numero_lista=? WHERE id=?");
    const retirar = this.db.prepare("UPDATE estudiantes SET estado='retirado' WHERE id=?");
    const cuenta = { agregados: 0, renumerados: 0, movidos: 0, retirados: 0 };
    const cursosTocados = new Set();
    try {
      this.db.transaction(() => {
        // 1) Renumerar en dos pasos (temporal alto) para que los
        //    intercambios #27 <-> #28 no choquen a mitad de camino.
        const renum = acciones.filter(a => a.tipo === 'numero');
        for (const a of renum) setNum.run(100000 + a.numero, a.localId);
        for (const a of renum) { setNum.run(a.numero, a.localId); cuenta.renumerados++; cursosTocados.add(a.cursoId); }
        // 2) Retirar (salió / no está / el lugar viejo de quien se mueve)
        for (const a of acciones) {
          if (a.tipo === 'salio' || a.tipo === 'no_esta' || a.tipo === 'mover') {
            retirar.run(a.localId);
            if (a.tipo !== 'mover') cuenta.retirados++;
          }
        }
        // 3) Altas: nuevos y el lugar nuevo de quien se mueve (sus notas
        //    viejas quedan en el curso anterior, como retirado).
        for (const a of acciones) {
          if (a.tipo === 'agregar' || a.tipo === 'mover') {
            ins.run(a.cursoId, '', a.numero, a.nombre);
            cursosTocados.add(a.cursoId);
            if (a.tipo === 'agregar') cuenta.agregados++; else cuenta.movidos++;
          }
        }
        // 4) Ningún N.º repetido entre los activos de los cursos tocados
        const dup = this.db.prepare(`SELECT c.nombre AS curso, e.numero_lista AS numero, GROUP_CONCAT(e.nombre_completo, ' / ') AS nombres
          FROM estudiantes e JOIN cursos c ON c.id=e.curso_id
          WHERE e.estado='activo' AND e.curso_id IN (${[...cursosTocados].map(() => '?').join(',') || 'NULL'})
          GROUP BY e.curso_id, e.numero_lista HAVING COUNT(*) > 1`).all(...cursosTocados);
        if (dup.length) {
          const err = new Error('numeros_repetidos');
          err.detalle = dup.map(d => `${d.curso} N.º ${d.numero}: ${d.nombres}`);
          throw err;
        }
      })();
    } catch (e) {
      if (e.message === 'numeros_repetidos') return { error: 'Quedarían números de lista repetidos. No se aplicó nada.', detalle: e.detalle };
      return { error: e.message };
    }
    return { ok: true, ...cuenta };
  }

  getEstudiantesTodos(cursoId) {
  return this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? ORDER BY numero_lista, nombre_completo").all(cursoId)
}
 
deleteEstudiante(id) {
  // Elimina calificaciones, asistencias y observaciones del estudiante
  this.db.prepare("DELETE FROM calificaciones WHERE estudiante_id=?").run(id)
  this.db.prepare("DELETE FROM asistencias WHERE estudiante_id=?").run(id)
  this.db.prepare("DELETE FROM observaciones WHERE estudiante_id=?").run(id)
  return this.db.prepare("DELETE FROM estudiantes WHERE id=?").run(id)
}

  getAsistenciaDia(cursoId, fecha, materiaId) {
    const estudiantes = this.getEstudiantes(cursoId);
    const asistencias = materiaId
      ? this.db.prepare("SELECT * FROM asistencias WHERE curso_id=? AND fecha=? AND materia_id=?").all(cursoId, fecha, materiaId)
      : this.db.prepare("SELECT * FROM asistencias WHERE curso_id=? AND fecha=?").all(cursoId, fecha);
    const mapa = {};
    asistencias.forEach(a => { mapa[a.estudiante_id] = a.estado; });
    return estudiantes.map(e => ({ ...e, asistencia: mapa[e.id] || 'presente' }));
  }
  setAsistencia(d) { return this.db.prepare("INSERT OR REPLACE INTO asistencias (materia_id,estudiante_id,curso_id,fecha,estado) VALUES (?,?,?,?,?)").run(d.materiaId||null, d.estudianteId, d.cursoId, d.fecha, d.estado); }
  getAsistenciaMes(cursoId, anio, mes, materiaId) {
    const m = String(mes).padStart(2,'0');
    const estudiantes = this.getEstudiantes(cursoId);
    const asistencias = materiaId
      ? this.db.prepare("SELECT * FROM asistencias WHERE curso_id=? AND fecha LIKE ? AND materia_id=?").all(cursoId, anio+'-'+m+'-%', materiaId)
      : this.db.prepare("SELECT * FROM asistencias WHERE curso_id=? AND fecha LIKE ?").all(cursoId, anio+'-'+m+'-%');
    return { estudiantes, asistencias };
  }

  getActividades(cursoId, periodoId, materiaId) {
    const cols = "*, (SELECT COUNT(*) FROM actividad_evidencias ev WHERE ev.actividad_id=actividades.id) AS n_evidencias";
    if (materiaId) return this.db.prepare(`SELECT ${cols} FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY fecha DESC,id DESC`).all(cursoId, periodoId, materiaId);
    return this.db.prepare(`SELECT ${cols} FROM actividades WHERE curso_id=? AND periodo_id=? ORDER BY fecha DESC,id DESC`).all(cursoId, periodoId);
  }
  createActividad(d) {
    const modo = d.modo || 'simple';
    const compsMulti = (modo === 'multi' && d.competencias_multi) ? JSON.stringify(d.competencias_multi) : null;
    const r = this.db.prepare("INSERT INTO actividades (materia_id,curso_id,periodo_id,nombre,tipo,competencia,fecha,peso,descripcion,modo,competencias_multi) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(d.materiaId||null, d.cursoId, d.periodoId, d.nombre, d.tipo||'tarea', d.competencia||'Comunicativa', d.fecha||null, d.peso||1, d.descripcion||'', modo, compsMulti);
    if (Array.isArray(d.temaIds)) this.setActividadTemas(r.lastInsertRowid, d.temaIds);
    return r;
  }
  updateActividad(id, d) {
    const modo      = d.modo || 'simple';
    const compsNew  = (modo === 'multi' && Array.isArray(d.competencias_multi)) ? d.competencias_multi : [];
    const compsJson = compsNew.length > 0 ? JSON.stringify(compsNew) : null;

    // Si es multi y cambiaron las competencias, redistribuir todas las calificaciones.
    if (modo === 'multi' && compsNew.length > 0) {
      const act     = this.db.prepare("SELECT competencias_multi FROM actividades WHERE id=?").get(id);
      const compsOld = act?.competencias_multi ? JSON.parse(act.competencias_multi) : [];
      const changed  = [...compsOld].sort().join(',') !== [...compsNew].sort().join(',');

      if (changed) {
        const califs  = this.db.prepare("SELECT id FROM calificaciones WHERE actividad_id=? AND nota IS NOT NULL").all(id);
        const newDist = defaultDist(compsNew);
        const newNota = notaFromDist(newDist);
        const stmtUpd = this.db.prepare("UPDATE calificaciones SET nota=?, distribucion_multi=? WHERE id=?");
        const doUpdate = this.db.transaction(() => {
          for (const c of califs) stmtUpd.run(newNota, JSON.stringify(newDist), c.id);
        });
        doUpdate();
      }
    }

    const r = this.db.prepare(
      "UPDATE actividades SET nombre=?,tipo=?,competencia=?,fecha=?,peso=?,modo=?,competencias_multi=? WHERE id=?"
    ).run(d.nombre, d.tipo||'tarea', d.competencia||'Comunicativa', d.fecha||null, d.peso||1, modo, compsJson, id);
    if (Array.isArray(d.temaIds)) this.setActividadTemas(id, d.temaIds);
    return r;
  }

  // Temas que evalúa una actividad. Solo se aceptan temas del mismo curso/período/materia.
  getActividadTemas(actividadId) {
    return this.db.prepare("SELECT tema_id FROM actividad_temas WHERE actividad_id=?").all(actividadId).map(r => r.tema_id);
  }
  setActividadTemas(actividadId, temaIds) {
    const act = this.db.prepare("SELECT curso_id, periodo_id, materia_id FROM actividades WHERE id=?").get(actividadId);
    if (!act) return { error: 'Actividad no existe' };
    const ids = [...new Set((temaIds || []).map(Number))].filter(n => Number.isInteger(n) && n > 0);
    const valido = this.db.prepare("SELECT 1 FROM temas WHERE id=? AND curso_id=? AND periodo_id=? AND materia_id IS ?");
    const ins = this.db.prepare("INSERT OR IGNORE INTO actividad_temas (actividad_id, tema_id) VALUES (?,?)");
    let vinculados = 0;
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM actividad_temas WHERE actividad_id=?").run(actividadId);
      for (const t of ids) {
        if (!valido.get(t, act.curso_id, act.periodo_id, act.materia_id)) continue;
        ins.run(actividadId, t);
        vinculados++;
      }
    })();
    return { vinculados };
  }

  // Participación vista desde una actividad: suma de los temas vinculados + total del período.
  // Nunca toca calificaciones. Sin temas vinculados → vinculada:false y solo el total del período.
  getParticipacionActividad(actividadId) {
    const act = this.db.prepare("SELECT curso_id, periodo_id, materia_id FROM actividades WHERE id=?").get(actividadId);
    if (!act) return { vinculada: false, temas: [], porEstudiante: {} };
    const temas = this.db.prepare("SELECT t.id, t.titulo FROM actividad_temas at JOIN temas t ON t.id=at.tema_id WHERE at.actividad_id=? ORDER BY t.orden, t.id").all(actividadId);
    const rows = this.db.prepare(`SELECT p.estudiante_id, SUM(p.puntos) AS periodo,
        SUM(CASE WHEN p.tema_id IN (SELECT tema_id FROM actividad_temas WHERE actividad_id=?) THEN p.puntos ELSE 0 END) AS actividad
      FROM participaciones p WHERE p.curso_id=? AND p.periodo_id=? AND p.materia_id IS ? GROUP BY p.estudiante_id`)
      .all(actividadId, act.curso_id, act.periodo_id, act.materia_id);
    const porEstudiante = {};
    for (const r of rows) porEstudiante[r.estudiante_id] = { actividad: r.actividad, periodo: r.periodo };
    return { vinculada: temas.length > 0, temas, porEstudiante };
  }

  deleteActividad(id) {
    this.db.prepare("DELETE FROM evidencia_puntos WHERE evidencia_id IN (SELECT id FROM actividad_evidencias WHERE actividad_id=?)").run(id);
    this.db.prepare("DELETE FROM actividad_evidencias WHERE actividad_id=?").run(id);
    this.db.prepare("DELETE FROM actividad_temas WHERE actividad_id=?").run(id);
    this.db.prepare("DELETE FROM calificaciones WHERE actividad_id=?").run(id);
    return this.db.prepare("DELETE FROM actividades WHERE id=?").run(id);
  }
  duplicarActividades(sourceCursoId, sourcePeriodoId, targetCursoId, targetPeriodoId, materiaId) {
    const acts = materiaId
      ? this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=?").all(sourceCursoId, sourcePeriodoId, materiaId)
      : this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=?").all(sourceCursoId, sourcePeriodoId);
    const ins = this.db.prepare("INSERT INTO actividades (materia_id,curso_id,periodo_id,nombre,tipo,competencia,fecha,peso,descripcion,modo,competencias_multi) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    let copiadas = 0;
    for (const a of acts) {
      const existe = this.db.prepare("SELECT id FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id IS ? AND nombre=?").get(targetCursoId, targetPeriodoId, materiaId||null, a.nombre);
      if (!existe) {
        const r = ins.run(materiaId||null, targetCursoId, targetPeriodoId, a.nombre, a.tipo, a.competencia, a.fecha, a.peso, a.descripcion||'', a.modo||'simple', a.competencias_multi||null);
        this._copiarEvidencias(a.id, r.lastInsertRowid);
        copiadas++;
      }
    }
    return { total: acts.length, copiadas };
  }

  getCalificaciones(actividadId) { return this.db.prepare("SELECT c.*,e.nombre_completo,e.numero_lista FROM calificaciones c JOIN estudiantes e ON c.estudiante_id=e.id WHERE c.actividad_id=? ORDER BY e.numero_lista").all(actividadId); }
  setCalificacion(d) { return this.db.prepare("INSERT OR REPLACE INTO calificaciones (actividad_id,estudiante_id,nota,observacion) VALUES (?,?,?,?)").run(d.actividadId, d.estudianteId, d.nota, d.observacion||null); }

  // ── MODO MULTI-COMPETENCIA ───────────────────────────────────────────────
  // data = { actividad_id, estudiante_id, distribucion }
  // nota_global se calcula como suma de la distribución.
  setCalificacionMulti(data) {
    const { actividad_id, estudiante_id, distribucion } = data;
    const act   = this.db.prepare("SELECT competencias_multi FROM actividades WHERE id=?").get(actividad_id);
    const comps = act?.competencias_multi ? JSON.parse(act.competencias_multi) : [];
    const nc    = comps.length;
    if (nc === 0) throw new Error('Actividad sin competencias_multi');
    const techo = 100 / nc;
    for (const [comp, val] of Object.entries(distribucion)) {
      if (val > techo + 0.01) throw new Error(`${comp}: ${val.toFixed(1)} supera el techo de ${techo.toFixed(1)}`);
    }
    const nota = notaFromDist(distribucion);
    return this.db.prepare(
      "INSERT OR REPLACE INTO calificaciones (actividad_id,estudiante_id,nota,observacion,distribucion_multi) VALUES (?,?,?,'',?)"
    ).run(actividad_id, estudiante_id, nota, JSON.stringify(distribucion));
  }

  getDistribucionMulti(actividadId, estudianteId) {
    const row = this.db.prepare("SELECT distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?").get(actividadId, estudianteId);
    return row?.distribucion_multi ? JSON.parse(row.distribucion_multi) : null;
  }

  // ── REGISTRO POR EVIDENCIAS ──────────────────────────────────────────────
  // Vista previa de "Crear actividades desde el plan". Sin `json`, busca la evaluación
  // guardada en los temas del período (importados de Portal-Ars con plan_periodo).
  // filasWeb: semanas del web.json (si se tiene) para crear en el Temario los temas que falten.
  prepararPlanEvaluacion(json, cursoId, periodoId, materiaId, filasWeb = null) {
    const curso   = this.db.prepare("SELECT id, nombre, grado FROM cursos WHERE id=?").get(cursoId);
    const periodo = this.db.prepare("SELECT id, nombre, numero_orden FROM periodos WHERE id=?").get(periodoId);
    if (!curso || !periodo) return { error: 'Curso o período no encontrado.' };

    const temas = this.db.prepare("SELECT id, titulo, meta_json FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ? ORDER BY orden, id")
      .all(cursoId, periodoId, materiaId || null)
      .map(t => { let meta = {}; try { meta = t.meta_json ? JSON.parse(t.meta_json) : {}; } catch (_) {} return { id: t.id, titulo: t.titulo, meta }; });

    let origen = 'archivo';
    if (json == null) {
      const conPlan = temas.find(t => t.meta.plan_periodo && t.meta.plan_periodo.evaluacion);
      if (!conPlan) return { sinPlanGuardado: true };
      json = { ...conPlan.meta.plan_periodo, semanas: temas.filter(t => t.meta.semana != null).map(t => ({ semana: t.meta.semana, titulo: t.titulo })) };
      origen = 'temario';
    }

    const plan = leerPlanEvaluacion(json);
    if (plan.error) return plan;

    const avisos = [...plan.avisos];
    const num = s => { const m = /\d+/.exec(String(s || '')); return m ? Number(m[0]) : null; };
    if (plan.grado && curso.grado && num(plan.grado) !== num(curso.grado)) avisos.push(`El plan es de ${plan.grado} y el curso es ${curso.grado}.`);
    if (plan.periodo && plan.periodo !== periodo.numero_orden) avisos.push(`El plan es del período ${plan.periodo} y estás en ${periodo.nombre}.`);

    const existentes = this.db.prepare(`SELECT a.id, a.nombre, a.peso,
        (SELECT COUNT(*) FROM calificaciones c WHERE c.actividad_id=a.id AND c.nota IS NOT NULL) AS notas
      FROM actividades a WHERE a.curso_id=? AND a.periodo_id=? AND a.materia_id IS ? ORDER BY a.id`).all(cursoId, periodoId, materiaId || null);

    const semanas = plan.semanas.map(s => {
      const fila = Array.isArray(filasWeb) ? filasWeb.find(f => Number(f.semana) === s.semana) : null;
      const tema = this._temaDeSemana(temas, s.semana, fila);
      const act = existentes.find(a => a.nombre === s.nombre);
      return {
        ...s, existe: !!act,
        existeSinTema: !!act && this.getActividadTemas(act.id).length === 0,
        temaId: tema ? tema.id : null, temaTitulo: tema ? tema.titulo : null,
        temaNuevo: !tema && fila ? (fila.titulo || 'Semana ' + s.semana) : null,
      };
    });
    return { origen, grado: plan.grado, periodo: plan.periodo, unidad: plan.unidad, semanas, avisos, existentes };
  }

  // Tema ya existente para una semana: por meta.semana o por el mismo título del web.json.
  _temaDeSemana(temas, semana, fila) {
    return temas.find(t => Number(t.meta.semana) === semana)
      || (fila && fila.titulo ? temas.find(t => t.titulo === fila.titulo) : null)
      || null;
  }

  // Crea una actividad por semana con sus evidencias. Idempotente: si ya existe una
  // actividad con el mismo nombre en el curso/período/materia, esa semana se omite.
  crearActividadesDesdePlan({ cursoId, periodoId, materiaId, semanas, filasWeb }) {
    if (!Number.isInteger(cursoId) || !Number.isInteger(periodoId)) return { error: 'Curso o período inválido.' };
    if (!Array.isArray(semanas) || semanas.length === 0) return { error: 'No hay semanas para crear.' };

    for (const s of semanas) {
      const peso = Number(s.peso);
      if (!s.nombre || !String(s.nombre).trim()) return { error: 'Hay una semana sin nombre.' };
      if (!Number.isFinite(peso) || peso <= 0 || peso > 100) return { error: `${s.nombre}: el peso debe estar entre 1 y 100.` };
      const comps = Array.isArray(s.competencias) ? s.competencias : [];
      const desconocidas = comps.filter(c => !ORDEN_COMPS.includes(c));
      if (desconocidas.length) { console.warn('Competencias desconocidas en el plan:', desconocidas); return { error: `${s.nombre}: competencia desconocida (${desconocidas.join(', ')}).` }; }
      if (comps.length === 0) return { error: `${s.nombre}: no tiene competencias.` };
      const evs = Array.isArray(s.evidencias) ? s.evidencias : [];
      for (const e of evs) {
        const p = Number(e.puntos);
        if (!comps.includes(e.competencia)) return { error: `${s.nombre}: la evidencia "${e.nombre}" es de una competencia que la semana no tiene.` };
        if (!Number.isFinite(p) || p <= 0) return { error: `${s.nombre}: la evidencia "${e.nombre}" tiene puntos inválidos.` };
      }
      for (const c of comps) if (!evs.some(e => e.competencia === c)) return { error: `${s.nombre}: la competencia ${c} no tiene evidencias.` };
    }

    const existe = this.db.prepare("SELECT id FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id IS ? AND nombre=?");
    const insAct = this.db.prepare("INSERT INTO actividades (materia_id,curso_id,periodo_id,nombre,tipo,competencia,fecha,peso,descripcion,modo,competencias_multi) VALUES (?,?,?,?,?,?,NULL,?,'',?,?)");
    const insEv  = this.db.prepare("INSERT INTO actividad_evidencias (actividad_id,competencia,nombre,sesion,instrumento,puntos,orden) VALUES (?,?,?,?,?,?,?)");
    const leerTemas = () => this.db.prepare("SELECT id, titulo, meta_json FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ? ORDER BY orden, id")
      .all(cursoId, periodoId, materiaId || null)
      .map(t => { let meta = {}; try { meta = t.meta_json ? JSON.parse(t.meta_json) : {}; } catch (_) {} return { id: t.id, titulo: t.titulo, meta }; });
    const insTema = this.db.prepare("INSERT INTO temas (materia_id, curso_id, periodo_id, titulo, estado, orden, contenido_texto, meta_json) VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)");
    const filas = Array.isArray(filasWeb) ? filasWeb.filter(f => f && typeof f === 'object' && f.semana != null) : [];

    let creadas = 0, omitidas = 0, temasCreados = 0, vinculadas = 0;
    this.db.transaction(() => {
      // Temas: los que falten se crean en ESTE curso/período/materia (el mismo de las actividades).
      let temas = leerTemas();
      let orden = this.db.prepare("SELECT COALESCE(MAX(orden),0) AS m FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id IS ?").get(cursoId, periodoId, materiaId || null).m;
      const temaPorSemana = {};
      for (const s of semanas) {
        const fila = filas.find(f => Number(f.semana) === Number(s.semana));
        let tema = this._temaDeSemana(temas, Number(s.semana), fila);
        if (!tema && fila) {
          const r = insTema.run(materiaId || null, cursoId, periodoId, fila.titulo || 'Semana ' + s.semana, ++orden, fila.contenido || '', metaTemaPortalArs(fila));
          temasCreados++;
          temas = leerTemas();
          tema = temas.find(t => t.id === r.lastInsertRowid);
        }
        if (tema) temaPorSemana[s.semana] = tema.id;
      }

      for (const s of semanas) {
        const nombre = String(s.nombre).trim();
        const temaId = temaPorSemana[s.semana];
        const ya = existe.get(cursoId, periodoId, materiaId || null, nombre);
        if (ya) {
          // Actividad ya creada antes sin tema: se vincula ahora (no toca notas ni evidencias).
          if (temaId && this.getActividadTemas(ya.id).length === 0) { this.setActividadTemas(ya.id, [temaId]); vinculadas++; }
          omitidas++; continue;
        }
        const comps = ORDEN_COMPS.filter(c => s.competencias.includes(c));
        const multi = comps.length > 1;
        const r = insAct.run(materiaId || null, cursoId, periodoId, nombre, s.tipo || 'Tarea', comps[0], Number(s.peso), multi ? 'multi' : 'simple', multi ? JSON.stringify(comps) : null);
        s.evidencias.forEach((e, i) => insEv.run(r.lastInsertRowid, e.competencia, String(e.nombre), e.sesion || '', e.instrumento || '', Number(e.puntos), i));
        if (temaId) { this.setActividadTemas(r.lastInsertRowid, [temaId]); vinculadas++; }
        creadas++;
      }
    })();
    return { creadas, omitidas, temasCreados, vinculadas };
  }

  _copiarEvidencias(origenActId, destinoActId) {
    this.db.prepare(`INSERT INTO actividad_evidencias (actividad_id,competencia,nombre,sesion,instrumento,puntos,orden)
      SELECT ?, competencia, nombre, sesion, instrumento, puntos, orden FROM actividad_evidencias WHERE actividad_id=? ORDER BY orden, id`).run(destinoActId, origenActId);
  }

  _evidenciasDe(actividadId) {
    return this.db.prepare("SELECT * FROM actividad_evidencias WHERE actividad_id=? ORDER BY orden, id").all(actividadId);
  }

  _puntosPorEstudiante(evidencias) {
    const puntos = {};
    if (evidencias.length === 0) return puntos;
    const rows = this.db.prepare(`SELECT evidencia_id, estudiante_id, puntos FROM evidencia_puntos WHERE evidencia_id IN (${evidencias.map(() => '?').join(',')})`).all(...evidencias.map(e => e.id));
    for (const r of rows) (puntos[r.estudiante_id] = puntos[r.estudiante_id] || {})[r.evidencia_id] = r.puntos;
    return puntos;
  }

  // Estado de cada estudiante: completa (nota calculada), pendiente (faltan evidencias),
  // directa (nota escrita a mano, sin evidencias anotadas) o vacia.
  _estadoEvidencias(evidencias, puntosEst, calif) {
    const anotadas = evidencias.filter(e => puntosEst[e.id] != null).length;
    if (anotadas === 0) return calif && calif.nota != null ? 'directa' : 'vacia';
    return anotadas === evidencias.length ? 'completa' : 'pendiente';
  }

  getEvidenciasActividad(actividadId) {
    const act = this.db.prepare("SELECT * FROM actividades WHERE id=?").get(actividadId);
    if (!act) return { error: 'Actividad no existe' };
    const evidencias  = this._evidenciasDe(actividadId);
    const puntos      = this._puntosPorEstudiante(evidencias);
    const estudiantes = this.getEstudiantes(act.curso_id);
    const califs = {};
    for (const c of this.db.prepare("SELECT estudiante_id, nota, distribucion_multi FROM calificaciones WHERE actividad_id=?").all(actividadId)) califs[c.estudiante_id] = c;
    const porEstudiante = {};
    for (const est of estudiantes) {
      const c = califs[est.id];
      porEstudiante[est.id] = {
        puntos: puntos[est.id] || {},
        nota: c && c.nota != null ? c.nota : null,
        distribucion: c && c.distribucion_multi ? JSON.parse(c.distribucion_multi) : null,
        estado: this._estadoEvidencias(evidencias, puntos[est.id] || {}, c),
      };
    }
    return { actividad: act, evidencias, porEstudiante };
  }

  _recalcularNotaEvidencias(act, evidencias, estudianteId) {
    const puntosEst = this._puntosPorEstudiante(evidencias)[estudianteId] || {};
    const res = notaDesdeEvidencias(act, evidencias, puntosEst);
    if (res) {
      this.db.prepare(`INSERT INTO calificaciones (actividad_id,estudiante_id,nota,observacion,distribucion_multi) VALUES (?,?,?,'',?)
        ON CONFLICT(actividad_id, estudiante_id) DO UPDATE SET nota=excluded.nota, distribucion_multi=excluded.distribucion_multi`)
        .run(act.id, estudianteId, res.nota, res.distribucion ? JSON.stringify(res.distribucion) : null);
    } else {
      // Pendiente: se quita la nota (no se pone 0) para que no cuente hasta completarse.
      this.db.prepare("UPDATE calificaciones SET nota=NULL, distribucion_multi=NULL WHERE actividad_id=? AND estudiante_id=?").run(act.id, estudianteId);
    }
    const calif = this.db.prepare("SELECT nota FROM calificaciones WHERE actividad_id=? AND estudiante_id=?").get(act.id, estudianteId);
    return {
      estado: this._estadoEvidencias(evidencias, puntosEst, calif),
      nota: res ? res.nota : null,
      distribucion: res ? res.distribucion : null,
    };
  }

  // puntos null/'' borra el dato de esa evidencia (vuelve a pendiente).
  setPuntosEvidencia({ evidenciaId, estudianteId, puntos }) {
    const ev = this.db.prepare("SELECT * FROM actividad_evidencias WHERE id=?").get(evidenciaId);
    if (!ev) return { error: 'Evidencia no existe' };
    const act = this.db.prepare("SELECT * FROM actividades WHERE id=?").get(ev.actividad_id);
    const est = this.db.prepare("SELECT id, curso_id FROM estudiantes WHERE id=?").get(estudianteId);
    if (!act || !est || est.curso_id !== act.curso_id) return { error: 'El estudiante no es de este curso' };

    if (puntos === null || puntos === undefined || puntos === '') {
      this.db.prepare("DELETE FROM evidencia_puntos WHERE evidencia_id=? AND estudiante_id=?").run(evidenciaId, estudianteId);
    } else {
      const p = Number(puntos);
      if (!Number.isFinite(p)) return { error: 'Escribe un número' };
      if (p < 0) return { error: 'No puede ser negativo' };
      if (p > ev.puntos) return { error: `El máximo es ${ev.puntos}` };
      this.db.prepare("INSERT INTO evidencia_puntos (evidencia_id, estudiante_id, puntos) VALUES (?,?,?) ON CONFLICT(evidencia_id, estudiante_id) DO UPDATE SET puntos=excluded.puntos")
        .run(evidenciaId, estudianteId, p);
    }
    return this._recalcularNotaEvidencias(act, this._evidenciasDe(act.id), estudianteId);
  }

  // "Pendientes → 0": completa con 0 las evidencias que faltan. No toca a quien tiene
  // una nota escrita a mano sin evidencias anotadas.
  cerrarPendientesEvidencias(actividadId) {
    const act = this.db.prepare("SELECT * FROM actividades WHERE id=?").get(actividadId);
    if (!act) return { error: 'Actividad no existe' };
    const evidencias = this._evidenciasDe(actividadId);
    if (evidencias.length === 0) return { error: 'La actividad no tiene evidencias' };
    const puntos = this._puntosPorEstudiante(evidencias);
    const califStmt = this.db.prepare("SELECT nota FROM calificaciones WHERE actividad_id=? AND estudiante_id=?");
    const ins = this.db.prepare("INSERT OR IGNORE INTO evidencia_puntos (evidencia_id, estudiante_id, puntos) VALUES (?,?,0)");
    let completados = 0;
    this.db.transaction(() => {
      for (const est of this.getEstudiantes(act.curso_id)) {
        const estado = this._estadoEvidencias(evidencias, puntos[est.id] || {}, califStmt.get(actividadId, est.id));
        if (estado !== 'pendiente' && estado !== 'vacia') continue;
        for (const e of evidencias) ins.run(e.id, est.id);
        this._recalcularNotaEvidencias(act, evidencias, est.id);
        completados++;
      }
    })();
    return { completados };
  }

  // Seguimiento de evidencias del curso en el período, para Reportes. Una semana cuenta
  // como "iniciada" cuando ya hay algún punto anotado; solo ahí lo que falta es pendiente
  // (las semanas que todavía no llegan no aparecen como deudas de todos).
  _seguimientoEvidencias(cursoId, periodoId, materiaId) {
    const acts = materiaId
      ? this.db.prepare("SELECT * FROM actividades a WHERE curso_id=? AND periodo_id=? AND materia_id=? AND EXISTS (SELECT 1 FROM actividad_evidencias ev WHERE ev.actividad_id=a.id) ORDER BY a.id").all(cursoId, periodoId, materiaId)
      : this.db.prepare("SELECT * FROM actividades a WHERE curso_id=? AND periodo_id=? AND EXISTS (SELECT 1 FROM actividad_evidencias ev WHERE ev.actividad_id=a.id) ORDER BY a.id").all(cursoId, periodoId);
    const califStmt = this.db.prepare("SELECT estudiante_id, nota FROM calificaciones WHERE actividad_id=?");
    return acts.map(act => {
      const evidencias = this._evidenciasDe(act.id);
      const puntos = this._puntosPorEstudiante(evidencias);
      const califs = {};
      for (const c of califStmt.all(act.id)) califs[c.estudiante_id] = c;
      return { act, corto: (act.nombre.split(' — ')[0] || act.nombre).trim(), evidencias, puntos, califs, iniciada: Object.keys(puntos).length > 0 };
    });
  }

  _evidenciasDeEstudiante(seg, estudianteId) {
    const semanas = [], pendientes = [];
    for (const s of seg) {
      const p = s.puntos[estudianteId] || {};
      const calif = s.califs[estudianteId];
      const estado = this._estadoEvidencias(s.evidencias, p, calif);
      semanas.push({
        actividad: s.act.nombre, corto: s.corto, peso: s.act.peso, iniciada: s.iniciada, estado,
        nota: calif && calif.nota != null ? calif.nota : null,
        items: s.evidencias.map(e => ({ competencia: e.competencia, nombre: e.nombre, sesion: e.sesion, max: e.puntos, puntos: p[e.id] ?? null })),
      });
      if (s.iniciada && (estado === 'pendiente' || estado === 'vacia'))
        for (const e of s.evidencias) if (p[e.id] == null) pendientes.push({ semana: s.corto, sesion: e.sesion, nombre: e.nombre });
    }
    return { semanas, pendientes };
  }

  // Datos para la planilla (una actividad o todo el período) y para listar pendientes.
  getPlanillaEvidencias(cursoId, periodoId, materiaId, actividadId) {
    const acts = actividadId
      ? this.db.prepare("SELECT * FROM actividades WHERE id=? AND curso_id=? AND periodo_id=? AND materia_id IS ?").all(actividadId, cursoId, periodoId, materiaId || null)
      : this.db.prepare(`SELECT * FROM actividades a WHERE curso_id=? AND periodo_id=? AND materia_id IS ?
          AND EXISTS (SELECT 1 FROM actividad_evidencias ev WHERE ev.actividad_id=a.id) ORDER BY a.id`).all(cursoId, periodoId, materiaId || null);
    const estudiantes = this.getEstudiantes(cursoId);
    const actividades = acts.map(act => {
      const d = this.getEvidenciasActividad(act.id);
      return { ...act, competencias: act.modo === 'multi' && act.competencias_multi ? JSON.parse(act.competencias_multi) : [act.competencia], evidencias: d.evidencias, porEstudiante: d.porEstudiante };
    }).filter(a => a.evidencias.length > 0);
    return { estudiantes, actividades };
  }

  // Resumen grupal por competencia para actividades modo='multi'.
  // Fórmula: nota_comp_en_act = (dist[comp] / techo) × 100
  //          nota_comp_periodo = Σ(nota_comp_en_act × peso_unit) / Σ(peso_unit)
  getResumenCompetenciasMulti(cursoId, periodoId, materiaId) {
    const COMPS = ['Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'];
    const q = materiaId
      ? this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? AND modo='multi' ORDER BY id")
      : this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND modo='multi' ORDER BY id");
    const actsMulti = materiaId ? q.all(cursoId, periodoId, materiaId) : q.all(cursoId, periodoId);

    const resultado = COMPS.map(comp => {
      let peso_total = 0, peso_evaluado = 0, suma_ponderada = 0;

      for (const act of actsMulti) {
        const comps = JSON.parse(act.competencias_multi || '[]');
        if (!comps.includes(comp)) continue;
        const n         = comps.length;
        const techo     = 100 / n;
        const peso_unit = act.peso / n;
        peso_total += peso_unit;

        const califs = this.db.prepare(
          "SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND nota IS NOT NULL"
        ).all(act.id);

        if (califs.length > 0) {
          peso_evaluado += peso_unit;
          let suma_notas_comp = 0;
          for (const c of califs) {
            const dist = c.distribucion_multi ? JSON.parse(c.distribucion_multi) : null;
            const pts  = dist ? (dist[comp] ?? 0) : (c.nota / n);
            suma_notas_comp += (pts / techo) * 100;
          }
          suma_ponderada += (suma_notas_comp / califs.length) * peso_unit;
        }
      }

      return {
        competencia:   comp,
        peso_total:    Math.round(peso_total    * 100) / 100,
        peso_evaluado: Math.round(peso_evaluado * 100) / 100,
        nota: peso_evaluado > 0 ? Math.round(suma_ponderada / peso_evaluado) : null,
      };
    }).filter(c => c.peso_total > 0);

    return resultado;
  }

  getResumenCompetenciasMultiPorEstudiante(estudianteId, cursoId, periodoId, materiaId) {
    const COMPS = ['Comunicativa', 'Pensamiento Logico', 'Civica', 'Tecnologica'];
    const q = materiaId
      ? this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? AND modo='multi' ORDER BY id")
      : this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND modo='multi' ORDER BY id");
    const actsMulti = materiaId ? q.all(cursoId, periodoId, materiaId) : q.all(cursoId, periodoId);

    const califStmt = this.db.prepare("SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?");
    const califs = new Map(actsMulti.map(act => [act.id, califStmt.get(act.id, estudianteId)]));

    const competencias = {};
    for (const comp of COMPS) {
      let peso_evaluado = 0, suma_ponderada = 0, en_periodo = false;

      for (const act of actsMulti) {
        const comps = JSON.parse(act.competencias_multi || '[]');
        if (!comps.includes(comp)) continue;
        const n         = comps.length;
        const techo     = 100 / n;
        const peso_unit = act.peso / n;
        en_periodo = true;

        const calif = califs.get(act.id);
        if (calif && calif.nota !== null) {
          const dist      = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null;
          const pts       = dist ? (dist[comp] ?? 0) : (calif.nota / n);
          const nota_comp = (pts / techo) * 100;
          peso_evaluado  += peso_unit;
          suma_ponderada += nota_comp * peso_unit;
        }
      }

      if (!en_periodo) continue;
      competencias[comp] = {
        nota: peso_evaluado > 0 ? Math.round(suma_ponderada / peso_evaluado) : null,
      };
    }

    // Promedio final del período: ponderado por el peso de cada actividad multi.
    // Equivale a ponderar cada competencia por su peso acumulado en el período
    // (no por partes iguales) — mismo criterio que getReporteIndividual.
    let pesoTotal = 0, sumaXPeso = 0;
    for (const act of actsMulti) {
      const calif = califs.get(act.id);
      if (calif && calif.nota !== null) { sumaXPeso += calif.nota * act.peso; pesoTotal += act.peso; }
    }
    const promedio = pesoTotal > 0 ? Math.round(sumaXPeso / pesoTotal) : null;

    return { competencias, promedio };
  }

  getObservaciones(estudianteId) { return this.db.prepare("SELECT * FROM observaciones WHERE estudiante_id=? ORDER BY fecha DESC, id DESC").all(estudianteId); }
  createObservacion(d) { return this.db.prepare("INSERT INTO observaciones (estudiante_id, fecha, texto, tipo) VALUES (?, ?, ?, ?)").run(d.estudianteId, d.fecha, d.texto, d.tipo || 'academico'); }
  deleteObservacion(id) { return this.db.prepare("DELETE FROM observaciones WHERE id=?").run(id); }
  getObservacionesRecientes(estudianteId, limite) { return this.db.prepare("SELECT * FROM observaciones WHERE estudiante_id=? ORDER BY fecha DESC, id DESC LIMIT ?").all(estudianteId, limite || 3); }

  getConfig() {
    const rows = this.db.prepare("SELECT * FROM configuracion").all();
    const obj = {};
    rows.forEach(r => { obj[r.clave] = r.valor; });
    return obj;
  }
  setConfig(clave, val) { return this.db.prepare("INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)").run(clave, String(val)); }

  // Identificador estable de esta instalación (una PC = un maestro), usado
  // como llave del archivo de backup en la nube ("una sola copia por
  // maestro" -- cada subida pisa la anterior en esa misma ruta). Se genera
  // una sola vez, la primera vez que se necesita, y se guarda como
  // cualquier otro valor de configuracion.
  getOrCrearInstalacionId() {
    const existente = this.db.prepare("SELECT valor FROM configuracion WHERE clave='instalacion_id'").get();
    if (existente) return existente.valor;
    const nuevo = randomUUID();
    this.setConfig('instalacion_id', nuevo);
    return nuevo;
  }

  getStats(anioId, materiaId) {
    const cursos      = this.db.prepare("SELECT COUNT(*) as n FROM cursos WHERE anio_escolar_id=? AND estado='activo'").get(anioId);
    const estudiantes = this.db.prepare("SELECT COUNT(*) as n FROM estudiantes e JOIN cursos c ON e.curso_id=c.id WHERE c.anio_escolar_id=? AND c.estado='activo' AND e.estado='activo'").get(anioId);
    const temasQ = materiaId
      ? this.db.prepare("SELECT t.estado, COUNT(*) as n FROM temas t JOIN cursos c ON t.curso_id=c.id WHERE c.anio_escolar_id=? AND t.materia_id=? GROUP BY t.estado").all(anioId, materiaId)
      : this.db.prepare("SELECT t.estado, COUNT(*) as n FROM temas t JOIN cursos c ON t.curso_id=c.id WHERE c.anio_escolar_id=? GROUP BY t.estado").all(anioId);
    const obj = {};
    temasQ.forEach(t => { obj[t.estado] = t.n; });
    return { cursos: cursos.n, estudiantes: estudiantes.n, temas_realizados: obj['realizado']||0, temas_pendientes: obj['pendiente']||0, temas_tarea: obj['tarea']||0, temas_aplazados: obj['aplazado']||0 };
  }

  getEstudiantesRiesgo(anioId, periodoId, materiaId) {
    const cfg      = this.getConfig();
    const minimo   = Number(cfg.minimo_aprobatorio || 70);
    const semVerde = Number(cfg.semaforo_verde      || 80);
    const cursos   = this.db.prepare("SELECT id, nombre FROM cursos WHERE anio_escolar_id=? AND estado='activo'").all(anioId);
    const periodo  = periodoId
      ? this.db.prepare("SELECT * FROM periodos WHERE id=?").get(periodoId)
      : this.db.prepare("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden DESC LIMIT 1").get(anioId);
    if (!periodo) return [];
    const resultado = [];
    for (const curso of cursos) {
      const estudiantes = this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo'").all(curso.id);
      for (const est of estudiantes) {
        const notasQ = materiaId
          ? this.db.prepare("SELECT c.nota, a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL").all(est.id, curso.id, periodo.id, materiaId)
          : this.db.prepare("SELECT c.nota, a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL").all(est.id, curso.id, periodo.id);
        let promedio = null;
        if (notasQ.length > 0) { const pt = notasQ.reduce((s,n)=>s+n.peso,0); promedio = pt>0?Math.round(notasQ.reduce((s,n)=>s+n.nota*n.peso,0)/pt):null; }
        const hoy = new Date();
        const mes = String(hoy.getMonth()+1).padStart(2,'0');
        const asists = materiaId
          ? this.db.prepare("SELECT estado FROM asistencias WHERE estudiante_id=? AND curso_id=? AND materia_id=? AND fecha LIKE ?").all(est.id, curso.id, materiaId, hoy.getFullYear()+'-'+mes+'-%')
          : this.db.prepare("SELECT estado FROM asistencias WHERE estudiante_id=? AND curso_id=? AND fecha LIKE ?").all(est.id, curso.id, hoy.getFullYear()+'-'+mes+'-%');
        let pct_asistencia = null;
        if (asists.length > 0) pct_asistencia = Math.round(asists.filter(a=>a.estado==='presente').length/asists.length*100);
        if ((promedio!==null&&promedio<minimo)||(pct_asistencia!==null&&pct_asistencia<semVerde)) {
          resultado.push({ id:est.id, curso_id:curso.id, nombre_completo:est.nombre_completo, curso_nombre:curso.nombre, periodo_nombre:periodo.nombre, promedio, pct_asistencia });
        }
      }
    }
    return resultado.sort((a,b)=>(a.promedio??999)-(b.promedio??999));
  }

  getSemaforoCursos(anioId, periodoId, materiaId) {
    const cfg         = this.getConfig();
    const semVerde    = Number(cfg.semaforo_verde    || 80);
    const semAmarillo = Number(cfg.semaforo_amarillo || 60);
    const cursos  = this.db.prepare("SELECT * FROM cursos WHERE anio_escolar_id=? AND estado='activo' ORDER BY grado,nombre").all(anioId);
    const periodo = periodoId
      ? this.db.prepare("SELECT * FROM periodos WHERE id=?").get(periodoId)
      : this.db.prepare("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden DESC LIMIT 1").get(anioId);
    if (!periodo) return [];
    return cursos.map(curso => {
      const estudiantes = this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo'").all(curso.id);
      let verde=0,amarillo=0,rojo=0,sinNota=0,sumaPromedios=0,conPromedio=0;
      for (const est of estudiantes) {
        const notas = materiaId
          ? this.db.prepare("SELECT c.nota,a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL").all(est.id,curso.id,periodo.id,materiaId)
          : this.db.prepare("SELECT c.nota,a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL").all(est.id,curso.id,periodo.id);
        if (notas.length===0){sinNota++;continue;}
        const pesoTotal=notas.reduce((s,n)=>s+n.peso,0);
        const promEst=pesoTotal>0?notas.reduce((s,n)=>s+n.nota*n.peso,0)/pesoTotal:null;
        if (promEst===null){sinNota++;continue;}
        sumaPromedios+=promEst;conPromedio++;
        if (promEst>=semVerde)verde++;
        else if (promEst>=semAmarillo)amarillo++;
        else rojo++;
      }
      return {id:curso.id,nombre:curso.nombre,color:curso.color,grado:curso.grado,verde,amarillo,rojo,sinNota,promedio:conPromedio>0?Math.round(sumaPromedios/conPromedio):null,total:estudiantes.length};
    });
  }

  getHistorialCurso(cursoId, anioId, materiaId) {
    const estudiantes = this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista, nombre_completo").all(cursoId);
    const periodos    = this.db.prepare("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden").all(anioId);
    return estudiantes.map(est => {
      const pers = periodos.map(per => {
        const notas = materiaId
          ? this.db.prepare("SELECT c.nota,a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL").all(est.id,cursoId,per.id,materiaId)
          : this.db.prepare("SELECT c.nota,a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL").all(est.id,cursoId,per.id);
        let promedio=null;
        if (notas.length>0){const pt=notas.reduce((s,n)=>s+n.peso,0);promedio=pt>0?Math.round(notas.reduce((s,n)=>s+n.nota*n.peso,0)/pt):null;}
        return {periodoId:per.id,nombre:per.nombre,promedio};
      });
      return {estudiante:est,periodos:pers};
    });
  }

  getCursoNota(cursoId, materiaId) {
    const r = materiaId
      ? this.db.prepare("SELECT texto FROM curso_nota_rapida WHERE curso_id=? AND materia_id=?").get(cursoId, materiaId)
      : this.db.prepare("SELECT texto FROM curso_nota_rapida WHERE curso_id=? AND materia_id IS NULL").get(cursoId);
    return r ? r.texto : '';
  }
  setCursoNota(cursoId, texto, materiaId) {
    const mId=materiaId||null;
    const ts=new Date().toISOString().slice(0,16);
    const row=this.db.prepare("SELECT id FROM curso_nota_rapida WHERE curso_id=? AND materia_id IS ?").get(cursoId,mId);
    if (row) return this.db.prepare("UPDATE curso_nota_rapida SET texto=?, updated_at=? WHERE id=?").run(texto,ts,row.id);
    return this.db.prepare("INSERT INTO curso_nota_rapida (curso_id, materia_id, texto, updated_at) VALUES (?,?,?,?)").run(cursoId,mId,texto,ts);
  }
  getCursoAnotaciones(cursoId, materiaId) {
    return materiaId
      ? this.db.prepare("SELECT * FROM curso_anotaciones WHERE curso_id=? AND materia_id=? ORDER BY created_at DESC").all(cursoId, materiaId)
      : this.db.prepare("SELECT * FROM curso_anotaciones WHERE curso_id=? AND materia_id IS NULL ORDER BY created_at DESC").all(cursoId);
  }
  addCursoAnotacion(cursoId, texto, materiaId) {
    const fecha=new Date().toISOString().slice(0,10);
    return this.db.prepare("INSERT INTO curso_anotaciones (curso_id, materia_id, fecha, texto) VALUES (?,?,?,?)").run(cursoId,materiaId||null,fecha,texto);
  }
  deleteCursoAnotacion(id) { return this.db.prepare("DELETE FROM curso_anotaciones WHERE id=?").run(id); }

  syncPlanToCursos({ titulo, materiaId, anioId, metaJson, cursoIds }) {
    const meta=JSON.stringify(metaJson);
    let count=0;
    const upd=this.db.prepare("UPDATE temas SET meta_json=? WHERE titulo=? AND materia_id IS ? AND curso_id=? AND curso_id IN (SELECT id FROM cursos WHERE anio_escolar_id=? AND estado='activo')");
    const batch=this.db.transaction(()=>{for(const cursoId of cursoIds){const r=upd.run(meta,titulo,materiaId||null,cursoId,anioId);count+=r.changes;}});
    batch();
    return {count};
  }

  getSemaforoEstudiantes(cursoId, periodoId, materiaId) {
    const cfg=this.getConfig();
    const minimo=Number(cfg.minimo_aprobatorio||70);
    const semVerde=Number(cfg.semaforo_verde||80);
    const semAmar=Number(cfg.semaforo_amarillo||60);
    const estudiantes=this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista,nombre_completo").all(cursoId);
    const hoy=new Date();
    const like=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0')+'-%';
    return estudiantes.map(est=>{
      const notas=materiaId
        ?this.db.prepare("SELECT c.nota,a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL").all(est.id,cursoId,periodoId,materiaId)
        :this.db.prepare("SELECT c.nota,a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL").all(est.id,cursoId,periodoId);
      let promedio=null;
      if(notas.length>0){const pt=notas.reduce((s,n)=>s+n.peso,0);promedio=pt>0?Math.round(notas.reduce((s,n)=>s+n.nota*n.peso,0)/pt):null;}
      const asists=materiaId
        ?this.db.prepare("SELECT estado FROM asistencias WHERE estudiante_id=? AND curso_id=? AND materia_id=? AND fecha LIKE ?").all(est.id,cursoId,materiaId,like)
        :this.db.prepare("SELECT estado FROM asistencias WHERE estudiante_id=? AND curso_id=? AND fecha LIKE ?").all(est.id,cursoId,like);
      let pct_asistencia=null;
      if(asists.length>0)pct_asistencia=Math.round(asists.filter(a=>a.estado==='presente').length/asists.length*100);
      const color_nota=promedio===null?'sin_nota':promedio>=semVerde?'verde':promedio>=semAmar?'amarillo':'rojo';
      const color_asist=pct_asistencia===null?'sin_dato':pct_asistencia>=semVerde?'verde':pct_asistencia>=semAmar?'amarillo':'rojo';
      const participacion=this.db.prepare("SELECT COALESCE(SUM(puntos),0) AS t FROM participaciones WHERE estudiante_id=? AND curso_id=? AND periodo_id=? AND materia_id IS ?").get(est.id,cursoId,periodoId,materiaId||null).t;
      return {id:est.id,nombre_completo:est.nombre_completo,numero_lista:est.numero_lista,grupo_trabajo:est.grupo_trabajo,participacion,promedio,pct_asistencia,color_nota,color_asist,en_riesgo:(promedio!==null&&promedio<minimo)||(pct_asistencia!==null&&pct_asistencia<semVerde)};
    });
  }

  // Participación: eventos +/- por estudiante. Es solo un indicador, no toca calificaciones.
  // d = { cursoId, periodoId, materiaId, temaId, fecha, puntos, motivo, fase, estudianteIds }
  addParticipaciones(d) {
    const puntos = Number(d && d.puntos);
    if (!Number.isInteger(puntos) || puntos === 0 || Math.abs(puntos) > 100) return { error: 'Puntos inválidos' };
    if (!d.cursoId || !d.periodoId || !d.fecha) return { error: 'Faltan curso, período o fecha' };
    // Cada punto debe quedar en un tema abierto: así el conteo por tema es exacto y no se
    // pueden dar puntos cuando el período ya está cerrado.
    const tema = d.temaId ? this.db.prepare("SELECT estado FROM temas WHERE id=? AND curso_id=? AND periodo_id=? AND materia_id IS ?").get(d.temaId, d.cursoId, d.periodoId, d.materiaId || null) : null;
    if (!tema) return { error: 'No hay tema activo: los puntos se dan dentro de un tema pendiente' };
    if (tema.estado !== 'pendiente' && tema.estado !== 'aplazado') return { error: 'El tema ya está cerrado' };
    const ids = [...new Set((d.estudianteIds || []).map(Number))].filter(n => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return { error: 'Sin estudiantes' };
    const fase = ['I', 'D', 'C'].includes(d.fase) ? d.fase : null;
    const valido = this.db.prepare("SELECT 1 FROM estudiantes WHERE id=? AND curso_id=? AND estado='activo'");
    const ins = this.db.prepare("INSERT INTO participaciones (estudiante_id,curso_id,materia_id,periodo_id,tema_id,fecha,puntos,motivo,fase) VALUES (?,?,?,?,?,?,?,?,?)");
    let registrados = 0;
    this.db.transaction(() => {
      for (const id of ids) {
        if (!valido.get(id, d.cursoId)) continue;
        ins.run(id, d.cursoId, d.materiaId || null, d.periodoId, d.temaId || null, d.fecha, puntos, String(d.motivo || '').trim().slice(0, 200), fase);
        registrados++;
      }
    })();
    return { registrados };
  }

  // Deshace el último evento del estudiante en esa fecha (mismo curso/período/materia).
  deshacerParticipacion(estudianteId, cursoId, periodoId, materiaId, fecha) {
    const row = this.db.prepare("SELECT id FROM participaciones WHERE estudiante_id=? AND curso_id=? AND periodo_id=? AND materia_id IS ? AND fecha=? ORDER BY id DESC LIMIT 1").get(estudianteId, cursoId, periodoId, materiaId || null, fecha);
    if (!row) return { deshecho: 0 };
    this.db.prepare("DELETE FROM participaciones WHERE id=?").run(row.id);
    return { deshecho: 1 };
  }

  // { [estudiante_id]: { hoy, periodo } }
  getParticipacionResumen(cursoId, periodoId, materiaId, fecha) {
    const rows = this.db.prepare("SELECT estudiante_id, SUM(puntos) AS periodo, SUM(CASE WHEN fecha=? THEN puntos ELSE 0 END) AS hoy FROM participaciones WHERE curso_id=? AND periodo_id=? AND materia_id IS ? GROUP BY estudiante_id").all(fecha, cursoId, periodoId, materiaId || null);
    const out = {};
    for (const r of rows) out[r.estudiante_id] = { hoy: r.hoy, periodo: r.periodo };
    return out;
  }

  getHistorialParticipacion(estudianteId, cursoId, periodoId, materiaId) {
    return this.db.prepare("SELECT p.fecha, p.puntos, p.motivo, p.fase, p.tema_id, t.titulo AS tema FROM participaciones p LEFT JOIN temas t ON t.id=p.tema_id WHERE p.estudiante_id=? AND p.curso_id=? AND p.periodo_id=? AND p.materia_id IS ? ORDER BY p.fecha DESC, p.id DESC").all(estudianteId, cursoId, periodoId, materiaId || null);
  }

  getEstudiantesSinNota(cursoId, periodoId, materiaId) {
    const ultima=materiaId
      ?this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY fecha DESC,id DESC LIMIT 1").get(cursoId,periodoId,materiaId)
      :this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? ORDER BY fecha DESC,id DESC LIMIT 1").get(cursoId,periodoId);
    if(!ultima)return{actividad:null,sin_nota:[]};
    const estudiantes=this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista,nombre_completo").all(cursoId);
    const conNota=new Set(this.db.prepare("SELECT estudiante_id FROM calificaciones WHERE actividad_id=? AND nota IS NOT NULL").all(ultima.id).map(c=>c.estudiante_id));
    return{actividad:{id:ultima.id,nombre:ultima.nombre,fecha:ultima.fecha,tipo:ultima.tipo,peso:ultima.peso},sin_nota:estudiantes.filter(e=>!conNota.has(e.id)).map(e=>({id:e.id,nombre_completo:e.nombre_completo,numero_lista:e.numero_lista}))};
  }

  cerrar() { if (this.db) { this.db.close(); this.db = null; } }

  getExportData(materiaId) {
    const anios=this.db.prepare("SELECT * FROM anios_escolares ORDER BY id").all();
    const hojas=[];
    for(const anio of anios){
      const cursos=this.db.prepare("SELECT * FROM cursos WHERE anio_escolar_id=? AND estado='activo'").all(anio.id);
      const periodos=this.db.prepare("SELECT * FROM periodos WHERE anio_escolar_id=? ORDER BY numero_orden").all(anio.id);
      for(const curso of cursos){
        for(const periodo of periodos){
          const estudiantes=this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista").all(curso.id);
          const actividades=materiaId
            ?this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY fecha,id").all(curso.id,periodo.id,materiaId)
            :this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? ORDER BY fecha,id").all(curso.id,periodo.id);
          if(estudiantes.length===0&&actividades.length===0)continue;
          const encabezado=['#','Estudiante',...actividades.map(a=>a.nombre),'Promedio'];
          const filas=[[anio.nombre+' - '+curso.nombre+' - '+periodo.nombre],encabezado];
          for(const est of estudiantes){
            const notas=actividades.map(act=>{const c=this.db.prepare("SELECT nota FROM calificaciones WHERE actividad_id=? AND estudiante_id=?").get(act.id,est.id);return c?.nota??'';});
            const notasPeso=actividades.map((act,i)=>({nota:notas[i],peso:act.peso||1})).filter(n=>n.nota!=='');
            let promedio='';
            if(notasPeso.length>0){const pt=notasPeso.reduce((s,n)=>s+n.peso,0);promedio=pt>0?Math.round(notasPeso.reduce((s,n)=>s+n.nota*n.peso,0)/pt):'';}
            filas.push([est.numero_lista,est.nombre_completo,...notas,promedio]);
          }
          hojas.push({nombre:(curso.nombre+' '+periodo.nombre).slice(0,31),filas});
        }
      }
    }
    return hojas;
  }

    // ── Reporte grupal ────────────────────────────────────────────
  // Devuelve todos los estudiantes activos del curso con su promedio
  // ponderado del período, estadísticas de asistencia, avance de temas
  // y si tienen observaciones en el cuaderno.
  getReporteGrupal(cursoId, periodoId, materiaId) {
    const cfg        = this.getConfig();
    const minimo     = Number(cfg.minimo_aprobatorio || 70);
    const semVerde   = Number(cfg.semaforo_verde     || 80);
    const estudiantes = this.db.prepare(
      "SELECT id, nombre_completo, numero_lista FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista"
    ).all(cursoId);
 
    // Temas del curso en este período (dato del grupo, no individual)
    const temasQ = materiaId
      ? "SELECT COUNT(*) as n FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id=?"
      : "SELECT COUNT(*) as n FROM temas WHERE curso_id=? AND periodo_id=?";
    const realQ = materiaId
      ? "SELECT COUNT(*) as n FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id=? AND estado='realizado'"
      : "SELECT COUNT(*) as n FROM temas WHERE curso_id=? AND periodo_id=? AND estado='realizado'";
 
    const tParamsBase = materiaId ? [cursoId, periodoId, materiaId] : [cursoId, periodoId];
    const segEvid = this._seguimientoEvidencias(cursoId, periodoId, materiaId);
    const temasTotal     = (this.db.prepare(temasQ).get(...tParamsBase) || {n:0}).n;
    const temasRealizados= (this.db.prepare(realQ).get(...tParamsBase) || {n:0}).n;
 
    const filas = estudiantes.map(est => {
      // Promedio ponderado del período
      const notasQ = materiaId
        ? `SELECT c.nota, a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id = a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL`
        : `SELECT c.nota, a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id = a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL`;
      const notas = materiaId
        ? this.db.prepare(notasQ).all(est.id, cursoId, periodoId, materiaId)
        : this.db.prepare(notasQ).all(est.id, cursoId, periodoId);

      let promedio     = null;
      let sinCalificar = notas.length === 0;
      if (notas.length > 0) {
        const pesoTotal = notas.reduce((s, n) => s + n.peso, 0);
        if (pesoTotal > 0)
          promedio = Math.round(notas.reduce((s, n) => s + n.nota * n.peso, 0) / pesoTotal);
      }
 
      // Asistencia acumulada en el curso
      const asistRows = this.db.prepare(
        "SELECT estado, COUNT(*) as n FROM asistencias WHERE estudiante_id=? AND curso_id=? GROUP BY estado"
      ).all(est.id, cursoId);
      const am = {};
      asistRows.forEach(r => { am[r.estado] = r.n; });
      const totalClases = asistRows.reduce((s, r) => s + r.n, 0);
      const presentes   = am['presente']  || 0;
      const ausentes    = am['ausente']   || 0;
      const tardanzas   = am['tardanza']  || 0;
      const excusados   = am['excusado']  || 0;
      const asistPct    = totalClases > 0 ? Math.round(presentes / totalClases * 100) : null;
 
      // Observaciones en cuaderno (sin filtro de período — todas las del estudiante)
      const obsCount = (this.db.prepare(
        "SELECT COUNT(*) as n FROM observaciones WHERE estudiante_id=?"
      ).get(est.id) || {n:0}).n;
 
      // Indicadores de riesgo calculados usando valores de configuración
      const enRiesgo = (promedio !== null && promedio < minimo)
                    || (asistPct !== null && asistPct < semVerde);
 
      return {
        id:              est.id,
        numero_lista:    est.numero_lista,
        nombre_completo: est.nombre_completo,
        promedio,
        sin_calificar:   sinCalificar,
        asist_pct:       asistPct,
        asist_total:     totalClases,
        asist_presentes: presentes,
        asist_ausentes:  ausentes,
        asist_tardanzas: tardanzas,
        asist_excusados: excusados,
        obs_count:       obsCount,
        en_riesgo:       enRiesgo,
        evidencias_pendientes: this._evidenciasDeEstudiante(segEvid, est.id).pendientes,
      };
    });
 
    return {
      temas_total:      temasTotal,
      temas_realizados: temasRealizados,
      estudiantes:      filas,
      evidencias:       { hay: segEvid.length > 0, semanas_iniciadas: segEvid.filter(s => s.iniciada).map(s => s.corto) },
      config:           { minimo, semVerde, semAmarillo: Number(cfg.semaforo_amarillo || 60) },
    };
  }

  // ── Exportar para Portal-Ars (padrón + promedio/asistencia) ─────
  // Mismos números que ya muestran el Reporte grupal/individual (promedio
  // general ponderado real, y el desglose por competencia -- misma
  // fórmula de simple/multi que getReporteIndividual, duplicada acá
  // adrede en vez de refactorizar esa función ya en uso por los PDFs).
  // Solo manda los números crudos: el cálculo de "avance real"/
  // "proyección" según actividades planeadas vs calificadas se hace del
  // lado de Portal-Ars, no acá.
  getExportPortalArs(cursoId, periodoId, materiaId) {
    const curso = this.db.prepare("SELECT grado,seccion FROM cursos WHERE id=?").get(cursoId);
    const estudiantes = this.db.prepare(
      "SELECT id, numero_lista FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista"
    ).all(cursoId);

    const actQ = materiaId
      ? "SELECT COUNT(DISTINCT a.id) as n FROM actividades a JOIN calificaciones c ON c.actividad_id=a.id WHERE a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL"
      : "SELECT COUNT(DISTINCT a.id) as n FROM actividades a JOIN calificaciones c ON c.actividad_id=a.id WHERE a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL";
    const actParams = materiaId ? [cursoId, periodoId, materiaId] : [cursoId, periodoId];
    const actividadesCalificadas = (this.db.prepare(actQ).get(...actParams) || { n: 0 }).n;

    // Para el detalle por semana: una actividad está «iniciada» cuando
    // algún estudiante del curso ya tiene nota o puntos de evidencia en
    // ella; ahí, a quien le falta, le queda «pendiente» (no «por venir»).
    const califStmt = this.db.prepare("SELECT nota FROM calificaciones WHERE actividad_id=? AND estudiante_id=?");
    const notaDeAct = (actId, estId) => califStmt.get(actId, estId);
    const iniciadasQ = `SELECT a.id FROM actividades a WHERE a.curso_id=? AND a.periodo_id=?${materiaId ? ' AND a.materia_id=?' : ''} AND (
        EXISTS (SELECT 1 FROM calificaciones c WHERE c.actividad_id=a.id AND c.nota IS NOT NULL) OR
        EXISTS (SELECT 1 FROM actividad_evidencias ev JOIN evidencia_puntos ep ON ep.evidencia_id=ev.id WHERE ev.actividad_id=a.id))`;
    const iniciadas = new Set(this.db.prepare(iniciadasQ).all(...actParams).map(r => r.id));

    // Evidencias de cada actividad del período y los puntos de cada
    // estudiante, leídas una sola vez para todo el curso (el portal las
    // muestra al tocar una semana: «Mapa conceptual · 16 de 20»).
    const evidCache = new Map();
    const evidenciasDeAct = (actId) => {
      if (!evidCache.has(actId)) {
        const evs = this._evidenciasDe(actId);
        evidCache.set(actId, { evs, puntos: this._puntosPorEstudiante(evs) });
      }
      return evidCache.get(actId);
    };

    const filas = estudiantes.map(est => {
      const notasQ = materiaId
        ? "SELECT c.nota, a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL"
        : "SELECT c.nota, a.peso FROM calificaciones c JOIN actividades a ON c.actividad_id=a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL";
      const notasParams = materiaId ? [est.id, cursoId, periodoId, materiaId] : [est.id, cursoId, periodoId];
      const notas = this.db.prepare(notasQ).all(...notasParams);
      let promedioGeneral = null;
      if (notas.length > 0) {
        const pesoTotal = notas.reduce((s, n) => s + n.peso, 0);
        if (pesoTotal > 0) promedioGeneral = Math.round(notas.reduce((s, n) => s + n.nota * n.peso, 0) / pesoTotal);
      }

      // Desglose por competencia -- misma fórmula que getReporteIndividual
      const actividades = materiaId
        ? this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY id").all(cursoId, periodoId, materiaId)
        : this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? ORDER BY id").all(cursoId, periodoId);
      const compMap = {};
      for (const act of actividades) {
        const calif = this.db.prepare("SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?").get(act.id, est.id);
        if (!calif || calif.nota === null) continue;
        if (act.modo === 'multi') {
          const comps = JSON.parse(act.competencias_multi || '[]');
          const n = comps.length;
          if (n === 0) continue;
          const techo    = 100 / n;
          const pesoComp = act.peso / n;
          const dist     = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null;
          for (const c of comps) {
            const pts       = dist ? (dist[c] ?? 0) : (calif.nota / n);
            const nota_comp = (pts / techo) * 100;
            if (!compMap[c]) compMap[c] = { suma: 0, peso: 0 };
            compMap[c].suma += nota_comp * pesoComp;
            compMap[c].peso += pesoComp;
          }
        } else {
          const key = act.competencia || 'Sin competencia';
          if (!compMap[key]) compMap[key] = { suma: 0, peso: 0 };
          compMap[key].suma += calif.nota * act.peso;
          compMap[key].peso += act.peso;
        }
      }
      const comp = (nombre) => (compMap[nombre] && compMap[nombre].peso > 0) ? Math.round(compMap[nombre].suma / compMap[nombre].peso) : null;

      // Asistencia acumulada del curso -- la tabla asistencias no guarda
      // periodo_id, misma limitación que ya tiene getReporteGrupal.
      const asistRows = this.db.prepare("SELECT estado, COUNT(*) as n FROM asistencias WHERE estudiante_id=? AND curso_id=? GROUP BY estado").all(est.id, cursoId);
      const am = {};
      asistRows.forEach(r => { am[r.estado] = r.n; });

      // Detalle semana por semana para Portal-Ars (cada actividad del
      // período = una semana con su peso). El portal muestra «12 de 15».
      // No cambia ninguna fórmula: solo lee la nota ya calculada.
      const semanas = actividades.map(act => {
        const calif = notaDeAct(act.id, est.id);
        const nota = calif && calif.nota !== null && calif.nota !== undefined ? calif.nota : null;
        const ev = evidenciasDeAct(act.id);
        const misPuntos = ev.puntos[est.id] || {};
        return {
          corto: (String(act.nombre || '').split(' — ')[0] || act.nombre || '').trim(),
          titulo: act.nombre || '',
          peso: act.peso || 0,
          nota,
          estado: nota !== null ? 'completa' : (iniciadas.has(act.id) ? 'pendiente' : 'por_venir'),
          // multi = cada competencia pesa lo mismo dentro de la semana
          modo: act.modo === 'multi' ? 'multi' : 'simple',
          evidencias: ev.evs.map(e => ({
            nombre: e.nombre,
            competencia: e.competencia,
            sesion: e.sesion || '',
            max: e.puntos,
            puntos: misPuntos[e.id] ?? null,
          })),
        };
      });

      return {
        numero_orden: est.numero_lista,
        detalle: { semanas },
        promedio_general: promedioGeneral,
        promedio_comunicativa: comp('Comunicativa'),
        promedio_pensamiento_logico: comp('Pensamiento Logico'),
        promedio_civica: comp('Civica'),
        promedio_tecnologica: comp('Tecnologica'),
        asist_presentes: am['presente'] || 0,
        asist_ausentes:  am['ausente']  || 0,
        asist_tardanzas: am['tardanza'] || 0,
        asist_excusados: am['excusado'] || 0,
      };
    });

    return { grado: curso?.grado || '', seccion: curso?.seccion || '', actividades_calificadas: actividadesCalificadas, estudiantes: filas };
  }

  // ── Reporte individual ────────────────────────────────────────
  // Devuelve detalle completo de un estudiante: promedio por competencia,
  // asistencia desglosada, lista de temas con estado y observaciones.
  getReporteIndividual(estudianteId, cursoId, periodoId, materiaId) {
    const est = this.db.prepare("SELECT * FROM estudiantes WHERE id=?").get(estudianteId);
    if (!est) return null;
 
    // Promedio ponderado global del período (filtrado por materia si aplica)
    const notasQ = materiaId
      ? "SELECT c.nota, a.peso, a.competencia FROM calificaciones c JOIN actividades a ON c.actividad_id = a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND a.materia_id=? AND c.nota IS NOT NULL"
      : "SELECT c.nota, a.peso, a.competencia FROM calificaciones c JOIN actividades a ON c.actividad_id = a.id WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=? AND c.nota IS NOT NULL";
    const notas = materiaId
      ? this.db.prepare(notasQ).all(estudianteId, cursoId, periodoId, materiaId)
      : this.db.prepare(notasQ).all(estudianteId, cursoId, periodoId);
 
    let promedio = null;
    if (notas.length > 0) {
      const pesoTotal = notas.reduce((s, n) => s + n.peso, 0);
      if (pesoTotal > 0)
        promedio = Math.round(notas.reduce((s, n) => s + n.nota * n.peso, 0) / pesoTotal);
    }
 
    // Promedio por competencia — maneja modo 'simple' y modo 'multi'
    // Fórmula combinada: promedio_comp = Σ(pts × peso_act) / Σ(peso_comp)
    //   simple: pts = nota, peso_act = peso, peso_comp = peso
    //   multi:  pts = dist[comp], peso_act = peso, peso_comp = peso/n_comps
    const actividades = materiaId
      ? this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY id").all(cursoId, periodoId, materiaId)
      : this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? ORDER BY id").all(cursoId, periodoId);
    const compMap = {};
    for (const act of actividades) {
      const calif = this.db.prepare(
        "SELECT nota, distribucion_multi FROM calificaciones WHERE actividad_id=? AND estudiante_id=?"
      ).get(act.id, estudianteId);
      if (!calif || calif.nota === null) continue;
      if (act.modo === 'multi') {
        const comps = JSON.parse(act.competencias_multi || '[]');
        const n = comps.length;
        if (n === 0) continue;
        const techo    = 100 / n;
        const pesoComp = act.peso / n;
        const dist     = calif.distribucion_multi ? JSON.parse(calif.distribucion_multi) : null;
        for (const c of comps) {
          const pts       = dist ? (dist[c] ?? 0) : (calif.nota / n);
          const nota_comp = (pts / techo) * 100;
          if (!compMap[c]) compMap[c] = { suma: 0, peso: 0 };
          compMap[c].suma += nota_comp * pesoComp;
          compMap[c].peso += pesoComp;
        }
      } else {
        const key = act.competencia || 'Sin competencia';
        if (!compMap[key]) compMap[key] = { suma: 0, peso: 0 };
        compMap[key].suma += calif.nota * act.peso;
        compMap[key].peso += act.peso;
      }
    }
    const competencias = Object.entries(compMap).map(([nombre, v]) => ({
      nombre,
      promedio: v.peso > 0 ? Math.round(v.suma / v.peso) : null,
    }));
 
    // Asistencia
    const asistRows = this.db.prepare(
      "SELECT estado, COUNT(*) as n FROM asistencias WHERE estudiante_id=? AND curso_id=? GROUP BY estado"
    ).all(estudianteId, cursoId);
    const am = {};
    asistRows.forEach(r => { am[r.estado] = r.n; });
    const totalClases = asistRows.reduce((s, r) => s + r.n, 0);
    const presentes   = am['presente'] || 0;
    const asistencia  = {
      total:     totalClases,
      presentes,
      ausentes:  am['ausente']  || 0,
      tardanzas: am['tardanza'] || 0,
      excusados: am['excusado'] || 0,
      pct:       totalClases > 0 ? Math.round(presentes / totalClases * 100) : null,
    };
 
    // Temas del período con su estado actual
    const temasQ = materiaId
      ? "SELECT id, titulo, estado, orden FROM temas WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY orden"
: "SELECT id, titulo, estado, orden FROM temas WHERE curso_id=? AND periodo_id=? ORDER BY orden";
    const temas = materiaId
      ? this.db.prepare(temasQ).all(cursoId, periodoId, materiaId)
      : this.db.prepare(temasQ).all(cursoId, periodoId);
 
    // Observaciones del cuaderno (todas — el docente las filtra visualmente)
    const observaciones = this.db.prepare(
      "SELECT id, fecha, texto, tipo FROM observaciones WHERE estudiante_id=? ORDER BY fecha DESC, id DESC"
    ).all(estudianteId);
 
    return {
      estudiante:   est,
      promedio,
      competencias,
      asistencia,
      temas,
      observaciones,
      evidencias:   this._evidenciasDeEstudiante(this._seguimientoEvidencias(cursoId, periodoId, materiaId), estudianteId),
    };
  }
}



module.exports = new SistemaDB();
