'use client';

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import MessageUserModal from '@/components/MessageUserModal';
import { exportToPDF, exportToExcel } from '@/lib/reportUtils';
import { Trophy, Medal, MessageSquare, Heart, Download, Sparkles } from 'lucide-react';
import styles from '../table.module.css';

export default function LeaderboardPage() {
  const { user: adminUser } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('monthly'); // 'monthly' | 'allTime'
  
  // Message user state
  const [selectedUser, setSelectedUser] = useState(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to both found_items and users
    const unsubItems = onSnapshot(collection(db, 'found_items'), (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error loading found items for leaderboard:", err));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error loading users for leaderboard:", err);
      setLoading(false);
    });

    return () => {
      unsubItems();
      unsubUsers();
    };
  }, []);

  // Compute leaderboard counts
  const leaderboardData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const userMap = {};

    // Initialize all users with 0 returns
    users.forEach(u => {
      userMap[u.id] = {
        id: u.id,
        name: u.name || u.displayName || 'Anonymous Citizen',
        email: u.email || 'No email',
        monthlyReturns: 0,
        allTimeReturns: 0
      };
    });

    // Count returned items
    items.forEach(item => {
      const statusUpper = (item.status || '').toUpperCase();
      if (statusUpper === 'RETURNED' && item.userId) {
        // If finder user not already in map, add them
        if (!userMap[item.userId]) {
          userMap[item.userId] = {
            id: item.userId,
            name: item.userName || item.userEmail || 'Anonymous Finder',
            email: item.userEmail || 'No email',
            monthlyReturns: 0,
            allTimeReturns: 0
          };
        }

        const finder = userMap[item.userId];
        finder.allTimeReturns += 1;

        // Check if returned within the current month
        let returnedDate = null;
        if (item.returnedAt) {
          returnedDate = item.returnedAt.toDate ? item.returnedAt.toDate() : new Date(item.returnedAt);
        } else if (item.createdAt) {
          // Fallback to report date if returned date is missing
          returnedDate = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        }

        if (returnedDate && returnedDate.getMonth() === currentMonth && returnedDate.getFullYear() === currentYear) {
          finder.monthlyReturns += 1;
        }
      }
    });

    // Convert map to array and filter out users with 0 returns
    const records = Object.values(userMap);
    
    const monthlyList = records
      .filter(r => r.monthlyReturns > 0)
      .sort((a, b) => b.monthlyReturns - a.monthlyReturns || a.name.localeCompare(b.name));

    const allTimeList = records
      .filter(r => r.allTimeReturns > 0)
      .sort((a, b) => b.allTimeReturns - a.allTimeReturns || a.name.localeCompare(b.name));

    return {
      monthly: monthlyList,
      allTime: allTimeList
    };
  }, [items, users]);

  // Active list based on active filter
  const activeList = useMemo(() => {
    return filterType === 'monthly' ? leaderboardData.monthly : leaderboardData.allTime;
  }, [filterType, leaderboardData]);

  // Podium (Top 3)
  const podium = useMemo(() => {
    const list = activeList;
    return {
      first: list[0] || null,
      second: list[1] || null,
      third: list[2] || null
    };
  }, [activeList]);

  // Regular Table List (Rank 4 onwards)
  const tableList = useMemo(() => {
    return activeList.slice(3);
  }, [activeList]);

  // Handle Export Report
  const handleExport = (format) => {
    const list = activeList;
    const columns = [
      { header: 'Rank', key: 'rank' },
      { header: 'Citizen Name', key: 'name' },
      { header: 'Email Address', key: 'email' },
      { header: 'Items Returned', key: 'returnsCount' },
    ];

    const dataToExport = list.map((user, idx) => ({
      rank: `#${idx + 1}`,
      name: user.name,
      email: user.email,
      returnsCount: filterType === 'monthly' ? user.monthlyReturns : user.allTimeReturns
    }));

    const dateSuffix = new Date().toISOString().split('T')[0];
    const reportTitle = filterType === 'monthly' 
      ? `Citizen Returners Honor Roll (${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })})`
      : 'Citizen Returners Honor Roll (All-Time)';

    const exportName = `returner_leaderboard_${filterType}_${dateSuffix}`;

    if (format === 'pdf') {
      exportToPDF(reportTitle, columns, dataToExport, exportName, null);
    } else {
      exportToExcel(reportTitle, columns, dataToExport, exportName, null);
    }
  };

  const handleOpenChat = (citizen) => {
    setSelectedUser(citizen);
    setIsMsgModalOpen(true);
  };

  if (loading) return <div className={styles.emptyState}>Loading Honored Citizens Leaderboard...</div>;

  return (
    <div className={styles.pageContainer}>
      
      {/* Dynamic appreciation banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1b4332 0%, #40916c 100%)',
        borderRadius: '16px',
        padding: '2rem',
        color: 'white',
        marginBottom: '2rem',
        boxShadow: '0 10px 25px -5px rgba(27, 67, 50, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.1 }}>
          <Trophy size={160} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Sparkles color="#ffd700" size={24} />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffd700' }}>
            Honoring Honesty & Civility
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Citizen Returners Honor Roll</h2>
        <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.95rem', maxWidth: '600px' }}>
          Appreciating citizens who successfully reunite found items with their owners. Counts are credited only when items are physically returned to the claimant at the Calasiao Police Station.
        </p>
      </div>

      {/* Control Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Toggle Switch */}
        <div style={{
          backgroundColor: 'var(--border, #e5e7eb)',
          padding: '4px',
          borderRadius: '10px',
          display: 'flex',
          gap: '4px'
        }}>
          <button
            onClick={() => setFilterType('monthly')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
              backgroundColor: filterType === 'monthly' ? 'white' : 'transparent',
              color: filterType === 'monthly' ? 'var(--primary, #1b4332)' : 'var(--text-muted, #6b7280)',
              boxShadow: filterType === 'monthly' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            This Month
          </button>
          <button
            onClick={() => setFilterType('allTime')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
              backgroundColor: filterType === 'allTime' ? 'white' : 'transparent',
              color: filterType === 'allTime' ? 'var(--primary, #1b4332)' : 'var(--text-muted, #6b7280)',
              boxShadow: filterType === 'allTime' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            All-Time
          </button>
        </div>

        {/* Action Exporters */}
        {activeList.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => handleExport('pdf')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'white',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Download size={16} /> Export PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'white',
                color: '#16a34a',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Download size={16} /> Export Excel
            </button>
          </div>
        )}
      </div>

      {activeList.length === 0 ? (
        <div className={styles.emptyState}>No items returned in this period yet.</div>
      ) : (
        <>
          {/* Visual Podium (Top 3) */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: '1.5rem',
            margin: '2rem 0 4rem',
            flexWrap: 'wrap'
          }}>
            {/* 2nd Place (Left) */}
            {podium.second && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '180px',
                order: 1
              }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: '#6b7280',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  border: '3px solid #9ca3af',
                  position: 'relative',
                  marginBottom: '1rem'
                }}>
                  🥈
                </div>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', textAlign: 'center' }}>
                  {podium.second.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center', wordBreak: 'break-all' }}>
                  {podium.second.email}
                </span>
                <div style={{
                  background: 'linear-gradient(180deg, #d1d5db 0%, #9ca3af 100%)',
                  width: '100%',
                  height: '110px',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                    {filterType === 'monthly' ? podium.second.monthlyReturns : podium.second.allTimeReturns}
                  </span>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Returns</span>
                  <button
                    onClick={() => handleOpenChat(podium.second)}
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '4px 10px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: 'white',
                      color: 'var(--primary)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Heart size={10} color="#e63946" fill="#e63946" /> Thank Citizen
                  </button>
                </div>
              </div>
            )}

            {/* 1st Place (Center - Highest) */}
            {podium.first && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '200px',
                order: 2,
                transform: 'scale(1.05)'
              }}>
                <div style={{
                  width: '85px',
                  height: '85px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  color: '#d97706',
                  boxShadow: '0 6px 15px rgba(217, 119, 6, 0.25)',
                  border: '4px solid #fbbf24',
                  position: 'relative',
                  marginBottom: '1rem'
                }}>
                  👑
                  <div style={{
                    position: 'absolute',
                    top: '-15px',
                    fontSize: '1.25rem'
                  }}>✨</div>
                </div>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 800, color: 'var(--foreground)', textAlign: 'center' }}>
                  {podium.first.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center', wordBreak: 'break-all' }}>
                  {podium.first.email}
                </span>
                <div style={{
                  background: 'linear-gradient(180deg, #fde047 0%, #eab308 100%)',
                  width: '100%',
                  height: '140px',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#78350f',
                  boxShadow: '0 10px 20px -5px rgba(234, 179, 8, 0.4)'
                }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>
                    {filterType === 'monthly' ? podium.first.monthlyReturns : podium.first.allTimeReturns}
                  </span>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Returns</span>
                  <button
                    onClick={() => handleOpenChat(podium.first)}
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '5px 12px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: '#78350f',
                      color: 'white',
                      fontSize: '0.725rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                    }}
                  >
                    <Heart size={11} color="white" fill="white" /> Thank Citizen
                  </button>
                </div>
              </div>
            )}

            {/* 3rd Place (Right) */}
            {podium.third && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '170px',
                order: 3
              }}>
                <div style={{
                  width: '65px',
                  height: '65px',
                  borderRadius: '50%',
                  backgroundColor: '#ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#ea580c',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  border: '3px solid #fb923c',
                  position: 'relative',
                  marginBottom: '1rem'
                }}>
                  🥉
                </div>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', textAlign: 'center' }}>
                  {podium.third.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center', wordBreak: 'break-all' }}>
                  {podium.third.email}
                </span>
                <div style={{
                  background: 'linear-gradient(180deg, #ffedd5 0%, #fed7aa 100%)',
                  width: '100%',
                  height: '90px',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c2d12',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    {filterType === 'monthly' ? podium.third.monthlyReturns : podium.third.allTimeReturns}
                  </span>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Returns</span>
                  <button
                    onClick={() => handleOpenChat(podium.third)}
                    style={{
                      marginTop: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '4px 10px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: 'white',
                      color: 'var(--primary)',
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Heart size={10} color="#e63946" fill="#e63946" /> Thank Citizen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table List for Rank 4 onwards */}
          {tableList.length > 0 && (
            <div style={{ marginTop: '3rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>Honorable Mentions</h3>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Citizen Name</th>
                      <th>Email Address</th>
                      <th>Items Returned</th>
                      <th style={{ width: '180px', textAlign: 'center' }}>Appreciation Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableList.map((user, index) => {
                      const rank = index + 4;
                      const returns = filterType === 'monthly' ? user.monthlyReturns : user.allTimeReturns;
                      return (
                        <tr key={user.id}>
                          <td style={{ fontWeight: 'bold' }}>#{rank}</td>
                          <td style={{ fontWeight: 600 }}>{user.name}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{user.email}</td>
                          <td>
                            <span style={{
                              backgroundColor: 'rgba(64, 145, 108, 0.1)',
                              color: 'var(--primary)',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              fontSize: '0.85rem'
                            }}>
                              {returns} {returns === 1 ? 'item' : 'items'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenChat(user)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                backgroundColor: '#ffe5ec',
                                color: '#fb6f92',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 4px rgba(251,111,146,0.1)'
                              }}
                            >
                              <Heart size={14} fill="#fb6f92" />
                              <span>Say Thank You</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Message User Modal */}
      {isMsgModalOpen && selectedUser && (
        <MessageUserModal
          isOpen={isMsgModalOpen}
          onClose={() => { setIsMsgModalOpen(false); setSelectedUser(null); }}
          user={selectedUser}
          adminUser={adminUser}
        />
      )}

    </div>
  );
}
