'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FaCheck, FaDownload, FaEye, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { EstadoPill, OpcionesPago, Pasos, VistaCertificado } from 'app/components/certificados/Componentes'
import EnviarComprobante from 'app/components/certificados/EnviarComprobante'
import {
  obtenerMisSolicitudes, subirComprobante, avisarComprobanteWhatsapp, descargarMiCertificado, verBorrador, responderBorrador,
  type Borrador, type MiSolicitud,
} from '../actions'

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function Solicitados() {
  const nueva = Number(useSearchParams().get('nueva')) || null
  const [solicitudes, setSolicitudes] = useState<MiSolicitud[] | null>(null)
  const [pago, setPago] = useState<{ banco: string | null, efectivo: string | null }>({ banco: null, efectivo: null })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(nueva ? 'Solicitud enviada. Revisa el borrador del certificado y envía el comprobante de pago.' : null)
  const [borradores, setBorradores] = useState<Record<number, Borrador>>({})
  const [abierto, setAbierto] = useState<number | null>(nueva)
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [ocupado, setOcupado] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerMisSolicitudes()
    if (!r.exito) { setError(r.error ?? 'No se pudieron cargar tus solicitudes.'); return }
    setSolicitudes(r.solicitudes!)
    setPago(r.pago!)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // El borrador se pide al abrirlo; después de responder se descarta para traer la versión que corrija la rectora
  useEffect(() => {
    if (abierto === null || borradores[abierto]) return
    verBorrador(abierto).then(r => {
      if (r.exito && r.borrador) setBorradores(b => ({ ...b, [abierto]: r.borrador! }))
      else { alert(r.error ?? 'No se pudo cargar el borrador.'); setAbierto(null) }
    })
  }, [abierto, borradores])

  const responder = async (id: number, correcto: boolean) => {
    setOcupado(id)
    const r = await responderBorrador(id, correcto, correcto ? '' : comentario)
    setOcupado(null)
    if (!r.exito) { alert(r.error); return }
    setAviso(correcto ? 'Gracias. Le avisamos a la rectora que los datos son correctos.' : 'Le enviamos tu corrección a la rectora.')
    setCorrigiendo(null)
    setComentario('')
    setAbierto(null)
    setBorradores(b => { const resto = { ...b }; delete resto[id]; return resto })
    cargar()
  }

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
          <p>Revisa el borrador de cada certificado, envía el comprobante de pago y sigue el estado de tus solicitudes.</p>
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
                  <div className={c.rMeta}>{[s.porCorreo && `Se enviará a ${s.requesterEmail}`, s.impreso && 'Impreso para recoger en el colegio'].filter(Boolean).join(' · ')}</div>
                </div>
                <div className={c.rSide}>
                  <EstadoPill estado={s.status} para="acudiente" pagado={s.pagado} />
                  <time dateTime={s.createdAt}>{fecha(s.createdAt)}</time>
                </div>
                <div className={c.rBody}>
                  <Pasos estado={s.status} datosConfirmados={s.reviewStatus === 'confirmed'} pagado={s.pagado} />

                  {s.status !== 'sent' && (
                    <div className={s.reviewStatus === 'confirmed' ? c.okBox : c.noteBox}>
                      {s.reviewStatus === 'confirmed' && <>Confirmaste que los datos del certificado son correctos.</>}
                      {s.reviewStatus === 'pending' && <><strong>Revisa los datos del certificado</strong>Antes de firmarlo, confirma que el nombre, el documento y el grado están bien.</>}
                      {s.reviewStatus === 'changes_requested' && <><strong>Pediste una corrección</strong>{s.reviewComment} · La rectora la está revisando. Cuando la haga, aquí verás el borrador corregido.</>}
                      <div className={c.rActs} style={{ marginTop: '8px' }}>
                        <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setAbierto(abierto === s.id ? null : s.id)}>
                          <FaEye size={11} /> {abierto === s.id ? 'Ocultar borrador' : 'Ver borrador'}
                        </button>
                      </div>
                    </div>
                  )}

                  {abierto === s.id && s.status !== 'sent' && (
                    <RevisionBorrador
                      borrador={borradores[s.id]}
                      pendiente={s.reviewStatus === 'pending'}
                      corrigiendo={corrigiendo === s.id}
                      comentario={comentario}
                      ocupado={ocupado === s.id}
                      onComentario={setComentario}
                      onCorregir={v => { setCorrigiendo(v ? s.id : null); setComentario('') }}
                      onResponder={correcto => responder(s.id, correcto)}
                    />
                  )}

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
                    <span className={c.hint}>{s.pagado ? 'La rectora confirmó tu pago.' : `${s.proofVia === 'whatsapp' ? 'Indicaste que enviaste el comprobante por WhatsApp.' : 'Recibimos tu comprobante.'} La rectora lo está revisando.`} {s.reviewStatus === 'confirmed' ? 'Con los datos confirmados, ella genera el certificado firmado.' : 'Recuerda confirmar los datos del borrador.'}</span>
                  )}
                  {s.status === 'sent' && (
                    <>
                      {s.sentTo && <div className={c.okBox}>Enviado a <b>{s.sentTo}</b> el {fecha(s.sentAt)}. Si no lo ves, revisa la carpeta de correo no deseado.</div>}
                      {s.impreso && <div className={c.okBox}>El certificado impreso está listo para recoger en el colegio.</div>}
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

function RevisionBorrador({ borrador: b, pendiente, corrigiendo, comentario, ocupado, onComentario, onCorregir, onResponder }: {
  borrador: Borrador | undefined
  pendiente: boolean
  corrigiendo: boolean
  comentario: string
  ocupado: boolean
  onComentario: (v: string) => void
  onCorregir: (v: boolean) => void
  onResponder: (correcto: boolean) => void
}) {
  if (!b) return <div style={{ textAlign: 'center', padding: '20px' }}><FaSpinner className="fa-spin" size={24} color="#3CA0E8" /></div>
  if (b.notasPendientes) return <span className={c.hint}>Las notas de ese año no están en la plataforma y la rectora las está llenando. Cuando termine, aquí podrás revisar el borrador.</span>

  return (
    <>
      <VistaCertificado tipo={b.tipo} campos={b.campos} colegio={b.colegio} formato={b.formato} notas={b.notas} codigo={null} verificacion={null} firmaUrl={null} borrador />
      {pendiente && (corrigiendo ? (
        <>
          <label className={h.field}>¿Qué dato hay que corregir?
            <textarea className={h.input} rows={3} value={comentario} onChange={e => onComentario(e.target.value)} placeholder="Ej: El número de documento es 1.234.567.890." />
          </label>
          <div className={c.rActs}>
            <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => onCorregir(false)}>Cancelar</button>
            <button type="button" className={`${h.btn} ${h.btnWarn} ${h.btnSm}`} disabled={ocupado} onClick={() => onResponder(false)}>
              {ocupado && <FaSpinner className="fa-spin" />} Enviar corrección
            </button>
          </div>
        </>
      ) : (
        <div className={c.rActs}>
          <button type="button" className={`${h.btn} ${h.btnGreen} ${h.btnSm}`} disabled={ocupado} onClick={() => onResponder(true)}>
            {ocupado ? <FaSpinner className="fa-spin" /> : <FaCheck size={11} />} Los datos son correctos
          </button>
          <button type="button" className={`${h.btn} ${h.btnWarn} ${h.btnSm}`} onClick={() => onCorregir(true)}>Hay un error</button>
        </div>
      ))}
    </>
  )
}

export default function SolicitadosPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3CA0E8" /></div>}>
      <Solicitados />
    </Suspense>
  )
}
