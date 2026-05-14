/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FaBook, FaSpinner, FaEdit, FaCheck, FaTimes, FaPlus, FaTrash, FaChevronDown, FaChevronUp, FaLayerGroup } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { renombrarMateria, crearMateria, eliminarMateria } from './actions'

const CURSOS_PREESCOLAR = ['Aventureros', 'Creativos', 'Expertos']

const MAPA_AREAS_RAW: Record<string, string> = {
  'Matematicas': 'Matemáticas',
  'Calculo Mental': 'Matemáticas',
  'Geometria': 'Matemáticas',
  'Estadistica': 'Matemáticas',
  'Estadisticas': 'Matemáticas',
  'Ciencias': 'Ciencias Naturales y Educación Ambiental',
  'Ciencias Naturales': 'Ciencias Naturales y Educación Ambiental',
  'Pre fisica': 'Ciencias Naturales y Educación Ambiental',
  'Pre quimica': 'Ciencias Naturales y Educación Ambiental',
  'Fisica': 'Ciencias Naturales y Educación Ambiental',
  'Quimica': 'Ciencias Naturales y Educación Ambiental',
  'Español': 'Humanidades',
  'Lectura critica': 'Humanidades',
  'Produccion textual': 'Humanidades',
  'Ingles': 'Humanidades',
  'Sociales': 'Ciencias Sociales',
  'Historia': 'Ciencias Sociales',
  'Geografia': 'Ciencias Sociales',
  'Emprendimiento': 'Ciencias Sociales',
  'Sistemas': 'Tecnología e Informática',
  'Arte': 'Educación Artística y Cultural',
  'Artes': 'Educación Artística y Cultural',
  'Educacion fisica': 'Educación Artística y Cultural',
  'Musica': 'Educación Artística y Cultural',
  'Convivencia': 'Comportamiento'
}

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

const MAPA_AREAS: Record<string, string> = {}
for (const [key, value] of Object.entries(MAPA_AREAS_RAW)) {
  MAPA_AREAS[normalizar(key)] = value
}

const buscarArea = (nombre: string) => MAPA_AREAS[normalizar(nombre)] || 'Otras Áreas'

