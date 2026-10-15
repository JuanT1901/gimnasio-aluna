'use server'

// Habilitaciones: la rectora ve todos los cursos; cada profesor, solo las materias que dicta.
import { esFechaISO, normalizarTexto } from 'app/utils/horario/comun'
import { type ResultadoHabilitacion, formatoDeCurso, materiasPerdidas, notaMateria } from 'app/utils/certificados/comun'
import { getAdmin, obtenerSesion, cargarColegio, anioActivo, notasActuales } from 'app/utils/certificados/servidor'
import { cargarHabilitaciones, claveHabilitacion } from './servidor'

const MAX_PLAN = 3000

export type Habilitacion = {
  studentId: string
  studentName: string
  subject: string
  nota: number
  periodos: number // periodos con nota: mientras sean menos de 3, la nota todavía puede cambiar
  teacherId: string | null
  teacherName: string | null
  examDate: string | null
  plan: string
  result: ResultadoHabilitacion | null
}

export type CursoHabilitacion = { id: number, name: string, items: Habilitacion[] }

export type DatosHabilitaciones = {
  anio: number
  notaMinima: number
  institucion: string
  esRectora: boolean
  docentes: { id: string, name: string }[]
  cursos: CursoHabilitacion[]
}

type Asignacion = { teacher_id: string, grade_id: number, subject_name: string | null }

const asignadoA = (asignaciones: Asignacion[], gradeId: number, materia: string) =>
  asignaciones.find(a => a.grade_id === gradeId && !!a.subject_name && normalizarTexto(a.subject_name) === normalizarTexto(materia)) ?? null

export async function obtenerHabilitaciones(): Promise<{ exito: boolean, error?: string, datos?: DatosHabilitaciones }> {
  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autenticado' }
  if (sesion.role !== 'admin' && sesion.role !== 'teacher') return { exito: false, error: 'No autorizado' }
  const esRectora = sesion.role === 'admin'

  const admin = getAdmin()
  const [anio, colegio, { data: cursos }, { data: asignaciones }, { data: docentes }] = await Promise.all([
    anioActivo(admin),
    cargarColegio(admin),
    admin.from('grades').select('id, name, official_level').order('order_index', { ascending: true }),
    admin.from('teacher_assignments').select('teacher_id, grade_id, subject_name'),
    admin.from('profiles').select('id, full_name').eq('role', 'teacher').order('full_name'),
  ])
  const asig = (asignaciones || []) as Asignacion[]
  const propias = asig.filter(a => a.teacher_id === sesion.userId)

  // Preescolar no tiene habilitaciones
  const validos = (cursos || []).filter(c => formatoDeCurso(c.name, c.official_level) !== 'preescolar' && (esRectora || propias.some(a => a.grade_id === c.id)))
  const base = { anio, notaMinima: colegio.promotionMinGrade, institucion: colegio.institutionName, esRectora }
  const nombres = new Map((docentes || []).map(d => [d.id, d.full_name ?? '']))
  const listaDocentes = esRectora ? (docentes || []).map(d => ({ id: d.id, name: d.full_name ?? '' })) : []
  if (!validos.length) return { exito: true, datos: { ...base, docentes: listaDocentes, cursos: [] } }

  const { data: estudiantes } = await admin.from('profiles').select('id, full_name, grade_id, student_status')
    .eq('role', 'student').in('grade_id', validos.map(c => c.id)).order('full_name')
  const activos = (estudiantes || []).filter(e => e.student_status !== 'alumni')
  const ids = activos.map(e => e.id)
  const [notas, registros] = await Promise.all([notasActuales(admin, ids), cargarHabilitaciones(admin, anio, ids)])

  const resultado: CursoHabilitacion[] = validos.map(c => ({
    id: c.id,
    name: c.name,
    items: activos.filter(e => e.grade_id === c.id).flatMap(e =>
      materiasPerdidas(notas.get(e.id) ?? [], colegio.promotionMinGrade).flatMap(f => {
        const asignado = asignadoA(asig, c.id, f.subject)
        if (!esRectora && asignado?.teacher_id !== sesion.userId) return []
        const r = registros.get(claveHabilitacion(e.id, f.subject))
        const teacherId = r?.teacher_id ?? asignado?.teacher_id ?? null
        return [{
          studentId: e.id, studentName: e.full_name ?? '', subject: f.subject, nota: notaMateria(f)!,
          periodos: f.p.filter(n => typeof n === 'number').length,
          teacherId, teacherName: teacherId ? nombres.get(teacherId) ?? null : null,
          examDate: r?.exam_date ?? null, plan: r?.plan ?? '', result: r?.result ?? null,
        }]
      })),
  })).filter(c => esRectora || c.items.length > 0)

  return { exito: true, datos: { ...base, docentes: listaDocentes, cursos: resultado } }
}

