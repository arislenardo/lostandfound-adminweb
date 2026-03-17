'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) {
    return <div className={styles.loading}>Loading Admin Portal...</div>;
  }

  if (!user || !isAdmin) {
    return null; // Will redirect via AuthProvider
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/dashboard' },
    { name: 'Found Items', path: '/dashboard/found-items' },
    { name: 'Lost Items', path: '/dashboard/lost-items' },
    { name: 'Claims', path: '/dashboard/claims' },
    { name: 'Users', path: '/dashboard/users' },
    { name: 'Audit Log', path: '/dashboard/audit' },
  ];

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoBadge}>PCR</div>
          <h2>Balik-Calasiao Admin Center</h2>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`${styles.navItem} ${pathname === item.path ? styles.active : ''}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userEmail}>{user.email}</span>
            <span className={styles.roleBadge}>Administrator</span>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <h1>
            {navItems.find(item => item.path === pathname)?.name || 'Dashboard'}
          </h1>
        </header>
        
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
}
