'use server'

import { randomUUID } from 'crypto'
import { verificarRol } from 'app/utils/supabase/auth-check'
import { getAdmin } from 'app/utils/horario/servidor'
import { esFechaISO } from 'app/utils/horario/comun'
import { type DatosCronograma, BUCKET_CRONOGRAMA, MAX_IMAGEN_MB, TIPOS_IMAGEN } from 'app/utils/cronograma/comun'
import { anioValido, cargarCronograma } from 'app/utils/cronograma/servidor'

const mesValido = (anio: number, mes: number) => anioValido(anio) && Number.isInteger(mes) && mes >= 1 && mes <= 12
const SIN_SCRIPT = 'Falta correr el script supabase/cronograma.sql en Supabase.'
const mensaje = (e: { message: string, code?: string }) =>
  e.code === '42P01' || e.code === '42703' || /does not exist|could not find/i.test(e.message) ? SIN_SCRIPT : e.message

export async function obtenerCronogramaAdmin(anio: number): Promise<{ exito: boolean, error?: string, datos?: DatosCronograma }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!anioValido(anio)) return { exito: false, error: 'Año no válido.' }
  try {
    return { exito: true, datos: await cargarCronograma(getAdmin(), anio) }
  } catch {
    return { exito: false, error: 'No se pudo cargar el cronograma.' }
  }
}

// ---------- Meses: título e imagen representativa ----------

export async function guardarTituloMes(anio: number, mes: number, titulo: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!mesValido(anio, mes)) return { exito: false, error: 'Mes no válido.' }

  const { error } = await getAdmin().from('calendar_months')
    .upsert({ year: anio, month: mes, title: titulo.trim().slice(0, 80) || null, updated_at: new Date().toISOString() }, { onConflict: 'year,month' })
  return error ? { exito: false, error: mensaje(error) } : { exito: true }
}

// Paso 1: permiso firmado para que el navegador suba la imagen directo al almacenamiento
export async function prepararImagenMes(anio: number, mes: number, tipo: string, tamano: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!mesValido(anio, mes)) return { exito: false, error: 'Mes no válido.' }
  if (!TIPOS_IMAGEN.includes(tipo)) return { exito: false, error: 'La imagen debe ser JPG, PNG o WEBP.' }
  if (tamano > MAX_IMAGEN_MB * 1024 * 1024) return { exito: false, error: `La imagen no puede pasar de ${MAX_IMAGEN_MB} MB.` }

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[tipo]
  const path = `${anio}/${String(mes).padStart(2, '0')}-${randomUUID()}.${ext}`
  const { data, error } = await getAdmin().storage.from(BUCKET_CRONOGRAMA).createSignedUploadUrl(path)
  if (error || !data) return { exito: false, error: error ? mensaje(error) : 'No se pudo preparar la subida.' }
  return { exito: true, path, token: data.token }
}

// Paso 2: con la imagen ya subida, queda como la del mes (y se borra la anterior)
export async function confirmarImagenMes(anio: number, mes: number, path: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!mesValido(anio, mes) || !path.startsWith(`${anio}/`) || path.includes('..')) return { exito: false, error: 'Imagen no válida.' }

  const admin = getAdmin()
  const { data: antes } = await admin.from('calendar_months').select('image_path').eq('year', anio).eq('month', mes).maybeSingle()
  const { error } = await admin.from('calendar_months')
    .upsert({ year: anio, month: mes, image_path: path, updated_at: new Date().toISOString() }, { onConflict: 'year,month' })
  if (error) return { exito: false, error: mensaje(error) }
  if (antes?.image_path && antes.image_path !== path) await admin.storage.from(BUCKET_CRONOGRAMA).remove([antes.image_path])
  return { exito: true }
}

export async function quitarImagenMes(anio: number, mes: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!mesValido(anio, mes)) return { exito: false, error: 'Mes no válido.' }

  const admin = getAdmin()
  const { data: antes } = await admin.from('calendar_months').select('image_path').eq('year', anio).eq('month', mes).maybeSingle()
  const { error } = await admin.from('calendar_months').update({ image_path: null, updated_at: new Date().toISOString() }).eq('year', anio).eq('month', mes)
  if (error) return { exito: false, error: mensaje(error) }
  if (antes?.image_path) await admin.storage.from(BUCKET_CRONOGRAMA).remove([antes.image_path])
  return { exito: true }
}

// ---------- Actividades extracurriculares y días sin clase ----------
// Se guardan en la misma tabla que usa la planeación (school_days_off): lo que se marque «sin clases»
// ya no pide planeación ese día a los cursos a los que aplica.

export type DatosActividad = {
  tipo: 'extracurricular' | 'sin_clase'
  startDate: string
  endDate: string
  titulo: string
  gradeIds: number[] | null // null = todos los cursos
  sinClases: boolean // true = ese día no hay clases para esos cursos (no se pide planeación)
}

function validar(d: DatosActividad) {
  const titulo = d.titulo.trim().slice(0, 150)
  const fin = d.endDate || d.startDate
  if (!['extracurricular', 'sin_clase'].includes(d.tipo)) return { error: 'Tipo no válido.' }
  if (!esFechaISO(d.startDate) || !esFechaISO(fin)) return { error: 'Selecciona una fecha válida.' }
  if (fin < d.startDate) return { error: 'La fecha final no puede ser anterior a la inicial.' }
  if (!titulo) return { error: d.tipo === 'extracurricular' ? 'Escribe el nombre de la actividad.' : 'Escribe el motivo (p. ej. «Receso escolar»).' }
  const gradeIds = d.tipo === 'extracurricular' && Array.isArray(d.gradeIds) && d.gradeIds.length
    ? [...new Set(d.gradeIds.map(Number).filter(n => Number.isInteger(n) && n > 0))] : null
  if (d.tipo === 'extracurricular' && Array.isArray(d.gradeIds) && d.gradeIds.length === 0) return { error: 'Selecciona al menos un curso o elige «Todos los cursos».' }
  return {
    fila: {
      kind: d.tipo, start_date: d.startDate, end_date: fin, reason: titulo, scope: 'all',
      grade_ids: gradeIds, no_class: d.tipo === 'sin_clase' ? true : !!d.sinClases,
    },
  }
}

export async function crearActividad(d: DatosActividad) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  const v = validar(d)
  if (!v.fila) return { exito: false, error: v.error }
  const { error } = await getAdmin().from('school_days_off').insert(v.fila)
  return error ? { exito: false, error: mensaje(error) } : { exito: true }
}

export async function editarActividad(id: number, d: DatosActividad) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!(id > 0)) return { exito: false, error: 'Los festivos no se pueden editar.' }
  const v = validar(d)
  if (!v.fila) return { exito: false, error: v.error }
  const { error } = await getAdmin().from('school_days_off').update(v.fila).eq('id', id)
  return error ? { exito: false, error: mensaje(error) } : { exito: true }
}

export async function eliminarActividad(id: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!(id > 0)) return { exito: false, error: 'Los festivos no se pueden borrar.' }
  const { error } = await getAdmin().from('school_days_off').delete().eq('id', id)
  return error ? { exito: false, error: mensaje(error) } : { exito: true }
}
