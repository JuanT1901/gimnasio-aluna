'use server'

import { createClient } from 'app/utils/supabase/server'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function actualizarDirectorCurso(cursoId: string, directorId: string | null) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('grades')
    .update({ director_id: directorId })
    .eq('id', cursoId)

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
