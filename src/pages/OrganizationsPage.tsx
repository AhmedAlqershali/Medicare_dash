import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataToolbar } from '../components/DataToolbar'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/AuthContext'
import { addRecord, deleteOrganizationCascade, subscribeToCollection, updateRecord, type FirestoreRecord } from '../lib/firestoreService'

type Organization = FirestoreRecord & { name: string; email?: string; description?: string; status: 'active' | 'inactive' }
type OrganizationForm = { name: string; email: string; description: string; status: Organization['status'] }
const emptyForm: OrganizationForm = { name: '', email: '', description: '', status: 'active' }

function getErrorMessage(error: Error) {
  if (error.message.includes('permission-denied')) return 'لا تملك صلاحية تنفيذ هذا الإجراء.'
  if (error.message.includes('unavailable')) return 'تعذر الاتصال بقاعدة البيانات. حاول مجددًا.'
  return 'حدث خطأ غير متوقع. حاول مجددًا.'
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('ar-SA')
  return '—'
}

export function OrganizationsPage() {
  const { user } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState<OrganizationForm>(emptyForm)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [viewing, setViewing] = useState<Organization | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingOrganization, setDeletingOrganization] = useState<Organization | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => subscribeToCollection<Organization>('organizations', (records) => {
    setOrganizations(records)
    setIsLoading(false)
    setError('')
  }, (subscriptionError) => {
    setIsLoading(false)
    setError(getErrorMessage(subscriptionError))
  }), [])

  const filteredOrganizations = useMemo(() => organizations.filter((organization) => {
    const matchesSearch = `${organization.name} ${organization.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'all' || organization.status === statusFilter)
  }), [organizations, search, statusFilter])

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setFormError(''); setIsModalOpen(true) }
  const openEdit = (organization: Organization) => { setEditing(organization); setForm({ name: organization.name, email: organization.email ?? '', description: organization.description ?? '', status: organization.status }); setFormError(''); setIsModalOpen(true) }
  const closeModal = () => setIsModalOpen(false)
  const openDelete = (organization: Organization) => { setDeletingOrganization(organization); setDeleteError('') }
  const closeDelete = () => { if (!isDeleting) setDeletingOrganization(null) }

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deletingOrganization || !user) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await deleteOrganizationCascade(deletingOrganization.id)
      setDeletingOrganization(null)
      setNotice('تم حذف المؤسسة وجميع البيانات المرتبطة بها بنجاح.')
      window.setTimeout(() => setNotice(''), 3500)
    } catch (deleteFailure) {
      setDeleteError(getErrorMessage(deleteFailure instanceof Error ? deleteFailure : new Error()))
    } finally { setIsDeleting(false) }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) { setFormError('اسم المؤسسة مطلوب.'); return }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setFormError('البريد الإلكتروني للمؤسسة مطلوب ويجب أن يكون صحيحًا.'); return }
    if (!user) return
    setIsSaving(true)
    setFormError('')
    try {
      const data = { name: form.name.trim(), email: form.email.trim().toLowerCase(), description: form.description.trim(), status: form.status }
      if (editing) await updateRecord('organizations', editing.id, data)
      else await addRecord('organizations', data, user.uid)
      closeModal()
      setNotice(editing ? 'تم تحديث المؤسسة بنجاح.' : 'تمت إضافة المؤسسة بنجاح.')
      window.setTimeout(() => setNotice(''), 3500)
    } catch (saveError) {
      setFormError(getErrorMessage(saveError instanceof Error ? saveError : new Error()))
    } finally { setIsSaving(false) }
  }

  return <><Breadcrumbs current="المؤسسات" /><PageHeader title="المؤسسات" description="إدارة المؤسسات الصحية المرتبطة بحسابك." action={<button type="button" className="primary-button" onClick={() => openCreate()}><Plus size={18} /> إضافة مؤسسة</button>} /><DataToolbar searchValue={search} onSearch={setSearch} filterValue={statusFilter} onFilterChange={setStatusFilter} filterOptions={[{ value: 'all', label: 'كل الحالات' }, { value: 'active', label: 'نشطة' }, { value: 'inactive', label: 'غير نشطة' }]} />{notice && <p className="success-message" role="status">{notice}</p>}{error && <div className="data-feedback error-state" role="alert">{error}</div>}{isLoading ? <div className="data-feedback" role="status">جارٍ تحميل المؤسسات...</div> : !error && filteredOrganizations.length === 0 ? <div className="data-feedback empty-state-inline"><strong>{organizations.length === 0 ? 'لا توجد مؤسسات بعد' : 'لا توجد نتائج مطابقة'}</strong><span>{organizations.length === 0 ? 'أضف أول مؤسسة للبدء.' : 'جرّب تغيير كلمات البحث أو الفلتر.'}</span></div> : !error && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>اسم المؤسسة</th><th>البريد الإلكتروني</th><th>الوصف</th><th>الحالة</th><th>تاريخ الإضافة</th><th>الإجراءات</th></tr></thead><tbody>{filteredOrganizations.map((organization) => <tr key={organization.id}><td className="table-primary">{organization.name}</td><td>{organization.email || 'غير مضاف'}</td><td>{organization.description || '—'}</td><td><StatusBadge label={organization.status === 'active' ? 'نشطة' : 'غير نشطة'} tone={organization.status === 'active' ? 'success' : 'neutral'} /></td><td>{formatDate(organization.createdAt)}</td><td><div className="table-actions"><button type="button" className="icon-button table-action" onClick={() => setViewing(organization)} aria-label={`عرض ${organization.name}`}><Eye size={16} /></button><button type="button" className="icon-button table-action" onClick={() => openEdit(organization)} aria-label={`تعديل ${organization.name}`}><Pencil size={16} /></button><button type="button" className="icon-button table-action" onClick={() => openDelete(organization)} aria-label={`حذف ${organization.name}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div></div>}{isModalOpen && <Modal title={editing ? 'تعديل المؤسسة' : 'إضافة مؤسسة'} description="أدخل المعلومات الأساسية للمؤسسة." onClose={closeModal} onSubmit={handleSubmit} submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ'}><div className="form-grid"><label className="field"><span>اسم المؤسسة</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="اكتب اسم المؤسسة" autoFocus /></label><label className="field"><span>البريد الإلكتروني</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="organization@example.com" required /></label><label className="field"><span>الحالة</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Organization['status'] })}><option value="active">نشطة</option><option value="inactive">غير نشطة</option></select></label><label className="field field-full"><span>الوصف</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="وصف مختصر للمؤسسة" rows={3} /></label>{formError && <p className="form-error field-full" role="alert">{formError}</p>}</div></Modal>}{viewing && <Modal title={viewing.name} description="تفاصيل المؤسسة" onClose={() => setViewing(null)}><div className="details-grid"><div><span>البريد الإلكتروني</span><strong>{viewing.email || 'غير مضاف'}</strong></div><div><span>الحالة</span><strong>{viewing.status === 'active' ? 'نشطة' : 'غير نشطة'}</strong></div><div><span>تاريخ الإضافة</span><strong>{formatDate(viewing.createdAt)}</strong></div><div className="field-full"><span>الوصف</span><strong>{viewing.description || 'لا يوجد وصف.'}</strong></div></div></Modal>}{deletingOrganization && <Modal title="حذف المؤسسة" description="هذا الإجراء نهائي ولا يمكن التراجع عنه." onClose={closeDelete} onSubmit={handleDelete} submitLabel={isDeleting ? 'جارٍ الحذف...' : 'حذف المؤسسة'} isSubmitting={isDeleting}><div className="details-grid"><p className="field-full">هل أنت متأكد من حذف مؤسسة <strong>{deletingOrganization.name}</strong>؟ سيتم حذف جميع العيادات والأطباء والمرضى والمواعيد والدعوات المرتبطة بهذه المؤسسة نهائيًا.</p>{deleteError && <p className="form-error field-full" role="alert">{deleteError}</p>}</div></Modal>}</>
}