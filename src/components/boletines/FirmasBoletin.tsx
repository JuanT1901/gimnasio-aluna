'use client'

import { useEffect, useState } from 'react'
import { obtenerFirmaRectora } from 'app/utils/boletines/actions'

type Firma = { nombre: string, cargo: string }
type FirmaRectora = Firma & { nombreCompleto: string }

const palabras = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-zñ]+/).filter(p => p.length > 1)

// "Angela Castañeda" es la misma persona que "Ángela Yohanna Castañeda Olivares":
// todas las palabras del nombre corto están en el nombre completo (al menos dos)
const mismaPersona = (nombre?: string | null, nombreCompleto?: string | null) => {
  if (!nombre || !nombreCompleto) return false
  const corto = palabras(nombre)
  const completo = new Set(palabras(nombreCompleto))
  return corto.length >= 2 && corto.every(p => completo.has(p))
}

// Una sola consulta por página, aunque se impriman todos los boletines de un curso
let firmaRectoraPromesa: Promise<FirmaRectora | null> | null = null
const cargarFirmaRectora = () => {
  if (!firmaRectoraPromesa) {
    firmaRectoraPromesa = obtenerFirmaRectora().catch(() => {
      firmaRectoraPromesa = null
      return null
    })
  }
  return firmaRectoraPromesa
}

type Props = {
  director?: { full_name?: string | null, role?: string | null } | null
}

/** Espacio de firmas al final del boletín: director(a) de grupo y rectora. */
export default function FirmasBoletin({ director }: Props) {
  const [rectora, setRectora] = useState<FirmaRectora | null>(null)

  useEffect(() => {
    let activo = true
    cargarFirmaRectora().then(f => { if (activo) setRectora(f) })
    return () => { activo = false }
  }, [])

  const cargoRectora = rectora?.cargo || 'Rectora'
  const nombreDirector = director?.full_name || 'Director(a) de Grupo'

  // Si la rectora también dirige el curso (por rol, o porque es una cuenta de docente
  // con su mismo nombre), solo su firma, con el nombre de su perfil
  const directorEsRectora = director?.role === 'admin' || mismaPersona(director?.full_name, rectora?.nombreCompleto)
  const firmas: Firma[] = directorEsRectora
    ? [{ nombre: director?.full_name || rectora?.nombre || '', cargo: cargoRectora }]
    : [
        { nombre: nombreDirector, cargo: 'Director(a) de Grupo' },
        { nombre: rectora?.nombre || '', cargo: cargoRectora },
      ]

  return (
    <footer style={{ marginTop: '80px', display: 'flex', justifyContent: 'space-around', gap: '30px', flexWrap: 'wrap', textAlign: 'center', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      {firmas.map((f, i) => (
        <div key={i} style={{ width: '250px' }}>
          <div style={{ borderTop: '1px solid #1e293b', margin: '0 auto 5px auto' }}></div>
          <strong style={{ textTransform: 'uppercase', display: 'block', minHeight: '1.2em' }}>{f.nombre}</strong>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{f.cargo}</p>
        </div>
      ))}
    </footer>
  )
}
