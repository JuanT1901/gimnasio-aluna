// Áreas académicas de cada materia y sus colores (Malla Curricular, Horario).

const MAPA_AREAS_RAW: Record<string, string> = {
  'Matematicas': 'Matemáticas',
  'Calculo Mental': 'Matemáticas',
  'Geometria': 'Matemáticas',
  'Estadistica': 'Matemáticas',
  'Estadisticas': 'Matemáticas',
  'Ciencias': 'Ciencias Naturales y Educación Ambiental',
  'Ciencias Naturales': 'Ciencias Naturales y Educación Ambiental',
  'Pre fisica': 'Ciencias Naturales y Educación Ambiental',
  'Pre quimica': 'Ciencias Naturales y Educación Ambiental',
  'Fisica': 'Ciencias Naturales y Educación Ambiental',
  'Quimica': 'Ciencias Naturales y Educación Ambiental',
  'Español': 'Humanidades',
  'Lectura critica': 'Humanidades',
  'Produccion textual': 'Humanidades',
  'Ingles': 'Humanidades',
  'Sociales': 'Ciencias Sociales',
  'Historia': 'Ciencias Sociales',
  'Geografia': 'Ciencias Sociales',
  'Emprendimiento': 'Ciencias Sociales',
  'Sistemas': 'Tecnología e Informática',
  'Arte': 'Educación Artística y Cultural',
  'Artes': 'Educación Artística y Cultural',
  'Educacion fisica': 'Educación Artística y Cultural',
  'Musica': 'Educación Artística y Cultural',
  'Convivencia': 'Comportamiento'
}

export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const MAPA_AREAS: Record<string, string> = {}
for (const [key, value] of Object.entries(MAPA_AREAS_RAW)) {
  MAPA_AREAS[normalizar(key)] = value
}

export const buscarArea = (nombre: string) => MAPA_AREAS[normalizar(nombre)] || 'Otras Áreas'

export type ColorArea = { bg: string, text: string, border: string }

export const COLORES_AREA: Record<string, ColorArea> = {
  'Matemáticas': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Ciencias Naturales y Educación Ambiental': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Humanidades': { bg: '#fefce8', text: '#a16207', border: '#fef08a' },
  'Ciencias Sociales': { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  'Tecnología e Informática': { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  'Educación Artística y Cultural': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'Comportamiento': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'Otras Áreas': { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
}

// En el horario cada materia lleva su propio color (no el del área), para que no se confundan
// materias del mismo curso como Matemáticas y Geometría, o las dimensiones de preescolar.
// Se busca por palabra clave en el orden de la lista: «Ciencias sociales» antes de «Ciencias», «Educación física» antes de «Física».
const COLORES_MATERIA: [string[], ColorArea][] = [
  [['sociales'], { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' }],
  [['educacion fisica', 'psicomotricidad'], { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }],
  [['calculo'], { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' }],
  [['geometria'], { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' }],
  [['estadistica'], { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' }],
  [['matematica'], { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }],
  [['quimica'], { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }],
  [['fisica'], { bg: '#f7fee7', text: '#4d7c0f', border: '#d9f99d' }],
  [['ciencias'], { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }],
  [['ingles', 'idioma'], { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' }],
  [['espanol', 'lengua', 'lectura', 'produccion textual'], { bg: '#fefce8', text: '#a16207', border: '#fef08a' }],
  [['historia'], { bg: '#fdf4ff', text: '#a21caf', border: '#f5d0fe' }],
  [['geografia'], { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' }],
  [['emprendimiento'], { bg: '#fffbeb', text: '#b45309', border: '#fde68a' }],
  [['sistemas', 'tecnologia'], { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' }],
  [['musica'], { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' }],
  [['arte', 'danza'], { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }],
  [['socio', 'etica', 'convivencia'], { bg: '#fdf8f3', text: '#92400e', border: '#f3d9b8' }],
]

// Para materias que no están en la lista, asignados de forma estable según el nombre
const PALETA_EXTRA: ColorArea[] = [
  { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  { bg: '#fdf4ff', text: '#86198f', border: '#f0abfc' },
  { bg: '#f0fdfa', text: '#115e59', border: '#5eead4' },
  { bg: '#fefce8', text: '#713f12', border: '#fde047' },
]

export function colorMateria(nombre: string | null): ColorArea {
  if (!nombre) return COLORES_AREA['Otras Áreas']
  const n = normalizar(nombre)
  const fijo = COLORES_MATERIA.find(([claves]) => claves.some(k => n.includes(k)))
  if (fijo) return fijo[1]
  let h = 0
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETA_EXTRA[h % PALETA_EXTRA.length]
}
