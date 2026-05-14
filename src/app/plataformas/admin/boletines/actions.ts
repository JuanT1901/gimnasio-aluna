'use server'

import { createClient } from 'app/utils/supabase/server'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function togglePublicacion(estudianteId: string, courseName: string, period: number, nuevoEstado: boolean) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('student_report_status')
    .upsert({
      student_id: estudianteId,
      course_name: courseName,
      period: period,
      is_published: nuevoEstado
    }, { onConflict: 'student_id, period' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function publicarTodosBoletines(estudiantes: { id: string }[], courseName: string, period: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const registros = estudiantes.map(est => ({
    student_id: est.id,
    course_name: courseName,
    period: period,
    is_published: true
  }))

  const { error } = await supabase
    .from('student_report_status')
    .upsert(registros, { onConflict: 'student_id, period' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
