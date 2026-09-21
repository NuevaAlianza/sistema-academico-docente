'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const crypto = require('node:crypto');
const db   = require('./database');
const { iniciarAutoUpdater } = require('./updater')

console.log('✅ MAIN.JS CARGADO DESDE:', __filename);

// ── PORTAL-ARS: conexión compartida por "clases semana a semana" (más
// abajo) y por el backup en la nube. El anon key es público a propósito
// (mismo que ya está commiteado en Portal-Ars/js/config.js) -- lo único
// que realmente autoriza cada operación es el PIN de admin, igual que
// en ese sistema (admin_autorizado(p_pin_hash) del lado de la RPC).
const PORTAL_ARS_URL = 'https://rjnhjvqivwkyvtcvenja.supabase.co';
const PORTAL_ARS_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqbmhqdnFpdndreXZ0Y3ZlbmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjUwMzEsImV4cCI6MjA5OTY0MTAzMX0.U5MktnSvczqqaXM09g369n50xUxabCKa7FoGJEQktwk';

async function _portalArsRpc(nombre, body) {
  const res = await fetch(`${PORTAL_ARS_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PORTAL_ARS_ANON_KEY,
      Authorization: `Bearer ${PORTAL_ARS_ANON_KEY}`,
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`Portal-Ars respondió ${res.status}`);
  return res.json();
}

async function _loginPortalArs(pin) {
  if (!pin) return { error: 'Falta el PIN de Portal-Ars (Configuración → Portal-Ars).' };
  const login = await _portalArsRpc('admin_login', { p_pin: pin });
  if (!login || !login.ok || !login.token) return { error: (login && login.error) || 'PIN de Portal-Ars incorrecto.' };
  return { token: login.token };
}

// ── Cifrado del backup en la nube (solo node:crypto, sin dependencias
// nuevas). Formato del archivo: [salt(16)][iv(12)][authTag(16)][datos].
// El authTag de GCM hace que una contraseña incorrecta falle explícito
// al descifrar, en vez de producir un .db corrupto en silencio.
function _cifrarArchivo(rutaOrigen, rutaDestino, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cifrado = Buffer.concat([cipher.update(fs.readFileSync(rutaOrigen)), cipher.final()]);
  fs.writeFileSync(rutaDestino, Buffer.concat([salt, iv, cipher.getAuthTag(), cifrado]));
}

function _descifrarArchivo(rutaOrigen, rutaDestino, password) {
  const buf = fs.readFileSync(rutaOrigen);
  const salt = buf.subarray(0, 16), iv = buf.subarray(16, 28), authTag = buf.subarray(28, 44), cifrado = buf.subarray(44);
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  fs.writeFileSync(rutaDestino, Buffer.concat([decipher.update(cifrado), decipher.final()]));
}

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
  ipcMain.handle('seleccionar-json-temario', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Seleccionar archivo JSON de temario',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    try {
      const contenido = fs.readFileSync(filePaths[0], 'utf-8');
      const jsonData = JSON.parse(contenido);
      return { jsonData, archivo: path.basename(filePaths[0]) };
    } catch (err) {
      return { error: 'El archivo no contiene JSON válido: ' + err.message };
    }
  });
  ipcMain.handle('import-temario-json', (_, { jsonData, cursoId, materiaId, anioId }) => {
    try {
      return db.importTemarioJson({ jsonData, cursoId, materiaId, anioId });
    } catch (err) {
      console.error('import-temario-json error:', err);
      return { error: err.message };
    }
  });

  // ── CLASES DESDE PORTAL-ARS (archivo exportado, o descarga directa) ────
  ipcMain.handle('import-clases-portal-ars-json', (_, { filas, cursoId, materiaId, anioId }) => {
    try {
      return db.importClasesPortalArs(filas, { cursoId, materiaId, anioId });
    } catch (err) {
      console.error('import-clases-portal-ars-json error:', err);
      return { error: err.message };
    }
  });

  // Descarga directa: reusa admin_login + admin_listar_contenido, las
  // mismas RPCs que ya usa el admin de Portal-Ars -- no hace falta ninguna
  // RPC nueva de ese lado para leer. Solo filtra por grado del curso acá,
  // el resto (matcheo de periodo, duplicados) lo hace importClasesPortalArs
  // igual que con el archivo, para que ambos caminos terminen en el mismo
  // modal de vista previa del lado de Temario.
  ipcMain.handle('descargar-clases-portal-ars', async (_, { grado }) => {
    try {
      const cfg = db.getConfig();
      const sesion = await _loginPortalArs(cfg.pin_portal_ars);
      if (sesion.error) return { error: sesion.error };
      const listado = await _portalArsRpc('admin_listar_contenido', { p_pin_hash: sesion.token });
      if (!listado || !listado.ok) return { error: (listado && listado.error) || 'No se pudo leer el contenido de Portal-Ars.' };
      const filas = (listado.semanas || []).filter(s => !grado || s.grado === grado);
      return { filas };
    } catch (err) {
      console.error('descargar-clases-portal-ars error:', err);
      return { error: err.message };
    }
  });

  ipcMain.handle('sync-plan-cursos', (_, d) => db.syncPlanToCursos(d));

  

  ipcMain.handle('get-estudiantes',     (_, cursoId)       => db.getEstudiantes(cursoId));
  ipcMain.handle('create-estudiante',   (_, d)             => db.createEstudiante(d));
  ipcMain.handle('update-estudiante',   (_, id, d)         => db.updateEstudiante(id, d));
  ipcMain.handle('importar-estudiantes',(_, cursoId, lista) => db.importarEstudiantes(cursoId, lista));
  ipcMain.handle('set-grupo-estudiante',(_, id, grupo)      => db.setGrupoEstudiante(id, grupo));
  ipcMain.handle('asignar-grupos',      (_, cursoId, items, reemplazar) => db.asignarGrupos(cursoId, items, !!reemplazar));
  ipcMain.handle('quitar-grupos-curso', (_, cursoId)        => db.quitarGruposCurso(cursoId));
  
ipcMain.handle('get-estudiantes-todos', (_, cursoId) => db.getEstudiantesTodos(cursoId));
ipcMain.handle('delete-estudiante',     (_, id)      => db.deleteEstudiante(id));

// ── Importar padrón completo (grado+sección, varios cursos a la vez) ──
// Mismo parser tolerante que 'abrir-archivo-estudiantes', pero acá grado/
// sección/número son obligatorios por fila (son la llave para ubicar el
// curso correcto) -- las filas a las que les falte alguno se descartan
// y se informan como "inválidas" en vez de adivinar un valor.
ipcMain.handle('abrir-archivo-padron', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar archivo del padrón (grado, sección, número, nombre)',
    filters: [{ name: 'Excel y CSV', extensions: ['xlsx', 'xls', 'csv'] }],
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

    const validas = [];
    let invalidas = 0;
    filas.forEach(f => {
      const grado   = (f['grado'] || '').trim();
      const seccion = (f['seccion'] || f['sección'] || '').trim();
      const nombre  = (f['nombre_completo'] || f['nombre completo'] || f['nombre'] || f['name'] || f['alumno'] || f['estudiante'] || '').trim();
      const numero  = parseInt(f['numero_orden'] || f['numero'] || f['número'] || f['numero_lista'] || f['#'], 10);
      if (!grado || !seccion || !nombre || !numero || numero < 1) { invalidas++; return; }
      validas.push({ grado, seccion, numero, nombre });
    });

    return { filas: validas, invalidas, archivo: path.basename(filePath) };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('preview-import-padron',    (_, anioId, filas)  => db.previewImportPadron(anioId, filas));
ipcMain.handle('confirmar-import-padron',  (_, anioId, grupos) => db.confirmarImportPadron(anioId, grupos));

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

ipcMain.handle('get-export-portal-ars', (_, cursoId, periodoId, materiaId) =>
  db.getExportPortalArs(cursoId, periodoId, materiaId || null));

ipcMain.handle('guardar-csv-portal-ars', async (_, csvTexto, nombreSugerido) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar archivo para Portal-Ars',
    defaultPath: nombreSugerido,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { cancelado: true };
  try {
    fs.writeFileSync(filePath, csvTexto, 'utf-8');
    return { ok: true, ruta: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

  // ── REPORTES: GENERAR LOTE (grupal + individuales, sin diálogo por archivo) ──
  ipcMain.handle('generar-reportes-lote', async (event, { items, carpetaSugerida }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Elegir dónde guardar los reportes',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || filePaths.length === 0) return { cancelado: true };

    const carpetaDestino = path.join(filePaths[0], carpetaSugerida);
    fs.mkdirSync(carpetaDestino, { recursive: true });

    const tmpDir = path.join(app.getPath('temp'), 'sd_reportes_lote_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });

    // Ventana oculta reutilizada secuencialmente: printToPDF() da el buffer
    // directo, sin el diálogo de impresión nativo que sí abre window.print().
    const win = new BrowserWindow({ show: false });
    let done = 0;
    const total = items.length;

    try {
      for (const item of items) {
        const tmpFile = path.join(tmpDir, `tmp_${done}.html`);
        fs.writeFileSync(tmpFile, item.html, 'utf-8');
        await win.loadFile(tmpFile);
        const buffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'Letter' });
        fs.writeFileSync(path.join(carpetaDestino, item.filename), buffer);
        fs.unlinkSync(tmpFile);
        done++;
        event.sender.send('lote-progreso', { done, total });
      }
    } finally {
      win.destroy();
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }

    return { ok: true, carpeta: carpetaDestino, count: done };
  });

  ipcMain.handle('abrir-carpeta', (_, ruta) => {
    require('electron').shell.openPath(ruta);
    return { ok: true };
  });

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
  const error = await shell.openPath(ruta);
  if (error) return { ok: false, error };
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
    // db.backup() hace copia atómica y consistente incluyendo el WAL completo.
    // copyFileSync no incluye frames pendientes en el WAL.
    await db.db.backup(filePath);
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
// Compartido por el restore manual (archivo local) y por el restore desde
// la nube (una vez que ese archivo ya se descargó y descifró a disco).
function _restaurarArchivoBD(rutaOrigen) {
  try {
    const destino = path.join(app.getPath('userData'), 'sistema_docente.db');
    db.cerrar();
    // Eliminar .wal y .shm ANTES de copiar el backup.
    // Si quedan del estado anterior, SQLite los replay encima del archivo
    // restaurado al reabrirlo, deshaciendo el restore por completo.
    if (fs.existsSync(destino + '-wal')) fs.unlinkSync(destino + '-wal');
    if (fs.existsSync(destino + '-shm')) fs.unlinkSync(destino + '-shm');
    fs.copyFileSync(rutaOrigen, destino);
    db.initialize();
    return { ok: true };
  } catch(e) {
    try { db.initialize(); } catch(_) {}
    return { ok: false, error: e.message };
  }
}
ipcMain.handle('backup-importar-bd', async (_, rutaOrigen) => _restaurarArchivoBD(rutaOrigen));

// ── BACKUP EN LA NUBE: SUBIR (cifrado, una sola copia por instalación) ──────
// Sube siempre a la misma ruta (instalacion_id) -- cada subida pisa la
// anterior, es la política de "una sola copia" ya confirmada con el
// usuario. El PIN nunca se pide en el momento: se usa el que el maestro
// ya guardó en Configuración → Portal-Ars.
ipcMain.handle('backup-subir-nube', async (_, { password }) => {
  if (!password) return { ok: false, error: 'Falta la contraseña para cifrar el backup.' };
  const tmpPlano = path.join(app.getPath('temp'), `sd_backup_${Date.now()}.db`);
  const tmpCifrado = tmpPlano + '.enc';
  try {
    const cfg = db.getConfig();
    const sesion = await _loginPortalArs(cfg.pin_portal_ars);
    if (sesion.error) return { ok: false, error: sesion.error };
    const instalacionId = db.getOrCrearInstalacionId();

    await db.db.backup(tmpPlano);
    _cifrarArchivo(tmpPlano, tmpCifrado, password);

    const urlResp = await _portalArsRpc('admin_backup_subir_url', {
      p_pin_hash: sesion.token, p_instalacion_id: instalacionId, p_nombre_maestro: cfg.nombre_maestro || '',
    });
    if (!urlResp || !urlResp.ok || !urlResp.url) return { ok: false, error: (urlResp && urlResp.error) || 'No se pudo obtener la URL de subida.' };

    // El gateway de Supabase exige "apikey" en todo request, incluso con
    // una signed URL -- el anon key alcanza acá, la URL ya autoriza el resto.
    const res = await fetch(urlResp.url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', apikey: PORTAL_ARS_ANON_KEY }, body: fs.readFileSync(tmpCifrado) });
    if (!res.ok) return { ok: false, error: `La subida a la nube falló (${res.status}).` };
    return { ok: true };
  } catch(e) {
    return { ok: false, error: e.message };
  } finally {
    if (fs.existsSync(tmpPlano)) fs.unlinkSync(tmpPlano);
    if (fs.existsSync(tmpCifrado)) fs.unlinkSync(tmpCifrado);
  }
});

// ── BACKUP EN LA NUBE: RESTAURAR ─────────────────────────────────────────────
// Descarga y descifra a archivos temporales primero (sin tocar la BD real
// para nada); solo si el descifrado sale bien (contraseña correcta) se
// llega a _restaurarArchivoBD, que es el mismo camino ya probado del
// restore manual.
ipcMain.handle('backup-descargar-nube', async (_, { password }) => {
  if (!password) return { ok: false, error: 'Falta la contraseña para descifrar el backup.' };
  const tmpCifrado = path.join(app.getPath('temp'), `sd_restore_${Date.now()}.db.enc`);
  const tmpPlano = tmpCifrado.replace(/\.enc$/, '');
  try {
    const cfg = db.getConfig();
    const sesion = await _loginPortalArs(cfg.pin_portal_ars);
    if (sesion.error) return { ok: false, error: sesion.error };
    const instalacionId = db.getOrCrearInstalacionId();

    const urlResp = await _portalArsRpc('admin_backup_descargar_url', { p_pin_hash: sesion.token, p_instalacion_id: instalacionId });
    if (!urlResp || !urlResp.ok || !urlResp.url) return { ok: false, error: (urlResp && urlResp.error) || 'No hay ningún backup en la nube para esta instalación.' };

    const res = await fetch(urlResp.url, { headers: { apikey: PORTAL_ARS_ANON_KEY } });
    if (!res.ok) return { ok: false, error: `La descarga desde la nube falló (${res.status}).` };
    fs.writeFileSync(tmpCifrado, Buffer.from(await res.arrayBuffer()));

    try {
      _descifrarArchivo(tmpCifrado, tmpPlano, password);
    } catch (e) {
      return { ok: false, error: 'Contraseña incorrecta (o el archivo está dañado).' };
    }

    return _restaurarArchivoBD(tmpPlano);
  } catch(e) {
    return { ok: false, error: e.message };
  } finally {
    if (fs.existsSync(tmpCifrado)) fs.unlinkSync(tmpCifrado);
    if (fs.existsSync(tmpPlano)) fs.unlinkSync(tmpPlano);
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