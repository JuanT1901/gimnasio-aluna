'use client';

import { useKeenSlider } from "keen-slider/react"
import "keen-slider/keen-slider.min.css"
import styles from 'app/styles/components/Carousel.module.scss'
import Image from "next/image"
import { useEffect, useState, useRef } from "react"

const images = [
  "/images/Carrusel_01.jpg",
  "/images/Carrusel_02.png",
  "/images/Carrusel_03.png",
  "/images/Carrusel_04.png",
  "/images/Carrusel_05.png",
]

const Carousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const timeout = useRef<NodeJS.Timeout | null>(null)

  const [sliderRef, instanceRef] = useKeenSlider({
    loop: true,
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel)
    },
    created() {
      autoplay()
    },
  })

  const autoplay = () => {
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => {
      instanceRef.current?.next()
    }, 4000) // Aumenté a 4s para dar más tiempo de ver la foto
  }

  useEffect(() => {
    const slider = instanceRef.current
    if (!slider) return

    slider.on("slideChanged", autoplay)
    slider.on("dragStarted", () => clearTimeout(timeout.current!))
    return () => {
      slider.destroy()
    }
  }, [autoplay, instanceRef])

  return (
    <div className={styles.carouselWrapper}>
      <div ref={sliderRef} className={`keen-slider ${styles.carousel}`}>
        {images.map((src, index) => (
          <div key={index} className={`keen-slider__slide ${styles.slide}`}>
            <Image
              src={src}
              alt={`Slide ${index + 1}`}
              fill // CAMBIO CLAVE: Llena el contenedor padre
              priority={index === 0} // Carga la primera imagen rápido
              sizes="100vw" // Optimización para Next.js
              className={styles.image}
            />
          </div>
        ))}
      </div>

      <button onClick={(e) => { e.stopPropagation(); instanceRef.current?.prev() }} className={styles.arrowLeft}>&lt;</button>
      <button onClick={(e) => { e.stopPropagation(); instanceRef.current?.next() }} className={styles.arrowRight}>&gt;</button>

      <div className={styles.dots}>
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => instanceRef.current?.moveToIdx(idx)}
            className={`${styles.dot} ${currentSlide === idx ? styles.active : ""}`}
          />
        ))}
      </div>
    </div>
  )
}

export default Carousel