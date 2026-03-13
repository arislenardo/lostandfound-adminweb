'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from '../table.module.css';
import MessageUserModal from '@/components/MessageUserModal';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);

  // Messaging modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setAdminUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const fetchedUsers = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const handleBanAccount = async (user) => {
    const isBanned = user.banned === true;
    const action = isBanned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name || user.email || user.id}?`)) return;

    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { banned: !isBanned });

      // Log to admin_history
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: isBanned ? 'UNBANNED_USER' : 'BANNED_USER',
        itemTitle: user.name || user.email || user.id,
        itemId: user.id,
        timestamp: serverTimestamp(),
      });

      // Update local state
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: !isBanned } : u));
    } catch (error) {
      console.error('Error updating ban status:', error);
      alert(`Failed to ${action} user: ${error.message}`);
    }
  };

  const handleOpenMessage = (user) => {
    setSelectedUser(user);
    setIsMsgModalOpen(true);
  };

  if (loading) return <div className={styles.emptyState}>Loading Users...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Registered Citizen Profiles</h2>
        <span>{users.length} Total Users</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User ID (UID)</th>
              <th>Full Name</th>
              <th>Email Address</th>
              <th>Phone Number</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No users found.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{user.id}</td>
                  <td style={{ fontWeight: '500' }}>{user.name || 'N/A'}</td>
                  <td>{user.email || 'N/A'}</td>
                  <td>{user.phoneNumber || 'N/A'}</td>
                  <td>
                    <span
                      className={styles.badge}
                      style={{
                        backgroundColor: user.banned ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: user.banned ? 'var(--error)' : 'var(--success)'
                      }}
                    >
                      {user.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleOpenMessage(user)}
                      >
                        Message
                      </button>
                      <button
                        className={styles.actionBtn}
                        style={{
                          borderColor: user.banned ? 'var(--success)' : 'var(--error)',
                          color: user.banned ? 'var(--success)' : 'var(--error)'
                        }}
                        onClick={() => handleBanAccount(user)}
                      >
                        {user.banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MessageUserModal
        isOpen={isMsgModalOpen}
        onClose={() => { setIsMsgModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        adminUser={adminUser}
      />
    </div>
  );
}
