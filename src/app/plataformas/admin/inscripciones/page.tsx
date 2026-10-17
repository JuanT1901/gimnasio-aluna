'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FaFileSignature, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { Segmentado } from 'app/components/horario/HorarioSemanal'
import EstadoInscripcionPill from 'app/components/inscripciones/EstadoInscripcionPill'
import { obtenerInscripciones, type ResumenInscripcion } from './actions'

type Grupo = 'abiertas' | 'enrolled' | 'not_continuing' | 'todas'

const EN_GRUPO: Record<Grupo, (s: ResumenInscripcion) => boolean> = {
  abiertas: s => s.status === 'new' || s.status === 'in_process',
  enrolled: s => s.status === 'enrolled',
  not_continuing: s => s.status === 'not_continuing',
  todas: () => true,
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export default function InscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<ResumenInscripcion[]>([])
  const [grupo, setGrupo] = useState<Grupo>('abiertas')
  const [anio, setAnio] = useState<number | 'todos'>('todos')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerInscripciones().then(r => {
      if (r.exito) setInscripciones(r.inscripciones!)
      else setError(r.error ?? 'No se pudieron cargar las solicitudes.')
      setCargando(false)
    })
  }, [])

  const anios = [...new Set(inscripciones.map(s => s.schoolYear))].sort((a, b) => b - a)
  const delAnio = inscripciones.filter(s => anio === 'todos' || s.schoolYear === anio)
  const contar = (g: Grupo) => delAnio.filter(EN_GRUPO[g]).length
  const visibles = delAnio.filter(EN_GRUPO[grupo])

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaFileSignature color="#3b82f6" /> Solicitudes de inscripción</h1>
          <p>Las familias llenan el formulario en «Quiero ser parte». Revisa la ficha y, al terminar el proceso, oprime «Inscribir».</p>
        </div>
      </header>

      <div className={h.toolbar}>
        <label className={h.field}>Año
          <select className={h.select} style={{ minWidth: 140 }} value={anio} onChange={e => setAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}>
            <option value="todos">Todos los años</option>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <Segmentado<Grupo>
          valor={grupo}
          onCambiar={setGrupo}
          opciones={[
            ['abiertas', `Por gestionar (${contar('abiertas')})`], ['enrolled', `Inscritas (${contar('enrolled')})`],
            ['not_continuing', `No continúan (${contar('not_continuing')})`], ['todas', `Todas (${contar('todas')})`],
          ]}
        />
      </div>

      {error ? <div className={h.errorBox}>{error}</div> : cargando ? (
        <div className={h.loading}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>
      ) : visibles.length === 0 ? (
        <div className={h.empty}>No hay solicitudes en este grupo.</div>
      ) : (
        <div className={c.reqs}>
          {visibles.map(s => (
            <Link key={s.id} href={`/plataformas/admin/inscripciones/${s.id}`} className={`${c.req} ${c.reqLink} ${s.nueva ? c.reqFresh : ''}`}>
              <div>
                <div className={c.rTitle}>
                  {s.nueva && <span className={c.newDot} aria-label="Nueva" />}
                  {s.estudiante} <small>{s.code}</small>
                </div>
                <div className={c.rMeta}>
                  {s.grado ? `${s.grado}${s.curso ? ` (${s.curso})` : ''}` : 'Sin grado'} · Año {s.schoolYear}{s.familia ? ` · ${s.familia}` : ''}
                </div>
                {s.completadaPorOtro && (
                  <div className={c.rTags}><span className={`${h.pill} ${h.pillNone}`}>Completada por otro acudiente</span></div>
                )}
              </div>
              <div className={c.rSide}>
                <EstadoInscripcionPill estado={s.status} />
                <time dateTime={s.createdAt}>{fecha(s.createdAt)}</time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
