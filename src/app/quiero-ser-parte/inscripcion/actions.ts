'use server'

import { randomUUID } from 'crypto'
import { getAdmin, anioActivo, cargarColegio, enviarCorreo, escaparHtml, variantesDocumento } from 'app/utils/certificados/servidor'
import { GRADOS_OFICIALES } from 'app/utils/certificados/comun'
import { normalizarTexto } from 'app/utils/horario/comun'
import {
  BUCKET_INSCRIPCIONES, CAMPOS, CARPETA_COMPROBANTES, ESTADOS_ABIERTOS, GRADO_MAXIMO_INSCRIPCION, MAX_COMPROBANTE_INSCRIPCION_MB,
  TIPOS_COMPROBANTE_INSCRIPCION, faltantesPrimeraVez, nombreCompleto,
} from 'app/utils/inscripciones/comun'
import { aColumnas, claveDocumento, cursosConGrado, estaVacio, limpiarFicha, tipoDocumentoValido } from 'app/utils/inscripciones/servidor'

export type OpcionesFormulario = {
  anios: number[]
  cursos: { id: number, officialGrade: string }[]
  pago?: { banco: string | null, efectivo: string | null }
}

// Posición del grado oficial (Pre-kínder = 0 … Undécimo = 13); -1 si no se reconoce
const posicionGrado = (g: string) => GRADOS_OFICIALES.findIndex(x => normalizarTexto(x) === normalizarTexto(g))
const HASTA = posicionGrado(GRADO_MAXIMO_INSCRIPCION)

export async function obtenerOpcionesFormulario(): Promise<OpcionesFormulario> {
  const admin = getAdmin()
  const [activo, cursos, colegio] = await Promise.all([anioActivo(admin), cursosConGrado(admin), cargarColegio(admin)])
  return {
    anios: [activo, activo + 1],
    // Solo los grados que tienen cupo para estudiantes nuevos (hasta Quinto)
    cursos: cursos
      .filter(c => c.officialGrade && posicionGrado(c.officialGrade) >= 0 && posicionGrado(c.officialGrade) <= HASTA)
      .map(c => ({ id: c.id, officialGrade: c.officialGrade! })),
    pago: { banco: colegio.bankInfo, efectivo: colegio.cashInfo },
  }
}

// ---------- Comprobante de pago ----------
// El archivo va directo del navegador al almacenamiento privado, con un permiso firmado (así no pasa por el
// servidor, que tiene un límite de tamaño por petición). La rectora lo ve en la solicitud.
export async function prepararComprobante(tipo: string, tamano: number, sitio: string) {
  if (sitio) return { exito: false, error: 'No se pudo subir el comprobante.' }
  const ext = TIPOS_COMPROBANTE_INSCRIPCION[tipo]
  if (!ext) return { exito: false, error: 'El comprobante debe ser una foto (JPG, PNG) o un PDF.' }
  if (!(tamano > 0) || tamano > MAX_COMPROBANTE_INSCRIPCION_MB * 1024 * 1024) return { exito: false, error: `El comprobante no puede pasar de ${MAX_COMPROBANTE_INSCRIPCION_MB} MB.` }
  const path = `${CARPETA_COMPROBANTES}${randomUUID()}.${ext}`
  const { data, error } = await getAdmin().storage.from(BUCKET_INSCRIPCIONES).createSignedUploadUrl(path)
  if (error || !data) return { exito: false, error: 'No se pudo preparar la subida del comprobante. Intenta de nuevo.' }
  return { exito: true, path, token: data.token }
}

// El comprobante debe ser uno que se subió con el permiso de arriba
async function comprobanteValido(path: string | null | undefined) {
  if (!path) return null
  if (!path.startsWith(CARPETA_COMPROBANTES) || path.includes('..') || path.length > 120) return null
  const nombre = path.slice(CARPETA_COMPROBANTES.length)
  const { data } = await getAdmin().storage.from(BUCKET_INSCRIPCIONES).list(CARPETA_COMPROBANTES.slice(0, -1), { search: nombre, limit: 1 })
  return data?.some(f => f.name === nombre) ? path : null
}