export type CambiosHabilitacion = {
  studentId: string
  subject: string
  teacherId: string | null // solo lo cambia la rectora
  examDate: string | null
  plan: string
  result: ResultadoHabilitacion | null
}

export async function guardarHabilitacion(datos: CambiosHabilitacion) {
  const sesion = await obtenerSesion()
  if (!sesion) return { exito: false, error: 'No autenticado' }
  if (sesion.role !== 'admin' && sesion.role !== 'teacher') return { exito: false, error: 'No autorizado' }
  const esRectora = sesion.role === 'admin'

  if (datos.examDate && !esFechaISO(datos.examDate)) return { exito: false, error: 'La fecha no es válida.' }
  if (datos.result !== null && datos.result !== 'passed' && datos.result !== 'failed') return { exito: false, error: 'El resultado no es válido.' }

  const admin = getAdmin()
  const { data: est } = await admin.from('profiles').select('id, role, grade_id, student_status').eq('id', datos.studentId).maybeSingle()
  if (!est || est.role !== 'student' || !est.grade_id || est.student_status === 'alumni') return { exito: false, error: 'Estudiante no encontrado.' }

  const [anio, colegio, notas, { data: asignaciones }] = await Promise.all([
    anioActivo(admin),
    cargarColegio(admin),
    notasActuales(admin, [est.id]),
    admin.from('teacher_assignments').select('teacher_id, grade_id, subject_name').eq('grade_id', est.grade_id),
  ])
  const fila = materiasPerdidas(notas.get(est.id) ?? [], colegio.promotionMinGrade)
    .find(f => normalizarTexto(f.subject) === normalizarTexto(datos.subject))
  if (!fila) return { exito: false, error: 'El estudiante no tiene esta materia perdida.' }

  const asignado = asignadoA((asignaciones || []) as Asignacion[], est.grade_id, fila.subject)
  if (!esRectora && asignado?.teacher_id !== sesion.userId) return { exito: false, error: 'Solo el profesor de la materia puede registrar esta habilitación.' }

  const registros = await cargarHabilitaciones(admin, anio, [est.id])
  const previo = registros.get(claveHabilitacion(est.id, fila.subject))
  const teacherId = esRectora ? datos.teacherId : previo?.teacher_id ?? sesion.userId
  const ahora = new Date().toISOString()
  const cambioResultado = (previo?.result ?? null) !== datos.result

  const fila_bd = {
    school_year: anio, student_id: est.id, grade_id: est.grade_id, subject_name: previo?.subject_name ?? fila.subject,
    original_grade: notaMateria(fila), teacher_id: teacherId || null, exam_date: datos.examDate || null,
    plan: datos.plan.trim().slice(0, MAX_PLAN) || null, result: datos.result, updated_at: ahora,
    ...(cambioResultado ? { result_by: sesion.userId, result_at: datos.result ? ahora : null } : {}),
  }
  const { error } = previo
    ? await admin.from('remedial_exams').update(fila_bd).eq('id', previo.id)
    : await admin.from('remedial_exams').insert(fila_bd)
  return error ? { exito: false, error: error.message } : { exito: true }
}
