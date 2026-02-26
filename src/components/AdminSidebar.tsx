'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from 'app/components/LogoutButton'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { 
  FaUsers, 
  FaUserPlus,
  FaChalkboardTeacher,
  FaFileUpload,
  FaHome
} from 'react-icons/fa'

export default function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path ? styles.active : ''

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <h2>Aluna</h2>
        <span style={{ color: '#e11d48', fontWeight: 'bold' }}>Panel Rectoría</span>
      </div>
      
      <nav className={styles.nav}>
        <Link 
          href="/plataformas/admin/dashboard" 
          className={isActive('/plataformas/admin/dashboard')}
        >
          <FaHome /> Resumen
        </Link>
        
        {/* --- SECCIÓN ESTUDIANTES --- */}
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '15px', marginLeft: '15px', fontWeight: 'bold' }}>
          Estudiantes
        </div>
        
        <Link 
          href="/plataformas/admin/estudiantes" 
          className={isActive('/plataformas/admin/estudiantes')}
        >
          <FaUsers /> Gestión Estudiantes
        </Link>

        <Link 
          href="/plataformas/admin/estudiantes/importar" 
          className={isActive('/plataformas/admin/estudiantes/importar')}
        >
          <FaUserPlus /> Importación Masiva
        </Link>

        {/* --- SECCIÓN PROFESORES --- */}
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '15px', marginLeft: '15px', fontWeight: 'bold' }}>
          Equipo Docente
        </div>

        <Link 
          href="/plataformas/admin/profesores" 
          className={isActive('/plataformas/admin/profesores')}
        >
          <FaChalkboardTeacher /> Gestión Profesores
        </Link>

        {/* --- SECCIÓN DOCUMENTOS --- */}
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '15px', marginLeft: '15px', fontWeight: 'bold' }}>
          Documentos
        </div>

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