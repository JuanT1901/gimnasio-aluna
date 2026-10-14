/** @type {import('next').NextConfig} */
const nextConfig = {
  // El generador de PDF de los certificados se ejecuta tal cual en el servidor, sin empaquetarlo
  serverExternalPackages: ['@react-pdf/renderer'],
  // Los logos de los boletines y la marca de agua se usan en el PDF de los certificados
  outputFileTracingIncludes: {
    '/plataformas/admin/certificados': ['./public/logo.jpeg', './public/logo-ludo.png', './public/marca-agua-certificados.jpg'],
    '/plataformas/admin/certificados/**/*': ['./public/logo.jpeg', './public/logo-ludo.png', './public/marca-agua-certificados.jpg'],
  },
};

export default nextConfig;
