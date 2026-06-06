'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const db   = require('./database');
const { iniciarAutoUpdater } = require('./updater')

console.log('✅ MAIN.JS CARGADO DESDE:', __filename);

function crearVentana() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 600,
    title: 'Sistema Academico Docente',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    iniciarAutoUpdater(win)
  }
}

app.whenReady().then(() => {

  // 1️⃣ Inicializar base de datos primero
  try {
    db.initialize();
  } catch (err) {
    console.error('Error base de datos:', err.message);
  }

  // 2️⃣ Registrar TODOS los IPC después de inicializar

  ipcMain.handle('get-anios',       () => db.getAnios());
  ipcMain.handle('get-anio-activo', () => db.getAnioActivo());
  ipcMain.handle('create-anio',     (_, d) => db.createAnio(d));

  ipcMain.handle('get-periodos',   (_, anioId)  => db.getPeriodos(anioId));
  ipcMain.handle('update-periodo', (_, id, d)   => db.updatePeriodo(id, d));

  // ── MATERIAS ─────────────────────────────────────────────────────────────
  ipcMain.handle('get-materias',          (_, anioId)          => db.getMaterias(anioId));
  ipcMain.handle('create-materia',        (_, d)               => db.createMateria(d));
  ipcMain.handle('update-materia',        (_, id, d)           => db.updateMateria(id, d));
  ipcMain.handle('delete-materia',        (_, id)              => db.deleteMateria(id));
  ipcMain.handle('get-periodo-titulos',   (_, materiaId)       => db.getPeriodoTitulos(materiaId));
  ipcMain.handle('set-periodo-titulo',    (_, mId, g, nP, tit) => db.setPeriodoTitulo(mId, g, nP, tit));
  ipcMain.handle('get-titulo-grado',      (_, mId, g, nP, aId) => db.getTituloParaGrado(mId, g, nP, aId));
  ipcMain.handle('get-grados-titulos',    (_, materiaId)       => db.getGradosConTitulos(materiaId));
  ipcMain.handle('del-periodo-titulo',    (_, mId, g, nP)      => db.deletePeriodoTitulo(mId, g, nP));

  ipcMain.handle('get-cursos',   (_, anioId) => db.getCursos(anioId));
  ipcMain.handle('create-curso', (_, d)      => db.createCurso(d));
  ipcMain.handle('update-curso', (_, id, d)  => db.updateCurso(id, d));
  ipcMain.handle('delete-curso', (_, id)     => db.deleteCurso(id));

  ipcMain.handle('get-horario',          (_, anioId)      => db.getHorario(anioId));
  ipcMain.handle('get-horario-materia',  (_, anioId, mId) => db.getHorarioMateria(anioId, mId));
  ipcMain.handle('set-horario-celda',    (_, d)           => db.setHorarioCelda(d));
  ipcMain.handle('del-horario-celda',    (_, d)           => db.deleteHorarioCelda(d));
  ipcMain.handle('get-dias-curso',       (_, cId, mId)    => db.getDiasCurso(cId, mId));

  ipcMain.handle('get-temas',   (_, cId, pId, mId) => db.getTemas(cId, pId, mId));
  ipcMain.handle('create-tema', (_, d)             => db.createTema(d));
  ipcMain.handle('update-tema', (_, id, d)         => db.updateTema(id, d));
  ipcMain.handle('delete-tema', (_, id)            => db.deleteTema(id));

  // ── IMPORTAR TEMARIO DESDE JSON (web app o generado por IA) ─────────────
  ipcMain.handle('import-temario-json', (_, { jsonData, cursoId, materiaId, anioId }) => {
    try {
      return db.importTemarioJson({ jsonData, cursoId, materiaId, anioId });
    } catch (err) {
      console.error('import-temario-json error:', err);
      return { error: err.message };
    }
  });

  ipcMain.handle('sync-plan-cursos', (_, d) => db.syncPlanToCursos(d));

  

  ipcMain.handle('get-estudiantes',     (_, cursoId)       => db.getEstudiantes(cursoId));
  ipcMain.handle('create-estudiante',   (_, d)             => db.createEstudiante(d));
  ipcMain.handle('update-estudiante',   (_, id, d)         => db.updateEstudiante(id, d));
  ipcMain.handle('importar-estudiantes',(_, cursoId, lista) => db.importarEstudiantes(cursoId, lista));
  
ipcMain.handle('get-estudiantes-todos', (_, cursoId) => db.getEstudiantesTodos(cursoId));
ipcMain.handle('delete-estudiante',     (_, id)      => db.deleteEstudiante(id));

  ipcMain.handle('get-asistencia-dia', (_, cId, fecha, mId) => db.getAsistenciaDia(cId, fecha, mId));
  ipcMain.handle('set-asistencia',     (_, d)               => db.setAsistencia(d));
  ipcMain.handle('get-asistencia-mes', (_, cId, y, m, mId)  => db.getAsistenciaMes(cId, y, m, mId));

  ipcMain.handle('get-actividades',      (_, cId, pId, mId)      => db.getActividades(cId, pId, mId));
  ipcMain.handle('create-actividad',     (_, d)                  => db.createActividad(d));
  ipcMain.handle('update-actividad',     (_, id, d)              => db.updateActividad(id, d));
  ipcMain.handle('delete-actividad',     (_, id)                 => db.deleteActividad(id));
  ipcMain.handle('duplicar-actividades', (_, sC, sP, dC, dP, mId) => db.duplicarActividades(sC, sP, dC, dP, mId));
  ipcMain.handle('get-calificaciones',            (_, actId)      => db.getCalificaciones(actId));
  ipcMain.handle('set-calificacion',             (_, d)          => db.setCalificacion(d));
  ipcMain.handle('set-calificacion-multi',       (_, d)          => db.setCalificacionMulti(d));
  ipcMain.handle('get-distribucion-multi',       (_, aId, eId)   => db.getDistribucionMulti(aId, eId));
  ipcMain.handle('get-resumen-competencias-multi',(_, cId, pId, mId) => db.getResumenCompetenciasMulti(cId, pId, mId));
  ipcMain.handle('get-resumen-competencias-multi-por-estudiante',(_, eId, cId, pId, mId) => db.getResumenCompetenciasMultiPorEstudiante(eId, cId, pId, mId));

  ipcMain.handle('get-observaciones',           (_, eId)      => db.getObservaciones(eId));
  ipcMain.handle('get-observaciones-recientes', (_, eId, lim) => db.getObservacionesRecientes(eId, lim));
  ipcMain.handle('create-observacion',          (_, d)        => db.createObservacion(d));
  ipcMain.handle('delete-observacion',          (_, id)       => db.deleteObservacion(id));

  ipcMain.handle('get-config', ()               => db.getConfig());
  ipcMain.handle('set-config', (_, cl, val)     => db.setConfig(cl, val));
  ipcMain.handle('get-stats',  (_, anioId, mId) => db.getStats(anioId, mId));
  ipcMain.handle('get-semaforo-cursos',    (_, anioId, periodoId, mId) => db.getSemaforoCursos(anioId, periodoId, mId));
  ipcMain.handle('get-historial-curso',    (_, cursoId, anioId, mId)   => db.getHistorialCurso(cursoId, anioId, mId));
  ipcMain.handle('get-estudiantes-riesgo', (_, anioId, periodoId, mId) => db.getEstudiantesRiesgo(anioId, periodoId, mId));
  ipcMain.handle('get-semaforo-estudiantes', (_, cursoId, periodoId, materiaId) =>
  db.getSemaforoEstudiantes(cursoId, periodoId, materiaId));

ipcMain.handle('get-estudiantes-sin-nota', (_, cursoId, periodoId, materiaId) =>
  db.getEstudiantesSinNota(cursoId, periodoId, materiaId));

  ipcMain.handle('get-reporte-grupal',     (_, cursoId, periodoId, materiaId) =>
  db.getReporteGrupal(cursoId, periodoId, materiaId || null));
 
ipcMain.handle('get-reporte-individual', (_, estudianteId, cursoId, periodoId, materiaId) =>
  db.getReporteIndividual(estudianteId, cursoId, periodoId, materiaId || null));

  // ── ESPACIO DEL CURSO ────────────────────────────────────────────────────
  ipcMain.handle('get-curso-nota',        (_, cursoId, mId)      => db.getCursoNota(cursoId, mId));
  ipcMain.handle('set-curso-nota',        (_, cursoId, txt, mId) => db.setCursoNota(cursoId, txt, mId));
  ipcMain.handle('get-curso-anotaciones', (_, cursoId, mId)      => db.getCursoAnotaciones(cursoId, mId));
  ipcMain.handle('add-curso-anotacion',   (_, cursoId, txt, mId) => db.addCursoAnotacion(cursoId, txt, mId));
  ipcMain.handle('del-curso-anotacion',   (_, id)                => db.deleteCursoAnotacion(id));




  // 3️⃣ Crear ventana al final
  crearVentana();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });

});

