// Proceso de matrícula: tipos y reglas que se usan en el navegador y en el servidor.

export type ArchivoMatricula = {
  path: string // ruta en el bucket privado «matricula»
  nombre: string // nombre original, con el que se descarga
  tipo: string
  tamano: number
}

export type PublicacionMatricula = {
  id: number
  titulo: string
  comentario: string | null
  archivos: ArchivoMatricula[]
  createdAt: string
}

export const BUCKET_MATRICULA = 'matricula'
export const MAX_ARCHIVO_MB = 10
export const MAX_ARCHIVOS = 10

// PDF, Word, Excel e imágenes (formularios, contratos, listas de útiles, etc.)
export const TIPOS_ARCHIVO: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'image/jpeg': 'Imagen',
  'image/png': 'Imagen',
}
export const ACCEPT_ARCHIVOS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'

export const tamanoLegible = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

// Nombre seguro para la ruta en el almacenamiento (sin tildes, espacios ni símbolos)
export const nombreSeguro = (nombre: string) => {
  const limpio = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return limpio.slice(-100) || 'archivo'
}
