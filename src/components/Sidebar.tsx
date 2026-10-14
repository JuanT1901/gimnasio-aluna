'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from 'app/components/LogoutButton'
import styles from 'app/styles/pages/Dashboard.module.scss'
import sidebarStyles from 'app/styles/components/PlatformSidebar.module.scss'
import {
  FaUserGraduate,
  FaFilePdf,
  FaChevronDown,
  FaGlobe,
  FaUsers,
  FaFileSignature,
  FaBars,
  FaTimes,
  FaCalendarAlt,
  FaFileAlt,
  FaPlus,
  FaList
} from 'react-icons/fa'

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (path: string) => pathname === path ? styles.active : ''

  const isCircularActive = pathname.includes('/circulares')
  const isCertificadoActive = pathname.includes('/certificados')

  return (
    <>
      <button
        type="button"
        className={sidebarStyles.menuButton}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        style={{ backgroundColor: '#3CA0E8' }}
      >
        <FaBars />
      </button>

      <div
        className={`${sidebarStyles.overlay} ${mobileOpen ? sidebarStyles.open : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`${sidebarStyles.sidebar} ${mobileOpen ? sidebarStyles.open : ''}`}
        style={{ backgroundColor: 'white', borderRight: '1px solid #e2e8f0', padding: '20px', color: '#64748b' }}
      >
        <button
          type="button"
          className={sidebarStyles.closeButton}
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          style={{ color: '#64748b' }}
        >
          <FaTimes />
        </button>

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

          <Link
            href="/plataformas/estudiantes/horario"
            className={isActive('/plataformas/estudiantes/horario')}
          >
            <FaCalendarAlt /> Mi Horario
          </Link>

          <Link
            href="/plataformas/estudiantes/boletines"
            className={isActive('/plataformas/estudiantes/boletines')}
          >
            <FaFileSignature /> Mis Boletines
          </Link>

          <details className={styles.detailsMenu} open={isCertificadoActive}>
            <summary className={`${styles.summary} ${isCertificadoActive ? styles.activeSummary : ''}`}>
              <div className={styles.summaryContent}>
                <FaFileAlt /> Certificados
              </div>
              <FaChevronDown className={styles.chevron} />
            </summary>

            <div className={styles.submenu}>
              <Link
                href="/plataformas/estudiantes/certificados"
                className={isActive('/plataformas/estudiantes/certificados')}
              >
                <FaPlus /> Solicitar certificado
              </Link>
              <Link
                href="/plataformas/estudiantes/certificados/solicitados"
                className={isActive('/plataformas/estudiantes/certificados/solicitados')}
              >
                <FaList /> Solicitados
              </Link>
            </div>
          </details>

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
    </>
  )
}
