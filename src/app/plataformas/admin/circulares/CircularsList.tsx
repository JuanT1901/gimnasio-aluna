'use client'

import { useState } from 'react'
import { createClient } from 'app/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { FaTrash, FaFilePdf, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'

type Circular = {
  id: number
  title: string
  type: string
  pdf_url: string
  created_at: string
  grades?: { name: string } | null
}

export default function CircularsList({ circulars }: { circulars: Circular[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (id: number, pdfUrl: string) => {
    // 1. Confirmación de seguridad
    if (!confirm('¿Estás segura de que deseas borrar esta circular? Esta acción no se puede deshacer.')) return

    setDeletingId(id)

    try {
      // 2. Extraer el nombre del archivo de la URL (para borrarlo del Storage)
      const urlParts = pdfUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]

      if (fileName) {
        await supabase.storage.from('circulars').remove([fileName])
      }

      // 3. Borrar el registro de la base de datos
      const { error } = await supabase.from('circulars').delete().eq('id', id)

      if (error) throw error

      // 4. Refrescar la página para actualizar la tabla
      router.refresh()

    } catch (error: any) {
      console.error(error)
      alert('Error al borrar la circular: ' + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={styles.tableContainer} style={{ marginTop: '20px' }}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Dirigido a</th>
            <th>Fecha de Publicación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {circulars.map((circular) => (
            <tr key={circular.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FaFilePdf color="#e11d48" size={20} />
                  <a href={circular.pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 'bold' }}>
                    {circular.title}
                  </a>
                </div>
              </td>
              <td>
                <span style={{ 
                  background: circular.type === 'general' ? '#fef3c7' : '#e0f2fe',
                  color: circular.type === 'general' ? '#d97706' : '#0284c7',
                  padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold'
                }}>
                  {circular.type === 'general' ? 'GENERAL' : circular.grades?.name?.toUpperCase() || 'CURSO'}
                </span>
              </td>
              <td>{new Date(circular.created_at).toLocaleDateString()}</td>
              <td>
                <button 
                  onClick={() => handleDelete(circular.id, circular.pdf_url)}
                  disabled={deletingId === circular.id}
                  style={{
                    background: '#fee2e2', color: '#ef4444', border: 'none', 
                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold'
                  }}
                >
                  {deletingId === circular.id ? <FaSpinner className="fa-spin" /> : <><FaTrash /> Borrar</>}
                </button>
              </td>
            </tr>
          ))}
          
          {circulars.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                No hay circulares publicadas en este momento.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}