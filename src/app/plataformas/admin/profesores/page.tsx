/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { cambiarContrasenaProfesor, toggleEstadoProfesor } from './actions'
import styles from 'app/styles/pages/Dashboard.module.scss'
import { FaChalkboardTeacher, FaBook, FaSpinner, 
         FaUpload, FaArrowLeft, FaEdit, FaList, 
         FaPlus, FaTrash, FaSave, FaUserEdit, 
         FaUserCheck, FaUserSlash, FaKey } from 'react-icons/fa'

export default function AdminProfesoresPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const [vista, setVista] = useState<'lista' | 'clases' | 'editar'>('lista')
  const [profeActivo, setProfeActivo] = useState<any>(null)

  const [profesores, setProfesores] = useState<any[]>([])
  const [clasesProfe, setClasesProfe] = useState<any[]>([])
  const [cursosDisponibles, setCursosDisponibles] = useState<any[]>([])
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState('')
  
  // 🌟 NUEVOS ESTADOS PARA MATERIAS
  const [materiasDisponibles, setMateriasDisponibles] = useState<any[]>([])
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [cambiandoClave, setCambiandoClave] = useState(false)

  const [editData, setEditData] = useState({
    full_name: '',
    doc_number: '',
    email: '',
    birth_date: '',
    address: '',
    phone_number: '',
    compensation_fund: '',
    eps: '',
    arl: '',
    pension_fund: ''
  })

  const cambiarEstado = async (profe: any) => {
    const estaActivo = profe.is_active !== false;
    const accion = estaActivo ? 'DESHABILITAR' : 'HABILITAR';
    
    if (!confirm(`🚨 ¿Estás seguro de que deseas ${accion} al profesor ${profe.full_name}?`)) return;

    setCargando(true);
    const nuevoEstado = !estaActivo;
    const resultado = await toggleEstadoProfesor(profe.id, nuevoEstado);

    if (resultado.exito) {
      alert(`✅ Profesor ${nuevoEstado ? 'habilitado' : 'deshabilitado'} correctamente.`);
      cargarProfesores();
    } else {
      alert(`❌ Hubo un error: ${resultado.error}`);
    }
    setCargando(false);
  }

  useEffect(() => {
    if (vista === 'lista') {
      cargarProfesores()
    }
  }, [vista])

  const cargarProfesores = async () => {
    setCargando(true)
    const { data: profes } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('full_name', { ascending: true })

    if (profes) setProfesores(profes)
    setCargando(false)
  }

  useEffect(() => {
    if (vista === 'clases' && profeActivo) {
      cargarClasesYCursos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, profeActivo])

  const cargarClasesYCursos = async () => {
    setCargando(true)
    
    const { data: asignaciones } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('teacher_id', profeActivo.id)

    if (asignaciones) setClasesProfe(asignaciones)

    const { data: grados } = await supabase
      .from('grades')
      .select('id, name')
      .order('name', { ascending: true })

    if (grados) {
      setCursosDisponibles(grados)
      if (grados.length > 0) setCursoSeleccionadoId(grados[0].id)
    }
    
    setCargando(false)
  }

  // 🌟 NUEVO EFECTO: Carga las materias dinámicamente según el curso seleccionado
  useEffect(() => {
    if (!cursoSeleccionadoId) return

    const cargarMaterias = async () => {
      const { data } = await supabase
        .from('subjects') // Ajusta este nombre si tu tabla se llama distinto (ej. 'materias')
        .select('id, name')
        .eq('grade_id', cursoSeleccionadoId)
        .order('name', { ascending: true })

      if (data) {
        setMateriasDisponibles(data)
        if (data.length > 0) setMateriaSeleccionada(data[0].name)
        else setMateriaSeleccionada('')
      }
    }
    cargarMaterias()
  }, [cursoSeleccionadoId, supabase])

  const agregarClase = async () => {
    if (!materiaSeleccionada || !cursoSeleccionadoId) return alert('Por favor selecciona un curso y una materia.')
    setGuardando(true)

    const cursoObj = cursosDisponibles.find(c => String(c.id) === String(cursoSeleccionadoId))
    if (!cursoObj) {
      alert('Error interno: No se encontró el curso.');
      setGuardando(false);
      return;
    }

    const { data: asignacionesExistentes, error: checkError } = await supabase
      .from('teacher_assignments')
      .select('id, teacher_id, profiles(full_name)')
      .eq('grade_id', cursoObj.id)
      .eq('subject_name', materiaSeleccionada)

    if (checkError) {
      alert('Error al verificar la base de datos: ' + checkError.message);
      setGuardando(false);
      return;
    }

    const hayAsignaciones = asignacionesExistentes && asignacionesExistentes.length > 0;
    
    const laTieneEsteProfe = hayAsignaciones && asignacionesExistentes.some(a => a.teacher_id === profeActivo.id);
    
    if (laTieneEsteProfe) {
      alert('Este profesor ya tiene asignada esta materia en este curso.');
      setGuardando(false);
      return;
    }

    if (hayAsignaciones) {
      // @ts-expect-error
      const profeActual = asignacionesExistentes[0].profiles?.full_name || 'otro profesor';
      
      const confirmar = confirm(
        `⚠️ ATENCIÓN: La materia "${materiaSeleccionada}" ya está asignada al profesor(a) ${profeActual} en este curso.\n\n¿Deseas quitarle la materia a ${profeActual} y reasignársela a ${profeActivo.full_name}?`
      );

      if (!confirmar) {
        setGuardando(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('teacher_assignments')
        .update({ teacher_id: profeActivo.id })
        .eq('grade_id', cursoObj.id)
        .eq('subject_name', materiaSeleccionada)

      if (updateError) {
        alert('Error al reasignar: ' + updateError.message)
      } else {
        alert('✅ Materia reasignada con éxito.')
        cargarClasesYCursos()
      }
      setGuardando(false);
      return;
    }

    const nuevaAsignacion = {
      teacher_id: profeActivo.id, 
      grade_id: cursoObj.id, 
      course_name: cursoObj.name, 
      subject_name: materiaSeleccionada 
    }

    const { data, error } = await supabase.from('teacher_assignments').insert([nuevaAsignacion]).select()
    
    if (error) {
      alert('Error al asignar la clase: ' + error.message)
    } else if (data) { 
      setClasesProfe([...clasesProfe, data[0]]); 
    }
    
    setGuardando(false)
  }

  const eliminarClase = async (idAsignacion: string) => {
    if (!confirm('¿Estás seguro de quitar esta clase?')) return

    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('id', idAsignacion)

    if (!error) {
      setClasesProfe(clasesProfe.filter(c => c.id !== idAsignacion))
    }
  }

  const abrirEdicion = (profe: any) => {
    setProfeActivo(profe)
    setEditData({
      full_name: profe.full_name || '',
      doc_number: profe.doc_number || '',
      email: profe.email || '',
      birth_date: profe.birth_date || '',
      address: profe.address || '',
      phone_number: profe.phone_number || '',
      compensation_fund: profe.compensation_fund || '',
      eps: profe.eps || '',
      arl: profe.arl || '',
      pension_fund: profe.pension_fund || ''
    })
    setVista('editar')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEditData(prev => ({ ...prev, [name]: value }))
  }

  const guardarPerfil = async () => {
    setGuardando(true)
    const { error } = await supabase
      .from('profiles')
      .update(editData)
      .eq('id', profeActivo.id)

    setGuardando(false)

    if (error) {
      alert('Error al actualizar el perfil: ' + error.message)
    } else {
      alert('¡Perfil actualizado con éxito!')
      setVista('lista')
      cargarProfesores()
    }
  }

  const ejecutarCambioClave = async () => {
    if (!nuevaContrasena) return alert('Debes escribir una contraseña nueva.')
    if (nuevaContrasena.length < 8) return alert('La contraseña debe tener al menos 8 caracteres.')
    if (!confirm(`¿Estás seguro de cambiar la contraseña de acceso de ${profeActivo.full_name}?`)) return;

    setCambiandoClave(true);
    const resultado = await cambiarContrasenaProfesor(profeActivo.id, nuevaContrasena);
    
    if (resultado.exito) {
      alert(`✅ Contraseña restablecida con éxito.`);
      setNuevaContrasena(''); // Limpiamos el campo
    } else {
      alert(`❌ Error al cambiar contraseña: ${resultado.error}`);
    }
    setCambiandoClave(false);
  }

  if (cargando && vista === 'lista') return <div style={{ textAlign: 'center', marginTop: '100px' }}><FaSpinner className="fa-spin" size={50} color="#3b82f6" /></div>

  return (
    <main className={styles.mainContent}>
      
      {/* 🟢 VISTA 1: LISTA DE PROFESORES */}
      {vista === 'lista' && (
        <>
          <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <div>
              <h1>Gestión de Profesores 👨‍🏫</h1>
              <p style={{ color: '#64748b' }}>Administra el personal docente y sus cargas académicas.</p>
            </div>
            
            <Link 
              href="/plataformas/admin/profesores/importar" 
              style={{ backgroundColor: '#10b981', color: 'white', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
            >
              <FaUpload /> Importar Matriz Excel
            </Link>
          </header>

          <div className={styles.card} style={{ maxWidth: '1000px', margin: '0 auto', overflow: 'hidden' }}>
            {profesores.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                No hay profesores registrados. Sube la matriz docente para comenzar.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '15px 20px' }}>Nombre del Profesor</th>
                    <th style={{ padding: '15px 20px' }}>Documento</th>
                    <th style={{ padding: '15px 20px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {profesores.map((profe, index) => {
                    const estaActivo = profe.is_active !== false; // Por defecto es true
                    
                    return (
                      <tr key={profe.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc', opacity: estaActivo ? 1 : 0.6 }}>
                        <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FaChalkboardTeacher color={estaActivo ? "#3b82f6" : "#94a3b8"} /> 
                          <span style={{ textDecoration: estaActivo ? 'none' : 'line-through' }}>{profe.full_name}</span>
                          
                          {/* Etiqueta Visual */}
                          <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', backgroundColor: estaActivo ? '#dcfce7' : '#fee2e2', color: estaActivo ? '#166534' : '#991b1b', marginLeft: '10px' }}>
                            {estaActivo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '15px 20px', color: '#64748b' }}>
                          {profe.doc_number || 'N/A'}
                        </td>
                        <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            
                            {/* Botón de Habilitar/Deshabilitar */}
                            <button 
                              onClick={() => cambiarEstado(profe)}
                              style={{ backgroundColor: estaActivo ? '#ef4444' : '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                              title={estaActivo ? "Deshabilitar acceso" : "Restaurar acceso"}
                            >
                              {estaActivo ? <FaUserSlash /> : <FaUserCheck />}
                            </button>

                            {/* Solo permitimos editar/ver clases si el profe está activo */}
                            {estaActivo && (
                              <>
                                <button 
                                  onClick={() => { setProfeActivo(profe); setVista('clases'); }}
                                  style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                                >
                                  <FaList /> Clases
                                </button>
                                <button 
                                  onClick={() => abrirEdicion(profe)}
                                  style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                                >
                                  <FaEdit /> Editar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* 🟢 VISTA 2: CLASES DEL PROFESOR */}
      {vista === 'clases' && profeActivo && (
        <>
          <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
            <button onClick={() => setVista('lista')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>
              <FaArrowLeft />
            </button>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <FaBook color="#3b82f6" /> Clases de {profeActivo.full_name}
              </h1>
              <p style={{ margin: 0, color: '#64748b', marginTop: '5px' }}>Gestiona las materias asignadas a este docente.</p>
            </div>
          </header>

          <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '0 auto', flexWrap: 'wrap' }}>
            <div className={styles.card} style={{ flex: '2', minWidth: '300px' }}>
              <h3 style={{ marginTop: 0, borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>Carga Académica Actual</h3>
              {cargando ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><FaSpinner className="fa-spin" color="#3b82f6" /></div>
              ) : clasesProfe.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Este profesor no tiene clases asignadas.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {clasesProfe.map(clase => (
                    <li key={clase.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '10px' }}>
                      <div>
                        <strong style={{ display: 'block', color: '#1e293b' }}>{clase.course_name}</strong>
                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{clase.subject_name}</span>
                      </div>
                      <button 
                        onClick={() => eliminarClase(clase.id)}
                        style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                        title="Quitar clase"
                      >
                        <FaTrash />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.card} style={{ flex: '1', minWidth: '300px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <h3 style={{ marginTop: 0, color: '#166534' }}>Asignar Nueva Clase</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem', color: '#15803d' }}>Curso / Grado:</label>
                <select 
                  value={cursoSeleccionadoId} 
                  onChange={(e) => setCursoSeleccionadoId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #86efac', backgroundColor: 'white' }}
                >
                  {cursosDisponibles.map(curso => (
                    <option key={curso.id} value={curso.id}>{curso.name}</option>
                  ))}
                </select>
              </div>

              {/* 🌟 NUEVO SELECTOR DINÁMICO DE MATERIAS */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem', color: '#15803d' }}>Nombre de la Materia:</label>
                {materiasDisponibles.length > 0 ? (
                  <select 
                    value={materiaSeleccionada} 
                    onChange={(e) => setMateriaSeleccionada(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #86efac', backgroundColor: 'white' }}
                  >
                    {materiasDisponibles.map(materia => (
                      <option key={materia.id} value={materia.name}>{materia.name}</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '5px 0' }}>
                    No hay materias registradas para este curso en la base de datos.
                  </p>
                )}
              </div>

              <button 
                onClick={agregarClase}
                disabled={guardando || !materiaSeleccionada || materiasDisponibles.length === 0}
                style={{ width: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: (guardando || !materiaSeleccionada || materiasDisponibles.length === 0) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
              >
                {guardando ? <FaSpinner className="fa-spin" /> : <FaPlus />} Asignar Materia
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🟢 VISTA 3: EDITAR PERFIL DEL PROFESOR (COMPLETO CON RRHH) */}
      {vista === 'editar' && profeActivo && (
        <>
          <header className={styles.header} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
            <button onClick={() => setVista('lista')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>
              <FaArrowLeft />
            </button>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <FaUserEdit color="#f59e0b" /> Expediente de RRHH
              </h1>
              <p style={{ margin: 0, color: '#64748b', marginTop: '5px' }}>Actualiza la información personal y de nómina de este docente.</p>
            </div>
          </header>

          <div className={styles.card} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Nombre Completo:</label>
                <input type="text" name="full_name" value={editData.full_name} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Documento de Identidad:</label>
                <input type="text" name="doc_number" value={editData.doc_number} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Correo Electrónico:</label>
                <input type="email" name="email" value={editData.email} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Número de Celular:</label>
                <input type="text" name="phone_number" value={editData.phone_number} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Fecha de Nacimiento:</label>
                <input type="date" name="birth_date" value={editData.birth_date} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Dirección de Residencia:</label>
                <input type="text" name="address" value={editData.address} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>EPS:</label>
                <input type="text" name="eps" value={editData.eps} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>ARL:</label>
                <input type="text" name="arl" value={editData.arl} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Caja de Compensación:</label>
                <input type="text" name="compensation_fund" value={editData.compensation_fund} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Fondo de Pensiones:</label>
                <input type="text" name="pension_fund" value={editData.pension_fund} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

            </div>

            <button 
              onClick={guardarPerfil}
              disabled={guardando}
              style={{ width: '100%', backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
            >
              {guardando ? <FaSpinner className="fa-spin" /> : <FaSave />}
              Guardar Expediente
            </button>

            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px dashed #e2e8f0', backgroundColor: '#fef2f2', padding: '20px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaKey /> Zona de Seguridad: Restablecer Acceso
              </h3>
              <p style={{ color: '#7f1d1d', fontSize: '0.9rem', marginBottom: '15px' }}>
                Usa esta función solo si el profesor ha olvidado su contraseña o por solicitud administrativa. Escribe una nueva clave (mín. 8 caracteres).
              </p>
              
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Escriba la nueva contraseña..." 
                  value={nuevaContrasena} 
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #fca5a5', fontWeight: 'bold' }}
                />
                <button 
                  onClick={ejecutarCambioClave}
                  disabled={cambiandoClave || !nuevaContrasena}
                  style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: (cambiandoClave || !nuevaContrasena) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {cambiandoClave ? <FaSpinner className="fa-spin" /> : <FaKey />} Forzar Cambio de Clave
                </button>
              </div>
            </div>

          </div>
        </>
      )}

    </main>
  )
}