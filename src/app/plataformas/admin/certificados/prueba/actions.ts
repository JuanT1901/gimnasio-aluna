'use server'

// Certificados de prueba: solo funcionan cuando la plataforma corre en el equipo de desarrollo (npm run dev).
// Solo leen datos: no crean solicitudes, no gastan consecutivo, no envían correos ni guardan archivos.
import { verificarRol } from 'app/utils/supabase/auth-check'
import { hoyISO } from 'app/utils/horario/comun'
import {
  type CamposCertificado, type Colegio, type FilaNotas, type FormatoNotas, type TipoCertificado,
  formatoDeCurso, limpiarCampos, limpiarNotas, plantillaNotas, tieneAnio,
} from 'app/utils/certificados/comun'
import {
  getAdmin, cargarColegio, cargarEstudiante, camposIniciales, notasParaCertificado, formatoDeEstudiante, anioActivo,
  descargarArchivo, enlaceTemporal, leerImagenPublica,
} from 'app/utils/certificados/servidor'
import { generarPdfCertificado, generarPdfVarios } from 'app/utils/certificados/pdf'

const TIPOS: TipoCertificado[] = ['estudio', 'promocion', 'notas', 'conducta']
const FORMATOS: FormatoNotas[] = ['preescolar', 'primaria', 'secundaria']

async function permitido() {
  if (process.env.NODE_ENV !== 'development') return { ok: false, error: 'Esta sección solo está disponible en desarrollo.' }
  const { autorizado, error } = await verificarRol('admin')
  return autorizado ? { ok: true } : { ok: false, error: error ?? 'No autorizado' }
}

export type DatosPrueba = {
  colegio: Colegio
  firmaUrl: string | null
  anioActivo: number
  estudiantes: { id: string, nombre: string, curso: string | null }[]
}

export async function obtenerDatosPrueba(): Promise<{ exito: boolean, error?: string, datos?: DatosPrueba }> {
  const p = await permitido()
  if (!p.ok) return { exito: false, error: p.error }

  const admin = getAdmin()
  const [colegio, activo, { data: est }] = await Promise.all([
    cargarColegio(admin), anioActivo(admin),
    admin.from('profiles').select('id, full_name, course_name').eq('role', 'student').order('full_name'),
  ])
  return {
    exito: true,
    datos: {
      colegio, anioActivo: activo, firmaUrl: await enlaceTemporal(admin, colegio.signaturePath),
      estudiantes: (est || []).map(e => ({ id: e.id, nombre: e.full_name ?? '', curso: e.course_name ?? null })),
    },
  }
}

// Datos que tendría el certificado de un estudiante real, igual que en una solicitud nueva
export async function datosDeEstudiante(id: string, tipo: TipoCertificado, anio: number | null): Promise<{
  exito: boolean, error?: string, campos?: CamposCertificado, formato?: FormatoNotas, notas?: FilaNotas[] | null,
}> {
  const p = await permitido()
  if (!p.ok) return { exito: false, error: p.error }
  if (!TIPOS.includes(tipo)) return { exito: false, error: 'Tipo de certificado no válido.' }

  const admin = getAdmin()
  const est = await cargarEstudiante(admin, id)
  if (!est) return { exito: false, error: 'No encontramos al estudiante.' }

  const anioCert = tieneAnio(tipo) ? anio ?? await anioActivo(admin) : null
  const campos = await camposIniciales(admin, est, tipo, anioCert, hoyISO(), tipo === 'estudio')
  const formato = tipo === 'notas' && campos.nivel ? formatoDeCurso(null, campos.nivel) : formatoDeEstudiante(est)
  const notas = tipo === 'notas' ? (anioCert ? (await notasParaCertificado(admin, est, anioCert, formato)).filas : plantillaNotas(formato)) : null
  return { exito: true, campos, formato, notas }
}

// Imágenes del certificado (las mismas de los certificados reales)
async function imagenes(admin: ReturnType<typeof getAdmin>, colegio: Colegio) {
  const [firma, logoAluna, logoLudo, marcaAgua] = await Promise.all([
    descargarArchivo(admin, colegio.signaturePath), leerImagenPublica('logo.jpeg'), leerImagenPublica('logo-ludo.png'), leerImagenPublica('marca-agua-certificados.jpg'),
  ])
  return { firma, logoAluna, logoLudo, marcaAgua }
}

export async function generarPdfPrueba(d: { tipo: TipoCertificado, campos: CamposCertificado, notas: FilaNotas[] | null, formato: FormatoNotas, sello: boolean }) {
  const p = await permitido()
  if (!p.ok) return { exito: false, error: p.error }
  if (!TIPOS.includes(d.tipo)) return { exito: false, error: 'Tipo de certificado no válido.' }

  try {
    const admin = getAdmin()
    const colegio = await cargarColegio(admin)
    const campos = limpiarCampos(d.campos)
    const pdf = await generarPdfCertificado({
      colegio, tipo: d.tipo, campos, formato: FORMATOS.includes(d.formato) ? d.formato : formatoDeCurso(null, campos.nivel),
      notas: d.tipo === 'notas' ? limpiarNotas(d.notas) : null,
      codigo: 'PRUEBA', verificacion: null, ...await imagenes(admin, colegio), prueba: { sello: !!d.sello },
    })
    return { exito: true, base64: pdf.toString('base64') }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'No se pudo generar el PDF.' }
  }
}

// Estudio, promoción y conducta en un solo PDF (una hoja cada uno) con los mismos datos, para compararlos
export async function generarPdfTresPrueba(d: { campos: CamposCertificado, formato: FormatoNotas, sello: boolean }) {
  const p = await permitido()
  if (!p.ok) return { exito: false, error: p.error }

  try {
    const admin = getAdmin()
    const [colegio, activo] = await Promise.all([cargarColegio(admin), anioActivo(admin)])
    const campos = limpiarCampos(d.campos)
    const img = await imagenes(admin, colegio)
    const formato = FORMATOS.includes(d.formato) ? d.formato : formatoDeCurso(null, campos.nivel)
    const tipos: TipoCertificado[] = ['estudio', 'promocion', 'conducta']
    const pdf = await generarPdfVarios(tipos.map(tipo => ({
      colegio, tipo, formato, notas: null, codigo: 'PRUEBA', verificacion: null, ...img, prueba: { sello: !!d.sello },
      // Promoción y conducta necesitan año, y conducta una conducta, aunque el formulario esté en otro tipo
      campos: { ...campos, anio: tipo === 'estudio' ? null : campos.anio ?? activo, conducta: campos.conducta ?? 'Excelente' },
    })), 'Certificados de prueba')
    return { exito: true, base64: pdf.toString('base64') }
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'No se pudo generar el PDF.' }
  }
}
