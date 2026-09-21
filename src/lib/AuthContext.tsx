import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { browserLocalPersistence, onIdTokenChanged, setPersistence, type User } from 'firebase/auth'
import { doc, getDocFromServer } from 'firebase/firestore'
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
    let unsubscribe: () => void = () => undefined
    let checkId = 0
    const initializeAuth = async () => {
      authDiagnostic('firebase-initialization', {
        projectId: firebaseProjectId,
        appCountAfterInitialization: firebaseAppCount,
        appName: auth.app.name,
        projectMatchesExpected: firebaseProjectId === 'medicare-8a032',
      })
      await setPersistence(auth, browserLocalPersistence)
      unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
        const currentCheckId = ++checkId
        setUser(nextUser)
        if (!nextUser) {
          authDiagnostic('status-transition', { status: 'signed-out', checkId: currentCheckId })
          setStatus('signed-out')
          return
        }

        try {
          const uid = nextUser.uid
          const documentPath = `admins/${uid}`
          authDiagnostic('authenticated-user', { uid, projectId: firebaseProjectId, documentPath, checkId: currentCheckId })
          await nextUser.getIdToken(true)
          if (currentCheckId !== checkId) {
            authDiagnostic('race-detected', { uid, documentPath, checkId: currentCheckId, latestCheckId: checkId })
            return
          }

          const adminSnapshot = await getDocFromServer(doc(db, 'admins', uid))
          const admin = adminSnapshot.data() as { role?: unknown; active?: unknown } | undefined
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
          if (currentCheckId !== checkId) {
            authDiagnostic('race-detected-after-read', { uid, documentPath, checkId: currentCheckId, latestCheckId: checkId })
            return
          }

          const isAuthorized = adminSnapshot.exists() && admin?.role === 'admin' && admin?.active === true
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
          if (currentCheckId === checkId) {
            authDiagnostic('status-transition', { uid: nextUser.uid, status: 'unauthorized', reason: 'admin-read-error' })
            setStatus('unauthorized')
          }
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