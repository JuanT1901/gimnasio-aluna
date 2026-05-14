/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaArrowLeft, FaSave, FaPlus, FaTrash, FaSpinner, FaCheckCircle, FaUserEdit, FaBook, FaSeedling, FaChartLine, FaTrophy, FaLightbulb, FaEdit, FaTimes, FaCheck, FaClock } from 'react-icons/fa'
import { guardarEvaluacionPreescolar } from '../actions'

const obtenerInfoEscala = (notaStr: string | number) => {
  const nota = parseFloat(notaStr.toString())
  if (isNaN(nota) || nota < 1.0 || nota > 5.0) {
    return { texto: 'Esperando nota...', color: '#64748b', bg: '#f1f5f9', icon: null }
  }
  if (nota >= 1.0 && nota <= 3.4) {
    return { texto: 'Logro iniciado', color: '#b45309', bg: '#fef3c7', icon: <FaSeedling size={16} /> }
  }
  if (nota >= 3.5 && nota <= 4.0) {
    return { texto: 'Logro en proceso', color: '#1d4ed8', bg: '#eff6ff', icon: <FaChartLine size={16} /> }
  }
  return { texto: 'Logro alcanzado', color: '#15803d', bg: '#dcfce7', icon: <FaTrophy size={16} /> }
}

