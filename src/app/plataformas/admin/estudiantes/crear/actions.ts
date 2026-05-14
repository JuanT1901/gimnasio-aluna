'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function crearEstudianteIndividual(datos: any) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let email = datos.username.toLowerCase().trim();
  if (!email.includes('@')) {
    email = `${email}@aluna.edu.co`;
  }

  const password = datos.doc_number;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    });

    if (authError) return { exito: false, error: authError.message };

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        role: 'student',
        course_name: datos.course_name,
        full_name: datos.full_name,
        birth_date: datos.birth_date,
        city: datos.city,
        neighborhood: datos.neighborhood,
        address: datos.address,
        doc_type: datos.doc_type,
        doc_number: datos.doc_number,
        doc_expedition_city: datos.doc_expedition_city,
        eps: datos.eps,
        blood_type: datos.blood_type,
        siblings_count: datos.siblings_count,
        
        // Datos Madre
        mother_name: datos.mother_name,
        mother_doc: datos.mother_doc,
        mother_profession: datos.mother_profession,
        mother_cellphone: datos.mother_cellphone,
        mother_phone: datos.mother_phone,
        mother_email: datos.mother_email,
        mother_lives_with_student: datos.mother_lives_with_student,
        
        // Datos Padre
        father_name: datos.father_name,
        father_doc: datos.father_doc,
        father_profession: datos.father_profession,
        father_cellphone: datos.father_cellphone,
        father_phone: datos.father_phone,
        father_email: datos.father_email,
        father_lives_with_student: datos.father_lives_with_student,
        
        // Acudiente y Referencia
        guardian_name: datos.guardian_name,
        guardian_cellphone: datos.guardian_cellphone,
        reference_name: datos.reference_name,
        reference_cellphone: datos.reference_cellphone,
        
        // Información Adicional
        extra_shift: datos.extra_shift,
        school_bus: datos.school_bus,
        bus_address: datos.bus_address,
        needs_sweatshirt: datos.needs_sweatshirt,
        sweatshirt_size: datos.sweatshirt_size,
        needs_tshirt: datos.needs_tshirt,
        tshirt_size: datos.tshirt_size
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { exito: false, error: profileError.message };
    }

    return { exito: true };
  } catch (error: any) {
    return { exito: false, error: error.message };
  }
}