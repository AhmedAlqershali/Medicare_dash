import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <div className="auth-loading" role="status">جارٍ التحقق من صلاحيات الدخول...</div>
  if (status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (status === 'unauthorized') return <Navigate to="/unauthorized" replace />
  return <Outlet />
}