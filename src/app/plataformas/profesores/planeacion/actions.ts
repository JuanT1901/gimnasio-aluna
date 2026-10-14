'use server'

import {
  type EstadoPlaneacion, clavePlaneacion, diaDeSemana, esFechaISO, fechasDeSemana, lunesDeSemana,
  motivoSinClase, normalizarTexto, sumarDias,
} from 'app/utils/horario/comun'
import {
  getAdmin, obtenerSesion, cargarCatalogo, cargarFranjas, cargarCasillas, construirClases,
  cargarDiasSinClase, cargarPlaneaciones,
} from 'app/utils/horario/servidor'

const MAX_CARACTERES = 5000

export type DiaPlaneacion = {
  fecha: string
  horas: { start: string, end: string }[]
  sinClase: string | null
  plan: {
    id: number, content: string, status: EstadoPlaneacion, updatedAt: string,
    reviewNote: string | null, adminEdited: boolean,
  } | null
}

export type GrupoPlaneacion = {
  gradeId: number
  gradeName: string
  subjectId: string
  subjectName: string
  dias: DiaPlaneacion[]
}

export async function obtenerMiPlaneacion(semana: string): Promise<{ exito: boolean, error?: string, semana?: string, grupos?: GrupoPlaneacion[] }> {
  if (!esFechaISO(semana)) return { exito: false, error: 'Semana no válida.' }
  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autenticado' }
  if (sesion.role !== 'teacher') return { exito: false, error: 'Solo los docentes pueden hacer planeación.' }

  const lunes = lunesDeSemana(semana)
  const viernes = sumarDias(lunes, 4)
  const admin = getAdmin()

  const { data: asignaciones } = await admin.from('teacher_assignments').select('grade_id').eq('teacher_id', sesion.userId)
  const gradeIds = [...new Set((asignaciones || []).map(a => a.grade_id).filter(Boolean))]
  if (!gradeIds.length) return { exito: true, semana: lunes, grupos: [] }

  const [cat, franjas, casillas, dias, planeaciones] = await Promise.all([
    cargarCatalogo(admin, gradeIds), cargarFranjas(admin), cargarCasillas(admin, gradeIds),
    cargarDiasSinClase(admin, lunes, viernes), cargarPlaneaciones(admin, gradeIds, lunes, viernes),
  ])

  const clases = construirClases(casillas, franjas, cat).filter(c => c.teacherId === sesion.userId && c.subjectId)
  const planes = new Map(planeaciones.map(p => [clavePlaneacion(p.gradeId, p.subjectId, p.classDate), p]))
  const grupos = new Map<string, GrupoPlaneacion & { orden: number }>()

  for (const c of clases) {
    const k = `${c.gradeId}|${c.subjectId}`
    if (!grupos.has(k)) {
      grupos.set(k, {
        gradeId: c.gradeId, gradeName: c.gradeName, subjectId: c.subjectId!, subjectName: c.subjectName ?? '',
        orden: cat.cursos.get(c.gradeId)?.orden ?? 0, dias: [],
      })
    }
  }

  for (const grupo of grupos.values()) {
    const seccion = cat.cursos.get(grupo.gradeId)!.section
    fechasDeSemana(lunes).forEach((fecha, i) => {
      const delDia = clases.filter(c => c.gradeId === grupo.gradeId && c.subjectId === grupo.subjectId && c.dayOfWeek === i + 1)
      if (!delDia.length) return
      const horas: { start: string, end: string }[] = []
      for (const c of delDia) {
        const ultima = horas[horas.length - 1]
        if (ultima && ultima.end === c.start) ultima.end = c.end
        else horas.push({ start: c.start, end: c.end })
      }
      const p = planes.get(clavePlaneacion(grupo.gradeId, grupo.subjectId, fecha))
      grupo.dias.push({
        fecha,
        horas,
        sinClase: motivoSinClase(dias, fecha, seccion),
        plan: p ? {
          id: p.id, content: p.content, status: p.status, updatedAt: p.updatedAt,
          reviewNote: p.reviewNote, adminEdited: p.adminEdited,
        } : null,
      })
    })
  }

  const lista: GrupoPlaneacion[] = [...grupos.values()]
    .sort((a, b) => a.orden - b.orden || a.subjectName.localeCompare(b.subjectName))
    .map(g => ({ gradeId: g.gradeId, gradeName: g.gradeName, subjectId: g.subjectId, subjectName: g.subjectName, dias: g.dias }))

  return { exito: true, semana: lunes, grupos: lista }
}

export async function subirPlaneacion(datos: { gradeId: number, subjectId: string, classDate: string, content: string }) {
  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autenticado' }
  if (sesion.role !== 'teacher') return { exito: false, error: 'Solo los docentes pueden subir planeaciones.' }

  const content = datos.content.trim()
  if (!content) return { exito: false, error: 'Escribe los logros de la clase antes de subirla.' }
  if (content.length > MAX_CARACTERES) return { exito: false, error: `La planeación no puede pasar de ${MAX_CARACTERES} caracteres.` }
  if (!esFechaISO(datos.classDate) || diaDeSemana(datos.classDate) > 5) return { exito: false, error: 'Fecha de clase no válida.' }

  const admin = getAdmin()
  const [cat, franjas, dias] = await Promise.all([
    cargarCatalogo(admin, [datos.gradeId]), cargarFranjas(admin), cargarDiasSinClase(admin, datos.classDate, datos.classDate),
  ])
  const curso = cat.cursos.get(datos.gradeId)
  const materia = cat.materias.get(datos.subjectId)
  if (!curso || !materia || materia.grade_id !== datos.gradeId) return { exito: false, error: 'Curso o materia no encontrados.' }

  const asignado = cat.asignaciones.some(a => a.teacher_id === sesion.userId && a.grade_id === datos.gradeId && (
    a.subject_id === datos.subjectId || (!!a.subject_name && normalizarTexto(a.subject_name) === normalizarTexto(materia.name))
  ))
  if (!asignado) return { exito: false, error: 'No tienes asignada esta materia en este curso.' }

  const { data: casillas } = await admin
    .from('schedule_entries')
    .select('slot_id')
    .eq('grade_id', datos.gradeId)
    .eq('subject_id', datos.subjectId)
    .eq('day_of_week', diaDeSemana(datos.classDate))
  const franjasDeClase = new Set(franjas.filter(f => !f.isBreak).map(f => f.id))
  if (!(casillas || []).some(c => franjasDeClase.has(c.slot_id))) return { exito: false, error: 'Esta materia no tiene clase ese día en el horario.' }

  const sinClase = motivoSinClase(dias, datos.classDate, curso.section)
  if (sinClase) return { exito: false, error: `Ese día no hay clase (${sinClase}).` }

  // Cada vez que se sube (también al editar una ya publicada) vuelve a borrador para que la rectora la revise.
  // La observación de la rectora y la marca de "editada por rectoría" se dan por atendidas.
  const { error } = await admin.from('lesson_plans').upsert({
    grade_id: datos.gradeId,
    subject_id: datos.subjectId,
    class_date: datos.classDate,
    teacher_id: sesion.userId,
    content,
    status: 'draft',
    published_at: null,
    published_by: null,
    review_note: null,
    admin_edited_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'grade_id,subject_id,class_date' })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
