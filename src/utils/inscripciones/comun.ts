// Campos, estados y reglas de las solicitudes de inscripción (cliente y servidor).

export type EstadoInscripcion = 'new' | 'in_process' | 'enrolled' | 'not_continuing'

export const ESTADO_INSCRIPCION: Record<EstadoInscripcion, string> = {
  new: 'Nueva',
  in_process: 'En proceso',
  enrolled: 'Inscrita',
  not_continuing: 'No continúa',
}

// Solicitudes que la familia todavía puede completar y la rectora inscribir
export const ESTADOS_ABIERTOS: EstadoInscripcion[] = ['new', 'in_process']

export const TIPOS_DOCUMENTO: [string, string][] = [
  ['RC', 'Registro Civil'], ['TI', 'Tarjeta de Identidad'], ['CC', 'Cédula de Ciudadanía'],
  ['CE', 'Cédula de Extranjería'], ['PPT', 'PPT / PEP'],
]

export const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
export const TALLAS = ['2', '4', '6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL']
export const EPS_COMUNES = [
  'Sanitas', 'Sura', 'Nueva EPS', 'Compensar', 'Famisanar', 'Salud Total', 'Coosalud', 'Aliansalud',
  'Capital Salud', 'Mutual Ser', 'Medimás', 'Convida', 'Régimen especial (Fuerzas Militares, Policía, Magisterio)',
]
export const RELACIONES_ACUDIENTE = ['Madre', 'Padre', 'Otra persona']
const SI_NO = ['Sí', 'No']

export type TipoCampo = 'text' | 'tel' | 'email' | 'date' | 'sino' | 'select' | 'number'

export type Campo = {
  key: string
  label: string
  tipo: TipoCampo
  opciones?: string[]
  sugerencias?: string[] // lista de ayuda para escribir (datalist)
  ayuda?: string
  ancho?: boolean // ocupa toda la fila
  // El campo solo se muestra si otro campo tiene cierto valor (por ejemplo, la dirección de la ruta)
  si?: { key: string, valor: string }
}

export type Seccion = { id: string, titulo: string, campos: Campo[] }

