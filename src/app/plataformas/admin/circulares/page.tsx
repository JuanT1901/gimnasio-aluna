/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from 'app/utils/supabase/server'
import styles from 'app/styles/pages/Dashboard.module.scss'
import UploadForm from './UploadForm'
import CircularsList from './CircularsList'

export default async function SubirCircularesPage() {
  const supabase = await createClient()

  // 1. Traer los cursos
  const { data: grades } = await supabase
    .from('grades')
    .select('id, name, level')
    .order('order_index', { ascending: true })

  // 2. Traer las circulares ya publicadas (con el nombre de su curso si aplica)
  const { data: circulars } = await supabase
    .from('circulars')
    .select(`
      id, title, type, pdf_url, created_at,
      grades ( name )
    `)
    .order('created_at', { ascending: false })

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '30px' }}>
        <div>
          <h1>Gestión de Circulares 📄</h1>
          <p>Sube y administra los documentos PDF para la comunidad.</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '50px' }}>
        
        <section>
          <h2 style={{ fontSize: '1.2rem', color: '#334155', marginBottom: '20px' }}>Nueva Circular</h2>
          <UploadForm grades={grades || []} />
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', color: '#334155', marginBottom: '20px' }}>Historial de Circulares</h2>
          <CircularsList circulars={circulars as any || []} />
        </section>

      </div>
      
    </main>
  )
}