import { createClient } from 'app/utils/supabase/server'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaUsers, FaFilePdf, FaShieldAlt } from 'react-icons/fa'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id)
    .single()

  const nombre = profile?.full_name || 'Rectora'

  return (
    <main className={styles.mainContent}>
      <header className={styles.header}>
        <div>
          <h1>¡Hola, {nombre}! 👑</h1>
          <p>Bienvenida al panel de control del Gimnasio Aluna.</p>
        </div>
        <div className={styles.gradeBadge} style={{ borderLeftColor: '#e11d48' }}>
          <span>Rol</span>
          <strong>Administrador</strong>
        </div>
      </header>

      <div className={styles.statsGrid}>
        
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '50%' }}>
              <FaUsers size={24} color="#0284c7" />
            </div>
            <h3>Estudiantes</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Gestiona los perfiles y asigna a los estudiantes a sus respectivos cursos mágicos.
          </p>
        </div>

        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{ background: '#ffebee', padding: '15px', borderRadius: '50%' }}>
              <FaFilePdf size={24} color="#e11d48" />
            </div>
            <h3>Circulares</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Sube documentos en PDF para que los estudiantes y padres los puedan descargar.
          </p>
        </div>

        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{ background: '#fef3c7', padding: '15px', borderRadius: '50%' }}>
              <FaShieldAlt size={24} color="#d97706" />
            </div>
            <h3>Seguridad</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Recuerda cerrar sesión al terminar. Este panel tiene acceso total a la base de datos.
          </p>
        </div>

      </div>
    </main>
  )
}