'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

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
