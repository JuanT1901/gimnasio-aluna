'use server'

import { lunesDeSemana } from 'app/utils/horario/comun'
import { getAdmin, obtenerSesion } from 'app/utils/horario/servidor'

export type Notificacion = {
  id: number
  kind: 'plan_unpublished' | 'plan_edited'
  message: string | null
  createdAt: string
  readAt: string | null
  planId: number | null
  gradeName: string | null
  subjectName: string | null
  classDate: string | null
  semana: string | null
}

async function sesionDocente() {
  const sesion = await obtenerSesion()
  return sesion?.role === 'teacher' ? sesion : null
}

export async function contarNotificacionesNoLeidas() {
  const sesion = await sesionDocente()
  if (!sesion) return 0

  const { count } = await getAdmin()
    .from('teacher_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', sesion.userId)
    .is('read_at', null)

  return count ?? 0
}

export async function obtenerNotificaciones(): Promise<{ exito: boolean, error?: string, notificaciones?: Notificacion[] }> {
  const sesion = await sesionDocente()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const admin = getAdmin()
  const { data, error } = await admin
    .from('teacher_notifications')
    .select('id, kind, message, created_at, read_at, lesson_plan_id')
    .eq('teacher_id', sesion.userId)
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) return { exito: false, error: error.message }
  const filas = data || []

  const idsPlanes = [...new Set(filas.map(n => n.lesson_plan_id).filter(Boolean))]
  const { data: planes } = idsPlanes.length
    ? await admin.from('lesson_plans').select('id, grade_id, subject_id, class_date').in('id', idsPlanes)
    : { data: [] as { id: number, grade_id: number, subject_id: string, class_date: string }[] }

  const idsCursos = [...new Set((planes || []).map(p => p.grade_id))]
  const idsMaterias = [...new Set((planes || []).map(p => p.subject_id))]
  const [{ data: cursos }, { data: materias }] = await Promise.all([
    idsCursos.length ? admin.from('grades').select('id, name').in('id', idsCursos) : Promise.resolve({ data: [] as { id: number, name: string }[] }),
    idsMaterias.length ? admin.from('subjects').select('id, name').in('id', idsMaterias) : Promise.resolve({ data: [] as { id: number, name: string }[] }),
  ])

  const planPorId = new Map((planes || []).map(p => [p.id, p]))
  const nombreCurso = new Map((cursos || []).map(c => [c.id, c.name]))
  const nombreMateria = new Map((materias || []).map(m => [m.id, m.name]))

  return {
    exito: true,
    notificaciones: filas.map(n => {
      const plan = n.lesson_plan_id ? planPorId.get(n.lesson_plan_id) : undefined
      return {
        id: n.id,
        kind: n.kind,
        message: n.message,
        createdAt: n.created_at,
        readAt: n.read_at,
        planId: plan?.id ?? null,
        gradeName: plan ? nombreCurso.get(plan.grade_id) ?? null : null,
        subjectName: plan ? nombreMateria.get(plan.subject_id) ?? null : null,
        classDate: plan?.class_date ?? null,
        semana: plan ? lunesDeSemana(plan.class_date) : null,
      }
    }),
  }
}

export async function marcarNotificacionLeida(id: number) {
  const sesion = await sesionDocente()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const { error } = await getAdmin()
    .from('teacher_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('teacher_id', sesion.userId)
    .is('read_at', null)

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function marcarTodasLeidas() {
  const sesion = await sesionDocente()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const { error } = await getAdmin()
    .from('teacher_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('teacher_id', sesion.userId)
    .is('read_at', null)

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
