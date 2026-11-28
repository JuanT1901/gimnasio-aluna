'use server'

// Formulario público de registro de docentes. Solo funciona con el enlace vigente que comparte la rectora.
import { getAdmin } from 'app/utils/horario/servidor'
import { variantesDocumento } from 'app/utils/certificados/servidor'
import { faltantesDocente } from 'app/utils/contratacion/comun'
import { TABLA, aColumnasDocente, limpiarFichaDocente, tokenFormulario } from 'app/utils/contratacion/servidor'

const tokenValido = async (token: string) => {
  if (!token || token.length < 10) return false
  const vigente = await tokenFormulario(getAdmin())
  return !!vigente && vigente === token
}

export async function validarEnlace(token: string) {
  try {
    return { valido: await tokenValido(token) }
  } catch {
    return { valido: false }
  }
}

export async function enviarRegistroDocente(token: string, entrada: Record<string, string>, acepta: boolean, sitio: string) {
  // «sitio» es un campo oculto: si viene lleno, lo llenó un robot
  if (sitio) return { exito: false, error: 'No se pudo enviar el formulario.' }
  if (!(await tokenValido(token))) return { exito: false, error: 'Este enlace ya no está vigente. Pide a la rectora el enlace actualizado.' }
  if (!acepta) return { exito: false, error: 'Debes autorizar el tratamiento de tus datos personales para continuar.' }

  const ficha = limpiarFichaDocente(entrada)
  const falta = faltantesDocente(ficha)
  if (falta) return { exito: false, error: falta }

  const admin = getAdmin()
  const variantes = variantesDocumento(ficha.doc_number)

  const { data: perfil } = await admin.from('profiles').select('role').in('doc_number', variantes).limit(1).maybeSingle()
  if (perfil?.role === 'teacher' || perfil?.role === 'admin') {
    return { exito: false, error: 'Este documento ya está registrado en la plataforma. Si necesitas actualizar tus datos, comunícate con la rectora.' }
  }
  const { data: abierta } = await admin.from(TABLA).select('id').in('doc_number', variantes).eq('status', 'pending').limit(1).maybeSingle()
  if (abierta) return { exito: false, error: 'Ya recibimos tus datos y la rectora los está revisando. Si necesitas corregir algo, comunícate con ella.' }

  const { error } = await admin.from(TABLA).insert({ ...aColumnasDocente(ficha), status: 'pending' })
  if (error) return { exito: false, error: 'No se pudo enviar el formulario. Intenta de nuevo en unos minutos.' }
  return { exito: true }
}
