// Cronograma: carga de datos. Solo se ejecuta en el servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarDiasSinClase } from 'app/utils/horario/servidor'
import { seccionDeCurso } from 'app/utils/horario/comun'
import { type DatosCronograma, type MesCronograma, BUCKET_CRONOGRAMA } from './comun'

export async function cargarCronograma(admin: SupabaseClient, anio: number): Promise<DatosCronograma> {
  const [items, { data: meses }, { data: cursos }] = await Promise.all([
    cargarDiasSinClase(admin, `${anio}-01-01`, `${anio}-12-31`),
    // Si aún no se ha corrido supabase/cronograma.sql la tabla no existe: los meses salen sin imagen ni título
    admin.from('calendar_months').select('month, title, image_path').eq('year', anio),
    admin.from('grades').select('id, name, level, order_index').order('order_index', { ascending: true }),
  ])

  const porMes = new Map((meses || []).map(m => [Number(m.month), m]))
  const lista: MesCronograma[] = Array.from({ length: 12 }, (_, i) => {
    const m = porMes.get(i + 1)
    return {
      mes: i + 1,
      titulo: m?.title || null,
      imagenUrl: m?.image_path ? admin.storage.from(BUCKET_CRONOGRAMA).getPublicUrl(m.image_path).data.publicUrl : null,
    }
  })

  return {
    anio,
    meses: lista,
    items,
    cursos: (cursos || []).map(c => ({ id: c.id, nombre: c.name, section: seccionDeCurso(c.name, c.level) })),
  }
}

export const anioValido = (anio: number) => Number.isInteger(anio) && anio >= 2020 && anio <= 2100
