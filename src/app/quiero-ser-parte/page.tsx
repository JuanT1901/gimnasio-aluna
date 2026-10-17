import React from 'react';
import Link from 'next/link';
import styles from 'app/styles/quiero-ser-parte/QuieroSerParte.module.scss';
import { FaFileSignature, FaChalkboardTeacher, FaHandshake } from 'react-icons/fa';

const steps = [
  {
    id: 1,
    title: "1. Inscripción y documentación",
    colorClass: styles.stepBlue,
    icon: <FaFileSignature />,
    content: [
      { 
        subtitle: "Formulario de inscripción:", 
        text: "Diligenciamiento en línea a través del portal del colegio o de manera presencial.",
        actionLink: {
          text: "Llenar el formulario de inscripción",
          url: "/quiero-ser-parte/inscripcion"
        }
      },
      { 
        subtitle: "Pago de inscripción:", 
        text: "Cancelación del valor correspondiente y entrega del comprobante de pago." 
      }
    ]
  },
  {
    id: 2,
    title: "2. Evaluación y valoración",
    colorClass: styles.stepOrange,
    icon: <FaChalkboardTeacher />,
    content: [
      { subtitle: "Pruebas académicas:", text: "Evaluaciones diagnósticas en matemáticas, lengua castellana e inglés (según grado). No aplica para preescolar." },
      { subtitle: "Entrevistas:", text: "Espacios de diálogo con padres y aspirante para conocer su perfil y expectativas." },
      { subtitle: "Proceso de adaptación:", text: "3 días de media jornada para crear vínculos y evaluar el momento adecuado de ingreso." }
    ]
  },
  {
    id: 3,
    title: "3. Formalización del proceso",
    colorClass: styles.stepGreen,
    icon: <FaHandshake />,
    content: [
      { subtitle: "Resultados:", text: "Comunicación oficial sobre la asignación de cupo." },
      { subtitle: "Matrícula:", text: "Entrega final de documentos y formalización del cupo de manera presencial." },
      { subtitle: "Documentos:", text: "Listado informado oportunamente por la institución." }
    ]
  }
];

export default function QuieroSerParte() {
  return (
    <div className={styles.container}>
      
      <section className={styles.header}>
        <h1 className={styles.mainTitle}>Proceso de Admisiones</h1>
        <p className={styles.introText}>
          Nuestro proceso de admisión está diseñado para acompañar a las familias en cada etapa, 
          brindando información clara y orientación oportuna. A continuación, presentamos los pasos 
          que permiten iniciar este camino de manera organizada, transparente y acorde a nuestra propuesta educativa.
        </p>
      </section>

      <div className={styles.stepsGrid}>
        {steps.map((step) => (
          <div key={step.id} className={`${styles.card} ${step.colorClass}`}>
            
            <div className={styles.pawPrint}>
              <svg viewBox="0 0 512 512" fill="currentColor">
                <path d="M176 96c0-26.5-21.5-48-48-48S80 69.5 80 96s21.5 48 48 48 48-21.5 48-48zM336 96c0-26.5-21.5-48-48-48s-48 21.5-48 48 21.5 48 48 48 48-21.5 48-48zM432 176c0-26.5-21.5-48-48-48s-48 21.5-48 48 21.5 48 48 48 48-21.5 48-48zM96 200c0-26.5-21.5-48-48-48S0 173.5 0 200s21.5 48 48 48 48-21.5 48-48zM256 224c-70.7 0-128 57.3-128 128 0 49 26.6 92.4 66.2 114.8 17.5 9.9 38.8 1.9 44.9-17.2L256 392l16.9 57.6c6.1 19.1 27.4 27.1 44.9 17.2C357.4 444.4 384 401 384 352c0-70.7-57.3-128-128-128z"/>
              </svg>
            </div>

            <div className={styles.cardHeader}>
              <span className={styles.icon}>{step.icon}</span>
              <h2>{step.title}</h2>
            </div>

            <div className={styles.cardBody}>
              {step.content.map((item, idx) => (
                <div key={idx} className={styles.item}>
                  <strong>{item.subtitle}</strong>
                  <p>{item.text}</p>
                  
                  {item.actionLink && (
                    <Link href={item.actionLink.url} className={styles.ctaLink}>
                      <FaFileSignature /> {item.actionLink.text} →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}