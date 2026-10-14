'use server'

import { verificarRol } from 'app/utils/supabase/auth-check'
import { hoyISO } from 'app/utils/horario/comun'
import {
  type CamposCertificado, type Colegio, type EstadoSolicitud, type FilaNotas, type FormatoNotas, type TipoCertificado, type TipoConfig,
  GRADOS_OFICIALES, METODOS_PAGO, formatoDeCurso, nivelDeGrado, ordenarNotas, plantillaNotas,
} from 'app/utils/certificados/comun'
import {
  getAdmin, cargarColegio, cargarTipos, cargarEstudiante, camposIniciales, notasParaCertificado, formatoDeEstudiante,
  subirArchivo, enlaceTemporal, descargarArchivo, leerImagenPublica, codigoVerificacion, enviarCorreo, escaparHtml, esCorreo,
} from 'app/utils/certificados/servidor'
import { generarPdfCertificado } from 'app/utils/certificados/pdf'

type Admin = ReturnType<typeof getAdmin>

// ================= LISTA Y AVISOS =================

export type ResumenSolicitud = {
  id: number
  code: string
  typeCode: TipoCertificado
  typeName: string
  certYear: number | null
  studentName: string
  course: string | null
  requesterName: string
  status: EstadoSolicitud
  proofVia: 'upload' | 'whatsapp' | null
  pagado: boolean
  origin: 'portal' | 'public'
  registered: boolean
  nueva: boolean
  createdAt: string
}

export async function contarSolicitudesNuevas() {
  const { autorizado } = await verificarRol('admin')
  if (!autorizado) return 0
  const { count } = await getAdmin().from('certificate_requests').select('id', { count: 'exact', head: true }).is('admin_seen_at', null)
  return count ?? 0
}

