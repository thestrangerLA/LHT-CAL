import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if we already have a local guest user (bypasses Firebase Auth entirely)
    const localGuestId = localStorage.getItem('lth_local_guest_id');
    if (localGuestId) {
      console.info("Using existing local guest session:", localGuestId);
      setUser({
        uid: localGuestId,
        displayName: 'Guest User (Local)',
        isAnonymous: true,
        email: null,
        emailVerified: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => { localStorage.removeItem('lth_local_guest_id'); window.location.reload(); },
        getIdToken: async () => '',
        getIdTokenResult: async () => ({} as any),
        reload: async () => {},
        toJSON: () => ({}),
        phoneNumber: null,
        photoURL: null,
      } as any);
      setLoading(false);
      return;
    }

    // 2. Otherwise, listen to Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!currentUser.isAnonymous) {
          // If logged in with Google, sign out to force anonymous guest experience
          try {
            await signOut(auth);
          } catch (error) {
            console.error("Error signing out:", error);
          }
        } else {
          setUser(currentUser);
          setLoading(false);
        }
      } else {
        // Not logged in, try to sign in anonymously
        try {
          await signInAnonymously(auth);
        } catch (error: any) {
          // If Anonymous Auth is disabled or fails, use a local persistent ID
          if (error.code !== 'auth/admin-restricted-operation') {
            console.error("Firebase Anonymous Auth issue:", error.code || error.message);
          }
          
          let persistentId = localStorage.getItem('lth_local_guest_id');
          if (!persistentId) {
            persistentId = `guest_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('lth_local_guest_id', persistentId);
          }

          setUser({
            uid: persistentId,
            displayName: 'Guest User',
            isAnonymous: true,
            email: null,
            emailVerified: false,
            metadata: {},
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => { localStorage.removeItem('lth_local_guest_id'); window.location.reload(); },
            getIdToken: async () => '',
            getIdTokenResult: async () => ({} as any),
            reload: async () => {},
            toJSON: () => ({}),
            phoneNumber: null,
            photoURL: null,
          } as any);
          
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    console.log("Login disabled - using anonymous guest account");
  };

  const logout = async () => {
    console.log("Logout disabled");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
