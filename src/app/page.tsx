import React from "react";
import Link from "next/link";
import Carousel from "app/components/Carousel";
import InstagramPost from "app/components/InstagramPost";
import SplashScreen from "app/components/SplashScreen";
import styles from "app/styles/components/Page.module.scss";
import {
  FaRocket,
  FaPuzzlePiece,
  FaGuitar,
  FaLightbulb,
  FaArrowRight,
} from "react-icons/fa";

export default function Home() {
  const highlights = [
    {
      title: "Modelo Pedagógico",
      text: "Aprendizaje activo, constructivista y centrado en el ser.",
      icon: <FaPuzzlePiece />,
      color: "#43A047",
      link: "/asi-lo-vivimos/nuestro-modelo",
    },
    {
      title: "Semillas 360",
      text: "Emprendimiento e innovación desde el aula.",
      icon: <FaRocket />,
      color: "#E65100",
      link: "/asi-lo-vivimos/programa-emprendimiento",
    },
    {
      title: "Más allá del aula",
      text: "Arte, cultura y deporte para descubrir talentos.",
      icon: <FaGuitar />,
      color: "#D81B60",
      link: "/asi-lo-vivimos/extra-curriculares",
    },
    {
      title: "Nuestra Esencia",
      text: "Valores y filosofía que guían nuestro camino.",
      icon: <FaLightbulb />,
      color: "#3CA0E8",
      link: "/asi-lo-vivimos/nuestra-filosofia",
    },
  ];

  return (
    <div>
      <SplashScreen />
      <Carousel />

      <div className={styles.layoutGrid}>
        {/*<MainCards /> */}

        <section className={styles.highlightsSection}>
          <div className={styles.highlightsHeader}>
            <h2>La Experiencia Aluna</h2>
            <p>
              Descubre los pilares que hacen de nuestra educación una aventura
              única.
            </p>
          </div>

          <div className={styles.highlightsGrid}>
            {highlights.map((item, index) => (
              <Link key={index} href={item.link} className={styles.cardLink}>
                <div
                  className={styles.highlightCard}
                  style={{ "--card-color": item.color } as React.CSSProperties}
                >
                  <div className={styles.iconCircle}>{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className={styles.cardArrow}>
                    <FaArrowRight />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.feed}>
          <p className={styles.title}>Testimonios</p>

          <p className={styles.description}>
            En el Gimnasio Aluna, son las familias y los propios estudiantes
            quienes mejor cuentan nuestra historia. A través de sus experiencias
            y testimonios, nos invitan a creer en un modelo pedagógico que pone
            a la persona en el centro, que acompaña con sentido y que transforma
            la manera de aprender y vivir la educación. Sus voces reflejan por
            qué Aluna es una elección consciente y una experiencia educativa que
            deja huella.
          </p>

          <div className={styles.videoGrid}>
            <InstagramPost url="https://www.instagram.com/reel/DCksaTEM6ck/" />
            <InstagramPost url="https://www.instagram.com/reel/DCpq1_tMu6Q/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==" />
            <InstagramPost url="https://www.instagram.com/reel/DCvCdZWh2S9/" />
          </div>
        </section>
      </div>
    </div>
  );
}
