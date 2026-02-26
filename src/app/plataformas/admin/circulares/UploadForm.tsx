'use client'

import { useState } from 'react'
import { createClient } from 'app/utils/supabase/client'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaUpload, FaSpinner } from 'react-icons/fa'
import { useRouter } from 'next/navigation'

type Grade = { id: number; name: string; level: string }

export default function UploadForm({ grades }: { grades: Grade[] }) {
  const supabase = createClient()
  const router = useRouter()
  
  const [title, setTitle] = useState('')
  const [type, setType] = useState('general')
  const [gradeId, setGradeId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setMessage({ text: 'Por favor, selecciona un archivo PDF.', isError: true })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // 1. Crear un nombre único para el archivo (evita sobreescribir si se llaman igual)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      
      // 2. Subir el archivo al Storage de Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('circulars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // 3. Obtener la URL pública del archivo recién subido
      const { data: { publicUrl } } = supabase.storage
        .from('circulars')
        .getPublicUrl(fileName)

      // 4. Guardar el registro en la tabla 'circulars'
      const { error: dbError } = await supabase
        .from('circulars')
        .insert({
          title: title,
          pdf_url: publicUrl,
          type: type,
          grade_id: type === 'curso' ? Number(gradeId) : null
        })

      if (dbError) throw dbError

      // 5. ¡Éxito! Limpiar el formulario
      setMessage({ text: '¡Circular subida y publicada exitosamente!', isError: false })
      setTitle('')
      setFile(null)
      // Resetear el input file visualmente
      const fileInput = document.getElementById('fileInput') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      router.refresh()

    } catch (error: any) {
      console.error(error)
      setMessage({ text: `Error al subir: ${error.message}`, isError: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.card} style={{ maxWidth: '600px', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Título */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Título de la Circular</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.selectInput} 
            style={{ maxWidth: '100%' }}
            placeholder="Ej: Menú Escolar - Marzo"
            required 
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Dirigido a</label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className={styles.selectInput}
            style={{ maxWidth: '100%' }}
          >
            <option value="general">Todo el Colegio (General)</option>
            <option value="curso">Un Curso Específico</option>
          </select>
        </div>

        {type === 'curso' && (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Selecciona el Curso</label>
            <select 
              value={gradeId} 
              onChange={(e) => setGradeId(e.target.value)} 
              className={styles.selectInput}
              style={{ maxWidth: '100%' }}
              required
            >
              <option value="">-- Seleccionar --</option>
              {grades.map(grade => (
                <option key={grade.id} value={grade.id}>{grade.name} ({grade.level})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Archivo PDF</label>
          <input 
            id="fileInput"
            type="file" 
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ width: '100%', padding: '10px', border: '2px dashed #cbd5e1', borderRadius: '8px' }}
            required 
          />
        </div>

        {message && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            backgroundColor: message.isError ? '#fee2e2' : '#dcfce3',
            color: message.isError ? '#ef4444' : '#16a34a'
          }}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          className={styles.saveBtn} 
          style={{ padding: '15px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
          disabled={loading}
        >
          {loading ? <><FaSpinner className="fa-spin" /> Subiendo...</> : <><FaUpload /> Publicar Circular</>}
        </button>

      </form>
    </div>
  )
}