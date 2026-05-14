'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function arreglarContrasenasProfesores() {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, mensaje: authError }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let arreglados = 0;
  let errores = 0;

  try {
    const { data: profesores, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, doc_number')
      .eq('role', 'teacher');

    if (fetchError || !profesores) throw new Error('No se pudieron obtener los profesores');

    for (const profe of profesores) {
      if (!profe.doc_number) continue;

      const docLimpio = String(profe.doc_number).replace(/[\.\,\s]/g, '');
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        profe.id,
        { password: docLimpio }
      );

      if (authError) {
        errores++;
        continue;
      }

      await supabaseAdmin
        .from('profiles')
        .update({ doc_number: docLimpio })
        .eq('id', profe.id);

      arreglados++;
    }

    return { exito: true, arreglados, errores };
  } catch (error: any) {
    return { exito: false, mensaje: error.message };
  }
}