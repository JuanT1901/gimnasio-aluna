'use client'

import { useEffect, useState } from 'react'
import { createClient } from 'app/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function AutoLogout() {
  const router = useRouter()
  const supabase = createClient()
  const [lastActivity, setLastActivity] = useState(Date.now())

  useEffect(() => {
    const INACTIVITY_LIMIT = 5 * 60 * 1000; 

    const updateActivity = () => {
      setLastActivity(Date.now())
    }

    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keypress', updateActivity)
    window.addEventListener('click', updateActivity)
    window.addEventListener('scroll', updateActivity)

    const interval = setInterval(async () => {
      if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
        console.log("Cerrando sesión por inactividad...")
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
      }
    }, 10000)

    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keypress', updateActivity)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('scroll', updateActivity)
      clearInterval(interval)
    }
  }, [lastActivity, router, supabase])

  return null
}