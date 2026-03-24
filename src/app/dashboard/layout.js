'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PackageCheck, 
  PackageMinus, 
  ClipboardList, 
  Users, 
  History, 
  LogOut,
  Bell,
  CheckCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import styles from './dashboard.module.css';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function DashboardLayout({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Fetch real-time notifications from multiple sources
  useEffect(() => {
    if (!user || !isAdmin) return;

    // 1. Listen for new/pending claims (No orderBy to match phone app)
    const qClaims = query(
      collection(db, 'claims'), 
      where('status', 'in', ['pending', 'disputed']), 
      limit(20)
    );

    // 2. Listen for unread messages sent to admin (No orderBy to avoid index)
    const qMessages = query(
      collection(db, 'messages'),
      where('receiverId', '==', user.uid),
      where('isRead', '==', false),
      limit(20)
    );

    let allNotifs = { claims: [], messages: [] };

    const updateNotifs = () => {
      // Sort in-memory like the phone app's derivedStateOf
      const combined = [...allNotifs.claims, ...allNotifs.messages]
        .sort((a, b) => b.time - a.time)
        .slice(0, 10);
      setNotifications(combined);
    };

    const unsubClaims = onSnapshot(qClaims, (snap) => {
      allNotifs.claims = snap.docs.map(doc => {
        const data = doc.data();
        const type = data.status === 'disputed' ? 'dispute' : 'claim';
        const docTime = data.timestamp?.toDate?.() || 
                        (data.timestamp instanceof Date ? data.timestamp : new Date());
        return {
          id: doc.id,
          type: type,
          message: type === 'dispute' 
            ? `Dispute: Claim #${doc.id.slice(-4)} re-opened`
            : `New claim: ${data.itemName || 'Item #'+doc.id.slice(-4)}`,
          time: docTime,
          unread: true,
          link: '/dashboard/claims'
        };
      });
      updateNotifs();
    }, (err) => console.error("Notif Error (Claims):", err));

    const unsubMessages = onSnapshot(qMessages, (snap) => {
      allNotifs.messages = snap.docs.map(doc => {
        const data = doc.data();
        const docTime = data.timestamp?.toDate?.() || 
                        (data.timestamp instanceof Date ? data.timestamp : new Date());
        return {
          id: doc.id,
          type: 'message',
          message: `Message: "${data.text?.substring(0, 30)}..."`,
          time: docTime,
          unread: true,
          link: '/dashboard/users'
        };
      });
      updateNotifs();
    }, (err) => console.error("Notif Error (Messages):", err));

    return () => {
      unsubClaims();
      unsubMessages();
    };
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <span>Loading Admin Portal...</span>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null; // Will redirect via AuthProvider
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: <LayoutDashboard size={20} strokeWidth={2} /> },
    { name: 'Found Items', path: '/dashboard/found-items', icon: <PackageCheck size={20} strokeWidth={2} /> },
    { name: 'Lost Items', path: '/dashboard/lost-items', icon: <PackageMinus size={20} strokeWidth={2} /> },
    { name: 'Claims', path: '/dashboard/claims', icon: <ClipboardList size={20} strokeWidth={2} /> },
    { name: 'Users', path: '/dashboard/users', icon: <Users size={20} strokeWidth={2} /> },
    { name: 'Audit Log', path: '/dashboard/audit', icon: <History size={20} strokeWidth={2} /> },
  ];

  const currentPage = navItems.find(item => item.path === pathname)?.name || 'Dashboard';

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoBadge}>PNP</div>
          <div className={styles.brandInfo}>
            <h2>Balik-Calasiao</h2>
            <span>Admin Center</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSectionHeader}>Main Menu</div>
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`${styles.navItem} ${pathname === item.path ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navName}>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userProfile}>
            <div className={styles.avatar}>
              {user.email?.[0].toUpperCase() || 'A'}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userEmail}>{user.email}</span>
              <span className={styles.roleBadge}>Administrator</span>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <h1>{currentPage}</h1>
            <div className={styles.breadcrumb}>
              Admin / <span>{currentPage}</span>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.notificationWrapper}>
              <button 
                className={`${styles.topbarAction} ${showNotifications ? styles.activeAction : ''}`}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} />
                {notifications.some(n => n.unread) && <span className={styles.notificationDot}></span>}
              </button>

              {showNotifications && (
                <div className={styles.notificationDropdown}>
                  <div className={styles.dropdownHeader}>
                    <h3>Notifications</h3>
                    <span>{notifications.length} New</span>
                  </div>
                  <div className={styles.dropdownContent}>
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={styles.notificationItem}
                          onClick={() => {
                            setShowNotifications(false);
                            router.push(n.link || '/dashboard');
                          }}
                        >
                          <div className={styles.notifIcon} style={{ 
                            backgroundColor: n.type === 'dispute' ? 'rgba(239, 68, 68, 0.1)' : 
                                            n.type === 'message' ? 'rgba(59, 130, 246, 0.1)' : 
                                            'rgba(64, 145, 108, 0.1)' 
                          }}>
                            {n.type === 'dispute' && <AlertCircle size={16} color="#ef4444" />}
                            {n.type === 'message' && <TrendingUp size={16} color="#3b82f6" />}
                            {n.type === 'claim' && <CheckCircle size={16} color="var(--primary)" />}
                          </div>
                          <div className={styles.notifInfo}>
                            <p>{n.message}</p>
                            <span>{new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyNotif}>All caught up!</div>
                    )}
                  </div>
                  <div className={styles.dropdownFooter} onClick={() => router.push('/dashboard/audit')}>
                    View All Activity
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
}
