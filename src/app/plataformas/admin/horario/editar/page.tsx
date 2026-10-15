'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FaArrowLeft, FaExclamationTriangle, FaPlus, FaSave, FaSpinner, FaTrash, FaUndo } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import { estiloMateria } from 'app/components/horario/HorarioSemanal'
import { obtenerContextoHorario } from 'app/utils/horario/actions'
import { type Franja, type Seccion, DIAS, NOMBRE_SECCION, formatoHora, rangoHoras, seSolapan } from 'app/utils/horario/comun'
import {
  obtenerEditorHorario, guardarHorarioCurso, guardarFranjas, obtenerTurnosPuerta, guardarTurnosPuerta,
  type CasillaEditor, type FranjaEditable, type MateriaEditor, type Ocupacion,
} from '../actions'

type Turno = { dayOfWeek: number, shift: 'morning' | 'afternoon', teacherId: string | null, start: string, end: string }
const NOMBRE_TURNO = { morning: 'entrada', afternoon: 'salida' }

const DIRECCION_DE_GRUPO = 'Dirección de grupo'
const OTRA = '__otra'

type Valor = { subjectId: string | null, label: string | null }
type Editor = { curso: { id: number, name: string, section: Seccion }, franjas: Franja[], materias: MateriaEditor[], ocupaciones: Ocupacion[] }

const clave = (dia: number, slotId: number) => `${dia}|${slotId}`
const aValorSelect = (v?: Valor) => (!v ? '' : v.subjectId ? `m:${v.subjectId}` : v.label ? `l:${v.label}` : '')
const serializar = (m: Map<string, Valor>) => JSON.stringify([...m.entries()].sort())

