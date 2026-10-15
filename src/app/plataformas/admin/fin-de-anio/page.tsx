'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FaFlagCheckered, FaSpinner, FaUndo } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import type { ResultadoAnio } from 'app/utils/certificados/comun'
import { obtenerFinDeAnio, cerrarAnio, deshacerCierre, type DatosFinDeAnio, type Decision } from './actions'

type Estado = { result: ResultadoAnio | null, nextGradeId: number | null }

const COLOR: Record<ResultadoAnio | 'pend', string> = { promoted: '#15803d', repeat: '#b45309', left: '#64748b', graduated: '#6d28d9', pend: '#dc2626' }

export default function FinDeAnioPage() {
  const [datos, setDatos] = useState<DatosFinDeAnio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decisiones, setDecisiones] = useState<Record<string, Estado>>({})
  const [cursoId, setCursoId] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState<{ resumen: Record<ResultadoAnio, number>, anioNuevo: number } | null>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerFinDeAnio()
    if (!r.exito || !r.datos) { setError(r.error ?? 'No se pudo cargar la información.'); return }
    setDatos(r.datos)
    const inicial: Record<string, Estado> = {}
    for (const curso of r.datos.cursos) for (const e of curso.estudiantes) {
      inicial[e.id] = { result: e.sugerido, nextGradeId: e.sugerido === 'promoted' ? curso.nextGradeId : null }
    }
    setDecisiones(inicial)
    setCursoId(r.datos.cursos[0]?.id ?? null)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const todos = useMemo(() => (datos?.cursos ?? []).flatMap(x => x.estudiantes.map(e => ({ ...e, cursoId: x.id }))), [datos])
  const contar = (r: ResultadoAnio | null) => todos.filter(e => (decisiones[e.id]?.result ?? null) === r).length
  const pendientes = contar(null)
  const sinDestino = todos.filter(e => decisiones[e.id]?.result === 'promoted' && !decisiones[e.id]?.nextGradeId).length
  const incompletos = todos.filter(e => e.incompletas > 0).length

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!datos) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const deshacer = async (anio: number) => {
    if (!confirm(`Se devolverán los estudiantes a sus cursos de ${anio} y se restaurarán las notas. ¿Continuar?`)) return
    setOcupado(true)
    const r = await deshacerCierre(anio)
    setOcupado(false)
    if (!r.exito) { alert(r.error); return }
    setHecho(null)
    setDatos(null)
    await cargar()
  }

  if (hecho) {
    const salen = (hecho.resumen.left ?? 0) + (hecho.resumen.graduated ?? 0)
    return (
      <main className={styles.mainContent}>
        <header className={styles.header}><div><h1>Fin de año {hecho.anioNuevo - 1}</h1><p>El año activo ahora es {hecho.anioNuevo}.</p></div></header>
        <div className={c.stack}>
          <div className={c.okBox} style={{ fontSize: '0.95rem' }}>
            Listo. <b>{hecho.resumen.promoted ?? 0}</b> estudiantes pasaron de curso, <b>{hecho.resumen.repeat ?? 0}</b> repiten y <b>{salen}</b> pasaron a Exalumnos.
            Las notas de {hecho.anioNuevo - 1} quedaron guardadas en el historial para los certificados, y las planillas quedaron vacías para el año nuevo.
          </div>
          <div className={h.toolbar}>
            <Link href="/plataformas/admin/certificados/exalumnos" className={`${h.btn} ${h.btnGhost}`}>Ver exalumnos</Link>
            <button type="button" className={`${h.btn} ${h.btnWarn}`} disabled={ocupado} onClick={() => deshacer(hecho.anioNuevo - 1)}><FaUndo size={11} /> Deshacer paso de año</button>
          </div>
          <p className={c.hint}>Se puede deshacer mientras no se hayan registrado notas del año nuevo.</p>
        </div>
      </main>
    )
  }

  const curso = datos.cursos.find(x => x.id === cursoId) ?? datos.cursos[0]
  const opciones: [ResultadoAnio, string][] = curso?.isFinal
    ? [['graduated', 'Se gradúa'], ['repeat', 'Repite'], ['left', 'No continúa']]
    : [['promoted', curso?.nextName ? `Pasa a ${curso.nextName}` : 'Pasa de curso'], ['repeat', 'Repite'], ['left', 'No continúa']]

  const decidir = (id: string, result: ResultadoAnio) =>
    setDecisiones({ ...decisiones, [id]: { result, nextGradeId: result === 'promoted' ? decisiones[id]?.nextGradeId ?? curso.nextGradeId : null } })

  const confirmar = async () => {
    const lista: Decision[] = todos.map(e => ({ studentId: e.id, result: decisiones[e.id].result!, nextGradeId: decisiones[e.id].nextGradeId }))
    setOcupado(true)
    const r = await cerrarAnio(lista, confirmacion)
    setOcupado(false)
    if (!r.exito) { alert(r.error); return }
    setHecho({ resumen: r.resumen!, anioNuevo: r.anioNuevo! })
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaFlagCheckered color="#3b82f6" /> Fin de año {datos.anio}</h1>
          <p>Revisa qué pasa con cada estudiante y, cuando todo esté listo, pásalos al año {datos.anio + 1} con un solo botón.</p>
        </div>
        {datos.ultimoCerrado && (
          <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={ocupado} onClick={() => deshacer(datos.ultimoCerrado!)}>
            <FaUndo size={11} /> Deshacer el cierre de {datos.ultimoCerrado}
          </button>
        )}
      </header>

      <div className={c.stack}>
        <div className={c.tiles}>
          {([['promoted', 'Pasan de curso'], ['repeat', 'Repiten'], ['left', 'No continúan'], ['graduated', 'Se gradúan']] as [ResultadoAnio, string][]).map(([r, l]) => (
            <div key={r} className={c.tile}><b style={{ color: COLOR[r] }}>{contar(r)}</b><span>{l}</span></div>
          ))}
          <div className={c.tile}><b style={{ color: COLOR.pend }}>{pendientes}</b><span>Por revisar</span></div>
        </div>

        <div className={c.noteBox} style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}>
          <strong style={{ color: '#64748b' }}>Cómo se sugiere</strong>
          El sistema propone «pasa de curso» a todos, salvo a quien tenga {datos.reglas.areasParaRepetir} o más áreas con definitiva menor a {datos.reglas.notaMinima.toFixed(1)}; esos quedan «por revisar». En preescolar nunca se sugiere repetir. La regla se cambia en Fin de año → Configuración.
        </div>

        {datos.cursos.length === 0 ? <div className={h.empty}>No hay estudiantes con curso asignado.</div> : (
          <>
            <div className={h.seg} style={{ flexWrap: 'wrap' }}>
              {datos.cursos.map(x => {
                const p = x.estudiantes.filter(e => !decisiones[e.id]?.result).length
                return (
                  <button key={x.id} type="button" className={x.id === curso.id ? h.segOn : ''} onClick={() => setCursoId(x.id)}>
                    {x.name}{p > 0 && <b style={{ color: '#dc2626', marginLeft: '6px' }}>{p}</b>}
                  </button>
                )
              })}
            </div>

            <section className={c.panel}>
              <h3>
                {curso.name}{curso.officialGrade ? ` · ${curso.officialGrade}` : ''}{' → '}
                {curso.isFinal ? <span style={{ color: COLOR.graduated }}>se gradúan</span>
                  : curso.nextName ? <span style={{ color: COLOR.promoted }}>pasan a {curso.nextName}</span>
                    : <span style={{ color: COLOR.pend }}>falta definir el curso siguiente en Configuración</span>}
              </h3>
              <div className={c.tblWrap}>
                <table className={c.tbl}>
                  <thead><tr><th>Estudiante</th><th>Promedio</th><th>Áreas perdidas</th><th>Decisión</th></tr></thead>
                  <tbody>
                    {curso.estudiantes.map(e => {
                      const d = decisiones[e.id]
                      return (
                        <tr key={e.id} className={d?.result ? '' : c.rowReview}>
                          <td>
                            <b>{e.name}</b>
                            {!d?.result && <><br /><small style={{ color: '#b45309', fontWeight: 600 }}>Sugerido: repite ({e.lostAreas} áreas perdidas)</small></>}
                            {e.incompletas > 0 && <><br /><small className={c.hint}>{e.incompletas} materia(s) sin nota en algún periodo</small></>}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.average?.toFixed(1) ?? '—'}</td>
                          <td style={{ color: e.lostAreas >= datos.reglas.areasParaRepetir ? '#dc2626' : undefined, fontWeight: e.lostAreas >= datos.reglas.areasParaRepetir ? 700 : 400 }}>{curso.preescolar ? '—' : e.lostAreas}</td>
                          <td>
                            <div className={c.decision}>
                              {opciones.map(([r, l]) => (
                                <button key={r} type="button" className={d?.result === r ? c.decisionOn : ''} onClick={() => decidir(e.id, r)}>{l}</button>
                              ))}
                            </div>
                            {d?.result === 'promoted' && (
                              <select style={{ marginTop: '6px', maxWidth: '220px' }} value={d.nextGradeId ?? ''} aria-label="Curso de destino"
                                onChange={ev => setDecisiones({ ...decisiones, [e.id]: { ...d, nextGradeId: ev.target.value ? Number(ev.target.value) : null } })}>
                                <option value="">— Curso de destino —</option>
                                {datos.cursos.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                              </select>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className={c.hint}>Si el curso tiene estudiantes de dos grados, cambia el curso de destino de cada uno.</p>
            </section>
          </>
        )}

        <section className={c.panel}>
          <h3>Pasar al año {datos.anio + 1}</h3>
          <div className={c.checks}>
            <span className={incompletos ? c.checkNo : c.checkOk}>{incompletos ? `✕ ${incompletos} estudiante(s) con notas incompletas (revisa que el 3.er periodo esté cerrado)` : '✓ Notas completas en todos los cursos'}</span>
            <span className={pendientes ? c.checkNo : c.checkOk}>{pendientes ? `✕ Faltan ${pendientes} estudiante(s) por revisar` : '✓ Todas las decisiones revisadas'}</span>
            <span className={sinDestino ? c.checkNo : c.checkOk}>{sinDestino ? `✕ ${sinDestino} estudiante(s) pasan de curso sin curso de destino` : '✓ Todos los que pasan tienen curso de destino'}</span>
            {datos.sinCurso > 0 && <span className={c.checkNo}>✕ {datos.sinCurso} estudiante(s) sin curso asignado: no se tendrán en cuenta</span>}
          </div>
          <p>Al confirmar: se guarda el historial de {datos.anio} (curso, notas y resultado de cada estudiante), cada estudiante queda en su nuevo curso, los que no continúan o se gradúan pasan a Exalumnos, las planillas quedan vacías para {datos.anio + 1} y el año activo cambia. Profesores, materias y horarios de cada curso no cambian.</p>
          {confirmando ? (
            <div className={h.toolbar} style={{ marginBottom: 0 }}>
              <label className={h.field}>Escribe {datos.anio + 1} para confirmar<input className={h.input} value={confirmacion} onChange={e => setConfirmacion(e.target.value)} placeholder={String(datos.anio + 1)} style={{ maxWidth: '160px' }} /></label>
              <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={() => setConfirmando(false)}>Cancelar</button>
              <button type="button" className={`${h.btn} ${h.btnDark}`} disabled={ocupado || confirmacion.trim() !== String(datos.anio + 1)} onClick={confirmar}>
                {ocupado && <FaSpinner className="fa-spin" />} Confirmar paso de año
              </button>
            </div>
          ) : (
            <>
              <button type="button" className={`${h.btn} ${h.btnDark}`} style={{ alignSelf: 'flex-start' }} disabled={pendientes > 0 || sinDestino > 0 || todos.length === 0} onClick={() => setConfirmando(true)}>
                Pasar estudiantes al año {datos.anio + 1}
              </button>
              {(pendientes > 0 || sinDestino > 0) && <span className={c.hint}>Resuelve primero los puntos marcados en rojo.</span>}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
