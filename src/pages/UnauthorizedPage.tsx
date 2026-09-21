import { ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function UnauthorizedPage() {
  const { signOutUser } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOutUser()
    navigate('/login', { replace: true })
  }

  return <main className="access-denied"><div className="access-denied-card"><span className="access-denied-icon"><ShieldAlert size={30} /></span><p className="eyebrow">صلاحيات الوصول</p><h1>لا تملك صلاحية الوصول</h1><p>هذا الحساب غير مفعّل كحساب مدير في النظام.</p><button type="button" className="primary-button" onClick={handleSignOut}>تسجيل الخروج</button></div></main>
}