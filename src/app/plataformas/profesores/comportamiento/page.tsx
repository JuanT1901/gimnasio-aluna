/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaArrowLeft, FaSave, FaSpinner, FaCheckCircle, FaStar, FaLightbulb, FaCheck, FaClock, FaEdit, FaTrash, FaTimes, FaCalculator } from 'react-icons/fa'
import { guardarConvivenciaAction, eliminarConvivenciaAction } from '../actions'

function ContenidoComportamiento() {
  const searchParams = useSearchParams()
  const curso = searchParams.get('curso')

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

  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(false)
  const [bancoConvivencia, setBancoConvivencia] = useState<any[]>([])
  
  const [evaluacionGuardada, setEvaluacionGuardada] = useState<any>(null)
  const [modoEdicion, setModoEdicion] = useState(false)

  const [competencia, setCompetencia] = useState('')
  const [desempeno, setDesempeno] = useState('')
  
  // 🌟 EL ESTADO DE LA NOTA
  const [nota, setNota] = useState<string>('')
  
  const compRef = useRef<HTMLTextAreaElement>(null)
  const desRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!curso) return
    const cargarDatos = async () => {
      setCargandoLista(true)
      
      const { data: estData } = await supabase
        .from('profiles')
        .select('id, full_name, doc_number')
        .eq('role', 'student')
        .eq('course_name', curso)
        .order('full_name', { ascending: true })
      
      if (estData) setEstudiantes(estData)

      const { data: evalData } = await supabase
        .from('behavior_evaluations')
        .select('*')
        .eq('course_name', curso)
        .eq('period', parseInt(periodo))

      if (evalData) {
        setEvaluacionesGlobales(evalData)
        
        const bancoUnico = new Map()
        evalData.forEach(ev => {
          if (ev.competencia && ev.desempeno && !bancoUnico.has(ev.competencia)) {
            bancoUnico.set(ev.competencia, ev.desempeno)
          }
        })
        setBancoConvivencia(Array.from(bancoUnico, ([comp, des]) => ({ competencia: comp, desempeno: des })))
      }

      setCargandoLista(false)
    }
    
    cargarDatos()
  }, [curso, periodo, vistaActual, supabase])

  useEffect(() => {
    if (vistaActual !== 'formulario' || !estudianteActivo) return
    
    const evPrevia = evaluacionesGlobales.find(e => e.student_id === estudianteActivo.id)

    if (evPrevia) {
      setEvaluacionGuardada(evPrevia)
      setModoEdicion(false)
    } else {
      setEvaluacionGuardada(null)
      setModoEdicion(true)
      setCompetencia('')
      setDesempeno('')
      setNota('') 
      
      setTimeout(() => {
        autoResize(compRef.current)
        autoResize(desRef.current)
      }, 50)
    }
  }, [vistaActual, estudianteActivo, evaluacionesGlobales])

  const autoResize = (elemento: HTMLTextAreaElement | null) => {
    if (elemento) {
      elemento.style.height = 'auto'
      elemento.style.height = `${elemento.scrollHeight}px`
    }
  }

  const seleccionarDelBanco = (indexBco: number) => {
    if (indexBco === -1) return 
    const seleccion = bancoConvivencia[indexBco]
    setCompetencia(seleccion.competencia)
    setDesempeno(seleccion.desempeno)
    setTimeout(() => {
      autoResize(compRef.current)
      autoResize(desRef.current)
    }, 50)
  }

  const prepararEdicion = () => {
    setCompetencia(evaluacionGuardada.competencia)
    setDesempeno(evaluacionGuardada.desempeno)
    setNota(evaluacionGuardada.score?.toString() || evaluacionGuardada.grade?.toString() || '')
    setModoEdicion(true)
    setTimeout(() => {
      autoResize(compRef.current)
      autoResize(desRef.current)
    }, 50)
  }

  const eliminarEvaluacion = async () => {
    if (!evaluacionGuardada) return
    if (!confirm('¿Estás seguro de que deseas eliminar la evaluación de convivencia de este estudiante?')) return

    const resultado = await eliminarConvivenciaAction(evaluacionGuardada.id, curso!)

    if (!resultado.exito) {
      alert(resultado.error || 'Error al eliminar.')
    } else {
      setEvaluacionGuardada(null)
      setModoEdicion(true)
      setCompetencia('')
      setDesempeno('')
      setNota('')
      setEvaluacionesGlobales(prev => prev.filter(e => e.id !== evaluacionGuardada.id))
    }
  }

  // 🌟 CALCULADORA DE ESCALA
  const calcularEscala = (valor: string) => {
    const n = parseFloat(valor);
    if (isNaN(n)) return '-';
    if (n < 3.0) return 'Iniciado';
    if (n < 4.0) return 'En proceso';
    return 'Alcanzado';
  };

  const guardarConvivencia = async () => {
    if (!estudianteActivo) return
    if (!competencia || !desempeno) return alert('Debes llenar tanto la competencia como el desempeño.')
    
    const numNota = parseFloat(nota);
    if (isNaN(numNota) || numNota < 0 || numNota > 5.0) {
      return alert('Debes ingresar una calificación numérica válida entre 0.0 y 5.0');
    }

    setGuardando(true)
    const escalaCalculada = calcularEscala(nota);

    const resultado = await guardarConvivenciaAction({
      student_id: estudianteActivo.id,
      course_name: curso!,
      period: parseInt(periodo),
      competencia: competencia,
      desempeno: desempeno,
      score: numNota,
      scale: escalaCalculada
    })

    setGuardando(false)

    if (!resultado.exito) {
      alert(resultado.error || 'Hubo un error al guardar la convivencia.')
    } else {
      setEvaluacionGuardada(resultado.data)
      setModoEdicion(false) 
      setMensajeExito(true)
      setTimeout(() => setMensajeExito(false), 3000)
    }
  }

  if (cargandoLista) return <div style={{ textAlign: 'center', marginTop: '50px' }}><FaSpinner className="fa-spin" size={40} color="#f59e0b" /></div>

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {vistaActual === 'lista' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <Link href="/plataformas/profesores/dashboard" style={{ color: '#64748b', fontSize: '1.2rem' }}>
              <FaArrowLeft />
            </Link>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, color: '#b45309', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaStar color="#f59e0b" /> Convivencia
              </h1>
              <p style={{ margin: 0, color: '#92400e', fontWeight: 'bold' }}>Director de {curso}</p>
            </div>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '2px solid #f59e0b', fontWeight: 'bold', color: '#92400e', outline: 'none', backgroundColor: '#fffbeb' }}>
              <option value="1">1° Periodo</option>
              <option value="2">2° Periodo</option>
              <option value="3">3° Periodo</option>
            </select>
          </header>

          <div className={styles.card} style={{ overflow: 'hidden', borderTop: '4px solid #f59e0b' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#fffbeb', borderBottom: '2px solid #fde68a', color: '#92400e' }}>
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
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><FaCheck /> Evaluado</span>
                        ) : (
                          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><FaClock /> Pendiente</span>
                        )}
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        <button 
                          onClick={() => { setEstudianteActivo(est); setVistaActual('formulario'); }}
                          style={{ backgroundColor: yaEvaluado ? '#f8fafc' : '#f59e0b', color: yaEvaluado ? '#64748b' : 'white', border: yaEvaluado ? '1px solid #cbd5e1' : 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          {yaEvaluado ? 'Ver' : 'Evaluar'}
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
          
          <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #f59e0b' }}>
            <button onClick={() => setVistaActual('lista')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>
              <FaArrowLeft />
            </button>
            <div style={{ flex: 1 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#1e293b' }}>
                {estudianteActivo.full_name}
              </h2>
              <p style={{ margin: 0, color: '#b45309', fontWeight: 'bold', marginTop: '5px' }}>
                Convivencia - {curso} - Periodo {periodo}
              </p>
            </div>
          </header>

          {!modoEdicion && evaluacionGuardada && (
            <div className={styles.card} style={{ marginBottom: '30px', borderTop: '4px solid #10b981', backgroundColor: '#f0fdf4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #bbf7d0', paddingBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#166534', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FaCheckCircle /> Evaluación Registrada
                </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={prepararEdicion} style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaEdit /> Editar
                  </button>
                  <button onClick={eliminarEvaluacion} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaTrash /> Eliminar
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#166534', display: 'block', marginBottom: '5px' }}>Calificación:</strong>
                  <p style={{ margin: 0, color: '#334155', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {evaluacionGuardada.score ?? evaluacionGuardada.grade ?? 'N/A'}
                  </p>
                </div>
                <div style={{ flex: 2 }}>
                  <strong style={{ color: '#166534', display: 'block', marginBottom: '5px' }}>Escala (Boletín):</strong>
                  <p style={{ margin: 0, backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: 'bold', textTransform: 'uppercase', color: '#15803d' }}>
                    {evaluacionGuardada.scale ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#166534', display: 'block', marginBottom: '5px' }}>Competencia:</strong>
                <p style={{ margin: 0, color: '#334155', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>{evaluacionGuardada.competencia}</p>
              </div>
              <div>
                <strong style={{ color: '#166534', display: 'block', marginBottom: '5px' }}>Desempeño:</strong>
                <p style={{ margin: 0, color: '#334155', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>{evaluacionGuardada.desempeno}</p>
              </div>
            </div>
          )}

          {modoEdicion && (
            <>
              <div className={styles.card} style={{ marginBottom: '30px', borderTop: evaluacionGuardada ? '4px solid #f59e0b' : '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#1e293b' }}>
                    {evaluacionGuardada ? 'Actualizar Convivencia' : 'Redactar Evaluación'}
                  </h3>
                  
                  {bancoConvivencia.length > 0 && !evaluacionGuardada && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fef3c7', padding: '5px 15px', borderRadius: '20px', border: '1px solid #fde68a' }}>
                      <FaLightbulb color="#d97706" />
                      <select 
                        onChange={(e) => seleccionarDelBanco(Number(e.target.value))}
                        style={{ background: 'transparent', border: 'none', color: '#b45309', fontWeight: 'bold', outline: 'none', cursor: 'pointer', maxWidth: '200px', textOverflow: 'ellipsis' }}
                      >
                        <option value="-1">Reutilizar textos...</option>
                        {bancoConvivencia.map((item, idx) => (
                          <option key={idx} value={idx}>{item.competencia.substring(0, 40)}...</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                {/* 🌟 LA SECCIÓN DE LA NOTA */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FaCalculator color="#3b82f6" /> Calificación Final (0.0 a 5.0)
                    </label>
                    <input 
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      placeholder="Ej: 4.5"
                      style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b' }}
                    />
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', marginBottom: '5px' }}>Escala en Boletín:</span>
                    <div style={{ padding: '15px', borderRadius: '8px', backgroundColor: nota === '' ? '#e2e8f0' : '#dcfce7', color: nota === '' ? '#94a3b8' : '#15803d', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', textTransform: 'uppercase' }}>
                      {calcularEscala(nota)}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Competencia:</label>
                  <textarea 
                    ref={compRef}
                    rows={1}
                    value={competencia}
                    onChange={(e) => { setCompetencia(e.target.value); autoResize(e.target); }}
                    placeholder="Ej: Se relaciona armónicamente con sus compañeros..."
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none', overflow: 'hidden', fontFamily: 'inherit', fontSize: '1rem', minHeight: '50px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Desempeño:</label>
                  <textarea 
                    ref={desRef}
                    rows={1}
                    value={desempeno}
                    onChange={(e) => { setDesempeno(e.target.value); autoResize(e.target); }}
                    placeholder="Ej: Demuestra empatía, comparte sus materiales y respeta turnos..."
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none', overflow: 'hidden', fontFamily: 'inherit', fontSize: '1rem', minHeight: '50px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                {evaluacionGuardada && (
                  <button 
                    onClick={() => setModoEdicion(false)}
                    style={{ flex: 1, backgroundColor: 'white', color: '#64748b', border: '2px solid #cbd5e1', padding: '18px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                  >
                    <FaTimes /> Cancelar
                  </button>
                )}
                
                <button 
                  onClick={guardarConvivencia}
                  disabled={guardando}
                  style={{ flex: 2, backgroundColor: evaluacionGuardada ? '#f59e0b' : '#3b82f6', color: 'white', border: 'none', padding: '18px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                >
                  {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />}
                  {guardando ? 'Guardando...' : (evaluacionGuardada ? 'Actualizar' : 'Guardar Evaluación')}
                </button>
              </div>
            </>
          )}

          {mensajeExito && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontWeight: 'bold', animation: 'fadeIn 0.3s' }}>
              <FaCheckCircle size={20} /> ¡Convivencia guardada exitosamente!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ComportamientoPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando módulo de comportamiento...</div>}>
      <ContenidoComportamiento />
    </Suspense>
  )
}