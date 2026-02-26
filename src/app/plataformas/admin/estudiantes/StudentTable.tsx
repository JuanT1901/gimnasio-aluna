'use client'

import { useState } from 'react'
import { createClient } from 'app/utils/supabase/client'
import styles from 'app/styles/pages/Dashboard.module.scss'

type Profile = { id: string; full_name: string; role: string; grade_id: number | null }
type Grade = { id: number; name: string; level: string; order_index: number }

export default function StudentTable({ 
  initialProfiles, 
  grades 
}: { 
  initialProfiles: Profile[], 
  grades: Grade[] 
}) {
  const supabase = createClient()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Función que se ejecuta al cambiar el select
  const handleGradeChange = (userId: string, newGradeId: string) => {
    setProfiles(profiles.map(p => 
      p.id === userId ? { ...p, grade_id: newGradeId ? Number(newGradeId) : null } : p
    ))
  }

  const saveGrade = async (userId: string, gradeId: number | null) => {
    setLoadingId(userId)
    
    const { error } = await supabase
      .from('profiles')
      .update({ grade_id: gradeId })
      .eq('id', userId)

    if (error) {
      alert('Error al actualizar el curso. Revisa los permisos.')
      console.error(error)
    } else {
      alert('¡Estudiante actualizado correctamente!')
    }
    
    setLoadingId(null)
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>Nombre del Estudiante</th>
            <th>Rol</th>
            <th>Curso Asignado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.id}>
              <td><strong>{profile.full_name || 'Sin Nombre'}</strong></td>
              <td>
                <span style={{ 
                  background: profile.role === 'admin' ? '#fee2e2' : '#e0f2fe',
                  color: profile.role === 'admin' ? '#ef4444' : '#0284c7',
                  padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold'
                }}>
                  {profile.role.toUpperCase()}
                </span>
              </td>
              <td>
                <select 
                  className={styles.selectInput}
                  value={profile.grade_id || ''}
                  onChange={(e) => handleGradeChange(profile.id, e.target.value)}
                  disabled={profile.role === 'admin'} // No le cambiamos el curso a la rectora
                >
                  <option value="">-- Sin Asignar --</option>
                  {grades.map(grade => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name} ({grade.level})
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {profile.role !== 'admin' && (
                  <button 
                    className={styles.saveBtn}
                    onClick={() => saveGrade(profile.id, profile.grade_id)}
                    disabled={loadingId === profile.id}
                  >
                    {loadingId === profile.id ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </td>
            </tr>
          ))}
          
          {profiles.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>
                No hay usuarios registrados aún.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}