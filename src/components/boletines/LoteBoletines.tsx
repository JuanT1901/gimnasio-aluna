'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FaSpinner, FaPrint, FaExclamationTriangle } from 'react-icons/fa'
import { useFormatoPapel } from 'app/hooks/useFormatoPapel'

// Opciones que cada plantilla de boletín recibe cuando se imprime dentro de un lote
export type OpcionesLote = {
  formatoPapel: string
  // sinNotas: el estudiante no tiene ninguna calificación académica en el periodo
  onListo: (sinNotas: boolean) => void
}

type Props = {
  curso: string
  periodo: string
  cursosValidos: string[]
  nombreNivel: string
  renderBoletin: (estudianteId: string, lote: OpcionesLote) => ReactNode
}

/**
 * Imprime todos los boletines de un curso en un solo documento (solo rectoría).
 * Cada boletín carga sus propios datos; el botón se habilita cuando todos terminaron.
 * Los boletines sin calificaciones no se imprimen, salvo que se marque la casilla.
 */
export default function LoteBoletines({ curso, periodo, cursosValidos, nombreNivel, renderBoletin }: Props) {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [estado, setEstado] = useState<'cargando' | 'sinPermiso' | 'cursoInvalido' | 'listo'>('cargando')
  const [estudiantes, setEstudiantes] = useState<{ id: string, full_name: string }[]>([])
  // id del estudiante → true si su boletín no tiene calificaciones
  const [listos, setListos] = useState<Record<string, boolean>>({})
  const [formatoPapel, setFormatoPapel] = useFormatoPapel()
  const [incluirVacios, setIncluirVacios] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (perfil?.role !== 'admin') { setEstado('sinPermiso'); return }

      if (!cursosValidos.includes(curso)) { setEstado('cursoInvalido'); return }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        .eq('course_name', curso)
        .order('full_name')

      setEstudiantes(data || [])
      setEstado('listo')
    }
    cargar()
  }, [curso, cursosValidos, supabase])

  const marcarListo = (id: string, sinNotas: boolean) => {
    setListos(prev => (prev[id] === sinNotas ? prev : { ...prev, [id]: sinNotas }))
  }

  if (estado === 'cargando') {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>
  }

  if (estado === 'sinPermiso') {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#ef4444', fontSize: '3rem' }}>403</h1>
        <h2>Acceso Denegado</h2>
        <p style={{ color: '#64748b' }}>Solo rectoría puede imprimir los boletines de un curso completo.</p>
      </div>
    )
  }

  if (estado === 'cursoInvalido') {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#ef4444', fontSize: '3rem' }}>404</h1>
        <p style={{ color: '#64748b' }}>El curso {curso} no corresponde a {nombreNivel}.</p>
      </div>
    )
  }

  const total = estudiantes.length
  const cargados = Object.keys(listos).length
  const todosListos = cargados >= total
  const sinNotas = estudiantes.filter(e => listos[e.id] === true)
  const seImprime = (id: string) => incluirVacios || listos[id] !== true
  const aImprimir = estudiantes.filter(e => seImprime(e.id)).length
  const puedeImprimir = todosListos && aImprimir > 0

  return (
    <div className="print-wrapper" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 0' }}>
      {/* Salto de página ANTES de cada boletín visible que no sea el primero:
          así los boletines ocultos no dejan hojas en blanco al final */}
      <style dangerouslySetInnerHTML={{ __html: `
        .boletin-lote.oculto { display: none !important; }
        .boletin-lote.visible ~ .boletin-lote.visible { break-before: page; page-break-before: always; }
        @media print { .lote-barra { display: none !important; } }
      ` }} />

      <div className="lote-barra" style={{ maxWidth: '900px', margin: '0 auto 20px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#1e293b' }}>
            <strong>{curso}</strong> · Periodo {periodo} · {total} estudiante{total !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <strong style={{ color: '#475569', fontSize: '0.9rem' }}>Formato:</strong>
            <select
              value={formatoPapel}
              onChange={(e) => setFormatoPapel(e.target.value)}
              style={{ border: 'none', fontWeight: 'bold', color: '#1e293b', outline: 'none', cursor: 'pointer', background: 'transparent' }}
            >
              <option value="letter">Tamaño Carta</option>
              <option value="legal">Tamaño Oficio</option>
              <option value="A4">Tamaño A4</option>
            </select>
          </div>
          <span style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '260px', lineHeight: 1.3 }}>En el cuadro de impresión elija el mismo tamaño de papel (en &quot;Más opciones&quot;).</span>
          <button
            onClick={() => window.print()}
            disabled={!puedeImprimir}
            style={{ backgroundColor: puedeImprimir ? '#3b82f6' : '#94a3b8', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: puedeImprimir ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {todosListos
              ? <><FaPrint /> Imprimir todos ({aImprimir})</>
              : <><FaSpinner className="fa-spin" /> Cargando boletines… {cargados} de {total}</>}
          </button>
        </div>

        {todosListos && sinNotas.length > 0 && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', color: '#92400e', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '6px' }}>
              <FaExclamationTriangle /> {sinNotas.length} estudiante{sinNotas.length !== 1 ? 's' : ''} sin calificaciones en este periodo
              {incluirVacios ? '' : ' (no se imprimen)'}:
            </div>
            <div style={{ marginBottom: '8px' }}>{sinNotas.map(e => e.full_name).join(', ')}</div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={incluirVacios} onChange={(e) => setIncluirVacios(e.target.checked)} />
              Incluirlos de todas formas
            </label>
          </div>
        )}
      </div>

      {total === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>Este curso no tiene estudiantes registrados.</p>
      ) : (
        <div>
          {estudiantes.map(est => (
            <div key={est.id} className={`boletin-lote ${seImprime(est.id) ? 'visible' : 'oculto'}`}>
              {renderBoletin(est.id, { formatoPapel, onListo: (vacio) => marcarListo(est.id, vacio) })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
