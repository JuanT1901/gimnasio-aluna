'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FaArrowLeft, FaEye, FaPaperPlane, FaPlus, FaSave, FaSpinner, FaTrash } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { EstadoPill, VistaCertificado } from 'app/components/certificados/Componentes'
import {
  type CamposCertificado, type FilaNotas, type FormatoNotas,
  GRADOS_OFICIALES, METODOS_PAGO, MENSAJE_SOLICITAR_PAGO, NIVELES, REVISION_RECTORA, definitiva, nivelDeGrado,
} from 'app/utils/certificados/comun'
import {
  obtenerSolicitud, guardarDatosCertificado, vistaPreviaPdf, solicitarPago, confirmarPago, anularPago, generarYEnviar, reenviarCertificado,
  registrarExalumnoDeSolicitud, type DetalleSolicitud,
} from '../actions'

const DOCUMENTOS = ['Tarjeta de Identidad', 'Registro Civil', 'Cédula de Ciudadanía', 'Cédula de Extranjería', 'Pasaporte', 'NUIP']
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '')

const ORIGEN_NOTAS: Record<string, string> = {
  plataforma: 'Tomadas de las planillas del año en curso. Los periodos que aún no se han cerrado quedan vacíos.',
  historial: 'Tomadas del historial guardado al cerrar ese año.',
  manual: 'La plataforma no tiene las notas de ese año. Escribe las de los 3 periodos; la definitiva (promedio) se calcula sola.',
  guardado: 'Notas que ya revisaste y guardaste.',
}

