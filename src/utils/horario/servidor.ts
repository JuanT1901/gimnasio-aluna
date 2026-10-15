// Funciones de apoyo del horario que solo se ejecutan en el servidor (usan la llave de servicio).
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from 'app/utils/supabase/server'
import {
  type ClaseHorario, type DiaSinClase, type Franja, type Planeacion, type Seccion,
  horaCorta, normalizarTexto, seccionDeCurso,
} from './comun'

export const getAdmin = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type Sesion = { userId: string, role: string, gradeId: number | null, fullName: string }

export async function obtenerSesion(): Promise<Sesion | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, grade_id, full_name')
    .eq('id', user.id)
    .single()

  if (!perfil) return null
  return { userId: user.id, role: perfil.role, gradeId: perfil.grade_id ?? null, fullName: perfil.full_name ?? '' }
}

export type Curso = { id: number, name: string, level: string | null, directorId: string | null, orden: number, section: Seccion }
type Materia = { id: string, name: string, grade_id: number }
type Asignacion = { teacher_id: string, grade_id: number, subject_id: string | null, subject_name: string | null }

export type Catalogo = {
  cursos: Map<number, Curso>
  materias: Map<string, Materia>
  asignaciones: Asignacion[]
  nombres: Map<string, string>
}

// Cursos, materias, asignaciones docentes y nombres de los docentes (de todos los cursos o de los indicados)
export async function cargarCatalogo(admin: SupabaseClient, gradeIds: number[] | null): Promise<Catalogo> {
  let qCursos = admin.from('grades').select('id, name, level, director_id, order_index')
  let qMaterias = admin.from('subjects').select('id, name, grade_id')
  let qAsig = admin.from('teacher_assignments').select('teacher_id, grade_id, subject_id, subject_name')
  if (gradeIds) {
    qCursos = qCursos.in('id', gradeIds)
    qMaterias = qMaterias.in('grade_id', gradeIds)
    qAsig = qAsig.in('grade_id', gradeIds)
  }
  const [{ data: cursos }, { data: materias }, { data: asignaciones }] = await Promise.all([qCursos, qMaterias, qAsig])

  const idsDocentes = [...new Set((asignaciones || []).map(a => a.teacher_id).filter(Boolean))]
  const { data: perfiles } = idsDocentes.length
    ? await admin.from('profiles').select('id, full_name').in('id', idsDocentes)
    : { data: [] as { id: string, full_name: string }[] }

  return {
    cursos: new Map((cursos || []).map(c => [c.id, {
      id: c.id, name: c.name, level: c.level ?? null, directorId: c.director_id ?? null,
      orden: c.order_index ?? 0, section: seccionDeCurso(c.name, c.level),
    }])),
    materias: new Map((materias || []).map(m => [m.id, m])),
    asignaciones: (asignaciones || []) as Asignacion[],
    nombres: new Map((perfiles || []).map(p => [p.id, p.full_name])),
  }
}

// Algunas asignaciones antiguas no tienen subject_id, por eso también se compara por nombre de materia
export function docenteDe(cat: Catalogo, gradeId: number, subjectId: string) {
  const materia = cat.materias.get(subjectId)
  const asignacion = cat.asignaciones.find(a => a.grade_id === gradeId && (
    a.subject_id === subjectId ||
    (!!materia && !!a.subject_name && normalizarTexto(a.subject_name) === normalizarTexto(materia.name))
  ))
  if (!asignacion) return null
  return { id: asignacion.teacher_id, name: cat.nombres.get(asignacion.teacher_id) ?? null }
}

export async function cargarFranjas(admin: SupabaseClient, secciones?: Seccion[]): Promise<Franja[]> {
  let q = admin.from('schedule_slots').select('id, section, start_time, end_time, is_break').order('start_time', { ascending: true })
  if (secciones) q = q.in('section', secciones)
  const { data } = await q
  return (data || []).map(f => ({
    id: f.id, section: f.section, start: horaCorta(f.start_time), end: horaCorta(f.end_time), isBreak: !!f.is_break,
  }))
}

type FilaCasilla = { id: number, grade_id: number, day_of_week: number, slot_id: number, subject_id: string | null, label: string | null }

export async function cargarCasillas(admin: SupabaseClient, gradeIds: number[] | null): Promise<FilaCasilla[]> {
  let q = admin.from('schedule_entries').select('id, grade_id, day_of_week, slot_id, subject_id, label')
  if (gradeIds) q = q.in('grade_id', gradeIds)
  const { data } = await q
  return (data || []) as FilaCasilla[]
}

