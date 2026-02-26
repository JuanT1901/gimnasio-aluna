'use client'

import { createClient } from 'app/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { FaSignOutAlt } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleLogout} className={styles.logoutBtn}>
      <FaSignOutAlt /> Cerrar Sesión
    </button>
  )
}