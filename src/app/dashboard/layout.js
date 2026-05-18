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
  MessageSquare,
  X
} from 'lucide-react';
import styles from './dashboard.module.css';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';

/**
 * Layout component for the admin dashboard, including the sidebar and top navigation.
 * Handles real-time notifications for claims and messages.
 * @param {Object} props - The component props.
 * @param {JSX.Element} props.children - The child components to render within the layout.
 * @returns {JSX.Element|null} The rendered dashboard layout.
 */
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
      where('status', 'in', ['pending', 'disputed', 'PENDING', 'DISPUTED', 'claim_pending', 'CLAIM_PENDING'])
    );

    // 2. Listen for unread messages sent to admin (No orderBy to avoid index)
    const qMessages = query(
      collection(db, 'messages'),
      where('receiverId', '==', user.uid),
      where('isRead', '==', false)
    );

    let allNotifs = { claims: [], messages: [] };

    /**
     * Updates and sorts the combined notifications from claims and messages,
     * merging them with persistent storage to ensure they don't disappear automatically.
     */
    const updateNotifs = () => {
      const incoming = [...allNotifs.claims, ...allNotifs.messages];
      
      setNotifications(prev => {
        // Load persistent notifications from localStorage if exists
        const stored = JSON.parse(localStorage.getItem('admin_persistent_notifs') || '[]');
        
        // Merge incoming into stored (only if not already there and not dismissed)
        const dismissedIds = JSON.parse(localStorage.getItem('admin_dismissed_ids') || '[]');
        
        let updated = [...stored];
        let hasNew = false;

        incoming.forEach(newItem => {
          if (!updated.find(u => u.id === newItem.id) && !dismissedIds.includes(newItem.id)) {
            updated.push(newItem);
            hasNew = true;
          }
        });

        // Sort by time descending
        updated.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        // Limit to 50 for performance
        updated = updated.slice(0, 50);

        localStorage.setItem('admin_persistent_notifs', JSON.stringify(updated));
        
        if (hasNew) {
          try {
            const audio = new Audio('/notification-ping.mp3');
            audio.play().catch(e => console.log('Autoplay blocked'));
          } catch (err) {}
        }

        return updated;
      });
    };

    const unsubClaims = onSnapshot(qClaims, (snap) => {
      allNotifs.claims = snap.docs.map(doc => {
        const data = doc.data();
        const type = (data.status || '').toLowerCase() === 'disputed' ? 'dispute' : 'claim';
        const docTime = data.timestamp?.toDate?.() ||
          (data.timestamp instanceof Date ? data.timestamp : new Date());
        return {
          id: doc.id,
          type: type,
          message: type === 'dispute'
            ? `Dispute: Claim #${doc.id.slice(-4)} re-opened`
            : `New claim: ${data.itemName || 'Item #' + doc.id.slice(-4)}`,
          subtext: type === 'claim' ? `By: ${data.userEmail || data.userId || 'Unknown'}` : `Claim ID: ${doc.id.slice(-8)}`,
          time: docTime.toISOString(), // Store as string for localStorage
          unread: true,
          link: `/dashboard/claims?claimId=${doc.id}`
        };
      });
      updateNotifs();
    }, (err) => console.error("Notif Error (Claims):", err));

    // Cache to prevent repeated user doc fetches
    const userEmailCache = {};

    const unsubMessages = onSnapshot(qMessages, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (messageDoc) => {
        const data = messageDoc.data();
        const docTime = data.timestamp?.toDate?.() ||
          (data.timestamp instanceof Date ? data.timestamp : new Date());
          
        let senderDisplay = data.senderEmail || data.senderName;
        
        // If it doesn't look like an email, fetch from 'users' collection
        if (!senderDisplay || !senderDisplay.includes('@')) {
          if (userEmailCache[data.senderId]) {
            senderDisplay = userEmailCache[data.senderId];
          } else {
            try {
              const uDoc = await getDoc(doc(db, 'users', data.senderId));
              if (uDoc.exists() && uDoc.data().email) {
                senderDisplay = uDoc.data().email;
                userEmailCache[data.senderId] = senderDisplay;
              }
            } catch (err) {
              console.error("Failed to fetch user email:", err);
            }
          }
        }
        
        // Fallback if still no email
        if (!senderDisplay) {
          senderDisplay = 'User #' + (data.senderId?.slice(-4) || 'Unknown');
        }

        return {
          id: messageDoc.id,
          type: 'message',
          message: `Message from ${senderDisplay}`,
          subtext: data.text,
          time: docTime.toISOString(),
          unread: true,
          link: `/dashboard/users?chatUserId=${data.senderId}`
        };
      }));
      
      allNotifs.messages = msgs;
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

  const handleDismiss = (id, e) => {
    e.stopPropagation();
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem('admin_persistent_notifs', JSON.stringify(updated));
      
      // Track dismissed IDs to prevent them from coming back in same session
      const dismissedIds = JSON.parse(localStorage.getItem('admin_dismissed_ids') || '[]');
      if (!dismissedIds.includes(id)) {
        dismissedIds.push(id);
        localStorage.setItem('admin_dismissed_ids', JSON.stringify(dismissedIds));
      }
      
      return updated;
    });
  };

  const handleClearAll = () => {
    // Add all current IDs to dismissed list
    const dismissedIds = JSON.parse(localStorage.getItem('admin_dismissed_ids') || '[]');
    notifications.forEach(n => {
      if (!dismissedIds.includes(n.id)) dismissedIds.push(n.id);
    });
    localStorage.setItem('admin_dismissed_ids', JSON.stringify(dismissedIds));
    
    setNotifications([]);
    localStorage.setItem('admin_persistent_notifs', '[]');
  };

  /**
   * Handles the logout process for the administrator.
   */
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} strokeWidth={2} /> },
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
          <div className={styles.logoBadge}>
            <img src="/app-logo.webp" alt="App Logo" className={styles.logoImage} />
          </div>
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
              <span className={styles.stationBadge}>Calasiao Police Station</span>
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
                    <button className={styles.clearAllBtn} onClick={handleClearAll}>Clear All</button>
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
                            {n.type === 'message' && <MessageSquare size={16} color="#3b82f6" />}
                            {n.type === 'claim' && <CheckCircle size={16} color="var(--primary)" />}
                          </div>
                          <div className={styles.notifInfo}>
                            <p className={styles.notifTitleText}>{n.message}</p>
                            {n.subtext && <p className={styles.notifSubtext}>{n.subtext}</p>}
                            <div className={styles.notifMetaLine}>
                              {n.meta && <span className={styles.notifMeta}>{n.meta}</span>}
                              <span className={styles.notifTime}>{new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <button className={styles.dismissBtn} onClick={(e) => handleDismiss(n.id, e)}>
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyNotif}>All caught up!</div>
                    )}
                  </div>
                  <div className={styles.dropdownFooter} onClick={() => router.push('/dashboard/notifications')}>
                    View All Notifications
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
