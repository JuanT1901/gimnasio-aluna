'use server'

import { createClient } from 'app/utils/supabase/server'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function crearCircular(datos: { title: string, pdf_url: string, type: string, grade_id: number | null }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('circulars')
    .insert({
      title: datos.title,
      pdf_url: datos.pdf_url,
      type: datos.type,
      grade_id: datos.grade_id
    })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function eliminarCircular(id: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const supabase = await createClient()
  const { error } = await supabase
    .from('circulars')
    .delete()
    .eq('id', id)

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
