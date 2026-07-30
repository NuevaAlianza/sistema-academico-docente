import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModalTransition } from '../hooks/useModalTransition'

const COLORES = ['#2563A8','#00695C','#5C2D91','#C84B00','#1A6B3A','#B71C1C','#7A5C00','#01579B']
const VACIO = { nombre:'', grado:'', seccion:'', descripcion:'', color:'#2563A8' }

export default function Cursos({ anio }) {
  const [cursos,   setCursos]   = useState([])
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState(VACIO)
  const [editId,   setEditId]   = useState(null)
  const [toast,    setToast]    = useState(null)
  const [confirm,  setConfirm]  = useState(null) // { nombre, id }
  const nav = useNavigate()
  const modalT   = useModalTransition(modal)
  const confirmT = useModalTransition(confirm)

  useEffect(() => { if (anio) cargar() }, [anio])

  async function cargar() {
    const c = await window.api.invoke('get-cursos', anio.id)
    setCursos(c)
  }

  function toast2(msg) { setToast(msg); setTimeout(() => setToast(null), 2000) }
  function abrirNuevo()   { setForm(VACIO); setEditId(null); setModal(true) }
  function abrirEditar(c) { setForm({ nombre:c.nombre, grado:c.grado, seccion:c.seccion, descripcion:c.descripcion, color:c.color }); setEditId(c.id); setModal(true) }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre del curso es obligatorio.'); return }
    if (!anio || !anio.id)   { alert('No hay un año escolar activo. Recarga la aplicación.'); return }
    const duplicado = cursos.some(c => c.nombre.trim() === form.nombre.trim() && c.id !== editId)
    if (duplicado) { alert('Ya existe un curso activo con ese nombre exacto. Elegí un nombre distinto.'); return }
    if (editId) {
      await window.api.invoke('update-curso', editId, { ...form, anioId: anio.id })
      toast2('✅ Curso actualizado')
    } else {
      await window.api.invoke('create-curso', { ...form, anioId: anio.id })
      toast2('✅ Curso creado')
    }
    setModal(false)
    cargar()
  }

  // Abre el modal de confirmación en vez de window.confirm
  function pedirEliminar(id, nombre) {
    setConfirm({ id, nombre })
  }

  async function confirmarEliminar() {
    await window.api.invoke('delete-curso', confirm.id)
    setConfirm(null)
    toast2('📦 Curso archivado')
    cargar()
  }

  const cambio = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, color:'#1B3A6B' }}>📚 Cursos / Materias</h1>
        <div style={{ flex:1 }} />
        <button onClick={abrirNuevo} style={{ padding:'9px 20px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
          + Nuevo Curso
        </button>
      </div>

      {cursos.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📚</div>
          <h3 style={{ color:'#1B3A6B', marginBottom:8 }}>Aún no tienes cursos</h3>
          <p style={{ color:'#888', fontSize:13, marginBottom:20 }}>Crea tu primer curso para comenzar</p>
          <button onClick={abrirNuevo} style={{ padding:'10px 24px', background:'#2563A8', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            + Crear primer curso
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {cursos.map(c => (
            <div key={c.id} style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', borderLeft:'4px solid '+c.color }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:c.color+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:20 }}>📚</span>
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#1B3A6B' }}>{c.nombre}</div>
                  <div style={{ fontSize:12, color:'#888' }}>
                    {c.grado && 'Grado: '+c.grado}
                    {c.grado && c.seccion && '  ·  '}
                    {c.seccion && 'Sección: '+c.seccion}
                  </div>
                </div>
              </div>
              {c.descripcion && <p style={{ fontSize:12, color:'#666', marginBottom:12 }}>{c.descripcion}</p>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => nav('/curso/'+c.id, { state:{ curso:c } })} style={{ flex:1, padding:'7px 0', background:c.color, border:'none', borderRadius:7, fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer' }}>
                  Abrir →
                </button>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button onClick={() => abrirEditar(c)} style={{ flex:1, padding:'6px 0', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:7, fontSize:11, fontWeight:600, color:'#1B3A6B', cursor:'pointer' }}>
                  ✏️ Editar
                </button>
                <button onClick={() => pedirEliminar(c.id, c.nombre)} style={{ padding:'6px 12px', background:'#FDDFDF', border:'1px solid #FFAAAA', borderRadius:7, fontSize:11, color:'#B71C1C', cursor:'pointer', fontWeight:600 }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {modalT && (
        <div className="modal-backdrop" data-closing={modalT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal-content" data-closing={modalT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:460, boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:20, fontSize:17 }}>{editId ? '✏️ Editar Curso' : '+ Nuevo Curso'}</h2>
            {[
              { label:'Nombre del curso *', key:'nombre',      placeholder:'Ej: FIHR 2do B' },
              { label:'Grado',              key:'grado',       placeholder:'Ej: 2do' },
              { label:'Sección',            key:'seccion',     placeholder:'Ej: B' },
              { label:'Descripción',        key:'descripcion', placeholder:'Opcional' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:5 }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => cambio(f.key, e.target.value)} placeholder={f.placeholder}
                  style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none' }}
                  onFocus={e => e.target.style.borderColor = '#2563A8'}
                  onBlur={e => e.target.style.borderColor = '#DDE3ED'} />
              </div>
            ))}
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:8 }}>Color</label>
              <div style={{ display:'flex', gap:8 }}>
                {COLORES.map(col => (
                  <div key={col} onClick={() => cambio('color', col)} style={{ width:28, height:28, borderRadius:'50%', background:col, cursor:'pointer', border: form.color === col ? '3px solid #1B3A6B' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={guardar} style={{ padding:'9px 24px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>{editId ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      {confirmT && (
        <div className="modal-backdrop" data-closing={confirmT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600 }}>
          <div className="modal-content" data-closing={confirmT.closing} style={{ background:'#fff', borderRadius:14, padding:32, width:380, boxShadow:'0 16px 48px #0004', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
            <h3 style={{ color:'#1B3A6B', marginBottom:8, fontSize:16 }}>¿Archivar este curso?</h3>
            <p style={{ color:'#555', fontSize:13, marginBottom:6 }}>
              Vas a archivar <strong style={{ color:'#B71C1C' }}>{confirmT.value.nombre}</strong>
            </p>
            <p style={{ color:'#AAB4C4', fontSize:12, marginBottom:24 }}>
              El curso no se elimina permanentemente — queda archivado y puedes recuperarlo si es necesario.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button
                onClick={() => setConfirm(null)}
                style={{ padding:'10px 28px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                style={{ padding:'10px 28px', background:'#B71C1C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}
              >
                📦 Sí, archivar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#1A6B3A', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px #0003', zIndex:999 }}>{toast}</div>
      )}
    </div>
  )
}