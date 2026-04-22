import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

export const metadata = {
  title: 'Balik-Calasiao Admin',
  description: 'Consolidated Lost and Found command center for Balik-Calasiao',
  icons: {
    icon: '/app-logo.webp',
  },
};

/**
 * Root layout component for the application, providing the base HTML structure and authentication context.
 * @param {Object} props - The component props.
 * @param {JSX.Element} props.children - The child components to render.
 * @returns {JSX.Element} The rendered root layout.
 */
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
