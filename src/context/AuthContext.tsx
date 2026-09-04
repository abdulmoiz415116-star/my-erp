'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase/client';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { RecordStatus } from '@/types/common';
import { localReactiveStore } from '@/services/base.service';
import { TenantUser } from '@/types/tenant';

export interface ERPUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  status: RecordStatus;
  lastLoginAt?: string;
}

interface AuthContextType {
  user: ERPUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isSuspended: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateUserProfile: (data: { displayName?: string; phone?: string; photoURL?: string }) => Promise<void>;
  isMockAuth: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_MOCK_USER: ERPUser = {
  uid: 'user-default-admin',
  email: 'admin@apex-corp.com',
  displayName: 'Enterprise Administrator',
  phone: '+1 (555) 019-2834',
  status: 'active',
  lastLoginAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ERPUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(false);

  // Initialize auth
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('erp_mock_auth_user') : null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ERPUser;
          setUser(parsed);
          setIsSuspended(parsed.status === 'inactive');
        } catch {
          setUser(DEV_MOCK_USER);
        }
      } else {
        setUser(DEV_MOCK_USER);
      }
      setIsMock(true);
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setUser(DEV_MOCK_USER);
      setIsMock(true);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setUser({
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          photoURL: fbUser.photoURL || undefined,
          status: 'active',
          lastLoginAt: fbUser.metadata.lastSignInTime || new Date().toISOString(),
        });
      } else {
        setUser(null);
        setIsSuspended(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time synchronization of user status across active workspace
  useEffect(() => {
    if (!user) return;

    const activeTenantId = typeof window !== 'undefined' ? localStorage.getItem('erp_active_tenant_id') : null;
    if (!activeTenantId) return;

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const userDocRef = doc(db, `tenants/${activeTenantId}/users`, user.uid);
        const unsubscribe = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as TenantUser;
            if (data.status === 'inactive') {
              setIsSuspended(true);
            } else {
              setIsSuspended(false);
            }
          }
        });
        return () => unsubscribe();
      }
    } else {
      // Local dev mode: listen to reactive store
      const unsubscribe = localReactiveStore.subscribe<TenantUser>(activeTenantId, 'users', (tenantUsers) => {
        const currentUserRecord = tenantUsers.find((u) => u.id === user.uid || u.email === user.email);
        if (currentUserRecord) {
          setIsSuspended(currentUserRecord.status === 'inactive');
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const signIn = async (email: string, pass: string) => {
    if (isMock || !isFirebaseConfigured()) {
      const mockUser: ERPUser = {
        uid: email.includes('admin') ? 'user-default-admin' : `user-${Date.now()}`,
        email,
        displayName: email.split('@')[0].toUpperCase(),
        status: 'active',
        lastLoginAt: new Date().toISOString(),
      };
      setUser(mockUser);
      setIsSuspended(false);
      localStorage.setItem('erp_mock_auth_user', JSON.stringify(mockUser));
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth is not available');
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      setIsSuspended(false);
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    if (isMock || !isFirebaseConfigured()) {
      const mockUser: ERPUser = {
        uid: `user-${Date.now()}`,
        email,
        displayName: name,
        status: 'active',
        lastLoginAt: new Date().toISOString(),
      };
      setUser(mockUser);
      localStorage.setItem('erp_mock_auth_user', JSON.stringify(mockUser));
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth is not available');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await firebaseUpdateProfile(cred.user, { displayName: name });
    }
  };

  const signOut = async () => {
    if (isMock || !isFirebaseConfigured()) {
      setUser(null);
      setIsSuspended(false);
      localStorage.removeItem('erp_mock_auth_user');
      return;
    }

    const auth = getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setIsSuspended(false);
  };

  const resetPassword = async (email: string) => {
    if (isMock || !isFirebaseConfigured()) {
      // In dev mode, simulate successful reset dispatch
      return;
    }
    const auth = getFirebaseAuth();
    if (auth) {
      await sendPasswordResetEmail(auth, email);
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (isMock || !isFirebaseConfigured()) {
      // In dev mode, simulate successful password change
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser || !auth.currentUser.email) {
      throw new Error('No authenticated user session found.');
    }

    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
    // Re-authenticate user before critical security operation
    await reauthenticateWithCredential(auth.currentUser, credential);
    await firebaseUpdatePassword(auth.currentUser, newPass);
  };

  const updateUserProfile = async (data: { displayName?: string; phone?: string; photoURL?: string }) => {
    if (isMock || !isFirebaseConfigured()) {
      if (user) {
        const updated: ERPUser = {
          ...user,
          displayName: data.displayName || user.displayName,
          phone: data.phone !== undefined ? data.phone : user.phone,
          photoURL: data.photoURL || user.photoURL,
        };
        setUser(updated);
        localStorage.setItem('erp_mock_auth_user', JSON.stringify(updated));
      }
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) throw new Error('No user authenticated');

    await firebaseUpdateProfile(auth.currentUser, {
      displayName: data.displayName,
      photoURL: data.photoURL,
    });

    if (user) {
      setUser({
        ...user,
        displayName: data.displayName || user.displayName,
        photoURL: data.photoURL || user.photoURL,
        phone: data.phone || user.phone,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isSuspended,
        signIn,
        signUp,
        signOut,
        resetPassword,
        changePassword,
        updateUserProfile,
        isMockAuth: isMock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
