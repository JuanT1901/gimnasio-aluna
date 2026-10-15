'use server'

import { verificarRol } from 'app/utils/supabase/auth-check'
import { type ResultadoAnio, GRADOS_OFICIALES, areasPerdidas, formatoDeCurso, nivelDeGrado, promedio, siguienteGrado } from 'app/utils/certificados/comun'
import { getAdmin, cargarColegio, anioActivo, notasActuales } from 'app/utils/certificados/servidor'

export type EstudianteFin = {
  id: string
  name: string
  officialGrade: string
  average: number | null
  lostAreas: number
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
  reglas: { notaMinima: number, areasParaRepetir: number }
  cursos: CursoFin[]
  sinCurso: number
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

  const activos = (estudiantes || []).filter(e => e.student_status !== 'alumni')
  const notas = await notasActuales(admin, activos.map(e => e.id))
  const nombreCurso = new Map((cursos || []).map(c => [c.id, c.name]))

  const resultado: CursoFin[] = (cursos || []).map(c => {
    const preescolar = formatoDeCurso(c.name, c.official_level) === 'preescolar'
    return {
      id: c.id, name: c.name, officialGrade: c.official_grade ?? '', nextGradeId: c.next_grade_id ?? null,
      nextName: c.next_grade_id ? nombreCurso.get(c.next_grade_id) ?? null : null, isFinal: !!c.is_final_grade, preescolar,
      estudiantes: activos.filter(e => e.grade_id === c.id).map(e => {
        const filas = notas.get(e.id) ?? []
        const perdidas = preescolar ? 0 : areasPerdidas(filas, colegio.promotionMinGrade)
        // En preescolar no se reprueba; en los demás, con muchas áreas perdidas queda por revisar
        const sugerido: ResultadoAnio | null = perdidas >= colegio.promotionMaxLostAreas ? null : c.is_final_grade ? 'graduated' : 'promoted'
        return {
          id: e.id, name: e.full_name ?? '', officialGrade: e.official_grade || c.official_grade || '',
          average: promedio(filas.map(f => f.def ?? promedio(f.p))), lostAreas: perdidas,
          incompletas: filas.filter(f => f.p.slice(0, 3).some(n => n === null)).length, sugerido,
        }
      }),
    }
  }).filter(c => c.estudiantes.length > 0)

  return {
    exito: true,
    datos: {
      anio, ultimoCerrado: cerrados?.[0]?.year ?? null,
      reglas: { notaMinima: colegio.promotionMinGrade, areasParaRepetir: colegio.promotionMaxLostAreas },
      cursos: resultado,
      sinCurso: activos.filter(e => !e.grade_id).length,
    },
  }
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
  const notas = await notasActuales(admin, activos.map(e => e.id))

  const payload = []
  for (const e of activos) {
    const d = porId.get(e.id)!
    if (!['promoted', 'repeat', 'left', 'graduated'].includes(d.result)) return { exito: false, error: 'Hay una decisión no válida.' }
    if (d.result === 'promoted' && (!d.nextGradeId || !cursoPorId.has(d.nextGradeId))) {
      return { exito: false, error: 'Hay estudiantes que pasan de curso sin un curso de destino. Revisa «Pasan a» en Fin de año → Configuración.' }
    }
    const curso = cursoPorId.get(e.grade_id)
    const preescolar = formatoDeCurso(null, curso?.official_level) === 'preescolar'
    const filas = notas.get(e.id) ?? []
    const gradoActual = e.official_grade || curso?.official_grade || ''
    const destino = d.nextGradeId ? cursoPorId.get(d.nextGradeId) : null
    payload.push({
      student_id: e.id,
      result: d.result,
      next_grade_id: d.result === 'promoted' ? d.nextGradeId : null,
      next_official_grade: d.result === 'promoted' ? siguienteGrado(gradoActual) ?? destino?.official_grade ?? null : null,
      average: promedio(filas.map(f => f.def ?? promedio(f.p))),
      lost_areas: preescolar ? 0 : areasPerdidas(filas, colegio.promotionMinGrade),
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
export type ReglaPromocion = { notaMinima: number, areasParaRepetir: number }

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
    regla: { notaMinima: colegio.promotionMinGrade, areasParaRepetir: colegio.promotionMaxLostAreas },
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
  const maxAreas = Number(datos.regla.areasParaRepetir)
  if (isNaN(minima) || minima < 1 || minima > 5) return { exito: false, error: 'La nota mínima debe estar entre 1.0 y 5.0.' }
  if (!Number.isInteger(maxAreas) || maxAreas < 1 || maxAreas > 20) return { exito: false, error: 'La cantidad de áreas perdidas debe ser un número entre 1 y 20.' }

  const admin = getAdmin()
  const { error } = await admin.from('school_settings')
    .update({ promotion_min_grade: minima, promotion_max_lost_areas: maxAreas, updated_at: new Date().toISOString() }).eq('id', 1)
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
