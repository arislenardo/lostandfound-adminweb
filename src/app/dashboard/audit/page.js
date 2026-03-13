'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import styles from './audit.module.css';

const ACTION_LABELS = {
  APPROVED_CLAIM: 'Approved Claim',
  REJECTED_CLAIM: 'Rejected Claim',
  DELETED_FOUND_ITEM: 'Deleted Found Item',
  DELETED_LOST_ITEM: 'Deleted Lost Item',
  BANNED_USER: 'Banned User',
  UNBANNED_USER: 'Unbanned User',
  MANUAL_MATCH: 'Manual Match Created',
};

export default function AuditPage() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, 'admin_history'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) {
        console.error('Error fetching audit logs:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  if (loading) return <div className={styles.emptyState}>Loading audit log...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>System Audit Log</h2>
        <span>{logs.length} Records</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Subject</th>
              <th>Item ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className={styles.emptyState}>No audit records found.</td>
              </tr>
            ) : (
              logs.map(log => {
                const date = log.timestamp?.toDate
                  ? new Date(log.timestamp.toDate()).toLocaleString()
                  : 'Unknown';
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{date}</td>
                    <td style={{ fontSize: '0.8rem' }}>{log.adminName || log.adminId}</td>
                    <td>
                      <span className={styles.badge}>
                        {ACTION_LABELS[log.actionType] || log.actionType}
                      </span>
                    </td>
                    <td>{log.itemTitle || '—'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {log.itemId ? `${log.itemId.substring(0, 12)}...` : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
