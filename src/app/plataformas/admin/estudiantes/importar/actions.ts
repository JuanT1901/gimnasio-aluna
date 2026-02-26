'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function procesarImportacionMasiva(estudiantes: any[]) {
  let creados = 0;
  let errores = 0;
  let detallesErrores: string[] = [];

  for (const [index, est] of estudiantes.entries()) {
    const fila = index + 2; // +2 para compensar que el índice inicia en 0 y la fila 1 son los títulos

    // 1. Limpieza extrema: Quitar espacios invisibles en los nombres de las columnas
    const estLimpio: any = {};
    for (const key in est) {
      if (key) {
        estLimpio[key.trim()] = est[key];
      }
    }

    // 2. Verificar que existan las columnas obligatorias
    if (!estLimpio.email || !estLimpio.password) {
      errores++;
      detallesErrores.push(`Fila ${fila}: Falta la columna 'email' o 'password', o están vacías.`);
      continue;
    }

    try {
      // 3. Crear el usuario en el sistema de seguridad (Convirtiendo usuario a correo)
      let correoFinal = estLimpio.email.trim().toLowerCase();
      
      // Función rápida para quitar tildes y cambiar la ñ por n
      correoFinal = correoFinal
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quita tildes
        .replace(/ñ/g, "n");             // Cambia ñ por n
      
      // Si no tiene '@', le agregamos el dominio del colegio y quitamos espacios por si acaso
      if (!correoFinal.includes('@')) {
        correoFinal = `${correoFinal.replace(/\s+/g, '')}@aluna.edu.co`;
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: correoFinal,
        password: estLimpio.password,
        email_confirm: true 
      })

      if (authError) {
        errores++;
        detallesErrores.push(`Fila ${fila} (${estLimpio.email}): Error de seguridad -> ${authError.message}`);
        continue;
      }

      // 4. Separar credenciales de los datos de la ficha
      const { email, password, ...datosPerfil } = estLimpio;

      // 5. Guardar la ficha en public.profiles
      const { error: dbError } = await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        role: 'student',
        ...datosPerfil
      })

      if (dbError) {
        errores++;
        detallesErrores.push(`Fila ${fila} (${estLimpio.email}): Error en la base de datos -> ${dbError.message}`);
        continue;
      }

      creados++;
    } catch (err: any) {
      errores++;
      detallesErrores.push(`Fila ${fila}: Error inesperado -> ${err.message}`);
    }
  }

  return { creados, errores, detallesErrores }
}