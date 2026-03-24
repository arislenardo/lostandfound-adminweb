'use client';

import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, getDocs, doc, updateDoc,
  addDoc, serverTimestamp, setDoc, deleteDoc
} from 'firebase/firestore';
import styles from '../table.module.css';
import MessageUserModal from '@/components/MessageUserModal';

const ROLE_FILTERS = ['All', 'Admin', 'Resident', 'Non-resident'];

/**
 * Role field values: "Resident", "Non-resident", "Admin"
 * Older accounts without the role field are all residents.
 */
function isResidentUser(user) {
  if (user.role !== undefined && user.role !== null) {
    return user.role === 'Resident';
  }
  // All older accounts (without a role field) are residents
  return true;
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [adminIds, setAdminIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setAdminUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [usersSnap, adminsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'admins')),
        ]);
        setUsers(usersSnap.docs.map(d => ({ ...d.data(), id: d.id })));
        setAdminIds(new Set(adminsSnap.docs.map(d => d.id)));
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    return users.filter(user => {
      const isAdmin = adminIds.has(user.id);
      const isResident = !isAdmin && isResidentUser(user);
      const isNonResident = !isAdmin && !isResident;

      const matchesSearch = !search ||
        (user.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(search.toLowerCase()) ||
        user.id.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === 'All' ||
        (roleFilter === 'Admin' && isAdmin) ||
        (roleFilter === 'Resident' && isResident) ||
        (roleFilter === 'Non-resident' && isNonResident);

      return matchesSearch && matchesRole;
    });
  }, [users, adminIds, search, roleFilter]);

  const handleBanAccount = async (user) => {
    const isBanned = user.banned === true;
    const action = isBanned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name || user.email || user.id}?`)) return;
    try {
      await updateDoc(doc(db, 'users', user.id), { banned: !isBanned });
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: isBanned ? 'UNBANNED_USER' : 'BANNED_USER',
        itemTitle: user.name || user.email || user.id,
        itemId: user.id,
        timestamp: serverTimestamp(),
      });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: !isBanned } : u));
    } catch (error) {
      alert(`Failed to ${action} user: ${error.message}`);
    }
  };

  const handleToggleAdmin = async (user) => {
    const isAdmin = adminIds.has(user.id);
    const action = isAdmin ? 'remove admin from' : 'make admin';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name || user.email}?`)) return;
    try {
      const adminRef = doc(db, 'admins', user.id);
      if (isAdmin) {
        await deleteDoc(adminRef);
      } else {
        await setDoc(adminRef, { email: user.email || '', grantedAt: serverTimestamp() });
      }
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: isAdmin ? 'REVOKED_ADMIN' : 'GRANTED_ADMIN',
        itemTitle: user.name || user.email || user.id,
        itemId: user.id,
        timestamp: serverTimestamp(),
      });
      setAdminIds(prev => {
        const next = new Set(prev);
        isAdmin ? next.delete(user.id) : next.add(user.id);
        return next;
      });
    } catch (error) {
      alert(`Failed to update admin status: ${error.message}`);
    }
  };

  const getRoleBadgeClass = (user) => {
    if (adminIds.has(user.id)) return styles.roleAdmin;
    if (isResidentUser(user)) return styles.roleResident;
    return styles.roleNonResident;
  };

  const getRoleLabel = (user) => {
    if (adminIds.has(user.id)) return 'Administrator';
    if (isResidentUser(user)) return 'Resident';
    return 'Non-resident';
  };

  if (loading) return <div className={styles.emptyState}>Loading Users...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Registered User Profiles</h2>
        <span>{filtered.length} of {users.length} users</span>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name, email or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          {ROLE_FILTERS.map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email Address</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Account Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="6" className={styles.emptyState}>No users found.</td></tr>
            ) : (
              filtered.map(user => {
                const isAdmin = adminIds.has(user.id);
                return (
                  <tr key={user.id}>
                    <td style={{ fontWeight: '600' }}>{user.name || 'N/A'}</td>
                    <td style={{ fontSize: '0.875rem' }}>{user.email || 'N/A'}</td>
                    <td style={{ fontSize: '0.875rem' }}>{user.phoneNumber || 'N/A'}</td>
                    <td>
                      <span className={`${styles.badge} ${getRoleBadgeClass(user)}`}>
                        {getRoleLabel(user)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${user.banned ? styles.statusBanned : styles.statusActive}`}>
                        {user.banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button className={styles.actionBtn} onClick={() => { setSelectedUser(user); setIsMsgModalOpen(true); }}>
                          Message
                        </button>
                        <button
                          className={styles.actionBtn}
                          style={{
                            borderColor: user.banned ? 'var(--success)' : 'var(--error)',
                            color: user.banned ? 'var(--success-dark)' : '#b91c1c',
                          }}
                          onClick={() => handleBanAccount(user)}
                        >
                          {user.banned ? 'Unban' : 'Ban'}
                        </button>
                        <button
                          className={styles.actionBtn}
                          style={{
                            borderColor: isAdmin ? 'var(--warning)' : 'var(--primary)',
                            color: isAdmin ? '#c2410c' : 'var(--primary)',
                          }}
                          onClick={() => handleToggleAdmin(user)}
                        >
                          {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
