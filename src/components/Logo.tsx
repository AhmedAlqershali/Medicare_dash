import { HeartPulse } from 'lucide-react'

export function Logo() {
  return (
    <div className="brand" aria-label="Medicare">
      <span className="brand-mark"><HeartPulse size={20} strokeWidth={2.5} /></span>
      <span>Medicare</span>
    </div>
  )
}