const COLORES_AREA: Record<string, { bg: string, text: string, border: string }> = {
  'Matemáticas': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Ciencias Naturales y Educación Ambiental': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Humanidades': { bg: '#fefce8', text: '#a16207', border: '#fef08a' },
  'Ciencias Sociales': { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  'Tecnología e Informática': { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  'Educación Artística y Cultural': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'Comportamiento': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'Otras Áreas': { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
}

function agruparPorArea(materias: any[]) {
  const grupos: Record<string, any[]> = {}
  const ordenAreas = [
    'Matemáticas', 'Ciencias Naturales y Educación Ambiental', 'Humanidades',
    'Ciencias Sociales', 'Tecnología e Informática', 'Educación Artística y Cultural',
    'Comportamiento', 'Otras Áreas'
  ]

  materias.forEach(m => {
    const area = buscarArea(m.name)
    if (!grupos[area]) grupos[area] = []
    grupos[area].push(m)
  })

  return ordenAreas.filter(a => grupos[a]).map(a => ({ area: a, materias: grupos[a] }))
}

export default function MallaCurricularPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [cursos, setCursos] = useState<any[]>([])
  const [materiasPorCurso, setMateriasPorCurso] = useState<Record<string, any[]>>({})
  const [cargando, setCargando] = useState(true)

  const [cursoExpandido, setCursoExpandido] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [tempNombre, setTempNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [nuevaMateria, setNuevaMateria] = useState('')
  const [agregandoEnCurso, setAgregandoEnCurso] = useState<number | null>(null)

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const { data: cursosData } = await supabase
      .from('grades')
      .select('id, name')
      .order('name', { ascending: true })

    if (cursosData) setCursos(cursosData)

    const { data: materiasData } = await supabase
      .from('subjects')
      .select('id, name, grade_id')
      .order('name', { ascending: true })

    if (materiasData && cursosData) {
      const mapa: Record<string, any[]> = {}
      cursosData.forEach(c => { mapa[c.id] = [] })
      materiasData.forEach(m => {
        if (mapa[m.grade_id]) mapa[m.grade_id].push(m)
      })
      setMateriasPorCurso(mapa)
    }

    setCargando(false)
  }

  const iniciarEdicion = (materia: any) => {
    setEditandoId(materia.id)
    setTempNombre(materia.name)
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setTempNombre('')
  }

  const guardarEdicion = async (subjectId: number, gradeId: number) => {
    if (!tempNombre.trim()) return
    setGuardando(true)
    const resultado = await renombrarMateria(subjectId, tempNombre)
    setGuardando(false)

    if (resultado.exito) {
      setMateriasPorCurso(prev => ({
        ...prev,
        [gradeId]: prev[gradeId].map(m => m.id === subjectId ? { ...m, name: tempNombre.trim() } : m)
      }))
      cancelarEdicion()
    } else {
      alert('Error: ' + resultado.error)
    }
  }

  const agregarMateria = async (gradeId: number) => {
    if (!nuevaMateria.trim()) return
    setGuardando(true)
    const resultado = await crearMateria(gradeId, nuevaMateria)
    setGuardando(false)

    if (resultado.exito && resultado.data) {
      setMateriasPorCurso(prev => ({
        ...prev,
        [gradeId]: [...(prev[gradeId] || []), resultado.data].sort((a, b) => a.name.localeCompare(b.name))
      }))
      setNuevaMateria('')
      setAgregandoEnCurso(null)
    } else {
      alert('Error: ' + resultado.error)
    }
  }

  const borrarMateria = async (subjectId: number, gradeId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta materia?')) return
    setGuardando(true)
    const resultado = await eliminarMateria(subjectId)
    setGuardando(false)

    if (resultado.exito) {
      setMateriasPorCurso(prev => ({
        ...prev,
        [gradeId]: prev[gradeId].filter(m => m.id !== subjectId)
      }))
    } else {
      alert(resultado.error)
    }
  }

  const renderMateria = (materia: any, gradeId: number) => (
    <li key={materia.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
      {editandoId === materia.id ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <input
            type="text"
            value={tempNombre}
            onChange={(e) => setTempNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicion(materia.id, gradeId); if (e.key === 'Escape') cancelarEdicion() }}
            autoFocus
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '0.95rem', outline: 'none' }}
          />
          <button onClick={() => guardarEdicion(materia.id, gradeId)} disabled={guardando} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
            {guardando ? <FaSpinner className="fa-spin" size={14} /> : <FaCheck size={14} />}
          </button>
          <button onClick={cancelarEdicion} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
            <FaTimes size={14} />
          </button>
        </div>
      ) : (
        <>
          <span style={{ color: '#334155', fontWeight: '500' }}>{materia.name}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => iniciarEdicion(materia)} style={{ backgroundColor: '#eff6ff', color: '#3b82f6', border: 'none', padding: '7px', borderRadius: '6px', cursor: 'pointer' }} title="Renombrar">
              <FaEdit size={13} />
            </button>
            <button onClick={() => borrarMateria(materia.id, gradeId)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', padding: '7px', borderRadius: '6px', cursor: 'pointer' }} title="Eliminar">
              <FaTrash size={13} />
            </button>
          </div>
        </>
      )}
    </li>
  )

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '30px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaBook color="#3b82f6" /> Malla Curricular</h1>
          <p style={{ color: '#64748b' }}>Visualiza y edita las materias de cada curso del colegio.</p>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {cursos.map(curso => {
          const materias = materiasPorCurso[curso.id] || []
          const expandido = cursoExpandido === curso.id
          const esPreescolar = CURSOS_PREESCOLAR.includes(curso.name)

          return (
            <div key={curso.id} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <button
                onClick={() => setCursoExpandido(expandido ? null : curso.id)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', backgroundColor: expandido ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', borderBottom: expandido ? '1px solid #e2e8f0' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '10px', color: '#3b82f6' }}>
                    <FaBook size={18} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{curso.name}</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{materias.length} materia{materias.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div style={{ color: '#64748b' }}>
                  {expandido ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                </div>
              </button>

              {expandido && (
                <div style={{ padding: '15px 25px 20px' }}>
                  {materias.length === 0 ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '15px 0' }}>No hay materias registradas para este curso.</p>
                  ) : esPreescolar ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {materias.map(m => renderMateria(m, curso.id))}
                    </ul>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {agruparPorArea(materias).map(grupo => {
                        const colores = COLORES_AREA[grupo.area] || COLORES_AREA['Otras Áreas']
                        return (
                          <div key={grupo.area} style={{ border: `1px solid ${colores.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: colores.bg, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FaLayerGroup size={13} color={colores.text} />
                              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: colores.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{grupo.area}</span>
                              <span style={{ fontSize: '0.75rem', color: colores.text, opacity: 0.7 }}>({grupo.materias.length})</span>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {grupo.materias.map(m => renderMateria(m, curso.id))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {agregandoEnCurso === curso.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                      <input
                        type="text"
                        value={nuevaMateria}
                        onChange={(e) => setNuevaMateria(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') agregarMateria(curso.id); if (e.key === 'Escape') { setAgregandoEnCurso(null); setNuevaMateria('') } }}
                        placeholder="Nombre de la nueva materia"
                        autoFocus
                        style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '2px solid #10b981', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button onClick={() => agregarMateria(curso.id)} disabled={guardando} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {guardando ? <FaSpinner className="fa-spin" size={14} /> : <FaCheck size={14} />} Agregar
                      </button>
                      <button onClick={() => { setAgregandoEnCurso(null); setNuevaMateria('') }} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                        <FaTimes size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAgregandoEnCurso(curso.id); setNuevaMateria('') }}
                      style={{ marginTop: '15px', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px dashed #86efac', padding: '10px', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      <FaPlus size={12} /> Agregar Materia
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
