'use server'

import { randomUUID } from 'crypto'
import { verificarRol } from 'app/utils/supabase/auth-check'
import { getAdmin } from 'app/utils/horario/servidor'
import {
  type ArchivoMatricula, type PublicacionMatricula,
  BUCKET_MATRICULA, MAX_ARCHIVOS, MAX_ARCHIVO_MB, TIPOS_ARCHIVO, nombreSeguro,
} from 'app/utils/matricula/comun'
import { cargarPublicaciones, enlaceDescarga } from 'app/utils/matricula/servidor'

const PREFIJO = 'publicaciones/'

export async function obtenerPublicaciones(): Promise<{ exito: boolean, error?: string, publicaciones?: PublicacionMatricula[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  try {
    return { exito: true, publicaciones: await cargarPublicaciones(getAdmin()) }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'No se pudieron cargar las publicaciones.' }
  }
}

// Paso 1: permisos firmados para que el navegador suba los archivos directo al almacenamiento
// (así no pasan por el servidor, que tiene un límite de tamaño por petición)
export async function prepararSubida(archivos: { nombre: string, tipo: string, tamano: number }[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  if (!archivos.length) return { exito: false, error: 'Selecciona al menos un archivo.' }
  if (archivos.length > MAX_ARCHIVOS) return { exito: false, error: `Puedes subir hasta ${MAX_ARCHIVOS} archivos por publicación.` }
  for (const a of archivos) {
    if (!TIPOS_ARCHIVO[a.tipo]) return { exito: false, error: `«${a.nombre}» no es un tipo de archivo permitido (PDF, Word, Excel o imagen).` }
    if (a.tamano > MAX_ARCHIVO_MB * 1024 * 1024) return { exito: false, error: `«${a.nombre}» pesa más de ${MAX_ARCHIVO_MB} MB.` }
  }

  const admin = getAdmin()
  const carpeta = `${PREFIJO}${randomUUID()}`
  const subidas: { path: string, token: string }[] = []
  for (const [i, a] of archivos.entries()) {
    const path = `${carpeta}/${i + 1}-${nombreSeguro(a.nombre)}`
    const { data, error } = await admin.storage.from(BUCKET_MATRICULA).createSignedUploadUrl(path)
    if (error || !data) return { exito: false, error: `No se pudo preparar la subida: ${error?.message ?? 'error desconocido'}` }
    subidas.push({ path, token: data.token })
  }
  return { exito: true, subidas }
}

const limpiarArchivos = (archivos: ArchivoMatricula[]) => archivos
  .filter(a => typeof a.path === 'string' && a.path.startsWith(PREFIJO) && !a.path.includes('..') && TIPOS_ARCHIVO[a.tipo])
  .slice(0, MAX_ARCHIVOS)
  .map(a => ({ path: a.path, nombre: String(a.nombre ?? '').slice(0, 200) || 'archivo', tipo: a.tipo, tamano: Number(a.tamano) || 0 }))

// Paso 2: con los archivos ya subidos, se guarda la publicación
export async function crearPublicacion(datos: { titulo: string, comentario: string, archivos: ArchivoMatricula[] }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const titulo = datos.titulo.trim().slice(0, 150)
  const archivos = limpiarArchivos(datos.archivos)
  if (!titulo) return { exito: false, error: 'Escribe el título de la publicación.' }
  if (!archivos.length) return { exito: false, error: 'La publicación no tiene archivos.' }

  const { error } = await getAdmin().from('enrollment_posts').insert({
    title: titulo, comment: datos.comentario.trim().slice(0, 3000) || null, files: archivos,
  })
  return error ? { exito: false, error: error.message } : { exito: true }
}

// Si algo falla después de subir los archivos, se borran para que no queden sueltos
export async function descartarArchivos(paths: string[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  const validos = paths.filter(p => p.startsWith(PREFIJO) && !p.includes('..'))
  if (validos.length) await getAdmin().storage.from(BUCKET_MATRICULA).remove(validos)
  return { exito: true }
}

export async function editarPublicacion(id: number, datos: { titulo: string, comentario: string }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const titulo = datos.titulo.trim().slice(0, 150)
  if (!titulo) return { exito: false, error: 'Escribe el título de la publicación.' }
  const { error } = await getAdmin().from('enrollment_posts').update({
    title: titulo, comment: datos.comentario.trim().slice(0, 3000) || null, updated_at: new Date().toISOString(),
  }).eq('id', id)
  return error ? { exito: false, error: error.message } : { exito: true }
}

// Borra la publicación y sus archivos (los estudiantes dejan de verla)
export async function eliminarPublicacion(id: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: p } = await admin.from('enrollment_posts').select('files').eq('id', id).maybeSingle()
  if (!p) return { exito: false, error: 'La publicación no existe.' }
  const { error } = await admin.from('enrollment_posts').delete().eq('id', id)
  if (error) return { exito: false, error: error.message }
  const paths = (Array.isArray(p.files) ? p.files as ArchivoMatricula[] : []).map(a => a.path).filter(Boolean)
  if (paths.length) await admin.storage.from(BUCKET_MATRICULA).remove(paths)
  return { exito: true }
}

export async function descargarArchivoAdmin(id: number, path: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: p } = await admin.from('enrollment_posts').select('files').eq('id', id).maybeSingle()
  const archivo = (Array.isArray(p?.files) ? p.files as ArchivoMatricula[] : []).find(a => a.path === path)
  if (!archivo) return { exito: false, error: 'No se encontró el archivo.' }
  const url = await enlaceDescarga(admin, archivo)
  return url ? { exito: true, url } : { exito: false, error: 'No se pudo generar el enlace de descarga.' }
}
