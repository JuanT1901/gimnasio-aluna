// app/components/SplashScreen.tsx
"use client";
import { useEffect, useState } from "react";
import { getImageProps } from "next/image";
import styles from "app/styles/components/SplashScreen.module.scss";

const alt = "Bienvenidos a Gimnasio Aluna, su colegio Ludo Club";

// Pantallas verticales (celulares) usan la imagen vertical; el resto, la horizontal.
const {
  props: { srcSet: srcSetMovil },
} = getImageProps({
  alt,
  src: "/Inicio-movil.png",
  width: 780,
  height: 1688,
  sizes: "100vw",
});
const { props: propsEscritorio } = getImageProps({
  alt,
  src: "/Inicio.png",
  width: 3200,
  height: 1800,
  sizes: "100vw",
  priority: true,
});

const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={styles.splash}>
      <picture>
        <source media="(orientation: portrait)" srcSet={srcSetMovil} />
        <img {...propsEscritorio} alt={alt} className={styles.imagen} />
      </picture>
    </div>
  );
};

export default SplashScreen;
