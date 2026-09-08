/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, Fragment } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaSpinner, FaPrint, FaThumbsUp } from 'react-icons/fa'
import { usePrintScale } from 'app/hooks/usePrintScale'

const CURSOS_BACHILLERATO = ['Innovadores', 'Conquistadores', 'Gnomos', 'Duendes', 'Elfos'];

const MAPA_AREAS_RAW: Record<string, string> = {
  'Matematicas': 'Matemáticas',
  'Calculo Mental': 'Matemáticas',
  'Geometria': 'Matemáticas',
  'Estadistica': 'Matemáticas',
  'Estadisticas': 'Matemáticas',
  'Ciencias Naturales': 'Ciencias Naturales y Educación Ambiental',
  'Ciencias': 'Ciencias Naturales y Educación Ambiental',
  'Fisica': 'Ciencias Naturales y Educación Ambiental',
  'Quimica': 'Ciencias Naturales y Educación Ambiental',
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

function ContenidoBoletinBachilleratoPDF() {
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
  const [errorNivel, setErrorNivel] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

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
        if (!CURSOS_BACHILLERATO.includes(estData.course_name)) {
          setErrorNivel(true);
          setCargando(false);
          return;
        }

        const { data: evalData } = await supabase
          .from('advanced_evaluations')
          .select('*')
          .eq('student_id', estudianteId)
          .eq('period', parseInt(periodo))
        
        let evaluacionesCrudas = evalData ? [...evalData] : [];

        // Comportamiento
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

          let comps = [];
          if (Array.isArray(actual.competencies_data)) {
            comps = actual.competencies_data;
          } else if (typeof actual.competencies_data === 'string') {
            try { comps = JSON.parse(actual.competencies_data); } catch { comps = []; }
          }

          // CÁLCULO DEL PROMEDIO
          let suma = 0;
          let validas = 0;
          comps.forEach((c: any) => {
            const n = parseFloat(c.nota || c.Nota || 0);
            if (n > 0) { suma += n; validas++; }
          });
          const promedio = validas > 0 ? Math.round((suma / validas) * 10) / 10 : 0;

          areaExistente.asignaturas.push({
            nombre: actual.subject_name,
            competencias: comps,
            promedio: promedio
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

  const obtenerIconoBachillerato = (nota: number) => {
    if (nota === 0) return null;
    if (nota >= 4.5) return <FaThumbsUp size={22} color="#eab308" />;
    if (nota >= 4.0) return <FaThumbsUp size={22} color="#3b82f6" />;
    if (nota >= 3.5) return <FaThumbsUp size={22} color="#22c55e" style={{ transform: 'rotate(30deg)' }} />;
    return <FaThumbsUp size={22} color="#ef4444" style={{ transform: 'rotate(90deg)' }} />;
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
      tr.salto-pagina { page-break-inside: avoid !important; }
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
    table { width: 100%; border-collapse: collapse !important; font-size: 0.8rem; margin-bottom: 0; }
    th, td { padding: 8px 12px; border: 1px solid #1e293b; vertical-align: middle; }
    th { background-color: #f8fafc; text-transform: uppercase; font-weight: bold; text-align: center; }
    .area-header { background-color: #1e293b; color: white; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 0.95rem; }
    .subject-header { background-color: #f1f5f9; font-weight: bold; text-transform: uppercase; font-size: 0.85rem; }
    
    /* 🌟 Clases para las 3 celdas finales */
    .nota-final-row { border-top: 2px solid #1e293b; }
    .label-final { text-align: right; font-weight: bold; text-transform: uppercase; font-size: 0.85rem; color: #1e293b; background-color: #f8fafc; letter-spacing: 1px; padding-right: 20px !important; }
    .valor-final { text-align: center; font-weight: bold; font-size: 1.2rem; background-color: white; width: 10%; }
    .icono-final { text-align: center; background-color: white; width: 10%; }
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
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><h1>404 - Acceso Denegado</h1></div>
  }

  return (
    <div className="print-wrapper" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 0' }}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <strong style={{ color: '#475569', fontSize: '0.9rem' }}>Formato:</strong>
          <select value={formatoPapel} onChange={(e) => setFormatoPapel(e.target.value)} style={{ border: 'none', fontWeight: 'bold', outline: 'none', background: 'transparent' }}>
            <option value="letter">Tamaño Carta</option>
            <option value="legal">Tamaño Oficio</option>
            <option value="A4">Tamaño A4</option>
          </select>
        </div>
        <button onClick={() => window.print()} style={{ backgroundColor: '#3b82f6', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
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
            <h2 style={{ fontSize: '1.1rem', margin: '10px 0 5px 0', textTransform: 'uppercase' }}>Informe individual de desempeño</h2>
            <p style={{ fontWeight: 'bold', margin: 0 }}>Periodo {periodo} - Año 2026</p>
          </div>
          <div style={{ width: '100px', flexShrink: 0 }}><img src="/logo.jpeg" alt="Logo" style={{ width: '100%', height: 'auto', display: 'block' }} /></div>
        </header>

        <div style={{ display: 'flex', border: '1px solid #1e293b', marginBottom: '20px' }}>
          <div style={{ flex: 1, padding: '10px', borderRight: '1px solid #1e293b' }}>ESTUDIANTE: <strong style={{ textTransform: 'uppercase' }}>{estudiante?.full_name}</strong></div>
          <div style={{ width: '250px', padding: '10px' }}>NIVEL: <strong style={{ textTransform: 'uppercase' }}>{estudiante?.course_name}</strong></div>
        </div>

        <table>
          <thead>
            {/* 🌟 LA TABLA AHORA TIENE BASE DE 4 COLUMNAS */}
            <tr>
              <th style={{ width: '40%' }}>Competencia Evaluada</th>
              <th colSpan={3} style={{ width: '60%' }}>Descripción del Desempeño</th>
            </tr>
          </thead>
          <tbody>
            {evaluacionesAgrupadas.map((bloqueArea, idxA) => (
              <Fragment key={idxA}>
                <tr>
                  <td colSpan={4} className="area-header">ÁREA: {bloqueArea.area}</td>
                </tr>

                {bloqueArea.asignaturas.map((asignatura: any, idxAsig: number) => {
                  const esComportamiento = bloqueArea.area === 'Comportamiento'
                  return (
                  <Fragment key={`${idxA}-${idxAsig}`}>
                    <tr>
                      <td colSpan={4} className="subject-header">ASIGNATURA: {asignatura.nombre}</td>
                    </tr>

                    {asignatura.competencias.length > 0 ? (
                      asignatura.competencias.map((c: any, idxC: number) => (
                        <tr key={idxC} className="salto-pagina">
                          {esComportamiento ? (
                            <td colSpan={4} style={{ textAlign: 'justify', padding: '10px 12px' }}>
                              {c.desempeno || c.Desempeno || c.desempeño || "-"}
                            </td>
                          ) : (
                            <>
                              <td style={{ textAlign: 'justify', padding: '10px 12px' }}>
                                {(c.competencia || c.Competencia || "-").toUpperCase()}
                              </td>
                              <td colSpan={3}>{c.desempeno || c.Desempeno || c.desempeño || "-"}</td>
                            </>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr className="salto-pagina">
                        <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '10px' }}>
                          Sin competencias registradas.
                        </td>
                      </tr>
                    )}

                    {/* 🌟 LAS 3 CELDAS DE VALORACIÓN PERFECTAMENTE ALINEADAS */}
                    {!esComportamiento && (
                      <tr className="salto-pagina nota-final-row">
                        <td colSpan={2} className="label-final">
                          VALORACIÓN FINAL DE {asignatura.nombre}:
                        </td>
                        <td className="valor-final">
                          {asignatura.promedio > 0 ? asignatura.promedio.toFixed(1) : '-'}
                        </td>
                        <td className="icono-final">
                          {obtenerIconoBachillerato(asignatura.promedio)}
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
              <FaThumbsUp size={22} color="#22c55e" style={{ transform: 'rotate(30deg)' }} />
              <div>
                <strong>Básico</strong>
                <div style={{ color: '#475569' }}>3.5 – 3.9</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <FaThumbsUp size={22} color="#ef4444" style={{ transform: 'rotate(90deg)' }} />
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
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Firma Autorizada</p>
        </footer>
      </div>
      </div>
    </div>
  )
}

export default function BoletinBachilleratoPDF() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={40} color="#3b82f6" /></div>}>
      <ContenidoBoletinBachilleratoPDF />
    </Suspense>
  )
}