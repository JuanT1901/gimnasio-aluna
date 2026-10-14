'use server'

import { verificarRol } from 'app/utils/supabase/auth-check'
import {
  type AlcanceDiaSinClase, type DiaSinClase, type EstadoPlaneacion, type Franja, type Seccion,
  clavePlaneacion, esFechaISO, fechasDeSemana, lunesDeSemana, motivoSinClase, seSolapan, sumarDias,
} from 'app/utils/horario/comun'
import {
  getAdmin, cargarCatalogo, cargarFranjas, cargarCasillas, construirClases,
  cargarDiasSinClase, cargarPlaneaciones, docenteDe, notificarDocente,
} from 'app/utils/horario/servidor'

const SECCIONES: Seccion[] = ['preescolar', 'general']
const esHora = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

// ================= EDITOR DEL HORARIO =================

export type CasillaEditor = { dayOfWeek: number, slotId: number, subjectId: string | null, label: string | null }
export type MateriaEditor = { id: string, name: string, teacherId: string | null, teacherName: string | null }
export type Ocupacion = { teacherId: string, teacherName: string | null, gradeName: string, subjectName: string | null, dayOfWeek: number, start: string, end: string }

export async function obtenerEditorHorario(gradeId: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const [cat, franjas, casillas] = await Promise.all([cargarCatalogo(admin, null), cargarFranjas(admin), cargarCasillas(admin, null)])
  const curso = cat.cursos.get(gradeId)
  if (!curso) return { exito: false, error: 'Curso no encontrado.' }

  const materias: MateriaEditor[] = [...cat.materias.values()]
    .filter(m => m.grade_id === gradeId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(m => {
      const docente = docenteDe(cat, gradeId, m.id)
      return { id: m.id, name: m.name, teacherId: docente?.id ?? null, teacherName: docente?.name ?? null }
    })

  // Clases de los demás cursos, para avisar si un docente queda en dos cursos a la misma hora
  const ocupaciones: Ocupacion[] = construirClases(casillas, franjas, cat)
    .filter(c => c.gradeId !== gradeId && c.teacherId)
    .map(c => ({ teacherId: c.teacherId!, teacherName: c.teacherName, gradeName: c.gradeName, subjectName: c.subjectName, dayOfWeek: c.dayOfWeek, start: c.start, end: c.end }))

  return {
    exito: true,
    curso: { id: curso.id, name: curso.name, section: curso.section },
    franjas: franjas.filter(f => f.section === curso.section),
    casillas: casillas
      .filter(c => c.grade_id === gradeId)
      .map(c => ({ dayOfWeek: c.day_of_week, slotId: c.slot_id, subjectId: c.subject_id, label: c.label })) as CasillaEditor[],
    materias,
    ocupaciones,
  }
}

export async function guardarHorarioCurso(gradeId: number, casillas: CasillaEditor[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const [cat, franjas] = await Promise.all([cargarCatalogo(admin, [gradeId]), cargarFranjas(admin)])
  const curso = cat.cursos.get(gradeId)
  if (!curso) return { exito: false, error: 'Curso no encontrado.' }

  const franjasValidas = new Set(franjas.filter(f => f.section === curso.section && !f.isBreak).map(f => f.id))
  const filas = []
  for (const c of casillas) {
    const label = c.label?.trim() || null
    if (!c.subjectId && !label) continue
    if (c.dayOfWeek < 1 || c.dayOfWeek > 5) return { exito: false, error: 'Día no válido.' }
    if (!franjasValidas.has(c.slotId)) return { exito: false, error: 'Una de las franjas no pertenece a este curso o es un descanso.' }
    if (c.subjectId && cat.materias.get(c.subjectId)?.grade_id !== gradeId) return { exito: false, error: 'Una de las materias no pertenece a este curso.' }
    filas.push({ grade_id: gradeId, day_of_week: c.dayOfWeek, slot_id: c.slotId, subject_id: c.subjectId || null, label: c.subjectId ? null : label })
  }

  const { data: existentes, error: errorLectura } = await admin
    .from('schedule_entries')
    .select('id, day_of_week, slot_id')
    .eq('grade_id', gradeId)
  if (errorLectura) return { exito: false, error: errorLectura.message }

  const nuevas = new Set(filas.map(f => `${f.day_of_week}|${f.slot_id}`))
  const sobrantes = (existentes || []).filter(e => !nuevas.has(`${e.day_of_week}|${e.slot_id}`)).map(e => e.id)

  if (sobrantes.length) {
    const { error } = await admin.from('schedule_entries').delete().in('id', sobrantes)
    if (error) return { exito: false, error: error.message }
  }
  if (filas.length) {
    const { error } = await admin.from('schedule_entries').upsert(filas, { onConflict: 'grade_id,day_of_week,slot_id' })
    if (error) return { exito: false, error: error.message }
  }
  return { exito: true }
}

// ================= FRANJAS HORARIAS =================

export type FranjaEditable = { id?: number, start: string, end: string, isBreak: boolean }

export async function guardarFranjas(seccion: Seccion, franjas: FranjaEditable[]): Promise<{ exito: boolean, error?: string, franjas?: Franja[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!SECCIONES.includes(seccion)) return { exito: false, error: 'Sección no válida.' }

  const ordenadas = [...franjas].sort((a, b) => a.start.localeCompare(b.start))
  for (const [i, f] of ordenadas.entries()) {
    if (!esHora(f.start) || !esHora(f.end)) return { exito: false, error: 'Escribe las horas en formato 24 horas, por ejemplo 07:00 o 13:30.' }
    if (f.start >= f.end) return { exito: false, error: `La franja de ${f.start} termina antes de empezar.` }
    const siguiente = ordenadas[i + 1]
    if (siguiente && seSolapan(f.start, f.end, siguiente.start, siguiente.end)) {
      return { exito: false, error: `Las franjas ${f.start}–${f.end} y ${siguiente.start}–${siguiente.end} se cruzan.` }
    }
  }

  const admin = getAdmin()
  const { data: existentes } = await admin.from('schedule_slots').select('id').eq('section', seccion)
  const idsEntrantes = new Set(ordenadas.filter(f => f.id).map(f => f.id))
  const eliminar = (existentes || []).map(e => e.id).filter(id => !idsEntrantes.has(id))

  // Borrar una franja también borra las clases que había en ella (ON DELETE CASCADE)
  if (eliminar.length) {
    const { error } = await admin.from('schedule_slots').delete().in('id', eliminar)
    if (error) return { exito: false, error: error.message }
  }

  for (const f of ordenadas.filter(x => x.id)) {
    const { error } = await admin
      .from('schedule_slots')
      .update({ start_time: f.start, end_time: f.end, is_break: f.isBreak })
      .eq('id', f.id!)
      .eq('section', seccion)
    if (error) return { exito: false, error: error.message }
  }

  const nuevas = ordenadas.filter(x => !x.id).map(f => ({ section: seccion, start_time: f.start, end_time: f.end, is_break: f.isBreak }))
  if (nuevas.length) {
    const { error } = await admin.from('schedule_slots').insert(nuevas)
    if (error) return { exito: false, error: error.message }
  }

  // Si una franja pasa a ser descanso, sus clases dejan de tener sentido
  const descansos = ordenadas.filter(f => f.isBreak && f.id).map(f => f.id!)
  if (descansos.length) await admin.from('schedule_entries').delete().in('slot_id', descansos)

  return { exito: true, franjas: await cargarFranjas(admin, [seccion]) }
}

// ================= PLANEACIÓN SEMANAL =================

export type FilaRevision = {
  clave: string
  gradeId: number
  gradeName: string
  gradeOrden: number
  subjectId: string
  subjectName: string
  teacherName: string | null
  fecha: string
  horas: { start: string, end: string }[]
  plan: {
    id: number, content: string, status: EstadoPlaneacion, teacherName: string | null, updatedAt: string,
    reviewNote: string | null, adminEdited: boolean,
  } | null
}

export async function obtenerPlaneacionesSemana(semana: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!esFechaISO(semana)) return { exito: false, error: 'Semana no válida.' }

  const lunes = lunesDeSemana(semana)
  const viernes = sumarDias(lunes, 4)
  const admin = getAdmin()

  const [cat, franjas, casillas, diasSinClase] = await Promise.all([
    cargarCatalogo(admin, null), cargarFranjas(admin), cargarCasillas(admin, null), cargarDiasSinClase(admin, lunes, viernes),
  ])
  const planeaciones = await cargarPlaneaciones(admin, [...cat.cursos.keys()], lunes, viernes)
  const clases = construirClases(casillas, franjas, cat)

  // Una fila por curso + materia + día, aunque la clase ocupe varias franjas
  const filas = new Map<string, FilaRevision>()
  fechasDeSemana(lunes).forEach((fecha, i) => {
    for (const c of clases) {
      if (c.dayOfWeek !== i + 1 || !c.subjectId) continue
      if (motivoSinClase(diasSinClase, fecha, c.section)) continue
      const clave = clavePlaneacion(c.gradeId, c.subjectId, fecha)
      const fila = filas.get(clave) ?? {
        clave, gradeId: c.gradeId, gradeName: c.gradeName, gradeOrden: cat.cursos.get(c.gradeId)?.orden ?? 0,
        subjectId: c.subjectId, subjectName: c.subjectName ?? '', teacherName: c.teacherName, fecha, horas: [], plan: null,
      }
      const ultima = fila.horas[fila.horas.length - 1]
      if (ultima && ultima.end === c.start) ultima.end = c.end
      else fila.horas.push({ start: c.start, end: c.end })
      filas.set(clave, fila)
    }
  })

  for (const p of planeaciones) {
    const clave = clavePlaneacion(p.gradeId, p.subjectId, p.classDate)
    const plan = {
      id: p.id, content: p.content, status: p.status, teacherName: p.teacherName, updatedAt: p.updatedAt,
      reviewNote: p.reviewNote, adminEdited: p.adminEdited,
    }
    const fila = filas.get(clave)
    if (fila) { fila.plan = plan; continue }
    // Planeación de una clase que ya no está en el horario: se muestra igual para no perderla
    const curso = cat.cursos.get(p.gradeId)
    filas.set(clave, {
      clave, gradeId: p.gradeId, gradeName: curso?.name ?? '', gradeOrden: curso?.orden ?? 0,
      subjectId: p.subjectId, subjectName: cat.materias.get(p.subjectId)?.name ?? 'Materia', teacherName: p.teacherName,
      fecha: p.classDate, horas: [], plan,
    })
  }

  const lista = [...filas.values()].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || a.gradeOrden - b.gradeOrden || (a.horas[0]?.start ?? '').localeCompare(b.horas[0]?.start ?? ''))

  const cursos = [...cat.cursos.values()].sort((a, b) => a.orden - b.orden).map(c => ({ id: c.id, name: c.name }))
  return { exito: true, semana: lunes, filas: lista, diasSinClase, cursos }
}

