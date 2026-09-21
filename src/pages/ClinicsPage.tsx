import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, Pencil, Plus } from 'lucide-react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataToolbar } from '../components/DataToolbar'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/AuthContext'
import { addRecord, subscribeToCollection, updateRecord, type FirestoreRecord } from '../lib/firestoreService'

type Organization = FirestoreRecord & { name: string; status: 'active' | 'inactive' }
type Clinic = FirestoreRecord & { name: string; organizationId: string; location?: string; status: 'active' | 'inactive' }
type ClinicForm = { name: string; organizationId: string; location: string; status: Clinic['status'] }
const emptyForm: ClinicForm = { name: '', organizationId: '', location: '', status: 'active' }

function getErrorMessage(error: Error) {
  if (error.message.includes('permission-denied')) return 'لا تملك صلاحية تنفيذ هذا الإجراء.'
  if (error.message.includes('unavailable')) return 'تعذر الاتصال بقاعدة البيانات. حاول مجددًا.'
  return 'حدث خطأ غير متوقع. حاول مجددًا.'
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('ar-SA')
  return '—'
}

export function ClinicsPage() {
  const { user } = useAuth()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState<ClinicForm>(emptyForm)
  const [editing, setEditing] = useState<Clinic | null>(null)
  const [viewing, setViewing] = useState<Clinic | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const unsubscribeClinics = subscribeToCollection<Clinic>('clinics', (records) => {
      setClinics(records)
      setIsLoading(false)
      setError('')
    }, (subscriptionError) => {
      setIsLoading(false)
      setError(getErrorMessage(subscriptionError))
    })
    const unsubscribeOrganizations = subscribeToCollection<Organization>('organizations', setOrganizations, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    return () => { unsubscribeClinics(); unsubscribeOrganizations() }
  }, [])

  const organizationNames = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization.name])), [organizations])
  const filteredClinics = useMemo(() => clinics.filter((clinic) => {
    const organizationName = organizationNames.get(clinic.organizationId) ?? ''
    const matchesSearch = `${clinic.name} ${clinic.location ?? ''} ${organizationName}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'all' || clinic.status === statusFilter)
  }), [clinics, organizationNames, search, statusFilter])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(''); setIsModalOpen(true) }
  const openEdit = (clinic: Clinic) => { setEditing(clinic); setForm({ name: clinic.name, organizationId: clinic.organizationId, location: clinic.location ?? '', status: clinic.status }); setFormError(''); setIsModalOpen(true) }
  const closeModal = () => setIsModalOpen(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) { setFormError('اسم العيادة مطلوب.'); return }
    if (!form.organizationId) { setFormError('يرجى اختيار المؤسسة.'); return }
    if (!user) return
    setIsSaving(true)
    setFormError('')
    try {
      const data = { name: form.name.trim(), organizationId: form.organizationId, location: form.location.trim(), status: form.status }
      if (editing) await updateRecord('clinics', editing.id, data)
      else await addRecord('clinics', data, user.uid)
      closeModal()
      setNotice(editing ? 'تم تحديث العيادة بنجاح.' : 'تمت إضافة العيادة بنجاح.')
      window.setTimeout(() => setNotice(''), 3500)
    } catch (saveError) {
      setFormError(getErrorMessage(saveError instanceof Error ? saveError : new Error()))
    } finally { setIsSaving(false) }
  }

  return <><Breadcrumbs current="العيادات" /><PageHeader title="العيادات" description="استعرض العيادات وأدر مساحات العمل التابعة لمؤسساتك." action={<button type="button" className="primary-button" onClick={openCreate}><Plus size={18} /> إضافة عيادة</button>} /><DataToolbar searchLabel="البحث في العيادات" searchValue={search} onSearch={setSearch} filterValue={statusFilter} onFilterChange={setStatusFilter} filterOptions={[{ value: 'all', label: 'كل الحالات' }, { value: 'active', label: 'نشطة' }, { value: 'inactive', label: 'غير نشطة' }]} />{notice && <p className="success-message" role="status">{notice}</p>}{error && <div className="data-feedback error-state" role="alert">{error}</div>}{isLoading ? <div className="data-feedback" role="status">جارٍ تحميل العيادات...</div> : !error && filteredClinics.length === 0 ? <div className="data-feedback empty-state-inline"><strong>{clinics.length === 0 ? 'لا توجد عيادات بعد' : 'لا توجد نتائج مطابقة'}</strong><span>{clinics.length === 0 ? 'أضف أول عيادة للبدء.' : 'جرّب تغيير كلمات البحث أو الفلتر.'}</span></div> : !error && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>اسم العيادة</th><th>المؤسسة</th><th>الموقع</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{filteredClinics.map((clinic) => <tr key={clinic.id}><td className="table-primary">{clinic.name}</td><td>{organizationNames.get(clinic.organizationId) ?? 'مؤسسة غير موجودة'}</td><td>{clinic.location || '—'}</td><td><StatusBadge label={clinic.status === 'active' ? 'نشطة' : 'غير نشطة'} tone={clinic.status === 'active' ? 'success' : 'neutral'} /></td><td><div className="table-actions"><button type="button" className="icon-button table-action" onClick={() => setViewing(clinic)} aria-label={`عرض ${clinic.name}`}><Eye size={16} /></button><button type="button" className="icon-button table-action" onClick={() => openEdit(clinic)} aria-label={`تعديل ${clinic.name}`}><Pencil size={16} /></button></div></td></tr>)}</tbody></table></div></div>}{isModalOpen && <Modal title={editing ? 'تعديل العيادة' : 'إضافة عيادة'} description="أدخل المعلومات الأساسية واربط العيادة بمؤسسة." onClose={closeModal} onSubmit={handleSubmit} submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ'}><div className="form-grid"><label className="field"><span>اسم العيادة</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="اكتب اسم العيادة" autoFocus /></label><label className="field"><span>المؤسسة</span><select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}><option value="">اختر المؤسسة</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="field"><span>الموقع</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="العنوان أو الموقع" /></label><label className="field"><span>الحالة</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Clinic['status'] })}><option value="active">نشطة</option><option value="inactive">غير نشطة</option></select></label>{organizations.length === 0 && <p className="form-error field-full" role="alert">أضف مؤسسة أولاً قبل إنشاء عيادة.</p>}{formError && <p className="form-error field-full" role="alert">{formError}</p>}</div></Modal>}{viewing && <Modal title={viewing.name} description="تفاصيل العيادة" onClose={() => setViewing(null)}><div className="details-grid"><div><span>المؤسسة</span><strong>{organizationNames.get(viewing.organizationId) ?? 'مؤسسة غير موجودة'}</strong></div><div><span>الحالة</span><strong>{viewing.status === 'active' ? 'نشطة' : 'غير نشطة'}</strong></div><div><span>الموقع</span><strong>{viewing.location || 'لا يوجد موقع.'}</strong></div><div><span>تاريخ الإضافة</span><strong>{formatDate(viewing.createdAt)}</strong></div></div></Modal>}</>
}