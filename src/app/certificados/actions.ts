'use server'

import { type EstadoSolicitud, type TipoCertificado, type TipoConfig, enlaceWhatsapp } from 'app/utils/certificados/comun'
import {
  getAdmin, cargarColegio, cargarTipos, anioActivo, registrarComprobante, registrarAvisoWhatsapp,
  esCorreo, soloDigitos, variantesDocumento,
} from 'app/utils/certificados/servidor'

// Los exalumnos solo piden certificados de promoción y de notas (el de estudio es para estudiantes actuales)
const TIPOS_PUBLICOS: TipoCertificado[] = ['promocion', 'notas']

export async function obtenerDatosPublicos(): Promise<{ tipos: TipoConfig[], anioActivo: number, pago: { banco: string | null, efectivo: string | null } }> {
  const admin = getAdmin()
  const [tipos, colegio, activo] = await Promise.all([cargarTipos(admin, true), cargarColegio(admin), anioActivo(admin)])
  return { tipos: tipos.filter(t => TIPOS_PUBLICOS.includes(t.code)), anioActivo: activo, pago: { banco: colegio.bankInfo, efectivo: colegio.cashInfo } }
}

export async function crearSolicitudPublica(d: {
  tipoDocumento: string, documento: string, nacimiento: string, nombre: string, ultimoGrado: string, anioSalida: string,
  tipo: TipoCertificado, anio: string, correo: string, celular: string, acepta: boolean, sitio: string,
}) {
  // «sitio» es un campo oculto: si viene lleno, lo llenó un robot
  if (d.sitio) return { exito: false, error: 'No se pudo enviar la solicitud.' }
  if (!d.acepta) return { exito: false, error: 'Debes autorizar el tratamiento de tus datos para continuar.' }

  const nombre = d.nombre.trim().slice(0, 120)
  const documento = d.documento.trim().slice(0, 30)
  const correo = d.correo.trim().toLowerCase()
  if (!nombre || !documento) return { exito: false, error: 'Escribe tu nombre completo y tu número de documento.' }
  if (!esCorreo(correo)) return { exito: false, error: 'Escribe un correo válido para recibir el certificado.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.nacimiento)) return { exito: false, error: 'Escribe tu fecha de nacimiento.' }
  if (!TIPOS_PUBLICOS.includes(d.tipo)) return { exito: false, error: 'Selecciona el certificado.' }

  const admin = getAdmin()
  const [tipos, activo] = await Promise.all([cargarTipos(admin, true), anioActivo(admin)])
  if (!tipos.some(t => t.code === d.tipo)) return { exito: false, error: 'Ese certificado no está disponible.' }
  const anio = Number(d.anio)
  if (!Number.isInteger(anio) || anio < 1990 || anio > activo) return { exito: false, error: 'Selecciona el año del certificado.' }

  // Un estudiante actual debe pedirlo desde la plataforma
  const variantes = variantesDocumento(documento)
  const { data: actual } = await admin.from('profiles').select('id, student_status').eq('role', 'student').in('doc_number', variantes).limit(1).maybeSingle()
  if (actual && actual.student_status !== 'alumni') {
    return { exito: false, error: 'Este documento pertenece a un estudiante actual. Pide el certificado desde la plataforma, con la cuenta del estudiante.' }
  }

  // Si está en Exalumnos (mismo documento y, si la tenemos, misma fecha de nacimiento), queda registrado
  const { data: candidatos } = await admin.from('alumni').select('id, birth_date').in('doc_number', variantes)
  const alumno = (candidatos || []).find(a => !a.birth_date || String(a.birth_date).slice(0, 10) === d.nacimiento)

  const { data, error } = await admin.from('certificate_requests').insert({
    type_code: d.tipo, cert_year: anio, origin: 'public', alumni_id: alumno?.id ?? null, registered: !!alumno,
    student_name: nombre, doc_type: d.tipoDocumento.slice(0, 40), doc_number: documento, birth_date: d.nacimiento,
    requester_name: nombre, requester_email: correo, requester_phone: d.celular.trim().slice(0, 30) || null,
    comment: [d.ultimoGrado && `Último grado: ${d.ultimoGrado.slice(0, 40)}`, d.anioSalida && `Año de salida: ${d.anioSalida.slice(0, 4)}`].filter(Boolean).join(' · ') || null,
  }).select('code').single()

  if (error) return { exito: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo en unos minutos.' }
  return { exito: true, code: data.code as string, registrado: !!alumno }
}

export type EstadoPublico = {
  id: number, code: string, tipoNombre: string, anio: number | null, status: EstadoSolicitud, adminMessage: string | null,
  proofVia: 'upload' | 'whatsapp' | null, correo: string, whatsapp: string | null, pagado: boolean,
}

async function buscar(codigo: string, documento: string) {
  const { data: r } = await getAdmin()
    .from('certificate_requests')
    .select('id, code, type_code, cert_year, status, admin_message, proof_via, payment_method, requester_email, doc_number, student_name, origin')
    .eq('code', codigo.trim().toUpperCase())
    .maybeSingle()
  if (!r || r.origin !== 'public' || soloDigitos(r.doc_number ?? '') !== soloDigitos(documento)) return null
  return r
}

export async function consultarSolicitud(codigo: string, documento: string): Promise<{ exito: boolean, error?: string, estado?: EstadoPublico }> {
  const r = await buscar(codigo, documento)
  if (!r) return { exito: false, error: 'No encontramos una solicitud con ese número y ese documento.' }

  const admin = getAdmin()
  const [tipos, colegio] = await Promise.all([cargarTipos(admin), cargarColegio(admin)])
  const tipo = tipos.find(t => t.code === r.type_code)
  const nombre = `${tipo?.name ?? 'Certificado'}${r.cert_year ? ` ${r.cert_year}` : ''}`
  return {
    exito: true,
    estado: {
      id: r.id, code: r.code, tipoNombre: tipo?.name ?? 'Certificado', anio: r.cert_year, status: r.status, adminMessage: r.admin_message,
      proofVia: r.proof_via, correo: r.requester_email,
      whatsapp: colegio.whatsappNumber ? enlaceWhatsapp(colegio.whatsappNumber, r.code, nombre, r.student_name) : null,
      pagado: !!r.payment_method,
    },
  }
}

export async function subirComprobantePublico(formData: FormData) {
  const r = await buscar(String(formData.get('codigo') ?? ''), String(formData.get('documento') ?? ''))
  if (!r) return { exito: false, error: 'No encontramos la solicitud.' }
  return registrarComprobante(getAdmin(), r.id, formData.get('comprobante'))
}

export async function avisarWhatsappPublico(codigo: string, documento: string) {
  const r = await buscar(codigo, documento)
  if (!r) return { exito: false, error: 'No encontramos la solicitud.' }
  return registrarAvisoWhatsapp(getAdmin(), r.id)
}

// Cualquier persona puede confirmar que un certificado es auténtico con su código de verificación
export async function verificarCertificado(codigo: string) {
  const limpio = codigo.trim().toUpperCase()
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(limpio)) return { exito: false, error: 'El código tiene la forma XXXX-XXXX.' }
  const admin = getAdmin()
  const { data: r } = await admin.from('certificate_requests').select('code, type_code, student_name, sent_at, cert_year').eq('verification_code', limpio).eq('status', 'sent').maybeSingle()
  if (!r) return { exito: false, error: 'No existe un certificado con ese código.' }
  const tipos = await cargarTipos(admin)
  return {
    exito: true,
    certificado: {
      code: r.code as string, tipo: tipos.find(t => t.code === r.type_code)?.name ?? 'Certificado', anio: r.cert_year as number | null,
      estudiante: r.student_name as string, expedido: r.sent_at as string,
    },
  }
}
