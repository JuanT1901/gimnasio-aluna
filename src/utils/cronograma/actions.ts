'use server'

// Cronograma de solo lectura para estudiantes y profesores (la rectora lo edita en su sección)
import { getAdmin, obtenerSesion } from 'app/utils/horario/servidor'
import type { DatosCronograma } from './comun'
import { anioValido, cargarCronograma } from './servidor'

export async function obtenerCronograma(anio: number): Promise<{ exito: boolean, error?: string, datos?: DatosCronograma }> {
  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autorizado' }
  if (!anioValido(anio)) return { exito: false, error: 'Año no válido.' }
  try {
    return { exito: true, datos: await cargarCronograma(getAdmin(), anio) }
  } catch {
    return { exito: false, error: 'No se pudo cargar el cronograma.' }
  }
}
