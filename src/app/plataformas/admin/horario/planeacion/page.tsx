'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaClipboardCheck, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import { CLASE_PILL, NavegadorSemana, Segmentado, estiloMateria } from 'app/components/horario/HorarioSemanal'
import {
  type DiaSinClase, ESTADO_PLANEACION, NOMBRE_ALCANCE, fechasDeSemana, formatoLargo, rangoHoras, semanaActual,
} from 'app/utils/horario/comun'
import AccionesPlaneacion, { type PlanRevisable } from 'app/components/horario/AccionesPlaneacion'
import { obtenerPlaneacionesSemana, type FilaRevision } from '../actions'

type FiltroEstado = 'todas' | 'draft' | 'published' | 'none'

export default function PlaneacionSemanalAdminPage() {
  // La semana se calcula en el navegador (hora de Colombia), no en el servidor
  const [semana, setSemana] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaRevision[]>([])
  const [dias, setDias] = useState<DiaSinClase[]>([])
  const [cursos, setCursos] = useState<{ id: number, name: string }[]>([])
  const [cursoId, setCursoId] = useState(0) // 0 = todos los cursos
  const [estado, setEstado] = useState<FiltroEstado>('todas')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const peticion = useRef(0)

  useEffect(() => { setSemana(semanaActual()) }, [])

  const cargar = useCallback(async () => {
    if (!semana) return
    const id = ++peticion.current
    setCargando(true)
    const r = await obtenerPlaneacionesSemana(semana)
    if (id !== peticion.current) return
    if (r.exito) {
      setFilas(r.filas!)
      setDias(r.diasSinClase!)
      setCursos(r.cursos!)
      setError(null)
    } else {
      setError(r.error ?? 'No se pudo cargar la planeación.')
    }
    setCargando(false)
  }, [semana])

  useEffect(() => { cargar() }, [cargar])

  const actualizarPlan = (plan: PlanRevisable) =>
    setFilas(prev => prev.map(f => (f.plan?.id === plan.id ? { ...f, plan: { ...f.plan, ...plan } } : f)))

  const estadoDe = (f: FilaRevision) => f.plan?.status ?? 'none'
  const delCurso = useMemo(() => filas.filter(f => !cursoId || f.gradeId === cursoId), [filas, cursoId])
  const contar = (e: FiltroEstado) => delCurso.filter(f => estadoDe(f) === e).length
  const visibles = delCurso.filter(f => estado === 'todas' || estadoDe(f) === estado)

  if (!semana) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const fechas = fechasDeSemana(semana)
  const diaLibre = (fecha: string) => dias.filter(d => fecha >= d.startDate && fecha <= d.endDate)

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaClipboardCheck color="#3b82f6" /> Planeación semanal</h1>
          <p>Revisa lo que subieron los docentes y publícalo para que lo vean los estudiantes.</p>
        </div>
        <NavegadorSemana semana={semana} onCambiar={setSemana} />
      </header>

      <div className={h.counts}>
        <button type="button" className={`${h.count} ${h.countDraft}`} onClick={() => setEstado('draft')}><b>{contar('draft')}</b><span>en borrador por revisar</span></button>
        <button type="button" className={`${h.count} ${h.countPublished}`} onClick={() => setEstado('published')}><b>{contar('published')}</b><span>publicadas</span></button>
        <button type="button" className={`${h.count} ${h.countNone}`} onClick={() => setEstado('none')}><b>{contar('none')}</b><span>clases sin planeación</span></button>
      </div>

      <div className={h.toolbar}>
        <label className={h.field}>
          Curso
          <select className={h.select} value={cursoId} onChange={e => setCursoId(Number(e.target.value))}>
            <option value={0}>Todos los cursos</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className={h.field}>
          Estado
          <Segmentado<FiltroEstado>
            valor={estado}
            onCambiar={setEstado}
            opciones={[['todas', 'Todas'], ['draft', 'Borradores'], ['published', 'Publicadas'], ['none', 'Sin planeación']]}
          />
        </div>
        {cargando && <FaSpinner className="fa-spin" color="#3b82f6" style={{ marginBottom: '10px' }} />}
      </div>

      {error ? <div className={h.errorBox}>{error}</div> : (
        <div className={h.reviewDays}>
          {fechas.map(fecha => {
            const libres = diaLibre(fecha)
            const delDia = visibles.filter(f => f.fecha === fecha)
            if (!libres.length && !delDia.length) return null
            return (
              <section key={fecha}>
                <h2 className={h.reviewDayTitle}>{formatoLargo(fecha)}</h2>
                <div className={h.review}>
                  {libres.map(d => (
                    <div key={d.id} className={`${h.rv} ${h.rvOff}`}>
                      <div className={h.rvWhen}>Sin clase</div>
                      <div className={h.rvWhat}>
                        <div className={h.rvTitle}>{d.reason} <span className={`${h.pill} ${h.pillOff}`}>{NOMBRE_ALCANCE[d.scope]}</span></div>
                        <p>No se pide planeación para {d.scope === 'all' ? 'este día' : `${NOMBRE_ALCANCE[d.scope].toLowerCase()} este día`}.</p>
                      </div>
                    </div>
                  ))}
                  {delDia.map(f => {
                    const st = estadoDe(f)
                    return (
                      <div key={f.clave} className={h.rv}>
                        <div className={h.rvWhen}>
                          {f.horas.length ? f.horas.map(x => <span key={x.start}>{rangoHoras(x.start, x.end)}</span>) : <span>Fuera del horario</span>}
                        </div>
                        <div className={h.rvWhat}>
                          <div className={h.rvTitle}>
                            <i className={h.areaChip} style={estiloMateria(f.subjectName)} />
                            {f.subjectName}
                            <small>{f.gradeName} · {f.plan?.teacherName ?? f.teacherName ?? 'Sin docente asignado'}</small>
                            <span className={`${h.pill} ${CLASE_PILL[st]}`}>{ESTADO_PLANEACION[st]}</span>
                          </div>
                          {f.plan
                            ? <AccionesPlaneacion plan={f.plan} onCambio={actualizarPlan} />
                            : <p className={h.rvEmpty}>El docente aún no ha subido la planeación de esta clase.</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
          {!cargando && visibles.length === 0 && (
            <div className={h.empty}>
              {filas.length === 0 ? 'No hay clases programadas esta semana.' : 'No hay clases con ese filtro.'}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