function sumarHora(t: string) {
  const [hh, mm] = t.split(':').map(Number)
  return `${String(Math.min(hh + 1, 23)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function EditorHorario() {
  const searchParams = useSearchParams()
  const [cursos, setCursos] = useState<{ id: number, name: string }[]>([])
  const [cursoId, setCursoId] = useState<number | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [casillas, setCasillas] = useState<Map<string, Valor>>(new Map())
  const [original, setOriginal] = useState('')
  const [franjas, setFranjas] = useState<FranjaEditable[]>([])
  const [franjasOriginal, setFranjasOriginal] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [docentes, setDocentes] = useState<{ id: string, name: string }[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [turnosOriginal, setTurnosOriginal] = useState('')

  useEffect(() => {
    obtenerTurnosPuerta().then(r => {
      if (!r.exito || !r.turnos) return
      const lista = r.turnos.map(t => ({ dayOfWeek: t.dayOfWeek, shift: t.shift, teacherId: t.teacherId, start: t.start, end: t.end }))
      setTurnos(lista)
      setTurnosOriginal(JSON.stringify(lista))
    })
  }, [])

  useEffect(() => {
    obtenerContextoHorario().then(r => {
      if (!r.contexto) { setError(r.error ?? 'No se pudo cargar la información.'); setCargando(false); return }
      setCursos(r.contexto.cursos)
      setDocentes(r.contexto.docentes)
      const pedido = Number(searchParams.get('curso'))
      setCursoId(r.contexto.cursos.some(c => c.id === pedido) ? pedido : r.contexto.cursos[0]?.id ?? null)
      if (!r.contexto.cursos.length) setCargando(false)
    })
  }, [searchParams])

  const cargarEditor = useCallback(async (id: number) => {
    setCargando(true)
    setError(null)
    const r = await obtenerEditorHorario(id)
    if (!r.exito || !r.curso) {
      setError(r.error ?? 'No se pudo cargar el horario.')
      setCargando(false)
      return
    }
    const mapa = new Map<string, Valor>()
    for (const c of r.casillas as CasillaEditor[]) mapa.set(clave(c.dayOfWeek, c.slotId), { subjectId: c.subjectId, label: c.label })
    const editables = r.franjas!.map(f => ({ id: f.id, start: f.start, end: f.end, isBreak: f.isBreak }))
    setEditor({ curso: r.curso, franjas: r.franjas!, materias: r.materias!, ocupaciones: r.ocupaciones! })
    setCasillas(mapa)
    setOriginal(serializar(mapa))
    setFranjas(editables)
    setFranjasOriginal(JSON.stringify(editables))
    setCargando(false)
  }, [])

  useEffect(() => { if (cursoId) cargarEditor(cursoId) }, [cursoId, cargarEditor])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3500)
    return () => clearTimeout(t)
  }, [mensaje])

  const cambiosHorario = serializar(casillas) !== original
  const cambiosFranjas = JSON.stringify(franjas) !== franjasOriginal

  const materiasPorId = useMemo(() => new Map((editor?.materias || []).map(m => [m.id, m])), [editor])

  const choques = useMemo(() => {
    if (!editor) return []
    const lista: { dia: number, franja: Franja, materia: MateriaEditor, con: Ocupacion }[] = []
    for (const [k, v] of casillas) {
      if (!v.subjectId) continue
      const [dia, slotId] = k.split('|').map(Number)
      const franja = editor.franjas.find(f => f.id === slotId)
      const materia = materiasPorId.get(v.subjectId)
      if (!franja || !materia?.teacherId) continue
      const con = editor.ocupaciones.find(o => o.teacherId === materia.teacherId && o.dayOfWeek === dia && seSolapan(o.start, o.end, franja.start, franja.end))
      if (con) lista.push({ dia, franja, materia, con })
    }
    return lista.sort((a, b) => a.dia - b.dia || a.franja.start.localeCompare(b.franja.start))
  }, [casillas, editor, materiasPorId])

  const cambiarCurso = (id: number) => {
    if ((cambiosHorario || cambiosFranjas) && !confirm('Tienes cambios sin guardar. ¿Quieres descartarlos y cambiar de curso?')) return
    setCursoId(id)
  }

  const cambiarCasilla = (dia: number, slotId: number, valor: string) => {
    const siguiente = new Map(casillas)
    const k = clave(dia, slotId)
    if (valor === OTRA) {
      const texto = prompt('Nombre de la actividad (por ejemplo, «Formación» o «Proyecto de aula»):')?.trim()
      if (!texto) return
      siguiente.set(k, { subjectId: null, label: texto })
    } else if (valor.startsWith('m:')) {
      siguiente.set(k, { subjectId: valor.slice(2), label: null })
    } else if (valor.startsWith('l:')) {
      siguiente.set(k, { subjectId: null, label: valor.slice(2) })
    } else {
      siguiente.delete(k)
    }
    setCasillas(siguiente)
  }

  const guardarHorario = async () => {
    if (!editor) return
    if (choques.length && !confirm(`Hay ${choques.length} choque(s) de horario. ¿Quieres guardar de todas formas?`)) return
    setGuardando(true)
    const lista: CasillaEditor[] = [...casillas.entries()].map(([k, v]) => {
      const [dayOfWeek, slotId] = k.split('|').map(Number)
      return { dayOfWeek, slotId, subjectId: v.subjectId, label: v.label }
    })
    const r = await guardarHorarioCurso(editor.curso.id, lista)
    setGuardando(false)
    if (!r.exito) { alert('Error: ' + r.error); return }
    setOriginal(serializar(casillas))
    setMensaje(`Horario de ${editor.curso.name} guardado.`)
  }

  const guardarLasFranjas = async () => {
    if (!editor) return
    const idsActuales = new Set(franjas.filter(f => f.id).map(f => f.id))
    const eliminadas = editor.franjas.filter(f => !idsActuales.has(f.id)).length
    const nuevosDescansos = franjas.filter(f => f.id && f.isBreak && !editor.franjas.find(o => o.id === f.id)?.isBreak).length
    if ((eliminadas || nuevosDescansos) && !confirm(
      `Las clases que estaban en las franjas eliminadas o convertidas en descanso se borrarán en todos los cursos de ${NOMBRE_SECCION[editor.curso.section]}. ¿Continuar?`
    )) return
    setGuardando(true)
    const r = await guardarFranjas(editor.curso.section, franjas)
    setGuardando(false)
    if (!r.exito) { alert('Error: ' + r.error); return }
    setMensaje('Franjas horarias guardadas.')
    await cargarEditor(editor.curso.id)
  }

  const cambiarFranja = (i: number, cambios: Partial<FranjaEditable>) =>
    setFranjas(franjas.map((f, j) => (j === i ? { ...f, ...cambios } : f)))

  const agregarFranja = () => {
    const ultima = franjas[franjas.length - 1]
    const inicio = ultima ? ultima.end : '07:00'
    setFranjas([...franjas, { start: inicio, end: sumarHora(inicio), isBreak: false }])
  }

  if (!editor && cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const opciones = (v?: Valor) => {
    const etiquetas = [DIRECCION_DE_GRUPO, ...(v?.label && v.label !== DIRECCION_DE_GRUPO ? [v.label] : [])]
    return (
      <>
        <option value="">— Libre —</option>
        <optgroup label="Materias">
          {editor!.materias.map(m => <option key={m.id} value={`m:${m.id}`}>{m.name}</option>)}
        </optgroup>
        <optgroup label="Otras actividades">
          {etiquetas.map(l => <option key={l} value={`l:${l}`}>{l}</option>)}
          <option value={OTRA}>Otra actividad…</option>
        </optgroup>
      </>
    )
  }

  const franjasGuardadas = editor?.franjas ?? []
  const esChoque = (dia: number, slotId: number) => choques.some(c => c.dia === dia && c.franja.id === slotId)

  const cambiarTurno = (turno: Turno, cambios: Partial<Turno>) =>
    setTurnos(turnos.map(t => (t.dayOfWeek === turno.dayOfWeek && t.shift === turno.shift ? { ...t, ...cambios } : t)))

  const guardarTurnos = async () => {
    setGuardando(true)
    const r = await guardarTurnosPuerta(turnos)
    setGuardando(false)
    if (!r.exito) { alert(r.error); return }
    setTurnosOriginal(JSON.stringify(turnos))
    setMensaje('Turnos de puerta guardados.')
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <Link href="/plataformas/admin/horario" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <FaArrowLeft size={11} /> Volver al horario
          </Link>
          <h1>Editar horario</h1>
          <p>Asigna una materia a cada franja. El horario se repite todas las semanas.</p>
        </div>
        <div className={h.toolbar} style={{ marginBottom: 0 }}>
          <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={!cambiosHorario || guardando} onClick={() => setCasillas(new Map(JSON.parse(original)))}>
            <FaUndo size={12} /> Descartar cambios
          </button>
          <button type="button" className={`${h.btn} ${h.btnGreen}`} disabled={!cambiosHorario || guardando} onClick={guardarHorario}>
            {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar horario
          </button>
        </div>
      </header>

      {mensaje && <div className={h.toast} role="status">{mensaje}</div>}
      {error && <div className={h.errorBox}>{error}</div>}

      <div className={h.toolbar}>
        <label className={h.field}>
          Curso
          <select className={h.select} value={cursoId ?? ''} onChange={e => cambiarCurso(Number(e.target.value))}>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {editor && <span className={`${h.pill} ${h.pillNone}`} style={{ marginBottom: '8px' }}>Usa las franjas de {NOMBRE_SECCION[editor.curso.section]}</span>}
        {cargando && <FaSpinner className="fa-spin" color="#3b82f6" style={{ marginBottom: '10px' }} />}
      </div>

      {editor && (
        <div className={h.editLayout}>
          <div className={h.editMain}>
            {choques.map(c => (
              <div key={`${c.dia}-${c.franja.id}`} className={h.errorBox} style={{ marginBottom: 0 }}>
                <strong><FaExclamationTriangle /> Choque de horario: {c.materia.teacherName}</strong>
                {DIAS[c.dia - 1]} de {rangoHoras(c.franja.start, c.franja.end)} ya tiene {c.con.subjectName} con {c.con.gradeName}.
                Cambia la materia o mueve la clase del otro curso.
              </div>
            ))}

            {franjasGuardadas.length === 0 ? (
              <div className={h.empty}>No hay franjas horarias para {NOMBRE_SECCION[editor.curso.section]}. Agrégalas en el panel «Franjas horarias».</div>
            ) : editor.materias.length === 0 ? (
              <div className={h.empty}>Este curso no tiene materias. Agrégalas primero en la Malla Curricular.</div>
            ) : (
              <div className={h.gridWrap}>
                <div className={h.grid}>
                  <div className={h.dayHead} style={{ gridRow: 1, gridColumn: 1 }} />
                  {DIAS.map((d, i) => <div key={d} className={h.dayHead} style={{ gridRow: 1, gridColumn: i + 2 }}><strong>{d}</strong></div>)}
                  {franjasGuardadas.map((f, fi) => (
                    f.isBreak ? (
                      <div key={f.id} style={{ display: 'contents' }}>
                        <div className={`${h.time} ${h.timeBreak}`} style={{ gridRow: fi + 2, gridColumn: 1 }}><b>Descanso</b>{rangoHoras(f.start, f.end)}</div>
                        <div className={h.breakCell} style={{ gridRow: fi + 2, gridColumn: '2 / -1' }}>Descanso</div>
                      </div>
                    ) : (
                      <div key={f.id} style={{ display: 'contents' }}>
                        <div className={h.time} style={{ gridRow: fi + 2, gridColumn: 1 }}><b>{formatoHora(f.start)}</b>{formatoHora(f.end)}</div>
                        {[1, 2, 3, 4, 5].map(dia => {
                          const v = casillas.get(clave(dia, f.id))
                          const materia = v?.subjectId ? materiasPorId.get(v.subjectId) : null
                          return (
                            <div
                              key={dia}
                              className={`${h.cell} ${h.editCell} ${esChoque(dia, f.id) ? h.editConflict : ''}`}
                              style={{ gridRow: fi + 2, gridColumn: dia + 1, ...(v ? estiloMateria(materia?.name ?? null) : {}) }}
                            >
                              <select value={aValorSelect(v)} onChange={e => cambiarCasilla(dia, f.id, e.target.value)} aria-label={`${DIAS[dia - 1]} ${f.start}`}>
                                {opciones(v)}
                              </select>
                              {materia && <span className={h.editTeacher}>{materia.teacherName ?? 'Sin docente asignado'}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className={h.panel}>
            <h3>Franjas horarias</h3>
            <p>Horas de {NOMBRE_SECCION[editor.curso.section]}. Los cambios aplican a todos los cursos de esta sección.</p>
            <div className={h.slotList}>
              {franjas.map((f, i) => (
                <div key={f.id ?? `n${i}`} className={h.slotRow}>
                  <input type="time" value={f.start} onChange={e => cambiarFranja(i, { start: e.target.value })} aria-label="Inicio" />
                  <input type="time" value={f.end} onChange={e => cambiarFranja(i, { end: e.target.value })} aria-label="Fin" />
                  <label title="Marcar como descanso">
                    <input type="checkbox" checked={f.isBreak} onChange={e => cambiarFranja(i, { isBreak: e.target.checked })} /> Descanso
                  </label>
                  <button type="button" className={h.iconBtn} onClick={() => setFranjas(franjas.filter((_, j) => j !== i))} aria-label="Eliminar franja"><FaTrash size={11} /></button>
                </div>
              ))}
            </div>
            <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={agregarFranja}><FaPlus size={10} /> Agregar franja</button>
            {cambiosHorario && cambiosFranjas && <p style={{ color: '#b45309' }}>Guarda o descarta primero los cambios del horario.</p>}
            <button type="button" className={`${h.btn} ${h.btnDark} ${h.btnSm}`} disabled={!cambiosFranjas || cambiosHorario || guardando} onClick={guardarLasFranjas}>
              Guardar franjas
            </button>

            {editor.curso.section === 'preescolar' && turnos.length > 0 && (
              <>
                <h3 style={{ marginTop: '18px' }}>Turno de puerta</h3>
                <p>El profesor que recibe a los niños (entrada) y el que los entrega (salida) cada día. Le aparece «Puerta» en su horario; a los estudiantes no.</p>
                <div className={h.slotList}>
                  {turnos.map(t => (
                    <div key={`${t.dayOfWeek}-${t.shift}`} className={h.field}>
                      {DIAS[t.dayOfWeek - 1]} · {NOMBRE_TURNO[t.shift]}
                      <select className={h.select} value={t.teacherId ?? ''} onChange={e => cambiarTurno(t, { teacherId: e.target.value || null })}>
                        <option value="">— Sin asignar —</option>
                        {docentes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <div className={h.slotRow}>
                        <input type="time" value={t.start} onChange={e => cambiarTurno(t, { start: e.target.value })} aria-label={`Inicio del turno de ${NOMBRE_TURNO[t.shift]} del ${DIAS[t.dayOfWeek - 1]}`} />
                        <input type="time" value={t.end} onChange={e => cambiarTurno(t, { end: e.target.value })} aria-label={`Fin del turno de ${NOMBRE_TURNO[t.shift]} del ${DIAS[t.dayOfWeek - 1]}`} />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className={`${h.btn} ${h.btnDark} ${h.btnSm}`} disabled={JSON.stringify(turnos) === turnosOriginal || guardando} onClick={guardarTurnos}>
                  Guardar turnos
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

export default function EditarHorarioPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>}>
      <EditorHorario />
    </Suspense>
  )
}