// Esto se queda fuera
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── ABRIR ARCHIVO CSV/EXCEL Y PARSEAR
ipcMain.handle('abrir-archivo-estudiantes', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar archivo de estudiantes',
    filters: [
      { name: 'Excel y CSV', extensions: ['xlsx', 'xls', 'csv'] }
    ],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  let filas = [];

  try {
    if (ext === '.csv') {
      const contenido = fs.readFileSync(filePath, 'utf-8');
      const lineas = contenido.split(/\r?\n/).filter(l => l.trim());
      const sep = lineas[0].includes(';') ? ';' : ',';
      const encabezados = lineas[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g,''));
      for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(sep).map(c => c.trim().replace(/"/g,''));
        if (cols.every(c => !c)) continue;
        const obj = {};
        encabezados.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
        filas.push(obj);
      }
    } else {
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      filas = XLSX.utils.sheet_to_json(ws, { defval: '' });
      filas = filas.map(f => {
        const obj = {};
        Object.keys(f).forEach(k => { obj[k.toLowerCase().trim()] = String(f[k]||'').trim(); });
        return obj;
      });
    }

    const resultado = filas.map((f, idx) => {
      const nombre = f['nombre_completo'] || f['nombre completo'] || f['nombre'] || f['name'] || f['alumno'] || f['estudiante'] || '';
      const codigo = f['codigo'] || f['código'] || f['codigo_unico'] || f['id'] || '';
      const numero = parseInt(f['numero'] || f['número'] || f['numero_lista'] || f['#'] || String(idx + 1)) || idx + 1;
      return { nombre: nombre.trim(), codigo: codigo.trim(), numero };
    }).filter(e => e.nombre);

    return { filas: resultado, total: resultado.length, archivo: path.basename(filePath) };
  } catch (err) {
    return { error: err.message };
  }
});

