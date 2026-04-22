import { redirect } from 'next/navigation';

/**
 * Root index component that automatically redirects users to the login page.
 */
export default function Home() {
  redirect('/login');
}
