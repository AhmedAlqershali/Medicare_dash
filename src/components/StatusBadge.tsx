type StatusBadgeProps = { label: string; tone?: 'success' | 'pending' | 'neutral' }

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge ${tone}`}><span />{label}</span>
}