'use client'

import { useCallback, useEffect, useState } from 'react'
import { FaEdit, FaSpinner, FaUserGraduate } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { GRADOS_OFICIALES } from 'app/utils/certificados/comun'
import { obtenerExalumnos, guardarExalumno, type Exalumno } from '../actions'

const VACIO = { fullName: '', docType: 'Tarjeta de Identidad', docNumber: '', birthDate: '', lastGrade: '', exitYear: '', reason: 'Terminó sus estudios' }

export default function ExalumnosPage() {
  const [exalumnos, setExalumnos] = useState<Exalumno[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<typeof VACIO & { id?: number } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    const r = await obtenerExalumnos()
    if (r.exito) setExalumnos(r.exalumnos!)
    else setError(r.error ?? 'No se pudieron cargar los exalumnos.')
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    const r = await guardarExalumno(form)
    setGuardando(false)
    if (!r.exito) { alert(r.error); return }
    setForm(null)
    await cargar()
  }

  const q = busqueda.trim().toLowerCase()
  const lista = q ? exalumnos.filter(a => a.fullName.toLowerCase().includes(q) || (a.docNumber ?? '').includes(q)) : exalumnos

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaUserGraduate color="#3b82f6" /> Exalumnos</h1>
          <p>Quienes terminaron o se retiraron. Conservan sus datos para poder expedirles certificados.</p>
        </div>
        <button type="button" className={`${h.btn} ${h.btnDark}`} onClick={() => setForm(form ? null : { ...VACIO })}>
          {form ? 'Cerrar formulario' : 'Agregar exalumno'}
        </button>
      </header>

      <div className={c.stack}>
        {form && (
          <section className={c.panel}>
            <h3>{form.id ? 'Editar exalumno' : 'Agregar exalumno'}</h3>
            <p>Para quienes estudiaron antes de que existiera la plataforma. Los que salen en «Fin de año» se agregan solos.</p>
            <div className={c.formGrid}>
              <label className={`${h.field} ${c.full}`}>Nombre completo<input className={h.input} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
              <label className={h.field}>Tipo de documento<select className={h.select} value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value })}>
                <option>Tarjeta de Identidad</option><option>Registro Civil</option><option>Cédula de Ciudadanía</option><option>Cédula de Extranjería</option></select></label>
              <label className={h.field}>Número de documento<input className={h.input} value={form.docNumber} onChange={e => setForm({ ...form, docNumber: e.target.value })} /></label>
              <label className={h.field}>Fecha de nacimiento<input className={h.input} type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} /></label>
              <label className={h.field}>Último grado cursado<select className={h.select} value={form.lastGrade} onChange={e => setForm({ ...form, lastGrade: e.target.value })}>
                <option value="">—</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></label>
              <label className={h.field}>Año de salida<input className={h.input} value={form.exitYear} onChange={e => setForm({ ...form, exitYear: e.target.value })} placeholder="Ej: 2022" /></label>
              <label className={h.field}>Motivo<select className={h.select} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
                <option>Terminó sus estudios</option><option>No continúa</option><option>Retiro</option><option>Traslado</option></select></label>
            </div>
            <button type="button" className={`${h.btn} ${h.btnBlue}`} style={{ alignSelf: 'flex-start' }} disabled={guardando} onClick={guardar}>
              {guardando && <FaSpinner className="fa-spin" />} Guardar exalumno
            </button>
          </section>
        )}

        <div className={h.toolbar} style={{ marginBottom: 0 }}>
          <input className={h.input} style={{ maxWidth: '340px' }} placeholder="Buscar por nombre o documento" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>

        {error ? <div className={h.errorBox}>{error}</div> : cargando ? (
          <div className={h.loading}><FaSpinner className="fa-spin" size={36} color="#3b82f6" /></div>
        ) : lista.length === 0 ? (
          <div className={h.empty}>{exalumnos.length ? 'Nadie coincide con la búsqueda.' : 'Aún no hay exalumnos registrados.'}</div>
        ) : (
          <div className={c.tblWrap}>
            <table className={c.tbl}>
              <thead><tr><th>Nombre</th><th>Documento</th><th>Último grado</th><th>Año de salida</th><th>Motivo</th><th /></tr></thead>
              <tbody>
                {lista.map(a => (
                  <tr key={a.id}>
                    <td><b>{a.fullName}</b>{a.lastCourse && <><br /><small className={c.hint}>Curso: {a.lastCourse}</small></>}</td>
                    <td>{[a.docType, a.docNumber].filter(Boolean).join(' ')}</td>
                    <td>{a.lastGrade ?? '—'}</td>
                    <td>{a.exitYear ?? '—'}</td>
                    <td>{a.reason ?? '—'}</td>
                    <td>
                      <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setForm({
                        id: a.id, fullName: a.fullName, docType: a.docType ?? 'Tarjeta de Identidad', docNumber: a.docNumber ?? '',
                        birthDate: a.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(a.birthDate) ? a.birthDate : '', lastGrade: a.lastGrade ?? '',
                        exitYear: a.exitYear ? String(a.exitYear) : '', reason: a.reason ?? 'Terminó sus estudios',
                      })}><FaEdit size={11} /> Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={c.hint}>Los exalumnos piden certificados desde la página pública del colegio (menú «Certificados»), sin iniciar sesión. Se identifican con su documento y fecha de nacimiento.</p>
      </div>
    </main>
  )
}
