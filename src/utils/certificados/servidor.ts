// Funciones de certificados y fin de año que solo se ejecutan en el servidor.
import { randomBytes } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdmin, obtenerSesion } from 'app/utils/horario/servidor'
import { hoyISO } from 'app/utils/horario/comun'
import { aplicarHabilitaciones, cargarHabilitaciones } from 'app/utils/habilitaciones/servidor'
import {
  type CamposCertificado, type Colegio, type FilaNotas, type FormatoNotas, type TipoCertificado, type TipoConfig,
  MAX_COMPROBANTE_MB, TIPOS_COMPROBANTE, areaCertificado, formatoDeCurso, nivelDeGrado, ordenarNotas, plantillaNotas, promedio,
} from './comun'

export { getAdmin, obtenerSesion }

export const BUCKET = 'certificados'

// ---------- Configuración ----------

export async function cargarColegio(admin: SupabaseClient): Promise<Colegio> {
  const { data: s } = await admin.from('school_settings').select('*').eq('id', 1).maybeSingle()
  return {
    signerName: s?.signer_name ?? 'Ángela Yohanna Castañeda Olivares',
    signerShort: s?.signer_short ?? 'ANGELA YOHANNA CASTAÑEDA O.',
    signerTitle: s?.signer_title ?? 'Rectora',
    institutionName: s?.institution_name ?? 'Ludo Club Aventuras Creativas',
    city: s?.city ?? 'Zipaquirá',
    scheduleText: s?.schedule_text ?? 'lunes a viernes de 7:00 a.m. a 2:00 p.m.',
    scheduleTextPreschool: s?.schedule_text_preschool ?? 'lunes a viernes de 8:00 a.m. a 1:00 p.m.',
    calendar: s?.calendar ?? 'A',
    resolutionText: s?.resolution_text ?? '',
    daneText: s?.dane_text ?? '',
    contactPhone: s?.contact_phone ?? '',
    contactEmail: s?.contact_email ?? '',
    website: s?.website ?? '',
    addressLine1: s?.address_line1 ?? '',
    addressLine2: s?.address_line2 ?? '',
    whatsappNumber: s?.whatsapp_number ?? '',
    bankInfo: s?.bank_info ?? null,
    cashInfo: s?.cash_info ?? null,
    signaturePath: s?.signature_path ?? null,
    promotionMinGrade: Number(s?.promotion_min_grade ?? 3.5),
  }
}

export async function cargarTipos(admin: SupabaseClient, soloActivos = false): Promise<TipoConfig[]> {
  let q = admin.from('certificate_types').select('code, name, description, price, active').order('sort', { ascending: true })
  if (soloActivos) q = q.eq('active', true)
  const { data } = await q
  return (data || []).map(t => ({
    code: t.code, name: t.name, description: t.description,
    price: t.price === null ? null : Number(t.price), active: t.active,
  }))
}

export async function anioActivo(admin: SupabaseClient) {
  const { data } = await admin.from('school_years').select('year').eq('status', 'active').order('year', { ascending: false }).limit(1).maybeSingle()
  return data?.year ?? new Date().getFullYear()
}

// ---------- Estudiante ----------

export type Estudiante = {
  id: string
  fullName: string
  docType: string
  docNumber: string
  docCity: string
  birthDate: string | null
  courseName: string | null
  gradeId: number | null
  officialGrade: string
  officialLevel: string
  status: string
  motherName: string | null
  motherEmail: string | null
  motherLives: boolean
  fatherName: string | null
  fatherEmail: string | null
  fatherLives: boolean
  tuitionFee: number | null // matrícula y pensión del curso, para el certificado de estudio
  monthlyFee: number | null
}

const esSi = (v: unknown) => v === true || ['si', 'sí', 'true', 's', 'yes', '1'].includes(String(v ?? '').trim().toLowerCase())