export async function publicarPlaneacion(planId: number) {
  const { autorizado, error: authError, userId } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  // Al publicarla, la observación que tuviera se da por atendida
  const { data, error } = await getAdmin()
    .from('lesson_plans')
    .update({ status: 'published', published_at: new Date().toISOString(), published_by: userId, review_note: null })
    .eq('id', planId)
    .eq('status', 'draft')
    .select('id')

  if (error) return { exito: false, error: error.message }
  if (!data?.length) return { exito: false, error: 'La planeación ya estaba publicada o fue eliminada.' }
  return { exito: true }
}

const MAX_CARACTERES = 5000

export async function despublicarPlaneacion(planId: number, observacion: string) {
  const { autorizado, error: authError, userId } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const nota = observacion.trim() || null
  if (nota && nota.length > 1000) return { exito: false, error: 'La observación no puede pasar de 1000 caracteres.' }

  const admin = getAdmin()
  const { data, error } = await admin
    .from('lesson_plans')
    .update({ status: 'draft', published_at: null, published_by: null, review_note: nota })
    .eq('id', planId)
    .eq('status', 'published')
    .select('id, teacher_id')

  if (error) return { exito: false, error: error.message }
  if (!data?.length) return { exito: false, error: 'La planeación ya no estaba publicada.' }

  await notificarDocente(admin, { teacherId: data[0].teacher_id, planId, kind: 'plan_unpublished', message: nota, createdBy: userId ?? null })
  return { exito: true, reviewNote: nota }
}

