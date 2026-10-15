'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'
import { hoyISO } from 'app/utils/horario/comun'
import { anioActivo } from 'app/utils/certificados/servidor'

export async function obtenerEmailAuth(userId: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError, email: null }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return { exito: false, error: error.message, email: null }
    return { exito: true, email: data.user.email }
  } catch (error: any) {
    return { exito: false, error: error.message, email: null }
  }
}

export async function actualizarCredencialesEstudiante(userId: string, datos: { email?: string, password?: string }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const updateData: Record<string, string> = {}
  if (datos.email) updateData.email = datos.email
  if (datos.password) {
    if (datos.password.length < 8) return { exito: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
    updateData.password = datos.password
  }

  if (Object.keys(updateData).length === 0) {
    return { exito: false, error: 'No se proporcionaron datos para actualizar.' }
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData)
    if (error) return { exito: false, error: error.message }
    return { exito: true }
  } catch (error: any) {
    return { exito: false, error: error.message }
  }
}

export async function actualizarEstudiante(id: string, datos: any) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const camposPermitidos = [
    'full_name', 'doc_type', 'doc_number', 'course_name', 'grade_id',
    'birth_date', 'city', 'neighborhood', 'address', 'doc_expedition_city',
    'eps', 'blood_type', 'siblings_count',
    'mother_name', 'mother_doc', 'mother_profession', 'mother_cellphone',
    'mother_phone', 'mother_email', 'mother_lives_with_student',
    'father_name', 'father_doc', 'father_profession', 'father_cellphone',
    'father_phone', 'father_email', 'father_lives_with_student',
    'guardian_name', 'guardian_cellphone', 'reference_name', 'reference_cellphone',
    'extra_shift', 'school_bus', 'bus_address',
    'needs_sweatshirt', 'sweatshirt_size', 'needs_tshirt', 'tshirt_size'
  ];

  const datosLimpios: Record<string, any> = {};
  for (const campo of camposPermitidos) {
    if (campo in datos) {
      datosLimpios[campo] = datos[campo];
    }
  }

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update(datosLimpios)
      .eq('id', id)
      .eq('role', 'student')

    if (error) return { exito: false, error: error.message }
    return { exito: true }
  } catch (error: any) {
    return { exito: false, error: error.message }
  }
}

// Retiro durante el año: el estudiante deja de estar activo y queda en Exalumnos con el motivo
export async function retirarEstudiante(id: string, motivo: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const razon = motivo.trim().slice(0, 500)
  if (!razon) return { exito: false, error: 'Escribe el motivo del retiro.' }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: p } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name, doc_type, doc_number, birth_date, grade_id, course_name, official_grade, student_status, mother_email, father_email')
    .eq('id', id)
    .maybeSingle()
  if (!p || p.role !== 'student') return { exito: false, error: 'Estudiante no encontrado.' }
  if (p.student_status === 'alumni') return { exito: false, error: 'Este estudiante ya está en Exalumnos.' }

  const { data: curso } = p.grade_id
    ? await supabaseAdmin.from('grades').select('official_grade').eq('id', p.grade_id).maybeSingle()
    : { data: null }
  const anio = await anioActivo(supabaseAdmin)

  const { error } = await supabaseAdmin.from('alumni').insert({
    profile_id: p.id, full_name: p.full_name, doc_type: p.doc_type, doc_number: p.doc_number, birth_date: p.birth_date,
    last_grade: p.official_grade || curso?.official_grade || null, last_course: p.course_name, exit_year: anio,
    reason: razon, email: p.mother_email || p.father_email || null, exit_kind: 'withdrawn', exit_date: hoyISO(),
  })
  if (error) return { exito: false, error: error.message }

  const { error: e } = await supabaseAdmin.from('profiles')
    .update({ student_status: 'alumni', alumni_since: anio, grade_id: null, course_name: null })
    .eq('id', p.id)
  if (e) return { exito: false, error: `Quedó en Exalumnos, pero no se pudo quitar de los activos: ${e.message}` }
  return { exito: true }
}
