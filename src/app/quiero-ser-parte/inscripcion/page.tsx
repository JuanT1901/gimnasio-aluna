'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FaArrowLeft, FaCheckCircle, FaPaperPlane, FaSearch, FaSpinner } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import i from 'app/styles/pages/Inscripciones.module.scss'
import FichaInscripcion from 'app/components/inscripciones/FichaInscripcion'
import { TIPOS_DOCUMENTO, faltantesPrimeraVez, type DatosFicha } from 'app/utils/inscripciones/comun'
import { buscarDocumento, enviarInscripcion, obtenerOpcionesFormulario, type OpcionesFormulario, type ResultadoBusqueda } from './actions'

type Paso = 'documento' | 'ficha' | 'listo'

export default function InscripcionPage() {
  const [opciones, setOpciones] = useState<OpcionesFormulario | null>(null)
  const [paso, setPaso] = useState<Paso>('documento')
  const [tipoDocumento, setTipoDocumento] = useState('RC')
  const [documento, setDocumento] = useState('')
  const [busqueda, setBusqueda] = useState<ResultadoBusqueda | null>(null)
  const [anio, setAnio] = useState<number | null>(null)
  const [gradeId, setGradeId] = useState<number | null>(null)
  const [ficha, setFicha] = useState<DatosFicha>({})
  const [acepta, setAcepta] = useState(false)
  const [sitio, setSitio] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ code: string, completada: boolean, nuevos: number } | null>(null)

  useEffect(() => { obtenerOpcionesFormulario().then(setOpciones).catch(() => setOpciones({ anios: [], cursos: [] })) }, [])

  const existente = busqueda?.estado === 'existente' ? busqueda : null
  const llenos = existente ? new Set(existente.llenos) : undefined

  const continuar = async () => {
    setError(null)
    setCargando(true)
    const r = await buscarDocumento(documento)
    setCargando(false)
    if (!r.exito) { setError(r.error ?? 'No se pudo buscar el documento.'); return }
    setBusqueda(r.resultado!)
    if (r.resultado!.estado === 'estudiante') return
    setFicha({})
    setAnio(r.resultado!.estado === 'existente' ? r.resultado!.anio : null)
    setGradeId(null)
    setPaso('ficha')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const enviar = async () => {
    setError(null)
    if (!existente) {
      if (!anio) { setError('¿Para qué año quiere inscribir a su hijo(a)? Selecciona el año.'); return }
      if (!gradeId) { setError('Selecciona el grado al que aspira el estudiante.'); return }
      const falta = faltantesPrimeraVez(ficha)
      if (falta) { setError(falta); return }
    }
    if (!acepta) { setError('Debes autorizar el tratamiento de los datos personales para continuar.'); return }

    setCargando(true)
    const r = await enviarInscripcion({ tipoDocumento, documento, anio, gradeId, ficha, acepta, sitio })
    setCargando(false)
    if (!r.exito) { setError(r.error ?? 'No se pudo enviar la solicitud.'); return }
    setResultado({ code: r.code!, completada: !!r.completada, nuevos: r.nuevos ?? 0 })
    setPaso('listo')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reiniciar = () => {
    setPaso('documento'); setDocumento(''); setBusqueda(null); setFicha({}); setAcepta(false)
    setAnio(null); setGradeId(null); setResultado(null); setError(null)
  }

  return (
    <main className={c.public}>
      <div className={c.publicHero}>
        <Link href="/quiero-ser-parte" style={{ color: '#64748b', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <FaArrowLeft /> Proceso de admisiones
        </Link>
        <h1>Formulario de inscripción</h1>
        <p>Llena los datos del estudiante y de su familia. Si la madre y el padre van a llenar la información por separado, el segundo solo tiene que escribir el mismo número de documento del estudiante y completar lo que falta.</p>
      </div>

      {paso === 'documento' && (
        <section className={`${c.panel} ${i.docStep}`}>
          <h3>Documento del estudiante</h3>
          <p>Empezamos por el documento para saber si ya hay una solicitud de este estudiante.</p>
          <div className={i.row}>
            <label className={h.field}>Tipo de documento
              <select className={h.select} value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}>
                {TIPOS_DOCUMENTO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label className={h.field}>Número de documento
              <input className={h.input} inputMode="numeric" value={documento} onChange={e => { setDocumento(e.target.value); setBusqueda(null) }}
                onKeyDown={e => { if (e.key === 'Enter') continuar() }} placeholder="Sin puntos ni espacios" />
            </label>
          </div>
          {busqueda?.estado === 'estudiante' && (
            <div className={h.errorBox} style={{ marginBottom: 0 }}>Este documento ya pertenece a un estudiante del colegio. Si necesitas actualizar datos, comunícate con el colegio.</div>
          )}
          {error && <div className={h.errorBox} style={{ marginBottom: 0 }}>{error}</div>}
          <button type="button" className={`${h.btn} ${h.btnBlue}`} style={{ alignSelf: 'flex-start' }} disabled={cargando || !documento.trim()} onClick={continuar}>
            {cargando ? <FaSpinner className="fa-spin" /> : <FaSearch />} Continuar
          </button>
        </section>
      )}

      {paso === 'ficha' && (
        <div className={c.stack}>
          {existente ? (
            <div className={c.okBox}>
              Ya hay una solicitud para este documento (<b>{existente.code}</b>, año {existente.anio}). Los campos marcados con
              «✓ Ya registrado» los llenó otra persona; solo completa lo que falta. Si algo de lo registrado está mal, comunícate con el colegio.
            </div>
          ) : null}

          <section className={c.panel}>
            <h3>Inscripción</h3>
            <div className={c.formGrid}>
              <div className={`${h.field} ${c.full}`}>
                <span>¿Para qué año quiere inscribir a su hijo(a)?</span>
                {existente ? <div className={i.locked}><FaCheckCircle /> {existente.anio}</div> : (
                  <div className={c.radioRow} role="radiogroup">
                    {(opciones?.anios ?? []).map(a => (
                      <label key={a} className={anio === a ? c.radioOn : ''}>
                        <input type="radio" name="anio" checked={anio === a} onChange={() => setAnio(a)} /> {a}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label className={h.field}>Grado al que aspira
                {existente?.conCurso ? <div className={i.locked}><FaCheckCircle /> Ya registrado</div> : (
                  <select className={h.select} value={gradeId ?? ''} onChange={e => setGradeId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Seleccionar —</option>
                    {(opciones?.cursos ?? []).map(g => <option key={g.id} value={g.id}>{g.officialGrade}</option>)}
                  </select>
                )}
              </label>
              <div className={h.field}>
                <span>Documento del estudiante</span>
                <div className={i.locked} style={{ borderColor: '#cbd5e1', background: '#f8fafc', color: '#334155' }}>
                  {TIPOS_DOCUMENTO.find(([v]) => v === tipoDocumento)?.[1]} · {documento}
                </div>
              </div>
            </div>
          </section>

          <FichaInscripcion ficha={ficha} onCambiar={setFicha} llenos={llenos} />

          <section className={c.panel}>
            <label className={c.honeypot} aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={sitio} onChange={e => setSitio(e.target.value)} /></label>
            <label className={c.check}>
              <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
              Autorizo el tratamiento de los datos personales del estudiante y de su familia según la Ley 1581 de 2012, para el proceso de admisión.
            </label>
            {error && <div className={h.errorBox} style={{ marginBottom: 0 }}>{error}</div>}
            <div className={i.actions}>
              <button type="button" className={`${h.btn} ${h.btnBlue}`} disabled={cargando} onClick={enviar}>
                {cargando ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />} {existente ? 'Enviar lo que completé' : 'Enviar solicitud'}
              </button>
              <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={cargando} onClick={reiniciar}>Cambiar documento</button>
            </div>
          </section>
        </div>
      )}

      {paso === 'listo' && resultado && (
        <section className={c.panel} style={{ maxWidth: '640px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d' }}><FaCheckCircle /> {resultado.completada ? 'Datos recibidos' : 'Solicitud recibida'}</h3>
          <div className={c.okBox}>
            {resultado.completada
              ? resultado.nuevos
                ? <>Agregamos {resultado.nuevos} dato{resultado.nuevos !== 1 ? 's' : ''} a la solicitud <b>{resultado.code}</b>. Gracias.</>
                : <>La solicitud <b>{resultado.code}</b> ya tenía toda esa información; no hubo cambios.</>
              : <>Tu número de solicitud es <b>{resultado.code}</b>. Te enviamos un resumen al correo.</>}
          </div>
          <p>El colegio se comunicará contigo para el pago de la inscripción, la evaluación y la entrevista. Si el otro acudiente quiere completar datos, puede entrar a este mismo formulario y escribir el documento del estudiante.</p>
          <div className={i.actions}>
            <Link href="/quiero-ser-parte" className={`${h.btn} ${h.btnGhost}`}>Volver a admisiones</Link>
            <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={reiniciar}>Llenar otra solicitud</button>
          </div>
        </section>
      )}
    </main>
  )
}
