/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FaSpinner, FaSave, FaCheckCircle, FaSeedling } from 'react-icons/fa'
import { guardarSugerenciasPreescolar } from './actions'
import { normalizarTexto } from 'app/utils/horario/comun'

export default function SugerenciasPreescolarPage() {
  const [periodo, setPeriodo] = useState('1')
  const [dimensiones, setDimensiones] = useState<any[]>([])
  const [sugerencias, setSugerencias] = useState<Record<string, string>>({})

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(false)

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true)

      const { data: asignaciones } = await supabase
        .from('teacher_assignments')
        .select('subject_name, subject_id, grade_id')
        .in('course_name', ['Aventureros', 'Creativos', 'Expertos'])

      // Las materias que no se califican no llevan sugerencia en el boletín
      const { data: sinNota } = await supabase
        .from('subjects')
        .select('id, name, grade_id')
        .eq('is_graded', false)
      const noSeCalifica = (a: any) => (sinNota || []).some(m => m.grade_id === a.grade_id && (
        m.id === a.subject_id || normalizarTexto(m.name) === normalizarTexto(a.subject_name)
      ))

      if (asignaciones) {
        const dimensionesUnicas = Array.from(new Set(
          asignaciones.filter((a: any) => !noSeCalifica(a)).map((a: any) => a.subject_name.split('(')[0].trim())
        ))

        if (!dimensionesUnicas.includes('Dimensión socio-afectiva')) {
          dimensionesUnicas.push('Dimensión socio-afectiva')
        }

        setDimensiones(dimensionesUnicas.map(nombre => ({ name: nombre })))
      }

      const { data: sugData } = await supabase
        .from('preschool_suggestions')
        .select('dimension, suggestion_text')
        .eq('period', parseInt(periodo))

      const mapaSugerencias: Record<string, string> = {}
      sugData?.forEach(s => { mapaSugerencias[s.dimension] = s.suggestion_text })
      setSugerencias(mapaSugerencias)

      setCargando(false)
    }

    cargarDatos()
  }, [periodo, supabase])

  const handleCambioSugerencia = (dimension: string, texto: string) => {
    setSugerencias(prev => ({ ...prev, [dimension]: texto }))
  }

  const guardarSugerencias = async () => {
    setGuardando(true)

    const registros = dimensiones.map(dim => ({
      dimension: dim.name,
      period: parseInt(periodo),
      suggestion_text: sugerencias[dim.name] || ''
    }))

    const resultado = await guardarSugerenciasPreescolar(registros)
    setGuardando(false)

    if (resultado.exito) {
      setMensajeExito(true)
      setTimeout(() => setMensajeExito(false), 3000)
    } else {
      alert("Hubo un error al guardar las sugerencias.")
    }
  }

  return (
    <main style={{ padding: 'clamp(16px, 4vw, 40px)', maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaSeedling color="#10b981" /> Sugerencias de Preescolar
          </h1>
          <p style={{ color: '#64748b', margin: '5px 0 0 0' }}>
            Redacta las observaciones institucionales para los boletines de cada dimensión.
          </p>
        </div>

        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '2px solid #3b82f6', fontWeight: 'bold', outline: 'none' }}>
          <option value="1">1° Periodo</option>
          <option value="2">2° Periodo</option>
          <option value="3">3° Periodo</option>
        </select>
      </header>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '50px' }}><FaSpinner className="fa-spin" size={40} color="#10b981" /></div>
      ) : (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          {dimensiones.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center' }}>No hay dimensiones registradas para este curso.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {dimensiones.map((dim, idx) => (
                <div key={idx} style={{ borderBottom: idx !== dimensiones.length - 1 ? '1px solid #e2e8f0' : 'none', paddingBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', color: '#334155', marginBottom: '8px', fontSize: '1.1rem' }}>
                    {dim.name}
                  </label>
                  <textarea
                    rows={3}
                    value={sugerencias[dim.name] || ''}
                    onChange={(e) => handleCambioSugerencia(dim.name, e.target.value)}
                    placeholder={`Escribe la sugerencia para la dimensión ${dim.name.toLowerCase()}...`}
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '30px', borderTop: '2px solid #f1f5f9', paddingTop: '20px' }}>
            <button onClick={guardarSugerencias} disabled={guardando} style={{ width: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: guardando ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
              {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />}
              {guardando ? 'Guardando...' : 'Guardar Sugerencias'}
            </button>
          </div>

          {mensajeExito && (
            <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontWeight: 'bold', animation: 'fadeIn 0.3s' }}>
              <FaCheckCircle size={20} /> ¡Sugerencias guardadas exitosamente!
            </div>
          )}
        </div>
      )}
    </main>
  )
}