/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, Fragment } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaSpinner, FaPrint } from 'react-icons/fa'
import { usePrintScale } from 'app/hooks/usePrintScale'

// 🌟 LISTA DE CURSOS DE PREESCOLAR (Para el escudo de seguridad)
const CURSOS_PREESCOLAR = ['Aventureros', 'Creativos', 'Expertos'];

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const ORDEN_DIMENSIONES = [
  'dimension cognitiva (matematicas)',
  'dimension cognitiva (conceptos de matematicas)',
  'dimension cognitiva (ciencias integradas)',
  'dimension cognitiva (dispositivos basicos de aprendizaje)',
  'dimension comunicativa (espanol)',
  'dimension comunicativa (ingles)',
  'dimension corporal (musica)',
  'dimension socio-afectiva',
  'comportamiento'
];

function ContenidoBoletinPreescolarPDF() {
  const searchParams = useSearchParams()
  const estudianteId = searchParams.get('estudiante')
  const periodo = searchParams.get('periodo')

  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [cargando, setCargando] = useState(true)
  const [estudiante, setEstudiante] = useState<any>(null)
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [director, setDirector] = useState<any>(null)
  const [sugerenciasGlobales, setSugerenciasGlobales] = useState<Record<string, string>>({});
  
  const [errorNivel, setErrorNivel] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  const [formatoPapel, setFormatoPapel] = useState('letter')

  const { contentRef, scale, hostHeight } = usePrintScale([cargando, formatoPapel])

  useEffect(() => {
    if (!estudianteId || !periodo) return

    const cargarBoletin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return (window.location.href = '/')

      const { data: miPerfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (miPerfil?.role === 'student' && user.id !== estudianteId) {
        setSinPermiso(true);
        setCargando(false);
        return;
      }

      const { data: estData } = await supabase.from('profiles').select('id, full_name, course_name').eq('id', estudianteId).single()
      setEstudiante(estData)

      if (estData) {
        if (!CURSOS_PREESCOLAR.includes(estData.course_name)) {
          setErrorNivel(true);
          setCargando(false);
          return;
        }

        const { data: evalData } = await supabase
          .from('preschool_evaluations')
          .select('*')
          .eq('student_id', estudianteId)
          .eq('period', parseInt(periodo))
        
        let evaluacionesFinales = evalData ? [...evalData] : [];

        const { data: compData } = await supabase
          .from('behavior_evaluations')
          .select('*')
          .eq('student_id', estudianteId)
          .eq('period', parseInt(periodo))
          .maybeSingle()

        if (compData) {
          evaluacionesFinales.push({
            dimension: 'Comportamiento',
            competencies_data: [
              {
                desempeno: compData.desempeno || compData.observations || 'Sin observación.'
              }
            ]
          });
        }

        setEvaluaciones(evaluacionesFinales)

        const { data: cursoData } = await supabase.from('grades').select('director_id').eq('name', estData.course_name).single()
        if (cursoData?.director_id) {
          const { data: dirData } = await supabase.from('profiles').select('full_name').eq('id', cursoData.director_id).single()
          setDirector(dirData)
        }

        const { data: sugData } = await supabase
          .from('preschool_suggestions')
          .select('dimension, suggestion_text')
          .eq('period', parseInt(periodo))

        if (sugData) {
          const mapa: Record<string, string> = {}
          sugData.forEach(s => { mapa[normalizar(s.dimension)] = s.suggestion_text })
          setSugerenciasGlobales(mapa)
        }
      }
      setCargando(false)
    }

    cargarBoletin()
  }, [estudianteId, periodo, supabase])

  const obtenerIconoEscala = (nota: number) => {
    if (!nota || nota <= 0) return null;
    if (nota >= 4.1) return <img src="/logro-alcanzado.png" alt="Alcanzado" style={{ width: 32, height: 32 }} />;
    if (nota >= 3.5) return <img src="/logro-en-proceso.png" alt="En proceso" style={{ width: 32, height: 32 }} />;
    return <img src="/logro-iniciado.png" alt="Iniciado" style={{ width: 32, height: 32 }} />;
  }

  const evaluacionesProcesadas = evaluaciones.map((ev: any) => {
    const dimNorm = normalizar(ev.dimension);
    if (dimNorm.includes('psicomotricidad')) {
      return { ...ev, dimension: 'Dimensión Cognitiva (Dispositivos básicos de aprendizaje)' };
    }
    return ev;
  });

  const evaluacionesAgrupadas = evaluacionesProcesadas.reduce((acc: any[], actual: any) => {
    const dimension = actual.dimension;
    const existente = acc.find(item => item.dimension === dimension);
    if (existente) {
      existente.competencias.push(...(actual.competencies_data || []));
    } else {
      acc.push({
        dimension: dimension,
        competencias: [...(actual.competencies_data || [])]
      });
    }
    return acc;
  }, []);

  evaluacionesAgrupadas.sort((a, b) => {
    const posA = ORDEN_DIMENSIONES.indexOf(normalizar(a.dimension));
    const posB = ORDEN_DIMENSIONES.indexOf(normalizar(b.dimension));
    return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
  });

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
      .print-scale-host { overflow: visible !important; height: auto !important; }
      .page-container { transform: none !important; margin: 0 auto !important; }
    }

    .page-container {
      width: ${currPaper.w};
      max-width: ${currPaper.w};
      min-height: ${currPaper.h};
      margin: 0 auto;
      background: white;
      padding: 15px;
      font-family: Arial, sans-serif;
      color: #1e293b;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      transform-origin: top left;
    }

    table { width: 100%; border-collapse: collapse !important; font-size: 0.75rem; margin-bottom: 0; }
    th, td { padding: 5px 8px; text-align: left; vertical-align: middle; }
    th { font-weight: bold; text-align: center; text-transform: uppercase; border: 1px solid #1e293b; font-size: 0.7rem; }
    .td-bordeado { border: 1px solid #1e293b !important; }
  `

  if (cargando) return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>

  if (sinPermiso) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#ef4444', fontSize: '3rem' }}>403</h1>
        <h2>Acceso Denegado</h2>
        <p style={{ color: '#64748b' }}>No tienes permiso para ver este boletín.</p>
      </div>
    );
  }

  if (errorNivel) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#ef4444', fontSize: '3rem' }}>404</h1>
        <h2>Acceso Denegado</h2>
        <p style={{ color: '#64748b' }}>
          El estudiante seleccionado pertenece a {estudiante?.course_name}, el cual no corresponde a Preescolar.
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
          <FaPrint /> Imprimir Boletín
        </button>
      </div>

      <div className="print-scale-host" style={{ overflow: scale < 1 ? 'hidden' : 'visible', height: hostHeight, width: '100%' }}>
      <div ref={contentRef} className="page-container print-wrapper" style={{ transform: scale < 1 ? `scale(${scale})` : undefined, margin: scale < 1 ? '0' : undefined }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', padding: '0 25px', gap: '20px' }}>
          <div style={{ width: '100px', flexShrink: 0 }}><img src="/logo-ludo.png" alt="Logo" style={{ width: '100%', height: 'auto', display: 'block' }} /></div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ border: '2px solid #1e293b', padding: '10px', display: 'inline-block' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Ludo Club</h1>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Resolución 580 del 26 de junio de 2018</p>
            </div>
            <h2 style={{ fontSize: '1.1rem', marginTop: '10px', textTransform: 'uppercase' }}>Informe individual de desempeño</h2>
            <p style={{ fontWeight: 'bold', margin: '2px 0 0 0' }}>Periodo {periodo} - Año 2026</p>
          </div>
          <div style={{ width: '100px', flexShrink: 0 }}><img src="/logo.jpeg" alt="Logo" style={{ width: '100%', height: 'auto', display: 'block' }} /></div>
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
              <th style={{ width: '18%' }}>Dimensión</th>
              <th style={{ width: '27%' }}>Competencia</th>
              <th style={{ width: '40%' }}>Desempeño</th>
              <th style={{ width: '15%' }}>Valoración</th>
            </tr>
          </thead>
          <tbody>
            {evaluacionesAgrupadas.map((bloque, idxB) => {
              const comps = bloque.competencias;
              const baseName = bloque.dimension.split('(')[0].trim();
              const esComportamiento = normalizar(bloque.dimension) === 'comportamiento';

              const esUltimoDelGrupo = !evaluacionesAgrupadas.slice(idxB + 1).some(
                b => b.dimension.split('(')[0].trim() === baseName
              );

              const sugerencia = esUltimoDelGrupo
                ? (sugerenciasGlobales[normalizar(bloque.dimension)]
                  || sugerenciasGlobales[normalizar(baseName)]
                  || (normalizar(bloque.dimension) === 'comportamiento' ? sugerenciasGlobales[normalizar('Dimensión socio-afectiva')] : null)
                  || 'Sin observaciones para este periodo.')
                : null;

              return (
                <Fragment key={idxB}>
                  {comps.map((c: any, idxC: number) => {
                    const isFirst = idxC === 0;
                    const isLast = idxC === comps.length - 1;

                    const bordeSup = isFirst ? '1px solid #1e293b' : 'none';
                    const bordeInf = isLast ? '1px solid #1e293b' : 'none';

                    return (
                      <tr key={idxC} className="salto-pagina">
                        <td style={{
                          verticalAlign: 'middle',
                          textAlign: 'justify',
                          fontWeight: 'bold',
                          borderTop: bordeSup,
                          borderBottom: bordeInf,
                          borderLeft: '1px solid #1e293b',
                          borderRight: '1px solid #1e293b'
                        }}>
                          {isFirst ? bloque.dimension : ''}
                        </td>
                        {esComportamiento ? (
                          <td colSpan={3} className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{c.desempeno}</td>
                        ) : (
                          <>
                            <td className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{(c.competencia || "-").toUpperCase()}</td>
                            <td className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{c.desempeno}</td>
                            <td className="td-bordeado" style={{ padding: 0, height: '1px' }}>
                              <div style={{ display: 'flex', height: '100%' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #1e293b', padding: '5px' }}>
                                  <span style={{ fontSize: '0.65rem', textAlign: 'center', fontWeight: 'bold', lineHeight: '1.1' }}>{c.escala}</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  {obtenerIconoEscala(parseFloat(c.nota || 0))}
                                </div>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}

                  {sugerencia && (
                    <tr className="salto-pagina">
                      <td colSpan={4} className="td-bordeado" style={{ padding: '10px', backgroundColor: '#f8fafc' }}>
                        <div style={{ fontSize: '0.8rem' }}>
                          <strong>SUGERENCIAS - {baseName}:</strong>
                          <p style={{ margin: '5px 0 0 0', fontStyle: 'italic', lineHeight: '1.4' }}>
                            {sugerencia}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        <div style={{ marginTop: '20px', border: '1px solid #1e293b', padding: '10px 15px', pageBreakInside: 'avoid' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' }}>
            Convenciones de Valoración
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <img src="/logro-alcanzado.png" alt="Logro alcanzado" style={{ width: 28, height: 28 }} />
              <div>
                <strong>Logro alcanzado</strong>
                <div style={{ color: '#475569' }}>4.1 – 5.0</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <img src="/logro-en-proceso.png" alt="Logro en proceso" style={{ width: 28, height: 28 }} />
              <div>
                <strong>Logro en proceso</strong>
                <div style={{ color: '#475569' }}>3.5 – 4.0</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <img src="/logro-iniciado.png" alt="Logro iniciado" style={{ width: 28, height: 28 }} />
              <div>
                <strong>Logro iniciado</strong>
                <div style={{ color: '#475569' }}>1.0 – 3.4</div>
              </div>
            </div>
          </div>
        </div>

        <footer style={{ marginTop: '90px', textAlign: 'center', pageBreakInside: 'avoid' }}>
          <div style={{ borderTop: '1px solid #1e293b', width: '250px', margin: '0 auto 5px auto' }}></div>
          <strong style={{ textTransform: 'uppercase' }}>{director?.full_name || 'Director(a) de Grupo'}</strong>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Firma Docente</p>
        </footer>
      </div>
      </div>
    </div>
  )
}

export default function BoletinPreescolarPDF() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>}>
      <ContenidoBoletinPreescolarPDF />
    </Suspense>
  )
}