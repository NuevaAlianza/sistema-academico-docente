import React, { useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Horario from './pages/Horario'
import Temario from './pages/Temario'
import Cursos from './pages/Cursos'
import Estudiantes from './pages/Estudiantes'
import Asistencia from './pages/Asistencia'
import Calificaciones from './pages/Calificaciones'
import Configuracion from './pages/Configuracion'
import Backup from './pages/Backup'
import CursoEspacio from './pages/CursoEspacio'
import Reportes from './pages/Reportes'
import { periodoPorFecha } from './hooks/useSeleccionActiva'

export default function App() {
  const [anio,     setAnio]     = useState(null)
  const [materia,  setMateria]  = useState(null)
  const [materias, setMaterias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [sinAnio,  setSinAnio]  = useState(false)
  const [cursoActivoId,   setCursoActivoId]   = useState(null)
  const [periodoActivoId, setPeriodoActivoId] = useState(null)

  useEffect(() => { cargarAnio() }, [])

  async function cargarAnio() {
    try {
      const a = await window.api.invoke('get-anio-activo')
      if (a && a.id) {
        setAnio(a)
        setSinAnio(false)
        await cargarMaterias(a)
        await cargarSeleccion(a)
      } else {
        setSinAnio(true)
      }
    } catch (err) {
      console.error('Error:', err)
      setSinAnio(true)
    } finally {
      setCargando(false)
    }
  }

  async function cargarMaterias(anioActivo) {
    try {
      const lista = await window.api.invoke('get-materias', anioActivo.id)
      setMaterias(lista)
      const cfg = await window.api.invoke('get-config')
      const materiaActivaId = cfg.materia_activa_id ? Number(cfg.materia_activa_id) : null
      if (lista.length > 0) {
        const guardada = materiaActivaId ? lista.find(m => m.id === materiaActivaId) : null
        setMateria(guardada || lista[0])
      } else {
        setMateria(null)
      }
    } catch(err) {
      console.error('Error cargando materias:', err)
    }
  }

  // El curso se recuerda entre sesiones; el período no: al abrir la app se toma el de la
  // fecha de hoy, para no seguir anotando en el período anterior cuando empieza uno nuevo.
  async function cargarSeleccion(anioActivo) {
    try {
      const [cursos, periodos, cfg] = await Promise.all([
        window.api.invoke('get-cursos', anioActivo.id),
        window.api.invoke('get-periodos', anioActivo.id),
        window.api.invoke('get-config'),
      ])
      const guardado = cfg.curso_activo_id ? Number(cfg.curso_activo_id) : null
      const curso = cursos.find(c => c.id === guardado) || cursos[0] || null
      setCursoActivoId(curso ? curso.id : null)
      setPeriodoActivoId(periodoPorFecha(periodos)?.id ?? null)
    } catch (err) {
      console.error('Error cargando curso/período activo:', err)
    }
  }

  const cambiarCurso = useCallback(async id => {
    setCursoActivoId(id)
    await window.api.invoke('set-config', 'curso_activo_id', String(id))
  }, [])

  async function recargarMaterias() {
    if (!anio) return
    const lista = await window.api.invoke('get-materias', anio.id)
    setMaterias(lista)
    setMateria(prev => prev ? (lista.find(m => m.id === prev.id) || lista[0] || null) : lista[0] || null)
  }

  async function cambiarMateria(nuevaMateria) {
    if (!nuevaMateria) {
      if (anio) await cargarMaterias(anio)
      return
    }
    setMateria(nuevaMateria)
    await window.api.invoke('set-config', 'materia_activa_id', String(nuevaMateria.id))
  }

  async function crearAnioInicial() {
    await window.api.invoke('create-anio', {
      nombre: '2025-2026',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-07-31',
    })
    cargarAnio()
  }

  if (cargando) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#EEF2F7' }}>
        <div style={{ textAlign:'center', color:'#1B3A6B' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📘</div>
          <div className="spinner" style={{ margin:'0 auto 10px' }} />
          <div style={{ fontSize:16, fontWeight:600 }}>Cargando...</div>
        </div>
      </div>
    )
  }

  if (sinAnio) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#EEF2F7' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:40, textAlign:'center', boxShadow:'0 8px 32px #0002', border:'1px solid #DDE3ED', maxWidth:400 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📘</div>
          <h2 style={{ color:'#1B3A6B', marginBottom:8, fontSize:20 }}>Sistema Académico Docente</h2>
          <p style={{ color:'#888', fontSize:14, marginBottom:24, lineHeight:1.6 }}>
            No hay un año escolar configurado. Haz clic abajo para inicializar el sistema.
          </p>
          <button onClick={crearAnioInicial} style={{
            padding:'12px 32px', background:'#1B3A6B', color:'#fff',
            border:'none', borderRadius:10, fontSize:15, fontWeight:700,
            cursor:'pointer', width:'100%',
          }}>
            🚀 Inicializar Sistema 2025-2026
          </button>
        </div>
      </div>
    )
  }

  const commonProps = {
    anio, materia, materias,
    cursoActivoId, onCambiarCurso: cambiarCurso,
    periodoActivoId, onCambiarPeriodo: setPeriodoActivoId,
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={
          <Layout
            anio={anio}
            materia={materia}
            materias={materias}
            onCambiarMateria={cambiarMateria}
            cursoActivoId={cursoActivoId}
            onCambiarCurso={cambiarCurso}
            periodoActivoId={periodoActivoId}
            onCambiarPeriodo={setPeriodoActivoId}
          />
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"      element={<Dashboard      {...commonProps} />} />
          <Route path="horario"        element={<Horario        {...commonProps} />} />
          <Route path="cursos"         element={<Cursos         {...commonProps} />} />
          <Route path="estudiantes"    element={<Estudiantes    {...commonProps} />} />
          <Route path="asistencia"     element={<Asistencia     {...commonProps} />} />
          <Route path="calificaciones" element={<Calificaciones {...commonProps} />} />
          <Route path="temario"        element={<Temario        {...commonProps} />} />
          <Route path="configuracion"  element={<Configuracion  {...commonProps} onRecargarMaterias={recargarMaterias} />} />
          <Route path="curso/:cursoId" element={<CursoEspacio   {...commonProps} />} />
          <Route path="reportes" element={<Reportes {...commonProps} />} />
          <Route path="backup"         element={<Backup />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}