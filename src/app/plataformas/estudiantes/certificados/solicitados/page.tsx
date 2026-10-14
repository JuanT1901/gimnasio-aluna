'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FaDownload, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { EstadoPill, OpcionesPago, Pasos } from 'app/components/certificados/Componentes'
import EnviarComprobante from 'app/components/certificados/EnviarComprobante'
import { obtenerMisSolicitudes, subirComprobante, avisarComprobanteWhatsapp, descargarMiCertificado, type MiSolicitud } from '../actions'

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function Solicitados() {
  const nueva = Number(useSearchParams().get('nueva')) || null
  const [solicitudes, setSolicitudes] = useState<MiSolicitud[] | null>(null)
  const [pago, setPago] = useState<{ banco: string | null, efectivo: string | null }>({ banco: null, efectivo: null })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(nueva ? 'Solicitud enviada. Ahora envía el comprobante de pago.' : null)

  const cargar = useCallback(async () => {
    const r = await obtenerMisSolicitudes()
    if (!r.exito) { setError(r.error ?? 'No se pudieron cargar tus solicitudes.'); return }
    setSolicitudes(r.solicitudes!)
    setPago(r.pago!)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const descargar = async (id: number) => {
    const r = await descargarMiCertificado(id)
    if (!r.exito || !r.url) { alert(r.error); return }
    // Se abre en la misma pestaña: una ventana nueva después de esperar al servidor la bloquean algunos navegadores
    window.location.assign(r.url)
  }

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!solicitudes) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3CA0E8" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1>Solicitados</h1>
          <p>Sigue el estado de tus solicitudes y envía el comprobante de pago.</p>
        </div>
        <Link href="/plataformas/estudiantes/certificados" className={`${h.btn} ${h.btnBlue}`}>Solicitar otro certificado</Link>
      </header>
      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      {solicitudes.length === 0 ? (
        <div className={h.empty}>Aún no has solicitado certificados.</div>
      ) : (
        <div className={c.reqs}>
          {solicitudes.map(s => {
            const puedePagar = s.status === 'pending_payment' || s.status === 'payment_requested'
            return (
              <article key={s.id} className={`${c.req} ${s.id === nueva ? c.reqFresh : ''}`}>
                <div>
                  <div className={c.rTitle}>{s.tipoNombre}{s.anio ? ` ${s.anio}` : ''} <small>{s.code}</small></div>
                  <div className={c.rMeta}>Se enviará a {s.requesterEmail}</div>
                </div>
                <div className={c.rSide}>
                  <EstadoPill estado={s.status} para="acudiente" pagado={s.pagado} />
                  <time dateTime={s.createdAt}>{fecha(s.createdAt)}</time>
                </div>
                <div className={c.rBody}>
                  <Pasos estado={s.status} />
                  {s.status === 'pending_payment' && <span className={c.hint}>Realiza el pago y luego envía el comprobante.</span>}
                  {s.status === 'payment_requested' && s.adminMessage && (
                    <div className={c.noteBox}><strong>Mensaje de rectoría</strong>{s.adminMessage}</div>
                  )}
                  {puedePagar && (
                    <>
                      {s.id === nueva && <OpcionesPago banco={pago.banco} efectivo={pago.efectivo} />}
                      <EnviarComprobante
                        codigo={s.code}
                        whatsappUrl={s.whatsapp}
                        onSubir={archivo => { const f = new FormData(); f.append('id', String(s.id)); f.append('comprobante', archivo); return subirComprobante(f) }}
                        onWhatsapp={() => avisarComprobanteWhatsapp(s.id)}
                        onListo={m => { setAviso(m); cargar() }}
                      />
                    </>
                  )}
                  {s.status === 'in_review' && (
                    <span className={c.hint}>{s.pagado ? 'La rectora confirmó tu pago y está preparando el certificado.' : `${s.proofVia === 'whatsapp' ? 'Indicaste que enviaste el comprobante por WhatsApp.' : 'Recibimos tu comprobante.'} La rectora lo está revisando.`} Te llegará al correo.</span>
                  )}
                  {s.status === 'sent' && (
                    <>
                      <div className={c.okBox}>Enviado a <b>{s.sentTo}</b> el {fecha(s.sentAt)}. Si no lo ves, revisa la carpeta de correo no deseado.</div>
                      <div className={c.rActs}><button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => descargar(s.id)}><FaDownload size={11} /> Descargar PDF</button></div>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default function SolicitadosPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3CA0E8" /></div>}>
      <Solicitados />
    </Suspense>
  )
}
