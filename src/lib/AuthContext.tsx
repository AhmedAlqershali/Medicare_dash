import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { browserLocalPersistence, onAuthStateChanged, setPersistence, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

type AuthStatus = 'loading' | 'signed-out' | 'unauthorized' | 'authorized'

type AuthContextValue = {
  user: User | null
  status: AuthStatus
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let unsubscribe: () => void = () => undefined
    const initializeAuth = async () => {
      await setPersistence(auth, browserLocalPersistence)
      unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        setUser(nextUser)
        if (!nextUser) {
          setStatus('signed-out')
          return
        }

        try {
          const adminSnapshot = await getDoc(doc(db, 'admins', nextUser.uid))
          const admin = adminSnapshot.data()
          setStatus(admin?.role === 'admin' && admin?.active === true ? 'authorized' : 'unauthorized')
        } catch {
          setStatus('unauthorized')
        }
      })
    }
    void initializeAuth()
    return () => unsubscribe()
  }, [])

  const signOutUser = async () => {
    await auth.signOut()
  }

  return <AuthContext.Provider value={{ user, status, signOutUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}