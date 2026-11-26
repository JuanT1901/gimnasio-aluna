'use client'

import { useEffect, useState } from 'react'
import { FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import m from 'app/styles/pages/Matricula.module.scss'
import { FilaArchivo, fechaPublicacion } from 'app/components/matricula/ArchivoMatricula'
import type { PublicacionMatricula } from 'app/utils/matricula/comun'
import { obtenerDocumentosMatricula, descargarDocumentoMatricula } from './actions'

export default function ProcesoMatriculaPage() {
  const [publicaciones, setPublicaciones] = useState<PublicacionMatricula[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerDocumentosMatricula().then(r => {
      if (r.exito) setPublicaciones(r.publicaciones!)
      else setError(r.error ?? 'No se pudieron cargar los documentos.')
    })
  }, [])

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!publicaciones) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3CA0E8" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1>Proceso de matrícula</h1>
          <p>Aquí encontrarás los documentos que el colegio publica para la matrícula. Descárgalos y sigue las indicaciones de cada publicación.</p>
        </div>
      </header>

      {publicaciones.length === 0 ? (
        <div className={h.empty}>Por ahora no hay documentos publicados. Cuando el colegio los suba, aparecerán aquí.</div>
      ) : (
        <div className={m.list} style={{ maxWidth: '860px' }}>
          {publicaciones.map(p => (
            <article key={p.id} className={m.post}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>{p.titulo}</h3>
                <div className={m.meta}><span>Publicado el {fechaPublicacion(p.createdAt)}</span></div>
              </div>
              {p.comentario && <p className={m.comment}>{p.comentario}</p>}
              <div className={m.files}>
                {p.archivos.map(a => <FilaArchivo key={a.path} archivo={a} descargar={() => descargarDocumentoMatricula(p.id, a.path)} />)}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
