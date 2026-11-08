import React, { useState } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'

// «Novedades de Portal-Ars»: compara los cursos de este año con la lista
// del portal (que se actualiza desde el SIGERD) y sugiere cambios. Nada
// se aplica hasta que el maestro marca y confirma.
const TIPOS = {
  agregar: { titulo: 'Nuevos para agregar',          color: '#166534', bg: '#F0FDF4', porDefecto: true,
             ayuda: 'Están en Portal-Ars y no en tu curso.' },
  numero:  { titulo: 'Cambian de número de lista',   color: '#1B3A6B', bg: '#EFF6FF', porDefecto: true,
             ayuda: 'Mismo estudiante y curso; la lista se corrió. Sus notas no se tocan.' },
  mover:   { titulo: 'Cambian de sección',           color: '#92400E', bg: '#FFFBEB', porDefecto: true,
             ayuda: 'Se agrega en el curso nuevo y queda como retirado en el anterior (sus notas viejas quedan ahí).' },
  salio:   { titulo: 'Pasaron a una sección que no tenés', color: '#6B7280', bg: '#F9FAFB', porDefecto: false,
             ayuda: 'Si lo marcás, queda como retirado en tu curso.' },
  no_esta: { titulo: 'No están en Portal-Ars',       color: '#6B7280', bg: '#F9FAFB', porDefecto: false,
             ayuda: 'Puede ser un retiro o un nombre muy distinto. Si lo marcás, queda como retirado.' },
}
const ORDEN = ['agregar', 'numero', 'mover', 'salio', 'no_esta']

function textoSugerencia(s) {
  const p = s.portal, l = s.local
  switch (s.tipo) {
    case 'agregar': return <><b>{p.nombre}</b> → {s.destinoCurso} N.º {p.numero}</>
    case 'numero':  return <><b>{l.nombre}</b> · {l.curso}: N.º {l.numero} → <b>N.º {p.numero}</b></>
    case 'mover':   return <><b>{l.nombre}</b>: {l.curso} N.º {l.numero} → <b>{s.destinoCurso} N.º {p.numero}</b></>
    case 'salio':   return <><b>{l.nombre}</b> ({l.curso}) → ahora en {p.grado} {p.seccion}</>
    case 'no_esta': return <><b>{l.nombre}</b> · {l.curso} N.º {l.numero}</>
    default: return null
  }
}

