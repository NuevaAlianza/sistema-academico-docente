import React, { useState, useEffect } from 'react'

const DIAS = ['Lunes','Martes','Miercoles','Jueves','Viernes']
const DIAS_DISPLAY = {
  Lunes:     'Lunes',
  Martes:    'Martes',
  Miercoles: 'Miércoles',
  Jueves:    'Jueves',
  Viernes:   'Viernes',
}

const BLOQUES = [
  { id:1, num:'1ra', inicio:'8:15',  fin:'9:00',  tipo:'clase'    },
  { id:2, num:'2da', inicio:'9:00',  fin:'9:45',  tipo:'clase'    },
  { id:3, num:'3ra', inicio:'9:45',  fin:'10:30', tipo:'clase'    },
  { id:null,         inicio:'10:30', fin:'11:00', tipo:'recreo',  label:'🟠 Recreo — 30 min' },
  { id:4, num:'4ta', inicio:'11:00', fin:'11:45', tipo:'clase'    },
  { id:5, num:'5ta', inicio:'11:45', fin:'12:30', tipo:'clase'    },
  { id:6, num:'6ta', inicio:'12:30', fin:'1:15',  tipo:'clase'    },
  { id:null,         inicio:'1:15',  fin:'2:30',  tipo:'almuerzo',label:'🍽️ Almuerzo + Recreo — 1h 15min' },
  { id:7, num:'7ma', inicio:'2:30',  fin:'3:15',  tipo:'clase'    },
  { id:8, num:'8va', inicio:'3:15',  fin:'4:00',  tipo:'clase'    },
]

