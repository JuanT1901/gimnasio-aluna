/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FaArrowLeft, FaSave, FaSpinner, FaChalkboardTeacher, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { crearProfesorIndividual } from './actions'

export default function CrearProfesorPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [errorMsj, setErrorMsj] = useState<string | null>(null)
  const [exitoMsj, setExitoMsj] = useState(false)

  const [formData, setFormData] = useState({
    username: '', full_name: '', doc_type: 'CC', doc_number: '',
    email: '', birth_date: '', address: '', phone: '',
    compensation_fund: '', eps: '', arl: '', pension_fund: ''
  })

  const manejarCambio = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setErrorMsj(null)
    setExitoMsj(false)

    const resultado = await crearProfesorIndividual(formData)

    setCargando(false)

    if (resultado.exito) {
      setExitoMsj(true)
      setTimeout(() => router.push('/plataformas/admin/profesores'), 2000)
    } else {
      if (resultado.error?.includes('already registered')) {
        setErrorMsj('El nombre de usuario o correo ya está en uso.')
      } else {
        setErrorMsj(`Error al crear profesor: ${resultado.error}`)
      }
    }
  }

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.95rem' }
  const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.85rem', color: '#475569' }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link href="/plataformas/admin/profesores" style={{ color: '#64748b', fontSize: '1.2rem' }}><FaArrowLeft /></Link>
        <div>
          <h1>Contratar Docente 📝</h1>
          <p>Registra un nuevo profesor en el sistema del colegio.</p>
        </div>
      </header>

      <div className={styles.card} style={{ maxWidth: '700px', margin: '0 auto' }}>
        
        {errorMsj && <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><FaExclamationTriangle /> {errorMsj}</div>}
        {exitoMsj && <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #10b981', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}><FaCheckCircle /> ¡Profesor registrado exitosamente! Redirigiendo...</div>}

        <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          <div style={{ backgroundColor: '#f8fafc', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#334155', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
              <FaChalkboardTeacher color="#3b82f6" /> Datos del Docente
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nombre de Usuario (Login) *</label>
                <input type="text" name="username" value={formData.username} onChange={manejarCambio} placeholder="Ej: jdtorres" style={inputStyle} required />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Se agregará @aluna.edu.co automáticamente</span>
              </div>

              <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nombre Completo *</label><input type="text" name="full_name" value={formData.full_name} onChange={manejarCambio} style={inputStyle} required /></div>

              <div>
                <label style={labelStyle}>Tipo de Documento *</label>
                <select name="doc_type" value={formData.doc_type} onChange={manejarCambio} style={inputStyle}>
                  <option value="CC">Cédula de Ciudadanía</option><option value="CE">Cédula de Extranjería</option><option value="PPT">PPT / PEP</option><option value="Pasaporte">Pasaporte</option>
                </select>
              </div>
              <div><label style={labelStyle}>Número de Documento (Contraseña) *</label><input type="text" name="doc_number" value={formData.doc_number} onChange={manejarCambio} style={inputStyle} required /></div>

              <div><label style={labelStyle}>Correo Electrónico</label><input type="email" name="email" value={formData.email} onChange={manejarCambio} style={inputStyle} /></div>
              <div><label style={labelStyle}>Número de Celular</label><input type="text" name="phone" value={formData.phone} onChange={manejarCambio} style={inputStyle} /></div>

              <div><label style={labelStyle}>Fecha de Nacimiento</label><input type="date" name="birth_date" value={formData.birth_date} onChange={manejarCambio} style={inputStyle} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Dirección de Residencia</label><input type="text" name="address" value={formData.address} onChange={manejarCambio} style={inputStyle} /></div>

              <div><label style={labelStyle}>EPS</label><input type="text" name="eps" value={formData.eps} onChange={manejarCambio} style={inputStyle} /></div>
              <div><label style={labelStyle}>ARL</label><input type="text" name="arl" value={formData.arl} onChange={manejarCambio} style={inputStyle} /></div>
              <div><label style={labelStyle}>Caja de Compensación</label><input type="text" name="compensation_fund" value={formData.compensation_fund} onChange={manejarCambio} style={inputStyle} /></div>
              <div><label style={labelStyle}>Fondo de Pensiones</label><input type="text" name="pension_fund" value={formData.pension_fund} onChange={manejarCambio} style={inputStyle} /></div>

            </div>
          </div>

          <button type="submit" disabled={cargando} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            {cargando ? <FaSpinner className="fa-spin" /> : <FaSave />}
            {cargando ? 'Registrando...' : 'Contratar Docente'}
          </button>
        </form>

      </div>
    </main>
  )
}