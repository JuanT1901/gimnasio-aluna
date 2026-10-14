'use client'

import { useEffect, useMemo, useState } from 'react'
import { FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import HorarioSemanal, { NavegadorSemana } from 'app/components/horario/HorarioSemanal'
import { useHorario } from 'app/components/horario/useHorario'
import { obtenerContextoHorario, type ContextoHorario, type ObjetivoHorario } from 'app/utils/horario/actions'
import { semanaActual } from 'app/utils/horario/comun'

export default function HorarioEstudiantePage() {
  const [contexto, setContexto] = useState<ContextoHorario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [semana, setSemana] = useState(semanaActual)

  useEffect(() => {
    obtenerContextoHorario().then(r => {
      if (r.contexto) setContexto(r.contexto)
      else setError(r.error ?? 'No se pudo cargar la información.')
    })
  }, [])

  const curso = contexto?.cursos[0]
  const objetivo = useMemo<ObjetivoHorario | null>(() => (curso ? { tipo: 'curso', gradeId: curso.id } : null), [curso])
  const { datos, cargando, error: errorHorario } = useHorario(objetivo, semana)

  if (error) return <main className={styles.mainContent}><div className={h.errorBox}>{error}</div></main>
  if (!contexto) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3CA0E8" /></div>

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1>Mi horario</h1>
          <p>Haz clic en una clase para ver lo que se trabajará ese día.</p>
        </div>
        {curso && (
          <div className={styles.gradeBadge}>
            <span>Mi curso</span>
            <strong>{curso.name}</strong>
          </div>
        )}
      </header>

      {!curso ? (
        <div className={h.empty}>Aún no tienes un curso asignado. Comunícate con el colegio.</div>
      ) : (
        <>
          <div className={h.toolbar}>
            <span className={h.spacer} />
            <NavegadorSemana semana={semana} onCambiar={setSemana} />
          </div>
          {errorHorario ? <div className={h.errorBox}>{errorHorario}</div> : (
            <HorarioSemanal
              datos={datos}
              cargando={cargando}
              rol="student"
              vacio="Tu curso aún no tiene horario publicado."
            />
          )}
        </>
      )}
    </main>
  )
}
