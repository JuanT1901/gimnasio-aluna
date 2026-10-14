'use client'

import c from 'app/styles/pages/Certificados.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import {
  type CamposCertificado, type Colegio, type EstadoSolicitud, type FilaNotas, type FormatoNotas, type TipoCertificado,
  ESTADO_ACUDIENTE, ESTADO_PAGADO, ESTADO_RECTORA, textoCertificado,
} from 'app/utils/certificados/comun'

export const CLASE_ESTADO: Record<EstadoSolicitud, string> = {
  pending_payment: h.pillNone,
  in_review: c.pillReview,
  payment_requested: c.pillAsk,
  sent: h.pillPublished,
}

export function EstadoPill({ estado, para, pagado = false }: { estado: EstadoSolicitud, para: 'acudiente' | 'rectora', pagado?: boolean }) {
  if (pagado && estado !== 'sent') return <span className={`${h.pill} ${h.pillPublished}`}>{ESTADO_PAGADO}</span>
  return <span className={`${h.pill} ${CLASE_ESTADO[estado]}`}>{(para === 'rectora' ? ESTADO_RECTORA : ESTADO_ACUDIENTE)[estado]}</span>
}

export function Pasos({ estado }: { estado: EstadoSolicitud }) {
  const actual = { pending_payment: 1, payment_requested: 1, in_review: 2, sent: 4 }[estado]
  return (
    <div className={c.steps}>
      {['Solicitado', 'Pago', 'Revisión', 'Enviado'].map((p, i) => (
        <span key={p} className={i < actual ? c.stepDone : i === actual ? c.stepNow : ''}>{p}</span>
      ))}
    </div>
  )
}

export function OpcionesPago({ banco, efectivo }: { banco: string | null, efectivo: string | null }) {
  return (
    <div className={c.payopts}>
      {/* Sin datos bancarios configurados, la opción no se muestra */}
      {banco && (
        <div className={c.payopt}>
          <span className={c.payIco} style={{ background: '#dbeafe', color: '#1d4ed8' }}>B</span>
          <div><strong>Consignación o transferencia</strong><span>{banco}</span></div>
        </div>
      )}
      <div className={c.payopt}>
        <span className={c.payIco} style={{ background: '#dcfce7', color: '#15803d' }}>E</span>
        <div><strong>Efectivo en el colegio</strong><span>{efectivo || 'Directamente con la rectora.'}</span></div>
      </div>
    </div>
  )
}

const ICONOS = {
  wa: <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#25d366" /><path d="M12 5.2a6.8 6.8 0 0 0-5.9 10.2L5.2 18.8l3.5-.9A6.8 6.8 0 1 0 12 5.2z" fill="none" stroke="#fff" strokeWidth="1.5" /><path d="M9.5 9c.2-.4.5-.4.7-.4h.5l.8 1.7-.5.8c.5.9 1.2 1.6 2.1 2.1l.8-.5 1.7.8v.5c0 .4-.4.9-1.1 1-1.7.2-5-2.8-5.1-4.6 0-.6.1-1.1.1-1.4z" fill="#fff" /></svg>,
  mail: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1d4ed8" /><rect x="6" y="8" width="12" height="8.5" rx="1.2" fill="none" stroke="#fff" strokeWidth="1.5" /><path d="M6.5 8.6 12 13l5.5-4.4" fill="none" stroke="#fff" strokeWidth="1.5" /></svg>,
  web: <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#e0f2fe" /><circle cx="12" cy="12" r="6.5" fill="none" stroke="#0284c7" strokeWidth="1.5" /><ellipse cx="12" cy="12" rx="2.8" ry="6.5" fill="none" stroke="#0284c7" strokeWidth="1.3" /><path d="M5.5 12h13" stroke="#0284c7" strokeWidth="1.3" /></svg>,
  pin: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a7.2 7.2 0 0 0-7.2 7.2c0 5.4 7.2 13.8 7.2 13.8s7.2-8.4 7.2-13.8A7.2 7.2 0 0 0 12 1.5z" fill="#dc2626" /><path d="M8.4 10.2 12 7.1l3.6 3.1v3.6H8.4z" fill="#fff" /></svg>,
}

