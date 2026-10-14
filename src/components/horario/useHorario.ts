'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DatosHorario } from 'app/utils/horario/comun'
import { obtenerHorario, type ObjetivoHorario } from 'app/utils/horario/actions'

// Carga el horario de un curso o docente para una semana. Si se cambia de semana rápido, solo cuenta la última respuesta.
export function useHorario(objetivo: ObjetivoHorario | null, semana: string) {
  const [datos, setDatos] = useState<DatosHorario | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const peticion = useRef(0)
  const clave = objetivo ? JSON.stringify(objetivo) : ''

  const recargar = useCallback(async () => {
    if (!clave) return
    const id = ++peticion.current
    setCargando(true)
    setError(null)
    const resultado = await obtenerHorario(JSON.parse(clave) as ObjetivoHorario, semana)
    if (id !== peticion.current) return
    if (resultado.exito && resultado.datos) {
      setDatos(resultado.datos)
    } else {
      setDatos(null)
      setError(resultado.error ?? 'No se pudo cargar el horario.')
    }
    setCargando(false)
  }, [clave, semana])

  useEffect(() => { recargar() }, [recargar])

  return { datos, cargando, error, recargar }
}
