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

    async function fetchNotifications() {
      try {
        const qClaims = query(collection(db, 'claims'), where('status', 'in', ['pending', 'disputed']));
        const qMessages = query(collection(db, 'messages'), where('receiverId', '==', user.uid), where('isRead', '==', false));

        const [claimsSnap, messagesSnap] = await Promise.all([getDocs(qClaims), getDocs(qMessages)]);

        const allNotifs = [];

        claimsSnap.forEach(doc => {
          const data = doc.data();
          const type = data.status === 'disputed' ? 'dispute' : 'claim';
          const docTime = data.timestamp?.toDate?.() || (data.timestamp instanceof Date ? data.timestamp : new Date());
          allNotifs.push({
            id: doc.id,
            type: type,
            message: type === 'dispute' ? `Dispute: Claim #${doc.id.slice(-4)} re-opened` : `New claim: ${data.itemName || 'Item #' + doc.id.slice(-4)}`,
            time: docTime,
            link: `/dashboard/claims?claimId=${doc.id}`,
            status: data.status
          });
        });

        messagesSnap.forEach(doc => {
          const data = doc.data();
          const docTime = data.timestamp?.toDate?.() || (data.timestamp instanceof Date ? data.timestamp : new Date());
          allNotifs.push({
            id: doc.id,
            type: 'message',
            message: `Message: "${data.text?.substring(0, 30)}..."`,
            time: docTime,
            link: `/dashboard/users?chatUserId=${data.senderId}`,
            status: 'unread'
          });
        });

        allNotifs.sort((a, b) => b.time - a.time);
        setNotifications(allNotifs);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
  }, [user, isAdmin]);

  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
  const paginatedNotifs = notifications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (authLoading || loading) return <div className={styles.emptyState}>Loading Notifications...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>All Notifications</h2>
        <span>
          {notifications.length > 0 ? (
            `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, notifications.length)} of ${notifications.length} notifications`
          ) : (
            '0 notifications'
          )}
        </span>
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
                  <td style={{ fontWeight: 500 }}>{notif.message}</td>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(notif.time).toLocaleString()}</td>
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
