'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FaArrowLeft, FaCheckCircle, FaSave, FaSearch, FaSpinner, FaUserCheck } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import i from 'app/styles/pages/Inscripciones.module.scss'
import FichaInscripcion from 'app/components/inscripciones/FichaInscripcion'
import EstadoInscripcionPill from 'app/components/inscripciones/EstadoInscripcionPill'
import { DOMINIO_USUARIOS, TIPOS_DOCUMENTO, nombreCompleto, usuarioSugerido, limpiarUsuario, type EstadoInscripcion } from 'app/utils/inscripciones/comun'
import {
  obtenerInscripcion, guardarInscripcion, cambiarEstadoInscripcion, verificarUsuario, inscribirEstudiante,
  type DetalleInscripcion, type CambiosInscripcion,
} from '../actions'

const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export default function DetalleInscripcionPage() {
  const { id } = useParams<{ id: string }>()
  const idNum = Number(id)
  const [detalle, setDetalle] = useState<DetalleInscripcion | null>(null)
  const [form, setForm] = useState<CambiosInscripcion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [revision, setRevision] = useState<{ usuario: string, disponible: boolean, sugerencia: string | null } | null>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerInscripcion(idNum)
    if (!r.exito) { setError(r.error ?? 'No se pudo cargar la solicitud.'); return }
    const d = r.detalle!
    setDetalle(d)
    setForm({ ficha: d.ficha, schoolYear: d.schoolYear, gradeId: d.gradeId, docType: d.docType, docNumber: d.docNumber, adminNotes: d.adminNotes, username: d.username })
    setRevision(null)
  }, [idNum])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  if (error && !detalle) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!detalle || !form) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  const abierta = detalle.status === 'new' || detalle.status === 'in_process'
  const inscrita = detalle.status === 'enrolled'
  const curso = detalle.cursos.find(x => x.id === form.gradeId)
  const anioFuturo = form.schoolYear > detalle.anioActivo
  const anios = [...new Set([detalle.anioActivo, detalle.anioActivo + 1, detalle.schoolYear])].sort()

  const guardar = async (silencioso = false) => {
    setError(null)
    setOcupado('guardar')
    const r = await guardarInscripcion(idNum, form)
    setOcupado(null)
    if (!r.exito) { setError(r.error ?? 'No se pudo guardar.'); return false }
    if (!silencioso) setMensaje('Cambios guardados.')
    return true
  }

  const cambiarEstado = async (estado: EstadoInscripcion) => {
    setError(null)
    setOcupado(estado)
    const r = await cambiarEstadoInscripcion(idNum, estado)
    setOcupado(null)
    if (!r.exito) { setError(r.error ?? 'No se pudo cambiar el estado.'); return }
    setDetalle({ ...detalle, status: estado })
  }

  const revisarUsuario = async () => {
    setError(null)
    setOcupado('revisar')
    const r = await verificarUsuario(idNum, form.username)
    setOcupado(null)
    if (!r.exito) { setError(r.error ?? 'No se pudo revisar el usuario.'); return null }
    const res = { usuario: limpiarUsuario(form.username), disponible: !!r.disponible, sugerencia: r.sugerencia ?? null }
    setRevision(res)
    return res
  }

  const inscribir = async () => {
    if (!curso) { setError('Asigna el curso antes de inscribir.'); return }
    if (!(await guardar(true))) return
    const res = await revisarUsuario()
    if (!res) return
    if (!res.disponible) { setError(`El usuario «${res.usuario}» ya existe. Cámbialo para que sea único${res.sugerencia ? ` (por ejemplo, «${res.sugerencia}»)` : ''}.`); return }
    if (!confirm(`¿Inscribir a ${nombreCompleto(form.ficha)} en ${curso.name}?\n\nSe creará el usuario «${res.usuario}» y la contraseña será el número de documento.`)) return

    setOcupado('inscribir')
    const r = await inscribirEstudiante(idNum, res.usuario)
    setOcupado(null)
    if (!r.exito) {
      setError(r.error ?? 'No se pudo inscribir.')
      if (r.usuarioOcupado) setRevision({ usuario: res.usuario, disponible: false, sugerencia: null })
      return
    }
    await cargar()
    setMensaje(`${nombreCompleto(form.ficha)} quedó inscrito(a) con el usuario «${r.usuario}».`)
  }

  const cambiarFicha = (ficha: CambiosInscripcion['ficha']) => {
    // Mientras la rectora no haya cambiado el usuario a mano, sigue la regla con los nombres nuevos
    const seguia = form.username === usuarioSugerido(form.ficha)
    setForm({ ...form, ficha, username: seguia ? usuarioSugerido(ficha) : form.username })
    if (seguia) setRevision(null)
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link href="/plataformas/admin/inscripciones" style={{ color: '#64748b', fontSize: '1.2rem' }} aria-label="Volver"><FaArrowLeft /></Link>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {nombreCompleto(detalle.ficha) || 'Sin nombre'} <EstadoInscripcionPill estado={detalle.status} />
          </h1>
          <p>{detalle.code} · Recibida el {fecha(detalle.createdAt)}</p>
        </div>
      </header>

      {mensaje && <div className={h.toast} role="status">{mensaje}</div>}

      <div className={c.stack} style={{ maxWidth: '900px' }}>
        {detalle.completadaPorOtro && (
          <div className={c.noteBox}><strong>Completada por otro acudiente</strong>Otra persona agregó datos el {fecha(detalle.familyUpdatedAt)}.</div>
        )}
        {detalle.perfilExistente && !inscrita && (
          <div className={h.errorBox} style={{ marginBottom: 0 }}>Ya existe un usuario con este documento en la plataforma: <b>{detalle.perfilExistente}</b>. Revísalo en Estudiantes antes de inscribir.</div>
        )}
        {inscrita && (
          <div className={c.okBox}>
            <FaCheckCircle /> Inscrito(a){detalle.enrolledAt ? ` el ${fecha(detalle.enrolledAt)}` : ''} con el usuario <b>{detalle.username}</b>. La contraseña inicial es el número de documento.{' '}
            <Link href="/plataformas/admin/estudiantes">Ver en Estudiantes</Link>
          </div>
        )}

        <fieldset disabled={inscrita} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <section className={c.panel}>
            <h3>Inscripción</h3>
            <div className={c.formGrid}>
              <label className={h.field}>Año
                <select className={h.select} value={form.schoolYear} onChange={e => setForm({ ...form, schoolYear: Number(e.target.value) })}>
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className={h.field}>Curso
                <select className={h.select} value={form.gradeId ?? ''} onChange={e => setForm({ ...form, gradeId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— Sin curso —</option>
                  {detalle.cursos.map(g => <option key={g.id} value={g.id}>{g.officialGrade ? `${g.officialGrade} (${g.name})` : g.name}</option>)}
                </select>
              </label>
              <label className={h.field}>Tipo de documento
                <select className={h.select} value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value })}>
                  {TIPOS_DOCUMENTO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </label>
              <label className={h.field}>Número de documento
                <input className={h.input} value={form.docNumber} onChange={e => setForm({ ...form, docNumber: e.target.value })} />
              </label>
            </div>
          </section>

          <FichaInscripcion ficha={form.ficha} onCambiar={cambiarFicha} />

          <section className={c.panel}>
            <h3>Notas de rectoría</h3>
            <p>Solo las ve la rectora: pago de la inscripción, fecha de la entrevista, adaptación…</p>
            <textarea className={h.input} rows={4} maxLength={2000} value={form.adminNotes} onChange={e => setForm({ ...form, adminNotes: e.target.value })} style={{ resize: 'vertical' }} />
          </section>

          {abierta && (
            <section className={c.panel}>
              <h3>Inscribir</h3>
              <p>
                Al inscribir se crea la cuenta del estudiante en {curso ? <b>{curso.name}</b> : 'el curso asignado'}, con los datos de esta ficha.
                El usuario sigue la regla del colegio; si ya existe, cámbialo para que sea único. La contraseña inicial es el número de documento.
              </p>
              <div className={i.userCheck}>
                <label className={h.field}>Usuario
                  <input className={h.input} value={form.username} onChange={e => { setForm({ ...form, username: e.target.value }); setRevision(null) }} />
                </label>
                <span className={c.hint} style={{ paddingBottom: '10px' }}>{limpiarUsuario(form.username) || '…'}{DOMINIO_USUARIOS}</span>
                <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={!!ocupado || !form.username.trim()} onClick={revisarUsuario}>
                  {ocupado === 'revisar' ? <FaSpinner className="fa-spin" /> : <FaSearch />} Revisar usuario
                </button>
              </div>
              {revision && (revision.disponible
                ? <span className={i.userOk}>✓ «{revision.usuario}» está disponible.</span>
                : <span className={i.userNo}>
                    ✗ «{revision.usuario}» ya existe.{' '}
                    {revision.sugerencia && (
                      <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => { setForm({ ...form, username: revision.sugerencia! }); setRevision({ usuario: revision.sugerencia!, disponible: true, sugerencia: null }) }}>
                        Usar «{revision.sugerencia}»
                      </button>
                    )}
                  </span>)}
              {anioFuturo && (
                <div className={c.noteBox}>
                  <strong>Inscripción para {form.schoolYear}</strong>
                  El año activo es {detalle.anioActivo}. Podrás inscribir después del paso de año (Fin de año); si se inscribiera ahora, el paso de año lo movería al curso siguiente. Mientras tanto, déjala «En proceso».
                </div>
              )}
              <div>
                <button type="button" className={`${h.btn} ${h.btnGreen}`} disabled={!!ocupado || anioFuturo || !curso || !!detalle.perfilExistente} onClick={inscribir}>
                  {ocupado === 'inscribir' ? <FaSpinner className="fa-spin" /> : <FaUserCheck />} Inscribir
                </button>
              </div>
            </section>
          )}
        </fieldset>

        {error && <div className={h.errorBox} style={{ marginBottom: 0 }}>{error}</div>}

        {!inscrita && (
          <div className={`${i.actions} ${i.sticky}`}>
            <button type="button" className={`${h.btn} ${h.btnBlue}`} disabled={!!ocupado} onClick={() => guardar()}>
              {ocupado === 'guardar' ? <FaSpinner className="fa-spin" /> : <FaSave />} Guardar cambios
            </button>
            {detalle.status === 'new' && (
              <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={!!ocupado} onClick={() => cambiarEstado('in_process')}>Marcar «En proceso»</button>
            )}
            {abierta && (
              <button type="button" className={`${h.btn} ${h.btnWarn}`} disabled={!!ocupado} onClick={() => { if (confirm('¿Marcar esta solicitud como «No continúa»? Se puede reabrir después.')) cambiarEstado('not_continuing') }}>No continúa</button>
            )}
            {detalle.status === 'not_continuing' && (
              <button type="button" className={`${h.btn} ${h.btnGhost}`} disabled={!!ocupado} onClick={() => cambiarEstado('in_process')}>Reabrir</button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
