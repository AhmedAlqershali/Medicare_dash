import { useState } from 'react'
import { ArrowLeft, HeartPulse, LockKeyhole, Mail } from 'lucide-react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useLocation, useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebase'

function getFirebaseErrorMessage(errorCode: string) {
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/invalid-email': 'يرجى إدخال بريد إلكتروني صحيح.',
    'auth/user-disabled': 'تم تعطيل هذا الحساب. تواصل مع المسؤول.',
    'auth/too-many-requests': 'محاولات كثيرة. يرجى المحاولة لاحقًا.',
    'auth/network-request-failed': 'تعذر الاتصال. تحقق من الشبكة وحاول مجددًا.',
  }
  return messages[errorCode] ?? 'تعذر تسجيل الدخول. تحقق من بياناتك وحاول مجددًا.'
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate(location.state?.from ?? '/dashboard', { replace: true })
    } catch (error) {
      const errorCode = error instanceof Error ? error.message.match(/auth\/[\w-]+/)?.[0] ?? '' : ''
      setError(getFirebaseErrorMessage(errorCode))
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="login-page"><div className="login-aside"><div className="login-brand"><span className="brand-mark"><HeartPulse size={22} /></span><strong>Medicare</strong></div><div className="login-message"><p className="eyebrow">إدارة صحية أكثر وضوحًا</p><h1>كل ما تحتاجه لإدارة مؤسستك الصحية.</h1><p>منصة واحدة تساعدك على تنظيم عملياتك اليومية، ومتابعة فريقك، وتقديم رعاية أفضل.</p></div><span className="login-aside-footer">© 2025 Medicare</span></div><div className="login-form-wrap"><div className="login-form"><p className="eyebrow">مرحبًا بعودتك</p><h2>تسجيل الدخول</h2><p className="form-intro">أدخل بياناتك للوصول إلى لوحة الإدارة.</p><form onSubmit={handleSubmit}><label htmlFor="email">البريد الإلكتروني</label><div className="input-wrap"><Mail size={18} /><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organization.com" required /></div><label htmlFor="password">كلمة المرور</label><div className="input-wrap"><LockKeyhole size={18} /><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></div><div className="form-options"><label className="checkbox-label"><input type="checkbox" /> تذكرني</label><button type="button" className="text-button">نسيت كلمة المرور؟</button></div>{error && <p className="auth-error" role="alert">{error}</p>}<button type="submit" className="primary-button login-button" disabled={isSubmitting}>{isSubmitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'} <ArrowLeft size={18} /></button></form><p className="login-note">تتم حماية الوصول إلى لوحة الإدارة عبر Firebase.</p></div></div></main>
}