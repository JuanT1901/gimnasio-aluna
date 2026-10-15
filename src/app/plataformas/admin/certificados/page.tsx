'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FaFileAlt, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { Segmentado } from 'app/components/horario/HorarioSemanal'
import { EstadoPill } from 'app/components/certificados/Componentes'
import { REVISION_RECTORA } from 'app/utils/certificados/comun'
import { obtenerSolicitudes, type ResumenSolicitud } from './actions'

type Grupo = 'revisar' | 'espera' | 'enviados' | 'todas'

const EN_GRUPO: Record<Grupo, (s: ResumenSolicitud) => boolean> = {
  revisar: s => s.status === 'in_review' || (s.status !== 'sent' && s.reviewStatus === 'changes_requested'),
  espera: s => s.status === 'pending_payment' || s.status === 'payment_requested',
  enviados: s => s.status === 'sent',
  todas: () => true,
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export default function SolicitudesCertificadosPage() {
  const [solicitudes, setSolicitudes] = useState<ResumenSolicitud[]>([])
  const [grupo, setGrupo] = useState<Grupo>('revisar')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerSolicitudes().then(r => {
      if (r.exito) setSolicitudes(r.solicitudes!)
      else setError(r.error ?? 'No se pudieron cargar las solicitudes.')
      setCargando(false)
    })
  }, [])

  const contar = (g: Grupo) => solicitudes.filter(EN_GRUPO[g]).length
  const visibles = solicitudes.filter(EN_GRUPO[grupo])

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaFileAlt color="#3b82f6" /> Solicitudes de certificados</h1>
          <p>El acudiente confirma los datos en el borrador; tú confirmas el pago y generas el certificado firmado.</p>
        </div>
      </header>

      <div className={h.toolbar}>
        <Segmentado<Grupo>
          valor={grupo}
          onCambiar={setGrupo}
          opciones={[
            ['revisar', `Por revisar (${contar('revisar')})`], ['espera', `Esperando pago (${contar('espera')})`],
            ['enviados', `Enviados (${contar('enviados')})`], ['todas', `Todas (${contar('todas')})`],
          ]}
        />
      </div>

      {error ? <div className={h.errorBox}>{error}</div> : cargando ? (
        <div className={h.loading}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>
      ) : visibles.length === 0 ? (
        <div className={h.empty}>No hay solicitudes en este grupo.</div>
      ) : (
        <div className={c.reqs}>
          {visibles.map(s => (
            <Link key={s.id} href={`/plataformas/admin/certificados/${s.id}`} className={`${c.req} ${c.reqLink} ${s.nueva ? c.reqFresh : ''}`}>
              <div>
                <div className={c.rTitle}>
                  {s.nueva && <span className={c.newDot} aria-label="Nueva" />}
                  {s.typeName}{s.certYear ? ` ${s.certYear}` : ''} <small>{s.code}</small>
                </div>
                <div className={c.rMeta}>{s.studentName}{s.course ? ` · ${s.course}` : ''} · Solicitó {s.requesterName}</div>
                <div className={c.rTags}>
                  {s.origin === 'public' && <span className={`${h.pill} ${c.pillAlum}`}>Exalumno</span>}
                  {!s.registered && <span className={`${h.pill} ${c.pillWarn}`}>No registrado</span>}
                  {s.origin === 'portal' && s.status !== 'sent' && (
                    <span className={`${h.pill} ${s.reviewStatus === 'confirmed' ? h.pillPublished : s.reviewStatus === 'changes_requested' ? c.pillAsk : h.pillNone}`}>
                      {REVISION_RECTORA[s.reviewStatus]}
                    </span>
                  )}
                  {s.impreso && <span className={`${h.pill} ${h.pillNone}`}>Impreso</span>}
                  {s.status === 'in_review' && s.proofVia === 'upload' && <span className={`${h.pill} ${h.pillNone}`}>Comprobante subido</span>}
                  {s.status === 'in_review' && s.proofVia === 'whatsapp' && <span className={`${h.pill} ${h.pillNone}`}>Comprobante por WhatsApp</span>}
                </div>
              </div>
              <div className={c.rSide}>
                <EstadoPill estado={s.status} para="rectora" pagado={s.pagado} />
                <time dateTime={s.createdAt}>{fecha(s.createdAt)}</time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
