'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FaEdit, FaSpinner, FaTimes, FaTrash, FaUpload } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import m from 'app/styles/pages/Matricula.module.scss'
import { createClient } from 'app/utils/supabase/client'
import { FilaArchivo, IconoArchivo, fechaPublicacion } from 'app/components/matricula/ArchivoMatricula'
import {
  type ArchivoMatricula, type PublicacionMatricula,
  ACCEPT_ARCHIVOS, BUCKET_MATRICULA, MAX_ARCHIVOS, MAX_ARCHIVO_MB, TIPOS_ARCHIVO, tamanoLegible,
} from 'app/utils/matricula/comun'
import {
  obtenerPublicaciones, prepararSubida, crearPublicacion, descartarArchivos, editarPublicacion, eliminarPublicacion, descargarArchivoAdmin,
} from './actions'

const VACIO = { titulo: '', comentario: '' }

export default function ProcesoMatriculaAdminPage() {
  const [publicaciones, setPublicaciones] = useState<PublicacionMatricula[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(VACIO)
  const [archivos, setArchivos] = useState<File[]>([])
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: number, titulo: string, comentario: string } | null>(null)
  const [ocupadoId, setOcupadoId] = useState<number | null>(null)
  const inputArchivos = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const r = await obtenerPublicaciones()
    if (r.exito) setPublicaciones(r.publicaciones!)
    else setError(r.error ?? 'No se pudieron cargar las publicaciones.')
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const agregarArchivos = (lista: FileList | null) => {
    if (!lista) return
    const nuevos = [...lista]
    const malo = nuevos.find(f => !TIPOS_ARCHIVO[f.type])
    if (malo) { alert(`«${malo.name}» no es un tipo de archivo permitido. Usa PDF, Word, Excel o imágenes (JPG, PNG).`); return }
    const pesado = nuevos.find(f => f.size > MAX_ARCHIVO_MB * 1024 * 1024)
    if (pesado) { alert(`«${pesado.name}» pesa más de ${MAX_ARCHIVO_MB} MB.`); return }
    const todos = [...archivos, ...nuevos]
    if (todos.length > MAX_ARCHIVOS) { alert(`Puedes subir hasta ${MAX_ARCHIVOS} archivos por publicación.`); return }
    setArchivos(todos)
    if (inputArchivos.current) inputArchivos.current.value = ''
  }

  const publicar = async () => {
    if (!form.titulo.trim()) { alert('Escribe el título de la publicación.'); return }
    if (!archivos.length) { alert('Selecciona al menos un archivo.'); return }

    setSubiendo('Preparando…')
    const prep = await prepararSubida(archivos.map(f => ({ nombre: f.name, tipo: f.type, tamano: f.size })))
    if (!prep.exito || !prep.subidas) { setSubiendo(null); alert(prep.error ?? 'No se pudo preparar la subida.'); return }

    // Los archivos van directo del navegador al almacenamiento privado, con el permiso firmado del servidor
    const supabase = createClient()
    const subidos: ArchivoMatricula[] = []
    for (const [i, f] of archivos.entries()) {
      setSubiendo(`Subiendo ${i + 1} de ${archivos.length}…`)
      const { path, token } = prep.subidas[i]
      const { error: e } = await supabase.storage.from(BUCKET_MATRICULA).uploadToSignedUrl(path, token, f, { contentType: f.type })
      if (e) {
        await descartarArchivos(subidos.map(a => a.path))
        setSubiendo(null)
        alert(`No se pudo subir «${f.name}»: ${e.message}`)
        return
      }
      subidos.push({ path, nombre: f.name, tipo: f.type, tamano: f.size })
    }

    setSubiendo('Publicando…')
    const r = await crearPublicacion({ titulo: form.titulo, comentario: form.comentario, archivos: subidos })
    if (!r.exito) {
      await descartarArchivos(subidos.map(a => a.path))
      setSubiendo(null)
      alert(r.error ?? 'No se pudo publicar.')
      return
    }
    setSubiendo(null)
    setForm(VACIO)
    setArchivos([])
    setAviso('Publicado. Los estudiantes ya pueden ver y descargar los documentos.')
    await cargar()
  }

  const guardarEdicion = async () => {
    if (!editando) return
    setOcupadoId(editando.id)
    const r = await editarPublicacion(editando.id, { titulo: editando.titulo, comentario: editando.comentario })
    setOcupadoId(null)
    if (!r.exito) { alert(r.error ?? 'No se pudo guardar.'); return }
    setEditando(null)
    setAviso('Cambios guardados.')
    await cargar()
  }

  const borrar = async (p: PublicacionMatricula) => {
    if (!confirm(`¿Borrar «${p.titulo}» y sus ${p.archivos.length} archivo(s)? Los estudiantes dejarán de verla. Esta acción no se puede deshacer.`)) return
    setOcupadoId(p.id)
    const r = await eliminarPublicacion(p.id)
    setOcupadoId(null)
    if (!r.exito) { alert(r.error ?? 'No se pudo borrar.'); return }
    setAviso('Publicación borrada.')
    await cargar()
  }

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '20px' }}>
        <div>
          <h1>Proceso de matrícula</h1>
          <p>Sube los documentos que los acudientes deben descargar para la matrícula. Los ven todos los estudiantes en la sección «Proceso de matrícula».</p>
        </div>
      </header>

      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      <div className={m.layout}>
        <section className={c.panel}>
          <h3>Nueva publicación</h3>
          <label className={h.field}>Título<input className={h.input} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Documentos de matrícula 2027" maxLength={150} /></label>
          <label className={h.field}>Comentario<textarea className={h.input} rows={5} value={form.comentario} onChange={e => setForm({ ...form, comentario: e.target.value })}
            placeholder="Ej: Descarguen, impriman y diligencien estos documentos. Tráiganlos firmados el día de la matrícula." /></label>

          <div className={c.upload}>
            <input ref={inputArchivos} type="file" multiple accept={ACCEPT_ARCHIVOS} onChange={e => agregarArchivos(e.target.files)} />
            <span className={c.hint}>PDF, Word, Excel o imágenes. Hasta {MAX_ARCHIVOS} archivos de máximo {MAX_ARCHIVO_MB} MB cada uno.</span>
            {archivos.length > 0 && (
              <ul className={m.picked}>
                {archivos.map((f, i) => (
                  <li key={i} className={m.pickedItem}>
                    <IconoArchivo tipo={f.type} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{f.name} <span className={m.fileSize}>· {tamanoLegible(f.size)}</span></span>
                    <button type="button" className={h.iconBtn} onClick={() => setArchivos(archivos.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`} disabled={!!subiendo}><FaTimes size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className={`${h.btn} ${h.btnBlue}`} onClick={publicar} disabled={!!subiendo}>
            {subiendo ? <><FaSpinner className="fa-spin" /> {subiendo}</> : <><FaUpload /> Publicar</>}
          </button>
        </section>

        <div className={m.list}>
          {publicaciones.length === 0 && <div className={h.empty}>Aún no hay publicaciones. Las que subas aparecerán aquí.</div>}
          {publicaciones.map(p => (
            <article key={p.id} className={m.post}>
              {editando?.id === p.id ? (
                <>
                  <label className={h.field}>Título<input className={h.input} value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} maxLength={150} /></label>
                  <label className={h.field}>Comentario<textarea className={h.input} rows={5} value={editando.comentario} onChange={e => setEditando({ ...editando, comentario: e.target.value })} /></label>
                  <div className={h.toolbar} style={{ marginBottom: 0 }}>
                    <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={() => setEditando(null)}>Cancelar</button>
                    <button type="button" className={`${h.btn} ${h.btnBlue} ${h.btnSm}`} onClick={guardarEdicion} disabled={ocupadoId === p.id}>
                      {ocupadoId === p.id && <FaSpinner className="fa-spin" />} Guardar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={m.postHead}>
                    <div>
                      <h3>{p.titulo}</h3>
                      <div className={m.meta}>
                        <span>Publicado el {fechaPublicacion(p.createdAt)}</span>
                      </div>
                    </div>
                    <div className={m.actions}>
                      <button type="button" className={h.iconBtn} aria-label="Editar" title="Editar título o comentario"
                        onClick={() => setEditando({ id: p.id, titulo: p.titulo, comentario: p.comentario ?? '' })}><FaEdit size={13} /></button>
                      <button type="button" className={h.iconBtn} aria-label="Borrar" title="Borrar publicación" onClick={() => borrar(p)} disabled={ocupadoId === p.id}>
                        {ocupadoId === p.id ? <FaSpinner className="fa-spin" size={13} /> : <FaTrash size={13} color="#dc2626" />}
                      </button>
                    </div>
                  </div>
                  {p.comentario && <p className={m.comment}>{p.comentario}</p>}
                </>
              )}
              <div className={m.files}>
                {p.archivos.map(a => <FilaArchivo key={a.path} archivo={a} descargar={() => descargarArchivoAdmin(p.id, a.path)} />)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
