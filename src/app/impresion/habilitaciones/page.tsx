'use client'

// Plan de habilitaciones de un curso, listo para imprimir (rectora o profesor: cada uno ve lo suyo)
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaPrint, FaSpinner } from 'react-icons/fa'
import { RESULTADO_HABILITACION, fechaEncabezado } from 'app/utils/certificados/comun'
import { obtenerHabilitaciones, type DatosHabilitaciones, type Habilitacion } from 'app/utils/habilitaciones/actions'

const estilosImpresion = `
  @media print {
    @page { size: letter; margin: 12mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
    .no-print { display: none !important; }
    .hoja { box-shadow: none !important; padding: 0 !important; }
  }
  .estudiante { page-break-inside: avoid; margin-bottom: 22px; }
  .tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tabla th, .tabla td { border: 1px solid #1e293b; padding: 6px 8px; vertical-align: top; text-align: left; }
  .tabla th { background: #f1f5f9; }
`

function PlanHabilitaciones() {
  const cursoId = Number(useSearchParams().get('curso'))
  const [datos, setDatos] = useState<DatosHabilitaciones | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerHabilitaciones().then(r => (r.exito && r.datos ? setDatos(r.datos) : setError(r.error ?? 'No se pudo cargar la información.')))
  }, [])

  if (error) return <p style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{error}</p>
  if (!datos) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>

  const curso = datos.cursos.find(x => x.id === cursoId)
  if (!curso) return <p style={{ padding: '40px', textAlign: 'center' }}>No se encontró el curso.</p>

  const porEstudiante = new Map<string, Habilitacion[]>()
  for (const i of curso.items) porEstudiante.set(i.studentId, [...(porEstudiante.get(i.studentId) ?? []), i])

  return (
    <div style={{ background: '#e2e8f0', minHeight: '100vh', padding: '20px' }}>
      <style>{estilosImpresion}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <button onClick={() => window.print()} style={{ backgroundColor: '#3b82f6', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaPrint /> Imprimir
        </button>
      </div>

      <div className="hoja" style={{ maxWidth: '816px', margin: '0 auto', background: 'white', padding: '30px', fontFamily: 'Arial, sans-serif', color: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '22px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ludo.png" alt="Logo" style={{ width: '80px' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{datos.institucion}</h1>
            <h2 style={{ margin: '8px 0 0', fontSize: '1.05rem', textTransform: 'uppercase' }}>Plan de habilitaciones {datos.anio}</h2>
            <p style={{ margin: '4px 0 0', fontWeight: 'bold' }}>Curso: {curso.name}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="Logo" style={{ width: '80px' }} />
        </header>

        <p style={{ fontSize: '13px', lineHeight: 1.5, textAlign: 'justify' }}>
          Las materias se aprueban con {datos.notaMinima.toFixed(1)}. Los siguientes estudiantes deben presentar habilitación en las materias indicadas para aprobar el año.
        </p>

        {porEstudiante.size === 0 ? <p>No hay estudiantes en habilitación en este curso.</p> : [...porEstudiante.values()].map(lista => (
          <section key={lista[0].studentId} className="estudiante">
            <h3 style={{ fontSize: '14px', margin: '0 0 6px', textTransform: 'uppercase' }}>{lista[0].studentName}</h3>
            <table className="tabla">
              <thead><tr><th style={{ width: '22%' }}>Materia</th><th style={{ width: '8%' }}>Nota</th><th style={{ width: '18%' }}>Profesor</th><th style={{ width: '14%' }}>Fecha</th><th>Plan de habilitación</th></tr></thead>
              <tbody>
                {lista.map(i => (
                  <tr key={i.subject}>
                    <td>{i.subject}{i.result && <><br /><small>({RESULTADO_HABILITACION[i.result]})</small></>}</td>
                    <td>{i.nota.toFixed(1)}</td>
                    <td>{i.teacherName ?? ''}</td>
                    <td>{i.examDate ? fechaEncabezado(i.examDate) : ''}</td>
                    <td style={{ whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{i.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={null}><PlanHabilitaciones /></Suspense>
}
