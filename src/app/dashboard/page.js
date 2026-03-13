'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import styles from './overview.module.css';

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    totalFound: 0,
    totalLost: 0,
    pendingClaims: 0,
    recentMatches: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch Found Items Count
        const foundSnapshot = await getDocs(collection(db, 'found_items'));
        const totalFound = foundSnapshot.size;

        // Fetch Lost Items Count
        const lostSnapshot = await getDocs(collection(db, 'lost_items'));
        const totalLost = lostSnapshot.size;

        // Fetch Pending Claims
        const claimsQuery = query(collection(db, 'claims'), where('status', '==', 'pending'));
        const claimsSnapshot = await getDocs(claimsQuery);
        const pendingClaims = claimsSnapshot.size;

        setStats({
          totalFound,
          totalLost,
          pendingClaims,
          recentMatches: 0 // Placeholder until match logic is integrated
        });
      } catch (error) {
        console.error("Error fetching overview stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading statistics...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.statsGrid}>
        
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Found Items</h3>
            <span className={styles.icon}>🔍</span>
          </div>
          <div className={styles.statValue}>{stats.totalFound}</div>
          <p className={styles.statDesc}>Items waiting to be claimed</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Lost Items</h3>
            <span className={styles.icon}>❓</span>
          </div>
          <div className={styles.statValue}>{stats.totalLost}</div>
          <p className={styles.statDesc}>User reports looking for items</p>
        </div>

        <div className={`${styles.statCard} ${stats.pendingClaims > 0 ? styles.alertCard : ''}`}>
          <div className={styles.statHeader}>
            <h3>Pending Claims</h3>
            <span className={styles.icon}>✋</span>
          </div>
          <div className={styles.statValue}>{stats.pendingClaims}</div>
          <p className={styles.statDesc}>Require manual admin review</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Claims</h3>
            <span className={styles.icon}>✅</span>
          </div>
          <div className={styles.statValue}>--</div>
          <p className={styles.statDesc}>Resolved and completed matches</p>
        </div>

      </div>

      <div className={styles.recentSection}>
        <h2>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <button className={styles.actionBtn}>Review Pending Claims</button>
          <button className={styles.actionBtn}>Add Manual Match</button>
          <button className={styles.actionBtn}>Export Monthly Report</button>
        </div>
      </div>
    </div>
  );
}