export async function cargarEstudiante(admin: SupabaseClient, id: string): Promise<Estudiante | null> {
  const { data: p } = await admin
    .from('profiles')
    .select('id, role, full_name, doc_type, doc_number, doc_expedition_city, birth_date, course_name, grade_id, official_grade, student_status, mother_name, mother_email, mother_lives_with_student, father_name, father_email, father_lives_with_student')
    .eq('id', id)
    .maybeSingle()
  if (!p || p.role !== 'student') return null

  const { data: g } = p.grade_id
    ? await admin.from('grades').select('official_grade, official_level, tuition_fee, monthly_fee').eq('id', p.grade_id).maybeSingle()
    : { data: null }

  const grado = p.official_grade || g?.official_grade || ''
  return {
    id: p.id,
    fullName: p.full_name ?? '',
    docType: nombreDocumento(p.doc_type),
    docNumber: p.doc_number ?? '',
    docCity: p.doc_expedition_city ?? '',
    birthDate: p.birth_date ? String(p.birth_date) : null,
    courseName: p.course_name ?? null,
    gradeId: p.grade_id ?? null,
    officialGrade: grado,
    officialLevel: g?.official_level || nivelDeGrado(grado),
    status: p.student_status ?? 'active',
    motherName: p.mother_name ?? null,
    motherEmail: p.mother_email ?? null,
    motherLives: esSi(p.mother_lives_with_student),
    fatherName: p.father_name ?? null,
    fatherEmail: p.father_email ?? null,
    fatherLives: esSi(p.father_lives_with_student),
    tuitionFee: g?.tuition_fee == null ? null : Number(g.tuition_fee),
    monthlyFee: g?.monthly_fee == null ? null : Number(g.monthly_fee),
  }
}

const DOCUMENTOS: Record<string, string> = {
  TI: 'Tarjeta de Identidad', RC: 'Registro Civil', CC: 'Cédula de Ciudadanía', CE: 'Cédula de Extranjería', PA: 'Pasaporte', NUIP: 'NUIP',
}
export const nombreDocumento = (t: string | null | undefined) => (t ? DOCUMENTOS[t.trim().toUpperCase()] ?? t : 'Tarjeta de Identidad')

// Grado oficial del estudiante en un año: el actual, o el que quedó en el historial
async function gradoEnAnio(admin: SupabaseClient, est: Estudiante, tipo: TipoCertificado, anio: number | null, activo: number) {
  if (!anio || anio === activo) return { grado: est.officialGrade, nivel: est.officialLevel }
  const { data: h } = await admin
    .from('student_year_history')
    .select('school_year, official_grade, official_level, next_official_grade, result')
    .eq('student_id', est.id)
    .in('school_year', [anio, anio - 1])
  const delAnio = (h || []).find(x => x.school_year === anio)
  const anterior = (h || []).find(x => x.school_year === anio - 1)
  // Promoción al año X = el grado que cursó en X (el siguiente del año anterior si fue promovido)
  const grado = tipo === 'promocion'
    ? delAnio?.official_grade || (anterior?.result === 'promoted' ? anterior.next_official_grade : anterior?.official_grade) || ''
    : delAnio?.official_grade || ''
  return { grado: grado ?? '', nivel: (tipo === 'notas' ? delAnio?.official_level : null) || nivelDeGrado(grado) }
}

export async function camposIniciales(admin: SupabaseClient, est: Estudiante, tipo: TipoCertificado, anio: number | null, hoy: string, conCostos = false): Promise<CamposCertificado> {
  const activo = await anioActivo(admin)
  const { grado, nivel } = await gradoEnAnio(admin, est, tipo, anio, activo)
  const costos = tipo === 'estudio' && conCostos
  return {
    fecha: hoy,
    nombre: est.fullName,
    tipoDocumento: est.docType,
    numeroDocumento: est.docNumber,
    ciudadDocumento: est.docCity,
    grado,
    nivel,
    anio: tipo === 'estudio' ? null : anio,
    matricula: costos ? est.tuitionFee : null,
    pension: costos ? est.monthlyFee : null,
  }
}

// ---------- Notas ----------

