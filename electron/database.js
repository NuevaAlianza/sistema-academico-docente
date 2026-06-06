'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

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
      { tabla: 'horario_asignaciones', col: 'materia_id', def: 'INTEGER' },
      { tabla: 'asistencias',          col: 'materia_id', def: 'INTEGER' },
      { tabla: 'actividades',          col: 'materia_id', def: 'INTEGER' },
      { tabla: 'temas',                col: 'materia_id', def: 'INTEGER' },
      { tabla: 'curso_nota_rapida',    col: 'materia_id', def: 'INTEGER' },
      { tabla: 'curso_anotaciones',    col: 'materia_id', def: 'INTEGER' },
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
  createCurso(d) { return this.db.prepare("INSERT INTO cursos (anio_escolar_id,nombre,grado,seccion,descripcion,color) VALUES (?,?,?,?,?,?)").run(d.anioId, d.nombre, d.grado||'', d.seccion||'', d.descripcion||'', d.color||'#2563A8'); }
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
    let count = 0;
    let ordenBase = maxOrden;
    const batch = this.db.transaction(() => {
      (jsonData.periodos || []).forEach(p => {
        const periodo = periodos.find(dbP => dbP.numero_orden === p.numero || dbP.nombre === p.nombre);
        if (!periodo) return;
        (p.temas || []).forEach(t => {
          ordenBase += 1;
          const meta = { subtitulo:t.subtitulo||null, semana:t.semana||null, fase:t.fase||null, competencia:t.competencia||null, indicadores:t.indicadores||null, peso:t.peso||null, instrumento:t.instrumento||null, actividades:t.actividades||null, texto_biblico:t.texto_biblico||null, metacognicion:t.metacognicion||null, recursos:t.recursos||null };
          Object.keys(meta).forEach(k => { if (meta[k] === null) delete meta[k]; });
          insertTema.run(materiaId || null, cursoId, periodo.id, t.titulo || 'Sin titulo', t.estado || 'pendiente', ordenBase, Object.keys(meta).length > 0 ? JSON.stringify(meta) : null);
          count++;
        });
      });
    });
    batch();
    return { count };
  }

  getEstudiantes(cursoId) { return this.db.prepare("SELECT * FROM estudiantes WHERE curso_id=? AND estado='activo' ORDER BY numero_lista,nombre_completo").all(cursoId); }
  createEstudiante(d) { return this.db.prepare("INSERT INTO estudiantes (curso_id,codigo_unico,numero_lista,nombre_completo) VALUES (?,?,?,?)").run(d.cursoId, d.codigo||'', d.numero||0, d.nombre); }
  updateEstudiante(id, d) { return this.db.prepare("UPDATE estudiantes SET nombre_completo=?,codigo_unico=?,numero_lista=?,estado=? WHERE id=?").run(d.nombre, d.codigo||'', d.numero||0, d.estado||'activo', id); }
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
    if (materiaId) return this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=? ORDER BY fecha DESC,id DESC").all(cursoId, periodoId, materiaId);
    return this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? ORDER BY fecha DESC,id DESC").all(cursoId, periodoId);
  }
  createActividad(d) { return this.db.prepare("INSERT INTO actividades (materia_id,curso_id,periodo_id,nombre,tipo,competencia,fecha,peso,descripcion) VALUES (?,?,?,?,?,?,?,?,?)").run(d.materiaId||null, d.cursoId, d.periodoId, d.nombre, d.tipo||'tarea', d.competencia||'Comunicativa', d.fecha||null, d.peso||1, d.descripcion||''); }
  updateActividad(id, d) { return this.db.prepare("UPDATE actividades SET nombre=?,tipo=?,competencia=?,fecha=?,peso=? WHERE id=?").run(d.nombre, d.tipo||'tarea', d.competencia||'Comunicativa', d.fecha||null, d.peso||1, id); }
  deleteActividad(id) {
    this.db.prepare("DELETE FROM calificaciones WHERE actividad_id=?").run(id);
    return this.db.prepare("DELETE FROM actividades WHERE id=?").run(id);
  }
  duplicarActividades(sourceCursoId, sourcePeriodoId, targetCursoId, targetPeriodoId, materiaId) {
    const acts = materiaId
      ? this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id=?").all(sourceCursoId, sourcePeriodoId, materiaId)
      : this.db.prepare("SELECT * FROM actividades WHERE curso_id=? AND periodo_id=?").all(sourceCursoId, sourcePeriodoId);
    const ins = this.db.prepare("INSERT INTO actividades (materia_id,curso_id,periodo_id,nombre,tipo,competencia,fecha,peso,descripcion) VALUES (?,?,?,?,?,?,?,?,?)");
    let copiadas = 0;
    for (const a of acts) {
      const existe = this.db.prepare("SELECT id FROM actividades WHERE curso_id=? AND periodo_id=? AND materia_id IS ? AND nombre=?").get(targetCursoId, targetPeriodoId, materiaId||null, a.nombre);
      if (!existe) { ins.run(materiaId||null, targetCursoId, targetPeriodoId, a.nombre, a.tipo, a.competencia, a.fecha, a.peso, a.descripcion||''); copiadas++; }
    }
    return { total: acts.length, copiadas };
  }

  getCalificaciones(actividadId) { return this.db.prepare("SELECT c.*,e.nombre_completo,e.numero_lista FROM calificaciones c JOIN estudiantes e ON c.estudiante_id=e.id WHERE c.actividad_id=? ORDER BY e.numero_lista").all(actividadId); }
  setCalificacion(d) { return this.db.prepare("INSERT OR REPLACE INTO calificaciones (actividad_id,estudiante_id,nota,observacion) VALUES (?,?,?,?)").run(d.actividadId, d.estudianteId, d.nota, d.observacion||null); }

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

  getStats(anioId, materiaId) {
    const cursos      = this.db.prepare("SELECT COUNT(*) as n FROM cursos WHERE anio_escolar_id=? AND estado='activo'").get(anioId);
    const estudiantes = this.db.prepare("SELECT COUNT(*) as n FROM estudiantes e JOIN cursos c ON e.curso_id=c.id WHERE c.anio_escolar_id=? AND e.estado='activo'").get(anioId);
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
      return {id:est.id,nombre_completo:est.nombre_completo,numero_lista:est.numero_lista,promedio,pct_asistencia,color_nota,color_asist,en_riesgo:(promedio!==null&&promedio<minimo)||(pct_asistencia!==null&&pct_asistencia<semVerde)};
    });
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
    const temasTotal     = (this.db.prepare(temasQ).get(...tParamsBase) || {n:0}).n;
    const temasRealizados= (this.db.prepare(realQ).get(...tParamsBase) || {n:0}).n;
 
    const filas = estudiantes.map(est => {
      // Promedio ponderado del período
      const notas = this.db.prepare(`
        SELECT c.nota, a.peso
        FROM calificaciones c
        JOIN actividades a ON c.actividad_id = a.id
        WHERE c.estudiante_id=? AND a.curso_id=? AND a.periodo_id=?
          AND c.nota IS NOT NULL
      `).all(est.id, cursoId, periodoId);
 
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
 
      // Indicadores de riesgo calculados
      const enRiesgo = (promedio !== null && promedio < 60)
                    || (asistPct !== null && asistPct < 70);
 
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
      };
    });
 
    return {
      temas_total:      temasTotal,
      temas_realizados: temasRealizados,
      estudiantes:      filas,
    };
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
 
    // Promedio por competencia (para las barras)
    const compMap = {};
    notas.forEach(n => {
      const key = n.competencia || 'Sin competencia';
      if (!compMap[key]) compMap[key] = { suma: 0, peso: 0 };
      compMap[key].suma  += n.nota * n.peso;
      compMap[key].peso  += n.peso;
    });
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
    };
  }
}



module.exports = new SistemaDB();
