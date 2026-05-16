'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import styles from '../table.module.css';

export default function NotificationsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const router = useRouter();

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Load from persistent storage
    const stored = JSON.parse(localStorage.getItem('admin_persistent_notifs') || '[]');
    setNotifications(stored);
    setLoading(false);
  }, [user, isAdmin]);

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      const dismissedIds = JSON.parse(localStorage.getItem('admin_dismissed_ids') || '[]');
      notifications.forEach(n => {
        if (!dismissedIds.includes(n.id)) dismissedIds.push(n.id);
      });
      localStorage.setItem('admin_dismissed_ids', JSON.stringify(dismissedIds));
      localStorage.setItem('admin_persistent_notifs', '[]');
      setNotifications([]);
      // Force layout update if possible (not easy, but next refresh will catch it)
      window.location.reload();
    }
  };

  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
  const paginatedNotifs = notifications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (authLoading || loading) return <div className={styles.emptyState}>Loading Notifications...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>All Notifications</h2>
          <span>
            {notifications.length > 0 ? (
              `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, notifications.length)} of ${notifications.length} notifications`
            ) : (
              '0 notifications'
            )}
          </span>
        </div>
        {notifications.length > 0 && (
          <button 
            className={styles.actionBtn} 
            style={{ backgroundColor: 'var(--error)', color: 'white', borderColor: 'var(--error)' }}
            onClick={handleClearAll}
          >
            Clear All History
          </button>
        )}
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Message</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedNotifs.length === 0 ? (
              <tr><td colSpan="4" className={styles.emptyState}>No new notifications. All caught up!</td></tr>
            ) : (
              paginatedNotifs.map(notif => (
                <tr key={notif.id}>
                  <td>
                    <span className={styles.badge} style={{
                      backgroundColor: notif.type === 'dispute' ? 'rgba(239, 68, 68, 0.1)' : notif.type === 'message' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(64, 145, 108, 0.1)',
                      color: notif.type === 'dispute' ? '#ef4444' : notif.type === 'message' ? '#3b82f6' : 'var(--primary)',
                      border: '1px solid transparent', textTransform: 'uppercase', fontWeight: 'bold'
                    }}>
                      {notif.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--brown)' }}>{notif.message}</div>
                    {notif.subtext && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 400 }}>{notif.subtext}</div>}
                    {notif.meta && <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '0.1rem', fontWeight: 500 }}>{notif.meta}</div>}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(notif.time).toLocaleString()}</td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => router.push(notif.link)}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.pageInfo}>
            Page {currentPage} of {totalPages} ({notifications.length} items)
          </div>
          <div className={styles.pageControls}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