// ── TEMAS: REORDENAR Y CLONAR ───────────────────────────────────────
ipcMain.handle('reordenar-temas', (_, temaIds) => db.reordenarTemas(temaIds));
ipcMain.handle('clonar-temas', (_, sC, sP, dC, dP, mId) => db.clonarTemas(sC, sP, dC, dP, mId));

// ── ARCHIVOS ADJUNTOS A TEMAS ───────────────────────────────────────
ipcMain.handle('get-archivos-tema',    (_, temaId) => db.getArchivosTema(temaId));
ipcMain.handle('delete-archivo-tema',  async (_, id) => {
  const ruta = db.deleteArchivoTema(id);
  if (ruta && fs.existsSync(ruta)) {
    try { fs.unlinkSync(ruta); } catch(e) {}
  }
  return { ok: true };
});
ipcMain.handle('abrir-archivo', async (_, ruta) => {
  const { shell } = require('electron');
  shell.openPath(ruta);
  return { ok: true };
});
ipcMain.handle('adjuntar-archivo-tema', async (_, temaId) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Adjuntar archivo al tema',
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;

  const srcPath  = filePaths[0];
  const adjDir   = path.join(app.getPath('userData'), 'adjuntos');
  if (!fs.existsSync(adjDir)) fs.mkdirSync(adjDir, { recursive: true });

  const nombre   = path.basename(srcPath);
  const destPath = path.join(adjDir, Date.now() + '_' + nombre);
  fs.copyFileSync(srcPath, destPath);

  const fecha = new Date().toISOString().slice(0, 10);
  db.addArchivoTema(temaId, nombre, destPath, fecha);
  return { nombre, ruta: destPath, fecha };
});

