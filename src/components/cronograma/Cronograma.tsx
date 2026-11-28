'use client'

// Cuadrícula del cronograma: un recuadro por mes con su imagen, su título y la lista de festivos y actividades.
// La misma vista la usan la rectora (con botones para editar), los profesores y los estudiantes.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { FaChevronLeft, FaChevronRight, FaSpinner } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import h from 'app/styles/pages/Horario.module.scss'
import s from 'app/styles/pages/Cronograma.module.scss'
import type { DiaSinClase } from 'app/utils/horario/comun'
import {
  type CursoCronograma, type DatosCronograma, type MesCronograma,
  COLORES, ETIQUETA_TIPO, NOMBRES_MES, aQuienAplica, itemsDelMes, textoFecha,
} from 'app/utils/cronograma/comun'
import { obtenerCronograma } from 'app/utils/cronograma/actions'

const color = (i: number) => COLORES[i % COLORES.length]

export function SelectorAnio({ anio, onAnio }: { anio: number, onAnio: (a: number) => void }) {
  return (
    <div className={s.yearNav}>
      <button type="button" onClick={() => onAnio(anio - 1)} aria-label="Año anterior"><FaChevronLeft size={12} /></button>
      <strong>{anio}</strong>
      <button type="button" onClick={() => onAnio(anio + 1)} aria-label="Año siguiente"><FaChevronRight size={12} /></button>
    </div>
  )
}

export function ItemCronograma({ item, indice, cursos, acciones }: { item: DiaSinClase, indice: number, cursos: CursoCronograma[], acciones?: ReactNode }) {
  const c = color(indice)
  const quien = item.kind === 'festivo' ? [] : aQuienAplica(item, cursos)
  return (
    <li className={s.item} style={{ '--color': c.fuerte, '--suave': c.suave } as CSSProperties}>
      <span className={s.date}>{textoFecha(item.startDate, item.endDate)}</span>
      <span className={s.itemText}>
        {item.reason}
        <span className={s.tags}>
          <span className={`${s.tag} ${s.tagKind}`}>{ETIQUETA_TIPO[item.kind]}</span>
          {quien.map(q => <span key={q} className={s.tag}>{q}</span>)}
          {item.kind === 'extracurricular' && !item.noClass && <span className={`${s.tag} ${s.tagClass}`}>Hay clases</span>}
        </span>
      </span>
      {acciones ? <span className={s.itemActions}>{acciones}</span> : <span />}
    </li>
  )
}

export function PortadaMes({ mes, anio, children }: { mes: MesCronograma, anio: number, children?: ReactNode }) {
  const c = color(mes.mes - 1)
  return (
    <div className={s.cover}>
      {mes.imagenUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={mes.imagenUrl} alt={`Imagen de ${NOMBRES_MES[mes.mes - 1]} ${anio}`} />
        : <div className={s.coverEmpty} style={{ background: `linear-gradient(135deg, ${c.fuerte}, ${c.fuerte}cc)` }}>{NOMBRES_MES[mes.mes - 1]}</div>}
      {children}
    </div>
  )
}

const esMesActual = (anio: number, mes: number) => {
  const hoy = new Date()
  return hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes
}

// Cuadrícula de solo lectura
export function CuadriculaCronograma({ datos }: { datos: DatosCronograma }) {
  return (
    <div className={s.grid}>
      {datos.meses.map(m => {
        const items = itemsDelMes(datos.items, datos.anio, m.mes)
        return (
          <section key={m.mes} className={`${s.month} ${esMesActual(datos.anio, m.mes) ? s.monthNow : ''}`}>
            <PortadaMes mes={m} anio={datos.anio} />
            <div className={s.body}>
              <div>
                {m.titulo && <span className={s.monthName}>{NOMBRES_MES[m.mes - 1]} {datos.anio}</span>}
                <h3 className={s.title}>{m.titulo ?? `${NOMBRES_MES[m.mes - 1]} ${datos.anio}`}</h3>
              </div>
              {items.length
                ? <ul className={s.items}>{items.map((it, i) => <ItemCronograma key={`${it.id}-${it.startDate}`} item={it} indice={i} cursos={datos.cursos} />)}</ul>
                : <p className={s.none}>Sin festivos ni actividades.</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// Página completa de solo lectura (profesores y estudiantes)
export function VistaCronograma() {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [datos, setDatos] = useState<DatosCronograma | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    obtenerCronograma(anio).then(r => {
      if (!vigente) return
      if (r.exito) { setDatos(r.datos!); setError(null) } else setError(r.error ?? 'No se pudo cargar el cronograma.')
    })
    return () => { vigente = false }
  }, [anio])

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1>Cronograma</h1>
          <p>Festivos, días sin clase y actividades extracurriculares del año.</p>
        </div>
        <SelectorAnio anio={anio} onAnio={a => { setDatos(null); setAnio(a) }} />
      </header>
      {error ? <div className={h.errorBox}>{error}</div>
        : !datos ? <div style={{ textAlign: 'center', marginTop: '80px' }}><FaSpinner className="fa-spin" size={40} color="#3CA0E8" /></div>
          : <CuadriculaCronograma datos={datos} />}
    </main>
  )
}
