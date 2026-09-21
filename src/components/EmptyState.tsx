import { ClipboardList } from 'lucide-react'

type EmptyStateProps = { title: string; description: string }

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <span className="empty-icon"><ClipboardList size={24} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}