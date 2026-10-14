'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { FaSignOutAlt, FaHome, FaBars, FaTimes, FaCalendarAlt, FaPencilAlt, FaBell } from 'react-icons/fa'
import { useEffect, useState } from 'react'
import sidebarStyles from 'app/styles/components/PlatformSidebar.module.scss'
import horarioStyles from 'app/styles/pages/Horario.module.scss'
import { EVENTO_NOTIFICACIONES } from 'app/utils/horario/comun'
import { contarNotificacionesNoLeidas } from 'app/app/plataformas/profesores/notificaciones/actions'

export default function TeacherSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [noLeidas, setNoLeidas] = useState(0)
  const [supabase] = useState(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Contador de notificaciones: al cambiar de página, cada 2 minutos y cuando se marcan como leídas
  useEffect(() => {
    const actualizar = () => { contarNotificacionesNoLeidas().then(setNoLeidas).catch(() => {}) }
    actualizar()
    const intervalo = setInterval(actualizar, 120000)
    window.addEventListener(EVENTO_NOTIFICACIONES, actualizar)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener(EVENTO_NOTIFICACIONES, actualizar)
    }
  }, [pathname])

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const btnStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 15px', color: '#f8fafc', textDecoration: 'none', borderRadius: '8px', transition: 'background 0.2s' }

  return (
    <>
      <button
        type="button"
        className={sidebarStyles.menuButton}
        onClick={() => setMobileOpen(true)}
        aria-label={noLeidas ? `Abrir menú (${noLeidas} notificaciones sin leer)` : 'Abrir menú'}
        style={{ backgroundColor: '#1e293b' }}
      >
        <FaBars />
        {noLeidas > 0 && <span className={horarioStyles.menuDot} />}
      </button>

      <div
        className={`${sidebarStyles.overlay} ${mobileOpen ? sidebarStyles.open : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`${sidebarStyles.sidebar} ${mobileOpen ? sidebarStyles.open : ''}`}
        style={{ backgroundColor: '#1e293b' }}
      >
        <button
          type="button"
          className={sidebarStyles.closeButton}
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <FaTimes />
        </button>

        {/* CABECERA DEL MENÚ */}
        <div style={{ padding: '25px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#10b981' }}>Ludo Club</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', marginTop: '5px' }}>Portal Docente</p>
        </div>

        {/* ZONA DE NAVEGACIÓN */}
        <nav style={{ flex: 1, padding: '20px 15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          <Link
            href="/plataformas/profesores/dashboard"
            style={{ ...btnStyle, backgroundColor: pathname?.includes('/dashboard') ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: pathname?.includes('/dashboard') ? '#10b981' : '#f8fafc' }}
          >
            <FaHome /> Inicio / Mis Clases
          </Link>

          <Link
            href="/plataformas/profesores/horario"
            style={{ ...btnStyle, backgroundColor: pathname?.includes('/horario') ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: pathname?.includes('/horario') ? '#10b981' : '#f8fafc' }}
          >
            <FaCalendarAlt /> Mi Horario
          </Link>

          <Link
            href="/plataformas/profesores/planeacion"
            style={{ ...btnStyle, backgroundColor: pathname?.includes('/planeacion') ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: pathname?.includes('/planeacion') ? '#10b981' : '#f8fafc' }}
          >
            <FaPencilAlt /> Planeación Semanal
          </Link>

          <Link
            href="/plataformas/profesores/notificaciones"
            style={{ ...btnStyle, backgroundColor: pathname?.includes('/notificaciones') ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: pathname?.includes('/notificaciones') ? '#10b981' : '#f8fafc' }}
          >
            <FaBell /> Notificaciones
            {noLeidas > 0 && <span className={horarioStyles.badge}>{noLeidas > 99 ? '99+' : noLeidas}</span>}
          </Link>

          {/* Aquí luego agregaremos más opciones como: "Circulares", "Mi Perfil", etc. */}

        </nav>

        {/* BOTÓN DE SALIDA */}
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={cerrarSesion}
            style={{ width: '100%', padding: '12px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem', fontWeight: 'bold' }}
          >
            <FaSignOutAlt /> Cerrar Sesión
          </button>
        </div>

      </aside>
    </>
  )
}
