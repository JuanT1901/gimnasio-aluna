'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

function extraerDatosFicha(est: any) {
  const ficha: any = {}
  
  // Datos principales
  if (est['Nombre Completo']) ficha.full_name = String(est['Nombre Completo']).trim()
  if (est['Curso']) ficha.course_name = String(est['Curso']).trim()
  if (est['Tipo Documento']) ficha.doc_type = String(est['Tipo Documento']).trim()
  
  // Datos Personales
  if (est['Fecha Nacimiento'] !== undefined) ficha.birth_date = String(est['Fecha Nacimiento'])
  if (est['Ciudad'] !== undefined) ficha.city = String(est['Ciudad'])
  if (est['Barrio'] !== undefined) ficha.neighborhood = String(est['Barrio'])
  if (est['Direccion'] !== undefined) ficha.address = String(est['Direccion'])
  if (est['Expedicion Documento'] !== undefined) ficha.doc_expedition_city = String(est['Expedicion Documento'])
  if (est['EPS'] !== undefined) ficha.eps = String(est['EPS'])
  if (est['RH'] !== undefined) ficha.blood_type = String(est['RH'])
  if (est['Numero Hermanos'] !== undefined) ficha.siblings_count = String(est['Numero Hermanos'])

  // Datos Madre
  if (est['Nombre Madre'] !== undefined) ficha.mother_name = String(est['Nombre Madre'])
  if (est['Documento Madre'] !== undefined) ficha.mother_doc = String(est['Documento Madre'])
  if (est['Profesion Madre'] !== undefined) ficha.mother_profession = String(est['Profesion Madre'])
  if (est['Celular Madre'] !== undefined) ficha.mother_cellphone = String(est['Celular Madre'])
  if (est['Telefono Madre'] !== undefined) ficha.mother_phone = String(est['Telefono Madre'])
  if (est['Correo Madre'] !== undefined) ficha.mother_email = String(est['Correo Madre'])
  if (est['Vive con Madre'] !== undefined) ficha.mother_lives_with_student = String(est['Vive con Madre'])

  // Datos Padre
  if (est['Nombre Padre'] !== undefined) ficha.father_name = String(est['Nombre Padre'])
  if (est['Documento Padre'] !== undefined) ficha.father_doc = String(est['Documento Padre'])
  if (est['Profesion Padre'] !== undefined) ficha.father_profession = String(est['Profesion Padre'])
  if (est['Celular Padre'] !== undefined) ficha.father_cellphone = String(est['Celular Padre'])
  if (est['Telefono Padre'] !== undefined) ficha.father_phone = String(est['Telefono Padre'])
  if (est['Correo Padre'] !== undefined) ficha.father_email = String(est['Correo Padre'])
  if (est['Vive con Padre'] !== undefined) ficha.father_lives_with_student = String(est['Vive con Padre'])

  // Acudiente y Referencia
  if (est['Nombre Acudiente'] !== undefined) ficha.guardian_name = String(est['Nombre Acudiente'])
  if (est['Celular Acudiente'] !== undefined) ficha.guardian_cellphone = String(est['Celular Acudiente'])
  if (est['Nombre Referencia'] !== undefined) ficha.reference_name = String(est['Nombre Referencia'])
  if (est['Celular Referencia'] !== undefined) ficha.reference_cellphone = String(est['Celular Referencia'])

  // Información Adicional
  if (est['Jornada Adicional'] !== undefined) ficha.extra_shift = String(est['Jornada Adicional'])
  if (est['Ruta Escolar'] !== undefined) ficha.school_bus = String(est['Ruta Escolar'])
  if (est['Direccion Ruta'] !== undefined) ficha.bus_address = String(est['Direccion Ruta'])
  if (est['Requiere Buzo'] !== undefined) ficha.needs_sweatshirt = String(est['Requiere Buzo'])
  if (est['Talla Buzo'] !== undefined) ficha.sweatshirt_size = String(est['Talla Buzo'])
  if (est['Requiere Camiseta'] !== undefined) ficha.needs_tshirt = String(est['Requiere Camiseta'])
  if (est['Talla Camiseta'] !== undefined) ficha.tshirt_size = String(est['Talla Camiseta'])

  return ficha
}

export async function importarEstudiantesMasivo(estudiantes: any[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, creados: 0, actualizados: 0, errores: [authError || 'No autorizado'] }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let creados = 0;
  let actualizados = 0;
  let errores = [];

  for (const est of estudiantes) {
    try {
      const docString = String(est['Documento']).trim();
      let userId = null;

      let gradeIdOficial = null;
      const nombreCursoExcel = est['Curso'];

      if (nombreCursoExcel) {
        const textoBusqueda = String(nombreCursoExcel).trim();
        
        const { data: cursoEncontrado } = await supabaseAdmin
          .from('grades') 
          .select('id')
          .ilike('name', textoBusqueda)
          .single();

        if (cursoEncontrado) {
          gradeIdOficial = cursoEncontrado.id;
        }
      }

      const { data: perfilExistente } = await supabaseAdmin
        .from('profiles')
        .select('id, grade_id, role')
        .eq('doc_number', docString)
        .single();

      if (perfilExistente) {
        if (perfilExistente.role === 'admin') {
          throw new Error('No se puede modificar un perfil de administrador mediante importación.');
        }
        userId = perfilExistente.id;
        const datosActualizar = extraerDatosFicha(est);
        
        if (gradeIdOficial && perfilExistente.grade_id !== gradeIdOficial) {
          datosActualizar.grade_id = gradeIdOficial;
        }

        if (Object.keys(datosActualizar).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(datosActualizar)
            .eq('id', userId);

          if (updateError) throw new Error(`Error BD al actualizar: ${updateError.message}`);
        }
        actualizados++;

      } else {
        if (!est['Nombre Completo']) throw new Error('Para crear un estudiante nuevo es obligatorio el "Nombre Completo".');

        const columnaUsuario = Object.keys(est).find(key => key.trim().toLowerCase() === 'usuario');
        const usuarioExcel = columnaUsuario ? est[columnaUsuario] : null;

        let email = usuarioExcel ? String(usuarioExcel).toLowerCase().trim() : `e${docString}`;
        if (!email.includes('@')) email = `${email}@aluna.edu.co`;
        const password = docString;

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true 
        });

        if (authError) throw new Error(`Error Auth: ${authError.message}`);
        userId = authData.user.id;

        const datosCompletos = extraerDatosFicha(est);
        
        if (gradeIdOficial) {
          datosCompletos.grade_id = gradeIdOficial;
        }

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            role: 'student',
            doc_number: docString,
            doc_type: est['Tipo Documento'] || 'TI', 
            ...datosCompletos 
          });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw new Error(`Error BD al crear: ${profileError.message}`);
        }
        creados++;
      }
    } catch (error: any) {
      errores.push(`Error con Documento ${est['Documento']}: ${error.message}`);
    }
  }

  return { exito: true, creados, actualizados, errores };
}