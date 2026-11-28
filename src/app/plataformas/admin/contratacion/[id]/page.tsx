'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FaArrowLeft, FaPlus, FaSave, FaSpinner, FaTrash, FaUserCheck } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import FichaDocente from 'app/components/contratacion/FichaDocente'
import { ESTADO_POSTULACION, type ClasePlaneada, type FichaDocente as Ficha } from 'app/utils/contratacion/comun'
import { DOMINIO_USUARIOS, limpiarUsuario, nombreCompleto } from 'app/utils/inscripciones/comun'
import { obtenerPostulacion, guardarPostulacion, contratar, cambiarEstado, type DetallePostulacion } from '../actions'

export default function DetalleContratacionPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<DetallePostulacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ficha, setFicha] = useState<Ficha>({})
  const [clases, setClases] = useState<ClasePlaneada[]>([])
  const [direccion, setDireccion] = useState<number[]>([])
  const [usuario, setUsuario] = useState('')
  const [notas, setNotas] = useState('')
  const [nuevaClase, setNuevaClase] = useState<{ gradeId: number | null, materia: string }>({ gradeId: null, materia: '' })
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ usuario: string, avisos: string[] } | null>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerPostulacion(Number(id))
    if (!r.exito || !r.detalle) { setError(r.error ?? 'No se pudo cargar.'); return }
    setD(r.detalle)
    setFicha(r.detalle.ficha)
    setClases(r.detalle.clases)
    setDireccion(r.detalle.direccion)
    setUsuario(r.detalle.usuarioSugerido)
    setNotas(r.detalle.adminNotes ?? '')
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!d) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const pendiente = d.status === 'pending'
  const cursoDe = (gradeId: number) => d.cursos.find(x => x.id === gradeId)
  const datos = () => ({ ficha, clases, direccion, username: usuario, notas })

  const agregarClase = () => {
    if (!nuevaClase.gradeId || !nuevaClase.materia) return
    if (clases.some(x => x.gradeId === nuevaClase.gradeId && x.subjectName === nuevaClase.materia)) return
    setClases([...clases, { gradeId: nuevaClase.gradeId, subjectName: nuevaClase.materia }])
    setNuevaClase({ gradeId: nuevaClase.gradeId, materia: '' })
  }

  const guardar = async () => {
    setOcupado('guardar')
    const r = await guardarPostulacion(d.id, datos())
    setOcupado(null)
    if (!r.exito) { alert(r.error); return }
    setAviso('Cambios guardados.')
  }

  const hacerContratacion = async () => {
    const nombre = nombreCompleto(ficha)
    if (!confirm(`¿Contratar a ${nombre}? Se creará su cuenta de docente con el usuario «${limpiarUsuario(usuario)}», se le asignarán ${clases.length} clase(s)${direccion.length ? ` y quedará como director(a) de ${direccion.length} curso(s)` : ''}.`)) return
    setOcupado('contratar')
    const r = await contratar(d.id, datos())
    setOcupado(null)
    if (!r.exito) { alert(r.error); return }
    setResultado({ usuario: r.usuario!, avisos: r.avisos ?? [] })
    await cargar()
  }

  const estado = async (s: 'pending' | 'discarded') => {
    if (s === 'discarded' && !confirm('¿Descartar este registro? No se crea ninguna cuenta. Lo puedes volver a abrir después.')) return
    setOcupado('estado')
    const r = await cambiarEstado(d.id, s)
    setOcupado(null)
    if (!r.exito) { alert(r.error); return }
    await cargar()
  }

  const nuevoCurso = nuevaClase.gradeId ? cursoDe(nuevaClase.gradeId) : null

  return (
    <main className={styles.mainContent}>
      <Link href="/plataformas/admin/contratacion" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <FaArrowLeft size={11} /> Contratación
      </Link>
      <header className={styles.header} style={{ marginBottom: '20px' }}>
        <div>
          <h1>{nombreCompleto(ficha) || 'Docente'}</h1>
          <p>{ficha.profession} · Recibido el {new Date(d.createdAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
        </div>
        <span className={`${h.pill} ${d.status === 'hired' ? h.pillPublished : d.status === 'pending' ? c.pillReview : h.pillNone}`}>{ESTADO_POSTULACION[d.status]}</span>
      </header>

      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      {resultado && (
        <div className={c.okBox} style={{ marginBottom: '16px' }}>
          <b>Contratado.</b> Ya aparece en Docentes. Usuario: <b>{resultado.usuario}{DOMINIO_USUARIOS}</b> · Contraseña: su número de documento (sin puntos).
          {resultado.avisos.length > 0 && <><br />Revisa en Docentes o Cursos: {resultado.avisos.join(' · ')}</>}
        </div>
      )}

      <div className={c.detail}>
        <div className={c.stack} style={{ minWidth: 0 }}>
          {pendiente && <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>Revisa y corrige los datos si hace falta. Los cambios se guardan con «Guardar» o al contratar.</p>}
          <FichaDocente ficha={ficha} onFicha={setFicha} soloLectura={!pendiente} />
        </div>

        <div className={c.stack}>
          <section className={c.panel}>
            <h3>Clases que dictará</h3>
            {clases.length === 0 ? <p>Aún no tiene clases asignadas.</p> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {clases.map((x, i) => {
                  const otro = d.ocupadas[`${x.gradeId}|${x.subjectName}`]
                  return (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', fontSize: '0.86rem' }}>
                      <span style={{ flex: 1 }}><b>{x.subjectName}</b> · {cursoDe(x.gradeId)?.nombre ?? 'Curso'}
                        {otro && pendiente && <><br /><small style={{ color: '#b45309' }}>Hoy la tiene {otro}: pasará a este docente.</small></>}
                      </span>
                      {pendiente && <button type="button" className={h.iconBtn} aria-label="Quitar" onClick={() => setClases(clases.filter((_, j) => j !== i))}><FaTrash size={11} /></button>}
                    </li>
                  )
                })}
              </ul>
            )}
            {pendiente && (
              <>
                <label className={h.field}>Curso
                  <select className={h.select} value={nuevaClase.gradeId ?? ''} onChange={e => setNuevaClase({ gradeId: e.target.value ? Number(e.target.value) : null, materia: '' })}>
                    <option value="">— Selecciona —</option>
                    {d.cursos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                </label>
                <label className={h.field}>Materia
                  <select className={h.select} value={nuevaClase.materia} disabled={!nuevoCurso} onChange={e => setNuevaClase({ ...nuevaClase, materia: e.target.value })}>
                    <option value="">{nuevoCurso && !nuevoCurso.materias.length ? 'Este curso no tiene materias' : '— Selecciona —'}</option>
                    {(nuevoCurso?.materias ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} style={{ alignSelf: 'flex-start' }} disabled={!nuevaClase.gradeId || !nuevaClase.materia} onClick={agregarClase}>
                  <FaPlus size={10} /> Agregar clase
                </button>
              </>
            )}
          </section>

          <section className={c.panel}>
            <h3>Director de grupo</h3>
            <p>Marca los cursos de los que será director(a). Si el curso ya tiene director, lo reemplaza.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflow: 'auto' }}>
              {d.cursos.map(x => (
                <label key={x.id} className={c.check}>
                  <input type="checkbox" disabled={!pendiente} checked={direccion.includes(x.id)}
                    onChange={e => setDireccion(e.target.checked ? [...direccion, x.id] : direccion.filter(g => g !== x.id))} />
                  {x.nombre}
                  {x.directorNombre && x.directorId !== d.hiredProfileId && <small style={{ color: '#64748b' }}>· hoy: {x.directorNombre}</small>}
                </label>
              ))}
            </div>
          </section>

          <section className={c.panel}>
            <h3>Cuenta en la plataforma</h3>
            <label className={h.field}>Usuario
              <input className={h.input} value={usuario} readOnly={!pendiente} onChange={e => setUsuario(limpiarUsuario(e.target.value))} />
              <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>Entrará con {limpiarUsuario(usuario) || '…'}{DOMINIO_USUARIOS}. La contraseña es su número de documento, sin puntos.</small>
            </label>
            <label className={h.field}>Notas internas (no las ve el docente)
              <textarea className={h.input} rows={3} value={notas} readOnly={!pendiente} onChange={e => setNotas(e.target.value)} />
            </label>

            {pendiente ? (
              <>
                <button type="button" className={`${h.btn} ${h.btnBlue}`} disabled={ocupado !== null} onClick={hacerContratacion}>
                  {ocupado === 'contratar' ? <FaSpinner className="fa-spin" /> : <FaUserCheck />} Contratar
                </button>
                <div className={h.toolbar} style={{ marginBottom: 0 }}>
                  <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} disabled={ocupado !== null} onClick={guardar}>
                    {ocupado === 'guardar' ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar
                  </button>
                  <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} disabled={ocupado !== null} onClick={() => estado('discarded')}>Descartar</button>
                </div>
              </>
            ) : d.status === 'discarded' ? (
              <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={ocupado !== null} onClick={() => estado('pending')}>Volver a abrir</button>
            ) : (
              <span className={c.hint}>Contratado el {d.hiredAt ? new Date(d.hiredAt).toLocaleDateString('es-CO', { dateStyle: 'long' }) : ''}. Sus clases y datos se manejan ahora en Docentes.</span>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