export default function DetalleCertificadoPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<DetalleSolicitud | null>(null)
  const [campos, setCampos] = useState<CamposCertificado | null>(null)
  const [notas, setNotas] = useState<FilaNotas[] | null>(null)
  const [formato, setFormato] = useState<FormatoNotas>('primaria')
  const [metodo, setMetodo] = useState('')
  const [correo, setCorreo] = useState('')
  const [pidiendoPago, setPidiendoPago] = useState(false)
  const [mensajePago, setMensajePago] = useState(MENSAJE_SOLICITAR_PAGO)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [registro, setRegistro] = useState({ grado: '', anio: '' })

  const cargar = useCallback(async () => {
    const r = await obtenerSolicitud(Number(id))
    if (!r.exito || !r.detalle) { setError(r.error ?? 'No se pudo cargar la solicitud.'); return }
    setD(r.detalle)
    setCampos(r.detalle.campos)
    setNotas(r.detalle.notas)
    setFormato(r.detalle.formato)
    setCorreo(r.detalle.requesterEmail)
    setMetodo(r.detalle.paymentMethod ?? (r.detalle.proofVia === 'upload' ? 'Transferencia' : ''))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!d || !campos) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const enviado = d.status === 'sent'
  const cambiar = (k: keyof CamposCertificado, v: string) => {
    const numerico = k === 'anio' || k === 'matricula' || k === 'pension'
    const siguiente = { ...campos, [k]: numerico ? (v ? Number(v) : null) : v }
    if (k === 'grado' && v) siguiente.nivel = nivelDeGrado(v) || campos.nivel
    setCampos(siguiente)
    setPdfUrl(null)
  }
  const cambiarNota = (i: number, k: 'area' | 'subject' | 0 | 1 | 2, v: string) => {
    setNotas((notas ?? []).map((f, j) => {
      if (j !== i) return f
      if (typeof k === 'number') {
        const p = [...f.p]
        const n = parseFloat(v.replace(',', '.'))
        p[k] = v === '' || isNaN(n) ? null : Math.min(5, Math.max(0, n))
        return { ...f, p, def: definitiva(p) }
      }
      return { ...f, [k]: v }
    }))
    setPdfUrl(null)
  }

  const ejecutar = async (accion: string, fn: () => Promise<{ exito: boolean, error?: string }>, ok: string, recargar = true) => {
    setOcupado(accion)
    const r = await fn()
    setOcupado(null)
    if (!r.exito) { alert(r.error ?? 'Ocurrió un error.'); return false }
    setAviso(ok)
    if (recargar) await cargar()
    return true
  }

  const verPdf = async () => {
    setOcupado('pdf')
    const r = await vistaPreviaPdf(d.id, campos, notas, formato)
    setOcupado(null)
    if (!r.exito || !r.base64) { alert(r.error ?? 'No se pudo generar la vista previa.'); return }
    const bytes = Uint8Array.from(atob(r.base64), ch => ch.charCodeAt(0))
    setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })))
  }

  const enviar = async () => {
    const destino = d.porCorreo ? `se enviará a ${correo}` : 'quedará listo para imprimir'
    if (!confirm(`Se generará el certificado con la firma y ${destino}. ¿Continuar?`)) return
    await ejecutar('enviar', () => generarYEnviar(d.id, { campos, notas, formato, correo }),
      d.porCorreo ? `Certificado ${d.code} enviado a ${correo}.` : `Certificado ${d.code} generado. Ya lo puedes descargar e imprimir.`)
  }

  const pagado = !!d.paymentMethod
  const datosConfirmados = !d.pideRevision || d.reviewStatus === 'confirmed'
  const listoParaEnviar = pagado && datosConfirmados && (!d.porCorreo || !!correo.trim())
  const faltante = !datosConfirmados
    ? 'El acudiente debe confirmar en el borrador que los datos son correctos.'
    : !pagado ? 'Selecciona cómo pagó y marca la casilla de pago recibido.' : 'Escribe el correo de destino.'
  const marcarPago = (marcado: boolean) => (marcado
    ? ejecutar('confirmar', () => confirmarPago(d.id, metodo), `Pago registrado (${metodo}).`)
    : ejecutar('confirmar', () => anularPago(d.id), 'Se quitó la confirmación del pago.'))

  return (
    <main className={styles.mainContent}>
      <Link href="/plataformas/admin/certificados" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <FaArrowLeft size={11} /> Solicitudes
      </Link>
      <header className={styles.header} style={{ marginBottom: '20px' }}>
        <div>
          <h1>{d.tipoNombre}{campos.anio && d.tipo !== 'estudio' ? ` ${campos.anio}` : ''}</h1>
          <p>{d.code} · {d.studentName}{d.course ? ` · ${d.course}` : ''}</p>
        </div>
        <EstadoPill estado={d.status} para="rectora" pagado={pagado} />
      </header>

      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      {!d.registered && !enviado && (
        <div className={c.noteBox} style={{ marginBottom: '16px' }}>
          <strong>Exalumno no registrado</strong>
          No encontramos a esta persona en Exalumnos con el documento {campos.numeroDocumento}. Verifica sus datos en el archivo del colegio.
          <div className={h.toolbar} style={{ marginTop: '10px', marginBottom: 0 }}>
            <label className={h.field}>Último grado<select className={h.select} value={registro.grado} onChange={e => setRegistro({ ...registro, grado: e.target.value })}>
              <option value="">—</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></label>
            <label className={h.field}>Año de salida<input className={h.input} value={registro.anio} onChange={e => setRegistro({ ...registro, anio: e.target.value })} placeholder="Ej: 2022" /></label>
            <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={ocupado !== null}
              onClick={() => ejecutar('registro', () => registrarExalumnoDeSolicitud(d.id, registro.grado, registro.anio), 'Guardado en Exalumnos.')}>
              Guardar en Exalumnos
            </button>
          </div>
        </div>
      )}

      <div className={c.detail}>
        <div className={c.stack} style={{ minWidth: 0 }}>
          {!enviado && (
            <section className={c.panel}>
              <h3>Datos del certificado</h3>
              <p>El sistema los llenó con la información de la plataforma. Corrige lo que haga falta; la vista previa se actualiza sola.</p>
              <div className={c.formGrid}>
                <label className={`${h.field} ${c.full}`}>Nombre del estudiante<input className={h.input} value={campos.nombre} onChange={e => cambiar('nombre', e.target.value)} /></label>
                <label className={h.field}>Tipo de documento<select className={h.select} value={campos.tipoDocumento} onChange={e => cambiar('tipoDocumento', e.target.value)}>
                  {[...new Set([campos.tipoDocumento, ...DOCUMENTOS])].filter(Boolean).map(t => <option key={t}>{t}</option>)}</select></label>
                <label className={h.field}>Número<input className={h.input} value={campos.numeroDocumento} onChange={e => cambiar('numeroDocumento', e.target.value)} /></label>
                <label className={h.field}>Expedido en<input className={h.input} value={campos.ciudadDocumento} onChange={e => cambiar('ciudadDocumento', e.target.value)} placeholder="Ej: Zipaquirá" /></label>
                <label className={h.field}>Fecha de expedición<input className={h.input} type="date" value={campos.fecha} onChange={e => cambiar('fecha', e.target.value)} /></label>
                <label className={h.field}>Grado<select className={h.select} value={campos.grado} onChange={e => cambiar('grado', e.target.value)}>
                  <option value="">— Selecciona —</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></label>
                <label className={h.field}>Nivel<select className={h.select} value={campos.nivel} onChange={e => cambiar('nivel', e.target.value)}>
                  <option value="">— Selecciona —</option>{[...new Set([campos.nivel, ...NIVELES])].filter(Boolean).map(n => <option key={n}>{n}</option>)}</select></label>
                {d.tipo === 'estudio' && (
                  <>
                    <label className={h.field}>Matrícula (COP)<input className={h.input} type="number" min={0} step={1000} value={campos.matricula ?? ''} onChange={e => cambiar('matricula', e.target.value)} placeholder="Sin valor" /></label>
                    <label className={h.field}>Pensión mensual (COP)<input className={h.input} type="number" min={0} step={1000} value={campos.pension ?? ''} onChange={e => cambiar('pension', e.target.value)} placeholder="Sin valor" /></label>
                    <span className={`${c.hint} ${c.full}`}>{d.incluyeCostos ? 'El acudiente pidió incluir los costos; se llenan con los valores del curso en Configuración.' : 'El acudiente no pidió los costos.'} Si los dejas vacíos, no aparecen en el certificado.</span>
                  </>
                )}
                {d.tipo !== 'estudio' && (
                  <label className={h.field}>Año lectivo<input className={h.input} type="number" value={campos.anio ?? ''} onChange={e => cambiar('anio', e.target.value)} /></label>
                )}
                {d.tipo === 'notas' && (
                  <label className={h.field}>Formato de notas<select className={h.select} value={formato} onChange={e => { setFormato(e.target.value as FormatoNotas); setPdfUrl(null) }}>
                    <option value="preescolar">Preescolar</option><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select></label>
                )}
              </div>
            </section>
          )}

          {d.tipo === 'notas' && notas && !enviado && (
            <section className={c.panel}>
              <h3>Notas</h3>
              {d.origenNotas && <p>{ORIGEN_NOTAS[d.origenNotas]}</p>}
              <div className={c.tableWrap}>
                <table className={c.notesGrid}>
                  <thead><tr>{formato !== 'preescolar' && <th>Área</th>}<th>Asignatura</th><th>1P</th><th>2P</th><th>3P</th><th>DEF</th><th /></tr></thead>
                  <tbody>
                    {notas.map((f, i) => (
                      <tr key={i}>
                        {formato !== 'preescolar' && <td><input value={f.area} onChange={e => cambiarNota(i, 'area', e.target.value)} aria-label="Área" /></td>}
                        <td><input value={f.subject} onChange={e => cambiarNota(i, 'subject', e.target.value)} aria-label="Asignatura" /></td>
                        {[0, 1, 2].map(p => (
                          <td key={p} className={c.num}><input inputMode="decimal" value={f.p[p] ?? ''} onChange={e => cambiarNota(i, p as 0 | 1 | 2, e.target.value)} aria-label={`Periodo ${p + 1}`} /></td>
                        ))}
                        <td className={c.def}>{typeof f.def === 'number' ? f.def.toFixed(1) : ''}</td>
                        <td><button type="button" className={h.iconBtn} onClick={() => setNotas(notas.filter((_, j) => j !== i))} aria-label="Quitar fila"><FaTrash size={11} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} style={{ alignSelf: 'flex-start' }}
                onClick={() => setNotas([...notas, { area: notas[notas.length - 1]?.area ?? '', subject: '', p: [null, null, null], def: null }])}>
                <FaPlus size={10} /> Agregar fila
              </button>
            </section>
          )}

          {!enviado && (
            <div className={h.toolbar} style={{ marginBottom: 0 }}>
              <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={ocupado !== null}
                onClick={() => ejecutar('guardar', () => guardarDatosCertificado(d.id, campos, notas), 'Cambios guardados.', false)}>
                {ocupado === 'guardar' ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar cambios
              </button>
              <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={ocupado !== null} onClick={pdfUrl ? () => setPdfUrl(null) : verPdf}>
                {ocupado === 'pdf' ? <FaSpinner className="fa-spin" /> : <FaEye />} {pdfUrl ? 'Volver a la vista rápida' : 'Ver PDF final'}
              </button>
            </div>
          )}

          {pdfUrl
            ? <iframe src={pdfUrl} title="Vista previa del PDF" style={{ width: '100%', height: '900px', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white' }} />
            : <VistaCertificado tipo={d.tipo} campos={campos} colegio={d.colegio} formato={formato} notas={notas} codigo={d.code} verificacion={d.verificationCode} firmaUrl={d.firmaUrl} />}
        </div>

        <div className={c.stack}>
          <section className={c.panel}>
            <h3>Solicitud</h3>
            <dl className={c.kv}>
              <dt>Solicitó</dt><dd>{d.requesterName}</dd>
              {d.requesterPhone && <><dt>Celular</dt><dd>{d.requesterPhone}</dd></>}
              <dt>Fecha</dt><dd>{fecha(d.createdAt)}</dd>
              <dt>Origen</dt><dd>{d.origin === 'public' ? 'Página pública (exalumno)' : 'Portal del estudiante'}</dd>
              <dt>Entrega</dt><dd>{[d.porCorreo && 'Correo', d.impreso && 'Impreso'].filter(Boolean).join(' e ')}</dd>
            </dl>
            {d.comment && <div className={c.noteBox} style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}><strong style={{ color: '#64748b' }}>Comentario</strong>{d.comment}</div>}
          </section>

          {d.pideRevision && !enviado && (
            <section className={c.panel}>
              <h3>Datos del borrador</h3>
              <span className={`${h.pill} ${d.reviewStatus === 'confirmed' ? h.pillPublished : d.reviewStatus === 'changes_requested' ? c.pillAsk : h.pillNone}`} style={{ alignSelf: 'flex-start' }}>
                {REVISION_RECTORA[d.reviewStatus]}
              </span>
              {d.reviewStatus === 'pending' && <p>El acudiente ve el borrador sin firma ni consecutivo y debe confirmar que los datos son correctos.</p>}
              {d.reviewStatus === 'confirmed' && <p>El acudiente confirmó los datos el {fecha(d.reviewedAt)}.</p>}
              {d.reviewStatus === 'changes_requested' && (
                <div className={c.noteBox}>
                  <strong>Corrección pedida el {fecha(d.reviewedAt)}</strong>{d.reviewComment}
                  <br />Corrige los datos y oprime «Guardar cambios»: el acudiente verá el borrador corregido para confirmarlo.
                </div>
              )}
            </section>
          )}

          {enviado ? (
            <section className={c.panel}>
              <h3>{d.sentTo ? 'Certificado enviado' : 'Certificado generado'}</h3>
              <div className={c.okBox}>
                {d.sentTo ? <>Enviado a <b>{d.sentTo}</b> el {fecha(d.sentAt)}.</> : <>Generado el {fecha(d.sentAt)}.</>}
                {d.impreso && <> Pidieron una copia impresa: descárgalo e imprímelo. El acudiente ya ve que está listo para recoger.</>}<br />
                Pago: {d.paymentMethod}.<br />
                Código de verificación: <b>{d.verificationCode}</b>
              </div>
              <div className={h.toolbar} style={{ marginBottom: 0 }}>
                {d.pdfUrl && <a className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} href={d.pdfUrl} target="_blank" rel="noopener noreferrer">Descargar PDF</a>}
                {d.sentTo && (
                  <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} disabled={ocupado !== null}
                    onClick={() => ejecutar('reenviar', () => reenviarCertificado(d.id), 'Correo reenviado.', false)}>
                    {ocupado === 'reenviar' && <FaSpinner className="fa-spin" />} Reenviar correo
                  </button>
                )}
              </div>
            </section>
          ) : (
            <>
              <section className={c.panel}>
                <h3>Pago</h3>
                {d.proofVia === 'upload' && d.proofUrl ? (
                  <div className={c.receipt}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.proofIsPdf ? <p style={{ padding: '16px' }}>El comprobante es un PDF.</p> : <img src={d.proofUrl} alt="Comprobante de pago" />}
                    <div className={c.receiptCap}><span>Subido el {fecha(d.proofAt)}</span><a href={d.proofUrl} target="_blank" rel="noopener noreferrer">Ver completo</a></div>
                  </div>
                ) : d.proofVia === 'whatsapp' ? (
                  <p>El solicitante indicó el {fecha(d.proofAt)} que envió el comprobante por <b>WhatsApp</b> con el número {d.code}. Búscalo en el chat del colegio.</p>
                ) : (
                  <p>{pagado ? 'El pago se registró sin comprobante.' : 'Aún no hay comprobante. Si pagó en efectivo en el colegio, puedes confirmarlo aquí.'}</p>
                )}
                {d.status === 'payment_requested' && d.adminMessage && (
                  <div className={c.noteBox}><strong>Mensaje enviado al solicitante</strong>{d.adminMessage}</div>
                )}
                <div className={h.field}>
                  ¿Cómo pagó?
                  <div className={c.radioRow}>
                    {METODOS_PAGO.map(m => (
                      <label key={m} className={metodo === m ? c.radioOn : ''}>
                        <input type="radio" name="metodo" checked={metodo === m} disabled={pagado} onChange={() => setMetodo(m)} /> {m}
                      </label>
                    ))}
                  </div>
                </div>
                <label className={c.check}>
                  {ocupado === 'confirmar' ? <FaSpinner className="fa-spin" /> : <input type="checkbox" checked={pagado} disabled={!metodo || ocupado !== null} onChange={e => marcarPago(e.target.checked)} />}
                  Confirmo que el pago fue recibido.
                </label>
                {pagado && <span className={c.hint}>Quedó registrado en el sistema. El solicitante ya ve «Pago confirmado».</span>}
              </section>

              <section className={c.panel}>
                {d.porCorreo && <label className={h.field}>Enviar a<input className={h.input} type="email" value={correo} onChange={e => setCorreo(e.target.value)} /></label>}
                <button type="button" className={`${h.btn} ${h.btnBlue}`} disabled={!listoParaEnviar || ocupado !== null} onClick={enviar}>
                  {ocupado === 'enviar' ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />} {d.porCorreo ? 'Generar y enviar certificado' : 'Generar certificado final'}
                </button>
                <span className={c.hint}>{listoParaEnviar
                  ? `Se generará el PDF con la firma${d.porCorreo ? ' y se enviará por correo' : ''}.${d.impreso ? ' Pidieron copia impresa: después descárgalo e imprímelo.' : ''}`
                  : faltante}</span>

                {pidiendoPago ? (
                  <>
                    <label className={h.field}>Mensaje para el solicitante<textarea className={h.input} rows={4} value={mensajePago} onChange={e => setMensajePago(e.target.value)} /></label>
                    <div className={h.toolbar} style={{ marginBottom: 0 }}>
                      <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setPidiendoPago(false)}>Cancelar</button>
                      <button type="button" className={`${h.btn} ${h.btnWarn} ${h.btnSm}`} disabled={ocupado !== null}
                        onClick={async () => { if (await ejecutar('pago', () => solicitarPago(d.id, mensajePago), 'Mensaje enviado. El solicitante verá «Se solicita el pago del certificado».')) setPidiendoPago(false) }}>
                        Enviar mensaje
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" className={`${h.btn} ${h.btnWarn}`} onClick={() => setPidiendoPago(true)}>Solicitar el pago</button>
                    <span className={c.hint}>Úsalo si el pago no aparece. El solicitante verá «Se solicita el pago del certificado» con tu mensaje.</span>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
