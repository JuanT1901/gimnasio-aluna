'use server'

import { getAdmin, obtenerSesion } from 'app/utils/horario/servidor'
import type { ArchivoMatricula, PublicacionMatricula } from 'app/utils/matricula/comun'
import { cargarPublicaciones, enlaceDescarga } from 'app/utils/matricula/servidor'

async function sesionEstudiante() {
  const sesion = await obtenerSesion()
  return sesion && sesion.role === 'student' ? sesion : null
}

// Documentos de matrícula (son para todos los estudiantes)
export async function obtenerDocumentosMatricula(): Promise<{ exito: boolean, error?: string, publicaciones?: PublicacionMatricula[] }> {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }
  try {
    return { exito: true, publicaciones: await cargarPublicaciones(getAdmin()) }
  } catch {
    return { exito: false, error: 'No se pudieron cargar los documentos.' }
  }
}

export async function descargarDocumentoMatricula(id: number, path: string) {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const admin = getAdmin()
  const { data: p } = await admin.from('enrollment_posts').select('files').eq('id', id).maybeSingle()
  if (!p) return { exito: false, error: 'No se encontró el documento.' }
  const archivo = (Array.isArray(p.files) ? p.files as ArchivoMatricula[] : []).find(a => a.path === path)
  if (!archivo) return { exito: false, error: 'No se encontró el documento.' }
  const url = await enlaceDescarga(admin, archivo)
  return url ? { exito: true, url } : { exito: false, error: 'No se pudo generar el enlace de descarga.' }
}
