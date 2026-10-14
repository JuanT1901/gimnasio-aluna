'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaCloudUploadAlt, FaEdit, FaPencilAlt, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import { NavegadorSemana, estiloMateria } from 'app/components/horario/HorarioSemanal'
import { DIAS, clavePlaneacion, diaDeSemana, esFechaISO, lunesDeSemana, rangoHoras, semanaActual } from 'app/utils/horario/comun'
import { obtenerMiPlaneacion, subirPlaneacion, type DiaPlaneacion, type GrupoPlaneacion } from './actions'

function PlaneacionProfesor() {
  const searchParams = useSearchParams()
  const [semana, setSemana] = useState(() => {
    const pedida = searchParams.get('semana')
    return pedida && esFechaISO(pedida) ? lunesDeSemana(pedida) : semanaActual()
  })
  const [grupos, setGrupos] = useState<GrupoPlaneacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState<Record<string, boolean>>({})
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [subidas, setSubidas] = useState<Record<string, boolean>>({})
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    const id = ++peticion.current
    setCargando(true)
    const r = await obtenerMiPlaneacion(semana)
    if (id !== peticion.current) return
    if (r.exito) {
      setGrupos(r.grupos!)
      setError(null)
      const iniciales: Record<string, string> = {}
      for (const g of r.grupos!) for (const d of g.dias) {
        if (d.plan) iniciales[clavePlaneacion(g.gradeId, g.subjectId, d.fecha)] = d.plan.content
      }
      setTextos(iniciales)
      setEditando({})
      setSubidas({})
    } else {
      setError(r.error ?? 'No se pudo cargar tu planeación.')
    }
    setCargando(false)
  }, [semana])

  useEffect(() => { cargar() }, [cargar])

  // Al llegar desde una notificación se lleva la vista hasta esa planeación
  const planResaltado = Number(searchParams.get('plan')) || null
  useEffect(() => {
    if (cargando || !planResaltado) return
    document.getElementById(`plan-${planResaltado}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [cargando, planResaltado])

  const subir = async (g: GrupoPlaneacion, d: DiaPlaneacion) => {
    const k = clavePlaneacion(g.gradeId, g.subjectId, d.fecha)
    const content = (textos[k] ?? '').trim()
    if (!content) { alert('Escribe los logros de la clase antes de subirla.'); return }
    setSubiendo(k)
    const r = await subirPlaneacion({ gradeId: g.gradeId, subjectId: g.subjectId, classDate: d.fecha, content })
    setSubiendo(null)
    if (!r.exito) { alert('Error: ' + r.error); return }
    setGrupos(prev => prev.map(gr => gr.gradeId !== g.gradeId || gr.subjectId !== g.subjectId ? gr : {
      ...gr,
      dias: gr.dias.map(x => x.fecha !== d.fecha ? x : {
        ...x, plan: { id: x.plan?.id ?? 0, content, status: 'draft', updatedAt: new Date().toISOString(), reviewNote: null, adminEdited: false },
      }),
    }))
    setEditando(prev => ({ ...prev, [k]: false }))
    setSubidas(prev => ({ ...prev, [k]: true }))
  }

  const pendientes = grupos.reduce((n, g) => n + g.dias.filter(d => !d.sinClase && !d.plan).length, 0)

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaPencilAlt color="#10b981" /> Planeación semanal</h1>
          <p>Escribe los logros de cada día de clase y oprime «Subir». La rectora los revisa y los publica para los estudiantes.</p>
        </div>
        <NavegadorSemana semana={semana} onCambiar={setSemana} />
      </header>

      {!cargando && !error && grupos.length > 0 && (
        <p style={{ margin: '-8px 0 18px', color: pendientes ? '#b45309' : '#15803d', fontSize: '0.9rem', fontWeight: 500 }}>
          {pendientes ? `Te faltan ${pendientes} clase${pendientes > 1 ? 's' : ''} por planear esta semana.` : 'Ya subiste la planeación de todas tus clases de esta semana.'}
        </p>
      )}

      {error ? <div className={h.errorBox}>{error}</div> : cargando ? (
        <div className={h.loading}><FaSpinner className="fa-spin" size={40} color="#10b981" /></div>
      ) : grupos.length === 0 ? (
        <div className={h.empty}>No tienes clases en el horario. Cuando la rectora cargue el horario de tus cursos, aparecerán aquí.</div>
      ) : (
        <div className={h.planGroups}>
          {grupos.map(g => (
            <section key={`${g.gradeId}-${g.subjectId}`} className={h.planGroup} style={estiloMateria(g.subjectName)}>
              <header>
                <h3>{g.subjectName} · {g.gradeName}</h3>
                <span>{g.dias.length} día{g.dias.length !== 1 ? 's' : ''} de clase esta semana</span>
              </header>
              {g.dias.map(d => {
                const k = clavePlaneacion(g.gradeId, g.subjectId, d.fecha)
                const horas = d.horas.map(x => rangoHoras(x.start, x.end)).join(' y ')
                const cuando = (
                  <div className={h.planWhen}>
                    <strong>{DIAS[diaDeSemana(d.fecha) - 1]} {Number(d.fecha.slice(8))}</strong>
                    {horas}
                  </div>
                )

                if (d.sinClase) {
                  return (
                    <div key={d.fecha} className={`${h.planDay} ${h.planDayOff}`}>
                      {cuando}
                      <div className={h.planBody}>Sin clase · {d.sinClase}. No necesitas subir planeación.</div>
                    </div>
                  )
                }

                const idDia = d.plan?.id ? `plan-${d.plan.id}` : undefined
                const claseDia = `${h.planDay} ${d.plan?.id && d.plan.id === planResaltado ? h.planDayHighlight : ''}`
                const editada = d.plan?.adminEdited && !subidas[k]
                  ? <span className={`${h.pill} ${h.pillEdited}`}>Editada por rectoría</span>
                  : null

                if (d.plan?.status === 'published' && !editando[k]) {
                  return (
                    <div key={d.fecha} id={idDia} className={claseDia}>
                      {cuando}
                      <div className={h.planBody}>
                        <div className={h.planPublished}>{d.plan.content}</div>
                        <div className={h.planRow}>
                          <span className={`${h.pill} ${h.pillPublished}`}>Publicada · visible para los estudiantes</span>
                          {editada}
                          <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setEditando({ ...editando, [k]: true })}>
                            <FaEdit size={11} /> Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                const estado = subidas[k]
                  ? <span className={h.planHint} style={{ color: '#15803d' }}>Subida. Queda en borrador hasta que la rectora la publique.</span>
                  : editando[k]
                    ? <span className={h.planHint}>Al subir los cambios vuelve a revisión, y los estudiantes no la verán hasta que la rectora la publique de nuevo.</span>
                    : d.plan?.reviewNote
                      ? <span className={`${h.pill} ${h.pillDraft}`}>Devuelta por rectoría · corrígela y súbela de nuevo</span>
                    : d.plan
                      ? <span className={`${h.pill} ${h.pillDraft}`}>Borrador · en revisión por rectoría</span>
                      : <span className={`${h.pill} ${h.pillNone}`}>Sin planeación</span>

                return (
                  <div key={d.fecha} id={idDia} className={claseDia}>
                    {cuando}
                    <div className={h.planBody}>
                      {d.plan?.reviewNote && !subidas[k] && (
                        <div className={h.noteBox}>
                          <strong>Observación de rectoría</strong>
                          {d.plan.reviewNote}
                        </div>
                      )}
                      <textarea
                        className={h.planText}
                        value={textos[k] ?? ''}
                        placeholder="Escribe aquí los logros que trabajarás en esta clase…"
                        maxLength={5000}
                        onChange={e => {
                          setTextos({ ...textos, [k]: e.target.value })
                          if (subidas[k]) setSubidas({ ...subidas, [k]: false })
                        }}
                      />
                      <div className={h.planRow}>
                        {estado}
                        {editada}
                        <span className={h.spacer} />
                        {editando[k] && (
                          <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => {
                            setEditando({ ...editando, [k]: false })
                            setTextos({ ...textos, [k]: d.plan?.content ?? '' })
                          }}>
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${h.btn} ${h.btnGreen}`}
                          disabled={subiendo === k || !(textos[k] ?? '').trim() || (d.plan?.content === (textos[k] ?? '').trim() && d.plan.status === 'draft' && !d.plan.reviewNote)}
                          onClick={() => subir(g, d)}
                        >
                          {subiendo === k ? <FaSpinner className="fa-spin" /> : <FaCloudUploadAlt />} Subir
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}

export default function PlaneacionProfesorPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#10b981" /></div>}>
      <PlaneacionProfesor />
    </Suspense>
  )
}
