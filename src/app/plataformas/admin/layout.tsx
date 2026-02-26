import { createClient } from 'app/utils/supabase/server'
import { redirect } from 'next/navigation'
import styles from 'app/styles/pages/Dashboard.module.scss'
import AdminSidebar from 'app/components/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Obtener el usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Buscar su perfil para verificar el ROL
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. LA BARRERA: Si no es admin, se expulsa al dashboard de estudiantes
  if (profile?.role !== 'admin') {
    redirect('/plataformas/estudiantes/dashboard')
  }

  // Si llega hasta aquí, Es la rectora. Le mostramos la interfaz.
  return (
    <div className={styles.dashboardContainer}>
      
      <AdminSidebar /> {/* <-- Insertamos el menú aquí */}

      {/* Aquí cargarán las páginas hijas (Dashboard, estudiantes, circulares) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
      
    </div>
  )
}