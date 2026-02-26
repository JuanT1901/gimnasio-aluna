import LogoutButton from 'app/components/LogoutButton'
import styles from 'app/styles/pages/Dashboard.module.scss'

export default function ProfesoresDashboard() {
  return (
    <div className={styles.dashboardContainer} style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <header className={styles.header} style={{ textAlign: 'center' }}>
        <h1>¡Hola, Profe! 🍎</h1>
        <p>Tu panel de control está en construcción.</p>
        <br />
        <LogoutButton />
      </header>
    </div>
  )
}