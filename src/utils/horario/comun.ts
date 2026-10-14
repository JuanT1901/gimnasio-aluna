// Tipos y utilidades del horario que se usan tanto en el cliente como en el servidor.

export type Seccion = 'preescolar' | 'general'
export type EstadoPlaneacion = 'draft' | 'published'
export type AlcanceDiaSinClase = 'all' | Seccion

export type Franja = {
  id: number
  section: Seccion
  start: string // 'HH:MM'
  end: string
  isBreak: boolean
}

export type ClaseHorario = {
  id: number
  gradeId: number
  gradeName: string
  section: Seccion
  dayOfWeek: number // 1 = lunes ... 5 = viernes
  slotId: number
  start: string
  end: string
  subjectId: string | null
  subjectName: string | null
  label: string | null
  teacherId: string | null
  teacherName: string | null
}

export type Planeacion = {
  id: number
  gradeId: number
  subjectId: string
  classDate: string // 'YYYY-MM-DD'
  content: string
  status: EstadoPlaneacion
  teacherName: string | null
  updatedAt: string
  reviewNote: string | null // observación de la rectora al despublicar
  adminEdited: boolean // la rectora cambió el texto
}

export type DiaSinClase = {
  id: number
  startDate: string
  endDate: string
  reason: string
  scope: AlcanceDiaSinClase
}

export type DatosHorario = {
  weekStart: string
  franjas: Franja[]
  clases: ClaseHorario[]
  planeaciones: Planeacion[]
  diasSinClase: DiaSinClase[]
}

export const CURSOS_PREESCOLAR = ['Aventureros', 'Creativos', 'Expertos']

export const NOMBRE_SECCION: Record<Seccion, string> = {
  preescolar: 'Preescolar',
  general: 'Primaria y bachillerato',
}

export const NOMBRE_ALCANCE: Record<AlcanceDiaSinClase, string> = {
  all: 'Todo el colegio',
  preescolar: 'Preescolar',
  general: 'Primaria y bachillerato',
}

export const ESTADO_PLANEACION: Record<EstadoPlaneacion | 'none', string> = {
  published: 'Publicada',
  draft: 'Borrador',
  none: 'Sin planeación',
}

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function seccionDeCurso(nombre: string, nivel?: string | null): Seccion {
  if (CURSOS_PREESCOLAR.includes(nombre)) return 'preescolar'
  if (nivel && nivel.toLowerCase().includes('preescolar')) return 'preescolar'
  return 'general'
}

export const normalizarTexto = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// ---------- Horas ----------

// '07:00:00' → '07:00'
export const horaCorta = (t: string) => t.slice(0, 5)

// '13:00' → '1:00 pm'
export function formatoHora(t: string) {
  const [h, m] = t.split(':').map(Number)
  const sufijo = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export const rangoHoras = (inicio: string, fin: string) => `${formatoHora(inicio)} – ${formatoHora(fin)}`

// Las horas vienen como 'HH:MM', así que se pueden comparar como texto
export const seSolapan = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && b1 < a2

// ---------- Fechas (siempre como texto 'YYYY-MM-DD' para no depender de la zona horaria) ----------

const aFecha = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const aISO = (f: Date) => f.toISOString().slice(0, 10)

export function hoyISO() {
  const f = new Date()
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

export function sumarDias(iso: string, dias: number) {
  const f = aFecha(iso)
  f.setUTCDate(f.getUTCDate() + dias)
  return aISO(f)
}

// 1 = lunes ... 7 = domingo
export function diaDeSemana(iso: string) {
  const d = aFecha(iso).getUTCDay()
  return d === 0 ? 7 : d
}

export const lunesDeSemana = (iso: string) => sumarDias(iso, 1 - diaDeSemana(iso))

// Lunes de la semana actual; el sábado y el domingo ya muestran la semana siguiente
export function semanaActual() {
  const hoy = hoyISO()
  return diaDeSemana(hoy) >= 6 ? sumarDias(lunesDeSemana(hoy), 7) : lunesDeSemana(hoy)
}

export const esFechaISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(aFecha(s).getTime())

export const fechasDeSemana = (lunes: string) => [0, 1, 2, 3, 4].map(i => sumarDias(lunes, i))

export function formatoCorto(iso: string) {
  const f = aFecha(iso)
  return `${f.getUTCDate()} ${MESES[f.getUTCMonth()].slice(0, 3)}`
}

export function formatoLargo(iso: string) {
  const f = aFecha(iso)
  return `${DIAS[diaDeSemana(iso) - 1] ?? ''} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`
}

export function formatoFecha(iso: string) {
  const f = aFecha(iso)
  return `${f.getUTCDate()} ${MESES[f.getUTCMonth()].slice(0, 3)} ${f.getUTCFullYear()}`
}

export function etiquetaSemana(lunes: string) {
  const viernes = sumarDias(lunes, 4)
  const a = aFecha(lunes), b = aFecha(viernes)
  const mesA = MESES[a.getUTCMonth()].slice(0, 3), mesB = MESES[b.getUTCMonth()].slice(0, 3)
  return mesA === mesB
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${mesB} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${mesA} – ${b.getUTCDate()} ${mesB} ${b.getUTCFullYear()}`
}

// ---------- Días sin clase y planeaciones ----------

export function motivoSinClase(dias: DiaSinClase[], iso: string, seccion: Seccion) {
  const dia = dias.find(d => iso >= d.startDate && iso <= d.endDate && (d.scope === 'all' || d.scope === seccion))
  return dia ? dia.reason : null
}

// Evento del navegador para que el menú del profesor actualice el contador de notificaciones
export const EVENTO_NOTIFICACIONES = 'notificaciones-actualizadas'

export const clavePlaneacion =(gradeId: number, subjectId: string, fecha: string) => `${gradeId}|${subjectId}|${fecha}`