export default function NovedadesPortal({ anio, onAplicado }) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState(null)       // { sugerencias, iguales } | { error }
  const [marcadas, setMarcadas] = useState({})   // id → bool
  const [resultado, setResultado] = useState(null)
  const t = useModalTransition(abierto)

  async function buscar() {
    setAbierto(true); setCargando(true); setDatos(null); setResultado(null)
    try {
      const res = await window.api.invoke('novedades-portal-ars', anio.id)
      setDatos(res)
      if (res && res.ok) setMarcadas(res.marcadas || {})
    } catch (e) { setDatos({ error: e.message }) }
    setCargando(false)
  }

  async function aplicar() {
    const acciones = datos.sugerencias.filter(s => marcadas[s.id]).map(s => ({
      tipo: s.tipo,
      localId: s.local ? s.local.id : null,
      cursoId: s.tipo === 'numero' ? s.local.cursoId : s.destinoCursoId,
      numero: s.portal ? s.portal.numero : null,
      // Al moverlo se conserva el nombre como lo tenés escrito acá.
      nombre: s.tipo === 'mover' ? s.local.nombre : (s.portal ? s.portal.nombre : null),
    }))
    setCargando(true)
    const res = await window.api.invoke('aplicar-novedades-portal-ars', acciones)
    setCargando(false)
    setResultado(res)
    if (res && res.ok && onAplicado) onAplicado()
  }

  const nMarcadas = Object.values(marcadas).filter(Boolean).length

  return <>
    <button onClick={buscar} disabled={!anio}
      title="Compara tus cursos con la lista de Portal-Ars y te sugiere altas y cambios"
      style={{ width:'100%', marginTop:6, padding:'8px 6px', background:'#EFF6FF', color:'#1B3A6B', border:'1px dashed #93C5FD', borderRadius:8, fontSize:11.5, fontWeight:700, cursor:'pointer' }}>
      🌐 Novedades de Portal-Ars
    </button>

    {t && (
      <div className="modal-backdrop" data-closing={t.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
        onClick={e => { if (e.target === e.currentTarget && !cargando) setAbierto(false) }}>
        <div className="modal-content" data-closing={t.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:680, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
          <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:17 }}>🌐 Novedades de Portal-Ars</h2>
          <p style={{ color:'#888', fontSize:12, marginBottom:14 }}>
            Se compara por <b>nombre</b> dentro de cada grado (no por número), así nadie se queda con las notas de otro. Marcá lo que quieras aplicar.
          </p>

          <div style={{ overflowY:'auto', flex:1, minHeight:80 }}>
            {cargando && !datos && <div style={{ textAlign:'center', padding:30 }}><div className="spinner" style={{ margin:'0 auto 10px' }} /><div style={{ fontSize:13, color:'#555' }}>Consultando Portal-Ars…</div></div>}

            {datos && datos.error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#991B1B', borderRadius:10, padding:12, fontSize:13 }}>❌ {datos.error}</div>}

            {resultado && (resultado.ok
              ? <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', color:'#166534', borderRadius:10, padding:14, fontSize:13, marginBottom:12 }}>
                  ✅ Listo: {resultado.agregados} agregado(s), {resultado.renumerados} con número nuevo, {resultado.movidos} cambiado(s) de sección, {resultado.retirados} retirado(s).
                </div>
              : <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#991B1B', borderRadius:10, padding:14, fontSize:13, marginBottom:12 }}>
                  ❌ {resultado.error}
                  {(resultado.detalle || []).map((d, i) => <div key={i} style={{ fontSize:12, marginTop:4 }}>• {d}</div>)}
                  <div style={{ fontSize:12, marginTop:6, color:'#555' }}>Tip: si alguien que ya no está ocupa ese número, marcalo también en «No están en Portal-Ars».</div>
                </div>)}

            {datos && datos.ok && !(resultado && resultado.ok) && <>
              <div style={{ fontSize:12.5, color:'#555', marginBottom:10 }}>
                ✔ {datos.iguales} estudiante(s) ya coinciden.
                {datos.sugerencias.length === 0 && <b style={{ color:'#166534' }}> Todo está al día.</b>}
                {datos.gradosSinPortal && datos.gradosSinPortal.length > 0 && <span style={{ color:'#92400E' }}> · Portal-Ars no tiene estudiantes de {datos.gradosSinPortal.join(', ')}.</span>}
              </div>
              {ORDEN.map(tipo => {
                const lista = datos.sugerencias.filter(s => s.tipo === tipo)
                if (!lista.length) return null
                const cfg = TIPOS[tipo]
                const todas = lista.every(s => marcadas[s.id])
                return <div key={tipo} style={{ border:'1px solid #E5E7EB', borderRadius:10, marginBottom:10, overflow:'hidden' }}>
                  <div style={{ background:cfg.bg, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <input type="checkbox" checked={todas} onChange={() => { const m = { ...marcadas }; lista.forEach(s => { m[s.id] = !todas }); setMarcadas(m) }} />
                    <b style={{ color:cfg.color, fontSize:13 }}>{cfg.titulo} ({lista.length})</b>
                    <span style={{ fontSize:11.5, color:'#6B7280' }}>{cfg.ayuda}</span>
                  </div>
                  {lista.map(s => (
                    <label key={s.id} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'7px 12px', borderTop:'1px solid #F3F4F6', fontSize:13, cursor:'pointer' }}>
                      <input type="checkbox" checked={!!marcadas[s.id]} onChange={() => setMarcadas({ ...marcadas, [s.id]: !marcadas[s.id] })} style={{ marginTop:3 }} />
                      <span>
                        {textoSugerencia(s)}
                        {s.chocaCon && <span style={{ display:'block', fontSize:11.5, color:'#991B1B' }}>⚠ Sin marcar: ese número lo tiene «{s.chocaCon}», que no se mueve. Resolvé ese caso primero.</span>}
                        {s.liberaNumero && <span style={{ display:'block', fontSize:11.5, color:'#1B3A6B' }}>Marcado para liberar el N.º {s.local.numero}, que lo necesita otro estudiante.</span>}
                        {s.dudoso && <span style={{ display:'block', fontSize:11.5, color:'#92400E' }}>⚠ Nombre parecido, no igual: en Portal-Ars es «{s.portal.nombre}». Revisá antes de marcar.</span>}
                      </span>
                    </label>
                  ))}
                </div>
              })}
            </>}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={() => setAbierto(false)} disabled={cargando}
              style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>
              {resultado && resultado.ok ? 'Cerrar' : 'Cancelar'}
            </button>
            {datos && datos.ok && !(resultado && resultado.ok) && datos.sugerencias.length > 0 && (
              <button onClick={aplicar} disabled={cargando || nMarcadas === 0}
                style={{ padding:'9px 24px', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                  background: (cargando || nMarcadas === 0) ? '#CCC' : '#1B3A6B', cursor: (cargando || nMarcadas === 0) ? 'default' : 'pointer' }}>
                {cargando ? 'Aplicando…' : `Aplicar ${nMarcadas} cambio(s)`}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </>
}
