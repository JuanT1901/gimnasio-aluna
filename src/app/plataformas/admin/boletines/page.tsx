/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FaFilePdf, FaEye, FaEyeSlash, FaSpinner, FaGraduationCap, FaArrowLeft, FaUsers, FaCheckDouble } from 'react-icons/fa'
import { togglePublicacion, publicarTodosBoletines } from './actions'

const CURSOS_PRIMARIA = ['Emprendedores', 'Ingeniosos', 'Transformadores'];
const CURSOS_PREESCOLAR = ['Aventureros', 'Creativos', 'Expertos']; 
const CURSOS_BACHILLERATO = ['Innovadores', 'Conquistadores', 'Gnomos', 'Duendes', 'Elfos'];

export default function AdminBoletinesPage() {
  const [vistaActual, setVistaActual] = useState<'cursos' | 'estudiantes'>('cursos')
  const [cursoActivo, setCursoActivo] = useState<string | null>(null)
  
  const [cursos, setCursos] = useState<any[]>([])
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [periodo, setPeriodo] = useState('1')
  const [estadosPublicacion, setEstadosPublicacion] = useState<Record<string, boolean>>({})
  
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [procesandoLote, setProcesandoLote] = useState(false)

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    const cargarCursos = async () => {
      setCargando(true)
      const { data: cursosData } = await supabase.from('grades').select('name').order('name')
      if (cursosData) setCursos(cursosData)
      setCargando(false)
    }
    if (vistaActual === 'cursos') cargarCursos()
  }, [vistaActual, supabase])

  useEffect(() => {
    if (vistaActual !== 'estudiantes' || !cursoActivo) return

    const cargarEstudiantes = async () => {
      setCargando(true)
      const { data: estData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        .eq('course_name', cursoActivo)
        .order('full_name')

      if (estData) setEstudiantes(estData)

      const { data: pubData } = await supabase
        .from('student_report_status')
        .select('student_id, is_published')
        .eq('course_name', cursoActivo)
        .eq('period', parseInt(periodo))

      const mapaEstados: Record<string, boolean> = {}
      pubData?.forEach(p => { mapaEstados[p.student_id] = p.is_published })
      setEstadosPublicacion(mapaEstados)

      setCargando(false)
    }
    cargarEstudiantes()
  }, [vistaActual, cursoActivo, periodo, supabase])

  const togglePublicacionIndividual = async (estudianteId: string) => {
    setProcesandoId(estudianteId)
    const estadoActual = estadosPublicacion[estudianteId] || false

    const resultado = await togglePublicacion(estudianteId, cursoActivo!, parseInt(periodo), !estadoActual)

    if (resultado.exito) {
      setEstadosPublicacion(prev => ({ ...prev, [estudianteId]: !estadoActual }))
    }
    setProcesandoId(null)
  }

  const publicarTodos = async () => {
    setProcesandoLote(true)

    const resultado = await publicarTodosBoletines(estudiantes, cursoActivo!, parseInt(periodo))

    if (resultado.exito) {
      const nuevoMapa = { ...estadosPublicacion }
      estudiantes.forEach(est => { nuevoMapa[est.id] = true })
      setEstadosPublicacion(nuevoMapa)
    }
    setProcesandoLote(false)
  }

  const obtenerRutaBoletin = (curso: string) => {
  if (CURSOS_PRIMARIA.includes(curso)) return '/impresion/primaria';
  if (CURSOS_PREESCOLAR.includes(curso)) return '/impresion/preescolar';
  if (CURSOS_BACHILLERATO.includes(curso)) return '/impresion/bachillerato';
  return '/404'; 
  }

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>

  return (
    <main style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      
      {vistaActual === 'cursos' && (
        <>
          <header style={{ marginBottom: '30px' }}>
            <h1 style={{ margin: 0, color: '#1e293b' }}>Gestión de Boletines</h1>
            <p style={{ color: '#64748b' }}>Selecciona un curso para generar e imprimir boletines.</p>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {cursos.map(curso => (
              <button 
                key={curso.name}
                onClick={() => { setCursoActivo(curso.name); setVistaActual('estudiantes'); }}
                style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', textAlign: 'left', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '10px', color: '#3b82f6' }}>
                  <FaUsers size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#334155', fontSize: '1.2rem' }}>{curso.name}</h3>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Gestionar boletines ➔</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {vistaActual === 'estudiantes' && cursoActivo && (
        <>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button onClick={() => setVistaActual('cursos')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>
                <FaArrowLeft />
              </button>
              <div>
                <h1 style={{ margin: 0, color: '#1e293b' }}>Boletines: {cursoActivo}</h1>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <select 
                value={periodo} 
                onChange={(e) => setPeriodo(e.target.value)}
                style={{ padding: '10px 15px', borderRadius: '8px', border: '2px solid #3b82f6', fontWeight: 'bold', outline: 'none' }}
              >
                <option value="1">1° Periodo</option>
                <option value="2">2° Periodo</option>
                <option value="3">3° Periodo</option>
              </select>
              
              <button 
                onClick={publicarTodos}
                disabled={procesandoLote}
                style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {procesandoLote ? <FaSpinner className="fa-spin" /> : <FaCheckDouble />}
                Publicar Todos
              </button>
            </div>
          </header>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '15px 20px' }}>Estudiante</th>
                  <th style={{ padding: '15px 20px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '15px 20px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((est, index) => {
                  const publicado = estadosPublicacion[est.id] || false

                  return (
                    <tr key={est.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FaGraduationCap color="#94a3b8" /> {est.full_name}
                        </div>
                      </td>
                      
                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        {publicado ? (
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>Visible</span>
                        ) : (
                          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>Oculto</span>
                        )}
                      </td>

                      <td style={{ padding: '15px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <button 
                            onClick={() => window.open(`${obtenerRutaBoletin(cursoActivo)}?estudiante=${est.id}&periodo=${periodo}`, '_blank')}
                            style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FaFilePdf /> Previa
                          </button>
                          
                          <button 
                            onClick={() => togglePublicacionIndividual(est.id)}
                            disabled={procesandoId === est.id}
                            style={{ backgroundColor: publicado ? '#fee2e2' : '#dcfce7', color: publicado ? '#ef4444' : '#15803d', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '130px', justifyContent: 'center' }}
                          >
                            {procesandoId === est.id ? <FaSpinner className="fa-spin" /> : (publicado ? <><FaEyeSlash /> Retener</> : <><FaEye /> Publicar</>)}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}