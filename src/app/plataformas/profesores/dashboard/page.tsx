/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { FaUsers, FaBook, FaSpinner, FaCrown, FaStar, FaChevronDown, FaChevronUp, FaChevronRight, FaFilePdf, FaBell } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { contarNotificacionesNoLeidas } from '../notificaciones/actions'
import { normalizarTexto } from 'app/utils/horario/comun'

export default function ProfesorDashboard() {
  const [cursosAgrupados, setCursosAgrupados] = useState<Record<string, any[]>>({})
  const [cursoExpandido, setCursoExpandido] = useState<string | null>(null) 
  const [cursosDirector, setCursosDirector] = useState<any[]>([]) 
  const [cargando, setCargando] = useState(true)
  const [nombreProfesor, setNombreProfesor] = useState('')
  const [notificaciones, setNotificaciones] = useState(0)

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (perfil) {
        setNombreProfesor(perfil.full_name.split(' ')[0])
      }

      const { data: asignaciones } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('teacher_id', user.id)

      if (asignaciones) {
        // Las materias que no se califican (solo horario y planeación) no llevan planilla
        const gradeIds = [...new Set(asignaciones.map(a => a.grade_id).filter(Boolean))]
        const { data: sinNota } = gradeIds.length
          ? await supabase.from('subjects').select('id, name, grade_id').eq('is_graded', false).in('grade_id', gradeIds)
          : { data: [] as any[] }
        const noSeCalifica = (asig: any) => (sinNota || []).some(m => m.grade_id === asig.grade_id && (
          m.id === asig.subject_id || (!!asig.subject_name && normalizarTexto(m.name) === normalizarTexto(asig.subject_name))
        ))

        const agrupado = asignaciones.map(asig => ({ ...asig, noSeCalifica: noSeCalifica(asig) })).reduce((acc: any, asig) => {
          if (!acc[asig.course_name]) {
            acc[asig.course_name] = []
          }
          acc[asig.course_name].push(asig)
          return acc
        }, {})

        setCursosAgrupados(agrupado)
      }

      const { data: cursosDirigidos } = await supabase
        .from('grades')
        .select('id, name')
        .eq('director_id', user.id)

      if (cursosDirigidos) setCursosDirector(cursosDirigidos)

      setNotificaciones(await contarNotificacionesNoLeidas().catch(() => 0))

      setCargando(false)
    }

    cargarDatos()
  }, [supabase])

  const toggleCurso = (nombreCurso: string) => {
    setCursoExpandido(cursoExpandido === nombreCurso ? null : nombreCurso)
  }

  if (cargando) {
    return (
      <main className={styles.mainContent} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <FaSpinner className="fa-spin" size={50} color="#3b82f6" />
      </main>
    )
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1>¡Hola, Profe {nombreProfesor}! 🍎</h1>
        <p>Bienvenido a tu panel de control. Selecciona un curso para ver tus materias asignadas.</p>
      </header>

      {notificaciones > 0 && (
        <Link
          href="/plataformas/profesores/notificaciones"
          style={{ maxWidth: '800px', margin: '0 auto 30px auto', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', color: '#92400e', textDecoration: 'none', fontWeight: 500 }}
        >
          <FaBell color="#f59e0b" size={18} />
          <span style={{ flex: 1 }}>
            Tienes {notificaciones} notificación{notificaciones > 1 ? 'es' : ''} de rectoría sobre tus planeaciones.
          </span>
          <FaChevronRight size={14} />
        </Link>
      )}

      {/* 👑 PANEL DORADO MULTI-CURSO PARA DIRECTORES DE GRUPO */}
      {cursosDirector.length > 0 && (
        <div style={{ maxWidth: '800px', margin: '0 auto 40px auto', backgroundColor: '#fffbeb', borderRadius: '12px', border: '2px solid #fde68a', padding: '25px', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.1)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#b45309', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaCrown color="#f59e0b" /> Director de Grupo
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#92400e' }}>
              Tienes acceso para evaluar la convivencia y comportamiento de tus cursos asignados.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {cursosDirector.map(curso => (
              <Link 
                key={curso.id}
                href={`/plataformas/profesores/comportamiento?curso=${encodeURIComponent(curso.name)}`}
                style={{ backgroundColor: '#f59e0b', color: 'white', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} 
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <FaStar /> Evaluar {curso.name}
              </Link>
            ))}
          </div>

          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #fde68a' }}>
            <Link
              href="/plataformas/profesores/boletines-director"
              style={{ backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '10px', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <FaFilePdf /> Ver Boletines
            </Link>
          </div>
        </div>
      )}

      {/* 📚 CONTENEDOR DE CURSOS NORMALES */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
          Mis Cursos Asignados
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {Object.keys(cursosAgrupados).length === 0 ? (
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #cbd5e1' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Aún no tienes carga académica asignada.</p>
            </div>
          ) : (
            Object.keys(cursosAgrupados).sort().map((nombreCurso) => {
              const materiasDelCurso = cursosAgrupados[nombreCurso]
              const estaExpandido = cursoExpandido === nombreCurso
              
              // 🚦 ENRUTADOR INTELIGENTE
              const esPreescolar = ['Aventureros', 'Creativos', 'Expertos'].includes(nombreCurso)
              const esBasica = ['Emprendedores', 'Ingeniosos', 'Transformadores'].includes(nombreCurso)
              // Todo lo demás ("Innovadores", "Conquistadores", "Gnomos", "Duendes", "Elfos") se va por defecto a Avanzada

              return (
                <div 
                  key={nombreCurso}
                  style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                >
                  <button 
                    onClick={() => toggleCurso(nombreCurso)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', backgroundColor: estaExpandido ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', borderBottom: estaExpandido ? '1px solid #e2e8f0' : 'none', transition: 'background-color 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '10px', color: '#3b82f6' }}>
                        <FaUsers size={20} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{nombreCurso}</h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', marginTop: '3px' }}>
                          {materiasDelCurso.length} materia{materiasDelCurso.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ color: '#64748b' }}>
                      {estaExpandido ? <FaChevronUp size={18} /> : <FaChevronDown size={18} />}
                    </div>
                  </button>

                  {estaExpandido && (
                    <div style={{ padding: '15px 25px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#ffffff' }}>
                      {materiasDelCurso.map((materia: any) => {
                        if (materia.noSeCalifica) {
                          return (
                            <Link
                              href="/plataformas/profesores/planeacion"
                              key={materia.id}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', textDecoration: 'none', color: '#334155', border: '1px dashed #cbd5e1' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500', flexWrap: 'wrap' }}>
                                <FaBook color="#94a3b8" /> {materia.subject_name}
                                <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>No se califica · ir a la planeación semanal</span>
                              </div>
                              <FaChevronRight color="#94a3b8" size={14} />
                            </Link>
                          )
                        }

                        
                        // Asignación de ruta dependiendo del bloque del colegio
                        let rutaPlanilla = `/plataformas/profesores/planilla-avanzada?curso=${encodeURIComponent(nombreCurso)}&materia=${encodeURIComponent(materia.subject_name)}` // Por defecto, Avanzada
                        
                        if (esPreescolar) {
                          rutaPlanilla = `/plataformas/profesores/calificaciones?curso=${encodeURIComponent(nombreCurso)}&materia=${encodeURIComponent(materia.subject_name)}`
                        } else if (esBasica) {
                          rutaPlanilla = `/plataformas/profesores/planilla-basica?curso=${encodeURIComponent(nombreCurso)}&materia=${encodeURIComponent(materia.subject_name)}`
                        }

                        return (
                          <Link 
                            href={rutaPlanilla}
                            key={materia.id}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', textDecoration: 'none', color: '#334155', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.transform = 'translateX(5px)' }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateX(0)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
                              <FaBook color="#3b82f6" /> {materia.subject_name}
                            </div>
                            <FaChevronRight color="#94a3b8" size={14} />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}