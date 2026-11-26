import { notFound } from 'next/navigation'
import CertificadoPrueba from './CertificadoPrueba'

// Herramienta del desarrollador: en producción (Vercel) esta página no existe
export default function CertificadoPruebaPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <CertificadoPrueba />
}
