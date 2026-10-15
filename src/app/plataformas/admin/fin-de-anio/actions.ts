'use server'

import { verificarRol } from 'app/utils/supabase/auth-check'
import {
  type FilaNotas, type ResultadoAnio, type ResultadoHabilitacion, GRADOS_OFICIALES, formatoDeCurso, materiasPerdidas, nivelDeGrado,
  notaMateria, promedio, siguienteGrado,
} from 'app/utils/certificados/comun'
import { getAdmin, cargarColegio, anioActivo, notasActuales } from 'app/utils/certificados/servidor'
import { type RegistroHabilitacion, aplicarHabilitaciones, cargarHabilitaciones, claveHabilitacion } from 'app/utils/habilitaciones/servidor'

export type MateriaPerdida = { subject: string, nota: number, result: ResultadoHabilitacion | null }

export type EstudianteFin = {
  id: string
  name: string
  officialGrade: string
  average: number | null
  perdidas: MateriaPerdida[] // materias por debajo de la nota mínima y cómo le fue en la habilitación
  incompletas: number // materias a las que les falta la nota de algún periodo
  sugerido: ResultadoAnio | null // null = por revisar
}

export type CursoFin = {
  id: number
  name: string
  officialGrade: string
  nextGradeId: number | null
  nextName: string | null
  isFinal: boolean
  preescolar: boolean
  estudiantes: EstudianteFin[]
}

export type DatosFinDeAnio = {
  anio: number
  ultimoCerrado: number | null
  reglas: { notaMinima: number }
  cursos: CursoFin[]
  sinCurso: number
  retiros: { name: string, course: string | null, reason: string | null, date: string | null }[]
}

export async function obtenerFinDeAnio(): Promise<{ exito: boolean, error?: string, datos?: DatosFinDeAnio }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const [anio, colegio, { data: cursos }, { data: estudiantes }, { data: cerrados }] = await Promise.all([
    anioActivo(admin),
    cargarColegio(admin),
    admin.from('grades').select('id, name, level, official_grade, official_level, next_grade_id, is_final_grade').order('order_index', { ascending: true }),
    admin.from('profiles').select('id, full_name, grade_id, official_grade, student_status').eq('role', 'student').order('full_name'),
    admin.from('school_years').select('year').eq('status', 'closed').order('year', { ascending: false }).limit(1),
  ])
  const { data: retirados } = await admin.from('alumni').select('full_name, last_course, reason, exit_date')
    .eq('exit_kind', 'withdrawn').eq('exit_year', anio).order('exit_date', { ascending: false })

  const activos = (estudiantes || []).filter(e => e.student_status !== 'alumni')
  const ids = activos.map(e => e.id)
  const [notas, registros] = await Promise.all([notasActuales(admin, ids), cargarHabilitaciones(admin, anio, ids)])
  const nombreCurso = new Map((cursos || []).map(c => [c.id, c.name]))

  const resultado: CursoFin[] = (cursos || []).map(c => {
    const preescolar = formatoDeCurso(c.name, c.official_level) === 'preescolar'
    return {
      id: c.id, name: c.name, officialGrade: c.official_grade ?? '', nextGradeId: c.next_grade_id ?? null,
      nextName: c.next_grade_id ? nombreCurso.get(c.next_grade_id) ?? null : null, isFinal: !!c.is_final_grade, preescolar,
      estudiantes: activos.filter(e => e.grade_id === c.id).map(e => {
        const filas = notas.get(e.id) ?? []
        const perdidas = preescolar ? [] : perdidasConResultado(filas, registros, e.id, colegio.promotionMinGrade)
        // En preescolar no se reprueba; en los demás, si queda alguna materia sin habilitar queda por revisar
        const sugerido: ResultadoAnio | null = perdidas.some(m => m.result !== 'passed') ? null : c.is_final_grade ? 'graduated' : 'promoted'
        return {
          id: e.id, name: e.full_name ?? '', officialGrade: e.official_grade || c.official_grade || '',
          average: promedio(aplicarHabilitaciones(filas, registros, e.id, colegio.promotionMinGrade).map(notaMateria)), perdidas,
          incompletas: filas.filter(f => f.p.slice(0, 3).some(n => n === null)).length, sugerido,
        }
      }),
    }
  }).filter(c => c.estudiantes.length > 0)

  return {
    exito: true,
    datos: {
      anio, ultimoCerrado: cerrados?.[0]?.year ?? null,
      reglas: { notaMinima: colegio.promotionMinGrade },
      cursos: resultado,
      sinCurso: activos.filter(e => !e.grade_id).length,
      retiros: (retirados || []).map(r => ({ name: r.full_name, course: r.last_course, reason: r.reason, date: r.exit_date })),
    },
  }
}

function perdidasConResultado(filas: FilaNotas[], registros: Map<string, RegistroHabilitacion>, studentId: string, notaMinima: number): MateriaPerdida[] {
  return materiasPerdidas(filas, notaMinima).map(f => ({
    subject: f.subject, nota: notaMateria(f)!, result: registros.get(claveHabilitacion(studentId, f.subject))?.result ?? null,
  }))
}

export type Decision = { studentId: string, result: ResultadoAnio, nextGradeId: number | null }

