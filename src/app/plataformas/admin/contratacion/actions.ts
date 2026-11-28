'use server'

import { verificarRol } from 'app/utils/supabase/auth-check'
import { getAdmin } from 'app/utils/horario/servidor'
import { variantesDocumento } from 'app/utils/certificados/servidor'
import { DOMINIO_USUARIOS, limpiarUsuario, nombreCompleto, usuarioSugerido } from 'app/utils/inscripciones/comun'
import { claveDocumento } from 'app/utils/inscripciones/servidor'
import { type ClasePlaneada, type FichaDocente, type Postulacion, faltantesDocente } from 'app/utils/contratacion/comun'
import { TABLA, aColumnasDocente, aPostulacion, limpiarFichaDocente, nuevoToken, tokenFormulario } from 'app/utils/contratacion/servidor'

type Admin = ReturnType<typeof getAdmin>
const SIN_SCRIPT = 'Falta correr el script supabase/contratacion.sql en Supabase.'
const mensaje = (e: { message: string, code?: string }) =>
  e.code === '42P01' || e.code === '42703' || /does not exist|could not find/i.test(e.message) ? SIN_SCRIPT : e.message

// ---------- Aviso en el menú ----------

export async function contarPostulacionesNuevas() {
  const { autorizado } = await verificarRol('admin')
  if (!autorizado) return 0
  const { count } = await getAdmin().from(TABLA).select('id', { count: 'exact', head: true }).is('admin_seen_at', null).eq('status', 'pending')
  return count ?? 0
}

// ---------- Enlace del formulario ----------

export async function obtenerEnlace(): Promise<{ exito: boolean, error?: string, token?: string }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  try {
    const token = await tokenFormulario(getAdmin(), true)
    return token ? { exito: true, token } : { exito: false, error: SIN_SCRIPT }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? mensaje(e) : SIN_SCRIPT }
  }
}

// El enlace anterior deja de funcionar
export async function regenerarEnlace(): Promise<{ exito: boolean, error?: string, token?: string }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  try {
    return { exito: true, token: await nuevoToken(getAdmin()) }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? mensaje(e) : SIN_SCRIPT }
  }
}

// ---------- Lista y detalle ----------

export type ResumenPostulacion = { id: number, nombre: string, documento: string, profesion: string, status: Postulacion['status'], nueva: boolean, createdAt: string }

export async function obtenerPostulaciones(): Promise<{ exito: boolean, error?: string, postulaciones?: ResumenPostulacion[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  const { data, error } = await getAdmin().from(TABLA).select('*').order('created_at', { ascending: false })
  if (error) return { exito: false, error: mensaje(error) }
  return {
    exito: true,
    postulaciones: (data || []).map(f => {
      const p = aPostulacion(f)
      return {
        id: p.id, nombre: nombreCompleto(p.ficha), documento: `${p.ficha.doc_type} ${p.ficha.doc_number}`.trim(),
        profesion: p.ficha.profession, status: p.status, nueva: p.nueva && p.status === 'pending', createdAt: p.createdAt,
      }
    }),
  }
}

export type CursoContratacion = { id: number, nombre: string, materias: string[], directorId: string | null, directorNombre: string | null }

export type DetallePostulacion = Postulacion & {
  usuarioSugerido: string
  cursos: CursoContratacion[]
  ocupadas: Record<string, string> // «gradeId|materia» → docente que la tiene hoy
}

export async function obtenerPostulacion(id: number): Promise<{ exito: boolean, error?: string, detalle?: DetallePostulacion }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: f, error } = await admin.from(TABLA).select('*').eq('id', id).maybeSingle()
  if (error) return { exito: false, error: mensaje(error) }
  if (!f) return { exito: false, error: 'No encontramos este registro.' }
  const p = aPostulacion(f)

  const [{ data: grades }, { data: materias }, { data: asignaciones }] = await Promise.all([
    admin.from('grades').select('id, name, director_id, order_index').order('order_index', { ascending: true }),
    admin.from('subjects').select('name, grade_id').order('name'),
    admin.from('teacher_assignments').select('grade_id, subject_name, teacher_id'),
  ])
  const ids = [...new Set([...(grades || []).map(g => g.director_id), ...(asignaciones || []).map(a => a.teacher_id)].filter(Boolean))]
  const { data: nombres } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] }
  const nombre = new Map((nombres || []).map(n => [n.id, n.full_name ?? '']))

  // Al abrirla, deja de contar en el aviso del menú
  if (p.nueva) await admin.from(TABLA).update({ admin_seen_at: new Date().toISOString() }).eq('id', id)

  return {
    exito: true,
    detalle: {
      ...p,
      usuarioSugerido: p.username || usuarioSugerido(p.ficha),
      cursos: (grades || []).map(g => ({
        id: g.id, nombre: g.name,
        materias: (materias || []).filter(m => m.grade_id === g.id).map(m => m.name),
        directorId: g.director_id ?? null, directorNombre: g.director_id ? nombre.get(g.director_id) ?? null : null,
      })),
      ocupadas: Object.fromEntries((asignaciones || [])
        .filter(a => a.teacher_id && a.teacher_id !== p.hiredProfileId)
        .map(a => [`${a.grade_id}|${a.subject_name}`, nombre.get(a.teacher_id) ?? 'Otro docente'])),
    },
  }
}

