'use client'

import { usePathname } from 'next/navigation'
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from 'app/styles/components/Footer.module.scss';
import { 
  FaMapMarkerAlt, 
  FaPhoneAlt, 
  FaEnvelope, 
  FaInstagram, 
  FaFacebookF, 
  FaWhatsapp,
  FaChevronRight,
  FaCode
} from 'react-icons/fa';

export default function Footer() {
  const pathname = usePathname()

  if (pathname.startsWith('/plataformas') || pathname === '/login') {
    return null
  }

  return (
    <footer className={styles.footer}>
      
      <div className={styles.waveContainer}>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className={styles.shapeFill}></path>
        </svg>
      </div>

      <div className={styles.container}>
        <div className={styles.grid}>
          
          <div className={styles.col}>
            <div className={styles.logoWrapper}>
              <Image 
                src="/logo.jpeg" 
                alt="Logo Gimnasio Aluna" 
                width={170} 
                height={70} 
                className={styles.logo}
              />
            </div>
            <p className={styles.slogan}>
              De la idea nace la acción, y de la acción florece el camino.
            </p>
            
            <div className={styles.socials}>
              <a href="https://www.instagram.com/colegio_ludoclubzipaquira/" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <FaInstagram />
              </a>
              <a href="https://www.facebook.com/ludoclubaventurascreativas" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <FaFacebookF />
              </a>
              <a href="https://wa.me/573144698955" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <FaWhatsapp />
              </a>
            </div>
          </div>

          <div className={styles.col}>
            <h3>Explora Aluna</h3>
            <ul className={styles.linksList}>
              <li><Link href="/quiero-ser-parte"><FaChevronRight className={styles.arrow}/> Admisiones</Link></li>
              <li><Link href="/asi-lo-vivimos/programa-emprendimiento"><FaChevronRight className={styles.arrow}/> Semillas 360</Link></li>
              <li><Link href="/asi-lo-vivimos/nuestro-modelo"><FaChevronRight className={styles.arrow}/> Modelo Pedagógico</Link></li>
              <li><Link href="/asi-lo-vivimos/preguntas-frecuentes"><FaChevronRight className={styles.arrow}/> Preguntas Frecuentes</Link></li>
            </ul>
          </div>

          <div className={styles.col}>
            <h3>Ubícanos</h3>
            <div className={styles.contactItem}>
              <FaMapMarkerAlt className={styles.icon} />
              <div>
                <strong>Sede Principal:</strong>
                <p>Cr 14 # 5 - 77</p>
              </div>
            </div>
            
            <div className={styles.contactItem}>
              <FaMapMarkerAlt className={styles.icon} />
              <div>
                <strong>Sede Preescolar:</strong>
                <p>Carrera 11 # 6 - 63</p>
              </div>
            </div>

            <div className={styles.contactItem}>
              <FaPhoneAlt className={styles.icon} />
              <div>
                <strong>Llámanos:</strong>
                <p>+57 314 469 8955</p>
              </div>
            </div>
            
            <div className={styles.contactItem}>
              <FaEnvelope className={styles.icon} />
              <div>
                <strong>Escríbenos:</strong>
                <p>clubaventurascreativas@gmail.com</p>
              </div>
            </div>
          </div>

          <div className={styles.col}>
            <h3>Horarios</h3>
            <p className={styles.infoText}>
              <strong>Lunes a Viernes:</strong><br/>
              7:00 AM - 3:30 PM
            </p>
            <p className={styles.infoText}>
              <strong>Sábados:</strong><br/>
              8:00 AM - 12:00 PM (Atención Padres)
            </p>
            {/*}
            <Link href="/plataformas" className={styles.platformButton}>
              Ir a Plataformas
            </Link>*/}
          </div>

        </div>

        <div className={styles.bottomBar}>
          <p>© {new Date().getFullYear()} Gimnasio Aluna. Todos los derechos reservados.</p>
          <div className={styles.developerCredit}>
            <span>Desarrollado por </span>
            <a 
              href="https://portfolio-juan-dev.netlify.app/"
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.devLink}
            >
              Juan Torres <FaCode className={styles.codeIcon} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
