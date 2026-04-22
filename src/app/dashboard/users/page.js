'use client';

import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, getDocs, doc, updateDoc,
  addDoc, serverTimestamp, setDoc, deleteDoc
} from 'firebase/firestore';
import styles from '../table.module.css';
import MessageUserModal from '@/components/MessageUserModal';
import UserDetailModal from '@/components/UserDetailModal';


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

/**
 * Page component for displaying and managing the list of users.
 * Allows filtering by role, searching, and managing administrator privileges.
 * @returns {JSX.Element} The rendered Users dashboard page.
 */
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [adminIds, setAdminIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);


  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setAdminUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    /**
     * Fetches all users and administrators from Firestore and updates the state.
     */
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
    setCurrentPage(1); // Reset to page 1 on active filter/search
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

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedUsers = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /**
   * Toggles the administrator status for a given user.
   * If the user is an admin, their privileges are revoked. Otherwise, they are granted admin privileges.
   * Logs the action to the admin history collection.
   * @param {Object} user - The user object to update.
   */
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

  /**
   * Determines the CSS class for the role badge based on the user's role.
   * @param {Object} user - The user object.
   * @returns {string} The CSS class corresponding to the user's role.
   */
  const getRoleBadgeClass = (user) => {
    if (adminIds.has(user.id)) return styles.roleAdmin;
    if (isResidentUser(user)) return styles.roleResident;
    return styles.roleNonResident;
  };

  /**
   * Gets the display label for the user's role.
   * @param {Object} user - The user object.
   * @returns {string} The formatted role label.
   */
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
        <span>
          {filtered.length > 0 ? (
            `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} users`
          ) : (
            '0 users'
          )}
        </span>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr><td colSpan="5" className={styles.emptyState}>No users found.</td></tr>
            ) : (
              paginatedUsers.map(user => {
                const isAdmin = adminIds.has(user.id);
                return (
                  <tr key={user.id}>
                    <td style={{ fontWeight: '600' }}>{user.name || 'N/A'}</td>
                    <td style={{ fontSize: '0.875rem', wordBreak: 'break-all', minWidth: '150px' }}>{user.email || 'N/A'}</td>
                    <td style={{ fontSize: '0.875rem' }}>{user.phoneNumber || 'N/A'}</td>
                    <td>
                      <span className={`${styles.badge} ${getRoleBadgeClass(user)}`}>
                        {getRoleLabel(user)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className={styles.actionBtn} onClick={() => { setSelectedUser(user); setIsDetailModalOpen(true); }}>
                          Details
                        </button>
                        <button className={styles.actionBtn} onClick={() => { setSelectedUser(user); setIsMsgModalOpen(true); }}>
                          Message
                        </button>
                        <button
                          className={styles.actionBtn}
                          style={{
                            borderColor: isAdmin ? 'var(--warning)' : 'var(--primary)',
                            color: isAdmin ? '#c2410c' : 'var(--primary)',
                          }}
                          onClick={() => handleToggleAdmin(user)}
                        >
                          {isAdmin ? 'Revoke' : 'Make Admin'}
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

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.pageInfo}>
            Page {currentPage} of {totalPages} ({filtered.length} users)
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

      <MessageUserModal
        isOpen={isMsgModalOpen}
        onClose={() => { setIsMsgModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        adminUser={adminUser}
      />

      <UserDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        adminIds={adminIds}
        onToggleAdmin={handleToggleAdmin}
      />
    </div>
  );
}
