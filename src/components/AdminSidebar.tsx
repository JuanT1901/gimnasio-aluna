'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from 'app/components/LogoutButton'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { 
  FaUserShield, 
  FaUsers, 
  FaFileUpload,
  FaHome
} from 'react-icons/fa'

export default function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname.startsWith(path) ? styles.active : ''

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <h2>Aluna</h2>
        <span style={{ color: '#e11d48', fontWeight: 'bold' }}>Panel Rectoría</span>
      </div>
      
      <nav className={styles.nav}>
        <Link 
          href="/plataformas/admin/dashboard" 
          className={pathname === '/plataformas/admin/dashboard' ? styles.active : ''}
        >
          <FaHome /> Resumen
        </Link>
        
        <Link 
          href="/plataformas/admin/estudiantes" 
          className={isActive('/plataformas/admin/estudiantes')}
        >
          <FaUsers /> Gestión Estudiantes
        </Link>

        <Link 
          href="/plataformas/admin/circulares" 
          className={isActive('/plataformas/admin/circulares')}
        >
          <FaFileUpload /> Subir Circulares
        </Link>
      </nav>

      <div className={styles.footerNav}>
        <LogoutButton />
      </div>
    </aside>
  )
}