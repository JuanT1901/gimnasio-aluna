'use server'

import { type EstadoSolicitud, type TipoCertificado, type TipoConfig, enlaceWhatsapp } from 'app/utils/certificados/comun'
import {
  getAdmin, obtenerSesion, cargarColegio, cargarTipos, cargarEstudiante, anioActivo, enlaceTemporal,
  registrarComprobante, registrarAvisoWhatsapp, esCorreo,
} from 'app/utils/certificados/servidor'

async function sesionEstudiante() {
  const sesion = await obtenerSesion()
  return sesion && sesion.role === 'student' ? sesion : null
}

export type DatosSolicitud = {
  estudiante: { nombre: string, documento: string, curso: string | null, grado: string }
  tipos: TipoConfig[]
  anioActivo: number
  aniosConHistorial: number[]
  correos: { etiqueta: string, correo: string, sugerido: boolean }[]
  solicitante: string
  pago: { banco: string | null, efectivo: string | null }
}

export async function obtenerDatosSolicitud(): Promise<{ exito: boolean, error?: string, datos?: DatosSolicitud }> {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const admin = getAdmin()
  const est = await cargarEstudiante(admin, sesion.userId)
  if (!est) return { exito: false, error: 'No encontramos los datos del estudiante.' }

  const [tipos, colegio, activo, { data: historial }] = await Promise.all([
    cargarTipos(admin, true), cargarColegio(admin), anioActivo(admin),
    admin.from('student_year_history').select('school_year').eq('student_id', est.id),
  ])

  // Se sugiere el correo de quien vive con el estudiante (primero la mamá)
  const correos: DatosSolicitud['correos'] = []
  if (est.motherEmail) correos.push({ etiqueta: 'Mamá', correo: est.motherEmail, sugerido: est.motherLives })
  if (est.fatherEmail) correos.push({ etiqueta: 'Papá', correo: est.fatherEmail, sugerido: !est.motherLives && est.fatherLives })
  if (correos.length && !correos.some(x => x.sugerido)) correos[0].sugerido = true
  const sugerido = correos.find(x => x.sugerido)

  return {
    exito: true,
    datos: {
      estudiante: { nombre: est.fullName, documento: `${est.docType} ${est.docNumber}`.trim(), curso: est.courseName, grado: est.officialGrade },
      tipos,
      anioActivo: activo,
      aniosConHistorial: (historial || []).map(h => h.school_year),
      correos,
      solicitante: (sugerido?.etiqueta === 'Papá' ? est.fatherName : est.motherName) ?? '',
      pago: { banco: colegio.bankInfo, efectivo: colegio.cashInfo },
    },
  }
}

export async function crearSolicitud(datos: { tipo: TipoCertificado, anio: number | null, solicitante: string, correo: string, comentario: string }) {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const solicitante = datos.solicitante.trim().slice(0, 120)
  const correo = datos.correo.trim().toLowerCase()
  if (!solicitante) return { exito: false, error: 'Escribe el nombre de quien solicita el certificado.' }
  if (!esCorreo(correo)) return { exito: false, error: 'Escribe un correo válido para recibir el certificado.' }

  const admin = getAdmin()
  const [est, tipos, activo] = await Promise.all([cargarEstudiante(admin, sesion.userId), cargarTipos(admin, true), anioActivo(admin)])
  if (!est) return { exito: false, error: 'No encontramos los datos del estudiante.' }
  if (!tipos.some(t => t.code === datos.tipo)) return { exito: false, error: 'Ese certificado no está disponible.' }

  let anio: number | null = null
  if (datos.tipo !== 'estudio') {
    anio = Number(datos.anio)
    if (!Number.isInteger(anio) || anio < 2000 || anio > activo) return { exito: false, error: 'Selecciona un año válido.' }
  }

  const { data, error } = await admin.from('certificate_requests').insert({
    type_code: datos.tipo, cert_year: anio, origin: 'portal', student_profile_id: est.id, registered: true,
    student_name: est.fullName, doc_type: est.docType, doc_number: est.docNumber, birth_date: est.birthDate,
    requester_name: solicitante, requester_email: correo, comment: datos.comentario.trim().slice(0, 500) || null,
  }).select('id, code').single()

  if (error) return { exito: false, error: error.message }
  return { exito: true, id: data.id as number, code: data.code as string }
}

export type MiSolicitud = {
  id: number
  code: string
  tipoNombre: string
  anio: number | null
  status: EstadoSolicitud
  proofVia: 'upload' | 'whatsapp' | null
  adminMessage: string | null
  requesterEmail: string
  sentTo: string | null
  sentAt: string | null
  createdAt: string
  whatsapp: string | null
  pagado: boolean
}

export async function obtenerMisSolicitudes(): Promise<{ exito: boolean, error?: string, solicitudes?: MiSolicitud[], pago?: { banco: string | null, efectivo: string | null } }> {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }

  const admin = getAdmin()
  const [{ data, error }, tipos, colegio] = await Promise.all([
    admin.from('certificate_requests')
      .select('id, code, type_code, cert_year, status, proof_via, payment_method, admin_message, requester_email, sent_to, sent_at, created_at, student_name')
      .eq('student_profile_id', sesion.userId)
      .order('created_at', { ascending: false }),
    cargarTipos(admin), cargarColegio(admin),
  ])
  if (error) return { exito: false, error: error.message }

  return {
    exito: true,
    pago: { banco: colegio.bankInfo, efectivo: colegio.cashInfo },
    solicitudes: (data || []).map(r => {
      const tipo = tipos.find(t => t.code === r.type_code)
      const nombre = `${tipo?.name ?? 'Certificado'}${r.cert_year ? ` ${r.cert_year}` : ''}`
      return {
        id: r.id, code: r.code, tipoNombre: tipo?.name ?? 'Certificado', anio: r.cert_year, status: r.status, proofVia: r.proof_via,
        adminMessage: r.admin_message, requesterEmail: r.requester_email, sentTo: r.sent_to, sentAt: r.sent_at, createdAt: r.created_at,
        whatsapp: colegio.whatsappNumber ? enlaceWhatsapp(colegio.whatsappNumber, r.code, nombre, r.student_name) : null,
        pagado: !!r.payment_method,
      }
    }),
  }
}

async function esMia(id: number, userId: string) {
  const { data } = await getAdmin().from('certificate_requests').select('id').eq('id', id).eq('student_profile_id', userId).maybeSingle()
  return !!data
}

export async function subirComprobante(formData: FormData) {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }
  const id = Number(formData.get('id'))
  if (!(await esMia(id, sesion.userId))) return { exito: false, error: 'No autorizado' }
  return registrarComprobante(getAdmin(), id, formData.get('comprobante'))
}

export async function avisarComprobanteWhatsapp(id: number) {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }
  if (!(await esMia(id, sesion.userId))) return { exito: false, error: 'No autorizado' }
  return registrarAvisoWhatsapp(getAdmin(), id)
}

export async function descargarMiCertificado(id: number) {
  const sesion = await sesionEstudiante()
  if (!sesion) return { exito: false, error: 'No autorizado' }
  const admin = getAdmin()
  const { data } = await admin.from('certificate_requests').select('pdf_path, status').eq('id', id).eq('student_profile_id', sesion.userId).maybeSingle()
  if (!data || data.status !== 'sent') return { exito: false, error: 'El certificado aún no está disponible.' }
  const url = await enlaceTemporal(admin, data.pdf_path, 300)
  return url ? { exito: true, url } : { exito: false, error: 'No se encontró el PDF.' }
}
