'use server'

import { type DatosHorario, esFechaISO, lunesDeSemana, sumarDias } from './comun'
import {
  getAdmin, obtenerSesion, cargarCatalogo, cargarFranjas, cargarCasillas,
  construirClases, cargarDiasSinClase, cargarPlaneaciones, cargarTurnosPuerta, clasesDePuerta,
} from './servidor'

export type ContextoHorario = {
  role: 'admin' | 'teacher' | 'student'
  userId: string
  nombre: string
  cursos: { id: number, name: string }[] // admin: todos · profesor: los que dirige · estudiante: el suyo
  docentes: { id: string, name: string }[] // solo para la rectora
}

export async function obtenerContextoHorario(): Promise<{ exito: boolean, error?: string, contexto?: ContextoHorario }> {
  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autenticado' }

  const admin = getAdmin()
  const role = sesion.role === 'admin' ? 'admin' : sesion.role === 'teacher' ? 'teacher' : 'student'
  let qCursos = admin.from('grades').select('id, name').order('order_index', { ascending: true })
  if (role === 'teacher') qCursos = qCursos.eq('director_id', sesion.userId)
  if (role === 'student') qCursos = qCursos.eq('id', sesion.gradeId ?? -1)

  const [{ data: cursos }, { data: docentes }] = await Promise.all([
    qCursos,
    role === 'admin'
      ? admin.from('profiles').select('id, full_name').eq('role', 'teacher').order('full_name', { ascending: true })
      : Promise.resolve({ data: [] as { id: string, full_name: string }[] }),
  ])

  return {
    exito: true,
    contexto: {
      role,
      userId: sesion.userId,
      nombre: sesion.fullName,
      cursos: cursos || [],
      docentes: (docentes || []).map(d => ({ id: d.id, name: d.full_name })),
    },
  }
}

export type ObjetivoHorario = { tipo: 'curso', gradeId: number } | { tipo: 'docente', teacherId?: string }

export async function obtenerHorario(objetivo: ObjetivoHorario, semana: string): Promise<{ exito: boolean, error?: string, datos?: DatosHorario }> {
  if (!esFechaISO(semana)) return { exito: false, error: 'Semana no válida.' }
  const lunes = lunesDeSemana(semana)
  const viernes = sumarDias(lunes, 4)

  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autenticado' }
  const esAdmin = sesion.role === 'admin'
  const esProfesor = sesion.role === 'teacher'

  const admin = getAdmin()
  let gradeIds: number[] = []
  let soloDocente: string | null = null

  if (objetivo.tipo === 'curso') {
    if (esProfesor) {
      const { data: dirige } = await admin.from('grades').select('id').eq('id', objetivo.gradeId).eq('director_id', sesion.userId).maybeSingle()
      if (!dirige) return { exito: false, error: 'Solo puedes ver el horario completo de los cursos que diriges.' }
    } else if (!esAdmin && sesion.gradeId !== objetivo.gradeId) {
      return { exito: false, error: 'No autorizado' }
    }
    gradeIds = [objetivo.gradeId]
  } else {
    if (!esAdmin && !esProfesor) return { exito: false, error: 'No autorizado' }
    soloDocente = esAdmin ? objetivo.teacherId ?? null : sesion.userId
    if (!soloDocente) return { exito: false, error: 'Selecciona un docente.' }
    const { data: asignaciones } = await admin.from('teacher_assignments').select('grade_id').eq('teacher_id', soloDocente)
    gradeIds = [...new Set((asignaciones || []).map(a => a.grade_id).filter(Boolean))]
  }

  // El turno de puerta solo aparece en el horario del profesor que lo tiene, no en el de los cursos
  const puerta = soloDocente ? clasesDePuerta(await cargarTurnosPuerta(admin), soloDocente) : []

  const vacio: DatosHorario = { weekStart: lunes, franjas: [], clases: [], planeaciones: [], diasSinClase: [] }
  if (!gradeIds.length && !puerta.length) return { exito: true, datos: vacio }

  const [cat, franjas, casillas, diasSinClase, planeaciones] = await Promise.all([
    cargarCatalogo(admin, gradeIds),
    cargarFranjas(admin),
    cargarCasillas(admin, gradeIds),
    cargarDiasSinClase(admin, lunes, viernes),
    cargarPlaneaciones(admin, gradeIds, lunes, viernes),
  ])

  let clases = construirClases(casillas, franjas, cat)
  if (soloDocente) clases = [...clases.filter(c => c.teacherId === soloDocente), ...puerta]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.start.localeCompare(b.start))

  const secciones = new Set([...cat.cursos.values()].map(c => c.section))
  const materiasVisibles = new Set(clases.map(c => `${c.gradeId}|${c.subjectId}`))

  // Estudiantes: solo publicadas. Profesores: publicadas + sus propios borradores. Rectora: todo.
  const visibles = planeaciones
    .filter(p => materiasVisibles.has(`${p.gradeId}|${p.subjectId}`))
    .filter(p => esAdmin || p.status === 'published' || (esProfesor && p.teacherId === sesion.userId))
    .map(p => ({
      id: p.id, gradeId: p.gradeId, subjectId: p.subjectId, classDate: p.classDate,
      content: p.content, status: p.status, teacherName: p.teacherName, updatedAt: p.updatedAt,
      // La observación es solo para la rectora y el docente de la clase
      reviewNote: esAdmin || (esProfesor && p.teacherId === sesion.userId) ? p.reviewNote : null,
      adminEdited: p.adminEdited,
    }))

  // Si el turno no coincide con una franja visible (preescolar termina a la 1), se agrega su fila
  const visiblesFranjas = franjas.filter(f => secciones.has(f.section))
  for (const p of puerta) {
    if (!visiblesFranjas.some(f => f.start === p.start && f.end === p.end)) {
      visiblesFranjas.push({ id: -p.dayOfWeek, section: 'preescolar', start: p.start, end: p.end, isBreak: false })
    }
  }

  return {
    exito: true,
    datos: {
      weekStart: lunes,
      franjas: visiblesFranjas,
      clases,
      planeaciones: visibles,
      diasSinClase,
    },
  }
}
