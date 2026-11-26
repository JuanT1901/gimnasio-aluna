'use client'

import { useState } from 'react'
import { FaDownload, FaFileAlt, FaFileExcel, FaFileImage, FaFilePdf, FaFileWord, FaSpinner } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import m from 'app/styles/pages/Matricula.module.scss'
import { type ArchivoMatricula, TIPOS_ARCHIVO, tamanoLegible } from 'app/utils/matricula/comun'

export function IconoArchivo({ tipo }: { tipo: string }) {
  const clase = TIPOS_ARCHIVO[tipo]
  if (clase === 'PDF') return <FaFilePdf className={m.fileIcon} color="#e11d48" />
  if (clase === 'Word') return <FaFileWord className={m.fileIcon} color="#2563eb" />
  if (clase === 'Excel') return <FaFileExcel className={m.fileIcon} color="#16a34a" />
  if (clase === 'Imagen') return <FaFileImage className={m.fileIcon} color="#9333ea" />
  return <FaFileAlt className={m.fileIcon} color="#64748b" />
}

// Fila de un archivo con su botón de descarga (el enlace se pide al servidor al momento de descargar)
export function FilaArchivo({ archivo, descargar }: { archivo: ArchivoMatricula, descargar: () => Promise<{ exito: boolean, error?: string, url?: string }> }) {
  const [cargando, setCargando] = useState(false)

  const bajar = async () => {
    setCargando(true)
    const r = await descargar()
    setCargando(false)
    if (!r.exito || !r.url) { alert(r.error ?? 'No se pudo descargar el archivo.'); return }
    window.location.href = r.url
  }

  return (
    <div className={m.file}>
      <IconoArchivo tipo={archivo.tipo} />
      <span className={m.fileName}>
        {archivo.nombre}
        <span className={m.fileSize}>{TIPOS_ARCHIVO[archivo.tipo] ?? 'Archivo'} · {tamanoLegible(archivo.tamano)}</span>
      </span>
      <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} onClick={bajar} disabled={cargando}>
        {cargando ? <FaSpinner className="fa-spin" /> : <FaDownload />} Descargar
      </button>
    </div>
  )
}

export const fechaPublicacion = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
