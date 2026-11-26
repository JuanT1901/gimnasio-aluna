'use client'

import { useEffect, useMemo, useState } from 'react'
import { FaCopy, FaEye, FaFlask, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { VistaCertificado } from 'app/components/certificados/Componentes'
import { EditorCampos, EditorNotas } from 'app/components/certificados/Editores'
import { type CamposCertificado, type FilaNotas, type FormatoNotas, type TipoCertificado, plantillaNotas, tieneAnio } from 'app/utils/certificados/comun'
import { hoyISO } from 'app/utils/horario/comun'
import { obtenerDatosPrueba, datosDeEstudiante, generarPdfPrueba, generarPdfTresPrueba, type DatosPrueba } from './actions'

const TIPOS: { code: TipoCertificado, nombre: string }[] = [
  { code: 'estudio', nombre: 'Estudio' },
  { code: 'promocion', nombre: 'Promoción' },
  { code: 'notas', nombre: 'Notas' },
  { code: 'conducta', nombre: 'Conducta' },
]

const camposVacios = (anio: number): CamposCertificado => ({
  fecha: hoyISO(), nombre: 'Estudiante de Prueba', tipoDocumento: 'Tarjeta de Identidad', numeroDocumento: '1.000.000.000',
  ciudadDocumento: 'Zipaquirá', grado: 'Sexto', nivel: 'educación básica secundaria', anio, matricula: null, pension: null, conducta: 'Excelente',
})

export default function CertificadoPrueba() {
  const [datos, setDatos] = useState<DatosPrueba | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoCertificado>('estudio')
  const [estudianteId, setEstudianteId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [campos, setCampos] = useState<CamposCertificado | null>(null)
  const [formato, setFormato] = useState<FormatoNotas>('secundaria')
  const [notas, setNotas] = useState<FilaNotas[]>(plantillaNotas('secundaria'))
  const [sello, setSello] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    obtenerDatosPrueba().then(r => {
      if (!r.exito || !r.datos) { setError(r.error ?? 'No se pudo cargar la información.'); return }
      setDatos(r.datos)
      setCampos(camposVacios(r.datos.anioActivo))
    })
  }, [])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (datos?.estudiantes ?? []).filter(e => !q || e.nombre.toLowerCase().includes(q) || (e.curso ?? '').toLowerCase().includes(q))
  }, [datos, busqueda])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!datos || !campos) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  // Precarga los datos que tendría ese estudiante en una solicitud real
  const precargar = async (id: string, t: TipoCertificado, anio: number | null) => {
    setEstudianteId(id)
    setPdfUrl(null)
    if (!id) return
    setOcupado('estudiante')
    const r = await datosDeEstudiante(id, t, anio)
    setOcupado(null)
    if (!r.exito || !r.campos) { alert(r.error ?? 'No se pudieron cargar los datos.'); return }
    setCampos({ ...r.campos, conducta: campos.conducta ?? 'Excelente' })
    if (r.formato) setFormato(r.formato)
    if (r.notas) setNotas(r.notas)
  }

  const cambiarTipo = (t: TipoCertificado) => {
    setTipo(t)
    setPdfUrl(null)
    const anio = tieneAnio(t) ? campos.anio ?? datos.anioActivo : null
    if (estudianteId) precargar(estudianteId, t, anio)
    else setCampos({ ...campos, anio })
  }

  const verPdf = async (tres = false) => {
    setOcupado(tres ? 'tres' : 'pdf')
    const r = tres
      ? await generarPdfTresPrueba({ campos, formato, sello })
      : await generarPdfPrueba({ tipo, campos, notas: tipo === 'notas' ? notas : null, formato, sello })
    setOcupado(null)
    if (!r.exito || !r.base64) { alert(r.error ?? 'No se pudo generar el PDF.'); return }
    const bytes = Uint8Array.from(atob(r.base64), ch => ch.charCodeAt(0))
    setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })))
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '20px' }}>
        <div>
          <h1><FaFlask size={22} style={{ verticalAlign: '-2px', marginRight: '8px' }} />Certificado de prueba</h1>
          <p>Solo existe en desarrollo (npm run dev). No crea solicitudes, no gasta consecutivo, no envía correos ni guarda archivos.</p>
        </div>
      </header>

      <div className={c.detail}>
        <div className={c.stack} style={{ minWidth: 0 }}>
          <section className={c.panel}>
            <h3>Datos del certificado</h3>
            <EditorCampos tipo={tipo} campos={campos} onCampos={x => { setCampos(x); setPdfUrl(null) }}
              formato={formato} onFormato={f => { setFormato(f); setPdfUrl(null) }}
              avisoCostos="Con un estudiante seleccionado se llenan con los valores de su curso." />
          </section>

          {tipo === 'notas' && (
            <section className={c.panel}>
              <h3>Notas</h3>
              <EditorNotas notas={notas} formato={formato} onNotas={n => { setNotas(n); setPdfUrl(null) }} />
            </section>
          )}

          <div className={h.toolbar} style={{ marginBottom: 0 }}>
            {pdfUrl ? (
              <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={() => setPdfUrl(null)}><FaEye /> Volver a la vista rápida</button>
            ) : (
              <>
                <button type="button" className={`${h.btn} ${h.btnBlue}`} disabled={ocupado !== null} onClick={() => verPdf()}>
                  {ocupado === 'pdf' ? <FaSpinner className="fa-spin" /> : <FaEye />} Generar PDF de prueba
                </button>
                <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={ocupado !== null} onClick={() => verPdf(true)}
                  title="Estudio, promoción y conducta con los mismos datos, una hoja cada uno">
                  {ocupado === 'tres' ? <FaSpinner className="fa-spin" /> : <FaCopy />} Ver los 3 certificados
                </button>
              </>
            )}
          </div>

          {pdfUrl
            ? <iframe src={pdfUrl} title="PDF de prueba" style={{ width: '100%', height: '900px', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white' }} />
            : <VistaCertificado tipo={tipo} campos={campos} colegio={datos.colegio} formato={formato} notas={tipo === 'notas' ? notas : null} codigo={null} verificacion={null} firmaUrl={datos.firmaUrl} prueba={{ sello }} />}
        </div>

        <div className={c.stack}>
          <section className={c.panel}>
            <h3>Tipo</h3>
            <div className={c.radioRow}>
              {TIPOS.map(t => (
                <label key={t.code} className={tipo === t.code ? c.radioOn : ''}>
                  <input type="radio" name="tipo" checked={tipo === t.code} onChange={() => cambiarTipo(t.code)} /> {t.nombre}
                </label>
              ))}
            </div>
          </section>

          <section className={c.panel}>
            <h3>Estudiante</h3>
            <p>Opcional: precarga los datos reales de un estudiante (grado, documento, notas, costos). Solo se leen.</p>
            <input className={h.input} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o curso" />
            <select className={h.select} value={estudianteId} onChange={e => precargar(e.target.value, tipo, campos.anio)} size={8}>
              <option value="">— Datos de ejemplo —</option>
              {filtrados.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.curso ? ` · ${e.curso}` : ''}</option>)}
            </select>
            {ocupado === 'estudiante' && <span className={c.hint}><FaSpinner className="fa-spin" /> Cargando datos…</span>}
            {estudianteId && tieneAnio(tipo) && (
              <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} disabled={ocupado !== null} onClick={() => precargar(estudianteId, tipo, campos.anio)}>
                Recargar con el año {campos.anio ?? ''}
              </button>
            )}
          </section>

          <section className={c.panel}>
            <h3>PDF</h3>
            <label className={c.check}>
              <input type="checkbox" checked={sello} onChange={e => { setSello(e.target.checked); setPdfUrl(null) }} />
              Sello «PRUEBA» en diagonal
            </label>
            <span className={c.hint}>Quítalo para revisar el diseño tal como saldría. El pie siempre dice «Certificado de prueba · Sin validez» y no lleva número ni código de verificación.</span>
          </section>
        </div>
      </div>
    </main>
  )
}
