import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal Médico Familiar",
  description: "Portal médico accesible e inteligente para la gestión de citas, medicamentos y avisos de tus padres.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
