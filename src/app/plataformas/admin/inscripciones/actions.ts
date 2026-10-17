'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'
import { getAdmin, anioActivo, variantesDocumento } from 'app/utils/certificados/servidor'
import {
  CAMPOS, DOMINIO_USUARIOS, ESTADOS_ABIERTOS, type DatosFicha, type EstadoInscripcion,
  limpiarUsuario, nombreCompleto, usuarioSugerido,
} from 'app/utils/inscripciones/comun'
import { aColumnas, aFicha, claveDocumento, cursosConGrado, limpiarFicha, tipoDocumentoValido } from 'app/utils/inscripciones/servidor'

export async function contarInscripcionesNuevas() {
  const { autorizado } = await verificarRol('admin')
  if (!autorizado) return 0
  const { count } = await getAdmin().from('enrollment_requests').select('id', { count: 'exact', head: true }).is('admin_seen_at', null)
  return count ?? 0
}

export type ResumenInscripcion = {
  id: number, code: string, schoolYear: number, status: EstadoInscripcion, estudiante: string,
  curso: string | null, grado: string | null, familia: string, nueva: boolean, completadaPorOtro: boolean, createdAt: string,
}

export async function obtenerInscripciones(): Promise<{ exito: boolean, error?: string, inscripciones?: ResumenInscripcion[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const [{ data, error }, cursos] = await Promise.all([
    admin.from('enrollment_requests')
      .select('id, code, school_year, status, first_name, second_name, first_surname, second_surname, grade_id, mother_name, father_name, family_submissions, admin_seen_at, created_at')
      .order('created_at', { ascending: false }),
    cursosConGrado(admin),
  ])
  if (error) return { exito: false, error: error.message }
  const porId = new Map(cursos.map(c => [c.id, c]))

  return {
    exito: true,
    inscripciones: (data || []).map(r => ({
      id: r.id, code: r.code, schoolYear: r.school_year, status: r.status,
      estudiante: nombreCompleto(r) || 'Sin nombre',
      curso: r.grade_id ? porId.get(r.grade_id)?.name ?? null : null,
      grado: r.grade_id ? porId.get(r.grade_id)?.officialGrade ?? null : null,
      familia: [r.mother_name, r.father_name].filter(Boolean).join(' · '),
      nueva: !r.admin_seen_at, completadaPorOtro: (r.family_submissions ?? 1) > 1, createdAt: r.created_at,
    })),
  }
}

export type DetalleInscripcion = {
  id: number, code: string, status: EstadoInscripcion, schoolYear: number, gradeId: number | null,
  docType: string, docNumber: string, ficha: DatosFicha, adminNotes: string, username: string,
  completadaPorOtro: boolean, familyUpdatedAt: string, createdAt: string, enrolledAt: string | null,
  anioActivo: number, cursos: { id: number, name: string, officialGrade: string | null }[],
  perfilExistente: string | null, // nombre de quien ya tiene ese documento en la plataforma
}

export async function obtenerInscripcion(id: number): Promise<{ exito: boolean, error?: string, detalle?: DetalleInscripcion }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: r } = await admin.from('enrollment_requests').select('*').eq('id', id).maybeSingle()
  if (!r) return { exito: false, error: 'Solicitud no encontrada.' }

  const [cursos, activo, perfil] = await Promise.all([
    cursosConGrado(admin), anioActivo(admin), perfilConDocumento(admin, r.doc_number, r.profile_id),
  ])
  if (!r.admin_seen_at) await admin.from('enrollment_requests').update({ admin_seen_at: new Date().toISOString() }).eq('id', id)

  return {
    exito: true,
    detalle: {
      id: r.id, code: r.code, status: r.status, schoolYear: r.school_year, gradeId: r.grade_id ?? null,
      docType: r.doc_type ?? 'RC', docNumber: r.doc_number, ficha: aFicha(r), adminNotes: r.admin_notes ?? '',
      username: r.username || usuarioSugerido(r),
      completadaPorOtro: (r.family_submissions ?? 1) > 1, familyUpdatedAt: r.family_updated_at, createdAt: r.created_at,
      enrolledAt: r.enrolled_at ?? null, anioActivo: activo, cursos, perfilExistente: perfil,
    },
  }
}

