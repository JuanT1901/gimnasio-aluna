// Tipos y utilidades de certificados y fin de año que se usan en el cliente y en el servidor.
import { normalizarTexto } from 'app/utils/horario/comun'

export type TipoCertificado = 'estudio' | 'promocion' | 'notas'
export type EstadoSolicitud = 'pending_payment' | 'in_review' | 'payment_requested' | 'sent'
export type FormatoNotas = 'preescolar' | 'primaria' | 'secundaria'
export type ResultadoAnio = 'promoted' | 'repeat' | 'left' | 'graduated'
// Revisión del borrador por parte del acudiente
export type EstadoRevision = 'pending' | 'confirmed' | 'changes_requested'

export const ESTADO_ACUDIENTE: Record<EstadoSolicitud, string> = {
  pending_payment: 'Pendiente de pago',
  in_review: 'Comprobante en revisión',
  payment_requested: 'Se solicita el pago del certificado',
  sent: 'Enviado',
}

export const ESTADO_RECTORA: Record<EstadoSolicitud, string> = {
  pending_payment: 'Esperando pago',
  in_review: 'Por revisar',
  payment_requested: 'Se solicitó el pago',
  sent: 'Enviado',
}

export const RESULTADO: Record<ResultadoAnio, string> = {
  promoted: 'Pasa de curso',
  repeat: 'Repite',
  left: 'No continúa',
  graduated: 'Se gradúa',
}

// Etiqueta cuando la rectora ya confirmó el pago pero aún no ha enviado el certificado
export const ESTADO_PAGADO = 'Pago confirmado'

export const REVISION_RECTORA: Record<EstadoRevision, string> = {
  pending: 'Esperando confirmación de datos',
  confirmed: 'Datos confirmados',
  changes_requested: 'Pide corregir datos',
}

export const METODOS_PAGO = ['Transferencia', 'Efectivo'] as const
export const MENSAJE_SOLICITAR_PAGO = 'Aún no hemos recibido el pago de este certificado. Por favor realiza el pago y sube el comprobante o envíalo por WhatsApp.'
export const MAX_COMPROBANTE_MB = 5
export const TIPOS_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export type Colegio = {
  signerName: string
  signerShort: string
  signerTitle: string
  institutionName: string
  city: string
  scheduleText: string
  calendar: string
  resolutionText: string
  daneText: string
  contactPhone: string
  contactEmail: string
  website: string
  addressLine1: string
  addressLine2: string
  whatsappNumber: string
  bankInfo: string | null
  cashInfo: string | null
  signaturePath: string | null
  promotionMinGrade: number
  promotionMaxLostAreas: number
}

export type TipoConfig = {
  code: TipoCertificado
  name: string
  description: string
  price: number | null
  active: boolean
}

// Datos que llenan el texto del certificado; la rectora los puede corregir antes de enviarlo
export type CamposCertificado = {
  fecha: string // fecha de expedición 'YYYY-MM-DD'
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  ciudadDocumento: string
  grado: string // grado oficial, ej. «Quinto»
  nivel: string // ej. «educación básica primaria»
  anio: number | null // año lectivo del certificado de notas o de promoción
  matricula?: number | null // solo en el de estudio, si el acudiente pidió los costos
  pension?: number | null
}

export type FilaNotas = { area: string, subject: string, p: (number | null)[], def: number | null }

// ---------- Grados oficiales ----------

export const GRADOS_OFICIALES = [
  'Pre-kínder', 'Kínder', 'Transición', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto',
  'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Undécimo',
]

export const NIVELES = ['educación preescolar', 'educación básica primaria', 'educación básica secundaria', 'educación media']

export function nivelDeGrado(grado: string | null | undefined) {
  const i = GRADOS_OFICIALES.findIndex(g => normalizarTexto(g) === normalizarTexto(grado ?? ''))
  if (i < 0) return ''
  if (i <= 2) return NIVELES[0]
  if (i <= 7) return NIVELES[1]
  if (i <= 11) return NIVELES[2]
  return NIVELES[3]
}

export function siguienteGrado(grado: string | null | undefined) {
  const i = GRADOS_OFICIALES.findIndex(g => normalizarTexto(g) === normalizarTexto(grado ?? ''))
  return i >= 0 && i < GRADOS_OFICIALES.length - 1 ? GRADOS_OFICIALES[i + 1] : null
}

// Los cursos de cada nivel, igual que en boletines y planillas
export const CURSOS_PREESCOLAR = ['Aventureros', 'Creativos', 'Expertos']
export const CURSOS_PRIMARIA = ['Emprendedores', 'Ingeniosos', 'Transformadores']

export function formatoDeCurso(curso: string | null | undefined, nivel?: string | null): FormatoNotas {
  const n = normalizarTexto(nivel ?? '')
  if (n.includes('preescolar')) return 'preescolar'
  if (n.includes('primaria')) return 'primaria'
  if (n.includes('secundaria') || n.includes('media')) return 'secundaria'
  if (curso && CURSOS_PREESCOLAR.includes(curso)) return 'preescolar'
  if (curso && CURSOS_PRIMARIA.includes(curso)) return 'primaria'
  return 'secundaria'
}