function ContenidoPlanillaPreescolar() {
  const searchParams = useSearchParams()
  
  const curso = searchParams.get('curso')
  const materia = searchParams.get('materia') 

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [periodo, setPeriodo] = useState('1')
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [evaluacionesGlobales, setEvaluacionesGlobales] = useState<any[]>([])
  
  const [cargandoLista, setCargandoLista] = useState(true)
  const [vistaActual, setVistaActual] = useState<'lista' | 'formulario'>('lista')
  const [estudianteActivo, setEstudianteActivo] = useState<any>(null)

  const [cargandoEvaluacion, setCargandoEvaluacion] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(false)
  const [bancoCompetencias, setBancoCompetencias] = useState<any[]>([])
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null)

  const [tempCompetencia, setTempCompetencia] = useState('')
  const [tempDesempeno, setTempDesempeno] = useState('')
  const [tempNota, setTempNota] = useState('')

  const compRef = useRef<HTMLTextAreaElement>(null)
  const desRef = useRef<HTMLTextAreaElement>(null)

  const [competencias, setCompetencias] = useState<any[]>([])

  useEffect(() => {
    if (!curso || !materia) return
    const cargarDatosIniciales = async () => {
      setCargandoLista(true)
      try {
        const { data: estData } = await supabase
          .from('profiles')
          .select('id, full_name, doc_number')
          .eq('role', 'student')
          .eq('course_name', curso)
          .order('full_name', { ascending: true })
        if (estData) setEstudiantes(estData)

        const { data: evalGlobal } = await supabase
          .from('preschool_evaluations')
          .select('student_id, competencies_data')
          .eq('course_name', curso)
          .eq('dimension', materia)
          .eq('period', parseInt(periodo))

        if (evalGlobal) {
          const evaluadosValidos = evalGlobal.filter(e => e.competencies_data && e.competencies_data.length > 0)
          setEvaluacionesGlobales(evaluadosValidos)
        }
      } catch {
        // error silencioso
      } finally {
        setCargandoLista(false)
      }
    }
    
    if (vistaActual === 'lista') {
      cargarDatosIniciales()
    }
  }, [curso, materia, periodo, vistaActual, supabase])

  useEffect(() => {
    if (!curso || !materia || !periodo) return

    const cargarBanco = async () => {
      const { data: evaluacionesCurso } = await supabase
        .from('preschool_evaluations')
        .select('competencies_data')
        .eq('course_name', curso)
        .eq('dimension', materia)
        .eq('period', parseInt(periodo))

      if (evaluacionesCurso && evaluacionesCurso.length > 0) {
        const bancoUnico = new Set<string>()
        evaluacionesCurso.forEach(evaluacion => {
          if (evaluacion.competencies_data) {
            evaluacion.competencies_data.forEach((comp: any) => {
              bancoUnico.add(comp.competencia)
            })
          }
        })
        setBancoCompetencias(Array.from(bancoUnico).map(competencia => ({ competencia })))
      } else {
        setBancoCompetencias([])
      }
    }

    if (vistaActual === 'formulario') {
      cargarBanco()
    }
  }, [curso, materia, periodo, vistaActual, supabase])

  useEffect(() => {
    if (vistaActual !== 'formulario' || !estudianteActivo || !materia) return
    const cargarEvaluacionPrevia = async () => {
      setCargandoEvaluacion(true)
      const { data: evalPrevia } = await supabase
        .from('preschool_evaluations')
        .select('*')
        .eq('student_id', estudianteActivo.id)
        .eq('period', parseInt(periodo))
        .eq('dimension', materia)
        .single()

      if (evalPrevia) {
        setCompetencias(evalPrevia.competencies_data || [])
      } else {
        setCompetencias([])
      }
      
      cancelarEdicion()
      setCargandoEvaluacion(false)
    }
    cargarEvaluacionPrevia()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaActual, estudianteActivo, periodo, materia, supabase])

  const autoResize = (elemento: HTMLTextAreaElement | null) => {
    if (elemento) {
      elemento.style.height = 'auto'
      elemento.style.height = `${elemento.scrollHeight}px`
    }
  }

  const seleccionarDelBanco = (indexBco: number) => {
    if (indexBco === -1) return
    const seleccion = bancoCompetencias[indexBco]
    setTempCompetencia(seleccion.competencia)
    setTimeout(() => {
      autoResize(compRef.current)
    }, 50)
  }

  const cancelarEdicion = () => {
    setTempCompetencia('')
    setTempDesempeno('')
    setTempNota('')
    setEditandoIndex(null)
    if (compRef.current) compRef.current.style.height = 'auto'
    if (desRef.current) desRef.current.style.height = 'auto'
  }

  const activarEdicion = (index: number) => {
    const compAEditar = competencias[index]
    setTempCompetencia(compAEditar.competencia)
    setTempDesempeno(compAEditar.desempeno)
    setTempNota(compAEditar.nota.toString())
    setEditandoIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => {
      autoResize(compRef.current)
      autoResize(desRef.current)
    }, 50)
  }

  const guardarCompetenciaLocal = () => {
    const notaNum = parseFloat(tempNota)
    if (!tempCompetencia || !tempDesempeno) return alert('Debes llenar la competencia y el desempeño.')
    if (isNaN(notaNum) || notaNum < 1.0 || notaNum > 5.0) return alert('La nota debe ser un número entre 1.0 y 5.0')

    const info = obtenerInfoEscala(notaNum)
    const nueva = { competencia: tempCompetencia, desempeno: tempDesempeno, nota: notaNum, escala: info.texto }
    
    if (editandoIndex !== null) {
      const actualizadas = [...competencias]
      actualizadas[editandoIndex] = nueva
      setCompetencias(actualizadas)
    } else {
      setCompetencias([...competencias, nueva])
    }
    cancelarEdicion()
  }

  const eliminarCompetencia = (index: number) => {
    setCompetencias(competencias.filter((_, i) => i !== index))
    if (editandoIndex === index) cancelarEdicion() 
  }

  const guardarPlanilla = async () => {
    if (!estudianteActivo) return

    setGuardando(true)

    const resultado = await guardarEvaluacionPreescolar({
      student_id: estudianteActivo.id,
      course_name: curso!,
      period: parseInt(periodo),
      dimension: materia!,
      competencies_data: competencias
    })

    setGuardando(false)

    if (!resultado.exito) {
      alert(resultado.error || 'Hubo un error al guardar.')
    } else {
      setMensajeExito(true)
      setTimeout(() => setMensajeExito(false), 3000)
    }
  }

  const infoEscalaActual = obtenerInfoEscala(tempNota)

  if (cargandoLista) return <div style={{ textAlign: 'center', marginTop: '50px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {vistaActual === 'lista' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <Link href="/plataformas/profesores/dashboard" style={{ color: '#64748b', fontSize: '1.2rem' }}>
              <FaArrowLeft />
            </Link>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0 }}>Planilla de Evaluación 🎨</h1>
              <p style={{ margin: 0, color: '#3b82f6', fontWeight: 'bold' }}>{curso} | {materia}</p>
            </div>
            {/* 🌟 Selector Global de Periodo */}
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '2px solid #3b82f6', fontWeight: 'bold', color: '#1e293b', outline: 'none' }}>
              <option value="1">1° Periodo</option>
              <option value="2">2° Periodo</option>
              <option value="3">3° Periodo</option>
            </select>
          </header>

          <div className={styles.card} style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '15px 20px' }}>Estudiante</th>
                  <th style={{ padding: '15px 20px', textAlign: 'center', width: '150px' }}>Estado</th>
                  <th style={{ padding: '15px 20px', textAlign: 'center', width: '120px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((est, index) => {
                  const yaEvaluado = evaluacionesGlobales.some(e => e.student_id === est.id)

                  return (
                    <tr key={est.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#334155' }}>{est.full_name}</td>
                      
                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        {yaEvaluado ? (
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <FaCheck /> Evaluado
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <FaClock /> Pendiente
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        <button 
                          onClick={() => { setEstudianteActivo(est); setVistaActual('formulario'); }}
                          style={{ backgroundColor: yaEvaluado ? '#f8fafc' : '#3b82f6', color: yaEvaluado ? '#64748b' : 'white', border: yaEvaluado ? '1px solid #cbd5e1' : 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          {yaEvaluado ? 'Editar' : 'Evaluar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vistaActual === 'formulario' && estudianteActivo && (
        <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '50px' }}>
          
          <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <button onClick={() => setVistaActual('lista')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>
              <FaArrowLeft />
            </button>
            <div style={{ flex: 1 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#1e293b' }}>
                {estudianteActivo.full_name}
              </h2>
              <p style={{ margin: 0, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                <FaBook color="#3b82f6"/> {materia} | Periodo {periodo}
              </p>
            </div>
          </header>

          {cargandoEvaluacion ? (
            <div style={{ textAlign: 'center', padding: '50px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>
          ) : (
            <>
              <div className={styles.card} style={{ marginBottom: '30px', borderLeft: editandoIndex !== null ? '5px solid #f59e0b' : '5px solid #10b981', backgroundColor: editandoIndex !== null ? '#fffbeb' : 'white' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: editandoIndex !== null ? '#b45309' : '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {editandoIndex !== null ? <><FaEdit /> Editando Competencia</> : 'Añadir Competencia'}
                  </h3>
                  
                  {bancoCompetencias.length > 0 && editandoIndex === null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fef3c7', padding: '5px 15px', borderRadius: '20px', border: '1px solid #fde68a' }}>
                      <FaLightbulb color="#d97706" />
                      <select 
                        onChange={(e) => seleccionarDelBanco(Number(e.target.value))}
                        style={{ background: 'transparent', border: 'none', color: '#b45309', fontWeight: 'bold', outline: 'none', cursor: 'pointer', maxWidth: '250px', textOverflow: 'ellipsis' }}
                      >
                        <option value="-1">Reutilizar del banco...</option>
                        {bancoCompetencias.map((item, idx) => (
                          <option key={idx} value={idx}>{item.competencia.substring(0, 50)}...</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 45%' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>Competencia:</label>
                    <textarea 
                      ref={compRef}
                      rows={1}
                      value={tempCompetencia} 
                      onChange={(e) => { setTempCompetencia(e.target.value); autoResize(e.target); }}
                      placeholder="Ej: Reconoce figuras..."
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'none', overflow: 'hidden', minHeight: '42px', fontFamily: 'inherit', backgroundColor: 'white' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 45%' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>Desempeño:</label>
                    <textarea 
                      ref={desRef}
                      rows={1}
                      value={tempDesempeno} 
                      onChange={(e) => { setTempDesempeno(e.target.value); autoResize(e.target); }}
                      placeholder="Ej: Clasifica objetos por color..."
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'none', overflow: 'hidden', minHeight: '42px', fontFamily: 'inherit', backgroundColor: 'white' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 1 120px' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>Nota (1.0 - 5.0):</label>
                    <input 
                      type="number" 
                      min="1.0" max="5.0" step="0.1"
                      value={tempNota} onChange={(e) => setTempNota(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #3b82f6', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', backgroundColor: 'white' }}
                    />
                  </div>
                  
                  <div style={{ flex: '1', display: 'flex', alignItems: 'center', height: '46px', backgroundColor: infoEscalaActual.bg, color: infoEscalaActual.color, padding: '0 15px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${infoEscalaActual.color}40`, gap: '10px' }}>
                    {infoEscalaActual.icon}
                    <span>{infoEscalaActual.texto}</span>
                  </div>

                  {editandoIndex !== null ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={cancelarEdicion} style={{ backgroundColor: 'white', color: '#64748b', border: '1px solid #cbd5e1', padding: '0 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '46px' }}>
                        <FaTimes /> Cancelar
                      </button>
                      <button onClick={guardarCompetenciaLocal} style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '0 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: '46px' }}>
                        <FaSave /> Actualizar
                      </button>
                    </div>
                  ) : (
                    <button onClick={guardarCompetenciaLocal} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: '46px' }}>
                      <FaPlus /> Añadir
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#1e293b', marginBottom: '15px' }}>Competencias Registradas</h3>
                
                {competencias.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    Aún no has agregado competencias para esta dimensión.
                  </p>
                ) : (
                  <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {competencias.map((item, idx) => {
                      const estiloGuardado = obtenerInfoEscala(item.nota || 0) 
                      const estaEditandoEste = editandoIndex === idx
                      
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: estaEditandoEste ? '#fef3c7' : 'white', padding: '15px', borderRadius: '8px', border: estaEditandoEste ? '2px dashed #f59e0b' : '1px solid #cbd5e1', marginBottom: '10px', opacity: estaEditandoEste ? 0.6 : 1, transition: 'all 0.2s' }}>
                          <div>
                            <strong style={{ display: 'block', color: '#334155' }}>Competencia: <span style={{ fontWeight: 'normal' }}>{item.competencia}</span></strong>
                            <strong style={{ display: 'block', color: '#334155', marginTop: '5px' }}>Desempeño: <span style={{ fontWeight: 'normal' }}>{item.desempeno}</span></strong>
                            
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '0.9rem', backgroundColor: estiloGuardado.bg, color: estiloGuardado.color, padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${estiloGuardado.color}40` }}>
                              {estiloGuardado.icon}
                              <span>{item.nota ? item.nota.toFixed(1) : ''} - {item.escala}</span>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px', marginLeft: '15px' }}>
                            <button onClick={() => activarEdicion(idx)} disabled={estaEditandoEste} style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '10px', borderRadius: '6px', cursor: estaEditandoEste ? 'not-allowed' : 'pointer' }} title="Editar">
                              <FaEdit />
                            </button>
                            <button onClick={() => eliminarCompetencia(idx)} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '10px', borderRadius: '6px', cursor: 'pointer' }} title="Eliminar">
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <button 
                onClick={guardarPlanilla}
                disabled={guardando}
                style={{ width: '100%', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '18px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' }}
              >
                {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />}
                {guardando ? 'Guardando en la Base de Datos...' : 'Guardar Evaluación de este Estudiante'}
              </button>

              {mensajeExito && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontWeight: 'bold', animation: 'fadeIn 0.3s' }}>
                  <FaCheckCircle size={20} /> ¡Evaluación guardada exitosamente!
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanillaPreescolarContenido() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}>Cargando planilla...</div>}>
      <ContenidoPlanillaPreescolar />
    </Suspense>
  )
}