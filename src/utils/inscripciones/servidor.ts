// Funciones de inscripciones que solo se ejecutan en el servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { esCorreo, soloDigitos } from 'app/utils/certificados/servidor'
import { CAMPOS, TIPOS_DOCUMENTO, type DatosFicha } from './comun'

export const claveDocumento = (doc: string) => soloDigitos(doc).toUpperCase()

const MAX_TEXTO = 200

// Deja cada valor de la ficha limpio y del tipo correcto. Lo que no es válido queda vacío ('').
export function limpiarFicha(entrada: Record<string, unknown>): { datos: DatosFicha, error?: string } {
  const datos: DatosFicha = {}
  for (const c of CAMPOS) {
    const crudo = entrada[c.key]
    let v = typeof crudo === 'string' ? crudo.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXTO) : typeof crudo === 'number' ? String(crudo) : ''

    if (v && c.tipo === 'email') {
      v = v.toLowerCase()
      if (!esCorreo(v)) return { datos, error: `El correo «${v}» no es válido.` }
    }
    if (v && c.tipo === 'tel') {
      v = v.replace(/[^0-9+]/g, '').slice(0, 15)
      if (v.replace(/\D/g, '').length < 7) return { datos, error: `Revisa el número «${crudo}»: debe tener al menos 7 dígitos.` }
    }
    if (v && c.tipo === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = ''
    if (v && c.tipo === 'number') {
      const n = Number(v)
      v = Number.isInteger(n) && n >= 0 && n <= 20 ? String(n) : ''
    }
    if (v && (c.tipo === 'select' || c.tipo === 'sino') && c.opciones && !c.opciones.includes(v)) v = ''
    datos[c.key] = v
  }
  return { datos }
}

export const tipoDocumentoValido = (t: string) => TIPOS_DOCUMENTO.some(([codigo]) => codigo === t)

// Pasa la ficha a columnas de la tabla: los vacíos se guardan como null y los números como número
export function aColumnas(d: DatosFicha) {
  const filas: Record<string, string | number | null> = {}
  for (const c of CAMPOS) {
    const v = d[c.key] ?? ''
    filas[c.key] = v === '' ? null : c.tipo === 'number' ? Number(v) : v
  }
  return filas
}

// Valores guardados en la base → ficha de texto para el formulario
export function aFicha(fila: Record<string, unknown>): DatosFicha {
  const d: DatosFicha = {}
  for (const c of CAMPOS) {
    const v = fila[c.key]
    d[c.key] = v === null || v === undefined ? '' : String(v)
  }
  return d
}

export const estaVacio = (v: unknown) => v === null || v === undefined || String(v).trim() === ''

// Cursos que se ofrecen en el formulario: los que tienen grado oficial, en orden
export async function cursosConGrado(admin: SupabaseClient) {
  const { data } = await admin.from('grades').select('id, name, official_grade, order_index').order('order_index', { ascending: true })
  return (data || []).map(g => ({ id: g.id as number, name: g.name as string, officialGrade: (g.official_grade as string | null) ?? null }))
}
