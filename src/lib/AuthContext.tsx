import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { browserLocalPersistence, onIdTokenChanged, setPersistence, type User } from 'firebase/auth'
import { doc, getDocFromServer } from 'firebase/firestore'
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
    let checkId = 0
    const initializeAuth = async () => {
      await setPersistence(auth, browserLocalPersistence)
      unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
        const currentCheckId = ++checkId
        setUser(nextUser)
        if (!nextUser) {
          setStatus('signed-out')
          return
        }

        try {
          const uid = nextUser.uid
          await nextUser.getIdToken(true)
          if (currentCheckId !== checkId) return

          const adminSnapshot = await getDocFromServer(doc(db, 'admins', uid))
          if (currentCheckId !== checkId) return

          const admin = adminSnapshot.data() as { role?: unknown; active?: unknown } | undefined
          const isAuthorized = adminSnapshot.exists() && admin?.role === 'admin' && admin?.active === true
          setStatus(isAuthorized ? 'authorized' : 'unauthorized')
        } catch {
          if (currentCheckId === checkId) setStatus('unauthorized')
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