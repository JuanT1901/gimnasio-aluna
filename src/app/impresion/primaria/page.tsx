/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, Fragment } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaSpinner, FaPrint, FaThumbsUp } from 'react-icons/fa'

const MAPA_AREAS: Record<string, string> = {
  'Matematicas': 'Matemáticas',
  'Calculo Mental': 'Matemáticas',
  'Geometria': 'Matemáticas',
  'Estadistica': 'Matemáticas',
  'Ciencias': 'Ciencias Naturales y Educación Ambiental',
  'Pre fisica': 'Ciencias Naturales y Educación Ambiental',
  'Pre quimica': 'Ciencias Naturales y Educación Ambiental',
  'Español': 'Humanidades',
  'Lectura crítica': 'Humanidades',
  'Producción textual': 'Humanidades',
  'Ingles': 'Humanidades',
  'Sociales': 'Ciencias Sociales',
  'Historia': 'Ciencias Sociales',
  'Geografia': 'Ciencias Sociales',
  'Sistemas': 'Tecnología e Informática',
  'Arte': 'Educación Artística y Cultural',
  'Educación fisica': 'Educación Artística y Cultural',
  'Musica': 'Educación Artística y Cultural',
  'Convivencia': 'Comportamiento'
};

function ContenidoBoletinPrimariaPDF() {
  const searchParams = useSearchParams()
  const estudianteId = searchParams.get('estudiante')
  const periodo = searchParams.get('periodo')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [cargando, setCargando] = useState(true)
  const [estudiante, setEstudiante] = useState<any>(null)
  const [evaluacionesAgrupadas, setEvaluacionesAgrupadas] = useState<any[]>([])
  const [director, setDirector] = useState<any>(null)

  const [formatoPapel, setFormatoPapel] = useState('letter')

  const CURSOS_PRIMARIA = ['Emprendedores', 'Ingeniosos', 'Transformadores'];
  const [errorNivel, setErrorNivel] = useState(false);

  useEffect(() => {
    if (!estudianteId || !periodo) return

    const cargarBoletin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return (window.location.href = '/')

      const { data: estData } = await supabase.from('profiles').select('*').eq('id', estudianteId).single()
      setEstudiante(estData)

      if (estData) {
        if (!CURSOS_PRIMARIA.includes(estData.course_name)) {
          setErrorNivel(true);
          setCargando(false);
          return;
        }

        const { data: evalData } = await supabase
          .from('primary_evaluations')
          .select('*')
          .eq('student_id', estudianteId)
          .eq('period', parseInt(periodo))
        
        let evaluacionesCrudas = evalData ? [...evalData] : [];

        const { data: compData } = await supabase
          .from('behavior_evaluations')
          .select('*')
          .eq('student_id', estudianteId)
          .eq('period', parseInt(periodo))
          .maybeSingle()

        if (compData) {
          evaluacionesCrudas.push({
            subject_name: 'Convivencia',
            competencies_data: [
              {
                competencia: compData.competencia || 'Convivencia escolar',
                desempeno: compData.desempeno || compData.observations || 'Sin observación.',
                nota: compData.score || compData.grade || 0,
                escala: compData.scale || 'Básico'
              }
            ]
          });
        }

        const agrupadoPorArea = evaluacionesCrudas.reduce((acc: any[], actual: any) => {
          const nombreArea = MAPA_AREAS[actual.subject_name] || 'Otras Áreas';
          let areaExistente = acc.find(item => item.area === nombreArea);
          
          if (!areaExistente) {
            areaExistente = { area: nombreArea, asignaturas: [] };
            acc.push(areaExistente);
          }

          let competenciasExtraidas = [];
          
          if (actual.competencies_data) {
            if (typeof actual.competencies_data === 'string') {
              try {
                competenciasExtraidas = JSON.parse(actual.competencies_data);
              } catch (e) {
                console.error("Error parseando JSON de competencias:", e);
              }
            } else if (Array.isArray(actual.competencies_data)) {
              competenciasExtraidas = actual.competencies_data;
            } else if (typeof actual.competencies_data === 'object') {
              competenciasExtraidas = Object.values(actual.competencies_data);
            }
          }

          areaExistente.asignaturas.push({
            nombre: actual.subject_name,
            competencias: competenciasExtraidas
          });

          return acc;
        }, []);

        agrupadoPorArea.sort((a, b) => {
          if (a.area === 'Comportamiento') return 1;
          if (b.area === 'Comportamiento') return -1;
          return 0;
        });

        setEvaluacionesAgrupadas(agrupadoPorArea)

        const { data: cursoData } = await supabase.from('grades').select('director_id').eq('name', estData.course_name).single()
        if (cursoData?.director_id) {
          const { data: dirData } = await supabase.from('profiles').select('full_name').eq('id', cursoData.director_id).single()
          setDirector(dirData)
        }
      }
      setCargando(false)
    }

    cargarBoletin()
  }, [estudianteId, periodo, supabase])

  const obtenerIconoEscala = (textoEscala: string) => {
    if (!textoEscala) return null;
    
    const t = textoEscala.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (t.includes('superior')) {
      return <FaThumbsUp size={24} color="#eab308" />;
    }
    
    if (t.includes('alto')) {
      return <FaThumbsUp size={24} color="#3b82f6" />;
    }
    
    if (t.includes('basico')) {
      return <FaThumbsUp size={24} color="#22c55e" />;
    }
    
    if (t.includes('bajo')) {
      return <FaThumbsUp size={24} color="#ef4444" />;
    }

    return null;
  }

  const paperDimensions: Record<string, { w: string, h: string, css: string }> = {
    letter: { w: '215.9mm', h: '279.4mm', css: 'letter' }, 
    legal: { w: '215.9mm', h: '355.6mm', css: 'legal' },   
    A4: { w: '210mm', h: '297mm', css: 'A4' }              
  };
  const currPaper = paperDimensions[formatoPapel];

  const printStyles = `
    @media print {
      @page { size: ${currPaper.css}; margin: 8mm 10mm; }
      .print-wrapper { padding: 0 !important; background-color: white !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
      .no-print { display: none !important; }
      thead { display: table-header-group !important; }
      tr.salto-pagina { page-break-inside: avoid !important; page-break-after: auto !important; }
      td, th { page-break-inside: avoid !important; }
    }
    .page-container {
      max-width: ${currPaper.w};
      min-height: ${currPaper.h};
      margin: 0 auto;
      background: white;
      padding: 15px;
      font-family: Arial, sans-serif;
      color: #1e293b;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    table { width: 100%; border-collapse: collapse !important; font-size: 0.75rem; margin-bottom: 0; }
    th, td { padding: 5px 8px; text-align: left; vertical-align: middle; }
    th { font-weight: bold; text-align: center; text-transform: uppercase; border: 1px solid #1e293b; font-size: 0.8rem; }
    .td-bordeado { border: 1px solid #1e293b !important; }
  `

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>

  if (errorNivel) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#ef4444', fontSize: '3rem' }}>404</h1>
        <h2>Acceso Denegado</h2>
        <p style={{ color: '#64748b' }}>
          El estudiante seleccionado pertenece a {estudiante?.course_name}, el cual no corresponde a Básica Primaria.
        </p>
      </div>
    );
  }

  return (
    <div className="print-wrapper" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 0' }}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <strong style={{ color: '#475569', fontSize: '0.9rem' }}>Formato:</strong>
          <select 
            value={formatoPapel} 
            onChange={(e) => setFormatoPapel(e.target.value)}
            style={{ border: 'none', fontWeight: 'bold', color: '#1e293b', outline: 'none', cursor: 'pointer', background: 'transparent' }}
          >
            <option value="letter">Tamaño Carta</option>
            <option value="legal">Tamaño Oficio</option>
            <option value="A4">Tamaño A4</option>
          </select>
        </div>
        <button onClick={() => window.print()} style={{ backgroundColor: '#3b82f6', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaPrint /> Imprimir Boletín Primaria
        </button>
      </div>

      <div className="page-container print-wrapper">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ width: '100px' }}><img src="/logo-ludo.png" alt="Logo" style={{ maxWidth: '100%' }} /></div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ border: '2px solid #1e293b', padding: '10px', display: 'inline-block' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Ludo Club</h1>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Resolución 580 del 26 de junio de 2018</p>
            </div>
            <h2 style={{ fontSize: '1.1rem', marginTop: '10px', textTransform: 'uppercase' }}>Informe individual de desempeño</h2>
            <p style={{ fontWeight: 'bold', margin: '2px 0 0 0' }}>Periodo {periodo} - Año 2026</p>
          </div>
          <div style={{ width: '100px' }}><img src="/logo.jpeg" alt="Logo" style={{ maxWidth: '100%' }} /></div>
        </header>

        <div style={{ display: 'flex', border: '1px solid #1e293b', marginBottom: '20px' }}>
          <div style={{ flex: 1, padding: '10px', borderRight: '1px solid #1e293b' }}>
            ESTUDIANTE: <strong style={{ textTransform: 'uppercase', marginLeft: '5px' }}>{estudiante?.full_name}</strong>
          </div>
          <div style={{ width: '250px', padding: '10px' }}>
            NIVEL: <strong style={{ textTransform: 'uppercase', marginLeft: '5px' }}>{estudiante?.course_name}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Competencia</th>
              <th style={{ width: '50%' }}>Desempeño</th>
              <th style={{ width: '15%' }}>Valoración</th>
            </tr>
          </thead>
          <tbody>
            {evaluacionesAgrupadas.map((bloqueArea, idxA) => (
              <Fragment key={idxA}>
                
                <tr className="salto-pagina">
                  <td colSpan={3} className="td-bordeado" style={{ backgroundColor: '#1e293b', color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '0.95rem', padding: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    ÁREA: {bloqueArea.area}
                  </td>
                </tr>

                {bloqueArea.asignaturas.map((asignatura: any, idxAsig: number) => {
                  const comps = asignatura.competencias;
                  const esComportamiento = bloqueArea.area === 'Comportamiento';

                  return (
                    <Fragment key={`${idxA}-${idxAsig}`}>
                      
                      <tr className="salto-pagina">
                        <td colSpan={3} className="td-bordeado" style={{ backgroundColor: '#f1f5f9', color: '#334155', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', padding: '6px', textTransform: 'uppercase' }}>
                          ASIGNATURA: {asignatura.nombre}
                        </td>
                      </tr>

                      {/* 🌟 CIRUGÍA: Buscamos variaciones en los nombres de las llaves por si acaso */}
                      {comps.length > 0 ? (
                        comps.map((c: any, idxC: number) => {
                          const textoCompetencia = c.competencia || c.Competencia || c.titulo || "-";
                          const textoDesempeno = c.desempeno || c.Desempeno || c.desempeño || c.Desempeño || "-";
                          const notaNum = parseFloat(c.nota || c.Nota || c.score || c.calificacion || 0);
                          const textoEscala = c.escala || c.Escala || c.scale || "";

                          return (
                            <tr key={`${idxAsig}-${idxC}`} className="salto-pagina">
                              <td className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{textoCompetencia}</td>
                              <td className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{textoDesempeno}</td>
                              <td className="td-bordeado" style={{ padding: 0, height: '1px' }}>
                                <div style={{ display: 'flex', height: '100%' }}>
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #1e293b', padding: '5px' }}>
                                    {!esComportamiento && (
                                      <strong style={{ fontSize: '1.1rem' }}>{notaNum.toFixed(1)}</strong>
                                    )}
                                    <span style={{ fontSize: '0.65rem', textAlign: 'center', fontWeight: esComportamiento ? 'bold' : 'normal', lineHeight: '1.1' }}>{textoEscala}</span>
                                  </div>
                                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    {obtenerIconoEscala(textoEscala)}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr className="salto-pagina">
                          <td colSpan={3} className="td-bordeado" style={{ textAlign: 'center', padding: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                            No hay notas registradas en esta asignatura.
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>

        <footer style={{ marginTop: '50px', textAlign: 'center', pageBreakInside: 'avoid' }}>
          <div style={{ borderTop: '1px solid #1e293b', width: '250px', margin: '0 auto 5px auto' }}></div>
          <strong style={{ textTransform: 'uppercase' }}>{director?.full_name || 'Director(a) de Grupo'}</strong>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Firma Docente</p>
        </footer>
      </div>
    </div>
  )
}

export default function BoletinPrimariaPDF() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>}>
      <ContenidoBoletinPrimariaPDF />
    </Suspense>
  )
}