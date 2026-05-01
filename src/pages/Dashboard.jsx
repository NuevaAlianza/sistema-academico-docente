import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard({ anio, materia }) {
  const materiaId = materia?.id || null
  const [stats,         setStats]         = useState(null)
  const [riesgo,        setRiesgo]        = useState([])
  const [semaforo,      setSemaforo]      = useState([])
  const [periodos,      setPeriodos]      = useState([])
  const [periodoSel,    setPeriodoSel]    = useState(null)
  const [cfg,           setCfg]           = useState({})
  const [cargando,      setCargando]      = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    if (!anio) return
    Promise.all([
      window.api.invoke('get-stats', anio.id),
      window.api.invoke('get-config'),
      window.api.invoke('get-periodos', anio.id),
    ]).then(([s, c, ps]) => {
      setStats(s); setCfg(c); setPeriodos(ps)
      const activo = ps.find(p => p.estado === 'abierto') || ps[ps.length - 1]
      if (activo) setPeriodoSel(activo)
    })
  }, [anio, materia])

  useEffect(() => {
    if (!anio || !periodoSel) return
    setCargando(true)
    Promise.all([
      window.api.invoke('get-estudiantes-riesgo', anio.id, periodoSel.id),
      window.api.invoke('get-semaforo-cursos', anio.id, periodoSel.id),
    ]).then(([r, s]) => {
      setRiesgo(r); setSemaforo(s); setCargando(false)
    })
  }, [anio, periodoSel, materia])

  const minimo      = Number(cfg.minimo_aprobatorio || 70)
  const semVerde    = Number(cfg.semaforo_verde      || 80)
  const semAmarillo = Number(cfg.semaforo_amarillo   || 60)
  const color  = materia?.color || '#1B3A6B'
  const enRiesgo = riesgo.length

  function semC(n) { return n===null?'#888':n>=semVerde?'#1A6B3A':n>=semAmarillo?'#C84B00':'#B71C1C' }
  function semB(n) { return n===null?'#F4F4F4':n>=semVerde?'#D6EEE0':n>=semAmarillo?'#FDECD7':'#FDDFDF' }

  const Pill = ({ n }) => n!==null
    ? <span style={{ background:semB(n), color:semC(n), padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:800 }}>{n}</span>
    : <span style={{ color:'#CCC', fontSize:12 }}>—</span>

  const selectorPeriodo = (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
      {periodos.map(p => (
        <button key={p.id} onClick={() => setPeriodoSel(p)} style={{
          padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
          border:`2px solid ${periodoSel?.id===p.id?'#fff':'rgba(255,255,255,0.35)'}`,
          background: periodoSel?.id===p.id?'#fff':'transparent',
          color:      periodoSel?.id===p.id?'#1B3A6B':'#fff',
        }}>{p.nombre}</button>
      ))}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* HEADER */}
      <div>
        <h1 style={{ fontSize:20, color:'#1B3A6B', margin:0 }}>📊 Dashboard</h1>
        {anio && <p style={{ color:'#888', fontSize:13, margin:'4px 0 0' }}>{anio.nombre}{materia ? ` · ${materia.nombre}` : ''}</p>}
      </div>

      {/* STATS — fila compacta */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { icon:'📚', label:'Cursos',     val:stats?.cursos,           color:'#2563A8', to:'/cursos'     },
          { icon:'👨‍🎓', label:'Estudiantes', val:stats?.estudiantes,     color:'#00695C', to:'/estudiantes'},
          { icon:'✅', label:'Realizados', val:stats?.temas_realizados, color:'#1A6B3A', to:'/temario'    },
          { icon:'⬜', label:'Pendientes', val:stats?.temas_pendientes, color:'#C84B00', to:'/temario'    },
        ].map(s => (
          <div key={s.label} onClick={() => nav(s.to)} style={{
            background:'#fff', borderRadius:10, padding:'14px 18px',
            cursor:'pointer', border:'1px solid #DDE3ED', borderLeft:`4px solid ${s.color}`,
            display:'flex', alignItems:'center', gap:12, transition:'all .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 14px #0002'}
            onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:24, fontWeight:900, color:s.color, lineHeight:1 }}>{s.val ?? '—'}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* SEMÁFORO + RIESGO en dos columnas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* ── SEMÁFORO ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
          <div style={{ background:`linear-gradient(135deg,#1B3A6B,#2563A8)`, padding:'12px 18px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:14 }}>🚦 Semáforo de notas</div>
              <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, marginTop:1 }}>{periodoSel?.nombre}</div>
            </div>
            {selectorPeriodo}
          </div>

          {cargando ? (
            <div style={{ padding:24, textAlign:'center', color:'#AAA', fontSize:13 }}>⏳ Calculando...</div>
          ) : semaforo.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:'#AAA', fontSize:13 }}>Sin calificaciones en {periodoSel?.nombre}</div>
          ) : (
            <div style={{ maxHeight:340, overflowY:'auto' }}>
              {semaforo.map((curso, idx) => {
                const total   = curso.verde + curso.amarillo + curso.rojo + curso.sinNota
                const conNota = curso.verde + curso.amarillo + curso.rojo
                const pV = conNota>0?Math.round(curso.verde/conNota*100):0
                const pA = conNota>0?Math.round(curso.amarillo/conNota*100):0
                const pR = conNota>0?Math.round(curso.rojo/conNota*100):0
                return (
                  <div key={curso.id} onClick={() => nav('/calificaciones')} style={{
                    padding:'10px 16px', cursor:'pointer', borderBottom:idx<semaforo.length-1?'1px solid #F0F4FA':'none',
                    borderLeft:`3px solid ${curso.color}`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background='#F8FAFD'}
                    onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:'#1B3A6B' }}>{curso.nombre}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {curso.promedio!==null && <Pill n={curso.promedio}/>}
                        <span style={{ fontSize:11, color:'#AAB4C4' }}>{total} est.</span>
                      </div>
                    </div>
                    {conNota > 0 ? (
                      <div style={{ display:'flex', borderRadius:4, overflow:'hidden', height:8 }}>
                        {pV>0 && <div style={{ width:pV+'%', background:'#1A6B3A' }}/>}
                        {pA>0 && <div style={{ width:pA+'%', background:'#C84B00' }}/>}
                        {pR>0 && <div style={{ width:pR+'%', background:'#B71C1C' }}/>}
                      </div>
                    ) : (
                      <div style={{ fontSize:11, color:'#CCC' }}>Sin notas aún</div>
                    )}
                    {conNota > 0 && (
                      <div style={{ display:'flex', gap:10, marginTop:5, fontSize:11 }}>
                        {[[curso.verde,'#1A6B3A','Verde'],[curso.amarillo,'#C84B00','Amarillo'],[curso.rojo,'#B71C1C','Rojo']].map(([v,c,l]) =>
                          v>0 ? <span key={l} style={{ color:c, fontWeight:700 }}>{v} {l}</span> : null
                        )}
                        {curso.sinNota>0 && <span style={{ color:'#AAA' }}>{curso.sinNota} sin nota</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIESGO ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#B71C1C,#C84B00)', padding:'12px 18px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:14 }}>⚠️ Estudiantes en riesgo</div>
              <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, marginTop:1 }}>Nota &lt;{minimo} o asistencia &lt;80%</div>
            </div>
            {selectorPeriodo}
            {enRiesgo > 0 && (
              <span style={{ background:'rgba(255,255,255,0.2)', color:'#fff', padding:'3px 10px', borderRadius:20, fontSize:13, fontWeight:800 }}>
                {enRiesgo}
              </span>
            )}
          </div>

          {cargando ? (
            <div style={{ padding:24, textAlign:'center', color:'#AAA', fontSize:13 }}>⏳ Calculando...</div>
          ) : enRiesgo === 0 ? (
            <div style={{ padding:32, textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
              <div style={{ fontWeight:700, color:'#1A6B3A', fontSize:14 }}>¡Todos bien!</div>
              <div style={{ color:'#888', fontSize:12, marginTop:4 }}>Ningún estudiante en riesgo en {periodoSel?.nombre}</div>
            </div>
          ) : (
            <div style={{ maxHeight:340, overflowY:'auto' }}>
              {riesgo.map((e, idx) => {
                const motivos = []
                if (e.promedio!==null && e.promedio<minimo)         motivos.push({ l:'nota baja', c:'#B71C1C' })
                if (e.pct_asistencia!==null && e.pct_asistencia<80) motivos.push({ l:'asistencia', c:'#C84B00' })
                return (
                  <div key={idx} style={{
                    padding:'10px 16px', borderBottom:idx<riesgo.length-1?'1px solid #F0F4FA':'none',
                    background:idx%2===0?'#fff':'#FAFBFD',
                    display:'flex', alignItems:'center', gap:10,
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'#1B3A6B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.nombre_completo}</div>
                      <div style={{ fontSize:11, color:'#888', marginTop:2, display:'flex', gap:5 }}>
                        <span style={{ background:'#EEF2F7', padding:'1px 6px', borderRadius:6, fontWeight:600 }}>{e.curso_nombre}</span>
                        {motivos.map(m => <span key={m.l} style={{ background:'#FDDFDF', color:m.c, padding:'1px 6px', borderRadius:6, fontWeight:700 }}>{m.l}</span>)}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <Pill n={e.promedio}/>
                      {e.pct_asistencia!==null && (
                        <span style={{ background:semB(e.pct_asistencia), color:semC(e.pct_asistencia), padding:'2px 8px', borderRadius:20, fontSize:12, fontWeight:800 }}>
                          {e.pct_asistencia}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
        {[
          { icon:'🗓️', label:'Horario',     to:'/horario',       bg:'#D6E4F7', c:'#2563A8' },
          { icon:'📋', label:'Temario',      to:'/temario',       bg:'#D0EDE8', c:'#00695C' },
          { icon:'✅', label:'Asistencia',   to:'/asistencia',    bg:'#D6EEE0', c:'#1A6B3A' },
          { icon:'📝', label:'Calificaciones', to:'/calificaciones', bg:'#FEF3C7', c:'#92400E' },
          { icon:'👨‍🎓', label:'Estudiantes', to:'/estudiantes',   bg:'#EDE0F7', c:'#5C2D91' },
          { icon:'⚙️', label:'Config',       to:'/configuracion', bg:'#EEF2F7', c:'#1B3A6B' },
        ].map(a => (
          <div key={a.to} onClick={() => nav(a.to)} style={{
            background:a.bg, borderRadius:10, padding:'12px 10px', cursor:'pointer',
            textAlign:'center', border:`1px solid ${a.c}20`, transition:'all .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.filter='brightness(0.93)'}
            onMouseLeave={e => e.currentTarget.style.filter='none'}>
            <div style={{ fontSize:22, marginBottom:4 }}>{a.icon}</div>
            <div style={{ fontSize:11, fontWeight:700, color:a.c }}>{a.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}