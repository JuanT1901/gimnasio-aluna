'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function toggleEstadoProfesor(userId: string, nuevoEstado: boolean) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  try {
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: nuevoEstado })
      .eq('id', userId)

    if (updateError) {
      return { exito: false, error: updateError.message }
    }

    if (nuevoEstado === false) {
      const { error: deleteError } = await supabaseAdmin
        .from('teacher_assignments')
        .delete()
        .eq('teacher_id', userId)

      if (deleteError) {
        return { exito: false, error: deleteError.message }
      }
    }

    return { exito: true }
    
  } catch (err: any) {
    return { exito: false, error: err.message }
  }
}

export async function actualizarPerfilProfesor(userId: string, datos: Record<string, any>) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const camposPermitidos = [
    'full_name', 'doc_number', 'email', 'birth_date', 'address',
    'phone_number', 'compensation_fund', 'eps', 'arl', 'pension_fund'
  ];
  const datosLimpios: Record<string, any> = {};
  for (const campo of camposPermitidos) {
    if (campo in datos) datosLimpios[campo] = datos[campo];
  }

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update(datosLimpios)
      .eq('id', userId)
      .eq('role', 'teacher')

    if (error) return { exito: false, error: error.message }
    return { exito: true }
  } catch (err: any) {
    return { exito: false, error: err.message }
  }
}

export async function asignarClaseProfesor(teacherId: string, gradeId: number, courseName: string, subjectName: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError, data: null }

  try {
    const { data: existente } = await supabaseAdmin
      .from('teacher_assignments')
      .select('id, teacher_id')
      .eq('grade_id', gradeId)
      .eq('subject_name', subjectName)

    const yaTieneEsteProfe = existente?.some(a => a.teacher_id === teacherId)
    if (yaTieneEsteProfe) return { exito: false, error: 'Este profesor ya tiene asignada esta materia en este curso.', data: null }

    if (existente && existente.length > 0) {
      const { error } = await supabaseAdmin
        .from('teacher_assignments')
        .update({ teacher_id: teacherId })
        .eq('grade_id', gradeId)
        .eq('subject_name', subjectName)

      if (error) return { exito: false, error: error.message, data: null }
      return { exito: true, reasignada: true, data: null }
    }

    const { data, error } = await supabaseAdmin
      .from('teacher_assignments')
      .insert([{ teacher_id: teacherId, grade_id: gradeId, course_name: courseName, subject_name: subjectName }])
      .select()

    if (error) return { exito: false, error: error.message, data: null }
    return { exito: true, data: data?.[0] || null }
  } catch (err: any) {
    return { exito: false, error: err.message, data: null }
  }
}

export async function eliminarClaseProfesor(asignacionId: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  try {
    const { error } = await supabaseAdmin
      .from('teacher_assignments')
      .delete()
      .eq('id', asignacionId)

    if (error) return { exito: false, error: error.message }
    return { exito: true }
  } catch (err: any) {
    return { exito: false, error: err.message }
  }
}

export async function cambiarContrasenaProfesor(userId: string, nuevaClave: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  try {
    if (!nuevaClave || nuevaClave.length < 8) {
      return { exito: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: nuevaClave }
    )

    if (error) {
      return { exito: false, error: error.message }
    }

    return { exito: true }
    
  } catch (err: any) {
    return { exito: false, error: err.message }
  }
}