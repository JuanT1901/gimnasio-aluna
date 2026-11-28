'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FaCopy, FaRedoAlt, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { ESTADO_POSTULACION, type EstadoPostulacion, ruta } from 'app/utils/contratacion/comun'
import { obtenerEnlace, obtenerPostulaciones, regenerarEnlace, type ResumenPostulacion } from './actions'

const CLASE_ESTADO: Record<EstadoPostulacion, string> = { pending: c.pillReview, hired: h.pillPublished, discarded: h.pillNone }
const FILTROS: (EstadoPostulacion | 'all')[] = ['pending', 'hired', 'discarded', 'all']

export default function ContratacionPage() {
  const [lista, setLista] = useState<ResumenPostulacion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<EstadoPostulacion | 'all'>('pending')
  const [aviso, setAviso] = useState<string | null>(null)
  const [regenerando, setRegenerando] = useState(false)

  useEffect(() => {
    obtenerPostulaciones().then(r => (r.exito ? setLista(r.postulaciones!) : setError(r.error ?? 'No se pudo cargar la lista.')))
    obtenerEnlace().then(r => (r.exito ? setToken(r.token!) : setErrorEnlace(r.error ?? 'No se pudo obtener el enlace.')))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const enlace = token && typeof window !== 'undefined' ? `${window.location.origin}${ruta(token)}` : ''

  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); setAviso('Enlace copiado. Ya lo puedes compartir.') } catch { alert(enlace) }
  }

  const regenerar = async () => {
    if (!confirm('Se creará un enlace nuevo y el anterior dejará de funcionar. ¿Continuar?')) return
    setRegenerando(true)
    const r = await regenerarEnlace()
    setRegenerando(false)
    if (!r.exito) { alert(r.error); return }
    setToken(r.token!)
    setAviso('Enlace nuevo creado. El anterior ya no funciona.')
  }

  const visibles = (lista ?? []).filter(p => filtro === 'all' || p.status === filtro)
  const cuenta = (e: EstadoPostulacion) => (lista ?? []).filter(p => p.status === e).length

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '20px' }}>
        <div>
          <h1>Contratación</h1>
          <p>Comparte el enlace con los docentes nuevos. Cuando lo llenen, aparecen aquí para revisar sus datos, asignarles cursos y contratarlos.</p>
        </div>
      </header>

      {aviso && <div className={h.toast} role="status">{aviso}</div>}

      <section className={c.panel} style={{ marginBottom: '20px' }}>
        <h3>Enlace del formulario</h3>
        {errorEnlace ? <div className={h.errorBox} style={{ marginBottom: 0 }}>{errorEnlace}</div> : !token ? <FaSpinner className="fa-spin" /> : (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input className={h.input} readOnly value={enlace} onFocus={e => e.target.select()} style={{ flex: '1 1 320px', minWidth: 0 }} />
              <button type="button" className={`${h.btn} ${h.btnBlue}`} onClick={copiar}><FaCopy /> Copiar enlace</button>
              <button type="button" className={`${h.btn} ${h.btnGhost}`} onClick={regenerar} disabled={regenerando}>
                {regenerando ? <FaSpinner className="fa-spin" /> : <FaRedoAlt />} Crear enlace nuevo
              </button>
            </div>
            <span className={c.hint}>Solo quien tenga este enlace puede llenar el formulario. Si se comparte con quien no debía, crea uno nuevo: el anterior deja de funcionar.</span>
          </>
        )}
      </section>

      <div className={c.radioRow} style={{ marginBottom: '14px' }}>
        {FILTROS.map(f => (
          <label key={f} className={filtro === f ? c.radioOn : ''}>
            <input type="radio" name="filtro" checked={filtro === f} onChange={() => setFiltro(f)} />
            {f === 'all' ? 'Todos' : `${ESTADO_POSTULACION[f]} (${cuenta(f)})`}
          </label>
        ))}
      </div>

      {error ? <div className={h.errorBox}>{error}</div> : !lista ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}><FaSpinner className="fa-spin" size={36} color="#3b82f6" /></div>
      ) : visibles.length === 0 ? (
        <div className={h.empty}>{filtro === 'pending' ? 'No hay docentes por revisar. Cuando alguien llene el formulario, aparecerá aquí.' : 'No hay registros.'}</div>
      ) : (
        <div className={c.tblWrap}>
          <table className={c.tbl}>
            <thead><tr><th>Docente</th><th>Documento</th><th>Título</th><th>Recibido</th><th>Estado</th></tr></thead>
            <tbody>
              {visibles.map(p => (
                <tr key={p.id} className={p.nueva ? c.rowReview : ''}>
                  <td>
                    <Link href={`/plataformas/admin/contratacion/${p.id}`} style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>{p.nombre}</Link>
                    {p.nueva && <span className={c.newDot} title="Nuevo" style={{ marginLeft: 6 }} />}
                  </td>
                  <td>{p.documento}</td>
                  <td>{p.profesion}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</td>
                  <td><span className={`${h.pill} ${CLASE_ESTADO[p.status]}`}>{ESTADO_POSTULACION[p.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
