'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function crearProfesorIndividual(datos: any) {
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
        role: 'teacher',
        full_name: datos.full_name,
        doc_type: datos.doc_type,
        doc_number: datos.doc_number,
        phone_number: datos.phone,
        email: datos.email || null,
        birth_date: datos.birth_date || null,
        address: datos.address || null,
        compensation_fund: datos.compensation_fund || null,
        eps: datos.eps || null,
        arl: datos.arl || null,
        pension_fund: datos.pension_fund || null
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