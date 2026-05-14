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