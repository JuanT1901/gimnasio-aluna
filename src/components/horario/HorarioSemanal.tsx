'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { FaChevronLeft, FaChevronRight, FaSpinner, FaTimes, FaCalendarAlt } from 'react-icons/fa'
import styles from 'app/styles/pages/Horario.module.scss'
import { colorMateria } from 'app/utils/areas'
import AccionesPlaneacion, { type PlanRevisable } from './AccionesPlaneacion'
import {
  type ClaseHorario, type DatosHorario, type EstadoPlaneacion, type Planeacion,
  DIAS_CORTOS, ESTADO_PLANEACION, clavePlaneacion, etiquetaSemana, fechasDeSemana, formatoCorto,
  formatoHora, formatoLargo, hoyISO, motivoSinClase, rangoHoras, semanaActual, sumarDias,
} from 'app/utils/horario/comun'

type Rol = 'admin' | 'teacher' | 'student'
type Fila = { start: string, end: string, isBreak: boolean }
type Bloque = { fila: number, filas: number, start: string, end: string, clase: ClaseHorario | null }
type Seleccion = { clase: ClaseHorario, fecha: string, start: string, end: string }

export const estiloMateria = (nombre: string | null) => {
  const c = colorMateria(nombre)
  return { '--c-bg': c.bg, '--c-ink': c.text, '--c-line': c.border } as CSSProperties
}

export const CLASE_PILL: Record<EstadoPlaneacion | 'none', string> = {
  published: styles.pillPublished,
  draft: styles.pillDraft,
  none: styles.pillNone,
}

const CLASE_DOT: Record<EstadoPlaneacion | 'none', string> = {
  published: styles.dotPublished,
  draft: styles.dotDraft,
  none: styles.dotNone,
}

export function NavegadorSemana({ semana, onCambiar }: { semana: string, onCambiar: (lunes: string) => void }) {
  const actual = semanaActual()
  return (
    <div className={styles.weekNav}>
      <div className={styles.weekBox}>
        <button type="button" onClick={() => onCambiar(sumarDias(semana, -7))} aria-label="Semana anterior"><FaChevronLeft size={13} /></button>
        <span className={styles.weekLabel}>{etiquetaSemana(semana)}</span>
        <button type="button" onClick={() => onCambiar(sumarDias(semana, 7))} aria-label="Semana siguiente"><FaChevronRight size={13} /></button>
      </div>
      <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => onCambiar(actual)} disabled={semana === actual}>
        Hoy
      </button>
    </div>
  )
}

export function Segmentado<T extends string>({ valor, opciones, onCambiar }: { valor: T, opciones: [T, string][], onCambiar: (v: T) => void }) {
  return (
    <div className={styles.seg}>
      {opciones.map(([v, etiqueta]) => (
        <button key={v} type="button" className={valor === v ? styles.segOn : ''} onClick={() => onCambiar(v)}>{etiqueta}</button>
      ))}
    </div>
  )
}

// Une las franjas de todas las secciones visibles. Una fila solo es descanso si lo es en todas.
function construirFilas(datos: DatosHorario): Fila[] {
  const mapa = new Map<string, { start: string, end: string, total: number, descansos: number }>()
  for (const f of datos.franjas) {
    const k = `${f.start}-${f.end}`
    const fila = mapa.get(k) ?? { start: f.start, end: f.end, total: 0, descansos: 0 }
    fila.total++
    if (f.isBreak) fila.descansos++
    mapa.set(k, fila)
  }
  return [...mapa.values()]
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    .map(f => ({ start: f.start, end: f.end, isBreak: f.descansos === f.total }))
}

const mismaClase = (a: ClaseHorario, b: ClaseHorario) => a.gradeId === b.gradeId && a.subjectId === b.subjectId && a.label === b.label

// Franjas seguidas con la misma materia se muestran como un solo bloque (clase de 2 horas)
function bloquesDelDia(filas: Fila[], clases: ClaseHorario[], dia: number): Bloque[] {
  const bloques: Bloque[] = []
  filas.forEach((f, i) => {
    if (f.isBreak) return
    const clase = clases.find(c => c.dayOfWeek === dia && c.start === f.start && c.end === f.end) ?? null
    const ultimo = bloques[bloques.length - 1]
    if (clase && ultimo?.clase && ultimo.fila + ultimo.filas === i && ultimo.end === f.start && mismaClase(ultimo.clase, clase)) {
      ultimo.filas++
      ultimo.end = f.end
    } else {
      bloques.push({ fila: i, filas: 1, start: f.start, end: f.end, clase })
    }
  })
  return bloques
}

