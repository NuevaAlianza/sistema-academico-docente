import React, { useState } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'

function Seccion({ titulo, icono, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', marginBottom:20, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #EEF2F7', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:20 }}>{icono}</span>
        <span style={{ fontWeight:700, fontSize:15, color:'#1B3A6B' }}>{titulo}</span>
      </div>
      <div style={{ padding:20 }}>{children}</div>
    </div>
  )
}

function Boton({ onClick, color, bg, borde, icono, label, sublabel, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display:'flex', alignItems:'center', gap:14, padding:'16px 20px',
      background: disabled ? '#F4F4F4' : bg, border:'1.5px solid ' + (disabled ? '#DDE3ED' : borde),
      borderRadius:10, cursor: disabled ? 'not-allowed' : 'pointer', width:'100%',
      textAlign:'left', transition:'all .15s', opacity: disabled ? 0.6 : 1,
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.96)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}>
      <span style={{ fontSize:28, flexShrink:0 }}>{icono}</span>
      <div>
        <div style={{ fontWeight:700, fontSize:14, color: disabled ? '#AAA' : color }}>{label}</div>
        {sublabel && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{sublabel}</div>}
      </div>
    </button>
  )
}

export default function Backup() {
  const [cargando, setCargando] = useState(null) // 'exportar' | 'importar' | 'excel' | 'reset'
  const [toast,    setToast]    = useState(null)
  const [confirm,  setConfirm]  = useState(null) // 'importar' | 'reset'
  const [archivoImportar, setArchivoImportar] = useState(null)
  const confirmT = useModalTransition(confirm)

  function toast2(msg, error) {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 4000)
  }

  // ── EXPORTAR BD ──────────────────────────────────────────────────
  async function exportarBD() {
    setCargando('exportar')
    try {
      const res = await window.api.invoke('backup-exportar-bd')
      if (res?.ok)    toast2('✅ Copia guardada en: ' + res.ruta)
      else if (res?.cancelado) { /* nada */ }
      else            toast2('Error al exportar', true)
    } catch(e) {
      toast2('Error: ' + e.message, true)
    }
    setCargando(null)
  }

  // ── IMPORTAR BD ──────────────────────────────────────────────────
  async function seleccionarBD() {
    const res = await window.api.invoke('backup-seleccionar-bd')
    if (res?.ruta) {
      setArchivoImportar(res.ruta)
      setConfirm('importar')
    }
  }

  async function confirmarImportar() {
    setCargando('importar')
    setConfirm(null)
    try {
      const res = await window.api.invoke('backup-importar-bd', archivoImportar)
      if (res?.ok) {
        toast2('✅ Base de datos restaurada. Reinicia la aplicación para ver los cambios.')
      } else {
        toast2('Error al importar: ' + (res?.error || 'desconocido'), true)
      }
    } catch(e) {
      toast2('Error: ' + e.message, true)
    }
    setCargando(null)
    setArchivoImportar(null)
  }

  // ── EXPORTAR EXCEL ───────────────────────────────────────────────
  async function exportarExcel() {
    setCargando('excel')
    try {
      const res = await window.api.invoke('backup-exportar-excel')
      if (res?.ok)       toast2('✅ Excel guardado en: ' + res.ruta)
      else if (res?.cancelado) { /* nada */ }
      else               toast2('Error al exportar Excel: ' + (res?.error || ''), true)
    } catch(e) {
      toast2('Error: ' + e.message, true)
    }
    setCargando(null)
  }

  // ── RESET ────────────────────────────────────────────────────────
  async function confirmarReset() {
    setCargando('reset')
    setConfirm(null)
    try {
      const res = await window.api.invoke('backup-reset-bd')
      if (res?.ok) toast2('✅ Datos eliminados. Reinicia la aplicación.')
      else         toast2('Error al resetear: ' + (res?.error || ''), true)
    } catch(e) {
      toast2('Error: ' + e.message, true)
    }
    setCargando(null)
  }

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, color:'#1B3A6B', marginBottom:4 }}>💾 Datos & Backup</h1>
        <p style={{ color:'#888', fontSize:14 }}>Gestiona las copias de seguridad y exportación de tus datos.</p>
      </div>

      {/* EXPORTAR BD */}
      <Seccion titulo="Copia de Seguridad" icono="🗄️">
        <p style={{ fontSize:13, color:'#666', marginBottom:14, lineHeight:1.6 }}>
          Guarda una copia exacta de toda la base de datos — cursos, estudiantes, calificaciones, asistencia y configuración. Recomendado al final de cada período.
        </p>
        <Boton
          onClick={exportarBD}
          disabled={cargando === 'exportar'}
          icono={cargando === 'exportar' ? '⏳' : '📤'}
          label={cargando === 'exportar' ? 'Exportando...' : 'Exportar copia de seguridad (.db)'}
          sublabel="Elige dónde guardar el archivo de respaldo"
          color="#1A6B3A" bg="#D6EEE0" borde="#A8D4B8"
        />
      </Seccion>

      {/* RESTAURAR BD */}
      <Seccion titulo="Restaurar desde Copia" icono="📥">
        <div style={{ background:'#FFF8D6', border:'1px solid #D4B820', borderRadius:8, padding:'10px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
          <span style={{ fontSize:18, flexShrink:0 }}>⚠️</span>
          <p style={{ fontSize:12, color:'#7A5C00', margin:0, lineHeight:1.6 }}>
            Restaurar una copia <strong>reemplaza todos los datos actuales</strong>. Esta acción no se puede deshacer. Asegúrate de exportar primero si quieres conservar los datos actuales.
          </p>
        </div>
        <Boton
          onClick={seleccionarBD}
          disabled={!!cargando}
          icono={cargando === 'importar' ? '⏳' : '📂'}
          label={cargando === 'importar' ? 'Restaurando...' : 'Restaurar base de datos'}
          sublabel="Selecciona un archivo .db exportado previamente"
          color="#2563A8" bg="#D6E4F7" borde="#9BBFED"
        />
      </Seccion>

      {/* EXPORTAR EXCEL */}
      <Seccion titulo="Exportar todo a Excel" icono="📊">
        <p style={{ fontSize:13, color:'#666', marginBottom:14, lineHeight:1.6 }}>
          Genera un archivo Excel con todas las calificaciones de todos los cursos y períodos. Útil para compartir con coordinación o tener un respaldo legible.
        </p>
        <Boton
          onClick={exportarExcel}
          disabled={cargando === 'excel'}
          icono={cargando === 'excel' ? '⏳' : '📊'}
          label={cargando === 'excel' ? 'Generando Excel...' : 'Exportar calificaciones a Excel'}
          sublabel="Un libro con una hoja por curso y período"
          color="#5C2D91" bg="#EDE0F7" borde="#C0A0E0"
        />
      </Seccion>

      {/* RESET */}
      <Seccion titulo="Borrar todos los datos" icono="🗑️">
        <div style={{ background:'#FDDFDF', border:'1px solid #FFAAAA', borderRadius:8, padding:'10px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🚨</span>
          <p style={{ fontSize:12, color:'#B71C1C', margin:0, lineHeight:1.6 }}>
            <strong>Acción irreversible.</strong> Elimina absolutamente todos los datos — estudiantes, calificaciones, asistencia, cursos y configuración. La app quedará como nueva instalación.
          </p>
        </div>
        <Boton
          onClick={() => setConfirm('reset')}
          disabled={!!cargando}
          icono="🗑️"
          label="Borrar todos los datos"
          sublabel="La aplicación volverá al estado inicial"
          color="#B71C1C" bg="#FDDFDF" borde="#FFAAAA"
        />
      </Seccion>

      {/* MODAL CONFIRMACIÓN IMPORTAR */}
      {confirmT?.value === 'importar' && (
        <div className="modal-backdrop" data-closing={confirmT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600 }}>
          <div className="modal-content" data-closing={confirmT.closing} style={{ background:'#fff', borderRadius:14, padding:32, width:420, boxShadow:'0 16px 48px #0004', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📥</div>
            <h3 style={{ color:'#1B3A6B', marginBottom:8, fontSize:16 }}>¿Restaurar esta copia?</h3>
            <p style={{ color:'#555', fontSize:13, marginBottom:6 }}>
              Se reemplazarán <strong style={{ color:'#B71C1C' }}>todos los datos actuales</strong> con el archivo seleccionado.
            </p>
            <div style={{ background:'#F0F4FA', borderRadius:8, padding:'8px 12px', marginBottom:20, fontSize:12, color:'#555', wordBreak:'break-all' }}>
              📁 {archivoImportar}
            </div>
            <p style={{ color:'#AAB4C4', fontSize:12, marginBottom:24 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => { setConfirm(null); setArchivoImportar(null) }}
                style={{ padding:'10px 28px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}>
                Cancelar
              </button>
              <button onClick={confirmarImportar}
                style={{ padding:'10px 28px', background:'#2563A8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                📥 Sí, restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN RESET */}
      {confirmT?.value === 'reset' && (
        <div className="modal-backdrop" data-closing={confirmT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600 }}>
          <div className="modal-content" data-closing={confirmT.closing} style={{ background:'#fff', borderRadius:14, padding:32, width:420, boxShadow:'0 16px 48px #0004', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🚨</div>
            <h3 style={{ color:'#B71C1C', marginBottom:8, fontSize:16 }}>¿Borrar TODOS los datos?</h3>
            <p style={{ color:'#555', fontSize:13, marginBottom:6 }}>
              Esto eliminará <strong style={{ color:'#B71C1C' }}>permanentemente</strong> todos los estudiantes, calificaciones, asistencia, cursos y configuración.
            </p>
            <p style={{ color:'#AAB4C4', fontSize:12, marginBottom:24 }}>La aplicación volverá al estado de nueva instalación. Esta acción NO se puede deshacer.</p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setConfirm(null)}
                style={{ padding:'10px 28px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}>
                Cancelar
              </button>
              <button onClick={confirmarReset}
                style={{ padding:'10px 28px', background:'#B71C1C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🗑️ Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, right:24, padding:'12px 20px', borderRadius:10,
          fontSize:13, fontWeight:600, boxShadow:'0 4px 16px #0003', zIndex:999, maxWidth:400,
          background: toast.error ? '#B71C1C' : '#1A6B3A', color:'#fff',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}