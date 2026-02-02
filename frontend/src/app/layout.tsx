import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Nav } from '@/components/Nav';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#D40511',
};

export const metadata: Metadata = {
  title: 'Product Roadmap',
  description: 'Enterprise Product Roadmap Management',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="%23D40511"/><path fill="%23FFCC00" d="M8 10h4v4H8zm6 0h4v4h-4zm6 0h4v4h-4zM8 16h4v4H8zm6 0h4v4h-4zm6 0h4v4h-4z"/></svg>',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Nav />
            <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 max-w-full sm:max-w-screen-xl pb-[env(safe-area-inset-bottom)]">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