export async function editarPlaneacion(planId: number, contenido: string, publicar: boolean) {
  const { autorizado, error: authError, userId } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const content = contenido.trim()
  if (!content) return { exito: false, error: 'La planeación no puede quedar vacía.' }
  if (content.length > MAX_CARACTERES) return { exito: false, error: `La planeación no puede pasar de ${MAX_CARACTERES} caracteres.` }

  const admin = getAdmin()
  const { data: actual } = await admin.from('lesson_plans').select('content, status, teacher_id').eq('id', planId).maybeSingle()
  if (!actual) return { exito: false, error: 'La planeación ya no existe.' }

  const ahora = new Date().toISOString()
  const cambioTexto = actual.content !== content
  // Una publicada sigue publicada; un borrador solo se publica si la rectora lo pide
  const quedaPublicada = actual.status === 'published' || publicar

  const { error } = await admin
    .from('lesson_plans')
    .update({
      content,
      updated_at: ahora,
      ...(cambioTexto ? { admin_edited_at: ahora } : {}),
      ...(quedaPublicada && actual.status === 'draft' ? { status: 'published', published_at: ahora, published_by: userId, review_note: null } : {}),
    })
    .eq('id', planId)

  if (error) return { exito: false, error: error.message }

  if (cambioTexto) {
    await notificarDocente(admin, { teacherId: actual.teacher_id, planId, kind: 'plan_edited', message: null, createdBy: userId ?? null })
  }
  return { exito: true, status: (quedaPublicada ? 'published' : 'draft') as EstadoPlaneacion, adminEdited: cambioTexto }
}