// ── BACKUP: EXPORTAR BD ──────────────────────────────────────────────────────
ipcMain.handle('backup-exportar-bd', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar copia de seguridad',
    defaultPath: `backup_sistema_docente_${new Date().toISOString().slice(0,10)}.db`,
    filters: [{ name: 'Base de datos', extensions: ['db'] }],
  });
  if (canceled || !filePath) return { cancelado: true };
  try {
    const origen = path.join(app.getPath('userData'), 'sistema_docente.db');
    fs.copyFileSync(origen, filePath);
    return { ok: true, ruta: filePath };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

// ── BACKUP: SELECCIONAR BD PARA IMPORTAR ────────────────────────────────────
ipcMain.handle('backup-seleccionar-bd', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar copia de seguridad',
    filters: [{ name: 'Base de datos', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  return { ruta: filePaths[0] };
});

// ── BACKUP: IMPORTAR / RESTAURAR BD ─────────────────────────────────────────
ipcMain.handle('backup-importar-bd', async (_, rutaOrigen) => {
  try {
    const destino = path.join(app.getPath('userData'), 'sistema_docente.db');
    db.cerrar();
    fs.copyFileSync(rutaOrigen, destino);
    db.initialize();
    return { ok: true };
  } catch(e) {
    try { db.initialize(); } catch(_) {}
    return { ok: false, error: e.message };
  }
});

// ── BACKUP: EXPORTAR TODO A EXCEL ────────────────────────────────────────────
ipcMain.handle('backup-exportar-excel', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar Excel de calificaciones',
    defaultPath: `calificaciones_${new Date().toISOString().slice(0,10)}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (canceled || !filePath) return { cancelado: true };
  try {
    const datos = db.getExportData();
    const XLSX  = require('xlsx');
    const wb    = XLSX.utils.book_new();

    for (const hoja of datos) {
      const ws = XLSX.utils.aoa_to_sheet(hoja.filas);
      ws['!cols'] = hoja.filas[0].map((_, i) => ({ wch: i === 1 ? 30 : 12 }));
      XLSX.utils.book_append_sheet(wb, ws, hoja.nombre.slice(0, 31));
    }

    if (wb.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sin datos']]), 'Sin datos');
    }

    XLSX.writeFile(wb, filePath);
    return { ok: true, ruta: filePath };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

// ── BACKUP: RESET TOTAL ──────────────────────────────────────────────────────
ipcMain.handle('backup-reset-bd', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'sistema_docente.db');
    db.cerrar();
    fs.unlinkSync(dbPath);
    db.initialize();
    return { ok: true };
  } catch(e) {
    try { db.initialize(); } catch(_) {}
    return { ok: false, error: e.message };
  }
});

// ── LEER IMAGEN (base64 para renderer) ───────────────────────────────────────
ipcMain.handle('leer-imagen', async (_, ruta) => {
  try {
    const data = fs.readFileSync(ruta)
    const ext  = path.extname(ruta).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mime};base64,${data.toString('base64')}`
  } catch { return null }
})

ipcMain.handle('limpiar-participacion', () => {
  const acts = db.db.prepare("SELECT id FROM actividades WHERE tipo='Participacion'").all()
  for (const a of acts) {
    db.db.prepare("DELETE FROM calificaciones WHERE actividad_id=?").run(a.id)
    db.db.prepare("DELETE FROM actividades WHERE id=?").run(a.id)
  }
  return { eliminadas: acts.length }
})