export async function cerrarAnio(decisiones: Decision[], confirmacion: string) {
  const { autorizado, error: authError, userId } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const anio = await anioActivo(admin)
  if (confirmacion.trim() !== String(anio + 1)) return { exito: false, error: `Escribe ${anio + 1} para confirmar.` }

  const [{ data: estudiantes }, { data: cursos }, colegio] = await Promise.all([
    admin.from('profiles').select('id, grade_id, official_grade, student_status').eq('role', 'student').not('grade_id', 'is', null),
    admin.from('grades').select('id, official_grade, official_level, is_final_grade'),
    cargarColegio(admin),
  ])
  const activos = (estudiantes || []).filter(e => e.student_status !== 'alumni')
  const porId = new Map(decisiones.map(d => [d.studentId, d]))
  const faltan = activos.filter(e => !porId.has(e.id)).length
  if (faltan) return { exito: false, error: `Faltan ${faltan} estudiante(s) por decidir.` }

  const cursoPorId = new Map((cursos || []).map(c => [c.id, c]))
  const ids = activos.map(e => e.id)
  const [notas, registros] = await Promise.all([notasActuales(admin, ids), cargarHabilitaciones(admin, anio, ids)])

  const payload = []
  for (const e of activos) {
    const d = porId.get(e.id)!
    if (!['promoted', 'repeat', 'left', 'graduated'].includes(d.result)) return { exito: false, error: 'Hay una decisión no válida.' }
    if (d.result === 'promoted' && (!d.nextGradeId || !cursoPorId.has(d.nextGradeId))) {
      return { exito: false, error: 'Hay estudiantes que pasan de curso sin un curso de destino. Revisa «Pasan a» en Fin de año → Configuración.' }
    }
    const curso = cursoPorId.get(e.grade_id)
    const preescolar = formatoDeCurso(null, curso?.official_level) === 'preescolar'
    // Las materias habilitadas quedan en el historial con la nota mínima como definitiva
    const filas = aplicarHabilitaciones(notas.get(e.id) ?? [], registros, e.id, colegio.promotionMinGrade)
    const gradoActual = e.official_grade || curso?.official_grade || ''
    const destino = d.nextGradeId ? cursoPorId.get(d.nextGradeId) : null
    payload.push({
      student_id: e.id,
      result: d.result,
      next_grade_id: d.result === 'promoted' ? d.nextGradeId : null,
      next_official_grade: d.result === 'promoted' ? siguienteGrado(gradoActual) ?? destino?.official_grade ?? null : null,
      average: promedio(filas.map(notaMateria)),
      // Materias que quedaron perdidas después de las habilitaciones
      lost_areas: preescolar ? 0 : materiasPerdidas(filas, colegio.promotionMinGrade).length,
      final_grades: filas,
    })
  }

  const { data, error } = await admin.rpc('cerrar_anio_escolar', { p_year: anio, p_decisiones: payload, p_user: userId })
  if (error) return { exito: false, error: error.message }
  return { exito: true, resumen: data as Record<ResultadoAnio, number>, anioNuevo: anio + 1 }
}

export async function deshacerCierre(anio: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const { error } = await getAdmin().rpc('deshacer_cierre_anio', { p_year: anio })
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

// ================= CONFIGURACIÓN =================

// Grado oficial y curso siguiente: los usan el paso de año y los certificados
export type CursoGrado = { id: number, name: string, officialGrade: string, officialLevel: string, nextGradeId: number | null, isFinal: boolean }
export type ReglaPromocion = { notaMinima: number }

export async function obtenerConfiguracionFin(): Promise<{ exito: boolean, error?: string, regla?: ReglaPromocion, cursos?: CursoGrado[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const [colegio, { data: cursos, error }] = await Promise.all([
    cargarColegio(admin),
    admin.from('grades').select('id, name, official_grade, official_level, next_grade_id, is_final_grade').order('order_index', { ascending: true }),
  ])
  if (error) return { exito: false, error: error.message }
  return {
    exito: true,
    regla: { notaMinima: colegio.promotionMinGrade },
    cursos: (cursos || []).map(c => ({
      id: c.id, name: c.name, officialGrade: c.official_grade ?? '', officialLevel: c.official_level ?? '',
      nextGradeId: c.next_grade_id ?? null, isFinal: !!c.is_final_grade,
    })),
  }
}

export async function guardarConfiguracionFin(datos: { regla: ReglaPromocion, cursos: CursoGrado[] }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const minima = Number(datos.regla.notaMinima)
  if (isNaN(minima) || minima < 1 || minima > 5) return { exito: false, error: 'La nota mínima debe estar entre 1.0 y 5.0.' }

  const admin = getAdmin()
  const { error } = await admin.from('school_settings')
    .update({ promotion_min_grade: minima, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return { exito: false, error: error.message }

  const t = (v: string | null | undefined, max: number) => (v ?? '').trim().slice(0, max)
  for (const curso of datos.cursos) {
    const grado = t(curso.officialGrade, 40)
    if (grado && !GRADOS_OFICIALES.includes(grado)) return { exito: false, error: `El grado de «${curso.name}» no es válido.` }
    const { error: e } = await admin.from('grades').update({
      official_grade: grado || null, official_level: t(curso.officialLevel, 60) || (grado ? nivelDeGrado(grado) : null),
      next_grade_id: curso.isFinal ? null : curso.nextGradeId, is_final_grade: !!curso.isFinal,
    }).eq('id', curso.id)
    if (e) return { exito: false, error: e.message }
  }
  return { exito: true }
}
