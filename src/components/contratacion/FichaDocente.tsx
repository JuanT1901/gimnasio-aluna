'use client'

// Campos del registro de docentes. Los usan el formulario público y la revisión de la rectora.
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { SECCIONES_DOCENTE, type FichaDocente as Ficha } from 'app/utils/contratacion/comun'

export default function FichaDocente({ ficha, onFicha, soloLectura = false }: { ficha: Ficha, onFicha?: (f: Ficha) => void, soloLectura?: boolean }) {
  const cambiar = (k: string, v: string) => onFicha?.({ ...ficha, [k]: v })

  return (
    <>
      {SECCIONES_DOCENTE.map(s => (
        <section key={s.id} className={c.panel}>
          <h3>{s.titulo}</h3>
          <div className={c.formGrid}>
            {s.campos.map(campo => {
              const valor = ficha[campo.clave] ?? ''
              const etiqueta = <>{campo.etiqueta}{campo.obligatorio && !soloLectura ? ' *' : ''}</>
              const clase = `${h.field} ${campo.ancho === 'completo' || campo.tipo === 'textarea' ? c.full : ''}`
              return (
                <label key={campo.clave} className={clase}>
                  {etiqueta}
                  {campo.tipo === 'select' ? (
                    <select className={h.select} value={valor} disabled={soloLectura} onChange={e => cambiar(campo.clave, e.target.value)}>
                      <option value="">— Selecciona —</option>
                      {campo.opciones!.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                    </select>
                  ) : campo.tipo === 'textarea' ? (
                    <textarea className={h.input} rows={4} value={valor} readOnly={soloLectura} maxLength={campo.max} onChange={e => cambiar(campo.clave, e.target.value)} />
                  ) : (
                    <input className={h.input} type={campo.tipo} value={valor} readOnly={soloLectura} onChange={e => cambiar(campo.clave, e.target.value)}
                      inputMode={campo.clave === 'doc_number' || campo.tipo === 'tel' ? 'numeric' : undefined} />
                  )}
                  {campo.ayuda && !soloLectura && <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{campo.ayuda}</small>}
                </label>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
