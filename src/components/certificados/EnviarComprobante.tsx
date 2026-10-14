'use client'

import { useState } from 'react'
import { FaPaperclip, FaSpinner, FaWhatsapp } from 'react-icons/fa'
import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { MAX_COMPROBANTE_MB } from 'app/utils/certificados/comun'

type Resultado = { exito: boolean, error?: string }

// Dos formas de enviar el comprobante: subirlo aquí o mandarlo por WhatsApp con el número de solicitud
export default function EnviarComprobante({ codigo, whatsappUrl, onSubir, onWhatsapp, onListo }: {
  codigo: string
  whatsappUrl: string | null
  onSubir: (archivo: File) => Promise<Resultado>
  onWhatsapp: () => Promise<Resultado>
  onListo: (mensaje: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (!abierto) {
    return (
      <div className={c.rActs}>
        <button type="button" className={`${h.btn} ${h.btnBlue} ${h.btnSm}`} onClick={() => setAbierto(true)}>Subir comprobante de pago</button>
      </div>
    )
  }

  const subir = async () => {
    if (!archivo) return
    setOcupado(true)
    const r = await onSubir(archivo)
    setOcupado(false)
    if (!r.exito) { alert(r.error); return }
    setAbierto(false)
    onListo('Comprobante subido. La rectora recibió el aviso y lo revisará.')
  }

  const whatsapp = async () => {
    if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener')
    const r = await onWhatsapp()
    if (!r.exito) { alert(r.error); return }
    setAbierto(false)
    onListo('Listo. Cuando envíes el comprobante por WhatsApp, la rectora lo revisará.')
  }

  return (
    <div className={c.upload}>
      <strong style={{ fontSize: '0.9rem' }}>Envía el comprobante de pago</strong>
      <div className={h.toolbar} style={{ alignItems: 'center', marginBottom: 0 }}>
        <label className={`${h.btn} ${h.btnGhost} ${h.btnSm}`}>
          <FaPaperclip size={11} /> {archivo ? archivo.name : 'Elegir foto o PDF'}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" className={`${h.btn} ${h.btnBlue} ${h.btnSm}`} disabled={!archivo || ocupado} onClick={subir}>
          {ocupado && <FaSpinner className="fa-spin" />} Subir a la plataforma
        </button>
      </div>
      <span className={c.hint}>Imagen o PDF de máximo {MAX_COMPROBANTE_MB} MB.</span>
      {whatsappUrl && (
        <>
          <div className={c.or}>o</div>
          <button type="button" className={`${h.btn} ${c.btnWa} ${h.btnSm}`} onClick={whatsapp}><FaWhatsapp /> Enviar por WhatsApp</button>
          <span className={c.hint}>Se abrirá WhatsApp con un mensaje que ya incluye el número de solicitud {codigo}, para que la rectora sepa a qué certificado corresponde.</span>
        </>
      )}
      <button type="button" className={`${h.btn} ${h.btnGhost} ${h.btnSm}`} style={{ alignSelf: 'flex-start' }} onClick={() => setAbierto(false)}>Cancelar</button>
    </div>
  )
}
