import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Mail, Plus, XCircle } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataToolbar } from '../components/DataToolbar'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/AuthContext'
import { addRecord, subscribeToCollection, updateRecord, type FirestoreRecord } from '../lib/firestoreService'

type Organization = FirestoreRecord & { name: string; email?: string }
type Clinic = FirestoreRecord & { name: string; organizationId: string }
type Invitation = FirestoreRecord & { recipientEmail: string; recipientType: 'doctor' | 'staff'; organizationId: string; clinicId: string; status: 'pending' | 'cancelled'; expiresAt?: Timestamp }
type InvitationForm = { recipientType: Invitation['recipientType']; organizationId: string; clinicId: string; expiresAt: string }
const emptyForm: InvitationForm = { recipientType: 'doctor', organizationId: '', clinicId: '', expiresAt: '' }

function getErrorMessage(error: Error) {
  if (error.message.includes('permission-denied')) return 'لا تملك صلاحية تنفيذ هذا الإجراء.'
  if (error.message.includes('unavailable')) return 'تعذر الاتصال بقاعدة البيانات. حاول مجددًا.'
  return 'حدث خطأ غير متوقع. حاول مجددًا.'
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('ar-SA')
  return '—'
}

function toDateInput(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString().slice(0, 10)
  return ''
}

