import { ChevronLeft, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Breadcrumbs({ current }: { current: string }) {
  return <nav className="breadcrumbs" aria-label="مسار الصفحة"><Link to="/dashboard"><Home size={13} /> الرئيسية</Link><ChevronLeft size={14} /><span>{current}</span></nav>
}