import React, { useState, useEffect } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'

const SECCION = ({ titulo, icono, children }) => (
  <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', marginBottom:20, overflow:'hidden' }}>
    <div style={{ background:'#1B3A6B', padding:'12px 20px', display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:18 }}>{icono}</span>
      <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{titulo}</span>
    </div>
    <div style={{ padding:24 }}>{children}</div>
  </div>
)

const Campo = ({ label, hint, children }) => (
  <div style={{ marginBottom:18 }}>
    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:5 }}>{label}</label>
    {hint && <div style={{ fontSize:11, color:'#AAB4C4', marginBottom:6 }}>{hint}</div>}
    {children}
  </div>
)

const inputStyle = { width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }
const COLS_MAT   = ['#2563A8','#00695C','#5C2D91','#C84B00','#1A6B3A','#B71C1C','#7A5C00']
const COLS_PER   = ['#2563A8','#00695C','#5C2D91','#1A6B3A']

export default function Configuracion({ anio, materias, materia, onRecargarMaterias }) {
  const [cfg,          setCfg]          = useState({})
  const [toast,        setToast]        = useState(null)
  const [guardando,    setGuardando]    = useState(false)
  const [pesoError,    setPesoError]    = useState(false)
  const [anioActivo,   setAnioActivo]   = useState(null)
  const [modalAnio,    setModalAnio]    = useState(false)
  const [formAnio,     setFormAnio]     = useState({ nombre:'', fecha_inicio:'', fecha_fin:'' })
  const [creandoAnio,  setCreandoAnio]  = useState(false)
  const [periodos,     setPeriodos]     = useState([])
  const [editandoPer,  setEditandoPer]  = useState(null)
  const [guardandoPer, setGuardandoPer] = useState(false)
  const [editandoMat,  setEditandoMat]  = useState(null)
  const [guardandoMat, setGuardandoMat] = useState(false)
  const [matTitulos,   setMatTitulos]   = useState(null)
  const [grados,       setGrados]       = useState([])
  const [gradoSel,     setGradoSel]     = useState(null)
  const [titulosGrado, setTitulosGrado] = useState({})
  const [guardandoTit, setGuardandoTit] = useState(false)
  const [confirmElim,  setConfirmElim]  = useState(null)
  const modalAnioT   = useModalTransition(modalAnio)
  const matTitulosT  = useModalTransition(matTitulos)
  const confirmElimT = useModalTransition(confirmElim)

  useEffect(() => { cargar(); cargarAnio() }, [])

  async function cargar() {
    const c = await window.api.invoke('get-config')
    setCfg(c)
  }

  async function cargarAnio() {
    const a = await window.api.invoke('get-anio-activo')
    setAnioActivo(a)
    if (a?.id) {
      const ps = await window.api.invoke('get-periodos', a.id)
      setPeriodos(ps)
    }
  }

  async function guardarPeriodo(per) {
    setGuardandoPer(true)
    await window.api.invoke('update-periodo', per.id, { nombre: per.nombre, titulo: per.titulo, fecha_inicio: per.fecha_inicio||null, fecha_fin: per.fecha_fin||null })
    setPeriodos(prev => prev.map(p => p.id === per.id ? { ...p, ...per } : p))
    setEditandoPer(null)
    setGuardandoPer(false)
    toast2('✅ Período actualizado')
  }

  async function guardarMateria(mat) {
    setGuardandoMat(true)
    await window.api.invoke('update-materia', mat.id, { nombre: mat.nombre, color: mat.color })
    setEditandoMat(null)
    setGuardandoMat(false)
    if (onRecargarMaterias) await onRecargarMaterias()
    toast2('✅ Materia actualizada')
  }

  async function eliminarMateria(mat) {
    await window.api.invoke('delete-materia', mat.id)
    if (onRecargarMaterias) await onRecargarMaterias()
    setConfirmElim(null)
    toast2('🗑️ Materia eliminada')
  }

  async function abrirTitulosGrado(mat) {
    setMatTitulos(mat)
    setGradoSel(null)
    setTitulosGrado({})
    if (anio?.id) {
      const cursos = await window.api.invoke('get-cursos', anio.id)
      const gradosUnicos = [...new Set(cursos.map(c => c.grado).filter(g => g && g.trim()))].sort()
      setGrados(gradosUnicos)
    }
  }

  async function seleccionarGrado(grado) {
    setGradoSel(grado)
    const titulos = await window.api.invoke('get-periodo-titulos', matTitulos.id)
    const delGrado = titulos.filter(t => t.grado === grado)
    const obj = {}
    delGrado.forEach(t => { obj[t.numero_periodo] = t.titulo })
    setTitulosGrado(obj)
  }

  async function guardarTitulosGrado() {
    if (!matTitulos || !gradoSel) return
    setGuardandoTit(true)
    for (const per of periodos) {
      const titulo = titulosGrado[per.numero_orden] || ''
      if (titulo.trim()) {
        await window.api.invoke('set-periodo-titulo', matTitulos.id, gradoSel, per.numero_orden, titulo.trim())
      } else {
        await window.api.invoke('del-periodo-titulo', matTitulos.id, gradoSel, per.numero_orden)
      }
    }
    setGuardandoTit(false)
    toast2('✅ Títulos guardados para ' + gradoSel)
  }

  function toast2(msg, color = '#1A6B3A') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  function cambio(k, v) {
    setCfg(prev => ({ ...prev, [k]: v }))
    if (['actividades_peso','participacion_peso','asistencia_peso','conducta_peso'].includes(k)) setPesoError(false)
  }

  function sumaPesos() {
    return ['actividades_peso','participacion_peso','asistencia_peso','conducta_peso'].reduce((s, k) => s + (Number(cfg[k]) || 0), 0)
  }

  async function guardar() {
    if (!cfg.nombre_maestro?.trim()) { toast2('⚠️ El nombre del maestro es obligatorio', '#C84B00'); return }
    const suma = sumaPesos()
    if (suma !== 100) { setPesoError(true); toast2(`⚠️ Los pesos deben sumar 100 (ahora ${suma})`, '#C84B00'); return }
    setGuardando(true)
    for (const [k, v] of Object.entries(cfg)) await window.api.invoke('set-config', k, String(v))
    setGuardando(false)
    toast2('✅ Configuración guardada')
  }

  function abrirModalAnio() {
    const anioNum = anioActivo?.nombre?.split('-')[1]
    const sig = anioNum ? `${anioNum}-${Number(anioNum)+1}` : ''
    setFormAnio({ nombre: sig, fecha_inicio: anioNum ? `${anioNum}-08-01` : '', fecha_fin: anioNum ? `${Number(anioNum)+1}-07-31` : '' })
    setModalAnio(true)
  }

  async function crearNuevoAnio() {
    if (!formAnio.nombre.trim()) { toast2('⚠️ Nombre obligatorio', '#C84B00'); return }
    setCreandoAnio(true)
    try {
      await window.api.invoke('create-anio', { nombre: formAnio.nombre.trim(), fecha_inicio: formAnio.fecha_inicio||null, fecha_fin: formAnio.fecha_fin||null })
      await cargarAnio()
      setModalAnio(false)
      toast2('🎉 Año creado. Reinicia para activarlo.')
    } catch(e) { toast2('⚠️ Error: ' + e.message, '#C84B00') }
    setCreandoAnio(false)
  }

  const suma      = sumaPesos()
  const sumaColor = suma === 100 ? '#1A6B3A' : '#B71C1C'

  return (
    <div style={{ maxWidth:660 }}>

      <div style={{ display:'flex', alignItems:'center', marginBottom:24, gap:12 }}>
        <h1 style={{ fontSize:20, color:'#1B3A6B' }}>⚙️ Configuración</h1>
        <div style={{ flex:1 }} />
        <button onClick={guardar} disabled={guardando} style={{ padding:'9px 24px', background:guardando?'#7A8FA8':'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:guardando?'default':'pointer' }}>
          {guardando ? '⏳ Guardando...' : '💾 Guardar cambios'}
        </button>
      </div>

      {/* ── AÑO ESCOLAR ── */}
      <SECCION titulo="Año Escolar" icono="📅">
        {anioActivo ? (
          <div className="content-fade-in">
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
              <div style={{ flex:1, background:'#EEF6FF', borderRadius:10, padding:'14px 18px', border:'1px solid #C5DAFF' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#7A9FC8', marginBottom:4 }}>AÑO ACTIVO</div>
                <div style={{ fontSize:20, fontWeight:900, color:'#1B3A6B' }}>{anioActivo.nombre}</div>
                {anioActivo.fecha_inicio && anioActivo.fecha_fin && (
                  <div style={{ fontSize:12, color:'#7A9FC8', marginTop:4 }}>{anioActivo.fecha_inicio} → {anioActivo.fecha_fin}</div>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#1A6B3A' }} />
                <span style={{ fontSize:12, color:'#1A6B3A', fontWeight:700 }}>Activo</span>
              </div>
            </div>
            <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:12, color:'#92400E' }}>
              <strong>📌 ¿Cómo cambiar de año?</strong> Crea el nuevo año y reinicia la app — carga el más reciente al iniciar.
            </div>
            <button onClick={abrirModalAnio} style={{ padding:'11px 24px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              🆕 Crear nuevo año escolar
            </button>
          </div>
        ) : (
          <div style={{ color:'#888', fontSize:13, display:'flex', alignItems:'center', gap:8 }}><div className="spinner" style={{ width:14, height:14, borderWidth:2 }} />Cargando...</div>
        )}
      </SECCION>

      {/* ── MIS MATERIAS ── */}
      <SECCION titulo="Mis Materias" icono="📚">
        <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>
          Edita nombre y color. Para agregar una nueva usa el + en el header. No puedes eliminar la materia activa ni si solo hay una.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {(materias||[]).map(mat => {
            const esEdit = editandoMat?.id === mat.id
            const dato   = esEdit ? editandoMat : mat
            const esActiva = mat.id === materia?.id
            const puedeEliminar = !esActiva && (materias||[]).length > 1
            return (
              <div key={mat.id} style={{ borderRadius:10, border:'1.5px solid '+(esEdit?dato.color:'#DDE3ED'), overflow:'hidden' }}>
                <div style={{ background:esEdit?dato.color+'15':'#F8FAFD', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid '+(esEdit?dato.color+'30':'#EEF2F7') }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', background:dato.color, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:dato.color }}>{mat.nombre}</span>
                    {esActiva && (
                      <span style={{ marginLeft:8, fontSize:10, background:mat.color+'20', color:mat.color, padding:'2px 8px', borderRadius:10, fontWeight:700 }}>ACTIVA</span>
                    )}
                  </div>
                  {!esEdit ? (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => abrirTitulosGrado(mat)} style={{ padding:'5px 14px', background:mat.color+'15', border:'1px solid '+mat.color+'40', borderRadius:6, fontSize:11, fontWeight:600, color:mat.color, cursor:'pointer' }}>
                        📚 Títulos por grado
                      </button>
                      <button onClick={() => setEditandoMat({...mat})} style={{ padding:'5px 14px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:6, fontSize:11, fontWeight:600, color:'#1B3A6B', cursor:'pointer' }}>
                        ✏️ Editar
                      </button>
                      {puedeEliminar && (
                        <button onClick={() => setConfirmElim(mat)} style={{ padding:'5px 12px', background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:6, fontSize:11, fontWeight:600, color:'#B91C1C', cursor:'pointer' }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setEditandoMat(null)} style={{ padding:'5px 12px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:6, fontSize:11, cursor:'pointer', color:'#555' }}>Cancelar</button>
                      <button onClick={() => guardarMateria(editandoMat)} disabled={guardandoMat} style={{ padding:'5px 14px', background:dato.color, border:'none', borderRadius:6, fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer' }}>
                        {guardandoMat ? '⏳' : '💾 Guardar'}
                      </button>
                    </div>
                  )}
                </div>
                {esEdit && (
                  <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                    <Campo label="Nombre de la materia">
                      <input value={dato.nombre} onChange={e => setEditandoMat(p => ({...p, nombre:e.target.value}))}
                        placeholder="Ej: FIHR, Matemáticas..."
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor=dato.color}
                        onBlur={e => e.target.style.borderColor='#DDE3ED'} />
                    </Campo>
                    <div>
                      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:8 }}>Color</label>
                      <div style={{ display:'flex', gap:8 }}>
                        {COLS_MAT.map(col => (
                          <div key={col} onClick={() => setEditandoMat(p => ({...p, color:col}))}
                            style={{ width:28, height:28, borderRadius:'50%', background:col, cursor:'pointer', border: dato.color===col ? '3px solid #1B3A6B' : '2px solid transparent' }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ padding:'10px 14px', borderRadius:8, background:dato.color+'15', border:'1px solid '+dato.color+'40' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:dato.color, letterSpacing:1, marginBottom:2 }}>VISTA PREVIA</div>
                      <div style={{ fontSize:14, fontWeight:800, color:dato.color }}>{dato.nombre||'Sin nombre'}</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {(!materias || materias.length === 0) && (
            <div style={{ color:'#AAA', fontSize:13, fontStyle:'italic' }}>No hay materias configuradas.</div>
          )}
        </div>
      </SECCION>

      {/* ── PERÍODOS ── */}
      <SECCION titulo="Períodos del Año Escolar" icono="📆">
        <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>Edita el nombre y título de cada período.</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {periodos.map((per, i) => {
            const col    = COLS_PER[i] || '#2563A8'
            const esEdit = editandoPer?.id === per.id
            const dato   = esEdit ? editandoPer : per
            return (
              <div key={per.id} style={{ borderRadius:10, border:'1.5px solid '+(esEdit?col:'#DDE3ED'), overflow:'hidden' }}>
                <div style={{ background:esEdit?col+'15':'#F8FAFD', padding:'10px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid '+(esEdit?col+'30':'#EEF2F7') }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:col, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:col }}>{per.nombre}</span>
                    {!esEdit && <span style={{ fontSize:12, color:'#888', marginLeft:8 }}>{per.titulo}</span>}
                  </div>
                  {!esEdit ? (
                    <button onClick={() => setEditandoPer({...per})} style={{ padding:'4px 12px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:6, fontSize:11, fontWeight:600, color:'#1B3A6B', cursor:'pointer' }}>✏️ Editar</button>
                  ) : (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setEditandoPer(null)} style={{ padding:'4px 12px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:6, fontSize:11, cursor:'pointer', color:'#555' }}>Cancelar</button>
                      <button onClick={() => guardarPeriodo(editandoPer)} disabled={guardandoPer} style={{ padding:'4px 14px', background:col, border:'none', borderRadius:6, fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer' }}>
                        {guardandoPer ? '⏳' : '💾 Guardar'}
                      </button>
                    </div>
                  )}
                </div>
                {esEdit && (
                  <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
                    <Campo label="Nombre corto">
                      <input value={dato.nombre} onChange={e => setEditandoPer(p => ({...p, nombre:e.target.value}))} style={inputStyle}
                        onFocus={e => e.target.style.borderColor=col} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
                    </Campo>
                    <Campo label="Título completo">
                      <input value={dato.titulo||''} onChange={e => setEditandoPer(p => ({...p, titulo:e.target.value}))}
                        placeholder="Ej: Familia, Cultura y Valores" style={inputStyle}
                        onFocus={e => e.target.style.borderColor=col} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
                    </Campo>
                    <Campo label="Fecha inicio">
                      <input type="date" value={dato.fecha_inicio||''} onChange={e => setEditandoPer(p => ({...p, fecha_inicio:e.target.value}))} style={inputStyle}
                        onFocus={e => e.target.style.borderColor=col} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
                    </Campo>
                    <Campo label="Fecha fin">
                      <input type="date" value={dato.fecha_fin||''} onChange={e => setEditandoPer(p => ({...p, fecha_fin:e.target.value}))} style={inputStyle}
                        onFocus={e => e.target.style.borderColor=col} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
                    </Campo>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SECCION>

      {/* ── IDENTIDAD ── */}
      <SECCION titulo="Identidad del Maestro" icono="👨‍🏫">
        <Campo label="Nombre del Maestro *" hint="Aparece en los reportes PDF">
          <input value={cfg.nombre_maestro||''} onChange={e => cambio('nombre_maestro', e.target.value)}
            placeholder="Ej: Prof. Juan Pérez" style={inputStyle}
            onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
        </Campo>
        <Campo label="Centro Educativo">
          <input value={cfg.centro_educativo||''} onChange={e => cambio('centro_educativo', e.target.value)}
            placeholder="Ej: Liceo Juan Pablo Duarte" style={inputStyle}
            onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
        </Campo>
      </SECCION>

      {/* ── CALIFICACIONES ── */}
      <SECCION titulo="Calificaciones" icono="📝">
        <Campo label="Nota mínima aprobatoria" hint="Estudiantes por debajo se marcan en rojo">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <input type="number" min="0" max="100" value={cfg.minimo_aprobatorio||'70'}
              onChange={e => cambio('minimo_aprobatorio', e.target.value)}
              style={{ ...inputStyle, width:100 }}
              onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
            <span style={{ fontSize:12, color:'#888' }}>puntos (0–100)</span>
          </div>
        </Campo>
        <div style={{ fontSize:12, fontWeight:700, color:'#444', marginBottom:4 }}>Pesos del promedio final</div>
        <div style={{ fontSize:11, color:'#AAB4C4', marginBottom:12 }}>Deben sumar exactamente 100</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:8 }}>
          {[
            { label:'📋 Actividades (%)',   key:'actividades_peso' },
            { label:'🙋 Participación (%)', key:'participacion_peso' },
            { label:'✅ Asistencia (%)',    key:'asistencia_peso' },
            { label:'⭐ Conducta (%)',      key:'conducta_peso' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#555', marginBottom:5 }}>{f.label}</label>
              <input type="number" min="0" max="100" value={cfg[f.key]||'0'}
                onChange={e => cambio(f.key, e.target.value)}
                style={{ ...inputStyle, borderColor:pesoError?'#FFAAAA':'#DDE3ED' }}
                onFocus={e => e.target.style.borderColor='#2563A8'}
                onBlur={e => e.target.style.borderColor=pesoError?'#FFAAAA':'#DDE3ED'} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:suma===100?'#D6EEE0':'#FDDFDF', borderRadius:8, border:`1px solid ${suma===100?'#88D4A8':'#FFAAAA'}`, fontSize:12, fontWeight:700, color:sumaColor }}>
          <span>{suma===100?'✅':'⚠️'}</span>
          <span>Total: {suma}/100 {suma===100?'— Correcto':'— Deben sumar 100'}</span>
        </div>
      </SECCION>

      {/* ── SEMÁFORO ── */}
      <SECCION titulo="Semáforo de Notas" icono="🚦">
        <div style={{ display:'flex', gap:24, marginBottom:8 }}>
          <Campo label="🟢 Verde desde">
            <input type="number" min="0" max="100" value={cfg.semaforo_verde||'80'}
              onChange={e => cambio('semaforo_verde', e.target.value)}
              style={{ ...inputStyle, width:90 }}
              onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
          </Campo>
          <Campo label="🟡 Amarillo desde">
            <input type="number" min="0" max="100" value={cfg.semaforo_amarillo||'60'}
              onChange={e => cambio('semaforo_amarillo', e.target.value)}
              style={{ ...inputStyle, width:90 }}
              onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
          </Campo>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[
            { color:'#D6EEE0', border:'#88D4A8', text:'#1A6B3A', label:`🟢 ≥ ${cfg.semaforo_verde||80}` },
            { color:'#FFF8D6', border:'#FFD977', text:'#7A5C00', label:`🟡 ${cfg.semaforo_amarillo||60}–${(cfg.semaforo_verde||80)-1}` },
            { color:'#FDDFDF', border:'#FFAAAA', text:'#B71C1C', label:`🔴 < ${cfg.semaforo_amarillo||60}` },
          ].map(s => (
            <div key={s.label} style={{ flex:1, padding:'8px 12px', background:s.color, border:`1px solid ${s.border}`, borderRadius:8, fontSize:12, fontWeight:600, color:s.text, textAlign:'center' }}>
              {s.label}
            </div>
          ))}
        </div>
      </SECCION>

      <div style={{ display:'flex', justifyContent:'flex-end', paddingBottom:32 }}>
        <button onClick={guardar} disabled={guardando} style={{ padding:'11px 32px', background:guardando?'#7A8FA8':'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:guardando?'default':'pointer', boxShadow:'0 4px 16px #1B3A6B44' }}>
          {guardando?'⏳ Guardando...':'💾 Guardar configuración'}
        </button>
      </div>

      {/* ── MODAL NUEVO AÑO ── */}
      {modalAnioT && (
        <div className="modal-backdrop" data-closing={modalAnioT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget) setModalAnio(false) }}>
          <div className="modal-content" data-closing={modalAnioT.closing} style={{ background:'#fff', borderRadius:14, padding:32, width:480, boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:18 }}>🆕 Nuevo Año Escolar</h2>
            <p style={{ color:'#888', fontSize:12, marginBottom:24 }}>Se crean los 4 períodos automáticamente. Datos actuales quedan guardados.</p>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:6 }}>Nombre del año *</label>
              <input value={formAnio.nombre} onChange={e => setFormAnio(p => ({...p, nombre:e.target.value}))}
                placeholder="Ej: 2026-2027" style={inputStyle}
                onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:6 }}>Fecha inicio</label>
                <input type="date" value={formAnio.fecha_inicio} onChange={e => setFormAnio(p => ({...p, fecha_inicio:e.target.value}))} style={inputStyle}
                  onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#444', marginBottom:6 }}>Fecha fin</label>
                <input type="date" value={formAnio.fecha_fin} onChange={e => setFormAnio(p => ({...p, fecha_fin:e.target.value}))} style={inputStyle}
                  onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
              </div>
            </div>
            <div style={{ background:'#FFF8D6', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:12, color:'#92400E' }}>
              ⚠️ Cierra y abre la app después de crear el año para activarlo.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setModalAnio(false)} style={{ padding:'10px 22px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}>Cancelar</button>
              <button onClick={crearNuevoAnio} disabled={creandoAnio||!formAnio.nombre.trim()} style={{ padding:'10px 26px', background:creandoAnio||!formAnio.nombre.trim()?'#AAA':'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:creandoAnio||!formAnio.nombre.trim()?'default':'pointer' }}>
                {creandoAnio ? '⏳ Creando...' : '🆕 Crear año'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TÍTULOS POR GRADO ── */}
      {matTitulosT && (
        <div className="modal-backdrop" data-closing={matTitulosT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600 }}
          onClick={e => { if (e.target===e.currentTarget) { setMatTitulos(null); setGradoSel(null) } }}>
          <div className="modal-content" data-closing={matTitulosT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:560, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ width:14, height:14, borderRadius:'50%', background:matTitulosT.value.color }} />
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:'#1B3A6B' }}>Títulos por grado — {matTitulosT.value.nombre}</div>
                <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Cada grado puede tener títulos diferentes en cada período</div>
              </div>
              <div style={{ flex:1 }} />
              <button onClick={() => { setMatTitulos(null); setGradoSel(null) }} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#AAA' }}>✕</button>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#AAB4C4', letterSpacing:1.5, marginBottom:8 }}>SELECCIONA EL GRADO</div>
              {grados.length === 0 ? (
                <div style={{ color:'#AAA', fontSize:13, fontStyle:'italic' }}>No hay cursos con grado asignado. Ve a Cursos y asigna el grado.</div>
              ) : (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {grados.map(g => (
                    <button key={g} onClick={() => seleccionarGrado(g)} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', background: gradoSel===g ? matTitulosT.value.color : '#EEF2F7', color: gradoSel===g ? '#fff' : '#555', border: gradoSel===g ? '2px solid '+matTitulosT.value.color : '2px solid #DDE3ED' }}>
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {gradoSel && (
              <div style={{ flex:1, overflowY:'auto' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#AAB4C4', letterSpacing:1.5, marginBottom:12 }}>
                  TÍTULOS PARA {gradoSel} — {matTitulosT.value.nombre}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                  {periodos.map((per, i) => {
                    const col = COLS_PER[i] || '#2563A8'
                    return (
                      <div key={per.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr', gap:12, alignItems:'center' }}>
                        <div style={{ fontWeight:800, fontSize:13, color:col, textAlign:'center', background:col+'15', padding:'7px 0', borderRadius:8 }}>{per.nombre}</div>
                        <input
                          value={titulosGrado[per.numero_orden] || ''}
                          onChange={e => setTitulosGrado(prev => ({...prev, [per.numero_orden]: e.target.value}))}
                          placeholder={per.titulo || 'Título para '+gradoSel+'...'}
                          style={inputStyle}
                          onFocus={e => e.target.style.borderColor=col}
                          onBlur={e => e.target.style.borderColor='#DDE3ED'}
                        />
                      </div>
                    )
                  })}
                </div>
                <div style={{ background:'#F0F7FF', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#2563A8', marginBottom:16 }}>
                  💡 Si un campo está vacío se usa el título genérico del período.
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
                  <button onClick={() => setGradoSel(null)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
                  <button onClick={guardarTitulosGrado} disabled={guardandoTit} style={{ padding:'9px 24px', background:guardandoTit?'#AAA':matTitulosT.value.color, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:guardandoTit?'default':'pointer' }}>
                    {guardandoTit ? '⏳ Guardando...' : '💾 Guardar títulos'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINAR MATERIA ── */}
      {confirmElimT && (
        <div className="modal-backdrop" data-closing={confirmElimT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:700 }}>
          <div className="modal-content" data-closing={confirmElimT.closing} style={{ background:'#fff', borderRadius:14, padding:32, width:420, boxShadow:'0 16px 48px #0004', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
            <h3 style={{ color:'#1B3A6B', marginBottom:8, fontSize:16 }}>¿Eliminar esta materia?</h3>
            <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', marginBottom:12 }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:confirmElimT.value.color }} />
              <span style={{ fontWeight:700, color:confirmElimT.value.color, fontSize:15 }}>{confirmElimT.value.nombre}</span>
            </div>
            <p style={{ color:'#555', fontSize:13, marginBottom:6 }}>Se eliminará la materia y todos sus títulos por grado.</p>
            <p style={{ color:'#AAB4C4', fontSize:12, marginBottom:24 }}>Los cursos, temas, asistencias y calificaciones quedan intactos.</p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setConfirmElim(null)} style={{ padding:'10px 28px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}>Cancelar</button>
              <button onClick={() => eliminarMateria(confirmElimT.value)} style={{ padding:'10px 28px', background:'#B71C1C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>🗑️ Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:toast.color, color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px #0003', zIndex:999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}