'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FaUsers, FaChalkboardTeacher, FaSpinner, FaCheckCircle } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { actualizarDirectorCurso } from './actions'

export default function AdminCursosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cursos, setCursos] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profesores, setProfesores] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [exitoId, setExitoId] = useState<string | null>(null)

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const { data: gradosData } = await supabase
      .from('grades')
      .select('id, name, director_id')
      .order('name', { ascending: true })

    if (gradosData) setCursos(gradosData)

    const { data: profesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'teacher')
      .order('full_name', { ascending: true })

    if (profesData) setProfesores(profesData)

    setCargando(false)
  }

  const actualizarDirector = async (cursoId: string, nuevoDirectorId: string) => {
    setGuardandoId(cursoId)

    const valorFinal = nuevoDirectorId === 'null' ? null : nuevoDirectorId

    const resultado = await actualizarDirectorCurso(cursoId, valorFinal)
    setGuardandoId(null)

    if (!resultado.exito) {
      alert('Error al asignar el director: ' + resultado.error)
    } else {
      setExitoId(cursoId)
      setTimeout(() => setExitoId(null), 2000)

      setCursos(cursos.map(c => c.id === cursoId ? { ...c, director_id: valorFinal } : c))
    }
  }

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '30px' }}>
        <h1>Gestión de Cursos y Directores 🏫</h1>
        <p style={{ color: '#64748b' }}>Asigna qué profesor es el Director de Grupo (Titular) para cada curso.</p>
      </header>

      <div className={styles.card} style={{ maxWidth: '900px', margin: '0 auto', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '15px 20px' }}>Curso / Grado</th>
              <th style={{ padding: '15px 20px' }}>Director de Grupo</th>
              <th style={{ padding: '15px 20px', width: '100px', textAlign: 'center' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {cursos.map((curso, index) => (
              <tr key={curso.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                
                <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '50%', color: '#3b82f6' }}>
                    <FaUsers size={16} />
                  </div>
                  {curso.name}
                </td>
                
                <td style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaChalkboardTeacher color="#64748b" />
                    <select 
                      value={curso.director_id || 'null'}
                      onChange={(e) => actualizarDirector(curso.id, e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '300px', backgroundColor: curso.director_id ? '#f0fdf4' : 'white' }}
                      disabled={guardandoId === curso.id}
                    >
                      <option value="null">-- Sin Director Asignado --</option>
                      {profesores.map(profe => (
                        <option key={profe.id} value={profe.id}>
                          {profe.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                
                <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                  {guardandoId === curso.id ? (
                    <FaSpinner className="fa-spin" color="#3b82f6" />
                  ) : exitoId === curso.id ? (
                    <FaCheckCircle color="#10b981" />
                  ) : null}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}