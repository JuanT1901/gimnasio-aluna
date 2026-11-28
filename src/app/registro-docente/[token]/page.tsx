'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FaCheckCircle, FaPaperPlane, FaSpinner } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import FichaDocente from 'app/components/contratacion/FichaDocente'
import { faltantesDocente, type FichaDocente as Ficha } from 'app/utils/contratacion/comun'
import { validarEnlace, enviarRegistroDocente } from './actions'

export default function RegistroDocentePage() {
  const { token } = useParams<{ token: string }>()
  const [valido, setValido] = useState<boolean | null>(null)
  const [ficha, setFicha] = useState<Ficha>({ doc_type: 'CC' })
  const [acepta, setAcepta] = useState(false)
  const [sitio, setSitio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => { validarEnlace(token).then(r => setValido(r.valido)) }, [token])

  const enviar = async () => {
    setError(null)
    const falta = faltantesDocente(ficha)
    if (falta) { setError(falta); return }
    if (!acepta) { setError('Debes autorizar el tratamiento de tus datos personales para continuar.'); return }
    setEnviando(true)
    const r = await enviarRegistroDocente(token, ficha, acepta, sitio)
    setEnviando(false)
    if (!r.exito) { setError(r.error ?? 'No se pudo enviar el formulario.'); return }
    setListo(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className={c.public}>
      <div className={c.publicHero}>
        <h1>Registro de docentes</h1>
        <p>Completa tus datos para hacer parte del equipo del Gimnasio Aluna. La rectora los revisará y se comunicará contigo.</p>
      </div>

      {valido === null ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}><FaSpinner className="fa-spin" size={36} color="#3CA0E8" /></div>
      ) : !valido ? (
        <div className={h.errorBox}>Este enlace no es válido o ya no está vigente. Pide a la rectora el enlace actualizado.</div>
      ) : listo ? (
        <div className={c.okBox}>
          <FaCheckCircle /> <b>¡Gracias! Recibimos tus datos.</b><br />
          La rectora los revisará. Cuando te contraten, recibirás tu usuario y contraseña para entrar a la plataforma.
        </div>
      ) : (
        <div className={c.stack}>
          <FichaDocente ficha={ficha} onFicha={setFicha} />
          <section className={c.panel}>
            <label className={c.honeypot} aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={sitio} onChange={e => setSitio(e.target.value)} /></label>
            <label className={c.check}>
              <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
              Autorizo al Gimnasio Aluna a tratar mis datos personales para el proceso de contratación, según la Ley 1581 de 2012.
            </label>
            {error && <div className={h.errorBox} style={{ marginBottom: 0 }}>{error}</div>}
            <button type="button" className={`${h.btn} ${h.btnBlue}`} style={{ alignSelf: 'flex-start' }} disabled={enviando} onClick={enviar}>
              {enviando ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />} Enviar mis datos
            </button>
          </section>
        </div>
      )}
    </main>
  )
}