export async function obtenerSolicitudes(): Promise<{ exito: boolean, error?: string, solicitudes?: ResumenSolicitud[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data, error } = await admin
    .from('certificate_requests')
    .select('id, code, type_code, cert_year, student_name, student_profile_id, alumni_id, requester_name, status, proof_via, payment_method, origin, registered, admin_seen_at, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { exito: false, error: error.message }

  const [tipos, cursos] = await Promise.all([cargarTipos(admin), cursosDe(admin, data || [])])
  const nombreTipo = new Map(tipos.map(t => [t.code, t.name]))

  return {
    exito: true,
    solicitudes: (data || []).map(r => ({
      id: r.id,
      code: r.code,
      typeCode: r.type_code,
      typeName: nombreTipo.get(r.type_code) ?? r.type_code,
      certYear: r.cert_year,
      studentName: r.student_name,
      course: cursos.get(r.id) ?? null,
      requesterName: r.requester_name,
      status: r.status,
      proofVia: r.proof_via,
      pagado: !!r.payment_method,
      origin: r.origin,
      registered: r.registered,
      nueva: !r.admin_seen_at,
      createdAt: r.created_at,
    })),
  }
}

async function cursosDe(admin: Admin, filas: { id: number, student_profile_id: string | null, alumni_id: number | null }[]) {
  const perfiles = [...new Set(filas.map(f => f.student_profile_id).filter(Boolean))] as string[]
  const exalumnos = [...new Set(filas.map(f => f.alumni_id).filter(Boolean))] as number[]
  const [{ data: p }, { data: a }] = await Promise.all([
    perfiles.length ? admin.from('profiles').select('id, course_name').in('id', perfiles) : Promise.resolve({ data: [] as { id: string, course_name: string | null }[] }),
    exalumnos.length ? admin.from('alumni').select('id, exit_year').in('id', exalumnos) : Promise.resolve({ data: [] as { id: number, exit_year: number | null }[] }),
  ])
  const curso = new Map((p || []).map(x => [x.id, x.course_name]))
  const salida = new Map((a || []).map(x => [x.id, x.exit_year]))
  return new Map(filas.map(f => [f.id,
    f.student_profile_id && curso.get(f.student_profile_id) ? curso.get(f.student_profile_id)!
      : f.alumni_id ? `Exalumno${salida.get(f.alumni_id) ? ` (${salida.get(f.alumni_id)})` : ''}` : null]))
}

// ================= DETALLE =================

export type DetalleSolicitud = {
  id: number
  code: string
  tipo: TipoCertificado
  tipoNombre: string
  status: EstadoSolicitud
  origin: 'portal' | 'public'
  registered: boolean
  studentName: string
  course: string | null
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  comment: string | null
  createdAt: string
  proofVia: 'upload' | 'whatsapp' | null
  proofAt: string | null
  proofUrl: string | null
  proofIsPdf: boolean
  adminMessage: string | null
  paymentMethod: string | null
  sentAt: string | null
  sentTo: string | null
  verificationCode: string | null
  pdfUrl: string | null
  campos: CamposCertificado
  formato: FormatoNotas
  notas: FilaNotas[] | null
  origenNotas: 'plataforma' | 'historial' | 'manual' | 'guardado' | null
  colegio: Colegio
  firmaUrl: string | null
}

async function armarDetalle(admin: Admin, id: number): Promise<DetalleSolicitud | null> {
  const { data: r } = await admin.from('certificate_requests').select('*').eq('id', id).maybeSingle()
  if (!r) return null

  const [colegio, tipos] = await Promise.all([cargarColegio(admin), cargarTipos(admin)])
  const est = r.student_profile_id ? await cargarEstudiante(admin, r.student_profile_id) : null
  const { data: alumno } = r.alumni_id ? await admin.from('alumni').select('*').eq('id', r.alumni_id).maybeSingle() : { data: null }

  let campos: CamposCertificado
  let formato: FormatoNotas
  if (est) {
    campos = await camposIniciales(admin, est, r.type_code, r.cert_year, hoyISO())
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
  let origenNotas: DetalleSolicitud['origenNotas'] = null
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

  const [proofUrl, pdfUrl, firmaUrl] = await Promise.all([
    enlaceTemporal(admin, r.proof_path), enlaceTemporal(admin, r.pdf_path), enlaceTemporal(admin, colegio.signaturePath),
  ])

  return {
    id: r.id, code: r.code, tipo: r.type_code, tipoNombre: tipos.find(t => t.code === r.type_code)?.name ?? r.type_code,
    status: r.status, origin: r.origin, registered: r.registered, studentName: r.student_name,
    course: est?.courseName ?? (alumno ? `Exalumno${alumno.exit_year ? ` (${alumno.exit_year})` : ''}` : null),
    requesterName: r.requester_name, requesterEmail: r.requester_email, requesterPhone: r.requester_phone, comment: r.comment,
    createdAt: r.created_at, proofVia: r.proof_via, proofAt: r.proof_at, proofUrl, proofIsPdf: (r.proof_path ?? '').endsWith('.pdf'),
    adminMessage: r.admin_message, paymentMethod: r.payment_method, sentAt: r.sent_at, sentTo: r.sent_to,
    verificationCode: r.verification_code, pdfUrl, campos, formato, notas, origenNotas, colegio, firmaUrl,
  }
}

export async function obtenerSolicitud(id: number): Promise<{ exito: boolean, error?: string, detalle?: DetalleSolicitud }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const detalle = await armarDetalle(admin, id)
  if (!detalle) return { exito: false, error: 'La solicitud no existe.' }
  // Al abrirla, deja de contar en la campana
  await admin.from('certificate_requests').update({ admin_seen_at: new Date().toISOString() }).eq('id', id).is('admin_seen_at', null)
  return { exito: true, detalle }
}

function limpiarCampos(c: CamposCertificado): CamposCertificado {
  const t = (v: unknown) => String(v ?? '').trim().slice(0, 200)
  return {
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha : hoyISO(),
    nombre: t(c.nombre), tipoDocumento: t(c.tipoDocumento), numeroDocumento: t(c.numeroDocumento), ciudadDocumento: t(c.ciudadDocumento),
    grado: t(c.grado), nivel: t(c.nivel), anio: c.anio ? Number(c.anio) || null : null,
  }
}

function limpiarNotas(filas: FilaNotas[] | null) {
  if (!filas) return null
  const nota = (v: unknown) => { const n = Number(v); return v === null || v === '' || isNaN(n) ? null : Math.min(5, Math.max(0, n)) }
  return ordenarNotas(filas.slice(0, 60).map(f => ({
    area: String(f.area ?? '').slice(0, 120), subject: String(f.subject ?? '').slice(0, 120),
    p: [nota(f.p?.[0]), nota(f.p?.[1]), nota(f.p?.[2])], def: null,
  })).filter(f => f.subject.trim()))
}

export async function guardarDatosCertificado(id: number, campos: CamposCertificado, notas: FilaNotas[] | null) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const { error } = await getAdmin()
    .from('certificate_requests')
    .update({ fields: limpiarCampos(campos), grades_table: limpiarNotas(notas), updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'sent')
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

const FORMATOS: FormatoNotas[] = ['preescolar', 'primaria', 'secundaria']

async function armarPdf(admin: Admin, id: number, campos: CamposCertificado, notas: FilaNotas[] | null, formatoPedido: FormatoNotas, verificacion: string | null) {
  const { data: r } = await admin.from('certificate_requests').select('code, type_code').eq('id', id).maybeSingle()
  if (!r) throw new Error('La solicitud no existe.')
  const colegio = await cargarColegio(admin)
  const c = limpiarCampos(campos)
  const [firma, logoAluna, logoLudo] = await Promise.all([
    descargarArchivo(admin, colegio.signaturePath), leerImagenPublica('logo.jpeg'), leerImagenPublica('logo-ludo.png'),
  ])
  const formato = FORMATOS.includes(formatoPedido) ? formatoPedido : formatoDeCurso(null, c.nivel)
  const pdf = await generarPdfCertificado({
    colegio, tipo: r.type_code, campos: c, formato, notas: r.type_code === 'notas' ? limpiarNotas(notas) : null,
    codigo: r.code, verificacion, firma, logoAluna, logoLudo,
  })
  return { pdf, code: r.code as string, tipo: r.type_code as TipoCertificado, firma: !!firma }
}

export async function vistaPreviaPdf(id: number, campos: CamposCertificado, notas: FilaNotas[] | null, formato: FormatoNotas) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  try {
    const { pdf } = await armarPdf(getAdmin(), id, campos, notas, formato, null)
    return { exito: true, base64: pdf.toString('base64') }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'No se pudo generar la vista previa.' }
  }
}

