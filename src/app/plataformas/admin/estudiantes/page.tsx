import { createClient } from 'app/utils/supabase/server'
import styles from 'app/styles/pages/Dashboard.module.scss'
import StudentTable from './StudentTable'

export default async function GestionEstudiantesPage() {
  const supabase = await createClient()

  // 1. Obtener todos los perfiles registrados
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, grade_id')
    .order('role', { ascending: true })

  // 2. Obtener la lista de cursos en orden 
  const { data: grades } = await supabase
    .from('grades')
    .select('*')
    .order('order_index', { ascending: true })

  return (
    <main className={styles.mainContent}>
      <header className={styles.header}>
        <div>
          <h1>Gestión de Estudiantes 👥</h1>
          <p>Administra los perfiles y asigna los cursos a cada estudiante.</p>
        </div>
      </header>

      <StudentTable 
        initialProfiles={profiles || []} 
        grades={grades || []} 
      />
      
    </main>
  )
}