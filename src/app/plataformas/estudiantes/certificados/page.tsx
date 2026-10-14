'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { OpcionesPago } from 'app/components/certificados/Componentes'
import { type TipoCertificado, formatoPrecio } from 'app/utils/certificados/comun'
import { obtenerDatosSolicitud, crearSolicitud, type DatosSolicitud } from './actions'

export default function SolicitarCertificadoPage() {
  const router = useRouter()
  const [datos, setDatos] = useState<DatosSolicitud | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoCertificado | null>(null)
  const [anio, setAnio] = useState<number | null>(null)
  const [solicitante, setSolicitante] = useState('')
  const [correo, setCorreo] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    obtenerDatosSolicitud().then(r => {
      if (!r.exito || !r.datos) { setError(r.error ?? 'No se pudo cargar la información.'); return }
      setDatos(r.datos)
      setSolicitante(r.datos.solicitante)
      setCorreo(r.datos.correos.find(x => x.sugerido)?.correo ?? '')
    })
  }, [])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!datos) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3CA0E8" /></div>

  const t = datos.tipos.find(x => x.code === tipo)
  const anios = Array.from({ length: 6 }, (_, i) => datos.anioActivo - i)
  const anioElegido = anio ?? datos.anioActivo
  const manual = tipo === 'notas' && anioElegido !== datos.anioActivo && !datos.aniosConHistorial.includes(anioElegido)
  const sugerido = datos.correos.find(x => x.sugerido)

  const enviar = async () => {
    if (!tipo) return
    setEnviando(true)
    const r = await crearSolicitud({ tipo, anio: tipo === 'estudio' ? null : anioElegido, solicitante, correo, comentario })
    setEnviando(false)
    if (!r.exito) { alert(r.error); return }
    router.push(`/plataformas/estudiantes/certificados/solicitados?nueva=${r.id}`)
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1>Solicitar certificado</h1>
          <p>Elige el certificado que necesitas. La rectora lo revisa y te llega al correo en PDF.</p>
        </div>
      </header>

      {datos.tipos.length === 0 ? <div className={h.empty}>En este momento no hay certificados disponibles.</div> : (
        <div className={c.types}>
          {datos.tipos.map(x => (
            <button key={x.code} type="button" className={`${c.type} ${tipo === x.code ? c.typeOn : ''}`} onClick={() => { setTipo(x.code); setAnio(null) }}>
              <h3>{x.name}</h3>
              <p>{x.description}</p>
              <div className={c.price}><span>Precio</span><b>{formatoPrecio(x.price)}</b></div>
            </button>
          ))}
        </div>
      )}

      {t && (
        <div className={c.reqLayout}>
          <section className={c.panel}>
            <h3>{t.name}</h3>
            <dl className={c.kv}>
              <dt>Estudiante</dt><dd>{datos.estudiante.nombre}</dd>
              <dt>Documento</dt><dd>{datos.estudiante.documento}</dd>
              {datos.estudiante.curso && <><dt>Curso</dt><dd>{datos.estudiante.curso}{datos.estudiante.grado ? ` (${datos.estudiante.grado})` : ''}</dd></>}
            </dl>

            {tipo !== 'estudio' && (
              <label className={h.field}>
                {tipo === 'notas' ? 'Año cursado' : 'Año lectivo'}
                <select className={h.select} value={anioElegido} onChange={e => setAnio(Number(e.target.value))}>
                  {anios.map(a => <option key={a} value={a}>{a}{a === datos.anioActivo && tipo === 'notas' ? ' (en curso)' : ''}</option>)}
                </select>
                {manual && <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>Las notas de ese año no están en la plataforma. La rectora las llenará a mano, así que puede tardar un poco más.</small>}
              </label>
            )}

            <label className={h.field}>¿Quién lo solicita?<input className={h.input} value={solicitante} onChange={e => setSolicitante(e.target.value)} placeholder="Nombre completo" /></label>

            <label className={h.field}>
              Correo donde recibirás el certificado
              <input className={h.input} type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
              {sugerido && <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                Te sugerimos el correo {sugerido.etiqueta === 'Mamá' ? 'de la mamá' : 'del papá'} porque en la ficha dice que vive con el estudiante. Puedes escribir cualquier otro.
              </small>}
            </label>
            {datos.correos.length > 0 && (
              <div className={c.chips}>
                {datos.correos.map(x => (
                  <button key={x.correo} type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setCorreo(x.correo)}>{x.etiqueta} · {x.correo}</button>
                ))}
              </div>
            )}

            <label className={h.field}>Comentario (opcional)<textarea className={h.input} rows={3} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Ej: Lo necesito para la EPS." /></label>
          </section>

          <aside className={c.panel}>
            <h3>Resumen</h3>
            <dl className={c.kv}>
              <dt>Certificado</dt><dd>{t.name}{tipo !== 'estudio' ? ` ${anioElegido}` : ''}</dd>
              <dt>Precio</dt><dd>{formatoPrecio(t.price)}</dd>
            </dl>
            <p>Formas de pago:</p>
            <OpcionesPago banco={datos.pago.banco} efectivo={datos.pago.efectivo} />
            <p>Después de enviar la solicitud podrás subir el comprobante o enviarlo por WhatsApp desde «Solicitados».</p>
            <button type="button" className={`${h.btn} ${h.btnBlue}`} disabled={enviando} onClick={enviar}>
              {enviando && <FaSpinner className="fa-spin" />} Enviar solicitud
            </button>
          </aside>
        </div>
      )}
    </main>
  )
}
