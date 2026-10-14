'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FaCalendarAlt, FaEdit, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import HorarioSemanal, { NavegadorSemana, Segmentado } from 'app/components/horario/HorarioSemanal'
import { useHorario } from 'app/components/horario/useHorario'
import { obtenerContextoHorario, type ContextoHorario, type ObjetivoHorario } from 'app/utils/horario/actions'
import { semanaActual } from 'app/utils/horario/comun'

export default function AdminHorarioPage() {
  const [contexto, setContexto] = useState<ContextoHorario | null>(null)
  const [errorContexto, setErrorContexto] = useState<string | null>(null)
  const [modo, setModo] = useState<'curso' | 'docente'>('curso')
  const [cursoId, setCursoId] = useState<number | null>(null)
  const [docenteId, setDocenteId] = useState('')
  const [semana, setSemana] = useState(semanaActual)

  useEffect(() => {
    obtenerContextoHorario().then(r => {
      if (!r.contexto) { setErrorContexto(r.error ?? 'No se pudo cargar la información.'); return }
      setContexto(r.contexto)
      setCursoId(r.contexto.cursos[0]?.id ?? null)
      setDocenteId(r.contexto.docentes[0]?.id ?? '')
    })
  }, [])

  const objetivo = useMemo<ObjetivoHorario | null>(() => {
    if (modo === 'curso') return cursoId ? { tipo: 'curso', gradeId: cursoId } : null
    return docenteId ? { tipo: 'docente', teacherId: docenteId } : null
  }, [modo, cursoId, docenteId])

  const { datos, cargando, error, recargar } = useHorario(objetivo, semana)

  if (errorContexto) return <main className={styles.mainContent}><div className={h.errorBox}>{errorContexto}</div></main>
  if (!contexto) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaCalendarAlt color="#3b82f6" /> Horario</h1>
          <p>Consulta el horario de cada curso o docente y revisa la planeación de cada clase.</p>
        </div>
        <Link
          href={`/plataformas/admin/horario/editar${cursoId && modo === 'curso' ? `?curso=${cursoId}` : ''}`}
          className={`${h.btn} ${h.btnDark}`}
        >
          <FaEdit /> Editar horario
        </Link>
      </header>

      <div className={h.toolbar}>
        <Segmentado valor={modo} opciones={[['curso', 'Por curso'], ['docente', 'Por docente']]} onCambiar={setModo} />
        {modo === 'curso' ? (
          <select className={h.select} value={cursoId ?? ''} onChange={e => setCursoId(Number(e.target.value))} aria-label="Curso">
            {contexto.cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <select className={h.select} value={docenteId} onChange={e => setDocenteId(e.target.value)} aria-label="Docente">
            {contexto.docentes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <span className={h.spacer} />
        <NavegadorSemana semana={semana} onCambiar={setSemana} />
      </div>

      {error ? (
        <div className={h.errorBox}>{error}</div>
      ) : !objetivo ? (
        <div className={h.empty}>No hay {modo === 'curso' ? 'cursos' : 'docentes'} registrados.</div>
      ) : (
        <HorarioSemanal
          datos={datos}
          cargando={cargando}
          rol="admin"
          mostrarCurso={modo === 'docente'}
          vacio={modo === 'curso'
            ? 'Este curso aún no tiene horario. Usa «Editar horario» para crearlo.'
            : 'Este docente no tiene clases en el horario.'}
          onPlanActualizado={recargar}
        />
      )}
    </main>
  )
}