export function construirClases(casillas: FilaCasilla[], franjas: Franja[], cat: Catalogo): ClaseHorario[] {
  const franjasPorId = new Map(franjas.map(f => [f.id, f]))
  const clases: ClaseHorario[] = []

  for (const c of casillas) {
    const franja = franjasPorId.get(c.slot_id)
    const curso = cat.cursos.get(c.grade_id)
    if (!franja || !curso) continue

    const materia = c.subject_id ? cat.materias.get(c.subject_id) : null
    const docente = c.subject_id ? docenteDe(cat, c.grade_id, c.subject_id) : null

    clases.push({
      id: c.id,
      gradeId: c.grade_id,
      gradeName: curso.name,
      section: curso.section,
      dayOfWeek: c.day_of_week,
      slotId: c.slot_id,
      start: franja.start,
      end: franja.end,
      subjectId: materia ? materia.id : null,
      subjectName: materia ? materia.name : null,
      label: c.label,
      teacherId: docente?.id ?? null,
      teacherName: docente?.name ?? null,
    })
  }

  return clases.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.start.localeCompare(b.start))
}

export async function cargarDiasSinClase(admin: SupabaseClient, desde?: string, hasta?: string): Promise<DiaSinClase[]> {
  let q = admin.from('school_days_off').select('id, start_date, end_date, reason, scope').order('start_date', { ascending: true })
  if (desde && hasta) q = q.lte('start_date', hasta).gte('end_date', desde)
  const { data } = await q
  return (data || []).map(d => ({ id: d.id, startDate: d.start_date, endDate: d.end_date, reason: d.reason, scope: d.scope }))
}

type FilaPlaneacion = Planeacion & { teacherId: string | null }

export async function cargarPlaneaciones(admin: SupabaseClient, gradeIds: number[], desde: string, hasta: string): Promise<FilaPlaneacion[]> {
  if (!gradeIds.length) return []
  const { data } = await admin
    .from('lesson_plans')
    .select('id, grade_id, subject_id, class_date, content, status, teacher_id, updated_at, review_note, admin_edited_at')
    .in('grade_id', gradeIds)
    .gte('class_date', desde)
    .lte('class_date', hasta)

  const filas = data || []
  const ids = [...new Set(filas.map(p => p.teacher_id).filter(Boolean))]
  const { data: perfiles } = ids.length
    ? await admin.from('profiles').select('id, full_name').in('id', ids)
    : { data: [] as { id: string, full_name: string }[] }
  const nombres = new Map((perfiles || []).map(p => [p.id, p.full_name]))

  return filas.map(p => ({
    id: p.id,
    gradeId: p.grade_id,
    subjectId: p.subject_id,
    classDate: p.class_date,
    content: p.content,
    status: p.status,
    teacherId: p.teacher_id ?? null,
    teacherName: p.teacher_id ? nombres.get(p.teacher_id) ?? null : null,
    updatedAt: p.updated_at,
    reviewNote: p.review_note ?? null,
    adminEdited: !!p.admin_edited_at,
  }))
}

type TipoNotificacion = 'plan_unpublished' | 'plan_edited'

// Aviso para el docente de la planeación cuando la rectora la despublica o la edita
export async function notificarDocente(admin: SupabaseClient, datos: {
  teacherId: string | null, planId: number, kind: TipoNotificacion, message: string | null, createdBy: string | null
}) {
  if (!datos.teacherId) return
  await admin.from('teacher_notifications').insert({
    teacher_id: datos.teacherId,
    lesson_plan_id: datos.planId,
    kind: datos.kind,
    message: datos.message,
    created_by: datos.createdBy,
  })
}

// ---------- Turno de puerta (preescolar) ----------

// Dos turnos por día: la entrada (7 a 8, antes de clase) y la salida (1 a 2, después de clase)
export type TurnoPuertaTipo = 'morning' | 'afternoon'
export type TurnoPuerta = { dayOfWeek: number, shift: TurnoPuertaTipo, teacherId: string | null, teacherName: string | null, start: string, end: string }
export const NOMBRE_PUERTA = 'Puerta'

export async function cargarTurnosPuerta(admin: SupabaseClient): Promise<TurnoPuerta[]> {
  const { data } = await admin.from('door_duties').select('day_of_week, shift, teacher_id, start_time, end_time')
    .order('day_of_week', { ascending: true }).order('start_time', { ascending: true })
  const ids = [...new Set((data || []).map(t => t.teacher_id).filter(Boolean))] as string[]
  const { data: docentes } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] as { id: string, full_name: string }[] }
  const nombre = new Map((docentes || []).map(d => [d.id, d.full_name]))
  return (data || []).map(t => ({
    dayOfWeek: t.day_of_week, shift: t.shift, teacherId: t.teacher_id, teacherName: t.teacher_id ? nombre.get(t.teacher_id) ?? null : null,
    start: horaCorta(t.start_time), end: horaCorta(t.end_time),
  }))
}

// El turno se muestra como una actividad fija en el horario del profesor (no lleva planeación)
export function clasesDePuerta(turnos: TurnoPuerta[], teacherId: string): ClaseHorario[] {
  return turnos.filter(t => t.teacherId === teacherId).map(t => ({
    id: -(t.dayOfWeek * 10 + (t.shift === 'morning' ? 1 : 2)), gradeId: 0, gradeName: 'Preescolar', section: 'preescolar' as const, dayOfWeek: t.dayOfWeek, slotId: 0,
    start: t.start, end: t.end, subjectId: null, subjectName: null, label: NOMBRE_PUERTA, teacherId: t.teacherId, teacherName: t.teacherName,
  }))
}
