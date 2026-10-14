'use client';

import { usePathname } from "next/navigation";
import React, { useState } from "react";
import styles from "app/styles/components/Navbar.module.scss";
import Image from "next/image";
import Link from "next/link";
import { FaChevronDown, FaRocket } from "react-icons/fa";

export default function Navbar() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  
  const closeMenu = () => setIsOpen(false);

  if (pathname && pathname.startsWith('/plataformas')) {
    return null;
  }

  if (pathname.includes('/impresion')) {
    return null
  }

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.container}>
          <Link href="/" onClick={closeMenu}>
            <Image
              className={styles.imageContainer}
              src="/logo.jpeg"
              width={170}
              height={50}
              alt="logo aluna"
            />
          </Link>
          
          <button className={styles.toggle} onClick={toggleMenu}>
            ☰
          </button>
          
          <ul className={`${styles.menu} ${isOpen ? styles.active : styles.closed}`}>
            
            <li>
              <Link href="/quiero-ser-parte" onClick={closeMenu}>
                Quiero ser parte de Aluna
              </Link>
            </li>
            
            <li className={styles.dropdownParent}>
              <Link href="/asi-lo-vivimos" className={styles.dropdownTrigger} onClick={closeMenu}>
                Así lo vivimos <FaChevronDown className={styles.chevron} />
              </Link>
              
              <ul className={styles.submenu}>
                <li className={styles.highlightItem}>
                  <Link href="/asi-lo-vivimos/programa-emprendimiento" onClick={closeMenu}>
                    <FaRocket className={styles.itemIcon} /> Programa de Emprendimiento
                  </Link>
                </li>

                <li><Link href="/asi-lo-vivimos/nuestra-historia" onClick={closeMenu}>Nuestra Historia</Link></li>
                <li><Link href="/asi-lo-vivimos/nuestra-filosofia" onClick={closeMenu}>Nuestra Filosofía</Link></li>
                <li><Link href="/asi-lo-vivimos/nuestro-modelo" onClick={closeMenu}>Nuestro Modelo</Link></li>
                <li><Link href="/asi-lo-vivimos/extra-curriculares" onClick={closeMenu}>Lineas de profundización</Link></li>
                <li><Link href="/asi-lo-vivimos/preguntas-frecuentes" onClick={closeMenu}>Preguntas Frecuentes</Link></li>
              </ul>
            </li>

            <li>
              <Link href="/ponte-en-contacto" onClick={closeMenu}>
                Ponte en contacto
              </Link>
            </li>
            <li>
              <Link href="/login" onClick={closeMenu}>
                Plataforma
              </Link>
            </li>
            <li>
              <a 
                href="https://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=8608" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={closeMenu} // También cerramos aquí aunque abra otra pestaña, por estética
              >
                Pagos
              </a>
            </li>
            <li>
              <Link href="/certificados" onClick={closeMenu}>
                Certificados
              </Link>
            </li>

          </ul>
        </div>
      </nav>
      <div style={{ height: '80px', width: '100%' }} aria-hidden="true"></div>
    </>
  );
};