import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal Médico Familiar",
  description: "Portal médico accesible e inteligente para la gestión de citas, medicamentos y avisos de tus padres.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portal Médico",
  },
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