export default function Horario({ anio, materia, materias }) {
  const materiaId = materia?.id || null
  const [cursos,   setCursos]   = useState([])
  const [horario,  setHorario]  = useState({})
  const [editando, setEditando] = useState(null)
  const [toast,    setToast]    = useState(null)

  useEffect(() => { if (anio) cargarDatos() }, [anio, materia])

  async function cargarDatos() {
    const [c, h] = await Promise.all([
      window.api.invoke('get-cursos',  anio.id),
      window.api.invoke('get-horario', anio.id),
    ])
    setCursos(c)
    // Build materia lookup from materias array
    const matMap = {}
    if (materias) materias.forEach(m => { matMap[m.id] = m })
    const mapa = {}
    h.forEach(a => {
      mapa[a.dia_semana + '-' + a.bloque_id] = {
        cursoId:    a.curso_id,
        nombre:     a.curso_nombre,
        color:      a.curso_color,
        materiaId:  a.materia_id,
        materiaColor: a.materia_id && matMap[a.materia_id] ? matMap[a.materia_id].color : null,
        materiaNombre: a.materia_id && matMap[a.materia_id] ? matMap[a.materia_id].nombre : null,
      }
    })
    setHorario(mapa)
  }

  function toast2(msg) { setToast(msg); setTimeout(() => setToast(null), 2200) }

  async function asignar(dia, bloqueId, cursoId) {
    if (cursoId === null) {
      await window.api.invoke('del-horario-celda', { anioId:anio.id, dia, bloqueId })
      setHorario(prev => { const n = {...prev}; delete n[dia+'-'+bloqueId]; return n })
      toast2('Bloque liberado')
    } else {
      const curso = cursos.find(c => c.id === cursoId)
      await window.api.invoke('set-horario-celda', { anioId:anio.id, cursoId, dia, bloqueId, materiaId })
      setHorario(prev => ({ ...prev, [dia+'-'+bloqueId]: {
        cursoId,
        nombre: curso.nombre,
        color:  curso.color,
        materiaId,
        materiaColor:   materia?.color || null,
        materiaNombre:  materia?.nombre || null,
      }}))

      toast2('✅ ' + curso.nombre + ' asignado')
    }
    setEditando(null)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <h1 style={{ fontSize:20, color:'#1B3A6B' }}>🗓️ Horario Semanal</h1>
        <span style={{ background:'#D6E4F7', color:'#2563A8', padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:600 }}>
          Secundaria · 8:15 AM → 4:00 PM · 8 clases de 45 min
        </span>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:12, color:'#888' }}>💡 Clic en cualquier celda para asignar un curso</span>
      </div>

      {cursos.length === 0 && (
        <div style={{ background:'#FFF8D6', border:'1px solid #D4B820', borderRadius:10, padding:'14px 20px', marginBottom:16, color:'#7A5C00', fontSize:13 }}>
          ⚠️ Primero crea cursos en la sección <strong>Cursos</strong> para poder asignarlos al horario.
        </div>
      )}

      {/* Encabezado con overflow hidden para mantener border-radius */}
      <div style={{ borderRadius:'12px 12px 0 0', border:'1px solid #DDE3ED', borderBottom:'none', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'130px repeat(5, 1fr)', background:'#1B3A6B' }}>
          <div style={{ padding:'10px 16px', color:'#7A9FC8', fontSize:12, fontWeight:600 }}>HORA</div>
          {DIAS.map(d => (
            <div key={d} style={{ padding:'10px 0', color:'#fff', fontSize:13, fontWeight:700, textAlign:'center' }}>
              {DIAS_DISPLAY[d]}
            </div>
          ))}
        </div>
      </div>

      {/* Cuerpo SIN overflow:hidden — los dropdowns no se cortan */}
      <div style={{ borderRadius:'0 0 12px 12px', border:'1px solid #DDE3ED', borderTop:'none', background:'#fff', boxShadow:'0 2px 12px #0001' }}>
        {BLOQUES.map((bloque, idx) => {
          if (bloque.tipo !== 'clase') {
            const bg    = bloque.tipo === 'almuerzo' ? '#FFF8D6' : '#F0F7F0'
            const color = bloque.tipo === 'almuerzo' ? '#7A5C00' : '#1A6B3A'
            return (
              <div key={idx} style={{ display:'grid', gridTemplateColumns:'130px 1fr', background:bg, borderTop:'1px solid #E8EDF5' }}>
                <div style={{ padding:'8px 16px', color, fontWeight:700, fontSize:12, display:'flex', alignItems:'center' }}>{bloque.label}</div>
                <div style={{ padding:'8px 16px', color, fontSize:12, display:'flex', alignItems:'center' }}>{bloque.inicio} – {bloque.fin}</div>
              </div>
            )
          }

          // Filas desde la 6ta hora hacia abajo abren el dropdown hacia ARRIBA
          // idx: 0=1ra, 1=2da, 2=3ra, 3=recreo, 4=4ta, 5=5ta, 6=6ta, 7=almuerzo, 8=7ma, 9=8va
          const abreArriba = idx >= 6

          return (
            <div key={idx} style={{ display:'grid', gridTemplateColumns:'130px repeat(5, 1fr)', borderTop:'1px solid #E8EDF5', background: idx % 2 === 0 ? '#fff' : '#FAFBFD' }}>
              <div style={{ padding:'8px 16px', display:'flex', flexDirection:'column', justifyContent:'center', borderRight:'1px solid #E8EDF5' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'#1B3A6B' }}>{bloque.num} hora</span>
                <span style={{ fontSize:11, color:'#999' }}>{bloque.inicio} – {bloque.fin}</span>
              </div>
              {DIAS.map(dia => {
                const k    = dia + '-' + bloque.id
                const asig = horario[k]
                const open = editando === k
                return (
                  <div key={dia} style={{ padding:5, position:'relative', borderRight:'1px solid #E8EDF5' }}>
                    {!open ? (
                      <div onClick={() => setEditando(k)} style={{
                        minHeight:46, borderRadius:8, display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center', cursor:'pointer',
                        background: asig ? asig.color+'18' : 'transparent',
                        border: asig ? '1.5px solid '+asig.color+'50' : '1.5px dashed #D0D8E8',
                        transition:'all .12s', padding:'5px 4px',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = asig ? asig.color+'28' : '#F0F4FA'}
                        onMouseLeave={e => e.currentTarget.style.background = asig ? asig.color+'18' : 'transparent'}
                      >
                        {asig ? (
                          <>
                            <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:2 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:asig.color }} />
                              {asig.materiaColor && <div style={{ width:6, height:6, borderRadius:'50%', background:asig.materiaColor }} />}
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:asig.color, textAlign:'center', lineHeight:1.2 }}>{asig.nombre}</span>
                            {asig.materiaNombre && <span style={{ fontSize:9, color:asig.materiaColor||'#888', fontWeight:600, textAlign:'center' }}>{asig.materiaNombre}</span>}
                          </>
                        ) : (
                          <span style={{ fontSize:18, color:'#D0D8E8' }}>+</span>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        position:'absolute',
                        left:2,
                        zIndex:200,
                        // Abre hacia arriba en filas bajas, hacia abajo en filas altas
                        ...(abreArriba
                          ? { bottom:'calc(100% + 2px)', top:'auto' }
                          : { top:2, bottom:'auto' }
                        ),
                        background:'#fff',
                        border:'1px solid #DDE3ED',
                        borderRadius:10,
                        boxShadow:'0 8px 24px #0003',
                        padding:10,
                        minWidth:180,
                        maxHeight:260,
                        overflowY:'auto',
                      }}>
                        <div style={{ fontSize:11, color:'#888', marginBottom:8, fontWeight:700, position:'sticky', top:0, background:'#fff', paddingBottom:4, borderBottom:'1px solid #F0F4FA' }}>
                          Asignar a {DIAS_DISPLAY[dia]}
                          {materia && <span style={{ marginLeft:6, background:materia.color+'20', color:materia.color, padding:'1px 7px', borderRadius:10, fontSize:10 }}>{materia.nombre}</span>}
                        </div>
                        {cursos.map(c => (
                          <div key={c.id} onClick={() => asignar(dia, bloque.id, c.id)} style={{
                            padding:'6px 9px', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'flex', alignItems:'center', gap:7, marginBottom:3,
                            background: (asig && asig.cursoId===c.id) ? c.color+'20' : 'transparent',
                            fontWeight: (asig && asig.cursoId===c.id) ? 700 : 400, color:c.color,
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = c.color+'18'}
                            onMouseLeave={e => e.currentTarget.style.background = (asig && asig.cursoId===c.id) ? c.color+'20' : 'transparent'}
                          >
                            <div style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }} />
                            {c.nombre}
                          </div>
                        ))}
                        {asig && (
                          <div onClick={() => asignar(dia, bloque.id, null)} style={{ padding:'6px 9px', borderRadius:7, cursor:'pointer', fontSize:12, color:'#B71C1C', marginTop:4, borderTop:'1px solid #EEE' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FDDFDF'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >🗑️ Quitar curso</div>
                        )}
                        <div onClick={() => setEditando(null)} style={{ padding:'5px 9px', borderRadius:7, cursor:'pointer', fontSize:11, color:'#888', marginTop:2 }}>✕ Cancelar</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:16, marginTop:12, alignItems:'center', flexWrap:'wrap' }}>
        {materias && materias.length > 0 && materias.map(m => (
          <div key={m.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:m.color }} />
            <span style={{ fontSize:12, color:m.color, fontWeight:700 }}>{m.nombre}</span>
          </div>
        ))}
        <span style={{ fontSize:12, color:'#CCC' }}>|</span>
        <span style={{ fontSize:12, color:'#888' }}>Cursos:</span>
        {cursos.map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:c.color }} />
            <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.nombre}</span>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#1A6B3A', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px #0003', zIndex:999 }}>{toast}</div>
      )}
    </div>
  )
}