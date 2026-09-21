import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { browserLocalPersistence, onAuthStateChanged, setPersistence, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, firebaseAppCount, firebaseProjectId } from './firebase'

type AuthStatus = 'loading' | 'signed-out' | 'unauthorized' | 'authorized'

type AuthContextValue = {
  user: User | null
  status: AuthStatus
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const authDiagnosticsEnabled = import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === 'true'

function authDiagnostic(event: string, details: Record<string, unknown> = {}) {
  if (!authDiagnosticsEnabled) return
  console.info(`[auth-diagnostic] ${event}`, details)
}

function classifyFirestoreError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code.includes('permission-denied')) return 'permission-denied'
  if (code.includes('failed-precondition')) return 'failed-precondition'
  if (code.includes('unavailable') || code.includes('network')) return 'unavailable/network'
  return 'unknown'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    authDiagnostic('firebase-initialization', {
      projectId: firebaseProjectId,
      appCountAfterInitialization: firebaseAppCount,
      appName: auth.app.name,
      projectMatchesExpected: firebaseProjectId === 'medicare-8a032',
    })
    void setPersistence(auth, browserLocalPersistence).catch((error) => {
      authDiagnostic('admin-document-read-error', {
        projectId: firebaseProjectId,
        errorCode: typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        classification: classifyFirestoreError(error),
      })
      setStatus('unauthorized')
    })

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          setUser(nextUser)
          if (!nextUser) {
            authDiagnostic('status-transition', { status: 'signed-out' })
            setStatus('signed-out')
            return
          }

          try {
            const uid = nextUser.uid
            const documentPath = `admins/${uid}`
            authDiagnostic('authenticated-user', { uid, projectId: firebaseProjectId, documentPath })

            const adminSnapshot = await getDoc(doc(db, 'admins', uid))
            const admin = adminSnapshot.data() as { role?: unknown; active?: unknown } | undefined
            const isAuthorized = adminSnapshot.exists() && admin?.role === 'admin' && admin?.active === true
            authDiagnostic('admin-document-read', {
              uid,
              projectId: firebaseProjectId,
              documentPath,
              exists: adminSnapshot.exists(),
              role: admin?.role,
              active: admin?.active,
              roleMatches: admin?.role === 'admin',
              activeMatches: admin?.active === true,
            })
            authDiagnostic('status-transition', {
              uid,
              documentPath,
              status: isAuthorized ? 'authorized' : 'unauthorized',
              reason: !adminSnapshot.exists() ? 'document-does-not-exist' : admin?.role !== 'admin' ? 'role-mismatch' : admin?.active !== true ? 'active-mismatch' : 'admin-check-passed',
            })
            setStatus(isAuthorized ? 'authorized' : 'unauthorized')
          } catch (error) {
            authDiagnostic('admin-document-read-error', {
              uid: nextUser.uid,
              projectId: firebaseProjectId,
              documentPath: `admins/${nextUser.uid}`,
              errorCode: typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown',
              errorMessage: error instanceof Error ? error.message : String(error),
              classification: classifyFirestoreError(error),
            })
            authDiagnostic('status-transition', { uid: nextUser.uid, status: 'unauthorized', reason: 'admin-read-error' })
            setStatus('unauthorized')
          }
    })
    return unsubscribe
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