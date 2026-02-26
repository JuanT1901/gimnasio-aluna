'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { procesarImportacionMasiva } from './actions'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaUpload, FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'

export default function ImportarEstudiantesPage() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<{ creados: number, errores: number, detallesErrores: string[] } | null>(null)

  const manejarSubida = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivo) return

    setCargando(true)
    setResultado(null)

    Papa.parse(archivo, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const respuesta = await procesarImportacionMasiva(results.data)
        setResultado(respuesta)
        setCargando(false)
      },
      error: () => {
        alert("Hubo un problema leyendo el archivo CSV.")
        setCargando(false)
      }
    })
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.header}>
        <div>
          <h1>Importación Masiva 🚀</h1>
          <p>Sube tu archivo CSV para matricular a todos los estudiantes automáticamente.</p>
        </div>
      </header>

      <div className={styles.card} style={{ maxWidth: '800px', margin: '0 auto' }}>
        <form onSubmit={manejarSubida} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ border: '2px dashed #cbd5e1', padding: '30px', textAlign: 'center', borderRadius: '12px' }}>
            <FaUpload size={40} color="#3CA0E8" style={{ marginBottom: '15px' }} />
            <h3 style={{ margin: '0 0 10px 0' }}>Selecciona tu archivo CSV UTF-8</h3>
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              style={{ width: '100%' }}
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.saveBtn} 
            style={{ padding: '15px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
            disabled={cargando || !archivo}
          >
            {cargando ? <><FaSpinner className="fa-spin" /> Procesando alumnos...</> : 'Importar Estudiantes'}
          </button>
        </form>

        {resultado && (
          <div style={{ marginTop: '30px', padding: '20px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', color: '#16a34a' }}>
                <FaCheckCircle size={30} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{resultado.creados}</div>
                <div>Creados con éxito</div>
              </div>
              
              <div style={{ textAlign: 'center', color: resultado.errores > 0 ? '#ef4444' : '#94a3b8' }}>
                <FaExclamationTriangle size={30} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{resultado.errores}</div>
                <div>Errores</div>
              </div>
            </div>
            
            {/* AQUÍ MOSTRAMOS EL REPORTE EXACTO DE ERRORES */}
            {resultado.errores > 0 && (
              <div style={{ background: '#fee2e2', padding: '15px', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                <h4 style={{ color: '#b91c1c', marginTop: 0 }}>Reporte de Errores:</h4>
                <ul style={{ color: '#991b1b', fontSize: '0.9rem', margin: 0, paddingLeft: '20px' }}>
                  {resultado.detallesErrores.map((err, i) => (
                    <li key={i} style={{ marginBottom: '5px' }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}