export const SECCIONES: Seccion[] = [
  {
    id: 'estudiante', titulo: 'Datos del estudiante', campos: [
      { key: 'first_name', label: 'Primer nombre', tipo: 'text' },
      { key: 'second_name', label: 'Segundo nombre', tipo: 'text', ayuda: 'Déjalo vacío si no tiene.' },
      { key: 'first_surname', label: 'Primer apellido', tipo: 'text' },
      { key: 'second_surname', label: 'Segundo apellido', tipo: 'text', ayuda: 'Déjalo vacío si no tiene.' },
      { key: 'birth_date', label: 'Fecha de nacimiento', tipo: 'date' },
      { key: 'doc_expedition_city', label: 'Lugar de expedición del documento', tipo: 'text' },
      { key: 'blood_type', label: 'Grupo sanguíneo (RH)', tipo: 'select', opciones: TIPOS_SANGRE },
      { key: 'eps', label: 'EPS', tipo: 'text', sugerencias: EPS_COMUNES },
      { key: 'siblings_count', label: 'Número de hermanos', tipo: 'number' },
      { key: 'city', label: 'Ciudad de residencia', tipo: 'text' },
      { key: 'neighborhood', label: 'Barrio', tipo: 'text' },
      { key: 'address', label: 'Dirección', tipo: 'text' },
    ],
  },
  {
    id: 'madre', titulo: 'Datos de la madre', campos: [
      { key: 'mother_name', label: 'Nombre completo', tipo: 'text', ancho: true },
      { key: 'mother_doc', label: 'Número de documento', tipo: 'text' },
      { key: 'mother_profession', label: 'Profesión u ocupación', tipo: 'text' },
      { key: 'mother_cellphone', label: 'Celular', tipo: 'tel' },
      { key: 'mother_phone', label: 'Teléfono fijo', tipo: 'tel' },
      { key: 'mother_email', label: 'Correo electrónico', tipo: 'email' },
      { key: 'mother_lives_with_student', label: '¿Vive con el estudiante?', tipo: 'sino', opciones: SI_NO },
    ],
  },
  {
    id: 'padre', titulo: 'Datos del padre', campos: [
      { key: 'father_name', label: 'Nombre completo', tipo: 'text', ancho: true },
      { key: 'father_doc', label: 'Número de documento', tipo: 'text' },
      { key: 'father_profession', label: 'Profesión u ocupación', tipo: 'text' },
      { key: 'father_cellphone', label: 'Celular', tipo: 'tel' },
      { key: 'father_phone', label: 'Teléfono fijo', tipo: 'tel' },
      { key: 'father_email', label: 'Correo electrónico', tipo: 'email' },
      { key: 'father_lives_with_student', label: '¿Vive con el estudiante?', tipo: 'sino', opciones: SI_NO },
    ],
  },
  {
    id: 'acudiente', titulo: 'Acudiente y referencia familiar', campos: [
      { key: 'guardian_relation', label: '¿Quién es el acudiente?', tipo: 'sino', opciones: RELACIONES_ACUDIENTE, ancho: true, ayuda: 'Es la persona que firma la matrícula.' },
      { key: 'guardian_name', label: 'Nombre del acudiente', tipo: 'text', si: { key: 'guardian_relation', valor: 'Otra persona' } },
      { key: 'guardian_cellphone', label: 'Celular del acudiente', tipo: 'tel', si: { key: 'guardian_relation', valor: 'Otra persona' } },
      { key: 'reference_name', label: 'Referencia familiar (emergencias)', tipo: 'text' },
      { key: 'reference_cellphone', label: 'Celular de la referencia', tipo: 'tel' },
    ],
  },
  {
    id: 'servicios', titulo: 'Servicios adicionales', campos: [
      { key: 'extra_shift', label: '¿Necesita jornada adicional?', tipo: 'sino', opciones: SI_NO },
      { key: 'school_bus', label: '¿Tomará ruta escolar?', tipo: 'sino', opciones: SI_NO },
      { key: 'bus_address', label: 'Dirección o barrio para la ruta', tipo: 'text', ancho: true, si: { key: 'school_bus', valor: 'Sí' } },
      { key: 'needs_sweatshirt', label: '¿Necesita buzo?', tipo: 'sino', opciones: SI_NO },
      { key: 'sweatshirt_size', label: 'Talla del buzo', tipo: 'select', opciones: TALLAS, si: { key: 'needs_sweatshirt', valor: 'Sí' } },
      { key: 'needs_tshirt', label: '¿Necesita camiseta?', tipo: 'sino', opciones: SI_NO },
      { key: 'tshirt_size', label: 'Talla de la camiseta', tipo: 'select', opciones: TALLAS, si: { key: 'needs_tshirt', valor: 'Sí' } },
    ],
  },
]

export const CAMPOS: Campo[] = SECCIONES.flatMap(s => s.campos)

export type DatosFicha = Record<string, string>

// Lo mínimo para que la rectora pueda contactar a la familia en la primera solicitud
export function faltantesPrimeraVez(d: DatosFicha): string | null {
  if (!d.first_name?.trim() || !d.first_surname?.trim()) return 'Escribe el primer nombre y el primer apellido del estudiante.'
  if (!d.birth_date) return 'Escribe la fecha de nacimiento del estudiante.'
  if (!d.mother_cellphone?.trim() && !d.father_cellphone?.trim() && !d.guardian_cellphone?.trim()) return 'Escribe al menos un número de celular de contacto.'
  if (!d.mother_email?.trim() && !d.father_email?.trim()) return 'Escribe al menos un correo electrónico (de la madre o del padre).'
  return null
}

// Une los nombres: «Juan» «Diego» «Torres» «Escárraga» → «Juan Diego Torres Escárraga»
export const nombreCompleto = (d: { first_name?: string | null, second_name?: string | null, first_surname?: string | null, second_surname?: string | null }) =>
  [d.first_name, d.second_name, d.first_surname, d.second_surname].map(x => (x ?? '').trim().replace(/\s+/g, ' ')).filter(Boolean).join(' ')

const limpiarParaUsuario = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Regla del colegio: primer nombre completo + inicial del segundo + primer apellido completo + inicial del segundo.
// «Juan Diego Torres Escárraga» → «juandtorrese»
export function usuarioSugerido(d: { first_name?: string | null, second_name?: string | null, first_surname?: string | null, second_surname?: string | null }) {
  return limpiarParaUsuario(d.first_name) + limpiarParaUsuario(d.second_name).slice(0, 1) +
    limpiarParaUsuario(d.first_surname) + limpiarParaUsuario(d.second_surname).slice(0, 1)
}

// El usuario solo admite letras minúsculas, números y punto
export const limpiarUsuario = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]/g, '')

export const DOMINIO_USUARIOS = '@aluna.edu.co'
