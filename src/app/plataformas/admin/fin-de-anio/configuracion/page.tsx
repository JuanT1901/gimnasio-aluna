'use client'

import { useEffect, useState } from 'react'
import { FaCog, FaSave, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { GRADOS_OFICIALES, NIVELES, nivelDeGrado } from 'app/utils/certificados/comun'
import { obtenerConfiguracionFin, guardarConfiguracionFin, type CursoGrado, type ReglaPromocion } from '../actions'

export default function ConfiguracionFinDeAnioPage() {
  const [regla, setRegla] = useState<ReglaPromocion | null>(null)
  const [cursos, setCursos] = useState<CursoGrado[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    obtenerConfiguracionFin().then(r => {
      if (!r.exito) { setError(r.error ?? 'No se pudo cargar la configuración.'); return }
      setRegla(r.regla!)
      setCursos(r.cursos!)
    })
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!regla) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const guardar = async () => {
    setGuardando(true)
    const r = await guardarConfiguracionFin({ regla, cursos })
    setGuardando(false)
    if (!r.exito) { alert(r.error); return }
    setAviso('Configuración guardada.')
  }

  const cambiarCurso = (id: number, cambios: Partial<CursoGrado>) => setCursos(cursos.map(x => (x.id === id ? { ...x, ...cambios } : x)))

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaCog color="#3b82f6" /> Configuración de fin de año</h1>
          <p>La regla para sugerir quién repite y el grado oficial y curso siguiente de cada curso.</p>
        </div>
        <button type="button" className={`${h.btn} ${h.btnGreen}`} disabled={guardando} onClick={guardar}>
          {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar cambios
        </button>
      </header>
      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      <div className={c.stack}>
        <section className={c.panel}>
          <h3>Regla de promoción</h3>
          <p>Se usa para sugerir quién repite. La decisión final siempre es de la rectora.</p>
          <div className={c.formGrid}>
            <label className={h.field}>Nota mínima para aprobar un área
              <input className={h.input} type="number" step={0.1} min={1} max={5} value={regla.notaMinima} onChange={e => setRegla({ ...regla, notaMinima: Number(e.target.value) })} /></label>
            <label className={h.field}>Áreas perdidas para repetir
              <input className={h.input} type="number" min={1} max={20} value={regla.areasParaRepetir} onChange={e => setRegla({ ...regla, areasParaRepetir: Number(e.target.value) })} /></label>
          </div>
          <span className={c.hint}>Con esta cantidad o más de áreas perdidas se sugiere que el estudiante repita. En preescolar nunca se sugiere repetir.</span>
        </section>

        <section className={c.panel}>
          <h3>Cursos: grado oficial y curso siguiente</h3>
          <p>El certificado dice el grado oficial (ej. «Quinto de educación básica primaria»), no el nombre del curso. El curso siguiente es a donde pasan los estudiantes al cerrar el año. Si un curso tiene estudiantes de dos grados, deja el grado del curso y corrígelo en cada certificado.</p>
          <div className={c.tblWrap}>
            <table className={c.tbl}>
              <thead><tr><th>Curso</th><th>Grado oficial</th><th>Nivel</th><th>Pasan a</th><th>Último curso</th></tr></thead>
              <tbody>
                {cursos.map(x => (
                  <tr key={x.id}>
                    <td><b>{x.name}</b></td>
                    <td><select value={x.officialGrade} onChange={e => cambiarCurso(x.id, { officialGrade: e.target.value, officialLevel: nivelDeGrado(e.target.value) })}>
                      <option value="">—</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></td>
                    <td><select value={x.officialLevel} onChange={e => cambiarCurso(x.id, { officialLevel: e.target.value })}>
                      <option value="">—</option>{NIVELES.map(n => <option key={n}>{n}</option>)}</select></td>
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