const nota = (n: number | null) => (typeof n === 'number' ? n.toFixed(1) : '')

// Vista previa del certificado con el formato del colegio (el PDF final se genera en el servidor con el mismo texto)
export function VistaCertificado({ tipo, campos, colegio, formato, notas, codigo, verificacion, firmaUrl }: {
  tipo: TipoCertificado
  campos: CamposCertificado
  colegio: Colegio
  formato: FormatoNotas
  notas: FilaNotas[] | null
  codigo: string
  verificacion: string | null
  firmaUrl: string | null
}) {
  const texto = textoCertificado(tipo, campos, colegio, formato)
  const web = colegio.website.replace(/^https?:\/\//, '')
  const conArea = formato !== 'preescolar'
  const muchasFilas = (notas?.length ?? 0) > 18

  // Agrupa materias seguidas de la misma área para unir la celda del área
  const filas = (notas ?? []).map((f, i, arr) => {
    const inicio = i === 0 || arr[i - 1].area !== f.area
    let span = 1
    if (inicio) while (i + span < arr.length && arr[i + span].area === f.area) span++
    return { f, inicio, span }
  })

  return (
    <div className={c.paperWrap}>
      <div className={`${c.paper} ${muchasFilas ? c.paperTall : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={c.marcaAgua} src="/marca-agua-certificados.jpg" alt="" />
        <div className={c.inner}>
          <div className={c.pHead}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className={c.logoAluna}><img src="/logo.jpeg" alt="Gimnasio Aluna" /><small>— GIMNASIO —</small></div>
            <div className={c.pRes}>{colegio.resolutionText}<br />{colegio.daneText}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className={c.logoLudo}><img src="/logo-ludo.png" alt="Ludo Club" /></div>
          </div>

          <div className={`${c.pBody} ${tipo === 'notas' ? c.pBodyNotas : ''}`}>
            <div className={texto.fechaAlDerecha ? c.pDate : c.pDateLeft}>{texto.fecha}</div>
            <p>{texto.parrafo.map((s, i) => (s.b ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>))}</p>
            {tipo === 'notas' && notas && (
              <table className={c.nTable}>
                <thead><tr>{conArea && <th>ÁREA</th>}<th>ASIGNATURA</th><th className={c.n}>1P</th><th className={c.n}>2P</th><th className={c.n}>3P</th><th className={c.n}>DEF</th></tr></thead>
                <tbody>
                  {filas.map(({ f, inicio, span }, i) => (
                    <tr key={i}>
                      {conArea && inicio && <td className={c.area} rowSpan={span}>{f.area}</td>}
                      <td>{f.subject.toUpperCase()}</td>
                      <td className={c.n}>{nota(f.p[0])}</td><td className={c.n}>{nota(f.p[1])}</td><td className={c.n}>{nota(f.p[2])}</td>
                      <td className={c.n}>{nota(f.def)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {texto.cierre && <p className={c.pClosing}>{texto.cierre}</p>}
          </div>

          <div className={c.pBottom}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {firmaUrl ? <img className={c.sig} src={firmaUrl} alt="Firma de la rectora" /> : <div className={c.sigMissing}>Falta cargar la firma<br />(Configuración)</div>}
              <b>{colegio.signerShort}</b><br />{colegio.signerTitle}.<br />{colegio.institutionName}.
            </div>
            <div className={c.pFoot}>
              <span>{ICONOS.wa}{colegio.contactPhone}</span>
              <span>{ICONOS.mail}{colegio.contactEmail}</span>
              <span>{ICONOS.web}{web}</span>
              <span>{ICONOS.pin}{colegio.addressLine1}<br />{colegio.addressLine2}</span>
            </div>
          </div>
        </div>
        <div className={c.pMeta}>
          Certificado N.º {codigo}{verificacion ? ` · Código de verificación ${verificacion}` : ' · El código de verificación se crea al enviarlo'}
        </div>
      </div>
    </div>
  )
}