type Props = {
  datos: DatosHorario | null
  cargando: boolean
  rol: Rol
  userId?: string
  mostrarCurso?: boolean // vista por docente: muestra el curso en lugar del docente
  vacio?: string
  onPlanActualizado?: () => void // la rectora publicó, editó o despublicó desde la ventana de la clase
}

export default function HorarioSemanal({ datos, cargando, rol, userId, mostrarCurso = false, vacio, onPlanActualizado }: Props) {
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  const [diaElegido, setDiaElegido] = useState<{ semana: string, dia: number } | null>(null)
  const toqueX = useRef<number | null>(null)
  const hoy = hoyISO()

  const filas = useMemo(() => (datos ? construirFilas(datos) : []), [datos])
  const planes = useMemo(
    () => new Map<string, Planeacion>((datos?.planeaciones || []).map(p => [clavePlaneacion(p.gradeId, p.subjectId, p.classDate), p])),
    [datos]
  )

  useEffect(() => {
    if (!seleccion) return
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') setSeleccion(null) }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [seleccion])

  // Mientras recarga se deja ver el horario anterior atenuado, para no cerrar la ventana de la clase
  if (!datos) {
    return <div className={styles.loading}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>
  }

  const fechas = fechasDeSemana(datos.weekStart)
  const secciones = [...new Set(datos.franjas.map(f => f.section))]
  const motivoColumna = (fecha: string) =>
    secciones.length > 0 && secciones.every(s => motivoSinClase(datos.diasSinClase, fecha, s))
      ? motivoSinClase(datos.diasSinClase, fecha, secciones[0])
      : null

  const indiceHoy = fechas.indexOf(hoy)
  const dia = diaElegido?.semana === datos.weekStart ? diaElegido.dia : Math.max(indiceHoy, 0)
  const elegirDia = (d: number) => setDiaElegido({ semana: datos.weekStart, dia: Math.min(4, Math.max(0, d)) })

  const estadoDe = (c: ClaseHorario, fecha: string): EstadoPlaneacion | 'none' =>
    c.subjectId ? planes.get(clavePlaneacion(c.gradeId, c.subjectId, fecha))?.status ?? 'none' : 'none'

  const renderClase = (b: Bloque, fecha: string) => {
    const c = b.clase!
    const nombre = c.subjectName ?? c.label ?? 'Clase'
    const detalle = mostrarCurso ? c.gradeName : c.teacherName ?? ''
    const sinClase = motivoSinClase(datos.diasSinClase, fecha, c.section)

    if (!c.subjectId) {
      return (
        <div className={`${styles.clase} ${styles.claseFija}`} style={estiloMateria(null)}>
          <span className={styles.subj}>{nombre}</span>
          {mostrarCurso && <span className={styles.who}>{c.gradeName}</span>}
        </div>
      )
    }

    const estado = estadoDe(c, fecha)
    const punto = sinClase ? null : rol === 'student'
      ? (estado === 'published' ? <span className={`${styles.dot} ${styles.dotPublished}`} title="Planeación disponible" /> : null)
      : <span className={`${styles.dot} ${CLASE_DOT[estado]}`} title={ESTADO_PLANEACION[estado]} />

    return (
      <button
        type="button"
        className={`${styles.clase} ${sinClase ? styles.claseOff : ''}`}
        style={estiloMateria(c.subjectName)}
        disabled={!!sinClase}
        title={sinClase ? `Sin clase: ${sinClase}` : undefined}
        onClick={() => setSeleccion({ clase: c, fecha, start: b.start, end: b.end })}
      >
        {punto}
        <span className={styles.subj}>{nombre}</span>
        {detalle && <span className={styles.who}>{detalle}</span>}
        {sinClase
          ? <span className={styles.dur}>Sin clase</span>
          : b.filas > 1 && <span className={styles.dur}>{rangoHoras(b.start, b.end)}</span>}
      </button>
    )
  }

  if (datos.clases.length === 0) {
    return <div className={styles.empty}>{vacio ?? 'Aún no hay clases en este horario.'}</div>
  }

  const onTouchEnd = (x: number) => {
    if (toqueX.current === null) return
    const dx = x - toqueX.current
    toqueX.current = null
    if (Math.abs(dx) > 60) elegirDia(dia + (dx < 0 ? 1 : -1))
  }

  const fechaMovil = fechas[dia]
  const offMovil = motivoColumna(fechaMovil)
  const bloquesMovil = bloquesDelDia(filas, datos.clases, dia + 1)

  return (
    <div style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 0.2s' }} aria-busy={cargando}>
      {/* ESCRITORIO: semana completa */}
      <div className={`${styles.gridWrap} ${styles.desktopOnly}`}>
        <div className={styles.grid}>
          <div className={styles.dayHead} style={{ gridRow: 1, gridColumn: 1 }} />
          {fechas.map((f, i) => (
            <div key={f} className={`${styles.dayHead} ${f === hoy ? styles.dayToday : ''}`} style={{ gridRow: 1, gridColumn: i + 2 }}>
              {DIAS_CORTOS[i]}<strong>{formatoCorto(f)}</strong>
            </div>
          ))}

          {filas.map((f, i) => (
            <div key={`${f.start}-${f.end}`} className={`${styles.time} ${f.isBreak ? styles.timeBreak : ''}`} style={{ gridRow: i + 2, gridColumn: 1 }}>
              {f.isBreak
                ? <><b>Descanso</b>{rangoHoras(f.start, f.end)}</>
                : <><b>{formatoHora(f.start)}</b>{formatoHora(f.end)}</>}
            </div>
          ))}

          {fechas.map((fecha, d) => {
            const off = motivoColumna(fecha)
            if (off) {
              return (
                <div key={fecha} className={styles.offColumn} style={{ gridRow: `2 / span ${filas.length}`, gridColumn: d + 2 }}>
                  <strong>Sin clase</strong>{off}
                </div>
              )
            }
            return (
              <Fragment key={fecha}>
                {filas.map((f, i) => f.isBreak && (
                  <div key={`d-${i}`} className={styles.breakCell} style={{ gridRow: i + 2, gridColumn: d + 2 }} />
                ))}
                {bloquesDelDia(filas, datos.clases, d + 1).map(b => (
                  <div key={`c-${b.fila}`} className={styles.cell} style={{ gridRow: `${b.fila + 2} / span ${b.filas}`, gridColumn: d + 2 }}>
                    {b.clase && renderClase(b, fecha)}
                  </div>
                ))}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* CELULAR: un día a la vez */}
      <div className={styles.mobileOnly}>
        <div className={styles.dayTabs}>
          {fechas.map((f, i) => (
            <button
              key={f}
              type="button"
              className={`${i === dia ? styles.dayTabOn : ''} ${motivoColumna(f) ? styles.dayTabOff : ''}`}
              onClick={() => elegirDia(i)}
            >
              {DIAS_CORTOS[i]}<b>{Number(f.slice(8))}</b>
            </button>
          ))}
        </div>
        <div
          className={styles.dayList}
          onTouchStart={e => { toqueX.current = e.touches[0].clientX }}
          onTouchEnd={e => onTouchEnd(e.changedTouches[0].clientX)}
        >
          {offMovil ? (
            <div className={styles.dayOff}><FaCalendarAlt size={26} color="#94a3b8" style={{ margin: '0 auto' }} /><strong>Sin clase</strong>{offMovil}</div>
          ) : (
            filas.map((f, i) => {
              if (f.isBreak) {
                return (
                  <div key={i} className={styles.dayRow}>
                    <div className={styles.dayRowTime}><b>{formatoHora(f.start)}</b></div>
                    <div className={styles.dayRowBreak}>Descanso</div>
                  </div>
                )
              }
              const b = bloquesMovil.find(x => x.fila === i)
              if (!b?.clase) return null
              return (
                <div key={i} className={styles.dayRow}>
                  <div className={styles.dayRowTime}><b>{formatoHora(b.start)}</b>{formatoHora(b.end)}</div>
                  {renderClase(b, fechaMovil)}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className={styles.legend}>
        {rol === 'student' ? (
          <>
            <span><i className={`${styles.dot} ${styles.dotPublished}`} />Planeación disponible</span>
            <span><i className={styles.hatch} />Día sin clase</span>
            <span>Toca una clase para ver lo que se trabajará ese día.</span>
          </>
        ) : (
          <>
            <span><i className={`${styles.dot} ${styles.dotPublished}`} />Publicada</span>
            <span><i className={`${styles.dot} ${styles.dotDraft}`} />Borrador (en revisión)</span>
            <span><i className={`${styles.dot} ${styles.dotNone}`} />Sin planeación</span>
            <span><i className={styles.hatch} />Día sin clase</span>
          </>
        )}
      </div>

      {seleccion && (
        <DetalleClase
          seleccion={seleccion}
          plan={seleccion.clase.subjectId ? planes.get(clavePlaneacion(seleccion.clase.gradeId, seleccion.clase.subjectId, seleccion.fecha)) : undefined}
          rol={rol}
          userId={userId}
          semana={datos.weekStart}
          onPlanActualizado={onPlanActualizado}
          onCerrar={() => setSeleccion(null)}
        />
      )}
    </div>
  )
}

function DetalleClase({ seleccion, plan: planOriginal, rol, userId, semana, onPlanActualizado, onCerrar }: {
  seleccion: Seleccion
  plan: Planeacion | undefined
  rol: Rol
  userId?: string
  semana: string
  onPlanActualizado?: () => void
  onCerrar: () => void
}) {
  const { clase, fecha, start, end } = seleccion
  // Cambios hechos por la rectora en esta ventana, mientras se recarga el horario
  const [cambios, setCambios] = useState<PlanRevisable | null>(null)
  const plan = planOriginal && cambios ? { ...planOriginal, ...cambios } : planOriginal
  const estado = plan?.status ?? 'none'
  const visible = plan && (rol !== 'student' || plan.status === 'published')
  const esSuyo = rol === 'teacher' && clase.teacherId === userId

  if (rol === 'admin' && plan) {
    return (
      <div className={styles.backdrop} onClick={onCerrar}>
        <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Planeación de ${clase.subjectName}`} onClick={e => e.stopPropagation()}>
          <EncabezadoClase clase={clase} fecha={fecha} start={start} end={end} onCerrar={onCerrar} />
          <div className={styles.modalBody}>
            <div className={styles.modalFoot}>
              <span className={styles.label}>Logros de la clase</span>
              <span className={`${styles.pill} ${CLASE_PILL[estado]}`}>{ESTADO_PLANEACION[estado]}</span>
            </div>
            <AccionesPlaneacion plan={plan} onCambio={p => { setCambios(p); onPlanActualizado?.() }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.backdrop} onClick={onCerrar}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Planeación de ${clase.subjectName}`} onClick={e => e.stopPropagation()}>
        <EncabezadoClase clase={clase} fecha={fecha} start={start} end={end} onCerrar={onCerrar} />

        <div className={styles.modalBody}>
          {visible ? (
            <>
              <span className={styles.label}>Logros de la clase</span>
              <p className={styles.logros}>{plan.content}</p>
            </>
          ) : (
            <div className={styles.empty}>
              {rol === 'student' || (rol === 'teacher' && !esSuyo)
                ? 'La planeación de esta clase todavía no está publicada.'
                : `${clase.teacherName ?? 'El docente'} aún no ha subido la planeación de esta clase.`}
            </div>
          )}

          {esSuyo && plan?.reviewNote && (
            <div className={styles.noteBox}><strong>Observación de rectoría</strong>{plan.reviewNote}</div>
          )}

          {rol !== 'student' && (
            <div className={styles.modalFoot}>
              <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`${styles.pill} ${CLASE_PILL[estado]}`}>{ESTADO_PLANEACION[estado]}</span>
                {esSuyo && plan?.adminEdited && <span className={`${styles.pill} ${styles.pillEdited}`}>Editada por rectoría</span>}
              </span>
              {esSuyo && (
                <Link href={`/plataformas/profesores/planeacion?semana=${semana}`} className={`${styles.btn} ${styles.btnGreen}`}>
                  Ir a mi planeación
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EncabezadoClase({ clase, fecha, start, end, onCerrar }: { clase: ClaseHorario, fecha: string, start: string, end: string, onCerrar: () => void }) {
  return (
    <div className={styles.modalHead} style={estiloMateria(clase.subjectName)}>
      <div>
        <h3>{clase.subjectName}</h3>
        <p>
          {clase.gradeName}{clase.teacherName ? ` · ${clase.teacherName}` : ''}<br />
          {formatoLargo(fecha)} · {rangoHoras(start, end)}
        </p>
      </div>
      <button type="button" className={styles.modalClose} onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
    </div>
  )
}
