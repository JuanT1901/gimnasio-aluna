// Contratación de docentes: utilidades del servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { CAMPOS_DOCENTE, TIPOS_DOCUMENTO_DOCENTE, type ClasePlaneada, type FichaDocente, type Postulacion } from './comun'

export const TABLA = 'teacher_applications'

// Deja solo los campos del formulario, recortados
export function limpiarFichaDocente(entrada: Record<string, unknown>): FichaDocente {
  const d: FichaDocente = {}
  for (const c of CAMPOS_DOCENTE) {
    let v = String(entrada?.[c.clave] ?? '').trim().slice(0, c.max ?? 200)
    if (c.tipo !== 'textarea') v = v.replace(/\s+/g, ' ')
    if (c.clave === 'email') v = v.toLowerCase()
    if (c.clave === 'doc_type' && !TIPOS_DOCUMENTO_DOCENTE.some(([k]) => k === v)) v = 'CC'
    if (c.tipo === 'date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = ''
    d[c.clave] = v
  }
  return d
}

// Columnas de la tabla (vacíos como null)
export const aColumnasDocente = (d: FichaDocente) =>
  Object.fromEntries(CAMPOS_DOCENTE.map(c => [c.clave, d[c.clave]?.trim() ? d[c.clave].trim() : null]))

export function aPostulacion(f: Record<string, unknown>): Postulacion {
  const ficha: FichaDocente = {}
  for (const c of CAMPOS_DOCENTE) ficha[c.clave] = f[c.clave] == null ? '' : String(f[c.clave])
  return {
    id: Number(f.id),
    status: (f.status as Postulacion['status']) ?? 'pending',
    ficha,
    clases: Array.isArray(f.planned_classes) ? (f.planned_classes as ClasePlaneada[]) : [],
    direccion: Array.isArray(f.director_grade_ids) ? (f.director_grade_ids as unknown[]).map(Number) : [],
    username: (f.username as string) ?? null,
    hiredProfileId: (f.hired_profile_id as string) ?? null,
    hiredAt: (f.hired_at as string) ?? null,
    adminNotes: (f.admin_notes as string) ?? null,
    createdAt: String(f.created_at ?? ''),
    nueva: f.admin_seen_at == null,
  }
}

// Enlace del formulario: se guarda en la configuración del colegio; si no existe se crea
export async function tokenFormulario(admin: SupabaseClient, crearSiFalta = false) {
  const { data } = await admin.from('school_settings').select('teacher_form_token').eq('id', 1).maybeSingle()
  if (data?.teacher_form_token || !crearSiFalta) return (data?.teacher_form_token as string) ?? null
  return nuevoToken(admin)
}

export async function nuevoToken(admin: SupabaseClient) {
  const { randomBytes } = await import('crypto')
  const token = randomBytes(12).toString('base64url')
  const { error } = await admin.from('school_settings').update({ teacher_form_token: token, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw new Error(error.message)
  return token
}
