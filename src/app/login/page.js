'use client';

import { Suspense, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './login.module.css';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Show error if redirected from AuthProvider with unauthorized status
  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized_admin') {
      setError('Access Denied: You must have admin credentials to access that page.');
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Immediately check admin status to provide better feedback
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const adminDocRef = doc(db, 'admins', firebaseUser.uid);
      const adminDoc = await getDoc(adminDocRef);

      if (adminDoc.exists()) {
        router.push('/dashboard');
      } else {
        setError(`Access Denied: Your account is not in the authorized admins list.`);
        await auth.signOut();
      }
    } catch (err) {
      console.error('Login error:', err);
      // Map Firebase error codes to user-friendly messages
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoBadge}>BC</div>
          <h1 className={styles.title}>Balik-Calasiao</h1>
          <p className={styles.subtitle}>Official Admin Command Center</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.inputGroup}>
            <label htmlFor="email">Police Email</label>
            <input
              id="email"
              type="email"
              placeholder="officer@pcr.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

        <div className={styles.footer}>
          Authorized access only. All actions are logged.
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className={styles.container}>Loading authentication system...</div>}>
      <LoginContent />
    </Suspense>
  );
}