async function perfilConDocumento(admin: SupabaseClient, doc: string, excepto?: string | null) {
  let q = admin.from('profiles').select('id, full_name').in('doc_number', variantesDocumento(doc)).limit(1)
  if (excepto) q = q.neq('id', excepto)
  const { data } = await q
  return data?.[0] ? (data[0].full_name || 'otro usuario') : null
}

export type CambiosInscripcion = {
  ficha: DatosFicha, schoolYear: number, gradeId: number | null, docType: string, docNumber: string,
  adminNotes: string, username: string,
}

export async function guardarInscripcion(id: number, c: CambiosInscripcion) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const { datos, error } = limpiarFicha(c.ficha)
  if (error) return { exito: false, error }
  const doc = c.docNumber.trim().slice(0, 30)
  if (claveDocumento(doc).length < 5) return { exito: false, error: 'Revisa el número de documento.' }
  if (!tipoDocumentoValido(c.docType)) return { exito: false, error: 'Selecciona el tipo de documento.' }
  if (!Number.isInteger(c.schoolYear) || c.schoolYear < 2000 || c.schoolYear > 2100) return { exito: false, error: 'Año no válido.' }

  const admin = getAdmin()
  const { data: actual } = await admin.from('enrollment_requests').select('status').eq('id', id).maybeSingle()
  if (!actual) return { exito: false, error: 'Solicitud no encontrada.' }
  if (actual.status === 'enrolled') return { exito: false, error: 'Esta solicitud ya fue inscrita. Los cambios se hacen en Estudiantes.' }

  const { error: errUpd } = await admin.from('enrollment_requests').update({
    ...aColumnas(datos),
    school_year: c.schoolYear,
    grade_id: c.gradeId,
    doc_type: c.docType,
    doc_number: doc,
    doc_key: claveDocumento(doc),
    admin_notes: c.adminNotes.trim().slice(0, 2000) || null,
    username: limpiarUsuario(c.username) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (errUpd?.code === '23505') return { exito: false, error: 'Ya hay otra solicitud abierta con ese número de documento.' }
  if (errUpd) return { exito: false, error: errUpd.message }
  return { exito: true }
}

export async function cambiarEstadoInscripcion(id: number, estado: EstadoInscripcion) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (estado === 'enrolled') return { exito: false, error: 'Para inscribir usa el botón «Inscribir».' }

  const admin = getAdmin()
  const { data: actual } = await admin.from('enrollment_requests').select('status').eq('id', id).maybeSingle()
  if (!actual) return { exito: false, error: 'Solicitud no encontrada.' }
  if (actual.status === 'enrolled') return { exito: false, error: 'Esta solicitud ya fue inscrita.' }

  const { error } = await admin.from('enrollment_requests').update({ status: estado, updated_at: new Date().toISOString() }).eq('id', id)
  if (error?.code === '23505') return { exito: false, error: 'Ya hay otra solicitud abierta con este documento; no se puede reabrir esta.' }
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

// ---------- Usuario de acceso ----------

async function correosRegistrados(admin: SupabaseClient) {
  const correos = new Set<string>()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    data.users.forEach(u => { if (u.email) correos.add(u.email.toLowerCase()) })
    if (data.users.length < 1000) break
  }
  return correos
}

// Si el usuario de la regla ya existe, se prueba con el segundo apellido completo y luego con un número
function alternativas(base: string, ficha: DatosFicha) {
  const conApellido = limpiarUsuario(usuarioSugerido({ ...ficha, second_surname: '' }) + (ficha.second_surname ?? ''))
  return [base, conApellido, ...Array.from({ length: 9 }, (_, n) => `${base}${n + 2}`)].filter((u, k, a) => u && a.indexOf(u) === k)
}

export async function verificarUsuario(id: number, usuario: string): Promise<{ exito: boolean, error?: string, disponible?: boolean, sugerencia?: string | null }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const limpio = limpiarUsuario(usuario)
  if (!limpio) return { exito: false, error: 'Escribe el usuario.' }

  const admin = getAdmin()
  const { data: r } = await admin.from('enrollment_requests').select('*').eq('id', id).maybeSingle()
  if (!r) return { exito: false, error: 'Solicitud no encontrada.' }

  try {
    const correos = await correosRegistrados(admin)
    const libre = (u: string) => !correos.has(`${u}${DOMINIO_USUARIOS}`)
    if (libre(limpio)) return { exito: true, disponible: true, sugerencia: null }
    return { exito: true, disponible: false, sugerencia: alternativas(limpio, aFicha(r)).find(libre) ?? null }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'No se pudo revisar el usuario.' }
  }
}

