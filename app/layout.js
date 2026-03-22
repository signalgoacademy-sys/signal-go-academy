import './globals.css'

export const metadata = {
  metadataBase: new URL('https://signal-go-academy.vercel.app'),
  title: 'Signal GO Academy',
  description: 'Centro de registro de trading y gestión del riesgo',
  applicationName: 'Signal GO Academy',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Signal GO Academy',
  },
  openGraph: {
    title: 'Signal GO Academy',
    description: 'Centro de registro de trading y gestión del riesgo',
    url: 'https://signal-go-academy.vercel.app',
    siteName: 'Signal GO Academy',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Signal GO Academy',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Signal GO Academy',
    description: 'Centro de registro de trading y gestión del riesgo',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}