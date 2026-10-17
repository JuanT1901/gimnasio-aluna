import h from 'app/styles/pages/Horario.module.scss'
import c from 'app/styles/pages/Certificados.module.scss'
import { ESTADO_INSCRIPCION, type EstadoInscripcion } from 'app/utils/inscripciones/comun'

const CLASE_ESTADO: Record<EstadoInscripcion, string> = {
  new: c.pillReview,
  in_process: h.pillDraft,
  enrolled: h.pillPublished,
  not_continuing: h.pillNone,
}

export default function EstadoInscripcionPill({ estado }: { estado: EstadoInscripcion }) {
  return <span className={`${h.pill} ${CLASE_ESTADO[estado]}`}>{ESTADO_INSCRIPCION[estado]}</span>
}
