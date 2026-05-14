'use server'

import { createClient } from '@supabase/supabase-js'
import { verificarRol } from 'app/utils/supabase/auth-check'

export async function importarMallaCurricular(materias: any[]) {
  const { autorizado, error: authError } = await verificarRol('admin')
  if (!autorizado) return { exito: false, creadas: 0, errores: [authError || 'No autorizado'] }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let creadas = 0;
  let errores = [];

  for (const fila of materias) {
    try {
      const nombreCurso = String(fila['Curso']).trim();
      const nombreMateria = String(fila['Materia']).trim();

      if (!nombreCurso || !nombreMateria) continue;

      const { data: cursoEncontrado } = await supabaseAdmin
        .from('grades')
        .select('id')
        .ilike('name', nombreCurso)
        .single();

      if (!cursoEncontrado) {
        throw new Error(`El curso "${nombreCurso}" no existe en la base de datos.`);
      }

      const { error: insertError } = await supabaseAdmin
        .from('subjects')
        .upsert({
          name: nombreMateria,
          grade_id: cursoEncontrado.id
        }, { onConflict: 'name, grade_id' });

      if (insertError) throw new Error(`Error al insertar "${nombreMateria}": ${insertError.message}`);
      
      creadas++;

    } catch (error: any) {
      errores.push(`Error en fila ${fila['Materia']}: ${error.message}`);
    }
  }

  return { exito: true, creadas, errores };
}