// ---------- Guardar la revisión ----------

const limpiarClases = (clases: ClasePlaneada[]) => {
  const vistas = new Set<string>()
  return (Array.isArray(clases) ? clases : [])
    .map(c => ({ gradeId: Number(c.gradeId), subjectName: String(c.subjectName ?? '').trim().slice(0, 120) }))
    .filter(c => Number.isInteger(c.gradeId) && c.gradeId > 0 && c.subjectName && !vistas.has(`${c.gradeId}|${c.subjectName}`) && !!vistas.add(`${c.gradeId}|${c.subjectName}`))
    .slice(0, 60)
}
const limpiarDireccion = (ids: number[]) => [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 20)

export async function guardarPostulacion(id: number, datos: { ficha: FichaDocente, clases: ClasePlaneada[], direccion: number[], username: string, notas: string }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const ficha = limpiarFichaDocente(datos.ficha)
  const { error } = await getAdmin().from(TABLA).update({
    ...aColumnasDocente(ficha),
    planned_classes: limpiarClases(datos.clases),
    director_grade_ids: limpiarDireccion(datos.direccion),
    username: limpiarUsuario(datos.username) || null,
    admin_notes: datos.notas.trim().slice(0, 2000) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'pending')
  return error ? { exito: false, error: mensaje(error) } : { exito: true }
}

export async function cambiarEstado(id: number, status: 'pending' | 'discarded') {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  const { error } = await getAdmin().from(TABLA).update({ status, updated_at: new Date().toISOString() }).eq('id', id).neq('status', 'hired')
  return error ? { exito: false, error: mensaje(error) } : { exito: true }
}

// ---------- Contratar ----------

// Asigna la materia del curso al docente (si la tenía otro docente, pasa a este), igual que en Docentes
async function asignarClase(admin: Admin, teacherId: string, gradeId: number, courseName: string, subjectName: string) {
  const { data: existente } = await admin.from('teacher_assignments').select('id').eq('grade_id', gradeId).eq('subject_name', subjectName)
  const { error } = existente?.length
    ? await admin.from('teacher_assignments').update({ teacher_id: teacherId }).eq('grade_id', gradeId).eq('subject_name', subjectName)
    : await admin.from('teacher_assignments').insert({ teacher_id: teacherId, grade_id: gradeId, course_name: courseName, subject_name: subjectName })
  return error?.message ?? null
}

export async function contratar(id: number, datos: { ficha: FichaDocente, clases: ClasePlaneada[], direccion: number[], username: string, notas: string }):
  Promise<{ exito: boolean, error?: string, usuarioOcupado?: boolean, usuario?: string, avisos?: string[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  // Primero se guarda lo que la rectora revisó
  const guardado = await guardarPostulacion(id, datos)
  if (!guardado.exito) return guardado

  const admin = getAdmin()
  const { data: f } = await admin.from(TABLA).select('*').eq('id', id).maybeSingle()
  if (!f) return { exito: false, error: 'No encontramos este registro.' }
  if (f.status !== 'pending') return { exito: false, error: 'Este registro ya no está pendiente.' }
  const p = aPostulacion(f)

  const falta = faltantesDocente(p.ficha)
  if (falta) return { exito: false, error: falta }
  const usuario = limpiarUsuario(datos.username)
  if (!usuario) return { exito: false, error: 'Escribe el usuario con el que entrará a la plataforma.' }

  const { data: existente } = await admin.from('profiles').select('full_name').in('doc_number', variantesDocumento(p.ficha.doc_number)).limit(1).maybeSingle()
  if (existente) return { exito: false, error: `Ya existe un usuario con este documento en la plataforma (${existente.full_name}). Revísalo en Docentes.` }

  const clave = claveDocumento(p.ficha.doc_number)
  if (clave.length < 6) return { exito: false, error: 'El número de documento es muy corto para usarlo como contraseña (mínimo 6 caracteres).' }

  const { data: creado, error: errAuth } = await admin.auth.admin.createUser({ email: `${usuario}${DOMINIO_USUARIOS}`, password: clave, email_confirm: true })
  if (errAuth || !creado?.user) {
    if (errAuth && /already|registered|exists/i.test(errAuth.message)) return { exito: false, usuarioOcupado: true, error: `El usuario «${usuario}» ya existe. Cámbialo para que sea único.` }
    return { exito: false, error: errAuth?.message ?? 'No se pudo crear la cuenta.' }
  }
  const userId = creado.user.id
  const v = (k: string) => p.ficha[k]?.trim() || null

  const { error: errPerfil } = await admin.from('profiles').upsert({
    id: userId, role: 'teacher', is_active: true,
    full_name: nombreCompleto(p.ficha), doc_type: p.ficha.doc_type, doc_number: p.ficha.doc_number,
    doc_expedition_city: v('doc_expedition_city'), phone_number: v('phone'), email: v('email'), birth_date: v('birth_date'),
    address: v('address'), eps: v('eps'), arl: v('arl'), pension_fund: v('pension_fund'), compensation_fund: v('compensation_fund'),
  })
  if (errPerfil) {
    await admin.auth.admin.deleteUser(userId)
    return { exito: false, error: `No se pudo crear el perfil: ${errPerfil.message}` }
  }

  // Clases y dirección de grupo. Si algo falla, el docente queda contratado y se avisa qué revisar en Docentes o Cursos.
  const avisos: string[] = []
  const { data: grades } = await admin.from('grades').select('id, name')
  const nombreCurso = new Map((grades || []).map(g => [g.id, g.name]))
  for (const c of p.clases) {
    const curso = nombreCurso.get(c.gradeId)
    if (!curso) { avisos.push(`No se encontró el curso de «${c.subjectName}».`); continue }
    const e = await asignarClase(admin, userId, c.gradeId, curso, c.subjectName)
    if (e) avisos.push(`${c.subjectName} (${curso}): ${e}`)
  }
  if (p.direccion.length) {
    const { error: e } = await admin.from('grades').update({ director_id: userId }).in('id', p.direccion)
    if (e) avisos.push(`Dirección de grupo: ${e.message}`)
  }

  await admin.from(TABLA).update({
    status: 'hired', username: usuario, hired_profile_id: userId, hired_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id)

  return { exito: true, usuario, avisos }
}
