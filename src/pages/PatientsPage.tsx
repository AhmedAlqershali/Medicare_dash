import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataToolbar } from '../components/DataToolbar'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { subscribeToCollection, type FirestoreRecord } from '../lib/firestoreService'

type Organization = FirestoreRecord & { name: string }
type Clinic = FirestoreRecord & { name: string; organizationId: string }
type Patient = FirestoreRecord & { name: string; email?: string; phone?: string; organizationId: string; clinicId: string; status: 'active' | 'archived' }

function getErrorMessage(error: Error) {
  if (error.message.includes('permission-denied')) return 'لا تملك صلاحية عرض بيانات المرضى.'
  if (error.message.includes('unavailable')) return 'تعذر الاتصال بقاعدة البيانات. حاول مجددًا.'
  return 'تعذر تحميل بيانات المرضى. حاول مجددًا.'
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('ar-SA')
  return '—'
}

export function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewing, setViewing] = useState<Patient | null>(null)

  useEffect(() => {
    const unsubscribePatients = subscribeToCollection<Patient>('patients', (records) => { setPatients(records); setIsLoading(false); setError('') }, (subscriptionError) => { setIsLoading(false); setError(getErrorMessage(subscriptionError)) })
    const unsubscribeOrganizations = subscribeToCollection<Organization>('organizations', setOrganizations, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    const unsubscribeClinics = subscribeToCollection<Clinic>('clinics', setClinics, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    return () => { unsubscribePatients(); unsubscribeOrganizations(); unsubscribeClinics() }
  }, [])

  const organizationNames = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization.name])), [organizations])
  const clinicNames = useMemo(() => new Map(clinics.map((clinic) => [clinic.id, clinic.name])), [clinics])
  const filteredPatients = useMemo(() => patients.filter((patient) => {
    const matchesSearch = `${patient.name} ${patient.email ?? ''} ${patient.phone ?? ''} ${organizationNames.get(patient.organizationId) ?? ''} ${clinicNames.get(patient.clinicId) ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'all' || patient.status === statusFilter)
  }), [patients, organizationNames, clinicNames, search, statusFilter])

  return <><Breadcrumbs current="المرضى" /><PageHeader title="المرضى" description="الوصول إلى قائمة المرضى ضمن الصلاحيات المسموحة." /><div className="privacy-banner"><span>مساحة محمية</span><p>تظهر البيانات وفقًا لصلاحياتك فقط، وتقتصر المعلومات المعروضة على البيانات الأساسية.</p></div><DataToolbar searchLabel="البحث بالاسم أو البريد أو الهاتف" searchValue={search} onSearch={setSearch} filterValue={statusFilter} onFilterChange={setStatusFilter} filterOptions={[{ value: 'all', label: 'كل الحالات' }, { value: 'active', label: 'نشطون' }, { value: 'archived', label: 'مؤرشفون' }]} />{error && <div className="data-feedback error-state" role="alert">{error}</div>}{!isLoading && !error && patients.length > 0 && <p className="success-message" role="status">تم تحميل بيانات المرضى بنجاح.</p>}{isLoading ? <div className="data-feedback" role="status">جارٍ تحميل المرضى...</div> : !error && filteredPatients.length === 0 ? <div className="data-feedback empty-state-inline"><strong>{patients.length === 0 ? 'لا توجد سجلات مرضى' : 'لا توجد نتائج مطابقة'}</strong><span>{patients.length === 0 ? 'ستظهر السجلات هنا عند ربطها بقاعدة البيانات.' : 'جرّب تغيير كلمات البحث أو الفلتر.'}</span></div> : !error && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>المريض</th><th>المؤسسة</th><th>العيادة</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead><tbody>{filteredPatients.map((patient) => <tr key={patient.id}><td><span className="table-primary">{patient.name}</span><small className="table-subtext">{patient.email || patient.phone || 'بيانات اتصال غير متوفرة'}</small></td><td>{organizationNames.get(patient.organizationId) ?? 'مؤسسة غير موجودة'}</td><td>{clinicNames.get(patient.clinicId) ?? 'عيادة غير موجودة'}</td><td><StatusBadge label={patient.status === 'active' ? 'نشط' : 'مؤرشف'} tone={patient.status === 'active' ? 'success' : 'neutral'} /></td><td>{formatDate(patient.updatedAt)}</td><td><button type="button" className="icon-button table-action" onClick={() => setViewing(patient)} aria-label={`عرض ملف ${patient.name}`}><Eye size={16} /></button></td></tr>)}</tbody></table></div></div>}{viewing && <Modal title={viewing.name} description="الملف الأساسي للمريض" onClose={() => setViewing(null)}><div className="details-grid"><div><span>البريد الإلكتروني</span><strong>{viewing.email || 'غير متوفر'}</strong></div><div><span>رقم الهاتف</span><strong>{viewing.phone || 'غير متوفر'}</strong></div><div><span>المؤسسة</span><strong>{organizationNames.get(viewing.organizationId) ?? 'مؤسسة غير موجودة'}</strong></div><div><span>العيادة</span><strong>{clinicNames.get(viewing.clinicId) ?? 'عيادة غير موجودة'}</strong></div><div><span>الحالة</span><strong>{viewing.status === 'active' ? 'نشط' : 'مؤرشف'}</strong></div><div><span>آخر تحديث</span><strong>{formatDate(viewing.updatedAt)}</strong></div></div></Modal>}</>
}