type Competencia = { nota?: number | string, Nota?: number | string, score?: number | string, calificacion?: number | string }

function notaDeCompetencias(datos: unknown) {
  let lista: Competencia[] = []
  if (typeof datos === 'string') { try { lista = JSON.parse(datos) } catch { lista = [] } }
  else if (Array.isArray(datos)) lista = datos
  else if (datos && typeof datos === 'object') lista = Object.values(datos)
  return promedio(lista.map(c => parseFloat(String(c?.nota ?? c?.Nota ?? c?.score ?? c?.calificacion ?? ''))))
}

// Notas del año en curso tomadas de las planillas: una fila por materia con la nota de cada periodo
export async function notasActuales(admin: SupabaseClient, studentIds: string[]): Promise<Map<string, FilaNotas[]>> {
  const resultado = new Map<string, Map<string, FilaNotas>>()
  if (!studentIds.length) return new Map()

  const agregar = (studentId: string, materia: string, periodo: number, nota: number | null, preescolar: boolean) => {
    if (!materia || periodo < 1 || periodo > 3) return
    const porMateria = resultado.get(studentId) ?? new Map<string, FilaNotas>()
    const fila = porMateria.get(materia) ?? { area: preescolar ? '' : areaCertificado(materia), subject: materia, p: [null, null, null], def: null }
    fila.p[periodo - 1] = nota
    porMateria.set(materia, fila)
    resultado.set(studentId, porMateria)
  }

  for (let i = 0; i < studentIds.length; i += 200) {
    const ids = studentIds.slice(i, i + 200)
    const [{ data: prim }, { data: avan }, { data: pre }] = await Promise.all([
      admin.from('primary_evaluations').select('student_id, subject_name, period, competencies_data').in('student_id', ids),
      admin.from('advanced_evaluations').select('student_id, subject_name, period, competencies_data').in('student_id', ids),
      admin.from('preschool_evaluations').select('student_id, dimension, period, competencies_data').in('student_id', ids),
    ])
    for (const e of [...(prim || []), ...(avan || [])]) agregar(e.student_id, e.subject_name, Number(e.period), notaDeCompetencias(e.competencies_data), false)
    for (const e of pre || []) agregar(e.student_id, e.dimension, Number(e.period), notaDeCompetencias(e.competencies_data), true)
  }

  return new Map([...resultado.entries()].map(([id, m]) => [id, ordenarNotas([...m.values()])]))
}

export async function notasParaCertificado(admin: SupabaseClient, est: Estudiante, anio: number, formato: FormatoNotas) {
  const activo = await anioActivo(admin)
  if (anio === activo) {
    const [notas, registros, colegio] = await Promise.all([notasActuales(admin, [est.id]), cargarHabilitaciones(admin, anio, [est.id]), cargarColegio(admin)])
    const filas = aplicarHabilitaciones(notas.get(est.id) ?? [], registros, est.id, colegio.promotionMinGrade)
    if (filas.length) return { filas, origen: 'plataforma' as const }
  } else {
    const { data: h } = await admin.from('student_year_history').select('final_grades').eq('student_id', est.id).eq('school_year', anio).maybeSingle()
    if (Array.isArray(h?.final_grades) && h.final_grades.length) return { filas: ordenarNotas(h.final_grades as FilaNotas[]), origen: 'historial' as const }
  }
  return { filas: plantillaNotas(formato), origen: 'manual' as const }
}

export const formatoDeEstudiante = (est: Estudiante) => formatoDeCurso(est.courseName, est.officialLevel)

// ---------- Archivos privados (bucket «certificados») ----------

export async function subirArchivo(admin: SupabaseClient, ruta: string, datos: ArrayBuffer | Buffer, tipo: string) {
  const { error } = await admin.storage.from(BUCKET).upload(ruta, datos, { contentType: tipo, upsert: true })
  return error ? error.message : null
}

export async function enlaceTemporal(admin: SupabaseClient, ruta: string | null, segundos = 600) {
  if (!ruta) return null
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(ruta, segundos)
  return data?.signedUrl ?? null
}

