'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FaCalendarTimes, FaPlus, FaSpinner, FaTrash } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import { type AlcanceDiaSinClase, type DiaSinClase, NOMBRE_ALCANCE, formatoFecha, hoyISO } from 'app/utils/horario/comun'
import { crearDiaSinClase, eliminarDiaSinClase, obtenerDiasSinClase } from '../actions'

export default function DiasSinClasePage() {
  const [dias, setDias] = useState<DiaSinClase[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [verPasados, setVerPasados] = useState(false)
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '', scope: 'all' as AlcanceDiaSinClase })

  const cargar = useCallback(async () => {
    const r = await obtenerDiasSinClase()
    if (r.exito) setDias(r.dias!)
    else alert('Error: ' + r.error)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const agregar = async (e: FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const r = await crearDiaSinClase(form)
    setGuardando(false)
    if (!r.exito) { alert(r.error); return }
    setForm({ ...form, endDate: '', reason: '' })
    await cargar()
  }

  const eliminar = async (dia: DiaSinClase) => {
    if (!confirm(`¿Eliminar «${dia.reason}»? Ese día volverá a aparecer como día de clase.`)) return
    const r = await eliminarDiaSinClase(dia.id)
    if (!r.exito) { alert('Error: ' + r.error); return }
    setDias(dias.filter(d => d.id !== dia.id))
  }

  const hoy = hoyISO()
  const pasados = dias.filter(d => d.endDate < hoy)
  const lista = verPasados ? dias : dias.filter(d => d.endDate >= hoy)

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaCalendarTimes color="#3b82f6" /> Días sin clase</h1>
          <p>Festivos, recesos y jornadas pedagógicas. Esos días salen marcados en el horario y no piden planeación.</p>
        </div>
      </header>

      <div className={h.offLayout}>
        <form className={h.panel} onSubmit={agregar}>
          <h3>Agregar día o rango de días</h3>
          <label className={h.field}>
            Desde
            <input className={h.input} type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className={h.field}>
            Hasta (opcional)
            <input className={h.input} type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </label>
          <label className={h.field}>
            Motivo
            <input className={h.input} required placeholder="Ej: Festivo: Día de la Raza" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          </label>
          <label className={h.field}>
            Aplica a
            <select className={h.select} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value as AlcanceDiaSinClase })}>
              {Object.entries(NOMBRE_ALCANCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button type="submit" className={`${h.btn} ${h.btnDark}`} disabled={guardando}>
            {guardando ? <FaSpinner className="fa-spin" /> : <FaPlus size={11} />} Agregar día sin clase
          </button>
        </form>

        <div>
          {cargando ? (
            <div className={h.loading}><FaSpinner className="fa-spin" size={36} color="#3b82f6" /></div>
          ) : lista.length === 0 ? (
            <div className={h.empty}>No hay días sin clase próximos.</div>
          ) : (
            <div className={h.offList}>
              {lista.map(d => (
                <div key={d.id} className={`${h.offRow} ${d.endDate < hoy ? h.offRowPast : ''}`}>
                  <div className={h.offDate}>
                    {formatoFecha(d.startDate)}
                    {d.endDate !== d.startDate && <small>hasta {formatoFecha(d.endDate)}</small>}
                  </div>
                  <div className={h.offWhy}>
                    {d.reason}
                    <small>{NOMBRE_ALCANCE[d.scope]}</small>
                  </div>
                  <button type="button" className={h.iconBtn} onClick={() => eliminar(d)} aria-label={`Eliminar ${d.reason}`}><FaTrash size={11} /></button>
                </div>
              ))}
            </div>
          )}
          {pasados.length > 0 && (
            <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} style={{ marginTop: '12px' }} onClick={() => setVerPasados(!verPasados)}>
              {verPasados ? 'Ocultar días pasados' : `Ver días pasados (${pasados.length})`}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
