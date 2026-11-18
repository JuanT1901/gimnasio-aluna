'use client'

import { useEffect, useState } from 'react'

const CLAVE = 'boletines:formatoPapel'
const FORMATOS = ['letter', 'legal', 'A4']

/**
 * Formato de papel de los boletines (carta, oficio, A4), recordado en este navegador.
 * Si no coincide con el papel elegido en el cuadro de impresión, Chrome centra la hoja
 * y deja espacio en blanco arriba y abajo; recordarlo evita tener que cambiarlo cada vez.
 */
export function useFormatoPapel(): [string, (formato: string) => void] {
  const [formato, setFormato] = useState('letter')

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE)
      if (guardado && FORMATOS.includes(guardado)) setFormato(guardado)
    } catch { /* almacenamiento no disponible: se queda en carta */ }
  }, [])

  const cambiar = (nuevo: string) => {
    setFormato(nuevo)
    try { localStorage.setItem(CLAVE, nuevo) } catch { /* sin almacenamiento */ }
  }

  return [formato, cambiar]
}
