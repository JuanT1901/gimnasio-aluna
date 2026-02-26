'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from 'app/components/LogoutButton'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { 
  FaUserGraduate, 
  FaBook, 
  FaChalkboardTeacher, 
  FaFilePdf, 
  FaChevronDown, 
  FaGlobe, 
  FaUsers 
} from 'react-icons/fa'

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path ? styles.active : ''

  const isCircularActive = pathname.includes('/circulares')

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <h2>Aluna</h2>
        <span>Plataforma</span>
      </div>
      
      <nav className={styles.nav}>
        <Link 
          href="/plataformas/estudiantes/dashboard" 
          className={isActive('/plataformas/estudiantes/dashboard')}
        >
          <FaUserGraduate /> Mi Perfil
        </Link>
        
        {/* MATERIAS (Oculto temporalmente) */}
        {/* <Link href="#" className={isActive('/materias')}>
          <FaBook /> Mis Materias
        </Link>
        */}

        <details className={styles.detailsMenu} open={isCircularActive}>
          <summary className={`${styles.summary} ${isCircularActive ? styles.activeSummary : ''}`}>
            <div className={styles.summaryContent}>
              <FaFilePdf /> Circulares
            </div>
            <FaChevronDown className={styles.chevron} />
          </summary>
          
          <div className={styles.submenu}>
            <Link 
              href="/plataformas/estudiantes/circulares/general"
              className={isActive('/plataformas/estudiantes/circulares/general')}
            >
              <FaGlobe /> Generales
            </Link>
            <Link 
              href="/plataformas/estudiantes/circulares/curso"
              className={isActive('/plataformas/estudiantes/circulares/curso')}
            >
              <FaUsers /> De mi Curso
            </Link>
          </div>
        </details>

      </nav>

      <div className={styles.footerNav}>
        <LogoutButton />
      </div>
    </aside>
  )
}