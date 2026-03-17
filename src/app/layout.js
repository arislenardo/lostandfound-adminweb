import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

export const metadata = {
  title: 'Balik-Calasiao Admin',
  description: 'Consolidated Lost and Found command center for Balik-Calasiao',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
