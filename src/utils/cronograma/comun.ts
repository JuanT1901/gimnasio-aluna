// Cronograma: tipos y utilidades que se usan en el navegador y en el servidor.
import type { DiaSinClase } from 'app/utils/horario/comun'

export type MesCronograma = {
  mes: number // 1 = enero
  titulo: string | null // si no tiene, se muestra el nombre del mes
  imagenUrl: string | null
}

export type CursoCronograma = { id: number, nombre: string, section: 'preescolar' | 'general' }

export type DatosCronograma = {
  anio: number
  meses: MesCronograma[] // siempre los 12
  items: DiaSinClase[] // festivos (calculados), días sin clase y actividades extracurriculares del año
  cursos: CursoCronograma[]
}

export const BUCKET_CRONOGRAMA = 'cronograma'
export const MAX_IMAGEN_MB = 5
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

export const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Colores de la plataforma (los del logo de Ludo Club y el azul de la plataforma): cada elemento de la lista lleva uno
export const COLORES = [
  { fuerte: '#3CA0E8', suave: '#e8f4fd' },
  { fuerte: '#f59e0b', suave: '#fef6e4' },
  { fuerte: '#ef4444', suave: '#fdecec' },
  { fuerte: '#22c55e', suave: '#e9f9ef' },
  { fuerte: '#8b5cf6', suave: '#f1ecfe' },
  { fuerte: '#f97316', suave: '#fff0e6' },
]

export const ETIQUETA_TIPO: Record<DiaSinClase['kind'], string> = {
  festivo: 'Festivo',
  sin_clase: 'Sin clase',
  extracurricular: 'Actividad',
}

const partes = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d } }
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()

// «Lun 12» o «5 – 9 oct» / «28 sep – 2 oct»
export function textoFecha(inicio: string, fin: string) {
  const a = partes(inicio), b = partes(fin)
  if (inicio === fin) return `${DIA_CORTO[diaSemana(inicio)]} ${a.d}`
  return a.m === b.m ? `${a.d} – ${b.d} ${MES_CORTO[b.m - 1]}` : `${a.d} ${MES_CORTO[a.m - 1]} – ${b.d} ${MES_CORTO[b.m - 1]}`
}

// Elementos que tocan un mes (un receso que cruza de mes sale en los dos)
export function itemsDelMes(items: DiaSinClase[], anio: number, mes: number) {
  const ini = `${anio}-${String(mes).padStart(2, '0')}-01`
  const fin = `${anio}-${String(mes).padStart(2, '0')}-31`
  return items.filter(i => i.startDate <= fin && i.endDate >= ini).sort((a, b) => a.startDate.localeCompare(b.startDate))
}

// A quién aplica: «Todos los cursos», «Preescolar» o la lista de cursos
export function aQuienAplica(item: DiaSinClase, cursos: CursoCronograma[]) {
  if (item.gradeIds?.length) {
    const nombres = item.gradeIds.map(id => cursos.find(c => c.id === id)?.nombre).filter(Boolean) as string[]
    return nombres.length ? nombres : ['Algunos cursos']
  }
  if (item.scope === 'preescolar') return ['Preescolar']
  if (item.scope === 'general') return ['Primaria y bachillerato']
  return ['Todos los cursos']
}
