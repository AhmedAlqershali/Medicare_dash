import type { FormEvent, ReactNode } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  isSubmitting?: boolean
}

export function Modal({ title, description, children, onClose, onSubmit, submitLabel = 'حفظ', isSubmitting = false }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => !isSubmitting && event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><h2 id="modal-title">{title}</h2><p>{description}</p></div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="إغلاق النافذة" disabled={isSubmitting}><X size={19} /></button>
        </div>
        {onSubmit ? <form onSubmit={onSubmit}>{children}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={isSubmitting}>إلغاء</button><button type="submit" className="primary-button" disabled={isSubmitting}>{submitLabel}</button></div></form> : children}
      </section>
    </div>
  )
}