export async function solicitarPago(id: number, mensaje: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const texto = mensaje.trim().slice(0, 1000)
  if (!texto) return { exito: false, error: 'Escribe el mensaje para el solicitante.' }

  const { error } = await getAdmin()
    .from('certificate_requests')
    .update({ status: 'payment_requested', admin_message: texto, payment_method: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'sent')
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

// La rectora deja registrado que recibió el pago (comprobante revisado o efectivo en el colegio)
export async function confirmarPago(id: number, metodo: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!(METODOS_PAGO as readonly string[]).includes(metodo)) return { exito: false, error: 'Selecciona cómo pagó.' }

  const { error } = await getAdmin()
    .from('certificate_requests')
    .update({ status: 'in_review', payment_method: metodo, admin_message: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'sent')
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

export async function anularPago(id: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: r } = await admin.from('certificate_requests').select('status, proof_via').eq('id', id).maybeSingle()
  if (!r) return { exito: false, error: 'La solicitud no existe.' }
  if (r.status === 'sent') return { exito: false, error: 'Este certificado ya fue enviado.' }
  const { error } = await admin.from('certificate_requests')
    .update({ status: r.proof_via ? 'in_review' : 'pending_payment', payment_method: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

function correoCertificado(d: { solicitante: string, estudiante: string, tipo: string, codigo: string, verificacion: string, colegio: Colegio }) {
  const web = d.colegio.website.replace(/^https?:\/\//, '')
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;line-height:1.6">
    <p>Hola, ${escaparHtml(d.solicitante)}:</p>
    <p>Adjunto encontrarás el <b>${escaparHtml(d.tipo)}</b> de <b>${escaparHtml(d.estudiante)}</b>, correspondiente a la solicitud ${d.codigo}.</p>
    <p>Código de verificación: <b>${d.verificacion}</b>. Cualquier persona puede confirmar que el certificado es auténtico en ${escaparHtml(web)}/certificados.</p>
    <p>Si tienes alguna pregunta, responde a este correo.</p>
    <p>Cordialmente,<br>${escaparHtml(d.colegio.signerName)}<br>${escaparHtml(d.colegio.signerTitle)} · ${escaparHtml(d.colegio.institutionName)}</p>
  </div>`
}

export async function generarYEnviar(id: number, datos: { campos: CamposCertificado, notas: FilaNotas[] | null, formato: FormatoNotas, correo: string }) {
  const { autorizado, error: authError, userId } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }
  if (!esCorreo(datos.correo)) return { exito: false, error: 'El correo de destino no es válido.' }

  const admin = getAdmin()
  const { data: r } = await admin.from('certificate_requests').select('status, student_name, requester_name, payment_method').eq('id', id).maybeSingle()
  if (!r) return { exito: false, error: 'La solicitud no existe.' }
  if (r.status === 'sent') return { exito: false, error: 'Este certificado ya fue enviado.' }
  if (!r.payment_method) return { exito: false, error: 'Primero confirma que el pago fue recibido.' }

  const colegio = await cargarColegio(admin)
  if (!colegio.signaturePath) return { exito: false, error: 'Falta cargar la firma de la rectora en Certificados → Configuración.' }

  const verificacion = codigoVerificacion()
  let armado
  try {
    armado = await armarPdf(admin, id, datos.campos, datos.notas, datos.formato, verificacion)
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'No se pudo generar el PDF.' }
  }

  const ruta = `solicitudes/${id}/certificado-${armado.code}.pdf`
  const errorSubida = await subirArchivo(admin, ruta, armado.pdf, 'application/pdf')
  if (errorSubida) return { exito: false, error: `No se pudo guardar el PDF: ${errorSubida}` }

  const tipos = await cargarTipos(admin)
  const nombreTipo = tipos.find(t => t.code === armado.tipo)?.name ?? 'Certificado'
  const envio = await enviarCorreo({
    para: datos.correo.trim(),
    asunto: `${nombreTipo} – ${r.student_name} (${armado.code})`,
    html: correoCertificado({ solicitante: r.requester_name, estudiante: r.student_name, tipo: nombreTipo, codigo: armado.code, verificacion, colegio }),
    adjunto: { nombre: `${nombreTipo} - ${r.student_name}.pdf`, contenido: armado.pdf },
  })
  if (!envio.exito) return { exito: false, error: envio.error }

  const ahora = new Date().toISOString()
  const { error } = await admin.from('certificate_requests').update({
    status: 'sent', sent_at: ahora, sent_to: datos.correo.trim(), sent_by: userId,
    verification_code: verificacion, pdf_path: ruta, fields: limpiarCampos(datos.campos), grades_table: limpiarNotas(datos.notas),
    admin_message: null, updated_at: ahora,
  }).eq('id', id)
  if (error) return { exito: false, error: `El correo se envió, pero no se pudo actualizar la solicitud: ${error.message}` }
  return { exito: true }
}

export async function reenviarCertificado(id: number) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: r } = await admin.from('certificate_requests').select('code, type_code, status, student_name, requester_name, sent_to, pdf_path, verification_code').eq('id', id).maybeSingle()
  if (!r || r.status !== 'sent' || !r.pdf_path) return { exito: false, error: 'Este certificado aún no se ha enviado.' }

  const [pdf, colegio, tipos] = await Promise.all([descargarArchivo(admin, r.pdf_path), cargarColegio(admin), cargarTipos(admin)])
  if (!pdf) return { exito: false, error: 'No se encontró el PDF guardado.' }
  const nombreTipo = tipos.find(t => t.code === r.type_code)?.name ?? 'Certificado'
  return enviarCorreo({
    para: r.sent_to,
    asunto: `${nombreTipo} – ${r.student_name} (${r.code})`,
    html: correoCertificado({ solicitante: r.requester_name, estudiante: r.student_name, tipo: nombreTipo, codigo: r.code, verificacion: r.verification_code ?? '', colegio }),
    adjunto: { nombre: `${nombreTipo} - ${r.student_name}.pdf`, contenido: pdf },
  })
}

// ================= EXALUMNOS =================

export type Exalumno = {
  id: number, fullName: string, docType: string | null, docNumber: string | null, birthDate: string | null,
  lastGrade: string | null, lastCourse: string | null, exitYear: number | null, reason: string | null, desdePlataforma: boolean,
}

export async function obtenerExalumnos(): Promise<{ exito: boolean, error?: string, exalumnos?: Exalumno[] }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const { data, error } = await getAdmin().from('alumni').select('*').order('exit_year', { ascending: false, nullsFirst: false }).order('full_name')
  if (error) return { exito: false, error: error.message }
  return {
    exito: true,
    exalumnos: (data || []).map(a => ({
      id: a.id, fullName: a.full_name, docType: a.doc_type, docNumber: a.doc_number, birthDate: a.birth_date,
      lastGrade: a.last_grade, lastCourse: a.last_course, exitYear: a.exit_year, reason: a.reason, desdePlataforma: !!a.profile_id,
    })),
  }
}

export async function guardarExalumno(datos: { id?: number, fullName: string, docType: string, docNumber: string, birthDate: string, lastGrade: string, exitYear: string, reason: string }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const nombre = datos.fullName.trim()
  if (!nombre) return { exito: false, error: 'Escribe el nombre completo.' }
  if (!datos.docNumber.trim()) return { exito: false, error: 'Escribe el número de documento.' }
  const anio = datos.exitYear ? Number(datos.exitYear) : null
  if (anio !== null && (isNaN(anio) || anio < 1990 || anio > 2100)) return { exito: false, error: 'El año de salida no es válido.' }

  const fila = {
    full_name: nombre, doc_type: datos.docType || null, doc_number: datos.docNumber.trim(), birth_date: datos.birthDate || null,
    last_grade: datos.lastGrade || null, exit_year: anio, reason: datos.reason || null,
  }
  const admin = getAdmin()
  const { error } = datos.id
    ? await admin.from('alumni').update(fila).eq('id', datos.id)
    : await admin.from('alumni').insert(fila)
  if (error) return { exito: false, error: error.message }
  return { exito: true }
}

// Guarda como exalumno a quien pidió un certificado desde la página pública sin estar registrado
export async function registrarExalumnoDeSolicitud(id: number, ultimoGrado: string, anioSalida: string) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const { data: r } = await admin.from('certificate_requests').select('student_name, doc_type, doc_number, birth_date, registered').eq('id', id).maybeSingle()
  if (!r) return { exito: false, error: 'La solicitud no existe.' }
  if (r.registered) return { exito: false, error: 'Este solicitante ya está registrado.' }

  const { data: nuevo, error } = await admin.from('alumni').insert({
    full_name: r.student_name, doc_type: r.doc_type, doc_number: r.doc_number, birth_date: r.birth_date,
    last_grade: ultimoGrado || null, exit_year: anioSalida ? Number(anioSalida) || null : null,
  }).select('id').single()
  if (error) return { exito: false, error: error.message }

  await admin.from('certificate_requests').update({ alumni_id: nuevo.id, registered: true }).eq('id', id)
  return { exito: true }
}

// ================= CONFIGURACIÓN =================

export type CursoConfig = { id: number, name: string, officialGrade: string, officialLevel: string, nextGradeId: number | null, isFinal: boolean }

export async function obtenerConfiguracion(): Promise<{ exito: boolean, error?: string, colegio?: Colegio, tipos?: TipoConfig[], cursos?: CursoConfig[], firmaUrl?: string | null }> {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const admin = getAdmin()
  const [colegio, tipos, { data: cursos }] = await Promise.all([
    cargarColegio(admin), cargarTipos(admin),
    admin.from('grades').select('id, name, official_grade, official_level, next_grade_id, is_final_grade').order('order_index', { ascending: true }),
  ])
  return {
    exito: true, colegio, tipos,
    cursos: (cursos || []).map(c => ({
      id: c.id, name: c.name, officialGrade: c.official_grade ?? '', officialLevel: c.official_level ?? '',
      nextGradeId: c.next_grade_id ?? null, isFinal: !!c.is_final_grade,
    })),
    firmaUrl: await enlaceTemporal(admin, colegio.signaturePath),
  }
}

export async function guardarConfiguracion(datos: { colegio: Colegio, tipos: TipoConfig[], cursos: CursoConfig[] }) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const c = datos.colegio
  const t = (v: string | null | undefined, max = 300) => (v ?? '').trim().slice(0, max)
  const minima = Number(c.promotionMinGrade)
  const maxAreas = Number(c.promotionMaxLostAreas)
  if (isNaN(minima) || minima < 1 || minima > 5) return { exito: false, error: 'La nota mínima debe estar entre 1.0 y 5.0.' }
  if (!Number.isInteger(maxAreas) || maxAreas < 1 || maxAreas > 20) return { exito: false, error: 'La cantidad de áreas perdidas debe ser un número entre 1 y 20.' }

  const admin = getAdmin()
  const { error } = await admin.from('school_settings').update({
    signer_name: t(c.signerName), signer_short: t(c.signerShort), signer_title: t(c.signerTitle) || 'Rectora',
    institution_name: t(c.institutionName), city: t(c.city), schedule_text: t(c.scheduleText), calendar: t(c.calendar, 5),
    resolution_text: t(c.resolutionText, 500), dane_text: t(c.daneText), contact_phone: t(c.contactPhone), contact_email: t(c.contactEmail),
    website: t(c.website), address_line1: t(c.addressLine1), address_line2: t(c.addressLine2),
    whatsapp_number: t(c.whatsappNumber).replace(/\D/g, ''), bank_info: t(c.bankInfo, 1000) || null, cash_info: t(c.cashInfo, 1000) || null,
    promotion_min_grade: minima, promotion_max_lost_areas: maxAreas, updated_at: new Date().toISOString(),
  }).eq('id', 1)
  if (error) return { exito: false, error: error.message }

  for (const tipo of datos.tipos) {
    const precio = tipo.price === null || (tipo.price as unknown) === '' ? null : Number(tipo.price)
    if (precio !== null && (isNaN(precio) || precio < 0)) return { exito: false, error: `El precio de «${tipo.name}» no es válido.` }
    const descripcion = t(tipo.description, 500)
    if (!descripcion) return { exito: false, error: `Escribe la descripción de «${tipo.name}».` }
    const { error: e } = await admin.from('certificate_types').update({ description: descripcion, price: precio, active: !!tipo.active }).eq('code', tipo.code)
    if (e) return { exito: false, error: e.message }
  }

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

export async function subirFirma(formData: FormData) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, error: authError }

  const archivo = formData.get('firma')
  if (!(archivo instanceof File) || archivo.size === 0) return { exito: false, error: 'Selecciona la imagen de la firma.' }
  if (archivo.type !== 'image/png') return { exito: false, error: 'La firma debe ser una imagen PNG, idealmente con fondo transparente.' }
  if (archivo.size > 2 * 1024 * 1024) return { exito: false, error: 'La imagen no puede pasar de 2 MB.' }

  const admin = getAdmin()
  const ruta = 'configuracion/firma-rectora.png'
  const errorSubida = await subirArchivo(admin, ruta, await archivo.arrayBuffer(), 'image/png')
  if (errorSubida) return { exito: false, error: errorSubida }
  const { error } = await admin.from('school_settings').update({ signature_path: ruta, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return { exito: false, error: error.message }
  return { exito: true, url: await enlaceTemporal(admin, ruta) }
}
