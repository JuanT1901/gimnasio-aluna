'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from 'app/utils/supabase/client'
import Image from 'next/image'
import styles from 'app/styles/pages/Login.module.scss'
import { FaUser, FaLock, FaSpinner } from 'react-icons/fa'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Formatear el texto de entrada: Si no tiene @, asumir que es usuario y agregar el dominio
    let finalLoginEmail = email.trim();
    if (!finalLoginEmail.includes('@')) {
      finalLoginEmail = `${finalLoginEmail.replace(/\s+/g, '')}@aluna.edu.co`;
    }

    // 1. Intentar iniciar sesión
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: finalLoginEmail,
      password,
    })

    if (signInError || !authData.user) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      setLoading(false)
      return
    }

    // 2. Si el login es exitoso, buscar el rol del usuario en la base de datos
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    const role = profile?.role || 'student' // Por defecto lo tratamos como estudiante

    // 3. Redirigir según el rol
    if (role === 'admin') {
      router.push('/plataformas/admin/dashboard')
    } else if (role === 'teacher') {
      router.push('/plataformas/profesores/dashboard')
    } else {
      router.push('/plataformas/estudiantes/dashboard')
    }
    
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoHeader}>
          <div className={styles.logoWrapper}>
            <Image 
              src="/logo.jpeg"
              alt="Gimnasio Aluna" 
              width={150} 
              height={100} 
              className={styles.logo}
            />
          </div>
          <h1>Bienvenido a Aluna</h1>
          <p>Plataforma Estudiantil</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          
          <div className={styles.inputGroup}>
            <FaUser className={styles.icon} />
            <input 
              type="text" 
              placeholder="Nombre de usuario" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <FaLock className={styles.icon} />
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <button type="submit" className={styles.loginBtn} disabled={loading}>
            {loading ? (
              <><FaSpinner className={styles.spinner} /> Entrando...</>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <p>¿Olvidaste tu contraseña? <a href="#">Contacta a Secretaría</a></p>
        </div>
      </div>
    </div>
  )
}