import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useModalTransition } from '../hooks/useModalTransition'
import { periodoPorFecha } from '../hooks/useSeleccionActiva'

const MENU = [
  { to: '/dashboard',      icono: '📊', label: 'Dashboard'      },
  { to: '/horario',        icono: '🗓️', label: 'Horario'        },
  { to: '/cursos',         icono: '📚', label: 'Cursos'         },
  { to: '/estudiantes',    icono: '👨‍🎓', label: 'Estudiantes'    },
  { to: '/asistencia',     icono: '✅', label: 'Asistencia'     },
  { to: '/calificaciones', icono: '📝', label: 'Calificaciones' },
  { to: '/temario',        icono: '📋', label: 'Temario'        },
  { to: '/reportes', icono: '📈', label: 'Reportes' },
]

const COLORES = ['#2563A8','#00695C','#5C2D91','#C84B00','#1A6B3A','#B71C1C','#7A5C00']

export default function Layout({ anio, materia, materias, onCambiarMateria, cursoActivoId, onCambiarCurso, periodoActivoId, onCambiarPeriodo }) {
  const [nombreMaestro,  setNombreMaestro]  = useState('Prof.')
  const [cursos,         setCursos]         = useState([])
  const [periodos,       setPeriodos]       = useState([])
  const location = useLocation()
  const [modalMaterias,  setModalMaterias]  = useState(false)
  const [modalNueva,     setModalNueva]     = useState(false)
  const [formNueva,      setFormNueva]      = useState({ nombre:'', color:'#2563A8' })
  const [guardando,      setGuardando]      = useState(false)
  const nav = useNavigate()
  const modalNuevaT = useModalTransition(modalNueva)

  useEffect(() => {
    window.api.invoke('get-config').then(cfg => {
      if (cfg?.nombre_maestro) setNombreMaestro(cfg.nombre_maestro)
    })
  }, [])

  // Se recarga al navegar para reflejar cursos creados/renombrados en la página Cursos.
  useEffect(() => {
    if (!anio) return
    window.api.invoke('get-cursos', anio.id).then(setCursos)
    window.api.invoke('get-periodos', anio.id).then(setPeriodos)
  }, [anio, location.pathname])

  const cursoActivo   = cursos.find(c => c.id === cursoActivoId) || cursos[0] || null
  const periodoActivo = periodos.find(p => p.id === periodoActivoId) || periodoPorFecha(periodos)
  const periodoHoy    = periodoPorFecha(periodos)
  const fueraDePeriodo = periodoActivo && periodoHoy && periodoActivo.id !== periodoHoy.id

  async function crearMateria() {
    if (!formNueva.nombre.trim()) return
    setGuardando(true)
    try {
      await window.api.invoke('create-materia', { anioId: anio.id, nombre: formNueva.nombre.trim(), color: formNueva.color })
      setModalNueva(false)
      setFormNueva({ nombre:'', color:'#2563A8' })
      // Reload materias
      if (onCambiarMateria) onCambiarMateria(null) // trigger reload in App
    } catch(e) {
      alert(e.message || 'Error al crear materia')
    }
    setGuardando(false)
  }

  const colorMateria = materia?.color || '#1B3A6B'

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>

      {/* HEADER */}
      <div style={{ background:'#1B3A6B', height:50, display:'flex', alignItems:'center', padding:'0 20px', gap:12, flexShrink:0, boxShadow:'0 2px 8px #0004' }}>
        <span style={{ fontSize:18 }}>📘</span>
        <span style={{ color:'#9BBFED', fontSize:13, fontWeight:700, letterSpacing:1 }}>SISTEMA ACADÉMICO</span>
        <div style={{ flex:1 }} />

        {/* SELECTOR DE MATERIA */}
        {anio && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {(materias||[]).map(m => (
              <button
                key={m.id}
                onClick={() => onCambiarMateria && onCambiarMateria(m)}
                style={{
                  padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700,
                  cursor:'pointer', transition:'all .15s',
                  background: materia?.id === m.id ? m.color : 'transparent',
                  color:      materia?.id === m.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  border:     materia?.id === m.id ? '2px solid '+m.color : '2px solid rgba(255,255,255,0.25)',
                }}
              >
                {m.nombre}
              </button>
            ))}
            {(!materias || materias.length === 0) && (
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>Sin materia — agrega una →</span>
            )}
            {(!materias || materias.length < 3) && (
              <button
                onClick={() => setModalNueva(true)}
                title="Agregar materia"
                style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'2px solid rgba(255,255,255,0.25)', color:'rgba(255,255,255,0.6)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}
              >+</button>
            )}
          </div>
        )}

        {anio && (
          <span style={{ background:'#2563A8', color:'#C8DCFF', padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:600 }}>
            {anio.nombre}
          </span>
        )}
        <span style={{ color:'#5A7AAA', fontSize:12 }}>{nombreMaestro}</span>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* SIDEBAR */}
        <div style={{ width:200, background:'#fff', borderRight:'1px solid #DDE3ED', display:'flex', flexDirection:'column', flexShrink:0 }}>

          {/* Materia activa badge en sidebar */}
          {materia && (
            <div style={{ margin:'12px 12px 4px', padding:'10px 12px', borderRadius:10, background:colorMateria+'15', border:'1.5px solid '+colorMateria+'40' }}>
              <div style={{ fontSize:10, fontWeight:700, color:colorMateria, letterSpacing:1, marginBottom:2 }}>MATERIA ACTIVA</div>
              <div style={{ fontSize:13, fontWeight:800, color:colorMateria }}>{materia.nombre}</div>
            </div>
          )}

          {cursoActivo && (
            <div style={{ margin:'4px 12px', padding:'10px 12px 12px', borderRadius:10, background:cursoActivo.color, color:'#fff', boxShadow:'0 2px 6px '+cursoActivo.color+'55' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, opacity:.85, marginBottom:4 }}>CURSO ACTIVO</div>
              <select
                value={cursoActivo.id}
                onChange={e => onCambiarCurso && onCambiarCurso(Number(e.target.value))}
                title="Cambiar el curso en todas las pestañas"
                style={{ width:'100%', background:'rgba(255,255,255,0.18)', color:'#fff', border:'1.5px solid rgba(255,255,255,0.5)', borderRadius:7, padding:'5px 6px', fontSize:14, fontWeight:800, cursor:'pointer', outline:'none' }}
              >
                {cursos.map(c => <option key={c.id} value={c.id} style={{ color:'#1B3A6B', background:'#fff' }}>{c.nombre}</option>)}
              </select>

              {periodos.length > 0 && (
                <div style={{ display:'flex', gap:4, marginTop:8 }}>
                  {periodos.map(p => {
                    const sel = periodoActivo?.id === p.id
                    return (
                      <button key={p.id} onClick={() => onCambiarPeriodo && onCambiarPeriodo(p.id)}
                        title={(p.titulo || p.nombre) + (periodoHoy?.id === p.id ? ' — período actual' : '')}
                        style={{
                          flex:1, padding:'3px 0', borderRadius:6, fontSize:11, fontWeight:800, cursor:'pointer',
                          background: sel ? '#fff' : 'transparent',
                          color:      sel ? cursoActivo.color : '#fff',
                          border:     '1.5px solid ' + (sel ? '#fff' : 'rgba(255,255,255,0.45)'),
                          textDecoration: periodoHoy?.id === p.id ? 'underline' : 'none',
                        }}>
                        {p.nombre}
                      </button>
                    )
                  })}
                </div>
              )}
              {fueraDePeriodo && (
                <div style={{ marginTop:8, padding:'5px 7px', borderRadius:6, background:'#FFF4D6', color:'#7A5C00', fontSize:11, fontWeight:700, lineHeight:1.3 }}>
                  ⚠️ Estás en {periodoActivo.nombre}. El período actual es {periodoHoy.nombre}.
                </div>
              )}
            </div>
          )}

          <div style={{ padding:'12px 12px 8px', fontSize:10, fontWeight:700, color:'#AAB4C4', letterSpacing:1.5 }}>NAVEGACIÓN</div>

          {MENU.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 16px', textDecoration:'none',
              background: isActive ? '#EEF2F7' : 'transparent',
              borderRight: isActive ? '3px solid '+(materia?.color||'#2563A8') : '3px solid transparent',
              color: isActive ? '#1B3A6B' : '#555',
              fontWeight: isActive ? 700 : 400,
              fontSize:13, transition:'all .12s',
            })}>
              <span style={{ fontSize:16, lineHeight:1 }}>{item.icono}</span>
              {item.label}
            </NavLink>
          ))}

          <div style={{ flex:1 }} />

          <div style={{ borderTop:'1px solid #EEF2F7' }}>
            <NavLink to="/backup" style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 16px', textDecoration:'none',
              background: isActive ? '#EEF2F7' : 'transparent',
              borderRight: isActive ? '3px solid #2563A8' : '3px solid transparent',
              color: isActive ? '#1B3A6B' : '#888',
              fontWeight: isActive ? 700 : 400,
              fontSize:13, transition:'all .12s',
            })}>
              <span style={{ fontSize:16, lineHeight:1 }}>💾</span>
              Datos & Backup
            </NavLink>

            <NavLink to="/configuracion" style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 16px', textDecoration:'none',
              background: isActive ? '#EEF2F7' : 'transparent',
              borderRight: isActive ? '3px solid #2563A8' : '3px solid transparent',
              color: isActive ? '#1B3A6B' : '#888',
              fontWeight: isActive ? 700 : 400,
              fontSize:13, transition:'all .12s',
            })}>
              <span style={{ fontSize:16, lineHeight:1 }}>⚙️</span>
              Configuración
            </NavLink>
          </div>

          <div style={{ padding:'8px 16px', borderTop:'1px solid #EEF2F7' }}>
            <div style={{ fontSize:11, color:'#AAB4C4', textAlign:'center' }}>v2.0 — Multi-materia</div>
          </div>
        </div>

        {/* CONTENIDO */}
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <Outlet />
        </div>
      </div>

      {/* MODAL NUEVA MATERIA */}
      {modalNuevaT && (
        <div className="modal-backdrop" data-closing={modalNuevaT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:800 }}
          onClick={e => { if (e.target===e.currentTarget) setModalNueva(false) }}>
          <div className="modal-content" data-closing={modalNuevaT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:400, boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:17 }}>+ Nueva Materia</h2>
            <p style={{ color:'#888', fontSize:12, marginBottom:20 }}>Puedes tener hasta 3 materias por año escolar.</p>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:6 }}>Nombre *</label>
              <input
                value={formNueva.nombre}
                onChange={e => setFormNueva(p => ({...p, nombre:e.target.value}))}
                placeholder="Ej: FIHR, Matemáticas, Sociales..."
                style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor='#2563A8'}
                onBlur={e => e.target.style.borderColor='#DDE3ED'}
                autoFocus
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:8 }}>Color</label>
              <div style={{ display:'flex', gap:8 }}>
                {COLORES.map(col => (
                  <div key={col} onClick={() => setFormNueva(p => ({...p, color:col}))} style={{ width:28, height:28, borderRadius:'50%', background:col, cursor:'pointer', border: formNueva.color===col ? '3px solid #1B3A6B' : '2px solid transparent', transition:'all .1s' }} />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{ marginBottom:20, padding:'10px 14px', borderRadius:10, background:formNueva.color+'15', border:'1.5px solid '+formNueva.color+'40' }}>
              <div style={{ fontSize:10, fontWeight:700, color:formNueva.color, letterSpacing:1, marginBottom:2 }}>VISTA PREVIA</div>
              <div style={{ fontSize:14, fontWeight:800, color:formNueva.color }}>{formNueva.nombre || 'Nueva Materia'}</div>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setModalNueva(false)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>
                Cancelar
              </button>
              <button
                onClick={crearMateria}
                disabled={!formNueva.nombre.trim() || guardando}
                style={{ padding:'9px 24px', background:formNueva.nombre.trim()?formNueva.color:'#CCC', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:formNueva.nombre.trim()?'pointer':'default' }}
              >
                {guardando ? '⏳ Creando...' : '+ Crear materia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}