'use server'

import { createClient } from 'app/utils/supabase/server'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function guardarSugerenciasPreescolar(registros: { course_name: string, dimension: string, period: number, suggestion_text: string }[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('preschool_suggestions')
    .upsert(registros, { onConflict: 'course_name, dimension, period' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
