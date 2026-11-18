'use server'

import { cargarColegio, getAdmin, obtenerSesion } from 'app/utils/certificados/servidor'

// Nombre y cargo de quien firma por el colegio (los mismos de los certificados).
export async function obtenerFirmaRectora(): Promise<{ nombre: string, nombreCompleto: string, cargo: string } | null> {
  const sesion = await obtenerSesion()
  if (!sesion) return null

  const colegio = await cargarColegio(getAdmin())
  return {
    nombre: colegio.signerShort || colegio.signerName,
    nombreCompleto: colegio.signerName,
    cargo: colegio.signerTitle || 'Rectora',
  }
}
