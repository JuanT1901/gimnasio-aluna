// Proceso de matrícula: lectura de publicaciones y enlaces de descarga. Solo se ejecuta en el servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { type ArchivoMatricula, type PublicacionMatricula, BUCKET_MATRICULA } from './comun'

type Fila = { id: number, title: string, comment: string | null, files: ArchivoMatricula[] | null, created_at: string }

const aPublicacion = (f: Fila): PublicacionMatricula => ({
  id: f.id, titulo: f.title, comentario: f.comment, archivos: Array.isArray(f.files) ? f.files : [], createdAt: f.created_at,
})

// Las publicaciones son para todos los estudiantes (documentos generales de matrícula)
export async function cargarPublicaciones(admin: SupabaseClient) {
  const { data, error } = await admin.from('enrollment_posts').select('id, title, comment, files, created_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Fila[] || []).map(aPublicacion)
}

// Enlace temporal que descarga el archivo con su nombre original
export async function enlaceDescarga(admin: SupabaseClient, archivo: ArchivoMatricula) {
  const { data, error } = await admin.storage.from(BUCKET_MATRICULA).createSignedUrl(archivo.path, 300, { download: archivo.nombre })
  return error || !data ? null : data.signedUrl
}