export async function descargarArchivo(admin: SupabaseClient, ruta: string | null) {
  if (!ruta) return null
  const { data } = await admin.storage.from(BUCKET).download(ruta)
  return data ? Buffer.from(await data.arrayBuffer()) : null
}

export const extensionDe = (tipo: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[tipo] ?? 'bin')

// ---------- Logos (los mismos de los boletines) ----------

export async function leerImagenPublica(nombre: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), 'public', nombre))
  } catch {
    // En Vercel, si el archivo no quedó junto a la función, se descarga del propio sitio
    try {
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host')
      if (!host) return null
      const proto = h.get('x-forwarded-proto') ?? 'https'
      const r = await fetch(`${proto}://${host}/${nombre}`)
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null
    } catch {
      return null
    }
  }
}

// ---------- Código de verificación ----------

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function codigoVerificacion() {
  const bytes = randomBytes(8)
  const c = [...bytes].map(b => ALFABETO[b % ALFABETO.length]).join('')
  return `${c.slice(0, 4)}-${c.slice(4)}`
}

// ---------- Correo (Resend) ----------

export async function enviarCorreo(datos: { para: string, asunto: string, html: string, adjunto?: { nombre: string, contenido: Buffer } }) {
  const clave = process.env.RESEND_API_KEY
  if (!clave) return { exito: false, error: 'El envío de correos aún no está configurado: falta RESEND_API_KEY (ver supabase/configuracion_resend.md).' }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CERTIFICADOS_REMITENTE || 'Ludo Club <certificados@ludoclub.edu.co>',
      to: [datos.para],
      reply_to: process.env.CERTIFICADOS_RESPONDER_A || undefined,
      subject: datos.asunto,
      html: datos.html,
      attachments: datos.adjunto ? [{ filename: datos.adjunto.nombre, content: datos.adjunto.contenido.toString('base64') }] : undefined,
    }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    return { exito: false, error: `No se pudo enviar el correo (${respuesta.status}). ${detalle.slice(0, 200)}` }
  }
  return { exito: true }
}

// ---------- Comprobantes de pago (acudientes y exalumnos) ----------

const PUEDE_ENVIAR_COMPROBANTE = ['pending_payment', 'payment_requested', 'in_review']

export async function registrarComprobante(admin: SupabaseClient, requestId: number, archivo: unknown) {
  if (!(archivo instanceof File) || archivo.size === 0) return { exito: false, error: 'Selecciona la foto o el PDF del comprobante.' }
  if (!TIPOS_COMPROBANTE.includes(archivo.type)) return { exito: false, error: 'El comprobante debe ser una imagen (JPG, PNG) o un PDF.' }
  if (archivo.size > MAX_COMPROBANTE_MB * 1024 * 1024) return { exito: false, error: `El archivo no puede pasar de ${MAX_COMPROBANTE_MB} MB.` }

  const { data: r } = await admin.from('certificate_requests').select('status').eq('id', requestId).maybeSingle()
  if (!r || !PUEDE_ENVIAR_COMPROBANTE.includes(r.status)) return { exito: false, error: 'Esta solicitud ya no recibe comprobantes.' }

  const ruta = `solicitudes/${requestId}/comprobante-${Date.now()}.${extensionDe(archivo.type)}`
  const errorSubida = await subirArchivo(admin, ruta, await archivo.arrayBuffer(), archivo.type)
  if (errorSubida) return { exito: false, error: `No se pudo subir el comprobante: ${errorSubida}` }

  const ahora = new Date().toISOString()
  // admin_seen_at en null vuelve a encender la campana de la rectora
  const { error } = await admin.from('certificate_requests').update({
    status: 'in_review', proof_via: 'upload', proof_path: ruta, proof_at: ahora, admin_seen_at: null, updated_at: ahora,
  }).eq('id', requestId)
  return error ? { exito: false, error: error.message } : { exito: true }
}

