'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

function formatearFecha(valor: any) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return null;
  }
  
  // Si Excel envía la fecha como número de serie
  if (typeof valor === 'number') {
    const fechaExcel = new Date(Math.round((valor - 25569) * 86400 * 1000));
    return fechaExcel.toISOString().split('T')[0];
  }
  
  // Si viene como texto o fecha normal
  try {
    const d = new Date(valor);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch(e) {}
  
  return String(valor).trim();
}

export async function importarProfesoresMasivo(profesores: any[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, procesados: 0, creados: 0, actualizados: 0, asignaciones: 0, errores: [authError || 'No autorizado'] }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let creados = 0; 
  let actualizados = 0; 
  let asignaciones = 0; 
  let errores = [];

  // 🛡️ FUNCIÓN SANITIZADORA BÁSICA (Para textos)
  const limpiarDato = (valor: any) => {
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      return null;
    }
    return String(valor).trim();
  };

  for (const filaOriginal of profesores) {
    try {
      // 🌟 NORMALIZADOR DE ENCABEZADOS
      const fila: any = {};
      for (const key in filaOriginal) {
        const llaveLimpia = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        fila[llaveLimpia] = filaOriginal[key];
      }

      let userId = null;
      
      const docString = limpiarDato(fila['documento']);
      const nombre = limpiarDato(fila['nombre completo']) || limpiarDato(fila['nombre']);
      
      if (!docString || !nombre) {
        throw new Error("El documento y el nombre son absolutamente obligatorios.");
      }

      const usuarioAuth = limpiarDato(fila['usuario'])?.toLowerCase() || '';
      
      // 🌟 CONSTRUCCIÓN DINÁMICA DEL OBJETO DE DATOS (Evita sobrescribir con null)
      const datosRRHH: any = {};
      
      const agregarSiExiste = (llaveBD: string, valorExcel: any) => {
        if (valorExcel !== null) {
          datosRRHH[llaveBD] = valorExcel;
        }
      };

      agregarSiExiste('email', limpiarDato(fila['correo electronico']) || limpiarDato(fila['correo']));
      
      // 🌟 APLICAMOS EL TRADUCTOR DE FECHAS AQUÍ
      const fechaNacimientoRaw = fila['fecha de nacimiento'] || fila['fecha nacimiento'];
      agregarSiExiste('birth_date', formatearFecha(fechaNacimientoRaw));
      
      agregarSiExiste('address', limpiarDato(fila['direccion']));
      agregarSiExiste('phone_number', limpiarDato(fila['numero de celular']) || limpiarDato(fila['celular']));
      agregarSiExiste('compensation_fund', limpiarDato(fila['caja de compensacion']) || limpiarDato(fila['caja compensacion']));
      agregarSiExiste('eps', limpiarDato(fila['eps']));
      agregarSiExiste('arl', limpiarDato(fila['arl']));
      agregarSiExiste('pension_fund', limpiarDato(fila['fondo de pensiones']) || limpiarDato(fila['fondo pensiones']));
      
      datosRRHH.full_name = nombre;
      datosRRHH.doc_number = docString;
      datosRRHH.doc_type = 'CC';
      datosRRHH.role = 'teacher';

      // 2. Buscamos si el profesor YA existe
      const { data: perfilExistente } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('doc_number', docString)
        .maybeSingle();

      if (perfilExistente) {
        userId = perfilExistente.id;
        
        if (Object.keys(datosRRHH).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(datosRRHH)
            .eq('id', userId);

          if (updateError) throw new Error(`Error actualizando perfil: ${updateError.message}`);
          actualizados++;
        }
      } else {
        // 3. Si no existe, creamos su cuenta
        let emailAuth = usuarioAuth;
        if (!emailAuth.includes('@')) emailAuth = `${emailAuth}@aluna.edu.co`;
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: emailAuth,
          password: docString,
          email_confirm: true 
        });

        if (authError) throw new Error(`Credenciales: ${authError.message}`);
        userId = authData.user.id;

        // 4. Actualizamos el Perfil
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
          id: userId,
          ...datosRRHH
        });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw new Error(`Perfil BD: ${profileError.message}`);
        }
        creados++; 
      }

      // 5. Conectando Curso y Materia Oficial
      const curso = limpiarDato(fila['curso']);
      const materia = limpiarDato(fila['materia']);

      if (curso && materia) {
        const { data: cursoEncontrado } = await supabaseAdmin
          .from('grades') 
          .select('id')
          .ilike('name', curso)
          .maybeSingle();

        if (!cursoEncontrado) throw new Error(`El curso "${curso}" no existe.`);
        const gradeIdOficial = cursoEncontrado.id;

        const { data: materiaEncontrada } = await supabaseAdmin
          .from('subjects')
          .select('id')
          .eq('grade_id', gradeIdOficial)
          .ilike('name', materia)
          .maybeSingle();

        if (!materiaEncontrada) throw new Error(`La materia "${materia}" no existe en la malla de "${curso}".`);
        const subjectIdOficial = materiaEncontrada.id;

        const { data: asigExistente } = await supabaseAdmin
          .from('teacher_assignments')
          .select('id')
          .eq('teacher_id', userId)
          .eq('subject_id', subjectIdOficial)
          .maybeSingle();

        if (!asigExistente) {
          const { error: insertError } = await supabaseAdmin.from('teacher_assignments').insert({
            teacher_id: userId,
            grade_id: gradeIdOficial,
            subject_id: subjectIdOficial,
            course_name: curso, 
            subject_name: materia 
          });

          if (insertError) throw new Error(`Fallo en asignación: ${insertError.message}`);
          asignaciones++; 
        }
      }

    } catch (error: any) {
      console.log(`🚨 ERROR CON ${filaOriginal['Nombre Completo'] || 'Desconocido'}: ${error.message}`);
      errores.push(`Error con ${filaOriginal['Nombre Completo'] || 'Desconocido'}: ${error.message}`);
    }
  }

  return { exito: true, procesados: profesores.length, creados, actualizados, asignaciones, errores };
}