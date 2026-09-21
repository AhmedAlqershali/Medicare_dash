import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, Pencil, Plus } from 'lucide-react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataToolbar } from '../components/DataToolbar'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/AuthContext'
import { addRecord, subscribeToCollection, updateRecord, type FirestoreRecord } from '../lib/firestoreService'

type Organization = FirestoreRecord & { name: string }
type Clinic = FirestoreRecord & { name: string; organizationId: string }
type Doctor = FirestoreRecord & { name: string; email: string; specialty: string; organizationId: string; clinicId: string; status: 'active' | 'inactive' }
type DoctorForm = { name: string; email: string; specialty: string; organizationId: string; clinicId: string; status: Doctor['status'] }
const emptyForm: DoctorForm = { name: '', email: '', specialty: '', organizationId: '', clinicId: '', status: 'active' }

function getErrorMessage(error: Error) {
  if (error.message.includes('permission-denied')) return 'لا تملك صلاحية تنفيذ هذا الإجراء.'
  if (error.message.includes('unavailable')) return 'تعذر الاتصال بقاعدة البيانات. حاول مجددًا.'
  return 'حدث خطأ غير متوقع. حاول مجددًا.'
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('ar-SA')
  return '—'
}

export function DoctorsPage() {
  const { user } = useAuth()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState<DoctorForm>(emptyForm)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [viewing, setViewing] = useState<Doctor | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const unsubscribeDoctors = subscribeToCollection<Doctor>('doctors', (records) => { setDoctors(records); setIsLoading(false); setError('') }, (subscriptionError) => { setIsLoading(false); setError(getErrorMessage(subscriptionError)) })
    const unsubscribeOrganizations = subscribeToCollection<Organization>('organizations', setOrganizations, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    const unsubscribeClinics = subscribeToCollection<Clinic>('clinics', setClinics, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    return () => { unsubscribeDoctors(); unsubscribeOrganizations(); unsubscribeClinics() }
  }, [])

  const organizationNames = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization.name])), [organizations])
  const clinicNames = useMemo(() => new Map(clinics.map((clinic) => [clinic.id, clinic.name])), [clinics])
  const availableClinics = useMemo(() => clinics.filter((clinic) => clinic.organizationId === form.organizationId), [clinics, form.organizationId])
  const filteredDoctors = useMemo(() => doctors.filter((doctor) => {
    const matchesSearch = `${doctor.name} ${doctor.email} ${doctor.specialty} ${organizationNames.get(doctor.organizationId) ?? ''} ${clinicNames.get(doctor.clinicId) ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'all' || doctor.status === statusFilter)
  }), [doctors, organizationNames, clinicNames, search, statusFilter])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(''); setIsModalOpen(true) }
  const openEdit = (doctor: Doctor) => { setEditing(doctor); setForm({ name: doctor.name, email: doctor.email, specialty: doctor.specialty, organizationId: doctor.organizationId, clinicId: doctor.clinicId, status: doctor.status }); setFormError(''); setIsModalOpen(true) }
  const closeModal = () => setIsModalOpen(false)
  const updateForm = (changes: Partial<DoctorForm>) => setForm((current) => ({ ...current, ...changes }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) { setFormError('اسم الطبيب مطلوب.'); return }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setFormError('يرجى إدخال بريد إلكتروني صحيح.'); return }
    if (!form.specialty.trim()) { setFormError('التخصص مطلوب.'); return }
    if (!form.organizationId) { setFormError('يرجى اختيار المؤسسة.'); return }
    if (!form.clinicId) { setFormError('يرجى اختيار العيادة.'); return }
    if (!user) return
    setIsSaving(true); setFormError('')
    try {
      const data = { name: form.name.trim(), email: form.email.trim().toLowerCase(), specialty: form.specialty.trim(), organizationId: form.organizationId, clinicId: form.clinicId, status: form.status }
      if (editing) await updateRecord('doctors', editing.id, data)
      else await addRecord('doctors', data, user.uid)
      closeModal(); setNotice(editing ? 'تم تحديث بيانات الطبيب بنجاح.' : 'تمت إضافة الطبيب بنجاح.'); window.setTimeout(() => setNotice(''), 3500)
    } catch (saveError) { setFormError(getErrorMessage(saveError instanceof Error ? saveError : new Error())) } finally { setIsSaving(false) }
  }

  return <><Breadcrumbs current="الأطباء" /><PageHeader title="الأطباء" description="إدارة أعضاء الفريق الطبي وصلاحيات الوصول." action={<button type="button" className="primary-button" onClick={openCreate}><Plus size={18} /> إضافة طبيب</button>} /><DataToolbar searchLabel="البحث باسم الطبيب أو التخصص" searchValue={search} onSearch={setSearch} filterValue={statusFilter} onFilterChange={setStatusFilter} filterOptions={[{ value: 'all', label: 'كل الحالات' }, { value: 'active', label: 'نشطون' }, { value: 'inactive', label: 'غير نشطين' }]} />{notice && <p className="success-message" role="status">{notice}</p>}{error && <div className="data-feedback error-state" role="alert">{error}</div>}{isLoading ? <div className="data-feedback" role="status">جارٍ تحميل الأطباء...</div> : !error && filteredDoctors.length === 0 ? <div className="data-feedback empty-state-inline"><strong>{doctors.length === 0 ? 'لا يوجد أطباء بعد' : 'لا توجد نتائج مطابقة'}</strong><span>{doctors.length === 0 ? 'أضف أول طبيب للبدء.' : 'جرّب تغيير كلمات البحث أو الفلتر.'}</span></div> : !error && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>الطبيب</th><th>التخصص</th><th>العيادة</th><th>المؤسسة</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{filteredDoctors.map((doctor) => <tr key={doctor.id}><td><span className="table-primary">{doctor.name}</span><small className="table-subtext">{doctor.email}</small></td><td>{doctor.specialty}</td><td>{clinicNames.get(doctor.clinicId) ?? 'عيادة غير موجودة'}</td><td>{organizationNames.get(doctor.organizationId) ?? 'مؤسسة غير موجودة'}</td><td><StatusBadge label={doctor.status === 'active' ? 'نشط' : 'غير نشط'} tone={doctor.status === 'active' ? 'success' : 'neutral'} /></td><td><div className="table-actions"><button type="button" className="icon-button table-action" onClick={() => setViewing(doctor)} aria-label={`عرض ${doctor.name}`}><Eye size={16} /></button><button type="button" className="icon-button table-action" onClick={() => openEdit(doctor)} aria-label={`تعديل ${doctor.name}`}><Pencil size={16} /></button></div></td></tr>)}</tbody></table></div></div>}{isModalOpen && <Modal title={editing ? 'تعديل الطبيب' : 'إضافة طبيب'} description="أدخل بيانات الطبيب واربطه بالمؤسسة والعيادة." onClose={closeModal} onSubmit={handleSubmit} submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ'}><div className="form-grid"><label className="field"><span>اسم الطبيب</span><input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="اكتب اسم الطبيب" autoFocus /></label><label className="field"><span>البريد الإلكتروني</span><input type="email" value={form.email} onChange={(event) => updateForm({ email: event.target.value })} placeholder="doctor@example.com" /></label><label className="field"><span>التخصص</span><input value={form.specialty} onChange={(event) => updateForm({ specialty: event.target.value })} placeholder="مثال: طب الأسرة" /></label><label className="field"><span>الحالة</span><select value={form.status} onChange={(event) => updateForm({ status: event.target.value as Doctor['status'] })}><option value="active">نشط</option><option value="inactive">غير نشط</option></select></label><label className="field"><span>المؤسسة</span><select value={form.organizationId} onChange={(event) => updateForm({ organizationId: event.target.value, clinicId: '' })}><option value="">اختر المؤسسة</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="field"><span>العيادة</span><select value={form.clinicId} onChange={(event) => updateForm({ clinicId: event.target.value })} disabled={!form.organizationId}><option value="">{form.organizationId ? 'اختر العيادة' : 'اختر المؤسسة أولاً'}</option>{availableClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>{formError && <p className="form-error field-full" role="alert">{formError}</p>}</div></Modal>}{viewing && <Modal title={viewing.name} description="تفاصيل الطبيب" onClose={() => setViewing(null)}><div className="details-grid"><div><span>البريد الإلكتروني</span><strong>{viewing.email}</strong></div><div><span>التخصص</span><strong>{viewing.specialty}</strong></div><div><span>المؤسسة</span><strong>{organizationNames.get(viewing.organizationId) ?? 'مؤسسة غير موجودة'}</strong></div><div><span>العيادة</span><strong>{clinicNames.get(viewing.clinicId) ?? 'عيادة غير موجودة'}</strong></div><div><span>الحالة</span><strong>{viewing.status === 'active' ? 'نشط' : 'غير نشط'}</strong></div><div><span>تاريخ الإضافة</span><strong>{formatDate(viewing.createdAt)}</strong></div></div></Modal>}</>
}