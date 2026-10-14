'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaCheckCircle, FaSpinner } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { Segmentado } from 'app/components/horario/HorarioSemanal'
import { EstadoPill, OpcionesPago, Pasos } from 'app/components/certificados/Componentes'
import EnviarComprobante from 'app/components/certificados/EnviarComprobante'
import { type TipoCertificado, type TipoConfig, GRADOS_OFICIALES, formatoPrecio } from 'app/utils/certificados/comun'
import {
  obtenerDatosPublicos, crearSolicitudPublica, consultarSolicitud, subirComprobantePublico, avisarWhatsappPublico,
  verificarCertificado, type EstadoPublico,
} from './actions'

type Vista = 'solicitar' | 'consultar' | 'verificar'

const VACIO = {
  tipoDocumento: 'Tarjeta de Identidad', documento: '', nacimiento: '', nombre: '', ultimoGrado: '', anioSalida: '',
  tipo: 'promocion' as TipoCertificado, anio: '', correo: '', celular: '', acepta: false, sitio: '',
}

function CertificadosPublicos() {
  const params = useSearchParams()
  const [vista, setVista] = useState<Vista>(params.get('verificar') ? 'verificar' : 'solicitar')
  const [datos, setDatos] = useState<{ tipos: TipoConfig[], anioActivo: number, pago: { banco: string | null, efectivo: string | null } } | null>(null)
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [consulta, setConsulta] = useState({ codigo: '', documento: '' })
  const [estado, setEstado] = useState<EstadoPublico | null>(null)
  const [registrado, setRegistrado] = useState<boolean | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [codigoVerif, setCodigoVerif] = useState(params.get('verificar') ?? '')
  const [verif, setVerif] = useState<{ ok: boolean, texto: string } | null>(null)

  useEffect(() => { obtenerDatosPublicos().then(setDatos).catch(() => setDatos({ tipos: [], anioActivo: new Date().getFullYear(), pago: { banco: null, efectivo: null } })) }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const anios = datos ? Array.from({ length: 15 }, (_, i) => datos.anioActivo - 1 - i) : []
  const tipo = datos?.tipos.find(t => t.code === form.tipo)

  const cargarEstado = async (codigo: string, documento: string) => {
    const r = await consultarSolicitud(codigo, documento)
    if (!r.exito) { alert(r.error); return false }
    setEstado(r.estado!)
    return true
  }

  const enviar = async () => {
    setEnviando(true)
    const r = await crearSolicitudPublica(form)
    if (!r.exito) { setEnviando(false); alert(r.error); return }
    setConsulta({ codigo: r.code!, documento: form.documento })
    setRegistrado(!!r.registrado)
    await cargarEstado(r.code!, form.documento)
    setEnviando(false)
    setVista('consultar')
  }

  const verificar = async () => {
    const r = await verificarCertificado(codigoVerif)
    if (!r.exito || !r.certificado) { setVerif({ ok: false, texto: r.error ?? 'Código no válido.' }); return }
    const x = r.certificado
    setVerif({ ok: true, texto: `${x.tipo}${x.anio ? ` ${x.anio}` : ''} de ${x.estudiante}, N.º ${x.code}, expedido el ${new Date(x.expedido).toLocaleDateString('es-CO', { dateStyle: 'long' })}.` })
  }

  return (
    <main className={c.public}>
      <div className={c.publicHero}>
        <h1>Certificados</h1>
        <p>Si estudiaste en el colegio, puedes pedir tu certificado aquí sin crear una cuenta. Verificamos tus datos con el archivo del colegio y te lo enviamos al correo en PDF. Si eres acudiente de un estudiante actual, pídelo desde la plataforma.</p>
      </div>

      <Segmentado<Vista> valor={vista} onCambiar={setVista} opciones={[['solicitar', 'Solicitar certificado'], ['consultar', 'Consultar mi solicitud'], ['verificar', 'Verificar un certificado']]} />
      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      {vista === 'solicitar' && (
        !datos ? <div className={h.loading}><FaSpinner className="fa-spin" size={36} color="#3CA0E8" /></div>
          : datos.tipos.length === 0 ? <div className={h.empty}>En este momento no hay certificados disponibles.</div> : (
            <div className={c.publicBody}>
              <section className={c.panel}>
                <h3>Tus datos</h3>
                <div className={c.formGrid}>
                  <label className={h.field}>Tipo de documento<select className={h.select} value={form.tipoDocumento} onChange={e => setForm({ ...form, tipoDocumento: e.target.value })}>
                    <option>Tarjeta de Identidad</option><option>Cédula de Ciudadanía</option><option>Registro Civil</option><option>Cédula de Extranjería</option></select></label>
                  <label className={h.field}>Número de documento<input className={h.input} value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></label>
                  <label className={h.field}>Fecha de nacimiento<input className={h.input} type="date" value={form.nacimiento} onChange={e => setForm({ ...form, nacimiento: e.target.value })} />
                    <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>La usamos para confirmar que eres tú.</small></label>
                  <label className={h.field}>Nombre completo<input className={h.input} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
                  <label className={h.field}>Último grado que cursaste<select className={h.select} value={form.ultimoGrado} onChange={e => setForm({ ...form, ultimoGrado: e.target.value })}>
                    <option value="">—</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></label>
                  <label className={h.field}>Año en que saliste<input className={h.input} value={form.anioSalida} onChange={e => setForm({ ...form, anioSalida: e.target.value })} placeholder="Ej: 2024" /></label>
                  <label className={h.field}>Certificado<select className={h.select} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoCertificado })}>
                    {datos.tipos.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}</select></label>
                  <label className={h.field}>Año del certificado<select className={h.select} value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })}>
                    <option value="">—</option>{anios.map(a => <option key={a}>{a}</option>)}</select></label>
                  <label className={h.field}>Correo<input className={h.input} type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} /></label>
                  <label className={h.field}>Celular (WhatsApp)<input className={h.input} value={form.celular} onChange={e => setForm({ ...form, celular: e.target.value })} /></label>
                  <label className={c.honeypot} aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.sitio} onChange={e => setForm({ ...form, sitio: e.target.value })} /></label>
                  <label className={`${c.check} ${c.full}`}><input type="checkbox" checked={form.acepta} onChange={e => setForm({ ...form, acepta: e.target.checked })} /> Autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012.</label>
                </div>
                <button type="button" className={`${h.btn} ${h.btnBlue}`} style={{ alignSelf: 'flex-start' }} disabled={enviando} onClick={enviar}>
                  {enviando && <FaSpinner className="fa-spin" />} Enviar solicitud
                </button>
              </section>
              <aside className={c.panel}>
                <h3>¿Cómo funciona?</h3>
                <p>1. Envías la solicitud.<br />2. Pagas y envías el comprobante aquí mismo o por WhatsApp.<br />3. La rectora verifica el pago y tus datos.<br />4. Recibes el certificado en PDF en tu correo.</p>
                {tipo && <dl className={c.kv}><dt>Precio</dt><dd>{formatoPrecio(tipo.price)}</dd></dl>}
                <p>Formas de pago:</p>
                <OpcionesPago banco={datos.pago.banco} efectivo={datos.pago.efectivo} />
              </aside>
            </div>
          )
      )}

      {vista === 'consultar' && (
        estado ? (
          <div className={c.stack}>
            {registrado !== null && (
              <div className={c.okBox}>Solicitud recibida. Guarda tu número de solicitud: <b>{estado.code}</b>. {registrado ? 'Encontramos tus datos en el archivo del colegio.' : 'La rectora verificará tus datos en el archivo del colegio.'}</div>
            )}
            <article className={c.req}>
              <div>
                <div className={c.rTitle}>{estado.tipoNombre}{estado.anio ? ` ${estado.anio}` : ''} <small>{estado.code}</small></div>
                <div className={c.rMeta}>Se enviará a {estado.correo}</div>
              </div>
              <div className={c.rSide}><EstadoPill estado={estado.status} para="acudiente" pagado={estado.pagado} /></div>
              <div className={c.rBody}>
                <Pasos estado={estado.status} />
                {estado.status === 'payment_requested' && estado.adminMessage && <div className={c.noteBox}><strong>Mensaje de rectoría</strong>{estado.adminMessage}</div>}
                {(estado.status === 'pending_payment' || estado.status === 'payment_requested') && (
                  <>
                    <OpcionesPago banco={datos?.pago.banco ?? null} efectivo={datos?.pago.efectivo ?? null} />
                    <EnviarComprobante
                      codigo={estado.code}
                      whatsappUrl={estado.whatsapp}
                      onSubir={archivo => { const f = new FormData(); f.append('codigo', consulta.codigo); f.append('documento', consulta.documento); f.append('comprobante', archivo); return subirComprobantePublico(f) }}
                      onWhatsapp={() => avisarWhatsappPublico(consulta.codigo, consulta.documento)}
                      onListo={m => { setAviso(m); cargarEstado(consulta.codigo, consulta.documento) }}
                    />
                  </>
                )}
                {estado.status === 'in_review' && <span className={c.hint}>{estado.pagado ? 'La rectora confirmó tu pago y está preparando el certificado.' : 'Recibimos tu comprobante. La rectora lo está revisando.'} Te llegará al correo.</span>}
                {estado.status === 'sent' && <div className={c.okBox}>El certificado ya fue enviado a {estado.correo}. Si no lo ves, revisa la carpeta de correo no deseado.</div>}
              </div>
            </article>
            <button type="button" className={`${h.btn} ${h.btnGhost}`} style={{ alignSelf: 'flex-start' }} onClick={() => { setEstado(null); setRegistrado(null) }}>Consultar otra solicitud</button>
          </div>
        ) : (
          <section className={c.panel} style={{ maxWidth: '520px' }}>
            <h3>Consultar mi solicitud</h3>
            <p>Escribe el número de solicitud (CERT-…) y tu número de documento.</p>
            <label className={h.field}>Número de solicitud<input className={h.input} value={consulta.codigo} onChange={e => setConsulta({ ...consulta, codigo: e.target.value })} placeholder="CERT-2026-0001" /></label>
            <label className={h.field}>Número de documento<input className={h.input} value={consulta.documento} onChange={e => setConsulta({ ...consulta, documento: e.target.value })} /></label>
            <button type="button" className={`${h.btn} ${h.btnBlue}`} style={{ alignSelf: 'flex-start' }} onClick={() => cargarEstado(consulta.codigo, consulta.documento)}>Consultar</button>
          </section>
        )
      )}

      {vista === 'verificar' && (
        <section className={c.panel} style={{ maxWidth: '520px' }}>
          <h3>Verificar un certificado</h3>
          <p>Escribe el código de verificación que aparece al pie del certificado.</p>
          <label className={h.field}>Código de verificación<input className={h.input} value={codigoVerif} onChange={e => { setCodigoVerif(e.target.value); setVerif(null) }} placeholder="XXXX-XXXX" /></label>
          <button type="button" className={`${h.btn} ${h.btnBlue}`} style={{ alignSelf: 'flex-start' }} onClick={verificar}>Verificar</button>
          {verif && (verif.ok
            ? <div className={c.okBox}><FaCheckCircle /> Certificado auténtico: {verif.texto}</div>
            : <div className={h.errorBox} style={{ marginBottom: 0 }}>{verif.texto}</div>)}
        </section>
      )}
    </main>
  )
}

export default function CertificadosPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px 0' }}><FaSpinner className="fa-spin" size={40} color="#3CA0E8" /></div>}>
      <CertificadosPublicos />
    </Suspense>
  )
}
