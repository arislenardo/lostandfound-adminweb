'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  loading: true
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const adminDocRef = doc(db, 'admins', firebaseUser.uid);
          const adminDoc = await getDoc(adminDocRef);

          if (adminDoc.exists()) {
            setUser(firebaseUser);
            setIsAdmin(true);
          } else {
            console.warn('Unauthorized access attempt by:', firebaseUser.email);
            await signOut(auth);
            setUser(null);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error verifying admin status:", error);
          await signOut(auth);
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === '/login' || pathname === '/';

    if (user && isAdmin) {
      if (isLoginPage) {
        router.push('/dashboard');
      }
    } else {
      if (!isLoginPage) {
        // Redirect to login with a specific error code
        router.push('/login?error=unauthorized_admin');
      }
    }
  }, [user, isAdmin, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {loading ? (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center' }}>
          Loading Admin Portal...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
