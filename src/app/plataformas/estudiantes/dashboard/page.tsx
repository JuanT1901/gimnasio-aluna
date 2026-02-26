/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'app/utils/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from 'app/components/Sidebar'
import styles from 'app/styles/pages/Dashboard.module.scss'

export default async function Dashboard() {
  const supabase = await createClient()

  // 1. Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // 2. Obtener perfil del estudiante y su curso
  const { data } = await supabase
    .from('profiles')
    .select(`
      full_name,
      grades (
        name,
        level
      )
    `)
    .eq('id', user.id)
    .single()

  const profile = data as any
  const nombre = profile?.full_name || 'Estudiante'
  const grado = profile?.grades?.name || 'Sin Asignar'
  const nivel = profile?.grades?.level || ''

  return (
    <div className={styles.dashboardContainer}>
      
      {/* MENÚ LATERAL */}
      <Sidebar />

      {/* CONTENIDO PRINCIPAL (El Saludo) */}
      <main className={styles.mainContent}>
        
        <header className={styles.header}>
          <div>
            <h1>¡Hola, {nombre}! 👋</h1>
            <p>Bienvenido a tu espacio de aprendizaje.</p>
          </div>
          
          <div className={styles.gradeBadge}>
            <span>{nivel}</span>
            <strong>{grado}</strong>
          </div>
        </header>

        {/* Sección de aviso o relleno por ahora */}
        <section className={styles.coursesSection}>
          <h2>Novedades</h2>
          <div className={styles.emptyState}>
            <p>Usa el menú lateral para navegar por la plataforma y ver tus circulares.</p>
          </div>
        </section>

      </main>
    </div>
  )
}