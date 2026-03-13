'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from '../table.module.css';

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClaims() {
      try {
        const claimsRef = collection(db, 'claims');
        const q = query(claimsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedClaims = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        
        setClaims(fetchedClaims);
      } catch (error) {
        console.error("Error fetching claims:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchClaims();
  }, []);

  const handleUpdateStatus = async (claimId, newStatus) => {
    const claim = claims.find(c => c.id === claimId);
    const adminUser = auth.currentUser;
    try {
      await updateDoc(doc(db, 'claims', claimId), { status: newStatus });
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: newStatus === 'approved' ? 'APPROVED_CLAIM' : 'REJECTED_CLAIM',
        itemTitle: `Claim for item ${claim?.itemId?.substring(0, 8) || '?'}`,
        itemId: claim?.itemId || claimId,
        timestamp: serverTimestamp(),
      });
      setClaims(prev =>
        prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c)
      );
    } catch (error) {
      console.error(`Error updating claim to ${newStatus}:`, error);
      alert(`Failed to update claim: ${error.message}`);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'approved': return { bg: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' };
      case 'rejected': return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' };
      case 'pending': default: return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' };
    }
  };

  if (loading) return <div className={styles.emptyState}>Loading Claims...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Claim Resolution Hub</h2>
        <span>{claims.length} Total Claims</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Found Item ID</th>
              <th>Claimant UID</th>
              <th>Status</th>
              <th>Date Filed</th>
              <th>Admin Action</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No claims have been filed yet.</td>
              </tr>
            ) : (
              claims.map((claim) => {
                const statusStyle = getStatusClass(claim.status);
                const date = claim.timestamp ? new Date(claim.timestamp.toDate()).toLocaleDateString() : 'Unknown';

                return (
                  <tr key={claim.id}>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{claim.id.substring(0, 8)}...</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{claim.itemId?.substring(0,8)}...</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{claim.userId}</td>
                    <td>
                      <span className={styles.badge} style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                        {claim.status || 'Pending'}
                      </span>
                    </td>
                    <td>{date}</td>
                    <td>
                      {claim.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className={styles.actionBtn} 
                            style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                            onClick={() => handleUpdateStatus(claim.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button 
                            className={styles.actionBtn} 
                            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                            onClick={() => handleUpdateStatus(claim.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button className={styles.actionBtn}>View Details</button>
                      )}
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
