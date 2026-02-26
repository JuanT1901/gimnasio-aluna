import { createClient } from 'app/utils/supabase/server'
import Sidebar from 'app/components/Sidebar'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaFilePdf, FaDownload } from 'react-icons/fa'

type PageProps = {
  params: Promise<{ tipo: string }>
}

export function generateStaticParams() {
  return [
    { tipo: 'generales' },
    { tipo: 'específicas' },
  ];
}

export default async function CircularesPage({ params }: PageProps) {
  const supabase = await createClient()
  const resolvedParams = await params;
  const tipo = resolvedParams.tipo 

  // Verificar usuario
  const { data: { user } } = await supabase.auth.getUser()
  
  // Obtener grado del estudiante
  const { data: profile } = await supabase
    .from('profiles')
    .select('grade_id')
    .eq('id', user?.id)
    .single()

  // Consulta dinámica
  let query = supabase
    .from('circulars')
    .select('*')
    .order('created_at', { ascending: false })

  if (tipo === 'general') {
    query = query.eq('type', 'general')
  } else if (tipo === 'curso' && profile?.grade_id) {
    query = query.eq('type', 'curso').eq('grade_id', profile.grade_id)
  }

  const { data: circulars } = await query

  return (
    <div className={styles.dashboardContainer}>
      
      <Sidebar />

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1>Circulares {tipo === 'general' ? 'Generales' : 'de mi Curso'}</h1>
        </header>

        {/* GRILLA DE CIRCULARES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {circulars && circulars.length > 0 ? (
            circulars.map((circular) => (
              <div key={circular.id} className={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  <div style={{ background: '#ffebee', padding: '10px', borderRadius: '50%' }}>
                    <FaFilePdf size={24} color="#e11d48" />
                  </div>
                  <h3 style={{ fontSize: '1rem', margin: 0, color: '#333' }}>{circular.title}</h3>
                </div>
                
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px' }}>
                  Publicado: {new Date(circular.created_at).toLocaleDateString()}
                </p>
                
                <a 
                  href={circular.pdf_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: '#f1f5f9',
                    color: '#333',
                    textDecoration: 'none',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                >
                  <FaDownload style={{ marginRight: '8px' }}/> Descargar PDF
                </a>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>No hay circulares publicadas en esta sección.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}