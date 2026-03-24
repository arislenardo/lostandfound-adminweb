'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import styles from './overview.module.css';
import ManualMatchModal from '@/components/ManualMatchModal';

export default function DashboardOverview() {
  const [stats, setStats] = useState({ totalFound: 0, totalLost: 0, pendingClaims: 0, totalClaims: 0 });
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [allData, setAllData] = useState({ found: [], lost: [], claims: [] });
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setAdminUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [foundSnap, lostSnap, allClaimsSnap, pendingSnap] = await Promise.all([
          getDocs(collection(db, 'found_items')),
          getDocs(collection(db, 'lost_items')),
          getDocs(collection(db, 'claims')),
          getDocs(query(collection(db, 'claims'), where('status', '==', 'pending'))),
        ]);

        const found  = foundSnap.docs.map(d  => ({ ...d.data(),  id: d.id }));
        const lost   = lostSnap.docs.map(d   => ({ ...d.data(),  id: d.id }));
        const claims = allClaimsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

        setAllData({ found, lost, claims });
        setStats({
          totalFound:    foundSnap.size,
          totalLost:     lostSnap.size,
          pendingClaims: pendingSnap.size,
          totalClaims:   allClaimsSnap.size,
        });
      } catch (error) {
        console.error("Error fetching overview stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const handleExportReport = () => {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const pendingCount = allData.claims.filter(c => (c.status || '').toLowerCase() === 'pending').length;
    const approvedCount = allData.claims.filter(c => (c.status || '').toLowerCase() === 'approved').length;
    const rejectedCount = allData.claims.filter(c => (c.status || '').toLowerCase() === 'rejected').length;
    const returnedCount = allData.found.filter(i => (i.status || '').toLowerCase() === 'returned').length;

    const rows = [
      // ── Summary ──
      [`=== BALIK-CALASIAO LOST & FOUND — MONTHLY REPORT ===`],
      [`Report Month: ${month}`],
      [`Generated On: ${now.toLocaleString()}`],
      [``],
      [`--- SUMMARY ---`],
      [`Total Found Items Reported`, allData.found.length],
      [`Total Lost Items Reported`,  allData.lost.length],
      [`Items Successfully Returned`, returnedCount],
      [`Total Claims Filed`,          allData.claims.length],
      [`  ↳ Approved`,               approvedCount],
      [`  ↳ Pending`,                pendingCount],
      [`  ↳ Rejected`,               rejectedCount],
      [``],

      // ── Found Items ──
      [`--- FOUND ITEMS ---`],
      ['ID', 'Name', 'Category', 'Status', 'Location', 'Finder UID', 'Date Reported'],
      ...allData.found.map(i => [
        i.id,
        i.name || '',
        i.category || '',
        i.status || '',
        i.locationName || '',
        i.userId || '',
        i.createdAt ? new Date(i.createdAt.toDate?.() || i.createdAt).toLocaleString('en-US', { hour12: true }) : '',
      ]),
      [``],

      // ── Lost Items ──
      [`--- LOST ITEMS ---`],
      ['ID', 'Name', 'Category', 'Status', 'Owner UID', 'Date Reported'],
      ...allData.lost.map(i => [
        i.id,
        i.name || '',
        i.category || '',
        i.status || '',
        i.userId || '',
        i.createdAt ? new Date(i.createdAt.toDate?.() || i.createdAt).toLocaleString('en-US', { hour12: true }) : '',
      ]),
      [``],

      // ── Claims ──
      [`--- CLAIMS ---`],
      ['Claim ID', 'Found Item ID', 'Claimant UID', 'Status', 'Manual Match', 'Date Filed'],
      ...allData.claims.map(c => [
        c.id,
        c.itemId || '',
        c.userId || '',
        c.status || '',
        c.manualMatch ? 'Yes' : 'No',
        c.timestamp ? new Date(c.timestamp.toDate?.() || c.timestamp).toLocaleString('en-US', { hour12: true }) : '',
      ]),
    ];

    const csv = rows.map(r =>
      Array.isArray(r) && r.length > 1
        ? r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        : (r[0] || '')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BalikCalasiao_Report_${now.toISOString().slice(0,7)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className={styles.loading}>Loading statistics...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.statsGrid}>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Found Items</h3>
          </div>
          <div className={styles.statValue}>{stats.totalFound}</div>
          <p className={styles.statDesc}>Items waiting to be claimed</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Lost Items</h3>
          </div>
          <div className={styles.statValue}>{stats.totalLost}</div>
          <p className={styles.statDesc}>User reports looking for items</p>
        </div>

        <div className={`${styles.statCard} ${stats.pendingClaims > 0 ? styles.alertCard : ''}`}>
          <div className={styles.statHeader}>
            <h3>Pending Claims</h3>
          </div>
          <div className={styles.statValue}>{stats.pendingClaims}</div>
          <p className={styles.statDesc}>Require manual admin review</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Claims</h3>
          </div>
          <div className={styles.statValue}>{stats.totalClaims}</div>
          <p className={styles.statDesc}>All claim submissions on record</p>
        </div>

      </div>

      <div className={styles.recentSection}>
        <h2>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <button
            className={styles.actionBtn}
            onClick={() => router.push('/dashboard/claims')}
          >
            Review Pending Claims
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => setIsMatchModalOpen(true)}
          >
            Add Manual Match
          </button>
          <button
            className={styles.actionBtn}
            onClick={handleExportReport}
          >
            Export Monthly Report
          </button>
        </div>
      </div>

      <ManualMatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        adminUser={adminUser}
      />
    </div>
  );
}
