import React from 'react'

export const FASES = [
  { key:'I', label:'Inicio',     bg:'#E0F7FA', fg:'#006064' },
  { key:'D', label:'Desarrollo', bg:'#E8F5E9', fg:'#1B5E20' },
  { key:'C', label:'Cierre',     bg:'#FFF3E0', fg:'#E65100' },
]
const FASE_INFO = Object.fromEntries(FASES.map(f => [f.key, f]))

export const fmtPts   = n => (n > 0 ? '+' : '') + n
export const colorPts = n => n > 0 ? '#065F46' : n < 0 ? '#9B1C1C' : '#AAB4C4'

// items: [{ fecha, puntos, motivo, fase, tema_id, tema }]
// resaltarTemaIds: temas de la actividad desde la que se abre (Calificaciones); vacío = sin resaltado.
export default function HistorialParticipacion({ nombre, subtitulo, total, items, resaltarTemaIds = [], onClose }) {
  const resaltar = new Set(resaltarTemaIds)
  return (
    <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'#0004', display:'flex', alignItems:'center', justifyContent:'center', zIndex:900 }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ background:'#fff', borderRadius:14, padding:24, width:460, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
        <div style={{ fontWeight:700, color:'#1B3A6B', fontSize:15, marginBottom:2 }}>Participación: {nombre}</div>
        <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
          {subtitulo} · {items.length} movimiento(s) · total <strong style={{ color:colorPts(total) }}>{fmtPts(total)}</strong>
          {resaltar.size > 0 && <span style={{ display:'block', marginTop:2 }}><span style={{ display:'inline-block', width:10, height:10, background:'#FFF8DC', border:'1px solid #F0D98C', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />de los temas de esta actividad</span>}
        </div>
        <div style={{ overflowY:'auto', border:'1px solid #E8EDF5', borderRadius:8 }}>
          {items.length === 0
            ? <div style={{ padding:20, textAlign:'center', color:'#AAA', fontStyle:'italic', fontSize:13 }}>Sin movimientos en este período.</div>
            : items.map((h, i) => {
              const fase = FASE_INFO[h.fase]
              const marcado = resaltar.has(h.tema_id)
              return (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'84px 44px 1fr', gap:8, padding:'8px 12px', alignItems:'baseline', borderBottom:i<items.length-1?'1px solid #F0F4FA':'none', background: marcado ? '#FFF8DC' : i%2===0?'#fff':'#FAFBFD' }}>
                  <span style={{ fontSize:12, color:'#888' }}>{h.fecha}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:colorPts(h.puntos) }}>{fmtPts(h.puntos)}</span>
                  <span style={{ fontSize:12, color:'#555' }}>
                    {h.motivo || <span style={{ color:'#CCC' }}>sin motivo</span>}
                    {(h.tema || fase) && (
                      <span style={{ display:'block', fontSize:11, color:'#AAB4C4' }}>
                        {h.tema && <>Tema: {h.tema}</>}
                        {fase && <span style={{ marginLeft:h.tema?6:0, padding:'0 6px', borderRadius:6, background:fase.bg, color:fase.fg, fontWeight:700 }}>{fase.label}</span>}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
          <button onClick={onClose} style={{ padding:'8px 18px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
