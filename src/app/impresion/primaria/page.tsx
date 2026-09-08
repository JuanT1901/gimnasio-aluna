/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, Fragment } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaSpinner, FaPrint, FaThumbsUp } from 'react-icons/fa'
import { usePrintScale } from 'app/hooks/usePrintScale'

const MAPA_AREAS_RAW: Record<string, string> = {
  'Matematicas': 'Matemáticas',
  'Calculo Mental': 'Matemáticas',
  'Geometria': 'Matemáticas',
  'Estadistica': 'Matemáticas',
  'Estadisticas': 'Matemáticas',
  'Ciencias': 'Ciencias Naturales y Educación Ambiental',
  'Ciencias Naturales': 'Ciencias Naturales y Educación Ambiental',
  'Pre fisica': 'Ciencias Naturales y Educación Ambiental',
  'Pre quimica': 'Ciencias Naturales y Educación Ambiental',
  'Sociales': 'Ciencias Sociales',
  'Ciencias Sociales': 'Ciencias Sociales',
  'Historia': 'Ciencias Sociales',
  'Geografia': 'Ciencias Sociales',
  'Emprendimiento': 'Ciencias Sociales',
  'Español': 'Humanidades',
  'Lectura critica': 'Humanidades',
  'Produccion textual': 'Humanidades',
  'Ingles': 'Humanidades',
  'Sistemas': 'Tecnología e Informática',
  'Arte': 'Educación Artística y Cultural',
  'Artes': 'Educación Artística y Cultural',
  'Danzas': 'Educación Artística y Cultural',
  'Musica': 'Educación Artística y Cultural',
  'Educacion fisica': 'Educación Física',
  'Convivencia': 'Comportamiento'
};

const ORDEN_AREAS = [
  'Matemáticas',
  'Ciencias Naturales y Educación Ambiental',
  'Ciencias Sociales',
  'Humanidades',
  'Tecnología e Informática',
  'Educación Artística y Cultural',
  'Educación Física',
  'Comportamiento'
];

const ORDEN_ASIGNATURAS: Record<string, string[]> = {
  'Matemáticas': ['matematicas', 'calculo mental', 'geometria', 'estadistica', 'estadisticas'],
  'Ciencias Naturales y Educación Ambiental': ['ciencias naturales', 'ciencias', 'pre fisica', 'pre quimica', 'fisica', 'quimica'],
  'Ciencias Sociales': ['sociales', 'ciencias sociales', 'geografia', 'emprendimiento'],
  'Humanidades': ['espanol', 'ingles'],
  'Tecnología e Informática': ['sistemas'],
  'Educación Artística y Cultural': ['artes', 'arte', 'danzas', 'musica'],
  'Educación Física': ['educacion fisica'],
  'Comportamiento': ['convivencia']
};

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const MAPA_AREAS: Record<string, string> = {};
for (const [key, value] of Object.entries(MAPA_AREAS_RAW)) {
  MAPA_AREAS[normalizar(key)] = value;
}

const buscarArea = (nombre: string) => MAPA_AREAS[normalizar(nombre)] || 'Otras Áreas';

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

  const { contentRef, scale, hostHeight } = usePrintScale([cargando, formatoPapel])

  const CURSOS_PRIMARIA = ['Emprendedores', 'Ingeniosos', 'Transformadores'];
  const [errorNivel, setErrorNivel] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

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
                desempeno: compData.desempeno || compData.observations || 'Sin observación.'
              }
            ]
          });
        }

        const agrupadoPorArea = evaluacionesCrudas.reduce((acc: any[], actual: any) => {
          const nombreArea = buscarArea(actual.subject_name);
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
          const posA = ORDEN_AREAS.indexOf(a.area);
          const posB = ORDEN_AREAS.indexOf(b.area);
          return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
        });

        agrupadoPorArea.forEach(grupo => {
          const ordenAsigs = ORDEN_ASIGNATURAS[grupo.area];
          if (ordenAsigs) {
            grupo.asignaturas.sort((a: any, b: any) => {
              const posA = ordenAsigs.indexOf(normalizar(a.nombre));
              const posB = ordenAsigs.indexOf(normalizar(b.nombre));
              return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
            });
          }
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
    @media print {
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
    th { font-weight: bold; text-align: center; text-transform: uppercase; border: 1px solid #1e293b; font-size: 0.8rem; }
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

                          if (esComportamiento) {
                            return (
                              <tr key={`${idxAsig}-${idxC}`} className="salto-pagina">
                                <td colSpan={3} className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{textoDesempeno}</td>
                              </tr>
                            )
                          }

                          return (
                            <tr key={`${idxAsig}-${idxC}`} className="salto-pagina">
                              <td className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{textoCompetencia.toUpperCase()}</td>
                              <td className="td-bordeado" style={{ textAlign: 'justify', padding: '10px 12px' }}>{textoDesempeno}</td>
                              <td className="td-bordeado" style={{ padding: 0, height: '1px' }}>
                                <div style={{ display: 'flex', height: '100%' }}>
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid #1e293b', padding: '5px' }}>
                                    <strong style={{ fontSize: '1.1rem' }}>{notaNum.toFixed(1)}</strong>
                                    <span style={{ fontSize: '0.65rem', textAlign: 'center', lineHeight: '1.1' }}>{textoEscala}</span>
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

        <div style={{ marginTop: '20px', border: '1px solid #1e293b', padding: '10px 15px', pageBreakInside: 'avoid' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' }}>
            Convenciones de Valoración
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <FaThumbsUp size={22} color="#eab308" />
              <div>
                <strong>Superior</strong>
                <div style={{ color: '#475569' }}>4.5 – 5.0</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <FaThumbsUp size={22} color="#3b82f6" />
              <div>
                <strong>Alto</strong>
                <div style={{ color: '#475569' }}>4.0 – 4.4</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <FaThumbsUp size={22} color="#22c55e" />
              <div>
                <strong>Básico</strong>
                <div style={{ color: '#475569' }}>3.5 – 3.9</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <FaThumbsUp size={22} color="#ef4444" />
              <div>
                <strong>Bajo</strong>
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

export default function BoletinPrimariaPDF() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>}>
      <ContenidoBoletinPrimariaPDF />
    </Suspense>
  )
}