// ---------- Fechas ----------

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const NUMEROS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce',
  'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro',
  'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta', 'treinta y uno']

const partes = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d } }

// 'Septiembre 12 de 2026'
export function fechaEncabezado(iso: string) {
  const { y, m, d } = partes(iso)
  return `${MESES[m - 1]} ${d} de ${y}`
}

// { dia: 'doce (12)', mes: 'Septiembre', anio: 2026 }
export function fechaCierre(iso: string) {
  const { y, m, d } = partes(iso)
  return { dia: `${NUMEROS[d]} (${d})`, mes: MESES[m - 1], anio: y }
}

// ---------- Texto del certificado (el mismo para la vista previa y el PDF) ----------

export type Segmento = { t: string, b?: boolean }
export type TextoCertificado = { fecha: string, fechaAlDerecha: boolean, parrafo: Segmento[], cierre: string | null }

const capitalizarNivel = (nivel: string) => nivel.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

export function textoCertificado(tipo: TipoCertificado, c: CamposCertificado, col: Colegio, formato: FormatoNotas): TextoCertificado {
  const fecha = `${col.city}, ${fechaEncabezado(c.fecha)}`
  const doc = `${c.tipoDocumento || 'documento de identidad'} No. ${c.numeroDocumento}${c.ciudadDocumento ? ` de ${c.ciudadDocumento}` : ''}`
  const inicio: Segmento[] = [
    { t: `La suscrita rectora de la institución Educativa ${col.institutionName}, ` },
    { t: col.signerName, b: true },
    { t: ', certifica que el estudiante: ' },
    { t: c.nombre, b: true },
    { t: `, identificado con ${doc}, ` },
  ]
  const horario = ` en un horario de ${col.scheduleText}, en calendario ${col.calendar}.`
  const { dia, mes, anio } = fechaCierre(c.fecha)
  const cierre = `Se firma en ${col.city} por solicitud y para los fines que al interesado le convengan, a los ${dia} días del mes de ${mes} de ${anio}.`

  if (tipo === 'estudio') {
    const parrafo: Segmento[] = [...inicio, { t: `se encuentra matriculado en esta institución en el nivel ${c.grado} de ${c.nivel}${horario}` }]
    const costos = [
      typeof c.matricula === 'number' && `el valor de la matrícula es de ${formatoPrecio(c.matricula)}`,
      typeof c.pension === 'number' && `el valor de la pensión mensual es de ${formatoPrecio(c.pension)}`,
    ].filter(Boolean) as string[]
    if (costos.length) parrafo.push({ t: ` Para el año ${fechaCierre(c.fecha).anio}, ${costos.join(' y ')}.` })
    return { fecha, fechaAlDerecha: true, cierre, parrafo }
  }
  if (tipo === 'promocion') {
    return { fecha, fechaAlDerecha: true, cierre, parrafo: [...inicio, { t: `fue promovido en esta institución para el año lectivo ${c.anio ?? ''} al nivel ${c.grado} de ${c.nivel}${horario}` }] }
  }
  return {
    fecha,
    fechaAlDerecha: false,
    cierre: null,
    parrafo: [
      { t: `La suscrita rectora de la institución Educativa ${col.institutionName} certifica que: El estudiante: ` },
      { t: c.nombre, b: true },
      { t: ` identificado con documento de identidad No. ${c.numeroDocumento}, ${formato === 'preescolar' ? 'cursó y aprobó' : 'cursó'} el grado ${c.grado.toLowerCase()} de ${capitalizarNivel(c.nivel)} en el año ${c.anio ?? ''} obteniendo las siguientes calificaciones definitivas.` },
    ],
  }
}

// ---------- Notas ----------

export const redondear = (n: number) => Math.round(n * 10) / 10

export function promedio(valores: (number | null | undefined)[]) {
  const v = valores.filter((x): x is number => typeof x === 'number' && !isNaN(x) && x > 0)
  return v.length ? redondear(v.reduce((a, b) => a + b, 0) / v.length) : null
}

// La definitiva es el promedio de los 3 periodos; si falta alguno queda vacía
export function definitiva(p: (number | null)[]) {
  return p.length >= 3 && p.slice(0, 3).every(x => typeof x === 'number' && x > 0) ? promedio(p.slice(0, 3)) : null
}

