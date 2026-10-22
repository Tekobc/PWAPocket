import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pocket Manager',
  description: 'Asistente personal de publicaciones para KTsoftware y Etiquétame.',
  applicationName: 'Pocket Manager',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
