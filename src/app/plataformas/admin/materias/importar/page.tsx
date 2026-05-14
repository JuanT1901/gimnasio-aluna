'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import Link from 'next/link'
import { FaUpload, FaSpinner, FaArrowLeft, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'
import { importarMallaCurricular } from './actions'

export default function ImportarMallaCurricularPage() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const procesarExcel = async () => {
    if (!archivo) return alert('Por favor, selecciona un archivo Excel primero.')

    setCargando(true)
    setResultado(null)

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonDatos = XLSX.utils.sheet_to_json(worksheet)

        // Enviamos el JSON al motor (actions.ts)
        const res = await importarMallaCurricular(jsonDatos)
        setResultado(res)
        setCargando(false)
      }
      reader.readAsArrayBuffer(archivo)
    } catch {
      alert('Hubo un error al leer el archivo.')
      setCargando(false)
    }
  }

  return (
    <main style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <Link href="/plataformas/admin/profesores" style={{ color: '#64748b', fontSize: '1.2rem', textDecoration: 'none' }}>
          <FaArrowLeft />
        </Link>
        <div>
          <h1 style={{ margin: 0, color: '#1e293b' }}>Importar Malla Curricular 📚</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Sube el Excel con las materias oficiales de cada curso.</p>
        </div>
      </header>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        
        <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            style={{ display: 'block', margin: '0 auto', cursor: 'pointer' }}
          />
        </div>

        <button 
          onClick={procesarExcel}
          disabled={!archivo || cargando}
          style={{ width: '100%', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: (!archivo || cargando) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
        >
          {cargando ? <FaSpinner className="fa-spin" /> : <FaUpload />}
          {cargando ? 'Procesando Malla Curricular...' : 'Subir y Procesar Excel'}
        </button>

        {resultado && (
          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: resultado.errores.length > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${resultado.errores.length > 0 ? '#fca5a5' : '#bbf7d0'}`, borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, color: resultado.errores.length > 0 ? '#991b1b' : '#166534', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {resultado.errores.length > 0 ? <FaExclamationTriangle /> : <FaCheckCircle />}
              Resumen de Importación
            </h3>
            <p><strong>Materias creadas/actualizadas:</strong> {resultado.creadas}</p>
            
            {resultado.errores.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <p style={{ fontWeight: 'bold', color: '#991b1b' }}>Errores encontrados ({resultado.errores.length}):</p>
                <ul style={{ color: '#ef4444', fontSize: '0.9rem', maxHeight: '150px', overflowY: 'auto', backgroundColor: 'white', padding: '10px 20px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                  {resultado.errores.map((err: string, i: number) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}