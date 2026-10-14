/** @type {import('next').NextConfig} */
const nextConfig = {
  // El generador de PDF de los certificados se ejecuta tal cual en el servidor, sin empaquetarlo
  serverExternalPackages: ['@react-pdf/renderer'],
  // Los logos de los boletines se usan también en el PDF de los certificados
  outputFileTracingIncludes: {
    '/plataformas/admin/certificados': ['./public/logo.jpeg', './public/logo-ludo.png'],
    '/plataformas/admin/certificados/**/*': ['./public/logo.jpeg', './public/logo-ludo.png'],
  },
};

export default nextConfig;
