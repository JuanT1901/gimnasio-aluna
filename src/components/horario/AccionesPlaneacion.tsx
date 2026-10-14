'use client'

import { useState } from 'react'
import { FaCheck, FaEdit, FaEyeSlash, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Horario.module.scss'
import type { EstadoPlaneacion } from 'app/utils/horario/comun'
import { despublicarPlaneacion, editarPlaneacion, publicarPlaneacion } from 'app/app/plataformas/admin/horario/actions'

export type PlanRevisable = {
  id: number
  content: string
  status: EstadoPlaneacion
  reviewNote: string | null
  adminEdited: boolean
}

type Modo = 'ver' | 'editar' | 'despublicar'

// Texto de la planeación con los botones de la rectora: publicar, editar y despublicar con observación
export default function AccionesPlaneacion({ plan, onCambio }: { plan: PlanRevisable, onCambio: (plan: PlanRevisable) => void }) {
  const [modo, setModo] = useState<Modo>('ver')
  const [texto, setTexto] = useState(plan.content)
  const [observacion, setObservacion] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const ejecutar = async (accion: string, fn: () => Promise<{ exito: boolean, error?: string }>, siExito: () => void) => {
    setTrabajando(accion)
    const r = await fn()
    setTrabajando(null)
    if (!r.exito) { alert('Error: ' + r.error); return }
    siExito()
    setModo('ver')
  }

  const publicar = () => ejecutar('publicar', () => publicarPlaneacion(plan.id), () =>
    onCambio({ ...plan, status: 'published', reviewNote: null }))

  const despublicar = () => ejecutar('despublicar', () => despublicarPlaneacion(plan.id, observacion), () => {
    onCambio({ ...plan, status: 'draft', reviewNote: observacion.trim() || null })
    setObservacion('')
  })

  const guardar = (yPublicar: boolean) => ejecutar(yPublicar ? 'guardar-publicar' : 'guardar', () => editarPlaneacion(plan.id, texto, yPublicar), () => {
    const cambio = texto.trim() !== plan.content
    onCambio({
      ...plan,
      content: texto.trim(),
      adminEdited: plan.adminEdited || cambio,
      ...(yPublicar ? { status: 'published' as const, reviewNote: null } : {}),
    })
  })

  const spinner = (accion: string) => (trabajando === accion ? <FaSpinner className="fa-spin" /> : null)
  const ocupado = trabajando !== null

  return (
    <div className={styles.reviewBlock}>
      {modo === 'editar' ? (
        <textarea className={styles.planText} value={texto} maxLength={5000} onChange={e => setTexto(e.target.value)} aria-label="Texto de la planeación" autoFocus />
      ) : (
        <p className={styles.logros}>{plan.content}</p>
      )}

      {(plan.adminEdited || plan.reviewNote) && modo === 'ver' && (
        <div className={styles.reviewTags}>
          {plan.adminEdited && <span className={`${styles.pill} ${styles.pillEdited}`}>Editada por rectoría</span>}
        </div>
      )}

      {plan.reviewNote && modo === 'ver' && (
        <div className={styles.noteBox}>
          <strong>Observación enviada al docente</strong>
          {plan.reviewNote}
        </div>
      )}

      {modo === 'despublicar' && (
        <div className={styles.unpublishBox}>
          <label className={styles.label} htmlFor={`obs-${plan.id}`}>Observación para el docente (opcional)</label>
          <textarea
            id={`obs-${plan.id}`}
            className={styles.planText}
            value={observacion}
            maxLength={1000}
            placeholder="Ej: Falta incluir la actividad de evaluación."
            onChange={e => setObservacion(e.target.value)}
            autoFocus
          />
          <span className={styles.planHint}>El docente recibirá una notificación y los estudiantes dejarán de ver esta planeación hasta que la publiques de nuevo.</span>
        </div>
      )}

      <div className={styles.reviewActions}>
        {modo === 'ver' && (
          <>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} disabled={ocupado} onClick={() => { setTexto(plan.content); setModo('editar') }}>
              <FaEdit size={11} /> Editar
            </button>
            {plan.status === 'draft' ? (
              <button type="button" className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`} disabled={ocupado} onClick={publicar}>
                {spinner('publicar') ?? <FaCheck size={11} />} Publicar
              </button>
            ) : (
              <button type="button" className={`${styles.btn} ${styles.btnWarn} ${styles.btnSm}`} disabled={ocupado} onClick={() => setModo('despublicar')}>
                <FaEyeSlash size={12} /> Despublicar
              </button>
            )}
          </>
        )}

        {modo === 'editar' && (
          <>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} disabled={ocupado} onClick={() => setModo('ver')}>Cancelar</button>
            <button type="button" className={`${styles.btn} ${styles.btnDark} ${styles.btnSm}`} disabled={ocupado || !texto.trim()} onClick={() => guardar(false)}>
              {spinner('guardar')} Guardar
            </button>
            {plan.status === 'draft' && (
              <button type="button" className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`} disabled={ocupado || !texto.trim()} onClick={() => guardar(true)}>
                {spinner('guardar-publicar')} Guardar y publicar
              </button>
            )}
          </>
        )}

        {modo === 'despublicar' && (
          <>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} disabled={ocupado} onClick={() => setModo('ver')}>Cancelar</button>
            <button type="button" className={`${styles.btn} ${styles.btnWarn} ${styles.btnSm}`} disabled={ocupado} onClick={despublicar}>
              {spinner('despublicar') ?? <FaEyeSlash size={12} />} Despublicar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
