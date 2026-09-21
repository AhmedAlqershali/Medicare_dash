import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Breadcrumbs } from './Breadcrumbs'
import { DataToolbar } from './DataToolbar'
import { EmptyTable } from './EmptyTable'
import { Modal } from './Modal'
import { PageHeader } from './PageHeader'

type Field = { label: string; placeholder: string; type?: string; options?: string[] }
type ManagementPageProps = { title: string; description: string; addLabel: string; breadcrumb: string; columns: string[]; fields: Field[]; emptyMessage: string; relationshipLabel?: string }

export function ManagementPage({ title, description, addLabel, breadcrumb, columns, fields, emptyMessage, relationshipLabel }: ManagementPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const closeModal = () => setIsModalOpen(false)
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); closeModal() }

  return <><Breadcrumbs current={breadcrumb} /><PageHeader title={title} description={description} action={<button type="button" className="primary-button" onClick={() => setIsModalOpen(true)}><Plus size={18} /> {addLabel}</button>} /><DataToolbar filterLabel={relationshipLabel ?? 'كل الحالات'} /><EmptyTable columns={columns} message={emptyMessage} />{isModalOpen && <Modal title={addLabel} description="أدخل المعلومات الأساسية. سيتم تفعيل الحفظ عند ربط مصدر البيانات." onClose={closeModal} onSubmit={handleSubmit} submitLabel="حفظ كمسودة"> <div className="form-grid">{fields.map((field) => <label className="field" key={field.label}><span>{field.label}</span>{field.options ? <select defaultValue=""><option value="" disabled>{field.placeholder}</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.type ?? 'text'} placeholder={field.placeholder} />}</label>)}</div></Modal>}</>
}