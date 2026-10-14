'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FaCalendarAlt, FaPencilAlt, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import HorarioSemanal, { NavegadorSemana, Segmentado } from 'app/components/horario/HorarioSemanal'
import { useHorario } from 'app/components/horario/useHorario'
import { obtenerContextoHorario, type ContextoHorario, type ObjetivoHorario } from 'app/utils/horario/actions'
import { semanaActual } from 'app/utils/horario/comun'

export default function HorarioProfesorPage() {
  const [contexto, setContexto] = useState<ContextoHorario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState('mias') // 'mias' o el id del curso que dirige
  const [semana, setSemana] = useState(semanaActual)

  useEffect(() => {
    obtenerContextoHorario().then(r => {
      if (r.contexto) setContexto(r.contexto)
      else setError(r.error ?? 'No se pudo cargar la información.')
    })
  }, [])

  const objetivo = useMemo<ObjetivoHorario | null>(() => {
    if (!contexto) return null
    return vista === 'mias' ? { tipo: 'docente' } : { tipo: 'curso', gradeId: Number(vista) }
  }, [contexto, vista])

  const { datos, cargando, error: errorHorario } = useHorario(objetivo, semana)
  const cursoDirigido = contexto?.cursos.find(c => String(c.id) === vista)

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!contexto) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#10b981" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaCalendarAlt color="#10b981" /> Mi horario</h1>
          <p>
            {cursoDirigido
              ? `Horario completo de ${cursoDirigido.name}, tu curso como director de grupo.`
              : 'Tus clases en todos tus cursos. Haz clic en una clase para ver su planeación.'}
          </p>
        </div>
        <Link href={`/plataformas/profesores/planeacion?semana=${semana}`} className={`${h.btn} ${h.btnGreen}`}>
          <FaPencilAlt size={12} /> Planeación de esta semana
        </Link>
      </header>

      <div className={h.toolbar}>
        {contexto.cursos.length > 0 && (
          <Segmentado
            valor={vista}
            onCambiar={setVista}
            opciones={[['mias', 'Mis clases'], ...contexto.cursos.map(c => [String(c.id), `${c.name} (director)`] as [string, string])]}
          />
        )}
        <span className={h.spacer} />
        <NavegadorSemana semana={semana} onCambiar={setSemana} />
      </div>

      {errorHorario ? <div className={h.errorBox}>{errorHorario}</div> : (
        <HorarioSemanal
          datos={datos}
          cargando={cargando}
          rol="teacher"
          userId={contexto.userId}
          mostrarCurso={vista === 'mias'}
          vacio={vista === 'mias' ? 'Aún no tienes clases en el horario.' : 'Este curso aún no tiene horario.'}
        />
      )}
    </main>
  )
}
