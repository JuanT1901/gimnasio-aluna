'use client'

// Lista de habilitaciones por curso. La usan la rectora (Fin de año → Habilitaciones) y los profesores.
import { Fragment, useCallback, useEffect, useState } from 'react'
import { FaPrint, FaRedoAlt, FaSave, FaSpinner, FaTimes } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { type ResultadoHabilitacion, RESULTADO_HABILITACION, fechaEncabezado } from 'app/utils/certificados/comun'
import { obtenerHabilitaciones, guardarHabilitacion, type DatosHabilitaciones, type Habilitacion } from 'app/utils/habilitaciones/actions'

const COLOR: Record<ResultadoHabilitacion | 'pend', string> = { passed: '#15803d', failed: '#dc2626', pend: '#b45309' }
const PILL: Record<ResultadoHabilitacion | 'pend', string> = { passed: h.pillPublished, failed: c.pillAsk, pend: h.pillDraft }

export function EstadoHabilitacion({ result }: { result: ResultadoHabilitacion | null }) {
  return <span className={`${h.pill} ${PILL[result ?? 'pend']}`}>{result ? RESULTADO_HABILITACION[result] : 'Pendiente'}</span>
}

export default function PanelHabilitaciones() {
  const [datos, setDatos] = useState<DatosHabilitaciones | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cursoId, setCursoId] = useState<number | null>(null)
  const [editando, setEditando] = useState<{ cursoId: number, item: Habilitacion } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerHabilitaciones()
    if (!r.exito || !r.datos) { setError(r.error ?? 'No se pudo cargar la información.'); return }
    setDatos(r.datos)
    setCursoId(actual => actual ?? r.datos!.cursos.find(x => x.items.length)?.id ?? r.datos!.cursos[0]?.id ?? null)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!datos) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const items = datos.cursos.flatMap(x => x.items)
  const estudiantes = new Set(items.map(i => i.studentId)).size
  const contar = (r: ResultadoHabilitacion | null) => items.filter(i => i.result === r).length
  const curso = datos.cursos.find(x => x.id === cursoId) ?? datos.cursos[0]
  const minima = datos.notaMinima.toFixed(1)

  // Agrupa las materias de cada estudiante para mostrar su nombre una sola vez
  const porEstudiante = new Map<string, Habilitacion[]>()
  for (const i of curso?.items ?? []) porEstudiante.set(i.studentId, [...(porEstudiante.get(i.studentId) ?? []), i])

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaRedoAlt color="#3b82f6" /> Habilitaciones {datos.anio}</h1>
          <p>
            {datos.esRectora
              ? `Estudiantes con alguna materia por debajo de ${minima}. Cada profesor deja el plan y marca si el estudiante habilitó; tú puedes cambiar cualquier dato.`
              : `Estudiantes de tus materias con nota por debajo de ${minima}. Deja el plan de habilitación y, cuando la presenten, marca si habilitaron.`}
          </p>
        </div>
        {curso && curso.items.length > 0 && (
          <a href={`/impresion/habilitaciones?curso=${curso.id}`} target="_blank" rel="noopener noreferrer" className={`${h.btn} ${h.btnGhost}`}>
            <FaPrint /> Imprimir plan de {curso.name}
          </a>
        )}
      </header>
      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      <div className={c.stack}>
        <div className={c.tiles}>
          <div className={c.tile}><b>{estudiantes}</b><span>Estudiantes en habilitación</span></div>
          <div className={c.tile}><b>{items.length}</b><span>Materias</span></div>
          <div className={c.tile}><b style={{ color: COLOR.pend }}>{contar(null)}</b><span>Pendientes</span></div>
          <div className={c.tile}><b style={{ color: COLOR.passed }}>{contar('passed')}</b><span>Habilitadas</span></div>
          <div className={c.tile}><b style={{ color: COLOR.failed }}>{contar('failed')}</b><span>No habilitadas</span></div>
        </div>

        <span className={c.hint}>
          La nota es el promedio de los periodos que ya tienen nota; mientras falte alguno, la lista puede cambiar. Preescolar no tiene habilitaciones.
          Si el estudiante habilita, la materia queda con {minima} como definitiva.
        </span>

        {datos.cursos.length === 0 ? <div className={h.empty}>{datos.esRectora ? 'No hay cursos con estudiantes.' : 'Ningún estudiante de tus materias va perdiendo.'}</div> : (
          <>
            <div className={h.seg} style={{ flexWrap: 'wrap' }}>
              {datos.cursos.map(x => {
                const n = new Set(x.items.map(i => i.studentId)).size
                return (
                  <button key={x.id} type="button" className={x.id === curso.id ? h.segOn : ''} onClick={() => setCursoId(x.id)}>
                    {x.name}{n > 0 && <b style={{ color: '#dc2626', marginLeft: '6px' }}>{n}</b>}
                  </button>
                )
              })}
            </div>

            {curso.items.length === 0 ? <div className={h.empty}>En {curso.name} ningún estudiante va perdiendo materias.</div> : (
              <section className={c.tblWrap}>
                <table className={c.tbl}>
                  <thead><tr><th>Estudiante</th><th>Materia</th><th>Nota</th><th>Profesor</th><th>Fecha</th><th>Plan</th><th>Resultado</th><th></th></tr></thead>
                  <tbody>
                    {[...porEstudiante.values()].map(lista => (
                      <Fragment key={lista[0].studentId}>
                        {lista.map((i, k) => (
                          <tr key={i.subject}>
                            {k === 0 && <td rowSpan={lista.length} style={{ verticalAlign: 'top' }}><b>{i.studentName}</b><br /><small className={c.hint}>{lista.length} materia(s)</small></td>}
                            <td>{i.subject}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', color: '#dc2626', fontWeight: 700 }}>
                              {i.nota.toFixed(1)}{i.periodos < 3 && <><br /><small className={c.hint} style={{ fontWeight: 400 }}>{i.periodos} de 3 periodos</small></>}
                            </td>
                            <td>{i.teacherName ?? '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{i.examDate ? fechaEncabezado(i.examDate) : '—'}</td>
                            <td style={{ maxWidth: '280px' }}>{i.plan ? <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{i.plan}</span> : <span className={c.hint}>Sin plan</span>}</td>
                            <td><EstadoHabilitacion result={i.result} /></td>
                            <td><button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setEditando({ cursoId: curso.id, item: i })}>Editar</button></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </div>

      {editando && (
        <EditarHabilitacion
          item={editando.item}
          curso={datos.cursos.find(x => x.id === editando.cursoId)?.name ?? ''}
          esRectora={datos.esRectora}
          docentes={datos.docentes}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => { setEditando(null); setAviso('Habilitación guardada.'); await cargar() }}
        />
      )}
    </main>
  )
}

function EditarHabilitacion({ item, curso, esRectora, docentes, onCerrar, onGuardado }: {
  item: Habilitacion, curso: string, esRectora: boolean, docentes: { id: string, name: string }[], onCerrar: () => void, onGuardado: () => void
}) {
  const [teacherId, setTeacherId] = useState(item.teacherId ?? '')
  const [examDate, setExamDate] = useState(item.examDate ?? '')
  const [plan, setPlan] = useState(item.plan)
  const [result, setResult] = useState<ResultadoHabilitacion | null>(item.result)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    const r = await guardarHabilitacion({ studentId: item.studentId, subject: item.subject, teacherId: teacherId || null, examDate: examDate || null, plan, result })
    setGuardando(false)
    if (!r.exito) { alert(r.error); return }
    onGuardado()
  }

  const opciones: [ResultadoHabilitacion | null, string][] = [[null, 'Pendiente'], ['passed', 'Habilitada'], ['failed', 'No habilitada']]

  return (
    <div className={h.backdrop} onClick={onCerrar}>
      <div className={h.modal} role="dialog" aria-modal="true" aria-label={`Habilitación de ${item.subject}`} onClick={e => e.stopPropagation()}>
        <div className={h.modalHead} style={{ background: '#fef2f2', color: '#7f1d1d' }}>
          <div>
            <h3>{item.subject} · {item.nota.toFixed(1)}</h3>
            <p>{item.studentName} · {curso}</p>
          </div>
          <button type="button" className={h.modalClose} onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
        </div>
        <div className={h.modalBody}>
          {esRectora && (
            <label className={h.field}>Profesor que hace la habilitación
              <select className={h.select} value={teacherId} onChange={e => setTeacherId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {docentes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          <label className={h.field}>Fecha de la habilitación
            <input className={h.input} type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={{ maxWidth: '200px' }} />
          </label>
          <label className={h.field}>Plan de habilitación (temas, actividades, qué debe presentar)
            <textarea className={h.input} rows={6} value={plan} maxLength={3000} onChange={e => setPlan(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
          <div className={h.field}>Resultado
            <div className={c.decision}>
              {opciones.map(([r, l]) => (
                <button key={l} type="button" className={result === r ? c.decisionOn : ''} onClick={() => setResult(r)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={h.modalFoot} style={{ justifyContent: 'flex-end' }}>
            <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={onCerrar}>Cancelar</button>
            <button type="button" className={`${h.btn} ${h.btnGreen}`} disabled={guardando} onClick={guardar}>
              {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
