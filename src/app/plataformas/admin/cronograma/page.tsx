'use client'

import { useCallback, useEffect, useState } from 'react'
import { FaCheck, FaEdit, FaImage, FaPlus, FaSpinner, FaTimes, FaTrash } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import s from 'app/styles/pages/Cronograma.module.scss'
import { createClient } from 'app/utils/supabase/client'
import type { DiaSinClase } from 'app/utils/horario/comun'
import { type DatosCronograma, BUCKET_CRONOGRAMA, MAX_IMAGEN_MB, NOMBRES_MES, TIPOS_IMAGEN, itemsDelMes } from 'app/utils/cronograma/comun'
import { ItemCronograma, PortadaMes, SelectorAnio } from 'app/components/cronograma/Cronograma'
import {
  type DatosActividad,
  obtenerCronogramaAdmin, guardarTituloMes, prepararImagenMes, confirmarImagenMes, quitarImagenMes,
  crearActividad, editarActividad, eliminarActividad,
} from './actions'

type Form = { id: number | null, tipo: DatosActividad['tipo'], startDate: string, endDate: string, titulo: string, todos: boolean, gradeIds: number[], sinClases: boolean }
const VACIO: Form = { id: null, tipo: 'extracurricular', startDate: '', endDate: '', titulo: '', todos: true, gradeIds: [], sinClases: true }