// Lo que se responde al buscar un documento. Nunca se devuelven los datos guardados: solo qué campos
// ya están llenos, para que el otro acudiente complete lo que falta sin ver la información del primero.
export type ResultadoBusqueda =
  | { estado: 'nueva' }
  | { estado: 'existente', code: string, anio: number, llenos: string[], conCurso: boolean, conComprobante: boolean }
  | { estado: 'estudiante' }

async function buscarAbierta(doc: string) {
  // Con «*» funciona aunque aún no existan las columnas del comprobante (supabase/inscripciones_comprobante.sql)
  const { data } = await getAdmin()
    .from('enrollment_requests')
    .select('*')
    .eq('doc_key', claveDocumento(doc))
    .in('status', ESTADOS_ABIERTOS)
    .maybeSingle()
  return data as Record<string, unknown> | null
}

async function esEstudianteActual(doc: string) {
  const { data } = await getAdmin()
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .neq('student_status', 'alumni')
    .in('doc_number', variantesDocumento(doc))
    .limit(1)
  return !!data?.length
}

export async function buscarDocumento(documento: string): Promise<{ exito: boolean, error?: string, resultado?: ResultadoBusqueda }> {
  const doc = documento.trim().slice(0, 30)
  if (claveDocumento(doc).length < 5) return { exito: false, error: 'Escribe el número de documento del estudiante.' }

  if (await esEstudianteActual(doc)) return { exito: true, resultado: { estado: 'estudiante' } }

  const abierta = await buscarAbierta(doc)
  if (!abierta) return { exito: true, resultado: { estado: 'nueva' } }

  return {
    exito: true,
    resultado: {
      estado: 'existente',
      code: String(abierta.code),
      anio: Number(abierta.school_year),
      llenos: CAMPOS.filter(c => !estaVacio(abierta[c.key])).map(c => c.key),
      conCurso: !!abierta.grade_id,
      conComprobante: !!abierta.payment_proof_path,
    },
  }
}

