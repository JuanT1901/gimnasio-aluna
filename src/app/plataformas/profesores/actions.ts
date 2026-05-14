'use server'

import { createClient } from 'app/utils/supabase/server'

async function verificarProfesorYAsignacion(curso: string, materia?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { autorizado: false, error: 'No autenticado', userId: '' }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (perfil?.role !== 'teacher' && perfil?.role !== 'admin') {
    return { autorizado: false, error: 'No autorizado', userId: '' }
  }

  if (perfil.role === 'admin') {
    return { autorizado: true, userId: user.id }
  }

  let query = supabase
    .from('teacher_assignments')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('course_name', curso)

  if (materia) {
    query = query.eq('subject_name', materia)
  }

  const { data: asignacion } = await query.maybeSingle()

  if (!asignacion) {
    return { autorizado: false, error: 'No tienes asignación para este curso/materia', userId: '' }
  }

  return { autorizado: true, userId: user.id }
}

export async function guardarEvaluacionPrimaria(datos: {
  student_id: string, course_name: string, period: number,
  subject_name: string, competencies_data: any[]
}) {
  const { autorizado, error: authError, userId } = await verificarProfesorYAsignacion(datos.course_name, datos.subject_name)
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('primary_evaluations')
    .upsert({
      student_id: datos.student_id,
      teacher_id: userId,
      course_name: datos.course_name,
      period: datos.period,
      subject_name: datos.subject_name,
      competencies_data: datos.competencies_data
    }, { onConflict: 'student_id, subject_name, period' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function guardarEvaluacionAvanzada(datos: {
  student_id: string, course_name: string, period: number,
  subject_name: string, competencies_data: any[]
}) {
  const { autorizado, error: authError, userId } = await verificarProfesorYAsignacion(datos.course_name, datos.subject_name)
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('advanced_evaluations')
    .upsert({
      student_id: datos.student_id,
      teacher_id: userId,
      course_name: datos.course_name,
      period: datos.period,
      subject_name: datos.subject_name,
      competencies_data: datos.competencies_data
    }, { onConflict: 'student_id, subject_name, period' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function guardarEvaluacionPreescolar(datos: {
  student_id: string, course_name: string, period: number,
  dimension: string, competencies_data: any[]
}) {
  const { autorizado, error: authError, userId } = await verificarProfesorYAsignacion(datos.course_name, datos.dimension)
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('preschool_evaluations')
    .upsert({
      student_id: datos.student_id,
      teacher_id: userId,
      course_name: datos.course_name,
      period: datos.period,
      dimension: datos.dimension,
      competencies_data: datos.competencies_data
    }, { onConflict: 'student_id, period, dimension' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function guardarConvivenciaAction(datos: {
  student_id: string, course_name: string, period: number,
  competencia: string, desempeno: string, score: number, scale: string
}) {
  const { autorizado, error: authError, userId } = await verificarProfesorYAsignacion(datos.course_name)
  if (!autorizado) return { exito: false, error: authError, data: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('behavior_evaluations')
    .upsert({
      student_id: datos.student_id,
      teacher_id: userId,
      course_name: datos.course_name,
      period: datos.period,
      competencia: datos.competencia,
      desempeno: datos.desempeno,
      score: datos.score,
      scale: datos.scale
    }, { onConflict: 'student_id, period' })
    .select()
    .single()

  if (error) return { exito: false, error: error.message, data: null }
  return { exito: true, data }
}

export async function eliminarConvivenciaAction(evaluacionId: string, curso: string) {
  const { autorizado, error: authError } = await verificarProfesorYAsignacion(curso)
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('behavior_evaluations')
    .delete()
    .eq('id', evaluacionId)

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