export default function CronogramaAdminPage() {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [datos, setDatos] = useState<DatosCronograma | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [titulo, setTitulo] = useState<{ mes: number, texto: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async (a: number) => {
    const r = await obtenerCronogramaAdmin(a)
    if (r.exito) { setDatos(r.datos!); setError(null) } else setError(r.error ?? 'No se pudo cargar el cronograma.')
  }, [])

  useEffect(() => { cargar(anio) }, [anio, cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const ejecutar = async (clave: string, fn: () => Promise<{ exito: boolean, error?: string }>, ok: string) => {
    setOcupado(clave)
    const r = await fn()
    setOcupado(null)
    if (!r.exito) { alert(r.error ?? 'Ocurrió un error.'); return false }
    setAviso(ok)
    await cargar(anio)
    return true
  }

  const guardarActividad = async () => {
    const d: DatosActividad = {
      tipo: form.tipo, startDate: form.startDate, endDate: form.endDate || form.startDate, titulo: form.titulo,
      gradeIds: form.todos ? null : form.gradeIds, sinClases: form.sinClases,
    }
    setGuardando(true)
    const r = form.id ? await editarActividad(form.id, d) : await crearActividad(d)
    setGuardando(false)
    if (!r.exito) { alert(r.error ?? 'No se pudo guardar.'); return }
    // Si la actividad es de otro año, se muestra ese año
    const anioActividad = Number(form.startDate.slice(0, 4))
    setAviso(form.id ? 'Cambios guardados.' : 'Agregado al cronograma.')
    setForm({ ...VACIO, tipo: form.tipo })
    if (anioActividad !== anio) setAnio(anioActividad)
    else await cargar(anio)
  }

  const editar = (it: DiaSinClase) => {
    // Los días que se crearon antes solo para preescolar o para primaria y bachillerato se pasan a sus cursos
    const deSeccion = !it.gradeIds?.length && it.scope !== 'all'
      ? (datos?.cursos ?? []).filter(c => c.section === it.scope).map(c => c.id) : null
    setForm({
      id: it.id, tipo: it.kind === 'extracurricular' ? 'extracurricular' : 'sin_clase', startDate: it.startDate, endDate: it.endDate,
      titulo: it.reason, todos: !it.gradeIds?.length && !deSeccion, gradeIds: it.gradeIds ?? deSeccion ?? [], sinClases: it.noClass,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const borrar = (it: DiaSinClase) => {
    if (!confirm(`¿Quitar «${it.reason}» del cronograma?${it.noClass ? ' Ese día se volverá a pedir planeación.' : ''}`)) return
    ejecutar(`item-${it.id}`, () => eliminarActividad(it.id), 'Quitado del cronograma.')
  }

  const subirImagen = async (mes: number, archivo: File | undefined) => {
    if (!archivo) return
    if (!TIPOS_IMAGEN.includes(archivo.type)) { alert('La imagen debe ser JPG, PNG o WEBP.'); return }
    if (archivo.size > MAX_IMAGEN_MB * 1024 * 1024) { alert(`La imagen no puede pasar de ${MAX_IMAGEN_MB} MB.`); return }
    setOcupado(`img-${mes}`)
    const prep = await prepararImagenMes(anio, mes, archivo.type, archivo.size)
    if (!prep.exito || !prep.path || !prep.token) { setOcupado(null); alert(prep.error ?? 'No se pudo subir la imagen.'); return }
    const { error: e } = await createClient().storage.from(BUCKET_CRONOGRAMA).uploadToSignedUrl(prep.path, prep.token, archivo, { contentType: archivo.type })
    if (e) { setOcupado(null); alert(`No se pudo subir la imagen: ${e.message}`); return }
    await ejecutar(`img-${mes}`, () => confirmarImagenMes(anio, mes, prep.path!), `Imagen de ${NOMBRES_MES[mes - 1]} actualizada.`)
  }

  const cursosPorSeccion = (datos?.cursos ?? [])
  const fechaValida = !!form.startDate && !!form.titulo.trim() && (form.todos || form.gradeIds.length > 0)

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1>Cronograma</h1>
          <p>Los festivos de Colombia salen solos. Agrega las actividades extracurriculares y los días sin clase: los días sin clases ya no piden planeación a los cursos a los que aplican.</p>
        </div>
        <SelectorAnio anio={anio} onAnio={a => { setDatos(null); setAnio(a) }} />
      </header>

      {aviso && <div className={h.toast} role="status">{aviso}</div>}
      {error && <div className={h.errorBox} style={{ marginBottom: '16px' }}>{error}</div>}

      <div className={s.layout}>
        <section className={`${c.panel} ${s.sticky} ${s.form}`}>
          <h3>{form.id ? 'Editar' : 'Agregar al cronograma'}</h3>
          <div className={c.radioRow}>
            <label className={form.tipo === 'extracurricular' ? c.radioOn : ''}>
              <input type="radio" name="tipo" checked={form.tipo === 'extracurricular'} onChange={() => setForm({ ...form, tipo: 'extracurricular' })} /> Actividad extracurricular
            </label>
            <label className={form.tipo === 'sin_clase' ? c.radioOn : ''}>
              <input type="radio" name="tipo" checked={form.tipo === 'sin_clase'} onChange={() => setForm({ ...form, tipo: 'sin_clase' })} /> Día sin clase
            </label>
          </div>
          {form.tipo === 'sin_clase' && <span className={c.hint}>Para recesos, vacaciones o jornadas pedagógicas. Esos días no se pide planeación. Los festivos no hay que agregarlos.</span>}

          <label className={h.field}>{form.tipo === 'extracurricular' ? 'Actividad' : 'Motivo'}
            <input className={h.input} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} maxLength={150}
              placeholder={form.tipo === 'extracurricular' ? 'Ej: Salida pedagógica al museo' : 'Ej: Receso escolar'} />
          </label>
          <div className={s.fechas}>
            <label className={h.field}>Desde<input className={h.input} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value, endDate: form.endDate && form.endDate >= e.target.value ? form.endDate : '' })} /></label>
            <label className={h.field}>Hasta (opcional)<input className={h.input} type="date" value={form.endDate} min={form.startDate || undefined} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
          </div>

          <div className={h.field}>
            Cursos
            <div className={c.radioRow}>
              <label className={form.todos ? c.radioOn : ''}><input type="radio" name="cursos" checked={form.todos} onChange={() => setForm({ ...form, todos: true })} /> Todos los cursos</label>
              <label className={!form.todos ? c.radioOn : ''}><input type="radio" name="cursos" checked={!form.todos} onChange={() => setForm({ ...form, todos: false })} /> Algunos cursos</label>
            </div>
          </div>
          {!form.todos && (
            <div className={s.courses}>
              {cursosPorSeccion.map(x => (
                <label key={x.id}>
                  <input type="checkbox" checked={form.gradeIds.includes(x.id)}
                    onChange={e => setForm({ ...form, gradeIds: e.target.checked ? [...form.gradeIds, x.id] : form.gradeIds.filter(g => g !== x.id) })} /> {x.nombre}
                </label>
              ))}
            </div>
          )}
          {form.tipo === 'extracurricular' && (
            <label className={c.check}>
              <input type="checkbox" checked={form.sinClases} onChange={e => setForm({ ...form, sinClases: e.target.checked })} />
              Ese día no hay clases para estos cursos (no se pide planeación)
            </label>
          )}

          <div className={h.toolbar} style={{ marginBottom: 0 }}>
            {form.id && <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={() => setForm(VACIO)}>Cancelar</button>}
            <button type="button" className={`${h.btn} ${h.btnBlue}`} onClick={guardarActividad} disabled={guardando || !fechaValida}>
              {guardando ? <FaSpinner className="fa-spin" /> : form.id ? <FaCheck /> : <FaPlus />} {form.id ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </section>

        {!datos ? <div style={{ textAlign: 'center', marginTop: '80px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div> : (
          <div className={s.grid}>
            {datos.meses.map(m => {
              const items = itemsDelMes(datos.items, datos.anio, m.mes)
              const nombre = `${NOMBRES_MES[m.mes - 1]} ${datos.anio}`
              return (
                <section key={m.mes} className={s.month}>
                  <PortadaMes mes={m} anio={datos.anio}>
                    <div className={s.coverActions}>
                      <label title="Subir o cambiar la imagen del mes">
                        {ocupado === `img-${m.mes}` ? <FaSpinner className="fa-spin" /> : <FaImage />} {m.imagenUrl ? 'Cambiar' : 'Subir imagen'}
                        <input type="file" accept={TIPOS_IMAGEN.join(',')} disabled={ocupado !== null} onChange={e => { subirImagen(m.mes, e.target.files?.[0]); e.target.value = '' }} />
                      </label>
                      {m.imagenUrl && (
                        <button type="button" title="Quitar la imagen" disabled={ocupado !== null}
                          onClick={() => confirm(`¿Quitar la imagen de ${nombre}?`) && ejecutar(`img-${m.mes}`, () => quitarImagenMes(datos.anio, m.mes), 'Imagen quitada.')}>
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </PortadaMes>
                  <div className={s.body}>
                    {titulo?.mes === m.mes ? (
                      <div className={s.titleEdit}>
                        <input className={h.input} value={titulo.texto} onChange={e => setTitulo({ ...titulo, texto: e.target.value })} placeholder={nombre} maxLength={80} autoFocus />
                        <button type="button" className={h.iconBtn} aria-label="Guardar título" disabled={ocupado !== null}
                          onClick={async () => { if (await ejecutar(`tit-${m.mes}`, () => guardarTituloMes(datos.anio, m.mes, titulo.texto), 'Título guardado.')) setTitulo(null) }}>
                          {ocupado === `tit-${m.mes}` ? <FaSpinner className="fa-spin" /> : <FaCheck />}
                        </button>
                        <button type="button" className={h.iconBtn} aria-label="Cancelar" onClick={() => setTitulo(null)}><FaTimes /></button>
                      </div>
                    ) : (
                      <div className={s.titleRow}>
                        <div>
                          {m.titulo && <span className={s.monthName}>{nombre}</span>}
                          <h3 className={s.title}>{m.titulo ?? nombre}</h3>
                        </div>
                        <button type="button" className={h.iconBtn} aria-label="Editar título" title="Editar el título del mes" onClick={() => setTitulo({ mes: m.mes, texto: m.titulo ?? '' })}><FaEdit size={12} /></button>
                      </div>
                    )}
                    {items.length ? (
                      <ul className={s.items}>
                        {items.map((it, i) => (
                          <ItemCronograma key={`${it.id}-${it.startDate}`} item={it} indice={i} cursos={datos.cursos}
                            acciones={it.id > 0 ? (
                              <>
                                <button type="button" aria-label="Editar" title="Editar" onClick={() => editar(it)}><FaEdit size={11} /></button>
                                <button type="button" aria-label="Quitar" title="Quitar" onClick={() => borrar(it)} disabled={ocupado !== null}>
                                  {ocupado === `item-${it.id}` ? <FaSpinner className="fa-spin" size={11} /> : <FaTrash size={11} />}
                                </button>
                              </>
                            ) : undefined} />
                        ))}
                      </ul>
                    ) : <p className={s.none}>Sin festivos ni actividades.</p>}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
