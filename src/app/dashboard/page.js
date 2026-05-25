'use client';

import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import styles from './overview.module.css';
import ExportModal from '@/components/ExportModal';
import { exportToPDF, exportToExcel, exportConsolidatedPDF, exportConsolidatedExcel } from '@/lib/reportUtils';

/**
 * Dashboard overview page component. Displays key statistics, charts,
 * and quick actions for the lost and found administration panel.
 * @returns {JSX.Element} The rendered dashboard overview page.
 */
export default function DashboardOverview() {
  const [stats, setStats] = useState({ totalFound: 0, totalLost: 0, pendingClaims: 0, totalClaims: 0 });
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState({ found: [], lost: [], claims: [] });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    /**
     * Fetches current statistics from Firestore to populate the dashboard.
     */
    async function fetchStats() {
      try {
        const [foundSnap, lostSnap, allClaimsSnap] = await Promise.all([
          getDocs(collection(db, 'found_items')),
          getDocs(collection(db, 'lost_items')),
          getDocs(collection(db, 'claims')),
        ]);

        const found = foundSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const lost = lostSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const claims = allClaimsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

        // Calculate pending claims more robustly (inclusive of 'claim_pending' and missing status)
        const pendingCount = claims.filter(c => {
          const s = (c.status || 'pending').toLowerCase();
          return s === 'pending' || s === 'claim_pending';
        }).length;

        setAllData({ found, lost, claims });
        setStats({
          totalFound: foundSnap.size,
          totalLost: lostSnap.size,
          pendingClaims: pendingCount,
          totalClaims: allClaimsSnap.size,
        });
      } catch (error) {
        console.error("Error fetching overview stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  /**
   * Generates and downloads a monthly CSV report containing all recorded
   * found items, lost items, and claims from the database.
   */
  const handleExport = (startDate, endDate, searchTerm, format) => {
    const now = new Date();
    let start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    let end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    if (startDate) start.setHours(0, 0, 0, 0);
    if (endDate) end.setHours(23, 59, 59, 999);

    const filterByDateAndSearch = (items, dateKey) => items.filter(item => {
      const timestamp = item[dateKey];
      if (!timestamp) return false;
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (d < start || d > end) return false;
      
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        // Try matching common fields across different item types
        return (item.name || '').toLowerCase().includes(lowerTerm) ||
               (item.itemName || '').toLowerCase().includes(lowerTerm) ||
               (item.id || '').toLowerCase().includes(lowerTerm) ||
               (item.userEmail || '').toLowerCase().includes(lowerTerm) ||
               (item.userId || '').toLowerCase().includes(lowerTerm);
      }
      return true;
    });

    const filteredFound = filterByDateAndSearch(allData.found, 'createdAt');
    const filteredLost = filterByDateAndSearch(allData.lost, 'createdAt');
    const filteredClaims = filterByDateAndSearch(allData.claims, 'timestamp');

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    const dateRangeStr = `${formatDate(start)} to ${formatDate(end)}`;
    const filename = `Monthly_Report_${start.toISOString().slice(0, 7)}`;

    const sections = [
      {
        title: 'Summary Dashboard',
        columns: [
          { header: 'Metric', key: 'metric' },
          { header: 'Count / Value', key: 'value' }
        ],
        data: [
          { metric: 'Total Found Items', value: filteredFound.length },
          { metric: 'Total Lost Items', value: filteredLost.length },
          { metric: 'Total Claims Filed', value: filteredClaims.length },
          { metric: 'Pending Claims', value: filteredClaims.filter(c => {
            const s = (c.status || 'pending').toLowerCase();
            return s === 'pending' || s === 'claim_pending';
          }).length },
          { metric: 'Approved Claims', value: filteredClaims.filter(c => c.status?.toLowerCase() === 'approved' || c.status?.toLowerCase() === 'returned').length },
          { metric: 'Rejected Claims', value: filteredClaims.filter(c => c.status?.toLowerCase() === 'rejected').length },
        ]
      },
      {
        title: 'Found Items',
        columns: [
          { header: 'ID', key: 'id' },
          { header: 'Name', key: 'name' },
          { header: 'Category', key: 'category' },
          { header: 'Status', key: 'status' },
          { header: 'Date', key: 'formattedDate' }
        ],
        data: filteredFound.map(i => ({
          ...i,
          status: (i.status || '').toUpperCase(),
          formattedDate: i.createdAt ? new Date(i.createdAt.toDate?.() || i.createdAt).toLocaleDateString() : ''
        }))
      },
      {
        title: 'Lost Items',
        columns: [
          { header: 'ID', key: 'id' },
          { header: 'Name', key: 'name' },
          { header: 'Category', key: 'category' },
          { header: 'Status', key: 'status' },
          { header: 'Date', key: 'formattedDate' }
        ],
        data: filteredLost.map(i => ({
          ...i,
          status: (i.status || '').toUpperCase(),
          formattedDate: i.createdAt ? new Date(i.createdAt.toDate?.() || i.createdAt).toLocaleDateString() : ''
        }))
      },
      {
        title: 'Claims',
        columns: [
          { header: 'Claim ID', key: 'id' },
          { header: 'Item ID', key: 'itemId' },
          { header: 'User UID', key: 'userId' },
          { header: 'Status', key: 'status' },
          { header: 'Date', key: 'formattedDate' }
        ],
        data: filteredClaims.map(c => ({
          ...c,
          status: (c.status || '').toUpperCase(),
          formattedDate: c.timestamp ? new Date(c.timestamp.toDate?.() || c.timestamp).toLocaleDateString() : ''
        }))
      }
    ];

    if (format === 'pdf') {
      exportConsolidatedPDF('Monthly System Report', sections, filename, dateRangeStr);
    } else {
      exportConsolidatedExcel('Monthly System Report', sections, filename, dateRangeStr);
    }
  };

  const categoryStats = useMemo(() => {
    const counts = {};
    allData.found.forEach(item => {
      const cat = item.category || 'Others';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allData.found]);

  const claimStatusStats = useMemo(() => {
    const pending = allData.claims.filter(c => {
      const s = (c.status || 'pending').toLowerCase();
      return s === 'pending' || s === 'claim_pending';
    }).length;
    const approved = allData.claims.filter(c => (c.status || '').toLowerCase() === 'approved' || (c.status || '').toLowerCase() === 'returned').length;
    const rejected = allData.claims.filter(c => (c.status || '').toLowerCase() === 'rejected').length;
    return [
      { label: 'Pending', count: pending, color: 'var(--gold)', total: allData.claims.length },
      { label: 'Cleared', count: approved, color: 'var(--success)', total: allData.claims.length },
      { label: 'Rejected', count: rejected, color: 'var(--error)', total: allData.claims.length },
    ];
  }, [allData.claims]);

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
            {stats.pendingClaims > 0 && (
              <span className={styles.alertBadge} title="Action Required">!</span>
            )}
          </div>
          <div className={styles.statValue}>{stats.pendingClaims}</div>
          <p className={styles.statDesc}>
            {stats.pendingClaims > 0 ? '⚠️ Action Required' : 'All claims resolved'}
          </p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>Total Claims</h3>
          </div>
          <div className={styles.statValue}>{stats.totalClaims}</div>
          <p className={styles.statDesc}>All claim submissions on record</p>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2>Found Categories (Top 5)</h2>
          <div className={styles.chartContainer}>
            {categoryStats.length > 0 ? (
              categoryStats.map(([cat, count]) => {
                const percentage = Math.min(100, (count / (stats.totalFound || 1)) * 100);
                return (
                  <div key={cat} className={styles.barRow}>
                    <div className={styles.barLabel}>
                      <span>{cat}</span>
                      <span>{count}</span>
                    </div>
                    <div className={styles.barWrapper}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${percentage}%`, backgroundColor: 'var(--primary)' }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className={styles.emptyState}>No category data available</p>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <h2>Claim Resolution Status</h2>
          <div className={styles.chartContainer}>
            {claimStatusStats.map(stat => {
              const percentage = stat.total > 0 ? Math.min(100, (stat.count / stat.total) * 100) : 0;
              return (
                <div key={stat.label} className={styles.barRow}>
                  <div className={styles.barLabel}>
                    <span>{stat.label}</span>
                    <span>{stat.count} ({Math.round(percentage)}%)</span>
                  </div>
                  <div className={styles.barWrapper}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${percentage}%`, backgroundColor: stat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
            onClick={() => setIsExportModalOpen(true)}
          >
            Export Monthly Report
          </button>
        </div>
      </div>

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        title="Export Monthly Report"
      />
    </div>
  );
}
