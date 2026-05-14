'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function renombrarMateria(subjectId: number, nuevoNombre: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const nombre = nuevoNombre.trim()
  if (!nombre) return { exito: false, error: 'El nombre no puede estar vacío.' }

  const supabase = getAdmin()

  const { data: materia } = await supabase
    .from('subjects')
    .select('grade_id, name')
    .eq('id', subjectId)
    .single()

  if (!materia) return { exito: false, error: 'Materia no encontrada.' }

  const nombreAnterior = materia.name

  const { error } = await supabase
    .from('subjects')
    .update({ name: nombre })
    .eq('id', subjectId)

  if (error) return { exito: false, error: error.message }

  await supabase
    .from('teacher_assignments')
    .update({ subject_name: nombre })
    .eq('subject_name', nombreAnterior)
    .eq('grade_id', materia.grade_id)

  return { exito: true }
}

export async function crearMateria(gradeId: number, nombre: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const nombreLimpio = nombre.trim()
  if (!nombreLimpio) return { exito: false, error: 'El nombre no puede estar vacío.' }

  const supabase = getAdmin()

  const { data, error } = await supabase
    .from('subjects')
    .insert({ name: nombreLimpio, grade_id: gradeId })
    .select()

  if (error) return { exito: false, error: error.message }
  return { exito: true, data: data?.[0] || null }
}

export async function eliminarMateria(subjectId: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = getAdmin()

  const { data: asignaciones } = await supabase
    .from('teacher_assignments')
    .select('id')
    .eq('subject_id', subjectId)

  if (asignaciones && asignaciones.length > 0) {
    return { exito: false, error: `Esta materia tiene ${asignaciones.length} asignación(es) activa(s). Elimina las asignaciones primero.` }
  }

  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', subjectId)

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