export async function enviarInscripcion(d: {
  tipoDocumento: string, documento: string, anio: number | null, gradeId: number | null,
  ficha: Record<string, string>, acepta: boolean, sitio: string, comprobante?: string | null,
}): Promise<{ exito: boolean, error?: string, code?: string, completada?: boolean, nuevos?: number }> {
  // «sitio» es un campo oculto: si viene lleno, lo llenó un robot
  if (d.sitio) return { exito: false, error: 'No se pudo enviar la solicitud.' }
  if (!d.acepta) return { exito: false, error: 'Debes autorizar el tratamiento de los datos personales para continuar.' }

  const doc = d.documento.trim().slice(0, 30)
  if (claveDocumento(doc).length < 5) return { exito: false, error: 'Escribe el número de documento del estudiante.' }
  if (!tipoDocumentoValido(d.tipoDocumento)) return { exito: false, error: 'Selecciona el tipo de documento.' }

  const { datos, error } = limpiarFicha(d.ficha)
  if (error) return { exito: false, error }

  if (await esEstudianteActual(doc)) return { exito: false, error: 'Este documento ya pertenece a un estudiante del colegio. Si necesitas actualizar datos, comunícate con el colegio.' }

  const admin = getAdmin()
  const opciones = await obtenerOpcionesFormulario()
  const gradeValido = d.gradeId !== null && opciones.cursos.some(c => c.id === d.gradeId)
  const abierta = await buscarAbierta(doc)
  const comprobante = await comprobanteValido(d.comprobante)
  if (d.comprobante && !comprobante) return { exito: false, error: 'No se pudo recibir el comprobante. Vuelve a adjuntarlo.' }
  const pago = comprobante ? { payment_proof_path: comprobante, payment_proof_at: new Date().toISOString() } : {}

  // El otro acudiente completa la solicitud que ya existe: solo se llenan los campos que estaban vacíos
  if (abierta) {
    const columnas = aColumnas(datos)
    const cambios: Record<string, unknown> = {}
    for (const c of CAMPOS) {
      if (estaVacio(abierta[c.key]) && columnas[c.key] !== null) cambios[c.key] = columnas[c.key]
    }
    if (!abierta.grade_id && gradeValido) cambios.grade_id = d.gradeId
    // El comprobante se puede subir después: volviendo a entrar con el documento del estudiante
    if (comprobante && !abierta.payment_proof_path) Object.assign(cambios, pago)

    const nuevos = Object.keys(cambios).filter(k => k !== 'payment_proof_at').length
    if (nuevos) {
      const ahora = new Date().toISOString()
      const { error: errUpd } = await admin.from('enrollment_requests').update({
        ...cambios,
        family_submissions: Number(abierta.family_submissions ?? 1) + 1,
        family_updated_at: ahora,
        updated_at: ahora,
        admin_seen_at: null,
      }).eq('id', abierta.id)
      if (errUpd) return { exito: false, error: errUpd.message }
      await enviarConfirmacion(String(abierta.code), nombreCompleto({ ...aFichaNombre(abierta), ...cambios }), cambios, true)
    }
    return { exito: true, code: String(abierta.code), completada: true, nuevos }
  }

  if (!d.anio || !opciones.anios.includes(d.anio)) return { exito: false, error: '¿Para qué año quiere inscribir a su hijo(a)? Selecciona el año.' }
  if (!gradeValido) return { exito: false, error: 'Selecciona el grado al que aspira el estudiante.' }
  const falta = faltantesPrimeraVez(datos)
  if (falta) return { exito: false, error: falta }

  const { data: creada, error: errIns } = await admin.from('enrollment_requests').insert({
    ...aColumnas(datos),
    school_year: d.anio,
    grade_id: d.gradeId,
    ...pago,
    doc_type: d.tipoDocumento,
    doc_number: doc,
    doc_key: claveDocumento(doc),
  }).select('code').single()

  // Dos envíos al mismo tiempo con el mismo documento: el índice único deja pasar solo uno
  if (errIns?.code === '23505') return { exito: false, error: 'Ya hay una solicitud con este documento. Vuelve a escribir el documento para completarla.' }
  if (errIns || !creada) return { exito: false, error: errIns?.message ?? 'No se pudo guardar la solicitud.' }

  await enviarConfirmacion(creada.code, nombreCompleto(datos), datos, false)
  return { exito: true, code: creada.code, completada: false, nuevos: 0 }
}

const aFichaNombre = (f: Record<string, unknown>) => ({
  first_name: f.first_name as string | null, second_name: f.second_name as string | null,
  first_surname: f.first_surname as string | null, second_surname: f.second_surname as string | null,
})

// Se envía a los correos que se escribieron en este envío. Si el correo falla, la solicitud igual queda guardada.
async function enviarConfirmacion(code: string, estudiante: string, datos: Record<string, unknown>, completada: boolean) {
  const correos = [...new Set([datos.mother_email, datos.father_email].filter((c): c is string => typeof c === 'string' && !!c))]
  if (!correos.length) return

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:560px">
      <h2 style="color:#3CA0E8;margin:0 0 12px">${completada ? 'Recibimos los datos que completaste' : 'Recibimos tu solicitud de inscripción'}</h2>
      <p>Estudiante: <b>${escaparHtml(estudiante || 'Sin nombre')}</b><br>Número de solicitud: <b>${escaparHtml(code)}</b></p>
      <p>Siguientes pasos del proceso de admisión:</p>
      <ol>
        <li>Pago de la inscripción y comprobante: si no lo adjuntaste, entra de nuevo al formulario con el documento del estudiante y súbelo.</li>
        <li>Evaluación y entrevista con la familia.</li>
        <li>Comunicación oficial sobre la asignación del cupo y matrícula.</li>
      </ol>
      <p>Si el otro acudiente quiere completar información, puede entrar al mismo formulario y escribir el número de documento del estudiante: solo tendrá que llenar lo que falta.</p>
      <p style="color:#64748b;font-size:13px">Ludo Club · Gimnasio Aluna</p>
    </div>`

  await Promise.all(correos.map(para =>
    enviarCorreo({ para, asunto: `Solicitud de inscripción ${code}`, html }).catch(() => null)
  ))
}