export async function registrarAvisoWhatsapp(admin: SupabaseClient, requestId: number) {
  const { data: r } = await admin.from('certificate_requests').select('status').eq('id', requestId).maybeSingle()
  if (!r || !PUEDE_ENVIAR_COMPROBANTE.includes(r.status)) return { exito: false, error: 'Esta solicitud ya no recibe comprobantes.' }
  const ahora = new Date().toISOString()
  const { error } = await admin.from('certificate_requests').update({
    status: 'in_review', proof_via: 'whatsapp', proof_at: ahora, admin_seen_at: null, updated_at: ahora,
  }).eq('id', requestId)
  return error ? { exito: false, error: error.message } : { exito: true }
}

// Un mismo documento puede estar escrito «1.076.250.048» o «1076250048»
export const soloDigitos = (doc: string) => doc.replace(/[^0-9A-Za-z]/g, '')
export function variantesDocumento(doc: string) {
  const limpio = soloDigitos(doc)
  const conPuntos = /^\d+$/.test(limpio) ? limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : limpio
  return [...new Set([doc.trim(), limpio, conPuntos].filter(Boolean))]
}

export const escaparHtml =(s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

// Solo acepta correos con forma válida
export const esCorreo = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

// ---------- Borrador ----------

export type FilaSolicitud = {
  type_code: TipoCertificado, cert_year: number | null, status: string, student_profile_id: string | null, alumni_id: number | null,
  student_name: string, doc_type: string | null, doc_number: string | null, include_costs: boolean | null,
  fields: Partial<CamposCertificado> | null, grades_table: FilaNotas[] | null,
}

export type OrigenNotas = 'plataforma' | 'historial' | 'manual' | 'guardado'

// Datos del certificado tal como saldrían hoy: los del sistema, con lo que la rectora ya corrigió encima.
// Es lo mismo que ve la rectora en el detalle y el acudiente en el borrador.
export async function armarBorrador(admin: SupabaseClient, r: FilaSolicitud) {
  const est = r.student_profile_id ? await cargarEstudiante(admin, r.student_profile_id) : null
  const { data: alumno } = r.alumni_id ? await admin.from('alumni').select('*').eq('id', r.alumni_id).maybeSingle() : { data: null }

  let campos: CamposCertificado
  let formato: FormatoNotas
  if (est) {
    campos = await camposIniciales(admin, est, r.type_code, r.cert_year, hoyISO(), !!r.include_costs)
    formato = r.type_code === 'notas' && campos.nivel ? formatoDeCurso(null, campos.nivel) : formatoDeEstudiante(est)
  } else {
    const grado = alumno?.last_grade ?? ''
    campos = {
      fecha: hoyISO(), nombre: r.student_name, tipoDocumento: r.doc_type ?? alumno?.doc_type ?? 'Tarjeta de Identidad',
      numeroDocumento: r.doc_number ?? alumno?.doc_number ?? '', ciudadDocumento: '', grado, nivel: nivelDeGrado(grado),
      anio: r.type_code === 'estudio' ? null : r.cert_year,
    }
    formato = formatoDeCurso(alumno?.last_course ?? null, nivelDeGrado(grado))
  }
  // Lo que la rectora ya corrigió tiene prioridad sobre los datos del sistema
  if (r.fields) campos = { ...campos, ...r.fields, fecha: r.status === 'sent' ? r.fields.fecha ?? campos.fecha : hoyISO() }

  let notas: FilaNotas[] | null = null
  let origenNotas: OrigenNotas | null = null
  if (r.type_code === 'notas') {
    if (Array.isArray(r.grades_table) && r.grades_table.length) {
      notas = r.grades_table
      origenNotas = 'guardado'
    } else if (est && r.cert_year) {
      const n = await notasParaCertificado(admin, est, r.cert_year, formato)
      notas = n.filas
      origenNotas = n.origen
    } else {
      notas = plantillaNotas(formato)
      origenNotas = 'manual'
    }
  }
  return { est, alumno, campos, formato, notas, origenNotas }
}
