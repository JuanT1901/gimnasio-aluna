'use client'

import { FaCheckCircle } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import i from 'app/styles/pages/Inscripciones.module.scss'
import { SECCIONES, type Campo, type DatosFicha } from 'app/utils/inscripciones/comun'

function Entrada({ campo, valor, onCambiar }: { campo: Campo, valor: string, onCambiar: (v: string) => void }) {
  if (campo.tipo === 'sino') {
    return (
      <div className={c.radioRow} role="radiogroup" aria-label={campo.label}>
        {campo.opciones!.map(op => (
          <label key={op} className={valor === op ? c.radioOn : ''}>
            <input type="radio" name={campo.key} checked={valor === op} onChange={() => onCambiar(op)} /> {op}
          </label>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'select') {
    return (
      <select className={h.select} value={valor} onChange={e => onCambiar(e.target.value)}>
        <option value="">— Seleccionar —</option>
        {campo.opciones!.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    )
  }
  const tipo = campo.tipo === 'number' ? 'number' : campo.tipo === 'text' ? 'text' : campo.tipo
  return (
    <>
      <input
        className={h.input}
        type={tipo}
        value={valor}
        onChange={e => onCambiar(e.target.value)}
        inputMode={campo.tipo === 'tel' ? 'tel' : campo.tipo === 'number' ? 'numeric' : undefined}
        autoComplete={campo.tipo === 'email' ? 'email' : campo.tipo === 'tel' ? 'tel' : undefined}
        min={campo.tipo === 'number' ? 0 : undefined}
        max={campo.tipo === 'number' ? 20 : undefined}
        placeholder={campo.tipo === 'tel' ? 'Ej: 3001234567' : undefined}
        list={campo.sugerencias ? `lista-${campo.key}` : undefined}
      />
      {campo.sugerencias && (
        <datalist id={`lista-${campo.key}`}>
          {campo.sugerencias.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
    </>
  )
}

// Dibuja todas las secciones de la ficha. Los campos de «llenos» ya los registró otra persona:
// se muestran como «Ya registrado» sin enseñar su contenido.
export default function FichaInscripcion({ ficha, onCambiar, llenos }: {
  ficha: DatosFicha, onCambiar: (f: DatosFicha) => void, llenos?: Set<string>,
}) {
  // Si la pregunta de la que depende ya la respondió otra persona, no sabemos su respuesta:
  // el campo solo se muestra (como «Ya registrado») si esa persona también lo llenó
  const visible = (campo: Campo) => !campo.si || ficha[campo.si.key] === campo.si.valor || !!llenos?.has(campo.key)

  return (
    <>
      {SECCIONES.map(seccion => {
        const campos = seccion.campos.filter(visible)
        const pendientes = campos.filter(x => !llenos?.has(x.key)).length
        return (
          <section key={seccion.id} className={c.panel}>
            <h3 className={i.sectionTitle}>
              {seccion.titulo}
              {llenos && pendientes === 0 && <span className={`${h.pill} ${h.pillPublished}`}>Completa</span>}
            </h3>
            <div className={c.formGrid}>
              {campos.map(campo => (
                <div key={campo.key} className={`${h.field} ${campo.ancho || campo.tipo === 'sino' && campo.opciones!.length > 2 ? c.full : ''}`}>
                  <span>{campo.label}</span>
                  {llenos?.has(campo.key) ? (
                    <div className={i.locked}><FaCheckCircle /> Ya registrado</div>
                  ) : (
                    <Entrada campo={campo} valor={ficha[campo.key] ?? ''} onCambiar={v => onCambiar({ ...ficha, [campo.key]: v })} />
                  )}
                  {campo.ayuda && !llenos?.has(campo.key) && <small className={i.help}>{campo.ayuda}</small>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