// ================= DÍAS SIN CLASE =================

export async function obtenerDiasSinClase(): Promise<{ exito: boolean, error?: string, dias?: DiaSinClase[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  return { exito: true, dias: await cargarDiasSinClase(getAdmin()) }
}

export async function crearDiaSinClase(datos: { startDate: string, endDate: string, reason: string, scope: AlcanceDiaSinClase }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const reason = datos.reason.trim()
  const endDate = datos.endDate || datos.startDate
  if (!esFechaISO(datos.startDate) || !esFechaISO(endDate)) return { exito: false, error: 'Selecciona una fecha válida.' }
  if (endDate < datos.startDate) return { exito: false, error: 'La fecha final no puede ser anterior a la inicial.' }
  if (!reason) return { exito: false, error: 'Escribe el motivo (por ejemplo, «Festivo: Día de la Raza»).' }
  if (!['all', 'preescolar', 'general'].includes(datos.scope)) return { exito: false, error: 'Selecciona a quién aplica.' }

  const { error } = await getAdmin()
    .from('school_days_off')
    .insert({ start_date: datos.startDate, end_date: endDate, reason, scope: datos.scope })

  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function eliminarDiaSinClase(id: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const { error } = await getAdmin().from('school_days_off').delete().eq('id', id)
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}
