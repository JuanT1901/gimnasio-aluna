import Sidebar from 'app/components/Sidebar'
import styles from 'app/styles/pages/Dashboard.module.scss'

export default function EstudianteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.dashboardContainer}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
