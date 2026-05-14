/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaUserPlus, FaUserGraduate, FaSpinner, FaSearch, FaEdit, FaTimes, FaSave, FaFilter, FaCheckCircle, FaAddressCard, FaFemale, FaMale, FaBus, FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { actualizarEstudiante } from './actions'

export default function EstudiantesPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [cursos, setCursos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  
  const [busqueda, setBusqueda] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')

  const [estudianteEditando, setEstudianteEditando] = useState<any>(null)
  const [guardandoCambios, setGuardandoCambios] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState(false)
  
  const [seccionAbierta, setSeccionAbierta] = useState<string>('academicos')

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarDatos = async () => {
    try {
      const { data: estData } = await supabase.from('profiles').select('id, full_name, doc_type, doc_number, course_name, grade_id, birth_date, city, neighborhood, address, doc_expedition_city, eps, blood_type, siblings_count, mother_name, mother_doc, mother_profession, mother_cellphone, mother_phone, mother_email, mother_lives_with_student, father_name, father_doc, father_profession, father_cellphone, father_phone, father_email, father_lives_with_student, guardian_name, guardian_cellphone, reference_name, reference_cellphone, extra_shift, school_bus, bus_address, needs_sweatshirt, sweatshirt_size, needs_tshirt, tshirt_size').eq('role', 'student').order('full_name', { ascending: true })
      if (estData) setEstudiantes(estData)

      const { data: gradesData } = await supabase.from('grades').select('*').order('order_index', { ascending: true })
      if (gradesData) setCursos(gradesData)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setCargando(false)
    }
  }

  const abrirModalEdicion = (estudiante: any) => {
    setEstudianteEditando({ ...estudiante })
    setSeccionAbierta('academicos')
    setErrorEdicion(null)
  }

  const cerrarModal = () => {
    setEstudianteEditando(null)
  }

  const manejarCambioInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEstudianteEditando((prev: any) => ({ ...prev, [name]: value }))
  }

  const toggleSeccion = (seccion: string) => {
    setSeccionAbierta(seccionAbierta === seccion ? '' : seccion)
  }

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardandoCambios(true)
    setErrorEdicion(null)

    try {
      let gradeIdToSave = null;
      if (estudianteEditando.course_name) {
        const cursoEncontrado = cursos.find(c => c.name === estudianteEditando.course_name);
        if (cursoEncontrado) {
          gradeIdToSave = cursoEncontrado.id;
        }
      }

      const resultado = await actualizarEstudiante(estudianteEditando.id, {
        full_name: estudianteEditando.full_name,
        doc_type: estudianteEditando.doc_type,
        doc_number: estudianteEditando.doc_number,
        course_name: estudianteEditando.course_name,
        grade_id: gradeIdToSave,
        birth_date: estudianteEditando.birth_date,
        city: estudianteEditando.city,
        neighborhood: estudianteEditando.neighborhood,
        address: estudianteEditando.address,
        doc_expedition_city: estudianteEditando.doc_expedition_city,
        eps: estudianteEditando.eps,
        blood_type: estudianteEditando.blood_type,
        siblings_count: estudianteEditando.siblings_count,
        mother_name: estudianteEditando.mother_name,
        mother_doc: estudianteEditando.mother_doc,
        mother_profession: estudianteEditando.mother_profession,
        mother_cellphone: estudianteEditando.mother_cellphone,
        mother_phone: estudianteEditando.mother_phone,
        mother_email: estudianteEditando.mother_email,
        mother_lives_with_student: estudianteEditando.mother_lives_with_student,
        father_name: estudianteEditando.father_name,
        father_doc: estudianteEditando.father_doc,
        father_profession: estudianteEditando.father_profession,
        father_cellphone: estudianteEditando.father_cellphone,
        father_phone: estudianteEditando.father_phone,
        father_email: estudianteEditando.father_email,
        father_lives_with_student: estudianteEditando.father_lives_with_student,
        guardian_name: estudianteEditando.guardian_name,
        guardian_cellphone: estudianteEditando.guardian_cellphone,
        reference_name: estudianteEditando.reference_name,
        reference_cellphone: estudianteEditando.reference_cellphone,
        extra_shift: estudianteEditando.extra_shift,
        school_bus: estudianteEditando.school_bus,
        bus_address: estudianteEditando.bus_address,
        needs_sweatshirt: estudianteEditando.needs_sweatshirt,
        sweatshirt_size: estudianteEditando.sweatshirt_size,
        needs_tshirt: estudianteEditando.needs_tshirt,
        tshirt_size: estudianteEditando.tshirt_size
      })

      if (!resultado.exito) throw new Error(resultado.error)

      setEstudiantes(estudiantes.map(est => est.id === estudianteEditando.id ? { ...estudianteEditando, grade_id: gradeIdToSave } : est))
      cerrarModal()
      
      setMensajeExito(true)
      setTimeout(() => setMensajeExito(false), 3000)

    } catch (error: any) {
      if (error.code === '23505') setErrorEdicion('Ya existe otra persona registrada con este Número de Documento.')
      else if (error.message?.includes('course_name')) setErrorEdicion('Error interno: La plataforma no detecta la columna de cursos. Recarga la base de datos.')
      else setErrorEdicion(`Error del sistema: ${error.message}`)
    } finally {
      setGuardandoCambios(false)
    }
  }

  const estudiantesFiltrados = estudiantes.filter(est => {
    const coincideTexto = est.full_name?.toLowerCase().includes(busqueda.toLowerCase()) || est.doc_number?.includes(busqueda)
    const coincideCurso = filtroCurso === '' || est.course_name === filtroCurso
    return coincideTexto && coincideCurso
  })

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem' }
  const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#475569', fontSize: '0.85rem' }
  const accordionHeaderStyle = { backgroundColor: '#f1f5f9', padding: '15px 20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: '#334155', border: '1px solid #e2e8f0', userSelect: 'none' as const }
  const accordionBodyStyle = { padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', marginBottom: '15px' }

  return (
    <main className={styles.mainContent} style={{ position: 'relative' }}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>Gestión de Estudiantes 🎓</h1><p>Administra el listado de alumnos del Gimnasio Aluna.</p></div>
        <Link href="/plataformas/admin/estudiantes/importar" className={styles.saveBtn} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
          <FaUserPlus /> Importar Estudiantes
        </Link>
      </header>

      <div className={styles.card}>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '2 1 300px' }}>
            <FaSearch style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input type="text" placeholder="Buscar por nombre o documento..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ width: '100%', padding: '12px 35px 12px 40px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />
            {busqueda.length > 0 && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '5px' }}><FaTimes /></button>}
          </div>
          
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <FaFilter style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <select value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
              <option value="">Todos los cursos</option>
              {cursos.map(curso => <option key={curso.id} value={curso.name}>{curso.name}</option>)}
            </select>
          </div>
        </div>

        {cargando ? <div style={{ textAlign: 'center', padding: '40px' }}><FaSpinner className="fa-spin" size={30} color="#3CA0E8" /></div> : estudiantesFiltrados.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}><FaUserGraduate size={50} style={{ marginBottom: '15px', opacity: 0.5 }} /><h3>No se encontraron estudiantes</h3></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}><th style={{ padding: '15px 10px' }}>Nombre Completo</th><th style={{ padding: '15px 10px' }}>Documento</th><th style={{ padding: '15px 10px' }}>Curso</th><th style={{ padding: '15px 10px', textAlign: 'center' }}>Acciones</th></tr></thead>
              <tbody>
                {estudiantesFiltrados.map((est) => (
                  <tr key={est.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '15px 10px', fontWeight: 'bold' }}>{est.full_name}</td>
                    <td style={{ padding: '15px 10px' }}>{est.doc_type} {est.doc_number}</td>
                    <td style={{ padding: '15px 10px' }}><span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', color: '#475569', fontWeight: 'bold' }}>{est.course_name || 'Sin asignar'}</span></td>
                    <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                      <button onClick={() => abrirModalEdicion(est)} style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}><FaEdit /> Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {estudianteEditando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            
            <button onClick={cerrarModal} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}><FaTimes /></button>
            <h2 style={{ marginBottom: '25px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
              <FaEdit color="#d97706" /> Actualizar Ficha de {estudianteEditando.full_name.split(' ')[0]}
            </h2>

            {errorEdicion && <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginBottom: '20px', fontSize: '0.95rem' }}><strong>⚠️ Error:</strong> {errorEdicion}</div>}

            <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column' }}>
              
              <div onClick={() => toggleSeccion('academicos')} style={{...accordionHeaderStyle, marginBottom: seccionAbierta === 'academicos' ? '0' : '15px', borderRadius: seccionAbierta === 'academicos' ? '8px 8px 0 0' : '8px'}}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaAddressCard color="#10b981" /> 1. Datos Personales y Académicos</span>
                {seccionAbierta === 'academicos' ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              {seccionAbierta === 'academicos' && (
                <div style={accordionBodyStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nombre Completo *</label><input type="text" name="full_name" value={estudianteEditando.full_name || ''} onChange={manejarCambioInput} style={inputStyle} required /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Curso Asignado *</label><select name="course_name" value={estudianteEditando.course_name || ''} onChange={manejarCambioInput} style={inputStyle} required><option value="">-- Sin asignar --</option>{cursos.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                    <div><label style={labelStyle}>Tipo de Doc.</label><select name="doc_type" value={estudianteEditando.doc_type || ''} onChange={manejarCambioInput} style={inputStyle}><option value="RC">RC</option><option value="TI">TI</option><option value="CC">CC</option><option value="CE">CE</option><option value="PPT">PPT</option></select></div>
                    <div><label style={labelStyle}>Número Doc. *</label><input type="text" name="doc_number" value={estudianteEditando.doc_number || ''} onChange={manejarCambioInput} style={inputStyle} required /></div>
                    <div><label style={labelStyle}>Expedición Doc.</label><input type="text" name="doc_expedition_city" value={estudianteEditando.doc_expedition_city || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Fecha Nacimiento</label><input type="date" name="birth_date" value={estudianteEditando.birth_date || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>RH</label><input type="text" name="blood_type" value={estudianteEditando.blood_type || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>E.P.S</label><input type="text" name="eps" value={estudianteEditando.eps || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Ciudad</label><input type="text" name="city" value={estudianteEditando.city || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Barrio</label><input type="text" name="neighborhood" value={estudianteEditando.neighborhood || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Dirección</label><input type="text" name="address" value={estudianteEditando.address || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>N° Hermanos</label><input type="number" name="siblings_count" value={estudianteEditando.siblings_count || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                  </div>
                </div>
              )}

              <div onClick={() => toggleSeccion('madre')} style={{...accordionHeaderStyle, marginBottom: seccionAbierta === 'madre' ? '0' : '15px', borderRadius: seccionAbierta === 'madre' ? '8px 8px 0 0' : '8px'}}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaFemale color="#ec4899" /> 2. Información de la Madre</span>
                {seccionAbierta === 'madre' ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              {seccionAbierta === 'madre' && (
                <div style={accordionBodyStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nombre de la Madre</label><input type="text" name="mother_name" value={estudianteEditando.mother_name || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Documento</label><input type="text" name="mother_doc" value={estudianteEditando.mother_doc || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Profesión</label><input type="text" name="mother_profession" value={estudianteEditando.mother_profession || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Celular</label><input type="text" name="mother_cellphone" value={estudianteEditando.mother_cellphone || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Teléfono Fijo</label><input type="text" name="mother_phone" value={estudianteEditando.mother_phone || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Correo</label><input type="email" name="mother_email" value={estudianteEditando.mother_email || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>¿Vive con el niño(a)?</label><select name="mother_lives_with_student" value={estudianteEditando.mother_lives_with_student || ''} onChange={manejarCambioInput} style={inputStyle}><option value="">--</option><option value="Sí">Sí</option><option value="No">No</option></select></div>
                  </div>
                </div>
              )}

              <div onClick={() => toggleSeccion('padre')} style={{...accordionHeaderStyle, marginBottom: seccionAbierta === 'padre' ? '0' : '15px', borderRadius: seccionAbierta === 'padre' ? '8px 8px 0 0' : '8px'}}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaMale color="#6366f1" /> 3. Información del Padre</span>
                {seccionAbierta === 'padre' ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              {seccionAbierta === 'padre' && (
                <div style={accordionBodyStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nombre del Padre</label><input type="text" name="father_name" value={estudianteEditando.father_name || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Documento</label><input type="text" name="father_doc" value={estudianteEditando.father_doc || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Profesión</label><input type="text" name="father_profession" value={estudianteEditando.father_profession || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Celular</label><input type="text" name="father_cellphone" value={estudianteEditando.father_cellphone || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Teléfono Fijo</label><input type="text" name="father_phone" value={estudianteEditando.father_phone || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Correo</label><input type="email" name="father_email" value={estudianteEditando.father_email || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>¿Vive con el niño(a)?</label><select name="father_lives_with_student" value={estudianteEditando.father_lives_with_student || ''} onChange={manejarCambioInput} style={inputStyle}><option value="">--</option><option value="Sí">Sí</option><option value="No">No</option></select></div>
                  </div>
                </div>
              )}

              <div onClick={() => toggleSeccion('servicios')} style={{...accordionHeaderStyle, marginBottom: seccionAbierta === 'servicios' ? '0' : '20px', borderRadius: seccionAbierta === 'servicios' ? '8px 8px 0 0' : '8px'}}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaBus color="#8b5cf6" /> 4. Acudiente, Servicios y Uniformes</span>
                {seccionAbierta === 'servicios' ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              {seccionAbierta === 'servicios' && (
                <div style={accordionBodyStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div><label style={labelStyle}>Nombre Acudiente</label><input type="text" name="guardian_name" value={estudianteEditando.guardian_name || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Celular Acudiente</label><input type="text" name="guardian_cellphone" value={estudianteEditando.guardian_cellphone || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Ref. Familiar</label><input type="text" name="reference_name" value={estudianteEditando.reference_name || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Celular Referencia</label><input type="text" name="reference_cellphone" value={estudianteEditando.reference_cellphone || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', marginTop: '10px', paddingTop: '15px' }}></div>
                    
                    <div><label style={labelStyle}>Jornada Adicional</label><select name="extra_shift" value={estudianteEditando.extra_shift || ''} onChange={manejarCambioInput} style={inputStyle}><option value="">--</option><option value="Sí">Sí</option><option value="No">No</option></select></div>
                    <div><label style={labelStyle}>Ruta Escolar</label><select name="school_bus" value={estudianteEditando.school_bus || ''} onChange={manejarCambioInput} style={inputStyle}><option value="">--</option><option value="Sí">Sí</option><option value="No">No</option></select></div>
                    <div><label style={labelStyle}>Dir/Barrio Ruta</label><input type="text" name="bus_address" value={estudianteEditando.bus_address || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    
                    <div><label style={labelStyle}>Requiere Buzo</label><select name="needs_sweatshirt" value={estudianteEditando.needs_sweatshirt || ''} onChange={manejarCambioInput} style={inputStyle}><option value="">--</option><option value="Sí">Sí</option><option value="No">No</option></select></div>
                    <div><label style={labelStyle}>Talla Buzo</label><input type="text" name="sweatshirt_size" value={estudianteEditando.sweatshirt_size || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Requiere Camiseta</label><select name="needs_tshirt" value={estudianteEditando.needs_tshirt || ''} onChange={manejarCambioInput} style={inputStyle}><option value="">--</option><option value="Sí">Sí</option><option value="No">No</option></select></div>
                    <div><label style={labelStyle}>Talla Camiseta</label><input type="text" name="tshirt_size" value={estudianteEditando.tshirt_size || ''} onChange={manejarCambioInput} style={inputStyle} /></div>
                  </div>
                </div>
              )}

              <button type="submit" disabled={guardandoCambios} style={{ marginTop: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: guardandoCambios ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                {guardandoCambios ? <FaSpinner className="fa-spin" /> : <FaSave />}
                {guardandoCambios ? 'Actualizando Ficha...' : 'Guardar Actualización'}
              </button>
            </form>

          </div>
        </div>
      )}

      {mensajeExito && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#10b981', color: 'white', padding: '15px 25px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 9999, fontWeight: 'bold' }}>
          <FaCheckCircle size={24} /> Ficha del estudiante actualizada con éxito
        </div>
      )}
    </main>
  )
}