'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FaBell, FaCheckDouble, FaEdit, FaEyeSlash, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import { EVENTO_NOTIFICACIONES, formatoLargo } from 'app/utils/horario/comun'
import { marcarNotificacionLeida, marcarTodasLeidas, obtenerNotificaciones, type Notificacion } from './actions'

const TITULO: Record<Notificacion['kind'], string> = {
  plan_unpublished: 'La rectora despublicó tu planeación',
  plan_edited: 'La rectora editó tu planeación',
}

const avisarMenu = () => window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES))

export default function NotificacionesPage() {
  const router = useRouter()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerNotificaciones()
    if (r.exito) setNotificaciones(r.notificaciones!)
    else setError(r.error ?? 'No se pudieron cargar las notificaciones.')
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const marcarLeida = async (n: Notificacion) => {
    if (n.readAt) return
    const ahora = new Date().toISOString()
    setNotificaciones(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: ahora } : x)))
    await marcarNotificacionLeida(n.id)
    avisarMenu()
  }

  const verPlaneacion = async (n: Notificacion) => {
    await marcarLeida(n)
    router.push(`/plataformas/profesores/planeacion?semana=${n.semana}&plan=${n.planId}`)
  }

  const marcarTodas = async () => {
    const ahora = new Date().toISOString()
    setNotificaciones(prev => prev.map(x => ({ ...x, readAt: x.readAt ?? ahora })))
    await marcarTodasLeidas()
    avisarMenu()
  }

  const noLeidas = notificaciones.filter(n => !n.readAt).length

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaBell color="#10b981" /> Notificaciones</h1>
          <p>{noLeidas ? `Tienes ${noLeidas} notificación${noLeidas > 1 ? 'es' : ''} sin leer.` : 'Estás al día.'}</p>
        </div>
        {noLeidas > 0 && (
          <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={marcarTodas}>
            <FaCheckDouble size={12} /> Marcar todas como leídas
          </button>
        )}
      </header>

      {error ? <div className={h.errorBox}>{error}</div> : cargando ? (
        <div className={h.loading}><FaSpinner className="fa-spin" size={40} color="#10b981" /></div>
      ) : notificaciones.length === 0 ? (
        <div className={h.empty}>No tienes notificaciones. Aquí verás cuando la rectora despublique o edite alguna de tus planeaciones.</div>
      ) : (
        <div className={h.notifList}>
          {notificaciones.map(n => (
            <article key={n.id} className={`${h.notif} ${n.readAt ? '' : h.notifUnread}`}>
              <div className={`${h.notifIcon} ${n.kind === 'plan_unpublished' ? h.notifIconWarn : h.notifIconEdit}`}>
                {n.kind === 'plan_unpublished' ? <FaEyeSlash /> : <FaEdit />}
              </div>
              <div className={h.notifBody}>
                <div className={h.notifTitle}>
                  {!n.readAt && <span className={h.notifDot} aria-label="Sin leer" />}
                  {TITULO[n.kind]}
                </div>
                {n.planId ? (
                  <div className={h.notifMeta}>{n.subjectName} · {n.gradeName} · {formatoLargo(n.classDate!)}</div>
                ) : (
                  <div className={h.notifMeta}>La planeación ya no existe.</div>
                )}
                {n.message && (
                  <div className={h.noteBox}><strong>Observación</strong>{n.message}</div>
                )}
                {n.kind === 'plan_unpublished' && !n.message && (
                  <div className={h.notifMeta}>Los estudiantes ya no la ven. Revísala y súbela de nuevo.</div>
                )}
                <div className={h.notifFoot}>
                  <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  <span className={h.spacer} />
                  {!n.readAt && (
                    <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => marcarLeida(n)}>Marcar como leída</button>
                  )}
                  {n.planId && (
                    <button type="button" className={`${h.btn} ${h.btnGreen} ${h.btnSm}`} onClick={() => verPlaneacion(n)}>Ver planeación</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
