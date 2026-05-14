import { createClient } from './server'

export async function verificarRol(rolRequerido: string) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    return { autorizado: false, error: 'No autenticado' }
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (perfil?.role !== rolRequerido) {
    return { autorizado: false, error: 'No autorizado' }
  }

  return { autorizado: true, userId: user.id }
}
