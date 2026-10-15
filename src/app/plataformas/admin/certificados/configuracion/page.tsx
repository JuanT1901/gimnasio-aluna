'use client'

import { useEffect, useState } from 'react'
import { FaCog, FaSave, FaSpinner, FaUpload } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { type Colegio, type TipoConfig, GRADOS_OFICIALES, NIVELES, nivelDeGrado } from 'app/utils/certificados/comun'
import { obtenerConfiguracion, guardarConfiguracion, subirFirma, type CursoConfig } from '../actions'

type CampoTexto = { [K in keyof Colegio]: Colegio[K] extends string | null ? K : never }[keyof Colegio]

export default function ConfiguracionCertificadosPage() {
  const [colegio, setColegio] = useState<Colegio | null>(null)
  const [tipos, setTipos] = useState<TipoConfig[]>([])
  const [cursos, setCursos] = useState<CursoConfig[]>([])
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    obtenerConfiguracion().then(r => {
      if (!r.exito) { setError(r.error ?? 'No se pudo cargar la configuración.'); return }
      setColegio(r.colegio!)
      setTipos(r.tipos!)
      setCursos(r.cursos!)
      setFirmaUrl(r.firmaUrl ?? null)
    })
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!colegio) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const texto = (k: CampoTexto, etiqueta: string, opciones?: { area?: boolean, ayuda?: string, placeholder?: string }) => (
    <label className={h.field}>
      {etiqueta}
      {opciones?.area
        ? <textarea className={h.input} rows={3} value={colegio[k] ?? ''} placeholder={opciones.placeholder} onChange={e => setColegio({ ...colegio, [k]: e.target.value })} />
        : <input className={h.input} value={colegio[k] ?? ''} placeholder={opciones?.placeholder} onChange={e => setColegio({ ...colegio, [k]: e.target.value })} />}
      {opciones?.ayuda && <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{opciones.ayuda}</small>}
    </label>
  )

  const guardar = async () => {
    setGuardando(true)
    const r = await guardarConfiguracion({ colegio, tipos, cursos })
    setGuardando(false)
    if (!r.exito) { alert(r.error); return }
    setAviso('Configuración guardada.')
  }

  const cargarFirma = async (archivo: File | undefined) => {
    if (!archivo) return
    const datos = new FormData()
    datos.append('firma', archivo)
    setSubiendo(true)
    const r = await subirFirma(datos)
    setSubiendo(false)
    if (!r.exito) { alert(r.error); return }
    setFirmaUrl(r.url ?? null)
    setAviso('Firma cargada.')
  }

  const cambiarCurso = (id: number, cambios: Partial<CursoConfig>) => setCursos(cursos.map(x => (x.id === id ? { ...x, ...cambios } : x)))

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaCog color="#3b82f6" /> Configuración de certificados</h1>
          <p>Precios, formas de pago y datos que llenan los certificados. Todo se puede cambiar aquí sin tocar el código.</p>
        </div>
        <button type="button" className={`${h.btn} ${h.btnGreen}`} disabled={guardando} onClick={guardar}>
          {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar cambios
        </button>
      </header>
      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      <div className={c.stack}>
        <section className={c.tblWrap}>
          <table className={c.tbl}>
            <thead><tr><th>Certificado</th><th>Descripción para el acudiente</th><th>Precio (COP)</th><th>Activo</th></tr></thead>
            <tbody>
              {tipos.map(t => (
                <tr key={t.code}>
                  <td><b>{t.name}</b></td>
                  <td><textarea className={h.input} rows={2} value={t.description}
                    onChange={e => setTipos(tipos.map(x => (x.code === t.code ? { ...x, description: e.target.value } : x)))} /></td>
                  <td style={{ width: '150px' }}><input type="number" min={0} step={500} placeholder="Por definir" value={t.price ?? ''}
                    onChange={e => setTipos(tipos.map(x => (x.code === t.code ? { ...x, price: e.target.value === '' ? null : Number(e.target.value) } : x)))} /></td>
                  <td><input type="checkbox" checked={t.active} aria-label={`${t.name} activo`}
                    onChange={e => setTipos(tipos.map(x => (x.code === t.code ? { ...x, active: e.target.checked } : x)))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className={c.cfg}>
          <section className={c.panel}>
            <h3>Formas de pago</h3>
            {texto('whatsappNumber', 'WhatsApp para comprobantes', { ayuda: 'Con el indicativo 57 adelante, sin espacios. Ej: 573144698955.' })}
            {texto('bankInfo', 'Datos para transferencia bancaria', { area: true, placeholder: 'Ej: Nequi o Daviplata al 300 000 0000 a nombre de …', ayuda: 'Mientras esté vacío, la opción de transferencia no se muestra a los acudientes.' })}
            {texto('cashInfo', 'Pago en efectivo', { area: true, placeholder: 'Dónde y en qué horario se paga' })}
          </section>

          <section className={c.panel}>
            <h3>Firma de la rectora</h3>
            <p>Va en todos los certificados. Sube una imagen PNG con fondo transparente. Queda guardada de forma privada: solo la usa el sistema al generar el PDF.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {firmaUrl ? <img src={firmaUrl} alt="Firma cargada" style={{ maxWidth: '100%', height: '60px', objectFit: 'contain', objectPosition: 'left', background: '#fdf3dc', borderRadius: '8px', padding: '6px' }} />
              : <div className={c.noteBox}><strong>Pendiente</strong>Aún no se ha cargado la firma. Sin ella no se pueden enviar certificados.</div>}
            <label className={`${h.btn} ${h.btnGhost}`} style={{ alignSelf: 'flex-start' }}>
              {subiendo ? <FaSpinner className="fa-spin" /> : <FaUpload />} {firmaUrl ? 'Cambiar firma' : 'Subir firma'}
              <input type="file" accept="image/png" hidden onChange={e => cargarFirma(e.target.files?.[0])} />
            </label>
          </section>

          <section className={c.panel}>
            <h3>Datos del certificado</h3>
            {texto('signerName', 'Nombre de la rectora')}
            {texto('signerShort', 'Nombre bajo la firma')}
            {texto('signerTitle', 'Cargo')}
            {texto('institutionName', 'Institución')}
            {texto('scheduleText', 'Horario')}
            {texto('calendar', 'Calendario')}
            {texto('city', 'Ciudad')}
          </section>

          <section className={c.panel}>
            <h3>Encabezado y pie</h3>
            {texto('resolutionText', 'Resolución', { area: true })}
            {texto('daneText', 'Código DANE y NIT')}
            {texto('contactPhone', 'Teléfonos')}
            {texto('contactEmail', 'Correo')}
            {texto('website', 'Página web')}
            {texto('addressLine1', 'Dirección')}
            {texto('addressLine2', 'Barrio y ciudad')}
          </section>

          <section className={c.panel}>
            <h3>Regla de promoción (Fin de año)</h3>
            <p>Se usa para sugerir quién repite. La decisión final siempre es de la rectora.</p>
            <label className={h.field}>Nota mínima para aprobar un área
              <input className={h.input} type="number" step={0.1} min={1} max={5} value={colegio.promotionMinGrade} onChange={e => setColegio({ ...colegio, promotionMinGrade: Number(e.target.value) })} /></label>
            <label className={h.field}>Áreas perdidas para repetir
              <input className={h.input} type="number" min={1} max={20} value={colegio.promotionMaxLostAreas} onChange={e => setColegio({ ...colegio, promotionMaxLostAreas: Number(e.target.value) })} />
              <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>Con esta cantidad o más de áreas perdidas se sugiere que el estudiante repita. En preescolar nunca se sugiere repetir.</small></label>
          </section>
        </div>

        <section className={c.panel}>
          <h3>Cursos: grado oficial, costos y curso siguiente</h3>
          <p>El certificado dice el grado oficial (ej. «Quinto de educación básica primaria»), no el nombre del curso. El curso siguiente es a donde pasan los estudiantes en «Fin de año». Si un curso tiene estudiantes de dos grados, deja el grado del curso y corrígelo en cada certificado. La matrícula y la pensión aparecen en el certificado de estudio cuando el acudiente las pide.</p>
          <div className={c.tblWrap}>
            <table className={c.tbl}>
              <thead><tr><th>Curso</th><th>Grado oficial</th><th>Nivel</th><th>Matrícula (COP)</th><th>Pensión mensual (COP)</th><th>Pasan a</th><th>Último curso</th></tr></thead>
              <tbody>
                {cursos.map(x => (
                  <tr key={x.id}>
                    <td><b>{x.name}</b></td>
                    <td><select value={x.officialGrade} onChange={e => cambiarCurso(x.id, { officialGrade: e.target.value, officialLevel: nivelDeGrado(e.target.value) })}>
                      <option value="">—</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></td>
                    <td><select value={x.officialLevel} onChange={e => cambiarCurso(x.id, { officialLevel: e.target.value })}>
                      <option value="">—</option>{NIVELES.map(n => <option key={n}>{n}</option>)}</select></td>
                    <td style={{ width: '140px' }}><input type="number" min={0} step={1000} placeholder="—" value={x.tuitionFee ?? ''} aria-label={`Matrícula de ${x.name}`}
                      onChange={e => cambiarCurso(x.id, { tuitionFee: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                    <td style={{ width: '140px' }}><input type="number" min={0} step={1000} placeholder="—" value={x.monthlyFee ?? ''} aria-label={`Pensión mensual de ${x.name}`}
                      onChange={e => cambiarCurso(x.id, { monthlyFee: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                    <td><select value={x.nextGradeId ?? ''} disabled={x.isFinal} onChange={e => cambiarCurso(x.id, { nextGradeId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">—</option>{cursos.filter(o => o.id !== x.id).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={x.isFinal} aria-label={`${x.name} es el último curso`}
                      onChange={e => cambiarCurso(x.id, { isFinal: e.target.checked, nextGradeId: e.target.checked ? null : x.nextGradeId })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
