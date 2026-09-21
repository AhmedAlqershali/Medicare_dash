import { useState } from 'react'
import { Bell, CalendarDays, ChevronDown, CircleHelp, LayoutDashboard, Building2, Stethoscope, Users, UserRound, Mail, Settings, Menu, X, LogOut, ShieldCheck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import type { NavigationItem } from '../types/navigation'
import { Logo } from '../components/Logo'
import { useAuth } from '../lib/AuthContext'

const navigation: NavigationItem[] = [
  { label: 'نظرة عامة', path: '/dashboard', icon: LayoutDashboard },
  { label: 'المؤسسات', path: '/organizations', icon: Building2 },
  { label: 'العيادات', path: '/clinics', icon: Stethoscope },
  { label: 'الأطباء', path: '/doctors', icon: UserRound },
  { label: 'المرضى', path: '/patients', icon: Users },
  { label: 'المواعيد', path: '/appointments', icon: CalendarDays },
  { label: 'الدعوات', path: '/invitations', icon: Mail },
]

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user, signOutUser } = useAuth()
  const displayName = user?.displayName || user?.email || 'مدير النظام'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top"><Logo /><button className="icon-button close-menu" onClick={() => setIsSidebarOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button></div>
        <div className="workspace-switcher"><span className="workspace-avatar">م</span><span><strong>مؤسسة Medicare</strong><small>مساحة الإدارة</small></span><ChevronDown size={16} /></div>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <span className="nav-label">نظرة عامة</span>
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="nav-label">النظام</span>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Settings size={19} /><span>الإعدادات</span></NavLink>
          <button type="button" className="nav-link nav-button" onClick={signOutUser}><LogOut size={19} /><span>تسجيل الخروج</span></button>
          <div className="support-box"><CircleHelp size={18} /><div><strong>هل تحتاج إلى مساعدة؟</strong><span>تواصل مع الدعم</span></div></div>
        </div>
      </aside>
      {isSidebarOpen && <button className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} aria-label="إغلاق القائمة" />}
      <div className="content-shell">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setIsSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={22} /></button><div className="topbar-actions"><span className="security-note"><ShieldCheck size={15} /> بيئة إدارة آمنة</span><button className="icon-button notification-button" aria-label="الإشعارات"><Bell size={20} /><span /></button><button type="button" className="user-menu" aria-label="فتح قائمة الحساب"><span className="user-avatar">{displayName.charAt(0).toUpperCase()}</span><span className="user-details"><strong>{displayName}</strong><small>مدير النظام</small></span><ChevronDown size={16} /></button></div></header>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  )
}