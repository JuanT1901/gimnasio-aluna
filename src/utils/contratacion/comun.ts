// Contratación de docentes: el docente llena un formulario con el enlace que comparte la rectora,
// y la rectora revisa los datos, le asigna cursos y lo contrata (se crea su cuenta de docente).

export type EstadoPostulacion = 'pending' | 'hired' | 'discarded'

export const ESTADO_POSTULACION: Record<EstadoPostulacion, string> = {
  pending: 'Por revisar',
  hired: 'Contratado',
  discarded: 'Descartado',
}

export const TIPOS_DOCUMENTO_DOCENTE: [string, string][] = [
  ['CC', 'Cédula de Ciudadanía'], ['CE', 'Cédula de Extranjería'], ['PPT', 'PPT / PEP'], ['PA', 'Pasaporte'],
]

export type CampoDocente = {
  clave: string
  etiqueta: string
  tipo: 'text' | 'tel' | 'email' | 'date' | 'select' | 'textarea'
  obligatorio?: boolean
  opciones?: [string, string][]
  ancho?: 'completo'
  ayuda?: string
  max?: number
}

export type SeccionDocente = { id: string, titulo: string, campos: CampoDocente[] }

export const SECCIONES_DOCENTE: SeccionDocente[] = [
  {
    id: 'personal', titulo: 'Datos personales', campos: [
      { clave: 'first_name', etiqueta: 'Primer nombre', tipo: 'text', obligatorio: true },
      { clave: 'second_name', etiqueta: 'Segundo nombre', tipo: 'text' },
      { clave: 'first_surname', etiqueta: 'Primer apellido', tipo: 'text', obligatorio: true },
      { clave: 'second_surname', etiqueta: 'Segundo apellido', tipo: 'text' },
      { clave: 'doc_type', etiqueta: 'Tipo de documento', tipo: 'select', obligatorio: true, opciones: TIPOS_DOCUMENTO_DOCENTE },
      { clave: 'doc_number', etiqueta: 'Número de documento', tipo: 'text', obligatorio: true },
      { clave: 'doc_expedition_city', etiqueta: 'Lugar de expedición', tipo: 'text' },
      { clave: 'birth_date', etiqueta: 'Fecha de nacimiento', tipo: 'date', obligatorio: true },
    ],
  },
  {
    id: 'contacto', titulo: 'Contacto', campos: [
      { clave: 'phone', etiqueta: 'Celular', tipo: 'tel', obligatorio: true },
      { clave: 'email', etiqueta: 'Correo electrónico', tipo: 'email', obligatorio: true },
      { clave: 'address', etiqueta: 'Dirección de residencia', tipo: 'text', obligatorio: true },
      { clave: 'neighborhood', etiqueta: 'Barrio', tipo: 'text' },
      { clave: 'city', etiqueta: 'Ciudad', tipo: 'text' },
    ],
  },
  {
    id: 'formacion', titulo: 'Formación y experiencia', campos: [
      { clave: 'profession', etiqueta: 'Título profesional', tipo: 'text', obligatorio: true, ancho: 'completo', ayuda: 'Ej: Licenciada en Educación Infantil' },
      { clave: 'experience', etiqueta: 'Experiencia docente', tipo: 'textarea', ancho: 'completo', max: 1500, ayuda: 'Colegios, cursos o áreas en las que ha trabajado y cuánto tiempo.' },
    ],
  },
  {
    id: 'seguridad', titulo: 'Seguridad social', campos: [
      { clave: 'eps', etiqueta: 'EPS', tipo: 'text' },
      { clave: 'arl', etiqueta: 'ARL', tipo: 'text' },
      { clave: 'pension_fund', etiqueta: 'Fondo de pensiones', tipo: 'text' },
      { clave: 'compensation_fund', etiqueta: 'Caja de compensación', tipo: 'text' },
    ],
  },
  {
    id: 'emergencia', titulo: 'Contacto de emergencia', campos: [
      { clave: 'emergency_name', etiqueta: 'Nombre', tipo: 'text' },
      { clave: 'emergency_phone', etiqueta: 'Celular', tipo: 'tel' },
    ],
  },
]

export const CAMPOS_DOCENTE = SECCIONES_DOCENTE.flatMap(s => s.campos)

export type FichaDocente = Record<string, string>

export function faltantesDocente(d: FichaDocente): string | null {
  const falta = CAMPOS_DOCENTE.find(c => c.obligatorio && !d[c.clave]?.trim())
  if (falta) return `Falta: ${falta.etiqueta.toLowerCase()}.`
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) return 'Escribe un correo electrónico válido.'
  return null
}

// Clase que la rectora le asigna antes de contratarlo
export type ClasePlaneada = { gradeId: number, subjectName: string }

export type Postulacion = {
  id: number
  status: EstadoPostulacion
  ficha: FichaDocente
  clases: ClasePlaneada[]
  direccion: number[] // cursos de los que será director de grupo
  username: string | null
  hiredProfileId: string | null
  hiredAt: string | null
  adminNotes: string | null
  createdAt: string
  nueva: boolean // la rectora aún no la ha abierto
}

export const ruta = (token: string) => `/registro-docente/${token}`