export function InvitationsPage() {
  const { user } = useAuth()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState<InvitationForm>(emptyForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const unsubscribeInvitations = subscribeToCollection<Invitation>('invitations', (records) => { setInvitations(records); setIsLoading(false); setError('') }, (subscriptionError) => { setIsLoading(false); setError(getErrorMessage(subscriptionError)) })
    const unsubscribeOrganizations = subscribeToCollection<Organization>('organizations', setOrganizations, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    const unsubscribeClinics = subscribeToCollection<Clinic>('clinics', setClinics, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    return () => { unsubscribeInvitations(); unsubscribeOrganizations(); unsubscribeClinics() }
  }, [])

  const organizationNames = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization.name])), [organizations])
  const clinicNames = useMemo(() => new Map(clinics.map((clinic) => [clinic.id, clinic.name])), [clinics])
  const availableClinics = useMemo(() => clinics.filter((clinic) => clinic.organizationId === form.organizationId), [clinics, form.organizationId])
  const selectedOrganization = organizations.find((organization) => organization.id === form.organizationId)
  const getStatus = (invitation: Invitation) => {
    const expirationDate = invitation.expiresAt?.toDate()
    return invitation.status === 'pending' && expirationDate !== undefined && expirationDate < new Date() ? 'expired' : invitation.status
  }
  const filteredInvitations = useMemo(() => invitations.filter((invitation) => {
    const status = getStatus(invitation)
    const matchesSearch = `${invitation.recipientEmail} ${organizationNames.get(invitation.organizationId) ?? ''} ${clinicNames.get(invitation.clinicId) ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'all' || status === statusFilter)
  }), [invitations, organizationNames, clinicNames, search, statusFilter])

  const openCreate = () => { setForm({ ...emptyForm, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }); setFormError(''); setIsModalOpen(true) }
  const closeModal = () => setIsModalOpen(false)
  const updateForm = (changes: Partial<InvitationForm>) => setForm((current) => ({ ...current, ...changes }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.organizationId) { setFormError('يرجى اختيار المؤسسة.'); return }
    if (!selectedOrganization?.email) { setFormError('لا يمكن إنشاء الدعوة لأن بريد المؤسسة غير مضاف. أضف بريدًا للمؤسسة أولًا.'); return }
    if (!form.clinicId) { setFormError('يرجى اختيار العيادة.'); return }
    if (!form.expiresAt || new Date(`${form.expiresAt}T23:59:59`) <= new Date()) { setFormError('يجب أن يكون تاريخ الانتهاء في المستقبل.'); return }
    if (!user) return
    setIsSaving(true); setFormError('')
    try {
      await addRecord('invitations', { recipientEmail: selectedOrganization.email.trim().toLowerCase(), recipientType: form.recipientType, organizationId: form.organizationId, clinicId: form.clinicId, status: 'pending', expiresAt: Timestamp.fromDate(new Date(`${form.expiresAt}T23:59:59`)) }, user.uid)
      closeModal(); setNotice('تم إنشاء الدعوة بنجاح. لم يتم إرسال بريد إلكتروني.'); window.setTimeout(() => setNotice(''), 4000)
    } catch (saveError) { setFormError(getErrorMessage(saveError instanceof Error ? saveError : new Error())) } finally { setIsSaving(false) }
  }

  const cancelInvitation = async (invitation: Invitation) => {
    try { await updateRecord('invitations', invitation.id, { status: 'cancelled' }); setNotice('تم إلغاء الدعوة بنجاح.'); window.setTimeout(() => setNotice(''), 3500) } catch (cancelError) { setError(getErrorMessage(cancelError instanceof Error ? cancelError : new Error())) }
  }

  const statusLabel = (status: string) => status === 'pending' ? 'معلقة' : status === 'cancelled' ? 'ملغاة' : 'منتهية'
  const statusTone = (status: string) => status === 'pending' ? 'pending' as const : 'neutral' as const

  return <><Breadcrumbs current="الدعوات" /><PageHeader title="الدعوات" description="أنشئ الدعوات وتابع حالة انضمام أعضاء الفريق." action={<button type="button" className="primary-button" onClick={openCreate}><Plus size={18} /> دعوة عضو</button>} /><DataToolbar searchLabel="البحث بالبريد الإلكتروني" searchValue={search} onSearch={setSearch} filterValue={statusFilter} onFilterChange={setStatusFilter} filterOptions={[{ value: 'all', label: 'كل الحالات' }, { value: 'pending', label: 'معلقة' }, { value: 'expired', label: 'منتهية' }, { value: 'cancelled', label: 'ملغاة' }]} />{notice && <p className="success-message" role="status">{notice}</p>}{error && <div className="data-feedback error-state" role="alert">{error}</div>}{isLoading ? <div className="data-feedback" role="status">جارٍ تحميل الدعوات...</div> : !error && filteredInvitations.length === 0 ? <div className="data-feedback empty-state-inline"><Mail size={22} /><strong>{invitations.length === 0 ? 'لا توجد دعوات' : 'لا توجد نتائج مطابقة'}</strong><span>{invitations.length === 0 ? 'ستظهر الدعوات المنشأة هنا.' : 'جرّب تغيير كلمات البحث أو الفلتر.'}</span></div> : !error && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>البريد الإلكتروني</th><th>نوع المستلم</th><th>المؤسسة</th><th>العيادة</th><th>تاريخ الإنشاء</th><th>الانتهاء</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{filteredInvitations.map((invitation) => { const status = getStatus(invitation); return <tr key={invitation.id}><td className="table-primary">{invitation.recipientEmail}</td><td>{invitation.recipientType === 'doctor' ? 'طبيب' : 'عضو فريق'}</td><td>{organizationNames.get(invitation.organizationId) ?? 'مؤسسة غير موجودة'}</td><td>{clinicNames.get(invitation.clinicId) ?? 'عيادة غير موجودة'}</td><td>{formatDate(invitation.createdAt)}</td><td>{formatDate(invitation.expiresAt)}</td><td><StatusBadge label={statusLabel(status)} tone={statusTone(status)} /></td><td>{status === 'pending' && <button type="button" className="icon-button table-action" onClick={() => cancelInvitation(invitation)} aria-label={`إلغاء دعوة ${invitation.recipientEmail}`}><XCircle size={16} /></button>}</td></tr> })}</tbody></table></div></div>}{isModalOpen && <Modal title="دعوة عضو" description="أنشئ دعوة مرتبطة بالمؤسسة والعيادة. لن يتم إرسال بريد إلكتروني حالياً." onClose={closeModal} onSubmit={handleSubmit} submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ الدعوة'}><div className="form-grid"><label className="field"><span>المؤسسة</span><select value={form.organizationId} onChange={(event) => updateForm({ organizationId: event.target.value, clinicId: '' })} autoFocus><option value="">اختر المؤسسة</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="field"><span>البريد الإلكتروني للمؤسسة</span><input type="email" value={selectedOrganization?.email ?? ''} placeholder="أضف بريدًا للمؤسسة أولاً" readOnly /></label><label className="field"><span>نوع المستلم</span><select value={form.recipientType} onChange={(event) => updateForm({ recipientType: event.target.value as Invitation['recipientType'] })}><option value="doctor">طبيب</option><option value="staff">عضو فريق</option></select></label><label className="field"><span>العيادة</span><select value={form.clinicId} onChange={(event) => updateForm({ clinicId: event.target.value })} disabled={!form.organizationId}><option value="">{form.organizationId ? 'اختر العيادة' : 'اختر المؤسسة أولاً'}</option>{availableClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><label className="field"><span>تاريخ الانتهاء</span><input type="date" value={form.expiresAt} onChange={(event) => updateForm({ expiresAt: event.target.value })} /></label>{formError && <p className="form-error field-full" role="alert">{formError}</p>}</div></Modal>}</>
}