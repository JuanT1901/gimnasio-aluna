import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Navbar from "app/components/Navbar";
import WhatsappButton from "app/components/WhatsappButton";
import Footer from "app/components/Footer";
import AutoLogout from 'app/components/AutoLogout'
import "../styles/global.scss";

const poppins = Poppins({
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ludo Club",
  description: "Página escolar de colegio Ludo Club",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className={`${poppins.variable}`}>
        <AutoLogout />
        <Navbar />
        {children}
        <WhatsappButton />
        <Footer />
      </body>
    </html>
  );
}
