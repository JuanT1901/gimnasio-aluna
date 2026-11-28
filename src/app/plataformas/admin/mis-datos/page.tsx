/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaUser, FaSave, FaKey, FaEye, FaEyeSlash, FaCheckCircle } from 'react-icons/fa'
import { cambiarContrasena, actualizarDatosRectora } from './actions'

export default function MisDatosPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [perfil, setPerfil] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [tipoDoc, setTipoDoc] = useState('')
  const [email, setEmail] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [error, setError] = useState('')

  const [contrasenaActual, setContrasenaActual] = useState('')
  const [contrasenaNueva, setContrasenaNueva] = useState('')
  const [confirmarContrasena, setConfirmarContrasena] = useState('')
  const [mostrarActual, setMostrarActual] = useState(false)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false)
  const [errorContrasena, setErrorContrasena] = useState('')
  const [exitoContrasena, setExitoContrasena] = useState('')

  useEffect(() => {
    cargarPerfil()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarPerfil = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('full_name, doc_number, doc_type, role')
      .eq('id', user.id)
      .single()

    if (data) {
      setPerfil(data)
      setNombre(data.full_name || '')
      setDocumento(data.doc_number || '')
      setTipoDoc(data.doc_type || 'CC')
    }
    setEmail(user.email || '')
    setCargando(false)
  }

  const guardarDatos = async () => {
    setGuardando(true)
    setError('')
    setMensajeExito('')

    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      setGuardando(false)
      return
    }

    const resultado = await actualizarDatosRectora({
      full_name: nombre.trim(),
      doc_number: documento.trim(),
      doc_type: tipoDoc,
    })

    if (resultado.exito) {
      setMensajeExito('Datos actualizados correctamente')
      setTimeout(() => setMensajeExito(''), 3000)
    } else {
      setError(resultado.error || 'Error al guardar')
    }
    setGuardando(false)
  }

  const handleCambiarContrasena = async () => {
    setErrorContrasena('')
    setExitoContrasena('')

    if (!contrasenaActual) {
      setErrorContrasena('Ingresa tu contraseña actual')
      return
    }
    if (contrasenaNueva.length < 6) {
      setErrorContrasena('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (contrasenaNueva !== confirmarContrasena) {
      setErrorContrasena('Las contraseñas no coinciden')
      return
    }

    setCambiandoContrasena(true)
    const resultado = await cambiarContrasena(contrasenaActual, contrasenaNueva)

    if (resultado.exito) {
      setExitoContrasena('Contraseña actualizada correctamente')
      setContrasenaActual('')
      setContrasenaNueva('')
      setConfirmarContrasena('')
      setTimeout(() => setExitoContrasena(''), 3000)
    } else {
      setErrorContrasena(resultado.error || 'Error al cambiar la contraseña')
    }
    setCambiandoContrasena(false)
  }

  if (cargando) {
    return (
      <main className={styles.mainContent}>
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: '100px' }}>Cargando...</p>
      </main>
    )
  }

  const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 as const }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header}>
        <div>
          <h1>Mis Datos</h1>
          <p>Información personal y seguridad de la cuenta</p>
        </div>
        <div className={styles.gradeBadge} style={{ borderLeftColor: '#e11d48' }}>
          <span>Rol</span>
          <strong>Rectora</strong>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '30px', maxWidth: '900px' }}>

        {/* Datos personales */}
        <div className={styles.card} style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
            <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '50%' }}>
              <FaUser size={20} color="#0284c7" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Datos Personales</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Nombre completo</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Tipo de documento</label>
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                style={inputStyle}
              >
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="TI">Tarjeta de Identidad</option>
                <option value="PP">Pasaporte</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Número de documento</label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                disabled
                style={{ ...inputStyle, backgroundColor: '#f1f5f9', color: '#94a3b8' }}
              />
            </div>

            {error && <p style={{ color: '#ef4444', margin: 0, fontSize: '0.9rem' }}>{error}</p>}
            {mensajeExito && (
              <p style={{ color: '#16a34a', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaCheckCircle /> {mensajeExito}
              </p>
            )}

            <button
              onClick={guardarDatos}
              disabled={guardando}
              style={{ padding: '12px 20px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: guardando ? 0.7 : 1 }}
            >
              <FaSave /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Cambio de contraseña */}
        <div className={styles.card} style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
            <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '50%' }}>
              <FaKey size={20} color="#d97706" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Cambiar Contraseña</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Contraseña actual</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarActual ? 'text' : 'password'}
                  value={contrasenaActual}
                  onChange={(e) => setContrasenaActual(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setMostrarActual(!mostrarActual)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  {mostrarActual ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarNueva ? 'text' : 'password'}
                  value={contrasenaNueva}
                  onChange={(e) => setContrasenaNueva(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setMostrarNueva(!mostrarNueva)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  {mostrarNueva ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                style={inputStyle}
              />
            </div>

            {errorContrasena && <p style={{ color: '#ef4444', margin: 0, fontSize: '0.9rem' }}>{errorContrasena}</p>}
            {exitoContrasena && (
              <p style={{ color: '#16a34a', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaCheckCircle /> {exitoContrasena}
              </p>
            )}

            <button
              onClick={handleCambiarContrasena}
              disabled={cambiandoContrasena}
              style={{ padding: '12px 20px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: cambiandoContrasena ? 0.7 : 1 }}
            >
              <FaKey /> {cambiandoContrasena ? 'Cambiando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}