// Áreas tal como aparecen en los formatos de certificado del colegio
const AREAS_RAW: [string, string[]][] = [
  ['MATEMÁTICAS', ['Matematicas', 'Calculo Mental', 'Geometria', 'Estadistica', 'Estadisticas']],
  ['CIENCIAS NATURALES', ['Ciencias', 'Ciencias Naturales', 'Pre fisica', 'Pre quimica', 'Fisica', 'Quimica']],
  ['CIENCIAS SOCIALES, HISTORIA, GEOGRAFÍA, CONSTITUCIÓN POLÍTICA Y DEMOCRACIA', ['Sociales', 'Ciencias Sociales', 'Historia', 'Geografia', 'Emprendimiento']],
  ['HUMANIDADES', ['Español', 'Lengua Castellana', 'Lectura critica', 'Produccion textual', 'Ingles', 'Idioma Extranjero']],
  ['TECNOLOGÍA E INFORMÁTICA', ['Sistemas', 'Tecnologia']],
  ['EDUCACIÓN ÉTICA Y EN VALORES HUMANOS', ['Etica', 'Etica y Valores']],
  ['EDUCACIÓN RELIGIOSA', ['Religion']],
  ['EDUCACIÓN ARTÍSTICA Y CULTURAL', ['Arte', 'Artes', 'Musica', 'Danzas']],
  ['EDUCACIÓN FÍSICA, RECREACIÓN Y DEPORTES', ['Educacion fisica']],
]
export const ORDEN_AREAS = AREAS_RAW.map(([a]) => a)
const AREA_DE = new Map<string, string>()
for (const [area, materias] of AREAS_RAW) for (const m of materias) AREA_DE.set(normalizarTexto(m), area)

export const areaCertificado = (materia: string) => AREA_DE.get(normalizarTexto(materia)) ?? 'OTRAS ÁREAS'

// Filas vacías de cada formato, para los años que no están en la plataforma
const PLANTILLA_PRIMARIA: [string, string[]][] = [
  ['MATEMÁTICAS', ['Matemáticas', 'Cálculo mental', 'Geometría', 'Estadística']],
  ['CIENCIAS NATURALES', ['Ciencias naturales']],
  ['CIENCIAS SOCIALES, HISTORIA, GEOGRAFÍA, CONSTITUCIÓN POLÍTICA Y DEMOCRACIA', ['Ciencias sociales', 'Geografía', 'Emprendimiento']],
  ['HUMANIDADES', ['Lengua castellana', 'Idioma extranjero']],
  ['TECNOLOGÍA E INFORMÁTICA', ['Sistemas']],
  ['EDUCACIÓN ÉTICA Y EN VALORES HUMANOS', ['Ética y valores']],
  ['EDUCACIÓN RELIGIOSA', ['Religión']],
  ['EDUCACIÓN ARTÍSTICA Y CULTURAL', ['Artes', 'Música', 'Danzas']],
  ['EDUCACIÓN FÍSICA, RECREACIÓN Y DEPORTES', ['Educación física']],
]
const PLANTILLA_SECUNDARIA: [string, string[]][] = PLANTILLA_PRIMARIA.map(([a, m]) =>
  [a, a === 'CIENCIAS NATURALES' ? ['Ciencias naturales', 'Física', 'Química'] : m])
const PLANTILLA_PREESCOLAR = [
  'Dimensión cognitiva: Matemáticas', 'Dimensión cognitiva: Estimulación sensorial', 'Exploración científica y ciencias integradas',
  'Sistemas', 'Dimensión comunicativa: Inglés', 'Dimensión socio-afectiva', 'Dimensión estética: Motricidad fina y artes',
  'Dimensión estética: Danzas y música', 'Dimensión corporal: Educación física',
]

export function plantillaNotas(formato: FormatoNotas): FilaNotas[] {
  if (formato === 'preescolar') return PLANTILLA_PREESCOLAR.map(s => ({ area: '', subject: s, p: [null, null, null], def: null }))
  const base = formato === 'primaria' ? PLANTILLA_PRIMARIA : PLANTILLA_SECUNDARIA
  return base.flatMap(([area, materias]) => materias.map(s => ({ area, subject: s, p: [null, null, null], def: null })))
}

// Ordena por área (en el orden del formato) y deja la definitiva calculada
export function ordenarNotas(filas: FilaNotas[]): FilaNotas[] {
  const pos = (a: string) => { const i = ORDEN_AREAS.indexOf(a); return i < 0 ? 999 : i }
  return [...filas]
    .map(f => ({ ...f, def: definitiva(f.p) }))
    .sort((a, b) => pos(a.area) - pos(b.area))
}

// Áreas perdidas: promedio de las definitivas de sus materias por debajo de la nota mínima
export function areasPerdidas(filas: FilaNotas[], notaMinima: number) {
  const porArea = new Map<string, (number | null)[]>()
  for (const f of filas) {
    if (!f.area) continue
    porArea.set(f.area, [...(porArea.get(f.area) ?? []), f.def ?? promedio(f.p)])
  }
  let perdidas = 0
  for (const defs of porArea.values()) {
    const p = promedio(defs)
    if (p !== null && p < notaMinima) perdidas++
  }
  return perdidas
}

export function formatoPrecio(precio: number | null) {
  if (precio === null || precio === undefined) return 'Por definir'
  return precio.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

// Mensaje de WhatsApp con el número de solicitud para que la rectora sepa a qué certificado corresponde
export function enlaceWhatsapp(numero: string, codigo: string, tipo: string, estudiante: string) {
  const texto = `Hola, envío el comprobante de pago de la solicitud ${codigo} (${tipo} – ${estudiante}).`
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}
