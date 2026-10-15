// Habilitaciones: funciones que solo se ejecutan en el servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTexto } from 'app/utils/horario/comun'
import { type FilaNotas, type ResultadoHabilitacion, notaMateria } from 'app/utils/certificados/comun'

export type RegistroHabilitacion = {
  id: number
  student_id: string
  subject_name: string
  teacher_id: string | null
  exam_date: string | null
  plan: string | null
  result: ResultadoHabilitacion | null
}

// La materia se compara sin tildes ni mayúsculas: las planillas y las asignaciones no siempre la escriben igual
export const claveHabilitacion = (studentId: string, materia: string) => `${studentId}|${normalizarTexto(materia)}`

export async function cargarHabilitaciones(admin: SupabaseClient, anio: number, studentIds: string[]) {
  const mapa = new Map<string, RegistroHabilitacion>()
  for (let i = 0; i < studentIds.length; i += 200) {
    const { data } = await admin.from('remedial_exams')
      .select('id, student_id, subject_name, teacher_id, exam_date, plan, result')
      .eq('school_year', anio).in('student_id', studentIds.slice(i, i + 200))
    for (const r of data || []) mapa.set(claveHabilitacion(r.student_id, r.subject_name), r as RegistroHabilitacion)
  }
  return mapa
}

// La materia habilitada queda con la nota mínima como definitiva (en el certificado y en el historial)
export function aplicarHabilitaciones(filas: FilaNotas[], registros: Map<string, RegistroHabilitacion>, studentId: string, notaMinima: number) {
  return filas.map(f => {
    const n = notaMateria(f)
    const r = registros.get(claveHabilitacion(studentId, f.subject))
    return n !== null && n < notaMinima && r?.result === 'passed' ? { ...f, def: notaMinima } : f
  })
}
