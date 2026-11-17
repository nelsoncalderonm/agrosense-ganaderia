import type { Metadata, Viewport } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import RegistrarSW from "@/components/RegistrarSW";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AgroSense Ganadería",
  description: "Sistema de gestión ganadera",
  appleWebApp: { capable: true, title: "AgroSense", statusBarStyle: "default" },
  icons: { apple: "/icono-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#15A34A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${montserrat.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full antialiased">{children}<RegistrarSW /></body>
    </html>
  );
}
