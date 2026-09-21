import type { ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'

type EmptyTableProps = { columns: string[]; message?: string; action?: ReactNode }

export function EmptyTable({ columns, message = 'لا توجد بيانات لعرضها بعد', action }: EmptyTableProps) {
  return <div className="table-card"><div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody><tr><td colSpan={columns.length}><div className="table-empty"><span className="empty-icon"><ClipboardList size={21} /></span><strong>{message}</strong><p>ستظهر السجلات هنا بعد ربط مصدر البيانات.</p>{action}</div></td></tr></tbody></table></div></div>
}