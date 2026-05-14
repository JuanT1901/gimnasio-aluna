/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FaFileDownload, FaLock } from 'react-icons/fa'

const CURSOS_PREESCOLAR = ['Aventureros', 'Creativos', 'Expertos']
const CURSOS_PRIMARIA = ['Emprendedores', 'Ingeniosos', 'Transformadores']

function obtenerRutaBoletin(courseName: string) {
  if (CURSOS_PREESCOLAR.includes(courseName)) return 'preescolar'
  if (CURSOS_PRIMARIA.includes(courseName)) return 'primaria'
  return 'bachillerato'
}

export default function EstudianteBoletinesPage() {
  const [estudiante, setEstudiante] = useState<any>(null)
  const [estados, setEstados] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase.from('profiles').select('id, full_name, course_name').eq('id', user.id).single()
      setEstudiante(perfil)

      if (perfil) {
        // Consultamos la tabla por su ID específico
        const { data: pubData } = await supabase
          .from('student_report_status')
          .select('*')
          .eq('student_id', perfil.id)
          .eq('is_published', true)
        
        setEstados(pubData || [])
      }
      setCargando(false)
    }
    cargarDatos()
  }, [supabase])

  if (cargando) return <div style={{ textAlign: 'center', padding: '50px' }}>Cargando...</div>

  return (
    <main style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <h1 style={{ color: '#1e293b' }}>Mis Boletines</h1>
      <p style={{ color: '#64748b' }}>Estudiante: <strong>{estudiante?.full_name}</strong> | Curso: <strong>{estudiante?.course_name}</strong></p>

      <div style={{ marginTop: '30px', display: 'grid', gap: '20px' }}>
        {[1, 2, 3].map(p => {
          const estaPublicado = estados.some(e => e.period === p)
          return (
            <div key={p} style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Periodo {p}</h3>
                <p style={{ margin: '5px 0 0 0', color: estaPublicado ? '#15803d' : '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {estaPublicado ? '✅ Disponible para descarga' : '🔒 En proceso de evaluación'}
                </p>
              </div>

              {estaPublicado ? (
                <button
                  onClick={() => {
                    const ruta = obtenerRutaBoletin(estudiante?.course_name || '')
                    window.open(`/impresion/${ruta}?estudiante=${estudiante?.id}&periodo=${p}`, '_blank')
                  }}
                  style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <FaFileDownload /> Descargar
                </button>
              ) : (
                <div style={{ color: '#cbd5e1' }}><FaLock size={24} /></div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}