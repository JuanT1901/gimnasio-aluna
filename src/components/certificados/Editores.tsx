'use client'

// Formularios para corregir los datos y las notas de un certificado.
// Los usan el detalle de una solicitud y la sección de certificados de prueba.
import type { ReactNode } from 'react'
import { FaPlus, FaTrash } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import {
  type CamposCertificado, type FilaNotas, type FormatoNotas, type TipoCertificado,
  CONDUCTAS, GRADOS_OFICIALES, NIVELES, definitiva, nivelDeGrado, tieneAnio,
} from 'app/utils/certificados/comun'

const DOCUMENTOS = ['Tarjeta de Identidad', 'Registro Civil', 'Cédula de Ciudadanía', 'Cédula de Extranjería', 'Pasaporte', 'NUIP']

export function EditorCampos({ tipo, campos, onCampos, formato, onFormato, avisoCostos }: {
  tipo: TipoCertificado
  campos: CamposCertificado
  onCampos: (c: CamposCertificado) => void
  formato: FormatoNotas
  onFormato: (f: FormatoNotas) => void
  avisoCostos?: ReactNode // texto bajo matrícula y pensión (certificado de estudio)
}) {
  const cambiar = (k: keyof CamposCertificado, v: string) => {
    const numerico = k === 'anio' || k === 'matricula' || k === 'pension'
    const siguiente = { ...campos, [k]: numerico ? (v ? Number(v) : null) : v }
    if (k === 'grado' && v) siguiente.nivel = nivelDeGrado(v) || campos.nivel
    onCampos(siguiente)
  }

  return (
    <div className={c.formGrid}>
      <label className={`${h.field} ${c.full}`}>Nombre del estudiante<input className={h.input} value={campos.nombre} onChange={e => cambiar('nombre', e.target.value)} /></label>
      <label className={h.field}>Tipo de documento<select className={h.select} value={campos.tipoDocumento} onChange={e => cambiar('tipoDocumento', e.target.value)}>
        {[...new Set([campos.tipoDocumento, ...DOCUMENTOS])].filter(Boolean).map(t => <option key={t}>{t}</option>)}</select></label>
      <label className={h.field}>Número<input className={h.input} value={campos.numeroDocumento} onChange={e => cambiar('numeroDocumento', e.target.value)} /></label>
      <label className={h.field}>Expedido en<input className={h.input} value={campos.ciudadDocumento} onChange={e => cambiar('ciudadDocumento', e.target.value)} placeholder="Ej: Zipaquirá" /></label>
      <label className={h.field}>Fecha de expedición<input className={h.input} type="date" value={campos.fecha} onChange={e => cambiar('fecha', e.target.value)} /></label>
      <label className={h.field}>Grado<select className={h.select} value={campos.grado} onChange={e => cambiar('grado', e.target.value)}>
        <option value="">— Selecciona —</option>{GRADOS_OFICIALES.map(g => <option key={g}>{g}</option>)}</select></label>
      <label className={h.field}>Nivel<select className={h.select} value={campos.nivel} onChange={e => cambiar('nivel', e.target.value)}>
        <option value="">— Selecciona —</option>{[...new Set([campos.nivel, ...NIVELES])].filter(Boolean).map(n => <option key={n}>{n}</option>)}</select></label>
      {tipo === 'estudio' && (
        <>
          <label className={h.field}>Matrícula (COP)<input className={h.input} type="number" min={0} step={1000} value={campos.matricula ?? ''} onChange={e => cambiar('matricula', e.target.value)} placeholder="Sin valor" /></label>
          <label className={h.field}>Pensión mensual (COP)<input className={h.input} type="number" min={0} step={1000} value={campos.pension ?? ''} onChange={e => cambiar('pension', e.target.value)} placeholder="Sin valor" /></label>
          <span className={`${c.hint} ${c.full}`}>{avisoCostos} Si los dejas vacíos, no aparecen en el certificado.</span>
        </>
      )}
      {tipo === 'conducta' && (
        <div className={`${h.field} ${c.full}`}>
          Conducta
          <div className={c.radioRow}>
            {CONDUCTAS.map(x => (
              <label key={x} className={campos.conducta === x ? c.radioOn : ''}>
                <input type="radio" name="conducta" checked={campos.conducta === x} onChange={() => cambiar('conducta', x)} /> {x} conducta
              </label>
            ))}
          </div>
        </div>
      )}
      {tieneAnio(tipo) && (
        <label className={h.field}>Año lectivo<input className={h.input} type="number" value={campos.anio ?? ''} onChange={e => cambiar('anio', e.target.value)} /></label>
      )}
      {tipo === 'notas' && (
        <label className={h.field}>Formato de notas<select className={h.select} value={formato} onChange={e => onFormato(e.target.value as FormatoNotas)}>
          <option value="preescolar">Preescolar</option><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select></label>
      )}
    </div>
  )
}

export function EditorNotas({ notas, formato, onNotas }: { notas: FilaNotas[], formato: FormatoNotas, onNotas: (n: FilaNotas[]) => void }) {
  const cambiarNota = (i: number, k: 'area' | 'subject' | 0 | 1 | 2, v: string) => {
    onNotas(notas.map((f, j) => {
      if (j !== i) return f
      if (typeof k === 'number') {
        const p = [...f.p]
        const n = parseFloat(v.replace(',', '.'))
        p[k] = v === '' || isNaN(n) ? null : Math.min(5, Math.max(0, n))
        return { ...f, p, def: definitiva(p) }
      }
      return { ...f, [k]: v }
    }))
  }

  return (
    <>
      <div className={c.tableWrap}>
        <table className={c.notesGrid}>
          <thead><tr>{formato !== 'preescolar' && <th>Área</th>}<th>Asignatura</th><th>1P</th><th>2P</th><th>3P</th><th>DEF</th><th /></tr></thead>
          <tbody>
            {notas.map((f, i) => (
              <tr key={i}>
                {formato !== 'preescolar' && <td><input value={f.area} onChange={e => cambiarNota(i, 'area', e.target.value)} aria-label="Área" /></td>}
                <td><input value={f.subject} onChange={e => cambiarNota(i, 'subject', e.target.value)} aria-label="Asignatura" /></td>
                {[0, 1, 2].map(p => (
                  <td key={p} className={c.num}><input inputMode="decimal" value={f.p[p] ?? ''} onChange={e => cambiarNota(i, p as 0 | 1 | 2, e.target.value)} aria-label={`Periodo ${p + 1}`} /></td>
                ))}
                <td className={c.def}>{typeof f.def === 'number' ? f.def.toFixed(1) : ''}</td>
                <td><button type="button" className={h.iconBtn} onClick={() => onNotas(notas.filter((_, j) => j !== i))} aria-label="Quitar fila"><FaTrash size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} style={{ alignSelf: 'flex-start' }}
        onClick={() => onNotas([...notas, { area: notas[notas.length - 1]?.area ?? '', subject: '', p: [null, null, null], def: null }])}>
        <FaPlus size={10} /> Agregar fila
      </button>
    </>
  )
}