// ---------- Inscribir ----------

// Datos de la solicitud que no existen como columna en «profiles»
const SOLO_SOLICITUD = new Set(['first_name', 'second_name', 'first_surname', 'second_surname', 'guardian_relation'])

export async function inscribirEstudiante(id: number, usuario: string): Promise<{ exito: boolean, error?: string, usuarioOcupado?: boolean, usuario?: string }> {
  const { autorizado, error: authError, userId } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: r } = await admin.from('enrollment_requests').select('*').eq('id', id).maybeSingle()
  if (!r) return { exito: false, error: 'Solicitud no encontrada.' }
  if (!ESTADOS_ABIERTOS.includes(r.status)) return { exito: false, error: r.status === 'enrolled' ? 'Esta solicitud ya fue inscrita.' : 'Reabre la solicitud antes de inscribir.' }

  // Si se inscribe antes del paso de año, Fin de año lo promovería al curso siguiente
  const activo = await anioActivo(admin)
  if (r.school_year > activo) {
    return { exito: false, error: `Esta solicitud es para ${r.school_year} y el año activo es ${activo}. Podrás inscribirla después del paso de año (Fin de año); mientras tanto déjala «En proceso».` }
  }

  if (!r.grade_id) return { exito: false, error: 'Asigna el curso antes de inscribir.' }
  if (!r.first_name || !r.first_surname) return { exito: false, error: 'Falta el primer nombre o el primer apellido.' }
  const password = String(r.doc_number).trim()
  if (password.length < 6) return { exito: false, error: 'La contraseña inicial es el número de documento y debe tener al menos 6 caracteres. Revisa el documento.' }

  const limpio = limpiarUsuario(usuario)
  if (!limpio) return { exito: false, error: 'Escribe el usuario.' }

  const existente = await perfilConDocumento(admin, r.doc_number)
  if (existente) return { exito: false, error: `Ya existe un usuario con este documento en la plataforma (${existente}). Revísalo en Estudiantes antes de inscribir.` }

  const { data: curso } = await admin.from('grades').select('id, name').eq('id', r.grade_id).maybeSingle()
  if (!curso) return { exito: false, error: 'El curso asignado ya no existe.' }

  const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
    email: `${limpio}${DOMINIO_USUARIOS}`, password, email_confirm: true,
  })
  if (errAuth || !creado?.user) {
    if (errAuth && /already|registered|exists/i.test(errAuth.message)) {
      return { exito: false, usuarioOcupado: true, error: `El usuario «${limpio}» ya existe. Cámbialo para que sea único.` }
    }
    return { exito: false, error: errAuth?.message ?? 'No se pudo crear la cuenta.' }
  }

  const ficha: Record<string, unknown> = {}
  for (const c of CAMPOS) if (!SOLO_SOLICITUD.has(c.key)) ficha[c.key] = r[c.key] ?? null
  // Si el acudiente es la madre o el padre, se copian sus datos
  if (r.guardian_relation === 'Madre') { ficha.guardian_name ??= r.mother_name; ficha.guardian_cellphone ??= r.mother_cellphone }
  if (r.guardian_relation === 'Padre') { ficha.guardian_name ??= r.father_name; ficha.guardian_cellphone ??= r.father_cellphone }

  const { error: errPerfil } = await admin.from('profiles').upsert({
    id: creado.user.id,
    role: 'student',
    student_status: 'active',
    full_name: nombreCompleto(r),
    doc_type: r.doc_type,
    doc_number: r.doc_number,
    grade_id: curso.id,
    course_name: curso.name,
    ...ficha,
  })
  if (errPerfil) {
    await admin.auth.admin.deleteUser(creado.user.id)
    return { exito: false, error: errPerfil.message }
  }

  const ahora = new Date().toISOString()
  await admin.from('enrollment_requests').update({
    status: 'enrolled', profile_id: creado.user.id, username: limpio, enrolled_at: ahora, enrolled_by: userId ?? null, updated_at: ahora,
  }).eq('id', id)

  return { exito: true, usuario: limpio }
}
