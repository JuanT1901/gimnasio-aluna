// Festivos de Colombia (Ley 51 de 1983, «Ley Emiliani»). Se calculan solos para cualquier año:
// la rectora no tiene que digitarlos.

type Festivo = { fecha: string, nombre: string }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

// Si no cae lunes, se pasa al lunes siguiente
const alLunes = (d: Date) => {
  const dia = d.getUTCDay() // 0 = domingo, 1 = lunes
  return dia === 1 ? d : masDias(d, (8 - dia) % 7)
}

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano)
function pascua(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return utc(y, mes, dia)
}

export function festivosColombia(y: number): Festivo[] {
  const p = pascua(y)
  const lista: [Date, string][] = [
    [utc(y, 1, 1), 'Año Nuevo'],
    [alLunes(utc(y, 1, 6)), 'Día de los Reyes Magos'],
    [alLunes(utc(y, 3, 19)), 'Día de San José'],
    [masDias(p, -3), 'Jueves Santo'],
    [masDias(p, -2), 'Viernes Santo'],
    [utc(y, 5, 1), 'Día del Trabajo'],
    [masDias(p, 43), 'Ascensión del Señor'],
    [masDias(p, 64), 'Corpus Christi'],
    [masDias(p, 71), 'Sagrado Corazón de Jesús'],
    [alLunes(utc(y, 6, 29)), 'San Pedro y San Pablo'],
    [utc(y, 7, 20), 'Día de la Independencia'],
    [utc(y, 8, 7), 'Batalla de Boyacá'],
    [alLunes(utc(y, 8, 15)), 'La Asunción de la Virgen'],
    [alLunes(utc(y, 10, 12)), 'Día de la Raza'],
    [alLunes(utc(y, 11, 1)), 'Día de Todos los Santos'],
    [alLunes(utc(y, 11, 11)), 'Independencia de Cartagena'],
    [utc(y, 12, 8), 'Inmaculada Concepción'],
    [utc(y, 12, 25), 'Navidad'],
  ]
  return lista.map(([d, nombre]) => ({ fecha: iso(d), nombre })).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Festivos entre dos fechas 'YYYY-MM-DD' (incluidas)
export function festivosEntre(desde: string, hasta: string): Festivo[] {
  const y1 = Number(desde.slice(0, 4)), y2 = Number(hasta.slice(0, 4))
  const todos: Festivo[] = []
  for (let y = y1; y <= y2; y++) todos.push(...festivosColombia(y))
  return todos.filter(f => f.fecha >= desde && f.fecha <= hasta)
}
